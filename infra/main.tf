terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.18"
    }
  }
}

# Token from the environment: TF_VAR_cloudflare_api_token
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "hostname" {
  type        = string
  description = "Custom domain for the dashboard, e.g. jobs.example.com (zone must be on this account)"
}

variable "allowed_emails" {
  type        = list(string)
  description = "Emails allowed to sign in (Access one-time PIN)"
}

variable "access_team_domain" {
  type        = string
  description = "Zero Trust team domain, e.g. myteam.cloudflareaccess.com"
}

variable "database_name" {
  type    = string
  default = "job-hopping"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Only the listed emails can reach the hostname (enforced at Cloudflare's edge).
resource "cloudflare_zero_trust_access_application" "dashboard" {
  account_id       = var.account_id
  name             = "Job Hopping Dashboard"
  domain           = var.hostname
  type             = "self_hosted"
  session_duration = "168h"

  policies = [{
    decision = "allow"
    name     = "Owner only"
    include  = [for e in var.allowed_emails : { email = { email = e } }]
  }]
}

resource "cloudflare_d1_database" "db" {
  account_id = var.account_id
  name       = var.database_name
  read_replication = {
    mode = "disabled"
  }
}

output "account_id" {
  value = var.account_id
}
output "hostname" {
  value = var.hostname
}
output "access_aud" {
  value = cloudflare_zero_trust_access_application.dashboard.aud
}
output "access_team_domain" {
  value = var.access_team_domain
}
output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}
