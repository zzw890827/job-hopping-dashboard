#!/usr/bin/env bash
# Provision (Terraform: Access app + D1), build, migrate and deploy.
#   ./scripts/deploy.sh
# Token: $CLOUDFLARE_API_TOKEN, or macOS Keychain item $CF_KEYCHAIN_SERVICE
# (default "cloudflare-job-hopping"). Needed permissions:
#   Account: Access: Apps and Policies Edit, Workers Scripts Edit, D1 Edit
#   Zone:    Zone Read, Workers Routes Edit, DNS Edit
set -euo pipefail
cd "$(dirname "$0")/.."

token="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$token" ] && command -v security >/dev/null; then
  token=$(security find-generic-password -a "$USER" -s "${CF_KEYCHAIN_SERVICE:-cloudflare-job-hopping}" -w 2>/dev/null || true)
fi
[ -n "$token" ] || { echo "No Cloudflare API token (env CLOUDFLARE_API_TOKEN or Keychain)" >&2; exit 1; }
export CLOUDFLARE_API_TOKEN="$token" TF_VAR_cloudflare_api_token="$token"
[ -f infra/terraform.tfvars ] || { echo "Create infra/terraform.tfvars (see infra/terraform.tfvars.example)" >&2; exit 1; }

echo "==> 1/5 Terraform (Access first, so the hostname is never public)"
terraform -chdir=infra init -input=false >/dev/null
terraform -chdir=infra apply -input=false -auto-approve
out() { terraform -chdir=infra output -raw "$1"; }

echo "==> 2/5 Generate wrangler.jsonc"
sed -e "s|<CLOUDFLARE_ACCOUNT_ID>|$(out account_id)|" \
    -e "s|<HOSTNAME>|$(out hostname)|" \
    -e "s|<D1_DATABASE_ID>|$(out d1_database_id)|" \
    -e "s|<TEAM>.cloudflareaccess.com|$(out access_team_domain)|" \
    -e "s|<ACCESS_AUD>|$(out access_aud)|" \
    wrangler.example.jsonc > wrangler.jsonc
host=$(out hostname)

echo "==> 3/5 Build"
npm run build

echo "==> 4/5 D1 migrations"
npx wrangler d1 migrations apply DB --remote

echo "==> 5/5 Deploy"
npx wrangler deploy

echo "==> Verify: unauthenticated request must be redirected to Access"
ip=$(dig +short "$host" @1.1.1.1 | head -1)
loc=$(curl -sI --max-time 15 ${ip:+--resolve "$host:443:$ip"} "https://$host/api/settings" | tr -d '\r' | grep -i '^location:' || true)
case "$loc" in
  *cloudflareaccess.com*) echo "OK: https://$host is protected by Cloudflare Access" ;;
  *) echo "WARNING: https://$host did not redirect to Access ($loc) — check before use!" >&2; exit 2 ;;
esac
