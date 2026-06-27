#!/usr/bin/env bash
# Phase 6 — load test SLA, observability, multi-region docs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
fail() { echo "FAIL  $1"; FAIL=1; }
ok() { echo "OK    $1"; }

echo "==> TalkCash Phase 6 validation"

for f in \
  scripts/load_test.py \
  backend/app/utils/load_sla.py \
  backend/app/observability.py \
  backend/tests/test_load_test_sla.py \
  backend/tests/test_health_observability.py \
  docs/MULTI_REGION.md; do
  if [ -f "$ROOT/$f" ]; then ok "$f"; else fail "missing $f"; fi
done

grep -q 'evaluate_sla' "$ROOT/backend/app/utils/load_sla.py" \
  && ok "SLA helper module" \
  || fail "SLA helper missing"

grep -q 'max-p95-ms' "$ROOT/scripts/load_test.py" \
  && ok "load test SLA flags" \
  || fail "load test SLA flags missing"

grep -q 'observability' "$ROOT/backend/app/main.py" \
  && ok "health observability block" \
  || fail "health observability missing"

grep -q 'X-Response-Time-Ms' "$ROOT/backend/app/main.py" \
  && ok "response time header" \
  || fail "response time header missing"

grep -q 'capture_exception_with_request' "$ROOT/backend/app/main.py" \
  && ok "Sentry request context" \
  || fail "Sentry request context missing"

grep -q 'setObservabilityUser' "$ROOT/mobile/services/observability.ts" \
  && ok "mobile Sentry user context" \
  || fail "mobile observability user missing"

grep -q 'setObservabilityUser' "$ROOT/mobile/services/auth.ts" \
  && ok "auth wires observability user" \
  || fail "auth observability wiring missing"

grep -q 'apple_configured' "$ROOT/backend/app/main.py" \
  && ok "launch_readiness apple" \
  || fail "apple launch readiness missing"

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "Phase 6 validation FAILED"
  exit 1
fi
echo "Phase 6 validation PASSED"
exit 0
