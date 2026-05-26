# Nexus V30 — Terraform Root Module
# Provisions: EKS cluster, RDS (PostgreSQL), ElastiCache (Redis), networking

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws        = { source = "hashicorp/aws",        version = "~> 5.0"  }
    kubernetes = { source = "hashicorp/kubernetes",  version = "~> 2.25" }
    helm       = { source = "hashicorp/helm",        version = "~> 2.12" }
  }
  backend "s3" {
    bucket = "nexus-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

variable "region"       { default = "us-east-1" }
variable "environment"  { default = "production" }
variable "cluster_name" { default = "nexus-prod" }
variable "db_password"  { sensitive = true }

provider "aws" { region = var.region }

module "networking" {
  source      = "./networking"
  environment = var.environment
}

module "compute" {
  source      = "./compute"
  environment = var.environment
  cluster_name= var.cluster_name
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids
}

module "databases" {
  source      = "./databases"
  environment = var.environment
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids
  db_password = var.db_password
}

output "cluster_endpoint"   { value = module.compute.cluster_endpoint }
output "db_endpoint"        { value = module.databases.postgres_endpoint }
output "redis_endpoint"     { value = module.databases.redis_endpoint }
