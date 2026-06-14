#!/usr/bin/env bash
# TalkCash release pipeline — verify, optionally deploy and submit
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_STAGING=0
DEPLOY_PROD=0
SUBMIT_PLAY=0

usage() {
  echo "Usage: $0 [--staging] [--production] [--submit-play]"
  echo "  default: run verify-release.sh only"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --staging) DEPLOY_STAGING=1 ;;
    --production) DEPLOY_PROD=1 ;;
    --submit-play) SUBMIT_PLAY=1 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
  shift
done

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
