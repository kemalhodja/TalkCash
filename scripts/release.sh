#!/usr/bin/env bash
# TalkCash release pipeline — verify, optionally deploy and submit
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_STAGING=0
DEPLOY_PROD=0
SUBMIT_PLAY=0
CHECKLIST_ONLY=0
SKIP_VERIFY=0

usage() {
  echo "Usage: $0 [options]"
  echo "  --checklist       Full pre-release gate (tests + verify)"
  echo "  --skip-verify     Skip verify-release (after --checklist)"
  echo "  --staging         Deploy staging API"
  echo "  --production      Deploy production API (requires FLY_API_TOKEN or flyctl login)"
  echo "  --submit-play     EAS production AAB build + Play submit (requires EXPO_TOKEN)"
  echo ""
  echo "Examples:"
  echo "  $0 --checklist"
  echo "  FLY_API_TOKEN=... EXPO_TOKEN=... $0 --skip-verify --production --submit-play"
  echo ""
  echo "GitHub one-click (no local tokens): Actions → Release Production (Full Pipeline)"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --checklist) CHECKLIST_ONLY=1 ;;
    --skip-verify) SKIP_VERIFY=1 ;;
    --staging) DEPLOY_STAGING=1 ;;
    --production) DEPLOY_PROD=1 ;;
    --submit-play) SUBMIT_PLAY=1 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
  shift
done

if [ "$CHECKLIST_ONLY" = "1" ]; then
  bash "$ROOT/scripts/pre-release-checklist.sh"
  exit $?
fi

if [ "$SKIP_VERIFY" = "0" ]; then
  bash "$ROOT/scripts/verify-release.sh"
fi

if [ "$DEPLOY_STAGING" = "1" ]; then
  echo "==> Deploying staging..."
  bash "$ROOT/scripts/deploy-staging.sh"
fi

if [ "$DEPLOY_PROD" = "1" ]; then
  echo "==> Deploying production..."
  export PATH="${HOME}/.fly/bin:${PATH}"
  bash "$ROOT/scripts/preflight-production.sh"
  bash "$ROOT/scripts/deploy-production.sh"
fi

if [ "$SUBMIT_PLAY" = "1" ]; then
  echo "==> Submitting to Play Store..."
  bash "$ROOT/scripts/submit-play-store.sh"
fi

if [ "$SKIP_VERIFY" = "0" ] && [ "$DEPLOY_STAGING" = "0" ] && [ "$DEPLOY_PROD" = "0" ] && [ "$SUBMIT_PLAY" = "0" ]; then
  echo "Release verification complete (no deploy/submit flags)."
else
  echo "Release pipeline complete."
fi
