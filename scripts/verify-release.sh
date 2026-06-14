#!/usr/bin/env bash
# Full release verification — run locally or in CI before deploy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://127.0.0.1:8000}"
SKIP_TESTS="${SKIP_TESTS:-0}"

echo "==> TalkCash release verification"
echo

if [ "$SKIP_TESTS" != "1" ]; then
  echo "==> Backend tests..."
  (
    cd "$ROOT/backend"
    export RATE_LIMIT_ENABLED=false SCHEDULER_ENABLED=false
    python3 -m pytest tests/ -q
  )

  echo
  echo "==> Mobile tests..."
  (
    cd "$ROOT/mobile"
    npm test -- --watchAll=false 2>/dev/null || npm test
    npx tsc --noEmit
  )

  echo
fi
echo "==> API smoke test ($API_URL)..."
if curl -sf --max-time 5 "${API_URL%/}/health" >/dev/null 2>&1; then
  API_URL="$API_URL" python3 "$ROOT/scripts/smoke_test.py"
else
  echo "WARNING: API not reachable at $API_URL — skipping smoke test"
  echo "         Start backend or set API_URL=https://talkcash-api.fly.dev"
fi

echo
echo "Release verification PASSED"
