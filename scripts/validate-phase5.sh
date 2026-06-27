#!/usr/bin/env bash
# Phase 5 — iOS billing scaffold, workspace invites, widgets, SMS import UI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
fail() { echo "FAIL  $1"; FAIL=1; }
ok() { echo "OK    $1"; }

echo "==> TalkCash Phase 5 validation"

for f in \
  backend/app/services/billing/app_store.py \
  backend/tests/test_app_store.py \
  backend/tests/e2e/test_workspace_invite_accept.py \
  mobile/components/SmsImportCard.tsx \
  mobile/plugins/withIosWidgetScaffold.js \
  mobile/plugins/withQuickBalanceWidget.js; do
  if [ -f "$ROOT/$f" ]; then ok "$f"; else fail "missing $f"; fi
done

grep -q '/apple/verify' "$ROOT/backend/app/routers/billing.py" \
  && ok "Apple verify endpoint" \
  || fail "Apple verify endpoint missing"

grep -q 'verifyApplePurchase' "$ROOT/mobile/services/api.ts" \
  && ok "mobile Apple verify API" \
  || fail "mobile Apple verify API missing"

grep -q 'Platform.OS === "ios"' "$ROOT/mobile/services/storeBilling.ts" \
  && ok "storeBilling iOS branch" \
  || fail "storeBilling iOS branch missing"

grep -q 'invitations/inbox' "$ROOT/backend/app/routers/workspaces.py" \
  && ok "workspace invite inbox" \
  || fail "workspace invite inbox missing"

grep -q 'invitations/accept' "$ROOT/backend/app/routers/workspaces.py" \
  && ok "workspace invite accept" \
  || fail "workspace invite accept missing"

grep -q 'workspace-invite' "$ROOT/mobile/services/deepLink.ts" \
  && ok "workspace invite deep link" \
  || fail "workspace invite deep link missing"

grep -q 'SmsImportCard' "$ROOT/mobile/app/(tabs)/input.tsx" \
  && ok "SMS import card on input" \
  || fail "SMS import card missing"

grep -q 'withQuickBalanceWidget' "$ROOT/mobile/app.json" \
  && ok "balance widget plugin" \
  || fail "balance widget plugin missing"

grep -q 'withIosWidgetScaffold' "$ROOT/mobile/app.json" \
  && ok "iOS widget scaffold plugin" \
  || fail "iOS widget scaffold missing"

grep -q 'smsImportTitle' "$ROOT/mobile/i18n/en.ts" \
  && grep -q 'inboxTitle' "$ROOT/mobile/i18n/tr.ts" \
  && ok "phase5 i18n" \
  || fail "phase5 i18n missing"

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "Phase 5 validation FAILED"
  exit 1
fi
echo "Phase 5 validation PASSED"
exit 0
