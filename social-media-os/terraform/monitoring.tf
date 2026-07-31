# ── CloudWatch Log Groups ────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/eks/${local.name_prefix}-cluster/api"
  retention_in_days = var.log_retention_days
  kms_key_id        = module.kms.key_arn

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-api-logs" }, var.tags)
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/aws/eks/${local.name_prefix}-cluster/web"
  retention_in_days = var.log_retention_days
  kms_key_id        = module.kms.key_arn

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-web-logs" }, var.tags)
}

resource "aws_cloudwatch_log_group" "nginx" {
  name              = "/aws/eks/${local.name_prefix}-cluster/nginx"
  retention_in_days = var.log_retention_days
  kms_key_id        = module.kms.key_arn

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-nginx-logs" }, var.tags)
}

# ── CloudWatch Metric Alarms ─────────────────────────────
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${local.name_prefix}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "API 5XX errors exceeded threshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = module.alb.arn_suffix
    TargetGroup  = module.alb.target_group_arn_suffixes["api"]
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_high_latency" {
  alarm_name          = "${local.name_prefix}-api-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "p95"
  threshold           = 2.0
  alarm_description   = "API p95 latency exceeded 2 seconds"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = module.alb.arn_suffix
    TargetGroup  = module.alb.target_group_arn_suffixes["api"]
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization above 80%"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${local.name_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis CPU utilization above 80%"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    CacheClusterId = module.redis.replication_group_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_healthy_hosts" {
  alarm_name          = "${local.name_prefix}-alb-healthy-hosts"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 2
  alarm_description   = "ALB healthy hosts below threshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = module.alb.arn_suffix
    TargetGroup  = module.alb.target_group_arn_suffixes["api"]
  }

  tags = local.common_tags
}

# ── SNS Topics ───────────────────────────────────────────
resource "aws_sns_topic" "alarms" {
  name = "${local.name_prefix}-alarms"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.environment == "production" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = "alerts@${var.domain_name}"
}

resource "aws_sns_topic_subscription" "alarms_slack" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "https"
  endpoint  = "https://hooks.slack.com/services/TEST/SLACK/HOOK"
}

# ── Grafana (via Helm) ───────────────────────────────────
module "monitoring" {
  source  = "terraform-aws-modules/managed-service-grafana/aws"
  version = "~> 2.0"

  name = "${local.name_prefix}-grafana"

  account_access_type        = "CURRENT_ACCOUNT"
  authentication_providers   = ["AWS_SSO"]
  permission_type            = "SERVICE_MANAGED"
  data_sources               = ["CLOUDWATCH", "PROMETHEUS", "XRAY"]
  grafana_version            = "10.4"
  notification_destinations  = ["SNS"]

  configuration = jsonencode({
    unifiedAlerting = {
      enabled = true
    }
    plugins = {
      pluginAdminEnabled = false
    }
  })

  vpc_configuration = {
    subnet_ids = module.vpc.private_subnets
    security_group_ids = [aws_security_group.grafana.id]
  }

  tags = merge(local.common_tags, var.tags)
}

resource "aws_security_group" "grafana" {
  name        = "${local.name_prefix}-grafana-sg"
  description = "Security group for Grafana"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "Grafana HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-grafana-sg" }, var.tags)
}

# ── AMP (Amazon Managed Prometheus) ──────────────────────
resource "aws_prometheus_workspace" "main" {
  alias = local.name_prefix

  tags = local.common_tags
}

# ── IAM for AMP ingestion ────────────────────────────────
resource "aws_iam_policy" "amp_remote_write" {
  name        = "${local.name_prefix}-amp-remote-write"
  description = "Policy for AMP remote write from EKS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "aps:RemoteWrite",
          "aps:GetSeries",
          "aps:GetLabels",
          "aps:GetMetricMetadata"
        ]
        Resource = aws_prometheus_workspace.main.arn
      }
    ]
  })

  tags = local.common_tags
}

output "amp_workspace_id" {
  value = aws_prometheus_workspace.main.id
}

output "amp_workspace_endpoint" {
  value = aws_prometheus_workspace.main.prometheus_endpoint
}

output "grafana_workspace_id" {
  value = module.monitoring.workspace_id
}

output "grafana_endpoint" {
  value = module.monitoring.endpoint
}
