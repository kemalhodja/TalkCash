#!/usr/bin/env bash
# TalkCash staging deploy helper — run from repo root
set -euo pipefail

APP="${FLY_APP:-talkcash-api}"
SCRIPT_DIR="$(dirname "$0")"

echo "==> Preflight checks..."
bash "$SCRIPT_DIR/preflight-staging.sh"

echo "==> Deploying TalkCash API to Fly.io ($APP)"

cd "$SCRIPT_DIR/../backend"

echo "==> Checking optional secrets..."
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
API_URL="https://${APP}.fly.dev" python3 "$SCRIPT_DIR/smoke_test.py"

echo "Done. Set mobile EXPO_PUBLIC_API_URL=https://${APP}.fly.dev/api/v1"
echo "See docs/SMOKE_TEST.md and docs/PRODUCTION.md"
