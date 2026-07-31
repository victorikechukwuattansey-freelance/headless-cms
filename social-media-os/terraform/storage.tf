# ── S3 Buckets ───────────────────────────────────────────
locals {
  bucket_prefix = local.name_prefix
}

module "s3_media" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 4.1"

  bucket = "${local.bucket_prefix}-media-${data.aws_caller_identity.current.account_id}"

  acl                         = "private"
  force_destroy               = var.environment == "staging" ? true : false
  control_object_ownership    = true
  object_ownership            = "BucketOwnerEnforced"

  attach_deny_insecure_transport_policy = true
  attach_require_latest_tls_policy      = true

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = module.kms.key_arn
      }
    }
  }

  versioning = {
    enabled    = true
    mfa_delete = false
  }

  lifecycle_rule = [
    {
      id      = "expire-noncurrent"
      enabled = true
      noncurrent_version_expiration = {
        days = 90
      }
    }
  ]

  logging = {
    target_bucket = module.s3_logs.bucket_id
    target_prefix = "logs/media/"
  }

  cors_rule = [{
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = var.allowed_origin_domains
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }]

  tags = merge(local.common_tags, { Name = "${local.bucket_prefix}-media" }, var.tags)
}

module "s3_assets" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 4.1"

  bucket = "${local.bucket_prefix}-assets-${data.aws_caller_identity.current.account_id}"

  acl                         = "private"
  force_destroy               = var.environment == "staging" ? true : false
  control_object_ownership    = true
  object_ownership            = "BucketOwnerEnforced"

  attach_deny_insecure_transport_policy = true
  attach_require_latest_tls_policy      = true

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = module.kms.key_arn
      }
    }
  }

  versioning = {
    enabled    = true
    mfa_delete = false
  }

  logging = {
    target_bucket = module.s3_logs.bucket_id
    target_prefix = "logs/assets/"
  }

  tags = merge(local.common_tags, { Name = "${local.bucket_prefix}-assets" }, var.tags)
}

module "s3_exports" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 4.1"

  bucket = "${local.bucket_prefix}-exports-${data.aws_caller_identity.current.account_id}"

  acl                         = "private"
  force_destroy               = var.environment == "staging" ? true : false
  control_object_ownership    = true
  object_ownership            = "BucketOwnerEnforced"

  attach_deny_insecure_transport_policy = true
  attach_require_latest_tls_policy      = true

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = module.kms.key_arn
      }
    }
  }

  versioning = {
    enabled    = true
    mfa_delete = false
  }

  lifecycle_rule = [
    {
      id      = "expire-exports"
      enabled = true
      expiration = {
        days = 7
      }
    }
  ]

  logging = {
    target_bucket = module.s3_logs.bucket_id
    target_prefix = "logs/exports/"
  }

  tags = merge(local.common_tags, { Name = "${local.bucket_prefix}-exports" }, var.tags)
}

module "s3_logs" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 4.1"

  bucket = "${local.bucket_prefix}-logs-${data.aws_caller_identity.current.account_id}"

  acl                      = "log-delivery-write"
  force_destroy            = var.environment == "staging" ? true : false
  control_object_ownership = true
  object_ownership         = "BucketOwnerPreferred"

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
    }
  }

  lifecycle_rule = [
    {
      id      = "expire-logs"
      enabled = true
      expiration = {
        days = 365
      }
    },
    {
      id      = "transition-glacier"
      enabled = true
      transition = [
        {
          days          = 90
          storage_class = "GLACIER"
        }
      ]
    }
  ]

  tags = merge(local.common_tags, { Name = "${local.bucket_prefix}-logs" }, var.tags)
}

# ── IAM Policy for S3 Access ─────────────────────────────
resource "aws_iam_policy" "s3_access" {
  name        = "${local.name_prefix}-s3-access"
  description = "Policy for S3 bucket access from EKS workloads"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetObjectAcl",
          "s3:PutObjectAcl"
        ]
        Resource = [
          module.s3_media.bucket_arn,
          "${module.s3_media.bucket_arn}/*",
          module.s3_assets.bucket_arn,
          "${module.s3_assets.bucket_arn}/*",
          module.s3_exports.bucket_arn,
          "${module.s3_exports.bucket_arn}/*"
        ]
      }
    ]
  })

  tags = merge(local.common_tags, var.tags)
}
