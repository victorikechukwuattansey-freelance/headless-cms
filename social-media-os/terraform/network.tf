module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.12"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs
  database_subnets = var.database_subnet_cidrs

  create_database_subnet_group       = true
  create_database_subnet_route_table = true
  enable_dns_hostnames               = true
  enable_dns_support                 = true
  enable_nat_gateway                 = true
  single_nat_gateway                 = var.environment == "staging" ? true : false
  one_nat_gateway_per_az             = var.environment == "production" ? true : false
  enable_vpn_gateway                 = false

  # Enable S3 and DynamoDB endpoints for private subnets
  enable_s3_endpoint              = true
  enable_dynamodb_endpoint        = true
  enable_ec2_endpoint             = true
  enable_ecs_endpoint             = true
  enable_ecr_api_endpoint         = true
  enable_ecr_dkr_endpoint         = true
  enable_cloudwatch_logs_endpoint = true
  enable_cloudwatch_monitoring_endpoint = true
  enable_ssm_endpoint             = true
  enable_ssmmessages_endpoint     = true

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  tags = merge(local.common_tags, var.tags)
}

# ── Security Groups ─────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for the application load balancer"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-alb-sg" }, var.tags)
}

resource "aws_security_group_rule" "alb_to_api" {
  type                     = "ingress"
  from_port                = 3001
  to_port                  = 3001
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = module.eks.node_security_group_id
  description              = "Allow traffic from ALB to API service"
}

resource "aws_security_group_rule" "alb_to_web" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = module.eks.node_security_group_id
  description              = "Allow traffic from ALB to Web service"
}

# ── Application Load Balancer ────────────────────────────
module "alb" {
  source  = "terraform-aws-modules/alb/aws"
  version = "~> 9.9"

  name = "${local.name_prefix}-alb"

  load_balancer_type = "application"
  vpc_id             = module.vpc.vpc_id
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]

  enable_deletion_protection = var.environment == "production"
  enable_http2               = true
  idle_timeout               = 60
  ip_address_type            = "dualstack"

  listeners = {
    http_redirect = {
      port     = 80
      protocol = "HTTP"
      redirect = {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
    https_frontend = {
      port            = 443
      protocol        = "HTTPS"
      ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
      certificate_arn = var.acm_certificate_arn

      fixed_response = {
        content_type = "text/plain"
        message_body = "OK"
        status_code  = "200"
      }
    }
  }

  target_groups = {
    api = {
      name             = "${local.name_prefix}-api-tg"
      backend_protocol = "HTTP"
      backend_port     = 3001
      target_type      = "ip"

      health_check = {
        enabled             = true
        path                = "/health"
        port                = 3001
        healthy_threshold   = 2
        unhealthy_threshold = 3
        timeout             = 5
        interval            = 30
        matcher             = "200-399"
      }
    }
    web = {
      name             = "${local.name_prefix}-web-tg"
      backend_protocol = "HTTP"
      backend_port     = 3000
      target_type      = "ip"

      health_check = {
        enabled             = true
        path                = "/api/health"
        port                = 3000
        healthy_threshold   = 2
        unhealthy_threshold = 3
        timeout             = 5
        interval            = 30
        matcher             = "200-399"
      }
    }
  }

  rules = {
    api_rule = {
      listener_key = "https_frontend"
      priority     = 10
      actions = [{
        type               = "forward"
        target_group_index = 0
      }]
      conditions = [{
        path_patterns = ["/api/*", "/ws/*"]
      }]
    }
    web_rule = {
      listener_key = "https_frontend"
      priority     = 20
      actions = [{
        type               = "forward"
        target_group_index = 1
      }]
      conditions = [{
        path_patterns = ["/*"]
      }]
    }
  }

  tags = merge(local.common_tags, var.tags)
}

# ── Route53 DNS ──────────────────────────────────────────
data "aws_route53_zone" "primary" {
  zone_id = var.domain_zone_id
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "app.${var.domain_name}"
  type    = "A"

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}
