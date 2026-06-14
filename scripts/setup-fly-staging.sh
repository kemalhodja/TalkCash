#!/usr/bin/env bash
# First-time Fly.io staging setup for TalkCash API
set -euo pipefail

APP="${FLY_APP:-talkcash-api}"
DB="${FLY_DB:-talkcash-db}"
REGION="${FLY_REGION:-fra}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

install_flyctl() {
  if command -v flyctl >/dev/null 2>&1; then
    return 0
  fi
  if [ -x "${HOME}/.fly/bin/flyctl" ]; then
    export PATH="${HOME}/.fly/bin:${PATH}"
    return 0
  fi
  echo "==> Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
  export PATH="${HOME}/.fly/bin:${PATH}"
  if ! command -v flyctl >/dev/null 2>&1; then
    echo "Install failed. Add ~/.fly/bin to PATH and retry."
    exit 1
  fi
}

install_flyctl
export PATH="${HOME}/.fly/bin:${PATH}"

echo "==> TalkCash Fly.io staging setup"
echo "    App: $APP  DB: $DB  Region: $REGION"
echo

if ! flyctl auth whoami >/dev/null 2>&1; then
  if [ -z "${FLY_API_TOKEN:-}" ]; then
    echo "Log in to Fly.io (browser opens):"
    flyctl auth login
  else
    echo "Using FLY_API_TOKEN from environment"
  fi
fi

if ! flyctl apps list 2>/dev/null | grep -q "$APP"; then
  echo "==> Creating app $APP..."
  flyctl apps create "$APP" --org personal 2>/dev/null || flyctl apps create "$APP"
fi

if ! flyctl postgres list 2>/dev/null | grep -q "$DB"; then
  echo "==> Creating PostgreSQL cluster $DB..."
  flyctl postgres create --name "$DB" --region "$REGION" --initial-cluster-size 1
fi

if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "DATABASE_URL"; then
  echo "==> Attaching database to $APP..."
  flyctl postgres attach "$DB" -a "$APP" || true
fi

if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "SECRET_KEY"; then
  echo "==> Setting SECRET_KEY..."
  flyctl secrets set "SECRET_KEY=$(openssl rand -hex 32)" -a "$APP"
fi

echo
echo "==> Manual steps (required before production use):"
echo "  1. Redis: fly secrets set REDIS_URL='redis://...' -a $APP"
echo "  2. OpenAI: fly secrets set OPENAI_API_KEY='sk-...' -a $APP"
echo "  3. R2/S3: fly secrets set S3_ENABLED=true S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=talkcash S3_REGION=auto -a $APP"
echo "  4. CORS: fly secrets set ALLOWED_ORIGINS='*' -a $APP"
echo "  5. GitHub secret: FLY_API_TOKEN (fly tokens create deploy)"
echo "  6. GitHub variable: EXPO_PUBLIC_API_URL=https://${APP}.fly.dev/api/v1"
echo
echo "==> Deploy when ready:"
echo "  ./scripts/deploy-staging.sh"
echo
echo "See docs/DEPLOY.md and docs/PRODUCTION.md for full checklist."
