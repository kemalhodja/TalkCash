#!/usr/bin/env bash
# TalkCash release pipeline — verify, optionally deploy and submit
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_STAGING=0
DEPLOY_PROD=0
SUBMIT_PLAY=0
CHECKLIST_ONLY=0

usage() {
  echo "Usage: $0 [--checklist] [--staging] [--production] [--submit-play]"
  echo "  default: run verify-release.sh only"
  echo "  --checklist: full pre-release checklist (tests + verify)"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --checklist) CHECKLIST_ONLY=1 ;;
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

bash "$ROOT/scripts/verify-release.sh"

if [ "$DEPLOY_STAGING" = "1" ]; then
  echo "==> Deploying staging..."
  bash "$ROOT/scripts/deploy-staging.sh"
fi

if [ "$DEPLOY_PROD" = "1" ]; then
  echo "==> Deploying production..."
  bash "$ROOT/scripts/preflight-production.sh"
  bash "$ROOT/scripts/deploy-production.sh"
fi

if [ "$SUBMIT_PLAY" = "1" ]; then
  echo "==> Submitting to Play Store..."
  bash "$ROOT/scripts/submit-play-store.sh"
fi

echo "Release pipeline complete."
