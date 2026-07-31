# ── RDS PostgreSQL ───────────────────────────────────────
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.9"

  identifier = "${local.name_prefix}-postgres"

  engine               = "postgres"
  engine_version       = "16.3"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = var.rds_instance_class

  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  storage_encrypted     = var.enable_encryption
  storage_type          = "gp3"
  iops                  = 3000
  storage_throughput    = 125

  db_name  = "social_media_os"
  username = "smos"
  port     = 5432

  multi_az               = var.rds_multi_az
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [aws_security_group.rds.id]

  maintenance_window      = "Sun:05:00-Sun:06:00"
  backup_window           = "03:00-04:00"
  backup_retention_period = 30
  copy_tags_to_snapshot   = true
  skip_final_snapshot     = var.environment == "staging" ? true : false
  deletion_protection     = var.environment == "production" ? true : false

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  create_cloudwatch_log_group     = true

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  parameters = [
    {
      name         = "max_connections"
      value        = "200"
      apply_method = "pending-reboot"
    },
    {
      name         = "shared_buffers"
      value        = "{DBInstanceClassMemory/4}"
      apply_method = "pending-reboot"
    },
    {
      name         = "log_min_duration_statement"
      value        = "1000"
      apply_method = "immediate"
    },
    {
      name         = "random_page_cost"
      value        = "1.1"
      apply_method = "immediate"
    },
    {
      name         = "effective_cache_size"
      value        = "{DBInstanceClassMemory*3/4}"
      apply_method = "pending-reboot"
    },
    {
      name         = "work_mem"
      value        = "5242"
      apply_method = "immediate"
    },
  ]

  tags = merge(local.common_tags, var.tags)
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  ingress {
    description     = "PostgreSQL from RDS monitoring"
    from_port       = 5432
    to_port         = 5432
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

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-rds-sg" }, var.tags)
}

# ── RDS Proxy (connection pooling) ───────────────────────
resource "aws_db_proxy" "main" {
  count = var.environment == "production" ? 1 : 0

  name                   = "${local.name_prefix}-db-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy[0].arn
  vpc_security_group_ids = [aws_security_group.rds.id]
  vpc_subnet_ids         = module.vpc.database_subnets

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.rds_master_password[0].arn
  }

  tags = merge(local.common_tags, var.tags)
}

resource "aws_db_proxy_default_target_group" "main" {
  count = var.environment == "production" ? 1 : 0

  db_proxy_name = aws_db_proxy.main[0].name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    init_query                   = "SET application_name = 'SMOS'"
  }
}

resource "aws_db_proxy_target" "main" {
  count = var.environment == "production" ? 1 : 0

  db_proxy_name          = aws_db_proxy.main[0].name
  target_group_name      = aws_db_proxy_default_target_group.main[0].name
  db_instance_identifier = module.rds.db_instance_identifier
}

resource "aws_secretsmanager_secret" "rds_master_password" {
  count = var.environment == "production" ? 1 : 0

  name                    = "${local.name_prefix}-rds-password"
  recovery_window_in_days = 7

  tags = merge(local.common_tags, var.tags)
}

resource "aws_iam_role" "rds_proxy" {
  count = var.environment == "production" ? 1 : 0

  name = "${local.name_prefix}-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, var.tags)
}

resource "aws_iam_role_policy_attachment" "rds_proxy_secrets" {
  count = var.environment == "production" ? 1 : 0

  role       = aws_iam_role.rds_proxy[0].name
  policy_arn = "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
}
