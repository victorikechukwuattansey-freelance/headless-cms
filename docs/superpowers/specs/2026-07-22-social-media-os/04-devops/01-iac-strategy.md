# Infrastructure as Code Strategy — AI Social Media OS

| Attribute | Detail |
|---|---|
| **Platform** | Multi-tenant AI Social Media OS |
| **Stack** | NestJS + Next.js + PostgreSQL + Redis + BullMQ + Docker/K8s |
| **Compliance** | SOC 2 Type II, GDPR, CCPA |
| **IaC Tool** | Terraform 1.9+ with OpenTofu compatibility |
| **Cloud** | AWS (primary), GCP (DR) — multi-cloud patterns documented |

---

## 1. Terraform Structure

### 1.1 Repository Layout

```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── terraform.tfvars
│       └── backend.tf
├── modules/
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── eks/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── rds/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── redis/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── storage/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── cdn/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── iam/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── waf/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── dns/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   └── monitoring/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── README.md
├── global/
│   ├── iam-base/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── route53-root/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── scripts/
│   ├── migrate-state.sh
│   ├── drift-detect.sh
│   └── cost-tag-validate.sh
├── terragrunt.hcl  (if using Terragrunt for DRY config)
├── .terraform-docs.yml
├── .tflint.hcl
└── README.md
```

### 1.2 Module Organization Principles

- **Single-responsibility modules** — each module manages exactly one resource category
- **Versioned modules** — published to a private Terraform registry or Git tags (`v1.0.0`, `v1.1.0`)
- **Composable** — environments compose modules, modules don't call other modules
- **No hard-coded secrets** — all sensitive values via variables + references to secrets manager
- **Documented outputs** — every module exposes strict outputs for composition

### 1.3 State Management

**Remote Backend Configuration (S3 + DynamoDB):**

```hcl
# environments/prod/backend.tf
terraform {
  backend "s3" {
    bucket         = "smo-terraform-state"
    key            = "environments/prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "smo-terraform-locks"
  }

  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
```

**State Isolation Rules:**

| Environment | Bucket Key | Locking | Access |
|---|---|---|---|
| Dev | `environments/dev/terraform.tfstate` | DynamoDB | Engineers |
| Staging | `environments/staging/terraform.tfstate` | DynamoDB | CI + Engineers |
| Prod | `environments/prod/terraform.tfstate` | DynamoDB + Approval | CI only |

**State file access is restricted via IAM — no human directly modifies production state.**

### 1.4 Provider Configuration

```hcl
# environments/prod/providers.tf
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }

  assume_role {
    role_arn = "arn:aws:iam::${var.account_id}:role/TerraformExecutionRole"
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}
```

---

## 2. Core Modules

### 2.1 VPC Module

```
modules/vpc/
```

**Purpose:** Isolated network per environment with public/private subnets across 3 AZs.

**Key Resources:**
- VPC with CIDR `10.{env}.0.0/16` (env: 0=prod, 1=staging, 2=dev)
- Public subnets (load balancers, NAT gateways)
- Private subnets (application pods, databases)
- Database subnets (RDS, ElastiCache — no internet route)
- NAT Gateways (one per AZ for high availability)
- VPC Endpoints (S3, DynamoDB, ECR, Secrets Manager)
- Flow Logs (delivered to S3 + CloudWatch Logs)
- Network ACLs (stateless subnet-level rules)

**Variables:**
```hcl
variable "environment"       { type = string }
variable "vpc_cidr"          { type = string }
variable "availability_zones" { type = list(string) }
variable "enable_flow_logs"  { type = bool, default = true }
variable "flow_logs_retention_days" { type = number, default = 90 }
```

**Outputs:**
```hcl
output "vpc_id"             { value = aws_vpc.main.id }
output "private_subnet_ids"  { value = aws_subnet.private[*].id }
output "public_subnet_ids"   { value = aws_subnet.public[*].id }
output "database_subnet_ids" { value = aws_subnet.database[*].id }
output "vpc_cidr_block"     { value = aws_vpc.main.cidr_block }
```

### 2.2 EKS/GKE Module

```
modules/eks/
```

**Purpose:** Managed Kubernetes cluster for NestJS microservices + BullMQ workers.

**Key Resources:**
- EKS cluster (private endpoint, public access disabled)
- Managed node groups (Spot for dev/staging, On-Demand for prod)
- Fargate profiles (for burstable, CI runners)
- OIDC provider for IRSA
- Cluster Autoscaler
- Node Security Groups (restricted ingress)
- EBS CSI driver addon
- CoreDNS, kube-proxy, VPC CNI

**Key Variables:**
```hcl
variable "cluster_name"         { type = string }
variable "kubernetes_version"   { type = string, default = "1.30" }
variable "node_groups" = {
  type = map(object({
    instance_types = list(string)
    min_size      = number
    max_size      = number
    desired_size   = number
    disk_size      = number
    use_spot       = bool
    labels         = map(string)
    taints         = optional(map(object({ key = string, value = string, effect = string })))
  }))
}
variable "enable_cluster_autoscaler" { type = bool, default = true }
variable "cluster_endpoint_private_access" { type = bool, default = true }
variable "cluster_endpoint_public_access"  { type = bool, default = false }
```

### 2.3 RDS Module

```
modules/rds/
```

**Purpose:** PostgreSQL 16 for multi-tenant application data, job queue metadata.

**Key Resources:**
- RDS PostgreSQL instance (db.r6g.xlarge — prod, db.t3.medium — dev)
- Multi-AZ deployment (prod only)
- Read replicas (for analytics queries)
- Automated backups (30-day retention)
- Deletion protection (prod)
- Performance Insights
- Parameter groups (optimized for the application)

**Variables:**
```hcl
variable "instance_class"       { type = string }
variable "allocated_storage"    { type = number }
variable "max_allocated_storage" { type = number, default = 1000 }
variable "multi_az"             { type = bool, default = false }
variable "backup_retention_days" { type = number, default = 30 }
variable "deletion_protection"  { type = bool, default = true }
variable "database_name"        { type = string }
variable "master_username"      { type = string, sensitive = true }
variable "master_password"      { type = string, sensitive = true }
```

### 2.4 Redis / ElastiCache Module

```
modules/redis/
```

**Purpose:** Redis 7 for BullMQ job queues, session caching, rate limiting.

**Resources:**
- ElastiCache Redis (cluster mode disabled for sessions, enabled for caching)
- Auto-failover (prod)
- Encryption at rest + in transit
- Auth token
- CloudWatch metrics + alarms
- Parameter groups (timeouts, maxmemory-policy: allkeys-lru)

**Variables:**
```hcl
variable "node_type"            { type = string, default = "cache.r6g.large" }
variable "num_cache_nodes"      { type = number, default = 2 }
variable "parameter_group_family" { type = string, default = "redis7" }
variable "auth_token"           { type = string, sensitive = true }
variable "snapshot_retention_days" { type = number, default = 7 }
```

### 2.5 S3 / GCS Module

```
modules/storage/
```

**Purpose:** Object storage for media uploads, social platform assets, backups.

**Resources:**
- S3 buckets per purpose: `{env}-media`, `{env}-backups`, `{env}-logs`, `{env}-exports`
- Server-side encryption (AES-256)
- Block public access (all buckets)
- Lifecycle policies (transition to Glacier after 90d, delete after 365d)
- Versioning enabled
- Replication to DR region (prod)
- CORS policies (for frontend uploads)

**Variables:**
```hcl
variable "environment"               { type = string }
variable "bucket_prefix"             { type = string, default = "smo" }
variable "enable_versioning"         { type = bool, default = true }
variable "enable_replication"        { type = bool, default = false }
variable "replication_region"        { type = string, default = "us-west-2" }
variable "lifecycle_transition_days" { type = number, default = 90 }
variable "lifecycle_expiration_days" { type = number, default = 365 }
```

### 2.6 CloudFront / CDN Module

```
modules/cdn/
```

**Purpose:** Global content delivery for the Next.js frontend, static assets, media.

**Resources:**
- CloudFront distributions (one for frontend, one for media API)
- Origin Access Control (OAC) for S3 origins
- Lambda@Edge for security headers
- WAF association
- Custom error responses
- Price class: `PriceClass_100` (US+Europe)
- SSL certificate via ACM (us-east-1)

**Variables:**
```hcl
variable "domain_name"            { type = string }
variable "acm_certificate_arn"    { type = string }
variable "waf_web_acl_arn"        { type = string }
variable "s3_bucket_id"           { type = string }
variable "s3_bucket_regional_domain_name" { type = string }
variable "price_class"            { type = string, default = "PriceClass_100" }
```

### 2.7 IAM Module

```
modules/iam/
```

**Purpose:** Least-privilege IAM roles, policies, and service accounts.

**Resources:**
- EKS node instance role
- IRSA roles per service (api-service, worker-service, migration-service)
- CI/CD deployment role
- Read-only monitoring role
- Backup role
- Cross-account roles

**Variables:**
```hcl
variable "environment"      { type = string }
variable "eks_oidc_provider_arn" { type = string }
variable "eks_oidc_provider_url" { type = string }
variable "service_names"    { type = list(string) }
```

### 2.8 WAF Module

```
modules/waf/
```

**Purpose:** Web application firewall protecting APIs and frontend.

**Resources:**
- WAFv2 Web ACL
- AWS Managed Rules (core rule set, SQLi, XSS, known bad inputs, Amazon IP reputation)
- Rate-based rules (per-IP, per-tenant)
- Bot Control managed rule group
- Custom rules (geo-block, header validation)
- Logging to S3 + CloudWatch

**Variables:**
```hcl
variable "name"                          { type = string }
variable "scope"                         { type = string, default = "CLOUDFRONT" }
variable "rate_limit"                    { type = number, default = 2000 }
variable "blocked_countries"             { type = list(string), default = [] }
variable "enable_bot_control"            { type = bool, default = true }
variable "log_destination_bucket_arn"    { type = string }
```

### 2.9 Route53 / Cloud DNS Module

```
modules/dns/
```

**Purpose:** DNS management, health checks, routing policies.

**Resources:**
- Route53 zone per environment
- A/AAAA records (alias to CloudFront/ALB)
- Health checks (API endpoints)
- SSL/TLS certificates via ACM (request + validation)

**Variables:**
```hcl
variable "domain_name"     { type = string }
variable "environment"      { type = string }
variable "cloudfront_domain_names" { type = map(string) }
variable "alb_dns_names"    { type = map(string) }
variable "enable_health_checks" { type = bool, default = true }
```

---

## 3. Environment Management

### 3.1 Workspace Strategy

```hcl
# environments/dev/terraform.tfvars
environment       = "dev"
aws_region        = "us-east-1"
vpc_cidr          = "10.2.0.0/16"
instance_class    = "db.t3.medium"
redis_node_type   = "cache.t3.medium"
eks_node_groups = {
  services = {
    instance_types = ["t3.medium"]
    min_size      = 2
    max_size      = 6
    desired_size   = 2
    use_spot       = true
    labels = { workload = "services" }
  }
}

# environments/staging/terraform.tfvars
environment       = "staging"
aws_region        = "us-east-1"
vpc_cidr          = "10.1.0.0/16"
instance_class    = "db.r6g.large"
redis_node_type   = "cache.r6g.large"
eks_node_groups = {
  services = {
    instance_types = ["t3.large"]
    min_size      = 2
    max_size      = 8
    desired_size   = 3
    use_spot       = false
    labels = { workload = "services" }
  }
}

# environments/prod/terraform.tfvars
environment       = "prod"
aws_region        = "us-east-1"
vpc_cidr          = "10.0.0.0/16"
instance_class    = "db.r6g.xlarge"
multi_az          = true
redis_node_type   = "cache.r6g.xlarge"
eks_node_groups = {
  services = {
    instance_types = ["m6i.large", "m6i.xlarge"]
    min_size      = 3
    max_size      = 20
    desired_size   = 5
    use_spot       = false
    labels = { workload = "services" }
  }
  workers = {
    instance_types = ["c6i.large", "c6i.xlarge"]
    min_size      = 3
    max_size      = 15
    desired_size   = 3
    use_spot       = true
    labels = { workload = "workers" }
    taints = {
      worker = { key = "workload", value = "worker", effect = "NO_SCHEDULE" }
    }
  }
}
```

### 3.2 Environment Separation

| Dimension | Dev | Staging | Prod |
|---|---|---|---|
| **AWS Account** | Shared sandbox | Dedicated | Dedicated |
| **VPC CIDR** | 10.2.0.0/16 | 10.1.0.0/16 | 10.0.0.0/16 |
| **RDS** | Single-AZ, t3.medium | Single-AZ, r6g.large | Multi-AZ, r6g.xlarge |
| **Redis** | Single-node | Cluster, 2 nodes | Cluster, 3 nodes |
| **EKS Nodes** | Spot, 2-6 | On-Demand, 2-8 | On-Demand + Spot, 3-20 |
| **Backups** | 7 days | 14 days | 30 days |
| **Deletion Protection** | No | Yes | Yes |
| **Data** | Anonymized synthetic | Sanitized copy of prod | Production |

---

## 4. Secrets Management

### 4.1 Architecture

```
Application Code
    │
    ▼
AWS Secrets Manager / HashiCorp Vault
    │
    ├── Terraform (via aws_secretsmanager_secret data source)
    ├── Kubernetes (External Secrets Operator)
    │       └── CSI Driver → Pod volumes
    └── CI/CD (OIDC-based access)
```

### 4.2 Terraform Secrets Resolution

```hcl
# Terraform references secrets — never hard-coded
data "aws_secretsmanager_secret" "db_master" {
  name = "smo/${var.environment}/database/master"
}

data "aws_secretsmanager_secret_version" "db_master" {
  secret_id = data.aws_secretsmanager_secret.db_master.id
}

locals {
  db_creds = jsondecode(data.aws_secretsmanager_secret_version.db_master.secret_string)
}

module "rds" {
  source           = "../../modules/rds"
  master_username  = local.db_creds.username
  master_password  = local.db_creds.password
  # ...
}
```

### 4.3 Rotation Policies

| Secret | Rotation Interval | Rotation Strategy |
|---|---|---|
| RDS Master Password | 90 days | Lambda rotation with `aws:rds:promote` |
| Redis Auth Token | 180 days | Manual rotation with zero-downtime strategy |
| API Signing Keys | 30 days | Dual-key rotation (active + pending) |
| JWT Secrets | 90 days | Key rotation with grace period |
| Social Platform Tokens | Per-platform refresh | On-demand via OAuth refresh flow |
| Encryption Keys (KMS) | Annual | Automatic key rotation via KMS |

### 4.4 Secret Categories

```hcl
# Terraform defines which secrets exist; values are injected via CI or manual
resource "aws_secretsmanager_secret" "this" {
  for_each = local.secrets

  name                    = "smo/${var.environment}/${each.key}"
  description             = each.value.description
  recovery_window_in_days = var.environment == "prod" ? 30 : 7
  kms_key_id              = module.kms.secrets_key_id

  tags = local.tags
}
```

---

## 5. Cost Tagging Strategy

### 5.1 Required Resource Tags

Every Terraform-managed resource MUST include these tags:

```hcl
locals {
  tags = {
    Environment     = var.environment
    Application     = "social-media-os"
    Team            = "platform-engineering"
    CostCenter      = var.environment == "prod" ? "CC-PROD-001" : "CC-NONPROD-001"
    ManagedBy       = "terraform"
    Owner           = "devops@smo.com"
    DataClassification = var.environment == "prod" ? "confidential" : "internal"
    DeployedVia     = "terraform"
    Repository      = "github.com/smo/infrastructure"
    CreatedAt       = timestamp()
  }
}
```

### 5.2 Tag Propagation Strategy

| Resource | Tags Applied | Method |
|---|---|---|
| VPC + subnets | Provider default_tags | Auto |
| EKS cluster | Provider default_tags | Auto |
| S3 buckets | Resource-level | Explicit bucket tagging |
| RDS | Resource-level | Explicit + propagate to snapshots |
| EC2/ASG | Launch template | Provider default_tags |
| Load balancers | Resource-level | Explicit |
| CloudFront distributions | Resource-level | Explicit |
| ECR repositories | Resource-level | Explicit |

### 5.3 Cost Allocation Reports

- **AWS Cost Explorer** — filtered by tags: `Environment`, `Application`, `Team`
- **Monthly budget alerts** — per-environment, per-service
- **Grafana cost dashboard** — linked to CloudWatch billing metrics
- **Anomaly detection** — AWS Cost Anomaly Detection with SNS alerts
- **Resource right-sizing** — monthly review of underutilized resources

### 5.4 Budget Alerts

```hcl
resource "aws_budgets_budget" "monthly" {
  for_each = {
    dev     = 5000
    staging = 10000
    prod    = 50000
  }

  name         = "smo-monthly-${each.key}"
  budget_type  = "COST"
  limit_amount = each.value
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    threshold          = 80
    threshold_type     = "PERCENTAGE"
    notification_type  = "ACTUAL"
    subscriber_email_addresses = ["finance@smo.com", "devops@smo.com"]
  }

  notification {
    comparison_operator = "GREATER_THAN"
    threshold          = 100
    threshold_type     = "PERCENTAGE"
    notification_type  = "FORECASTED"
    subscriber_email_addresses = ["finance@smo.com", "devops@smo.com"]
  }
}
```

---

## 6. Drift Detection

### 6.1 Automated Drift Detection

**CI/CD Integration (GitHub Actions):**

```yaml
# .github/workflows/terraform-drift.yaml
name: Terraform Drift Detection
on:
  schedule:
    - cron: "0 6 * * 1-5"  # Every weekday at 6:00 UTC
  workflow_dispatch:

jobs:
  detect:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, prod]

    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsRole
          aws-region: us-east-1

      - name: Terraform Init
        working-directory: terraform/environments/${{ matrix.environment }}
        run: terraform init

      - name: Terraform Plan (Drift Check)
        id: plan
        working-directory: terraform/environments/${{ matrix.environment }}
        run: terraform plan -detailed-exitcode -out=plan.tfplan
        continue-on-error: true

      - name: Notify Slack on Drift
        if: steps.plan.outputs.exitcode != 0
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "⚠️ Drift detected in *${{ matrix.environment }}* environment. Run: \n```terraform apply terraform/environments/${{ matrix.environment }}/plan.tfplan```\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Run>"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Upload Plan Artifact
        if: steps.plan.outputs.exitcode != 0
        uses: actions/upload-artifact@v4
        with:
          name: tfplan-${{ matrix.environment }}
          path: terraform/environments/${{ matrix.environment }}/plan.tfplan
```

### 6.2 Automated Remediation (Dev/Staging Only)

For non-production environments, drift can be auto-remediated:

```yaml
- name: Auto-Apply (non-prod only)
  if: matrix.environment != 'prod' && steps.plan.outputs.exitcode != 0
  working-directory: terraform/environments/${{ matrix.environment }}
  run: terraform apply -auto-approve plan.tfplan
```

**Production policy:** Drift alert → manual review → approved apply via PR.

### 6.3 Drift Monitoring with Atlantis

For pull-request driven infrastructure changes, use Atlantis:

```yaml
# atlantis.yaml
version: 3
projects:
  - name: dev
    dir: terraform/environments/dev
    workspace: default
    autoplan:
      enabled: true
      when_modified: ["*.tf", "*.tfvars", "../../modules/**/*.tf"]

  - name: staging
    dir: terraform/environments/staging
    workspace: default
    autoplan:
      enabled: true
      when_modified: ["*.tf", "*.tfvars", "../../modules/**/*.tf"]

  - name: prod
    dir: terraform/environments/prod
    workspace: default
    autoplan:
      enabled: false  # Production requires manual `atlantis apply`
```

### 6.4 Compliance Drift Rules

| Check | Tool | Alert | Auto-Remediate |
|---|---|---|---|
| Missing required tags | `terraform plan` + OPA | Slack | Dev/Staging only |
| Public S3 bucket | `terraform plan` + Sentinel | Slack + PagerDuty | No |
| Security group changes | `terraform plan` diff | Slack | No |
| IAM policy changes | `terraform plan` diff | Slack + Jira ticket | No |
| Encryption disabled | `checkov` in CI | PR comment | Block PR |
| KMS key rotation off | `tfsec` in CI | PR comment | Block PR |

---

## 7. Sample Module — Complete EKS/GKE Module

### 7.1 `modules/eks/variables.tf`

```hcl
variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string

  validation {
    condition     = length(var.cluster_name) > 3 && length(var.cluster_name) < 100
    error_message = "Cluster name must be between 3 and 100 characters."
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version for the cluster"
  type        = string
  default     = "1.30"
}

variable "vpc_id" {
  description = "VPC ID for the cluster"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for node groups"
  type        = list(string)
}

variable "node_groups" {
  description = "Managed node group configurations"
  type = map(object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size    = number
    disk_size       = optional(number, 100)
    use_spot        = optional(bool, false)
    labels          = optional(map(string), {})
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
  }))
}

variable "node_security_group_additional_rules" {
  description = "Additional security group rules for worker nodes"
  type = map(object({
    description              = string
    protocol                 = string
    from_port                = number
    to_port                  = number
    type                     = string
    cidr_blocks              = optional(list(string), [])
    source_security_group_id = optional(string, null)
  }))
  default = {}
}

variable "enable_cluster_autoscaler" {
  description = "Enable Cluster Autoscaler addon"
  type        = bool
  default     = true
}

variable "enable_aws_load_balancer_controller" {
  description = "Enable AWS Load Balancer Controller"
  type        = bool
  default     = true
}

variable "enable_metrics_server" {
  description = "Enable Metrics Server for HPA"
  type        = bool
  default     = true
}

variable "cluster_endpoint_private_access" {
  description = "Enable private API server endpoint"
  type        = bool
  default     = true
}

variable "cluster_endpoint_public_access" {
  description = "Enable public API server endpoint"
  type        = bool
  default     = false
}

variable "cluster_log_retention_days" {
  description = "Retention days for cluster control plane logs"
  type        = number
  default     = 90
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

### 7.2 `modules/eks/main.tf`

```hcl
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.32"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.15"
    }
  }
}

locals {
  cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

# ─── IAM Role for EKS Cluster ────────────────────────────────────────────────
resource "aws_iam_role" "cluster" {
  name = "${var.cluster_name}-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

resource "aws_iam_role_policy_attachment" "service_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.cluster.name
}

# ─── Security Group for EKS Cluster ──────────────────────────────────────────
resource "aws_security_group" "cluster" {
  name        = "${var.cluster_name}-sg"
  description = "EKS cluster security group"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-sg"
  })
}

# ─── EKS Cluster ─────────────────────────────────────────────────────────────
resource "aws_eks_cluster" "this" {
  name     = var.cluster_name
  version  = var.kubernetes_version
  role_arn = aws_iam_role.cluster.arn

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = var.cluster_endpoint_private_access
    endpoint_public_access  = var.cluster_endpoint_public_access
    security_group_ids      = [aws_security_group.cluster.id]
  }

  enabled_cluster_log_types = local.cluster_log_types

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  tags = var.tags

  depends_on = [
    aws_iam_role_policy_attachment.cluster_policy,
    aws_iam_role_policy_attachment.service_policy
  ]
}

# ─── KMS Key for Cluster Secrets Encryption ──────────────────────────────────
resource "aws_kms_key" "eks" {
  description             = "EKS Secrets Encryption Key - ${var.cluster_name}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = var.tags
}

resource "aws_kms_alias" "eks" {
  name          = "alias/${var.cluster_name}-secrets"
  target_key_id = aws_kms_key.eks.key_id
}

# ─── CloudWatch Log Group for Cluster Logs ────────────────────────────────────
resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/eks/${var.cluster_name}/cluster"
  retention_in_days = var.cluster_log_retention_days

  tags = var.tags
}

# ─── OIDC Provider for IRSA ──────────────────────────────────────────────────
data "tls_certificate" "cluster" {
  url = aws_eks_cluster.this.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "this" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.cluster.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.this.identity[0].oidc[0].issuer

  tags = var.tags
}

# ─── IAM Role for Node Groups ────────────────────────────────────────────────
resource "aws_iam_role" "node" {
  name = "${var.cluster_name}-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "node_worker" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_ecr" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node.name
}

resource "aws_iam_role_policy_attachment" "node_ssm" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.node.name
}

# ─── Node Security Group ──────────────────────────────────────────────────────
resource "aws_security_group" "node" {
  name        = "${var.cluster_name}-node-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-node-sg"
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
  })
}

resource "aws_security_group_rule" "node_cluster_ingress" {
  description              = "Allow cluster control plane to communicate with nodes"
  type                     = "ingress"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.cluster.id
  security_group_id        = aws_security_group.node.id
}

resource "aws_security_group_rule" "node_cluster_egress" {
  description              = "Allow nodes to communicate with cluster control plane"
  type                     = "egress"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.cluster.id
  security_group_id        = aws_security_group.node.id
}

resource "aws_security_group_rule" "node_self_ingress" {
  description       = "Allow nodes to communicate with each other"
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "-1"
  self              = true
  security_group_id = aws_security_group.node.id
}

resource "aws_security_group_rule" "node_egress_internet" {
  description       = "Allow nodes to reach internet (for pull-through cache, etc)"
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.node.id
}

# ─── Managed Node Groups ──────────────────────────────────────────────────────
resource "aws_eks_node_group" "this" {
  for_each = var.node_groups

  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-${each.key}"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids
  version         = var.kubernetes_version

  instance_types = each.value.instance_types
  disk_size      = each.value.disk_size

  scaling_config {
    desired_size = each.value.desired_size
    min_size     = each.value.min_size
    max_size     = each.value.max_size
  }

  capacity_type = each.value.use_spot ? "SPOT" : "ON_DEMAND"

  labels = merge(each.value.labels, {
    "nodegroup" = each.key
    "env"       = var.environment
  })

  dynamic "taint" {
    for_each = each.value.taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }

  launch_template {
    name    = aws_launch_template.node[each.key].name
    version = aws_launch_template.node[each.key].latest_version
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes = [
      scaling_config[0].desired_size  # Cluster Autoscaler manages this
    ]
  }

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-${each.key}"
    "k8s.io/cluster-autoscaler/${var.cluster_name}" = "owned"
    "k8s.io/cluster-autoscaler/enabled"             = "TRUE"
  })

  depends_on = [
    aws_iam_role_policy_attachment.node_worker,
    aws_iam_role_policy_attachment.node_cni,
    aws_iam_role_policy_attachment.node_ecr
  ]
}

resource "aws_launch_template" "node" {
  for_each = var.node_groups

  name          = "${var.cluster_name}-${each.key}-template"
  instance_type = each.value.instance_types[0]

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = each.value.disk_size
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  monitoring {
    enabled = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, {
      Name = "${var.cluster_name}-${each.key}"
    })
  }

  tag_specifications {
    resource_type = "volume"
    tags = merge(var.tags, {
      Name = "${var.cluster_name}-${each.key}"
    })
  }
}

# ─── Addons ──────────────────────────────────────────────────────────────────
resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "vpc-cni"
  addon_version               = "v1.18.3-eksbuild.2"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  tags = var.tags
}

resource "aws_eks_addon" "coredns" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "coredns"
  addon_version               = "v1.11.1-eksbuild.4"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  tags = var.tags
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "kube-proxy"
  addon_version               = "v1.30.3-eksbuild.5"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  tags = var.tags
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "aws-ebs-csi-driver"
  addon_version               = "v1.35.0-eksbuild.1"
  service_account_role_arn    = aws_iam_role.ebs_csi.arn
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  tags = var.tags
}

# ─── EBS CSI IAM Role (IRSA) ─────────────────────────────────────────────────
resource "aws_iam_role" "ebs_csi" {
  name = "${var.cluster_name}-ebs-csi-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.this.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${aws_iam_openid_connect_provider.this.url}:sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
            "${aws_iam_openid_connect_provider.this.url}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ebs_csi" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
  role       = aws_iam_role.ebs_csi.name
}

# ─── Cluster Autoscaler ──────────────────────────────────────────────────────
resource "helm_release" "cluster_autoscaler" {
  count = var.enable_cluster_autoscaler ? 1 : 0

  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  namespace  = "kube-system"
  version    = "9.37.0"

  set {
    name  = "autoDiscovery.clusterName"
    value = var.cluster_name
  }

  set {
    name  = "awsRegion"
    value = data.aws_region.current.name
  }

  set {
    name  = "rbac.serviceAccount.create"
    value = "true"
  }

  set {
    name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.cluster_autoscaler[0].arn
  }

  set {
    name  = "priorityExpander"
    value = "true"
  }

  depends_on = [aws_eks_cluster.this]
}

resource "aws_iam_role" "cluster_autoscaler" {
  count = var.enable_cluster_autoscaler ? 1 : 0

  name = "${var.cluster_name}-cluster-autoscaler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.this.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${aws_iam_openid_connect_provider.this.url}:sub" = "system:serviceaccount:kube-system:cluster-autoscaler"
            "${aws_iam_openid_connect_provider.this.url}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "cluster_autoscaler" {
  count = var.enable_cluster_autoscaler ? 1 : 0

  name = "${var.cluster_name}-cluster-autoscaler-policy"
  role = aws_iam_role.cluster_autoscaler[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeTags",
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup",
          "ec2:DescribeLaunchTemplateVersions",
          "ec2:DescribeInstanceTypes"
        ]
        Resource = "*"
      }
    ]
  })
}

# ─── AWS Load Balancer Controller ────────────────────────────────────────────
resource "helm_release" "aws_lb_controller" {
  count = var.enable_aws_load_balancer_controller ? 1 : 0

  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = "1.8.1"

  set {
    name  = "clusterName"
    value = var.cluster_name
  }

  set {
    name  = "region"
    value = data.aws_region.current.name
  }

  set {
    name  = "vpcId"
    value = var.vpc_id
  }

  set {
    name  = "rbac.serviceAccount.create"
    value = "true"
  }

  set {
    name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.aws_lb_controller[0].arn
  }

  depends_on = [aws_eks_cluster.this]
}

resource "aws_iam_role" "aws_lb_controller" {
  count = var.enable_aws_load_balancer_controller ? 1 : 0

  name = "${var.cluster_name}-aws-lb-controller-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.this.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${aws_iam_openid_connect_provider.this.url}:sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
            "${aws_iam_openid_connect_provider.this.url}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "aws_lb_controller" {
  count = var.enable_aws_load_balancer_controller ? 1 : 0

  name = "${var.cluster_name}-aws-lb-controller-policy"
  role = aws_iam_role.aws_lb_controller[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeInstances",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeAccountAttributes",
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeTags",
          "elasticloadbalancing:CreateLoadBalancer",
          "elasticloadbalancing:CreateListener",
          "elasticloadbalancing:CreateRule",
          "elasticloadbalancing:CreateTargetGroup",
          "elasticloadbalancing:DeleteLoadBalancer",
          "elasticloadbalancing:DeleteListener",
          "elasticloadbalancing:DeleteRule",
          "elasticloadbalancing:DeleteTargetGroup",
          "elasticloadbalancing:ModifyLoadBalancerAttributes",
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:ModifyRule",
          "elasticloadbalancing:ModifyTargetGroup",
          "elasticloadbalancing:ModifyTargetGroupAttributes",
          "elasticloadbalancing:RegisterTargets",
          "elasticloadbalancing:DeregisterTargets",
          "elasticloadbalancing:SetSecurityGroups",
          "elasticloadbalancing:SetSubnets",
          "elasticloadbalancing:AddTags",
          "elasticloadbalancing:RemoveTags",
          "wafv2:GetWebACL",
          "wafv2:GetWebACLForResource",
          "wafv2:AssociateWebACL",
          "wafv2:DisassociateWebACL",
          "iam:CreateServiceLinkedRole",
          "cognito-idp:DescribeUserPoolClient",
          "cognito-idp:DescribeUserPool",
          "cognito-idp:ListUserPoolClients"
        ]
        Resource = "*"
      }
    ]
  })
}

# ─── Metrics Server ──────────────────────────────────────────────────────────
resource "helm_release" "metrics_server" {
  count = var.enable_metrics_server ? 1 : 0

  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server"
  chart      = "metrics-server"
  namespace  = "kube-system"
  version    = "3.12.1"

  set {
    name  = "args[0]"
    value = "--kubelet-insecure-tls=false"
  }

  depends_on = [aws_eks_cluster.this]
}

# ─── Data Sources ────────────────────────────────────────────────────────────
data "aws_region" "current" {}

data "aws_caller_identity" "current" {}
```

### 7.3 `modules/eks/outputs.tf`

```hcl
output "cluster_id" {
  description = "EKS cluster ID"
  value       = aws_eks_cluster.this.id
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_ca_certificate" {
  description = "EKS cluster CA certificate (base64)"
  value       = aws_eks_cluster.this.certificate_authority[0].data
  sensitive   = true
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.this.arn
}

output "cluster_version" {
  description = "EKS cluster Kubernetes version"
  value       = aws_eks_cluster.this.version
}

output "cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = aws_security_group.cluster.id
}

output "node_security_group_id" {
  description = "EKS worker node security group ID"
  value       = aws_security_group.node.id
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN for IRSA"
  value       = aws_iam_openid_connect_provider.this.arn
}

output "oidc_provider_url" {
  description = "OIDC provider URL for IRSA"
  value       = aws_eks_cluster.this.identity[0].oidc[0].issuer
}

output "cluster_autoscaler_role_arn" {
  description = "IAM role ARN for Cluster Autoscaler (IRSA)"
  value       = var.enable_cluster_autoscaler ? aws_iam_role.cluster_autoscaler[0].arn : null
}

output "aws_lb_controller_role_arn" {
  description = "IAM role ARN for AWS Load Balancer Controller (IRSA)"
  value       = var.enable_aws_load_balancer_controller ? aws_iam_role.aws_lb_controller[0].arn : null
}

output "node_instance_role_arn" {
  description = "IAM role ARN for worker node instances"
  value       = aws_iam_role.node.arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for cluster logs"
  value       = aws_cloudwatch_log_group.this.name
}

output "kms_key_arn" {
  description = "KMS key ARN for cluster secrets encryption"
  value       = aws_kms_key.eks.arn
}

output "node_group_names" {
  description = "Map of node group names"
  value       = { for k, v in aws_eks_node_group.this : k => v.node_group_name }
}
```

---

## 8. Operational Runbooks

### 8.1 Applying Infrastructure Changes

```bash
# Dev — direct apply
cd terraform/environments/dev
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan

# Staging — via CI pull request
# 1. Create PR with Terraform changes
# 2. Atlantis comments with `terraform plan`
# 3. Approve and merge → CI runs `terraform apply`

# Production — via CI with approval
# 1. Create PR with changes
# 2. Atlantis plans, requires approval
# 3. Merge to main → CI runs `terraform apply` (manual approval gate)
```

### 8.2 Emergency Rollback

```bash
# Rollback to previous state version
cd terraform/environments/prod
terraform init
terraform state pull > /tmp/corrupted.tfstate
# If state is corrupted, restore from DynamoDB point-in-time recovery
# Otherwise:
terraform plan -replace="module.eks.aws_eks_cluster.this"
terraform apply -replace="module.eks.aws_eks_cluster.this"
```

### 8.3 Module Testing

```bash
# Using terratest for module validation
cd terraform/modules/eks
go test -v -timeout 30m ./test/
```

**Test coverage per module:**
- `terraform validate` & `tflint` — in CI for every PR
- `checkov` — security scanning
- `infracost` — cost estimation comment on PR
- Terratest — integration tests (weekly, not per-PR)
