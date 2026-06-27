# TalkCash — Multi-Region & Scale Guide (Phase 6)

Current production blueprint (`render.yaml`) runs in **Frankfurt (EU)**:

- Postgres: `talkcash-db` (starter)
- Redis: `talkcash-redis` (starter)
- API: `talkcash-api-prod` (Docker, `/health` check)

## When to scale

| Signal | Action |
|--------|--------|
| p95 API latency > 1.5s sustained | Upgrade Render plan; run `python scripts/load_test.py --base $API` |
| Postgres CPU > 70% | Move to higher DB tier; add read replica for reports |
| Redis memory pressure | Upgrade key-value plan; review WS bridge fan-out |
| 5xx spike in Sentry | Check `/health` `checks.database` / `checks.redis` |

## Load test (staging / prod)

```bash
pip install httpx
python scripts/load_test.py \
  --base https://talkcash-api-staging.onrender.com/api/v1 \
  --workers 20 \
  --duration 60 \
  --max-p95-ms 1500 \
  --max-error-rate 0.05
```

Exit code `0` = SLA passed. Use `--json` for CI artifacts.

## Multi-region options

### Phase A — Single region (current)

- EU users: Frankfurt API + Neon/Render Postgres
- Mobile offline-first reduces read pressure
- S3/R2 for receipts (global CDN via public URL)

### Phase B — Read replica (reports)

1. Add Postgres read replica in same region
2. Route `GET /insights/*`, `GET /analytics/*`, exports to read pool
3. Keep writes on primary

### Phase C — Secondary API region (US)

1. Deploy second Render service in **Oregon** with same Docker image
2. Route US users via GeoDNS or client-side region picker (`EXPO_PUBLIC_API_URL`)
3. **Single writer DB** in Frankfurt initially (accept cross-region latency on writes)
4. Redis: prefer regional instance per API; WS may need sticky sessions

### Phase D — Full active-active (future)

- CockroachDB / Neon branching / logical replication
- Global Redis (Upstash Global) for rate limits + pub/sub
- Not required for v1 launch — document only

## Observability checklist

| Layer | Tool |
|-------|------|
| API errors | Sentry (`SENTRY_DSN`) + `X-Request-ID` header |
| Slow requests | API logs `slow_request` > 2s |
| Mobile crashes | `EXPO_PUBLIC_SENTRY_DSN` |
| Health | `GET /health` → `observability.uptime_seconds`, `launch_readiness` |
| Uptime | Render health check on `/health` |

## Environment variables

| Key | Purpose |
|-----|---------|
| `APP_VERSION` | Shown in `/health` observability block |
| `DEPLOY_REGION` | e.g. `frankfurt`, `oregon` |
| `SENTRY_ENVIRONMENT` | `production` / `staging` |

## Rollback

1. Render → **Rollback** to previous deploy
2. Verify `/health` status `ok`
3. Re-run load test against rolled-back URL
