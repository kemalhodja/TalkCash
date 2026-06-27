#!/usr/bin/env bash
# Phase 1 launch blockers — static validation (no cloud credentials needed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

fail() { echo "FAIL  $1"; FAIL=1; }
ok() { echo "OK    $1"; }

echo "==> TalkCash Phase 1 validation"

# render.yaml production flags
RENDER="$ROOT/render.yaml"
if [ ! -f "$RENDER" ]; then
  fail "render.yaml missing"
else
  grep -q 'BILLING_PREMIUM_UNLOCKED' "$RENDER" && grep -A1 'BILLING_PREMIUM_UNLOCKED' "$RENDER" | grep -q 'value: "false"' \
    && ok "render.yaml BILLING_PREMIUM_UNLOCKED=false" \
    || fail "render.yaml must set BILLING_PREMIUM_UNLOCKED=false"
  grep -q 'GOOGLE_PLAY_VERIFY_MOCK' "$RENDER" && grep -A1 'GOOGLE_PLAY_VERIFY_MOCK' "$RENDER" | grep -q 'value: "false"' \
    && ok "render.yaml GOOGLE_PLAY_VERIFY_MOCK=false" \
    || fail "render.yaml must set GOOGLE_PLAY_VERIFY_MOCK=false"
  grep -q 'S3_ENABLED' "$RENDER" && grep -A1 'S3_ENABLED' "$RENDER" | grep -q 'value: "true"' \
    && ok "render.yaml S3_ENABLED=true" \
    || fail "render.yaml must set S3_ENABLED=true"
  grep -q 'PASSWORD_RESET_URL' "$RENDER" && grep -A1 'PASSWORD_RESET_URL' "$RENDER" | grep -q 'reset-password' \
    && ok "render.yaml PASSWORD_RESET_URL deep link" \
    || fail "render.yaml PASSWORD_RESET_URL must use talkcash://reset-password"
  grep -q 'plan: starter' "$RENDER" \
    && ok "render.yaml starter plan (no cold sleep on free tier)" \
    || fail "render.yaml should use starter plan for API/db/redis"
fi

# Android deep link intent
APP_JSON="$ROOT/mobile/app.json"
if grep -q '"host": "reset-password"' "$APP_JSON"; then
  ok "app.json reset-password intent filter"
else
  fail "app.json missing reset-password intent filter"
fi

# Mobile Sentry wiring (DSN injected at build time)
if grep -q 'sentryDsn' "$ROOT/mobile/app.config.js"; then
  ok "app.config.js sentryDsn extra"
else
  fail "app.config.js must expose sentryDsn in extra"
fi
if grep -q '@sentry/react-native/expo' "$ROOT/mobile/app.json"; then
  ok "app.json Sentry plugin registered"
else
  fail "app.json missing @sentry/react-native/expo plugin"
fi

# Maestro flows
bash "$ROOT/scripts/validate-maestro-flows.sh"

# Deep link unit test exists
if grep -q 'reset-password' "$ROOT/mobile/__tests__/firstReleaseFeatures.test.ts"; then
  ok "reset-password deep link test"
else
  fail "missing reset-password deep link test"
fi

# Production startup hardening
if grep -q 'google_play_verify_mock' "$ROOT/backend/app/startup.py"; then
  ok "startup.py billing production checks"
else
  fail "startup.py missing billing production checks"
fi

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "Phase 1 validation FAILED"
  exit 1
fi
echo "Phase 1 validation PASSED"
exit 0
