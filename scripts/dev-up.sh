#!/usr/bin/env bash
# One-shot local dev: Docker + health + migration hint
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> TalkCash dev-up"
docker compose up -d --build

echo "==> Waiting for backend health..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "  OK  http://127.0.0.1:8000/health"
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "  FAIL — check: docker compose logs backend --tail 40"
    exit 1
  fi
done

echo
echo "==> Smoke test (optional)..."
if API_URL=http://127.0.0.1:8000 python3 "$ROOT/scripts/smoke_test.py" 2>/dev/null; then
  echo "  Smoke PASSED"
else
  echo "  Smoke skipped or failed (OpenAI optional)"
fi

echo
echo "Next:"
echo "  cd mobile && npm start          # Expo dev"
echo "  ./scripts/phone-setup.sh        # telefon + APK"
echo "  ./scripts/verify-release.sh     # full test suite"
