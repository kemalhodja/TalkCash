#!/usr/bin/env bash
# Pre-release checklist — run before ./scripts/release.sh --production
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0
warn=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name"
    pass=$((pass + 1))
    return 0
  else
    echo -e "${RED}✗${NC} $name"
    fail=$((fail + 1))
    return 1
  fi
}

warn_check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name"
    pass=$((pass + 1))
  else
    echo -e "${YELLOW}⚠${NC} $name (optional / manual)"
    warn=$((warn + 1))
  fi
}

echo "=== TalkCash Pre-Release Checklist ==="
echo ""

echo "--- Git ---"
branch="$(git rev-parse --abbrev-ref HEAD)"
echo -e "${GREEN}✓${NC} Branch: $branch"
pass=$((pass + 1))
warn_check "On main branch" bash -c '[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]'
warn_check "Working tree clean" bash -c '[ -z "$(git status --porcelain)" ]'
warn_check "Synced with origin/main" bash -c 'git fetch origin main 2>/dev/null; [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main 2>/dev/null || echo none)" ]'

echo ""
echo "--- Tests ---"
check "Backend unit tests" bash -c 'cd backend && python3 -m pytest tests/ -q --ignore=tests/e2e -x'
check "Backend E2E (incl. offline)" bash -c 'cd backend && python3 -m pytest tests/e2e/ -q -x'
check "Mobile unit tests" bash -c 'cd mobile && npm test -- --passWithNoTests --silent 2>/dev/null'

echo ""
echo "--- Release artifacts ---"
check "verify-release.sh" ./scripts/verify-release.sh
check "Mobile typecheck" bash -c 'cd mobile && npx tsc --noEmit'
check "EAS production profile" bash -c 'grep -q production mobile/eas.json'
check "Version in app.json" bash -c 'grep -q "\"version\"" mobile/app.json'

echo ""
echo "--- Production config (manual if missing) ---"
warn_check "Fly prod app exists" bash -c 'export PATH="${HOME}/.fly/bin:${PATH}"; command -v flyctl >/dev/null && flyctl apps list 2>/dev/null | grep -q talkcash-api-prod'
warn_check "PRODUCTION.md present" test -f docs/PRODUCTION.md
warn_check "PLAY_STORE_LISTING.md present" test -f docs/PLAY_STORE_LISTING.md
warn_check "SMOKE_TEST.md present" test -f docs/SMOKE_TEST.md

echo ""
echo "--- Summary ---"
echo -e "${GREEN}Passed:${NC} $pass  ${RED}Failed:${NC} $fail  ${YELLOW}Warnings:${NC} $warn"
echo ""
if [ "$fail" -gt 0 ]; then
  echo "Fix failures before: ./scripts/release.sh --production"
  exit 1
fi
echo "Ready for release pipeline:"
echo "  GitHub: Actions → Release Production (Full Pipeline) → confirm: release"
echo "  Local:  FLY_API_TOKEN=... EXPO_TOKEN=... ./scripts/release.sh --skip-verify --production --submit-play"
echo "  Device: manual smoke (docs/SMOKE_TEST.md)"
exit 0
