output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnets
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = module.vpc.database_subnets
}

output "database_subnet_group_name" {
  description = "Name of the database subnet group"
  value       = module.vpc.database_subnet_group
}

output "eks_cluster_id" {
  description = "ID of the EKS cluster"
  value       = module.eks.cluster_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_certificate_authority_data" {
  description = "Certificate authority data of the EKS cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_cluster_security_group_id" {
  description = "Security group ID of the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "eks_node_security_group_id" {
  description = "Security group ID of the EKS worker nodes"
  value       = module.eks.node_security_group_id
}

output "eks_oidc_provider_arn" {
  description = "ARN of the EKS OIDC provider"
  value       = module.eks.oidc_provider_arn
}

output "eks_oidc_provider_url" {
  description = "URL of the EKS OIDC provider"
  value       = module.eks.oidc_provider
}

output "rds_endpoint" {
  description = "Endpoint of the RDS instance"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_address" {
  description = "Address of the RDS instance"
  value       = module.rds.address
}

output "rds_port" {
  description = "Port of the RDS instance"
  value       = module.rds.port
}

output "rds_database_name" {
  description = "Name of the database"
  value       = module.rds.db_name
}

output "redis_endpoint" {
  description = "Endpoint of the ElastiCache Redis cluster"
  value       = module.redis.endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Port of the ElastiCache Redis cluster"
  value       = module.redis.port
}

output "redis_replication_group_id" {
  description = "ID of the Redis replication group"
  value       = module.redis.replication_group_id
}

output "s3_media_bucket_id" {
  description = "ID of the S3 media bucket"
  value       = module.s3_media.bucket_id
}

output "s3_media_bucket_arn" {
  description = "ARN of the S3 media bucket"
  value       = module.s3_media.bucket_arn
}

output "s3_assets_bucket_id" {
  description = "ID of the S3 assets bucket"
  value       = module.s3_assets.bucket_id
}

output "s3_exports_bucket_id" {
  description = "ID of the S3 exports bucket"
  value       = module.s3_exports.bucket_id
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.cdn.distribution_id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = module.cdn.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "Hosted zone ID of the CloudFront distribution"
  value       = module.cdn.hosted_zone_id
}

output "ecr_repository_api_url" {
  description = "URL of the ECR repository for the API service"
  value       = module.ecr_api.repository_url
}

output "ecr_repository_web_url" {
  description = "URL of the ECR repository for the Web service"
  value       = module.ecr_web.repository_url
}

output "kms_key_id" {
  description = "ID of the KMS key for encryption"
  value       = module.kms.key_id
}

output "kms_key_arn" {
  description = "ARN of the KMS key for encryption"
  value       = module.kms.key_arn
}

output "monitoring_grafana_endpoint" {
  description = "Endpoint of the Grafana monitoring dashboard"
  value       = module.monitoring.grafana_endpoint
}

output "monitoring_prometheus_endpoint" {
  description = "Endpoint of the Prometheus monitoring"
  value       = module.monitoring.prometheus_endpoint
}

output "load_balancer_dns" {
  description = "DNS name of the application load balancer"
  value       = module.alb.dns_name
}

output "load_balancer_zone_id" {
  description = "Route53 zone ID of the load balancer"
  value       = module.alb.zone_id
}
