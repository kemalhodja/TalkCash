#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Preflight env (non-secret): DEBUG=${DEBUG:-unset} BILLING_PREMIUM_UNLOCKED=${BILLING_PREMIUM_UNLOCKED:-unset} GOOGLE_PLAY_VERIFY_MOCK=${GOOGLE_PLAY_VERIFY_MOCK:-unset}"

echo "Starting TalkCash API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
