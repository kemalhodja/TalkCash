#!/usr/bin/env bash
# TalkCash staging deploy helper — run from repo root
set -euo pipefail

APP="${FLY_APP:-talkcash-api}"

echo "==> Deploying TalkCash API to Fly.io ($APP)"

if ! command -v flyctl >/dev/null 2>&1; then
  echo "Install flyctl: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

cd "$(dirname "$0")/../backend"

echo "==> Checking required secrets..."
for key in SECRET_KEY DATABASE_URL REDIS_URL; do
  if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "$key"; then
    echo "WARNING: $key not set. Run: fly secrets set $key=... -a $APP"
  fi
done

if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "S3_ENABLED"; then
  echo "WARNING: S3 not configured. Receipt images will not persist on Fly."
  echo "  fly secrets set S3_ENABLED=true S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=talkcash S3_REGION=auto -a $APP"
fi

echo "==> Deploying..."
flyctl deploy --remote-only -a "$APP"

echo "==> Smoke test..."
API_URL="https://${APP}.fly.dev" python3 "$(dirname "$0")/smoke_test.py"

echo "Done. Set mobile EXPO_PUBLIC_API_URL=https://${APP}.fly.dev/api/v1"
echo "See docs/SMOKE_TEST.md for device checklist"
