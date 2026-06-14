#!/usr/bin/env bash
# Validate Fly.io production prerequisites before deploy
set -euo pipefail

APP="${FLY_APP:-talkcash-api-prod}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

warn() { echo "WARNING: $*"; }
fail() { echo "ERROR: $*"; FAIL=1; }

echo "==> TalkCash production preflight ($APP)"

if ! command -v flyctl >/dev/null 2>&1; then
  fail "flyctl not installed. Run: ./scripts/setup-fly-prod.sh"
else
  echo "  OK  flyctl installed"
fi

if command -v flyctl >/dev/null 2>&1; then
  if ! flyctl auth whoami >/dev/null 2>&1; then
    fail "Not logged in to Fly.io. Run: flyctl auth login"
  else
    echo "  OK  flyctl authenticated ($(flyctl auth whoami 2>/dev/null | head -1))"
  fi

  if flyctl apps list 2>/dev/null | grep -q "$APP"; then
    echo "  OK  app $APP exists"
  else
    fail "App $APP not found. Run: ./scripts/setup-fly-prod.sh"
  fi

  if flyctl secrets list -a "$APP" >/dev/null 2>&1; then
    for key in SECRET_KEY DATABASE_URL ALLOWED_ORIGINS S3_ENABLED; do
      if flyctl secrets list -a "$APP" 2>/dev/null | grep -q "$key"; then
        echo "  OK  secret $key"
      else
        fail "Missing required production secret $key on $APP"
      fi
    done
    if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "REDIS_URL"; then
      warn "REDIS_URL not set — API will run in degraded mode"
    else
      echo "  OK  secret REDIS_URL"
    fi
    if ! flyctl secrets list -a "$APP" 2>/dev/null | grep -q "OPENAI_API_KEY"; then
      warn "OPENAI_API_KEY not set — NLP/voice/chat will be limited"
    else
      echo "  OK  secret OPENAI_API_KEY"
    fi
  fi
fi

if [ -f "$ROOT/backend/fly.prod.toml" ]; then
  echo "  OK  fly.prod.toml present"
else
  fail "backend/fly.prod.toml missing"
fi

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "Preflight FAILED — fix the errors above before deploying production."
  exit 1
fi

echo
echo "Preflight PASSED — ready to deploy with ./scripts/deploy-production.sh"
exit 0
