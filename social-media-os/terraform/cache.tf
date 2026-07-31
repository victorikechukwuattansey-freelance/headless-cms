# ── ElastiCache Redis ────────────────────────────────────
locals {
  redis_parameter_group_name = "${local.name_prefix}-redis-pg"
}

resource "aws_elasticache_parameter_group" "redis" {
  name        = local.redis_parameter_group_name
  family      = "redis7"
  description = "Custom parameter group for Social Media OS Redis"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  parameter {
    name  = "lazyfree-lazy-eviction"
    value = "yes"
  }

  parameter {
    name  = "lazyfree-lazy-expire"
    value = "yes"
  }

  parameter {
    name  = "lazyfree-lazy-server-del"
    value = "yes"
  }

  parameter {
    name  = "replica-lazy-flush"
    value = "yes"
  }

  tags = merge(local.common_tags, var.tags)
}

module "redis" {
  source  = "terraform-aws-modules/elasticache/aws"
  version = "~> 1.3"

  replication_group_name        = "${local.name_prefix}-redis"
  description                   = "ElastiCache Redis for Social Media OS"
  engine                        = "redis"
  engine_version                = "7.1"
  node_type                     = var.redis_node_type
  parameter_group_name          = aws_elasticache_parameter_group.redis.name
  port                          = 6379
  num_cache_clusters            = var.redis_num_cache_nodes
  multi_az_enabled              = var.environment == "production" ? true : false
  automatic_failover_enabled    = var.environment == "production" ? true : false
  at_rest_encryption_enabled    = var.enable_encryption
  transit_encryption_enabled    = true
  auth_token                    = random_password.redis_auth.result
  auth_token_update_strategy    = "ROTATE"

  subnet_ids          = module.vpc.private_subnets
  security_group_ids  = [aws_security_group.redis.id]
  vpc_id              = module.vpc.vpc_id

  maintenance_window = "sun:05:00-sun:09:00"
  snapshot_window    = "03:00-05:00"
  snapshot_retention_limit = 7

  apply_immediately = var.environment == "staging" ? true : false

  cloudwatch_logs_exports = {
    log_group_name   = "/aws/elasticache/${local.name_prefix}-redis"
    log_type         = "slow-log"
    retention_in_days = var.log_retention_days
  }

  tags = merge(local.common_tags, var.tags)
}

resource "random_password" "redis_auth" {
  length           = 32
  special          = false
  override_special = "!@#$%&"
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name                    = "${local.name_prefix}-redis-auth"
  recovery_window_in_days = 7

  tags = merge(local.common_tags, var.tags)
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth.result
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  ingress {
    description     = "Redis from EKS cluster"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-redis-sg" }, var.tags)
}
