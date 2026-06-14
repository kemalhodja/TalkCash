#!/usr/bin/env bash
# End-to-end release setup: validate config, print GitHub/Fly steps, run local checklist
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== TalkCash Complete Release Setup ==="
echo ""

# 1. Local validation (non-fatal — prints what's missing)
set +e
bash "$ROOT/scripts/validate-release-config.sh"
validate_exit=$?
set -e

echo ""
echo "=== Local quality gate ==="
bash "$ROOT/scripts/pre-release-checklist.sh" || checklist_exit=$?
checklist_exit=${checklist_exit:-0}

echo ""
echo "=== GitHub (repo admin) ==="
repo="kemalhodja/eduai-sale"
if command -v gh >/dev/null 2>&1; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "$repo")"
fi
echo "Secrets:  https://github.com/${repo}/settings/secrets/actions"
echo "Variables: https://github.com/${repo}/settings/variables/actions"
echo "Workflow: https://github.com/${repo}/actions/workflows/release-production.yml"
echo ""
echo "Required secrets:  FLY_API_TOKEN, EXPO_TOKEN"
echo "Required variables: EXPO_PUBLIC_API_URL, EAS_PROJECT_ID"
echo ""
echo "After secrets are set:"
echo "  1. Actions → Validate Release Config"
echo "  2. Actions → Release Production (Full Pipeline) → confirm: release"
echo ""
echo "Fly first-time: ./scripts/setup-github-release.sh"
echo "Docs: docs/SETUP_RELEASE.md"

if [ "$validate_exit" -ne 0 ] || [ "$checklist_exit" -ne 0 ]; then
  echo ""
  echo "Setup incomplete — fix items above, then re-run this script."
  exit 1
fi

echo ""
echo "All checks passed. Ready to release from GitHub Actions."
