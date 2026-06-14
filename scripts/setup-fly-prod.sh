#!/usr/bin/env bash
# First-time Fly.io production setup for TalkCash API
set -euo pipefail

APP="${FLY_APP:-talkcash-api-prod}"
DB="${FLY_DB:-talkcash-db-prod}"
REGION="${FLY_REGION:-fra}"

install_flyctl() {
  if command -v flyctl >/dev/null 2>&1; then
    return 0
  fi
  echo "==> Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
  export PATH="${HOME}/.fly/bin:${PATH}"
}

install_flyctl
export PATH="${HOME}/.fly/bin:${PATH}"

echo "==> TalkCash Fly.io PRODUCTION setup"
echo "    App: $APP  DB: $DB  Region: $REGION"
echo

if ! flyctl auth whoami >/dev/null 2>&1; then
  flyctl auth login
fi

if ! flyctl apps list 2>/dev/null | grep -q "$APP"; then
  echo "==> Creating production app $APP..."
  flyctl apps create "$APP" --org personal 2>/dev/null || flyctl apps create "$APP"
fi

if ! flyctl postgres list 2>/dev/null | grep -q "$DB"; then
  echo "==> Creating production PostgreSQL cluster $DB..."
  flyctl postgres create --name "$DB" --region "$REGION" --initial-cluster-size 1
fi

if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "DATABASE_URL"; then
  echo "==> Attaching database to $APP..."
  flyctl postgres attach "$DB" -a "$APP" || true
fi

if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "SECRET_KEY"; then
  flyctl secrets set "SECRET_KEY=$(openssl rand -hex 32)" -a "$APP"
fi

echo
echo "==> Required production secrets:"
echo "  fly secrets set REDIS_URL='redis://...' -a $APP"
echo "  fly secrets set OPENAI_API_KEY='sk-...' -a $APP"
echo "  fly secrets set S3_ENABLED=true S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=talkcash-prod S3_REGION=auto -a $APP"
echo "  fly secrets set ALLOWED_ORIGINS='https://your-domain.com' -a $APP"
echo
echo "==> Deploy when ready:"
echo "  ./scripts/deploy-production.sh"
echo
echo "Mobile production build uses EXPO_PUBLIC_API_URL=https://${APP}.fly.dev/api/v1 (see mobile/eas.json)"
