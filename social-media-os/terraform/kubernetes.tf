# ── EKS Cluster ──────────────────────────────────────────
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.20"

  cluster_name    = "${local.name_prefix}-cluster"
  cluster_version = var.eks_cluster_version

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    eks-pod-identity-agent = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
      well_known_policies = {
        ebs_csi = true
      }
    }
  }

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  manage_aws_auth_configmap = true
  aws_auth_roles = [
    {
      rolearn  = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/Admin"
      username = "admin"
      groups   = ["system:masters"]
    },
  ]

  eks_managed_node_groups = {
    main = {
      name = "${local.name_prefix}-main-ng"

      instance_types = var.eks_node_instance_types
      capacity_type  = "ON_DEMAND"

      min_size     = var.eks_min_capacity
      max_size     = var.eks_max_capacity
      desired_size = var.eks_desired_capacity

      subnet_ids = module.vpc.private_subnets

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 100
            volume_type           = "gp3"
            iops                  = 3000
            throughput            = 125
            encrypted             = var.enable_encryption
            delete_on_termination = true
          }
        }
      }

      labels = {
        role = "application"
      }

      tags = merge(local.common_tags, var.tags)
    }

    spot = {
      name = "${local.name_prefix}-spot-ng"

      instance_types       = ["t3.medium", "t3.large", "m6i.large"]
      capacity_type        = "SPOT"
      use_custom_launch_template = false

      min_size     = 0
      max_size     = 10
      desired_size = 2

      subnet_ids = module.vpc.private_subnets

      labels = {
        role = "spot-worker"
      }

      taints = {
        spot = {
          key    = "spot"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      }

      tags = merge(local.common_tags, var.tags)
    }
  }

  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
    egress_all = {
      description      = "Node all egress"
      protocol         = "-1"
      from_port        = 0
      to_port          = 0
      type             = "egress"
      cidr_blocks      = ["0.0.0.0/0"]
      ipv6_cidr_blocks = ["::/0"]
    }
  }

  tags = merge(local.common_tags, var.tags)
}

data "aws_caller_identity" "current" {}

# ── ECR Repositories ─────────────────────────────────────
module "ecr_api" {
  source  = "terraform-aws-modules/ecr/aws"
  version = "~> 2.3"

  repository_name = "${local.name_prefix}/api"
  repository_type = "private"

  repository_image_tag_mutability = "IMMUTABLE"
  repository_image_scan_on_push   = true
  repository_encryption_type      = var.enable_encryption ? "KMS" : "AES256"

  repository_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })

  tags = merge(local.common_tags, var.tags)
}

module "ecr_web" {
  source  = "terraform-aws-modules/ecr/aws"
  version = "~> 2.3"

  repository_name = "${local.name_prefix}/web"
  repository_type = "private"

  repository_image_tag_mutability = "IMMUTABLE"
  repository_image_scan_on_push   = true
  repository_encryption_type      = var.enable_encryption ? "KMS" : "AES256"

  repository_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })

  tags = merge(local.common_tags, var.tags)
}

# ── IAM for Service Accounts ─────────────────────────────
module "iam_assumable_role_external_dns" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"
  version = "~> 5.44"

  create_role = true

  role_name = "${local.name_prefix}-external-dns"

  provider_url = module.eks.oidc_provider_url
  role_policy_arns = [
    aws_iam_policy.external_dns.arn
  ]

  oidc_fully_qualified_subjects = ["system:serviceaccount:kube-system:external-dns"]

  tags = merge(local.common_tags, var.tags)
}

resource "aws_iam_policy" "external_dns" {
  name        = "${local.name_prefix}-external-dns"
  description = "Policy for External DNS to manage Route53 records"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets"
        ]
        Resource = ["arn:aws:route53:::hostedzone/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "route53:ListHostedZones",
          "route53:ListResourceRecordSets",
          "route53:ListTagsForResource"
        ]
        Resource = ["*"]
      }
    ]
  })

  tags = merge(local.common_tags, var.tags)
}

module "iam_assumable_role_cert_manager" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"
  version = "~> 5.44"

  create_role = true

  role_name = "${local.name_prefix}-cert-manager"

  provider_url = module.eks.oidc_provider_url
  role_policy_arns = [
    aws_iam_policy.cert_manager.arn
  ]

  oidc_fully_qualified_subjects = ["system:serviceaccount:cert-manager:cert-manager"]

  tags = merge(local.common_tags, var.tags)
}

resource "aws_iam_policy" "cert_manager" {
  name        = "${local.name_prefix}-cert-manager"
  description = "Policy for cert-manager to manage Route53 DNS challenges"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["route53:GetChange"]
        Resource = ["arn:aws:route53:::change/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets"
        ]
        Resource = ["arn:aws:route53:::hostedzone/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "route53:ListHostedZonesByName"
        ]
        Resource = ["*"]
      }
    ]
  })

  tags = merge(local.common_tags, var.tags)
}

# ── KMS Key ──────────────────────────────────────────────
module "kms" {
  source  = "terraform-aws-modules/kms/aws"
  version = "~> 3.1"

  description = "KMS key for Social Media OS encryption"
  key_usage   = "ENCRYPT_DECRYPT"

  deletion_window_in_days = 30
  enable_key_rotation     = true

  aliases = ["${local.name_prefix}/app-key"]

  grant_principals = [
    module.eks.cluster_iam_role_arn,
  ]

  tags = merge(local.common_tags, var.tags)
}
