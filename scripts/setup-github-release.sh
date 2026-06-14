#!/usr/bin/env bash
# First-time bootstrap: Fly apps + print GitHub secret/variable commands
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.fly/bin:${PATH}"

echo "=== TalkCash Release Bootstrap ==="
echo ""
echo "This script prepares Fly.io apps and prints GitHub setup commands."
echo "You must paste secrets into GitHub manually (repo admin required)."
echo ""

# Install flyctl if needed
if ! command -v flyctl >/dev/null 2>&1; then
  curl -L https://fly.io/install.sh | sh
  export PATH="${HOME}/.fly/bin:${PATH}"
fi

if ! flyctl auth whoami >/dev/null 2>&1; then
  if [ -z "${FLY_API_TOKEN:-}" ]; then
    echo "==> Fly.io login (browser)..."
    flyctl auth login
  fi
fi

echo ""
read -r -p "Run staging Fly setup? [Y/n] " staging_ans
if [ "${staging_ans:-Y}" != "n" ] && [ "${staging_ans:-Y}" != "N" ]; then
  bash "$ROOT/scripts/setup-fly-staging.sh"
fi

echo ""
read -r -p "Run production Fly setup? [y/N] " prod_ans
if [ "$prod_ans" = "y" ] || [ "$prod_ans" = "Y" ]; then
  bash "$ROOT/scripts/setup-fly-prod.sh"
fi

echo ""
echo "==> Generate Fly deploy token for GitHub Actions"
echo "Run on your machine (copy output into GitHub secret FLY_API_TOKEN):"
echo ""
echo "  flyctl auth token"
echo "  # or scoped: fly tokens create deploy -a talkcash-api"
echo ""

echo "==> GitHub repository configuration"
echo ""
echo "Settings → Secrets and variables → Actions → Secrets:"
echo "  FLY_API_TOKEN     ← flyctl auth token"
echo "  EXPO_TOKEN        ← https://expo.dev/settings/access-tokens"
echo ""
echo "Settings → Variables:"
echo "  EXPO_PUBLIC_API_URL = https://talkcash-api-prod.fly.dev/api/v1"
echo "  EAS_PROJECT_ID      ← Expo dashboard project UUID"
echo ""

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
  if [ -n "$repo" ]; then
    echo "If gh has admin access, you can set secrets locally:"
    echo "  gh secret set FLY_API_TOKEN"
    echo "  gh secret set EXPO_TOKEN"
    echo "  gh variable set EXPO_PUBLIC_API_URL --body 'https://talkcash-api-prod.fly.dev/api/v1'"
    echo "  gh variable set EAS_PROJECT_ID --body '<your-project-uuid>'"
    echo ""
    echo "Validate:"
    echo "  ./scripts/validate-release-config.sh"
    echo ""
    echo "Release workflow:"
    echo "  https://github.com/${repo}/actions/workflows/release-production.yml"
  fi
fi

echo ""
echo "After secrets are set:"
echo "  1. Actions → Validate Release Config"
echo "  2. Actions → Release Production (Full Pipeline) → confirm: release"
echo ""
echo "Full guide: docs/SETUP_RELEASE.md"
