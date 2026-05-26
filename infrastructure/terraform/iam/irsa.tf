# NEXUS — AWS IAM Roles for Service Accounts (IRSA)
#
# Eliminates static AWS credentials entirely.
# Pods assume IAM roles via OIDC federation — no access keys stored anywhere.
#
# Apply: cd infrastructure/terraform/iam && terraform apply

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "nexus-terraform-state"
    key    = "iam/terraform.tfstate"
    region = "us-east-1"
  }
}

variable "cluster_name"     { default = "nexus-prod" }
variable "aws_region"       { default = "us-east-1" }
variable "account_id"       { description = "AWS account ID" }
variable "ecr_registry_arn" { description = "ECR registry ARN" }

# Fetch the EKS OIDC provider
data "aws_eks_cluster" "nexus" {
  name = var.cluster_name
}

data "aws_iam_openid_connect_provider" "eks" {
  url = data.aws_eks_cluster.nexus.identity[0].oidc[0].issuer
}

# ── Backend role — reads from Secrets Manager + ECR ──────────────────────
resource "aws_iam_role" "nexus_v30_backend" {
  name = "nexus-v30-backend-${var.cluster_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.eks.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(data.aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" =
            "system:serviceaccount:nexus:nexus-v30-backend"
          "${replace(data.aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" =
            "sts.amazonaws.com"
        }
      }
    }]
  })
}

# Allow backend to read secrets from Secrets Manager
resource "aws_iam_role_policy" "nexus_v30_backend_secrets" {
  name = "nexus-v30-backend-secrets"
  role = aws_iam_role.nexus_v30_backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.account_id}:secret:nexus/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
        Resource = "*"
      }
    ]
  })
}

# ── CI/CD role — push images to ECR + update EKS ─────────────────────────
resource "aws_iam_role" "nexus_cicd" {
  name = "nexus-cicd-github-actions"

  # GitHub Actions OIDC federation — no static keys
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = "arn:aws:iam::${var.account_id}:oidc-provider/token.actions.githubusercontent.com"
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:your-org/nexus:*"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "nexus_cicd_ecr" {
  name = "nexus-cicd-ecr-eks"
  role = aws_iam_role.nexus_cicd.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = var.ecr_registry_arn
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["eks:DescribeCluster"]
        Resource = "arn:aws:eks:${var.aws_region}:${var.account_id}:cluster/${var.cluster_name}"
      }
    ]
  })
}

output "backend_role_arn" {
  value       = aws_iam_role.nexus_v30_backend.arn
  description = "Annotate nexus-v30-backend ServiceAccount with this ARN"
}

output "cicd_role_arn" {
  value       = aws_iam_role.nexus_cicd.arn
  description = "Set as AWS_ROLE_ARN in GitHub Actions secrets"
}
