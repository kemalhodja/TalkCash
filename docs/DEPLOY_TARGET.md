# TalkCash — Deploy hedefi (P0)

**Tek production API:** [Render](https://talkcash-api-prod.onrender.com)

| Ortam | API base | Deploy yolu |
|--------|-----------|-------------|
| **Production (canlı)** | `https://talkcash-api-prod.onrender.com/api/v1` | `main` push → `.github/workflows/render-deploy.yml` veya Render auto-deploy |
| **Staging (Fly)** | `https://talkcash-api.fly.dev/api/v1` | `./scripts/deploy-staging.sh` / `deploy-staging.yml` |
| **Mobile prod APK/AAB** | Render URL (`mobile/eas.json` → `production`) | `eas build --profile production` |
| **Mobile preview APK** | Render veya staging | `eas build --profile preview-prod` |

## Önemli

- **Mobile uygulama production build’leri Render’a bağlıdır.** Fly `talkcash-api-prod` ile karıştırmayın.
- `./scripts/deploy-production.sh` hâlâ **Fly.io** deploy eder (legacy). Yeni prod release için **Render checklist** kullanın: `docs/RENDER_CHECKLIST.md`.
- Migration: Render shell veya release command’da `alembic upgrade head` (020 family wallet, 021 FX alanları).

## Doğrulama

```bash
curl -s https://talkcash-api-prod.onrender.com/health | jq .launch_readiness
API_URL=https://talkcash-api-prod.onrender.com python scripts/smoke_test.py
```

## Web önizleme (dev only)

```bash
cd mobile && npx expo start --web
```

Metro `/__api/*` proxy ile CORS bypass — production web hedefi yok.
