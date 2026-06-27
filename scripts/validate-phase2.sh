#!/usr/bin/env bash
# Phase 2 — trust, account, analytics funnel, ErrorState coverage.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
fail() { echo "FAIL  $1"; FAIL=1; }
ok() { echo "OK    $1"; }

echo "==> TalkCash Phase 2 validation"

for f in \
  mobile/app/account.tsx \
  mobile/components/FunnelProgressCard.tsx \
  mobile/services/analytics.ts \
  mobile/__tests__/analytics.test.ts \
  backend/tests/e2e/test_billing_security.py; do
  if [ -f "$ROOT/$f" ]; then ok "$f"; else fail "missing $f"; fi
done

grep -q 'register_success' "$ROOT/backend/app/routers/analytics.py" \
  && ok "backend funnel includes register_success" \
  || fail "backend funnel missing register_success"

grep -q 'google_play_verify_mock' "$ROOT/backend/app/routers/billing.py" \
  && ok "internal upgrade production guard" \
  || fail "billing internal upgrade guard missing"

for screen in social workspaces mentor shopping receipts roadmap; do
  if grep -q ErrorState "$ROOT/mobile/app/(tabs)/$screen.tsx" 2>/dev/null || grep -q ErrorState "$ROOT/mobile/app/$screen.tsx" 2>/dev/null; then
    ok "ErrorState in $screen"
  else
    fail "ErrorState missing in $screen"
  fi
done

grep -q 'reset-password' "$ROOT/mobile/app.json" \
  && ok "reset-password deep link" \
  || fail "reset-password intent missing"

grep -q 'test_password_reset_flow' "$ROOT/backend/tests/e2e/test_billing_security.py" \
  && ok "password reset e2e test" \
  || fail "password reset e2e test missing"

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "Phase 2 validation FAILED"
  exit 1
fi
echo "Phase 2 validation PASSED"
exit 0
