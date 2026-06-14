#!/usr/bin/env bash
# Validate GitHub Actions release configuration (run locally or in CI)
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

ok() { echo -e "${GREEN}✓${NC} $1"; pass=$((pass + 1)); }
bad() { echo -e "${RED}✗${NC} $1"; fail=$((fail + 1)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; warn=$((warn + 1)); }

export PATH="${HOME}/.fly/bin:${PATH}"

echo "=== TalkCash Release Config Validation ==="
echo ""

# --- GitHub CLI (optional) ---
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
  if [ -n "$repo" ]; then
    echo "--- GitHub repo: $repo ---"
    for secret in FLY_API_TOKEN EXPO_TOKEN; do
      if gh secret list 2>/dev/null | awk '{print $1}' | grep -qx "$secret"; then
        ok "GitHub secret $secret"
      else
        bad "GitHub secret $secret missing (Settings → Secrets → Actions)"
      fi
    done
    for var in EXPO_PUBLIC_API_URL EAS_PROJECT_ID; do
      if gh variable list 2>/dev/null | awk '{print $1}' | grep -qx "$var"; then
        ok "GitHub variable $var"
      else
        bad "GitHub variable $var missing (Settings → Variables → Actions)"
      fi
    done
  else
    warn "gh logged in but cannot read repo secrets (need admin access)"
  fi
else
  warn "gh not available — skipping GitHub secret/variable checks"
fi

echo ""
echo "--- Local tokens (optional) ---"

if [ -n "${FLY_API_TOKEN:-}" ]; then
  if flyctl auth whoami >/dev/null 2>&1; then
    ok "FLY_API_TOKEN valid ($(flyctl auth whoami 2>/dev/null | head -1))"
  else
    bad "FLY_API_TOKEN set but flyctl auth failed"
  fi
else
  warn "FLY_API_TOKEN not in shell — set for local deploy"
fi

if [ -n "${EXPO_TOKEN:-}" ]; then
  if npx --yes eas-cli whoami >/dev/null 2>&1; then
    ok "EXPO_TOKEN valid ($(npx --yes eas-cli whoami 2>/dev/null | head -1))"
  else
    bad "EXPO_TOKEN set but eas whoami failed"
  fi
else
  warn "EXPO_TOKEN not in shell — set for EAS build/submit"
fi

echo ""
echo "--- Fly apps (when authenticated) ---"
if flyctl auth whoami >/dev/null 2>&1; then
  if flyctl apps list 2>/dev/null | grep -q talkcash-api; then
    ok "Fly app talkcash-api (staging)"
  else
    warn "Fly app talkcash-api missing — run ./scripts/setup-fly-staging.sh"
  fi
  if flyctl apps list 2>/dev/null | grep -q talkcash-api-prod; then
    ok "Fly app talkcash-api-prod"
  else
    warn "Fly app talkcash-api-prod missing — run ./scripts/setup-fly-prod.sh"
  fi
else
  warn "Fly not authenticated — skip app checks"
fi

echo ""
echo "--- Summary ---"
echo -e "${GREEN}Passed:${NC} $pass  ${RED}Failed:${NC} $fail  ${YELLOW}Warnings:${NC} $warn"
echo ""

if [ "$fail" -gt 0 ]; then
  echo "Fix failures, then run:"
  echo "  GitHub → Actions → Validate Release Config"
  echo "  GitHub → Actions → Release Production (Full Pipeline) → confirm: release"
  echo ""
  echo "Setup guide: docs/SETUP_RELEASE.md"
  exit 1
fi

echo "Release config looks ready."
echo "Trigger: GitHub → Actions → Release Production (Full Pipeline) → confirm: release"
exit 0
