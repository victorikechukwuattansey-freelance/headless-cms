# ── KMS Key for CloudFront ───────────────────────────────
resource "aws_kms_key" "cloudfront" {
  description             = "KMS key for CloudFront media distribution"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-cloudfront-key" }, var.tags)
}

# ── CloudFront Origin Access Control ─────────────────────
resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${local.name_prefix}-media-oac"
  description                       = "OAC for Social Media OS media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront Distribution ──────────────────────────────
module "cdn" {
  source  = "terraform-aws-modules/cloudfront/aws"
  version = "~> 3.4"

  aliases = ["media.${var.domain_name}"]

  comment             = "CloudFront distribution for Social Media OS"
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  retain_on_delete    = false
  wait_for_deployment = true

  create_origin_access_control = false

  # S3 Media Origin
  origins = {
    media_s3 = {
      domain_name = module.s3_media.bucket_regional_domain_name
      origin_id   = "media-s3-origin"

      origin_access_control_id = aws_cloudfront_origin_access_control.media.id
    }
  }

  default_cache_behavior = {
    target_origin_id = "media-s3-origin"

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors_s3.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id

    realtime_log_config_arn = var.environment == "production" ? aws_cloudfront_realtime_log_config.main[0].arn : null
  }

  ordered_cache_behaviors = {
    images = {
      target_origin_id = "media-s3-origin"

      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD", "OPTIONS"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true

      path_pattern = "images/*"

      cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
      origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors_s3.id
      response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
    }
    videos = {
      target_origin_id = "media-s3-origin"

      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD", "OPTIONS"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true

      path_pattern = "videos/*"

      cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
      origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors_s3.id
      response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
    }
  }

  custom_error_response = {
    not_found = {
      error_code         = 404
      response_code      = 404
      response_page_path = "/404.html"
    }
  }

  viewer_certificate = {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  geo_restriction = {
    restriction_type = "none"
  }

  tags = merge(local.common_tags, var.tags)
}

# ── CloudFront Cache/Origin Request/Response Policies ────
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy"
}

# ── CloudFront Real-time Logs ────────────────────────────
resource "aws_cloudfront_realtime_log_config" "main" {
  count = var.environment == "production" ? 1 : 0

  name          = "${local.name_prefix}-realtime-logs"
  sampling_rate = 50
  fields        = ["timestamp", "c-ip", "cs-uri-stem", "sc-status", "cs-user-agent", "cs-host", "cs-referer"]

  endpoint {
    stream_type = "Kinesis"
    kinesis_stream_config {
      role_arn   = aws_iam_role.cloudfront_logs[0].arn
      stream_arn = aws_kinesis_firehose_delivery_stream.cloudfront_logs[0].arn
    }
  }
}

resource "aws_kinesis_firehose_delivery_stream" "cloudfront_logs" {
  count = var.environment == "production" ? 1 : 0

  name        = "${local.name_prefix}-cloudfront-logs"
  destination = "s3"

  s3_configuration {
    bucket_arn  = module.s3_logs.bucket_arn
    role_arn    = aws_iam_role.cloudfront_logs[0].arn
    prefix      = "cloudfront/"
    buffer_size = 10
    buffer_interval = 60
    compression_format = "GZIP"
  }

  tags = merge(local.common_tags, var.tags)
}

resource "aws_iam_role" "cloudfront_logs" {
  count = var.environment == "production" ? 1 : 0

  name = "${local.name_prefix}-cloudfront-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, var.tags)
}

# ── Route53 Record for CDN ───────────────────────────────
resource "aws_route53_record" "media" {
  zone_id = var.domain_zone_id
  name    = "media.${var.domain_name}"
  type    = "A"

  alias {
    name                   = module.cdn.domain_name
    zone_id                = module.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}

# ── S3 Bucket Policy for CloudFront Access ───────────────
resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = module.s3_media.bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${module.s3_media.bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${module.cdn.distribution_id}"
          }
        }
      }
    ]
  })
}
