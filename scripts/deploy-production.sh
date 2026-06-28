#!/usr/bin/env bash
# TalkCash production deploy helper — run from repo root
# NOTE: Mobile prod builds use Render (see docs/DEPLOY_TARGET.md).
# This script deploys to Fly.io legacy app talkcash-api-prod.
set -euo pipefail

APP="${FLY_APP:-talkcash-api-prod}"
SCRIPT_DIR="$(dirname "$0")"

echo "==> Preflight checks..."
bash "$SCRIPT_DIR/preflight-production.sh"

echo "==> Deploying TalkCash API to Fly.io PRODUCTION ($APP)"

cd "$SCRIPT_DIR/../backend"

echo "==> Deploying with fly.prod.toml..."
flyctl deploy --remote-only -a "$APP" --config fly.prod.toml

echo "==> Smoke test..."
API_URL="https://${APP}.fly.dev" python3 "$SCRIPT_DIR/smoke_test.py"

echo "Done. Production API: https://${APP}.fly.dev/api/v1"
echo "EAS production profile: EXPO_PUBLIC_APP_ENV=production"
