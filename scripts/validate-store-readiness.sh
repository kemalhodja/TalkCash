#!/usr/bin/env bash
# Validates Play Store / release readiness artifacts exist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

check() {
  if [ -e "$ROOT/$1" ]; then
    echo "  OK  $1"
  else
    echo "  FAIL missing: $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "Store readiness checklist"
check "docs/PLAY_STORE_LISTING.md"
check "docs/PRIVACY.md"
check "docs/TERMS.md"
check "mobile/assets/icon.png"
check "mobile/assets/adaptive-icon.png"
check "mobile/assets/splash.png"
check "mobile/.maestro/smoke.yaml"
check "mobile/.maestro/expense-flow.yaml"
check "mobile/.maestro/micro-savings-flow.yaml"
check "docs/GOOGLE_PLAY_RELEASE.md"
check "docs/GOOGLE_PLAY_DATA_SAFETY.md"
check "docs/GOOGLE_PLAY_SUBSCRIPTIONS.md"
check "scripts/preflight-play-store.ps1"
check "scripts/submit-play-store.ps1"
check "scripts/smoke_test.py"

if grep -q "Micro-investment\|Mikro yatırım\|micro-savings" "$ROOT/docs/PLAY_STORE_LISTING.md"; then
  echo "  OK  Play Store micro-savings copy"
else
  echo "  FAIL Play Store listing missing micro-savings positioning"
  FAIL=$((FAIL + 1))
fi

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Store readiness FAILED ($FAIL items)"
  exit 1
fi

echo ""
echo "Store readiness PASSED"
