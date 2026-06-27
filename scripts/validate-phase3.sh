#!/usr/bin/env bash
# Phase 3 — finance UX: monthly report, budget polish, skeleton loaders, quiet hours.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
fail() { echo "FAIL  $1"; FAIL=1; }
ok() { echo "OK    $1"; }

echo "==> TalkCash Phase 3 validation"

for f in \
  mobile/components/MonthlyReportCard.tsx \
  mobile/app/monthly-report.tsx \
  backend/tests/e2e/test_monthly_summary.py; do
  if [ -f "$ROOT/$f" ]; then ok "$f"; else fail "missing $f"; fi
done

grep -q 'top_categories' "$ROOT/backend/app/services/wallet/service.py" \
  && ok "monthly summary category breakdown" \
  || fail "monthly summary missing top_categories"

grep -q 'budget_health' "$ROOT/backend/app/services/wallet/service.py" \
  && ok "monthly summary budget health" \
  || fail "monthly summary missing budget_health"

grep -q 'MonthlyReportCard' "$ROOT/mobile/app/(tabs)/index.tsx" \
  && ok "home monthly report card" \
  || fail "home missing MonthlyReportCard"

grep -q 'MonthlyReportCard' "$ROOT/mobile/app/(tabs)/insights.tsx" \
  && ok "insights free-tier monthly report" \
  || fail "insights missing MonthlyReportCard"

grep -q 'monthly-report' "$ROOT/mobile/app/_layout.tsx" \
  && ok "monthly-report route" \
  || fail "monthly-report route missing"

for screen in budgets shopping agenda receipts social; do
  path="$ROOT/mobile/app/(tabs)/$screen.tsx"
  [ "$screen" = "receipts" ] && path="$ROOT/mobile/app/receipts.tsx"
  if grep -q SkeletonCard "$path" 2>/dev/null; then
    ok "SkeletonCard in $screen"
  else
    fail "SkeletonCard missing in $screen"
  fi
done

grep -q 'ChipPicker' "$ROOT/mobile/app/(tabs)/budgets.tsx" \
  && grep -q 'editCategory' "$ROOT/mobile/app/(tabs)/budgets.tsx" \
  && ok "budget edit category picker" \
  || fail "budget edit category picker missing"

grep -q 'DateTimePicker' "$ROOT/mobile/app/notification-settings.tsx" \
  && ok "quiet hours time pickers" \
  || fail "quiet hours pickers missing"

grep -q 'FlatList' "$ROOT/mobile/app/(tabs)/transactions.tsx" \
  && ok "transactions FlatList virtualization" \
  || fail "transactions FlatList missing"

grep -q 'monthlyReport' "$ROOT/mobile/i18n/en.ts" \
  && grep -q 'monthlyReport' "$ROOT/mobile/i18n/tr.ts" \
  && ok "monthlyReport i18n" \
  || fail "monthlyReport i18n missing"

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "Phase 3 validation FAILED"
  exit 1
fi
echo "Phase 3 validation PASSED"
exit 0
