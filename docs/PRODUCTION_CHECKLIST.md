# Production secrets checklist (Render) — Phase 1

Deploy öncesi `bash scripts/validate-phase1.sh` çalıştırın.

## Render Dashboard → talkcash-api-prod → Environment

| Secret | Phase 1 | Notes |
|--------|---------|--------|
| `S3_ENDPOINT` | **Zorunlu** | R2/S3 — API S3_ENABLED=true iken secret yoksa **başlamaz** |
| `S3_ACCESS_KEY` | **Zorunlu** | |
| `S3_SECRET_KEY` | **Zorunlu** | |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | **Zorunlu** | Play billing doğrulama |
| `GOOGLE_RTDN_WEBHOOK_SECRET` | **Zorunlu** | Abonelik webhook |
| `SMTP_HOST` | **Zorunlu** | `smtp.resend.com` |
| `SMTP_USER` | **Zorunlu** | `resend` |
| `SMTP_PASSWORD` | **Zorunlu** | Resend API key |
| `SENTRY_DSN` | Önerilen | Backend crash |
| `OPENAI_API_KEY` | Önerilen | AI koç |
| `GROQ_API_KEY` | Önerilen | Ses STT |

## Mobil (EAS / Gradle CI)

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting (production build) |
| `EXPO_PUBLIC_API_URL` | `https://talkcash-api-prod.onrender.com/api/v1` |
| `EXPO_PUBLIC_APP_ENV` | `production` |

GitHub Actions secret olarak eklenebilir: `EXPO_PUBLIC_SENTRY_DSN`

## Health kontrolü

```bash
curl -s https://talkcash-api-prod.onrender.com/health | jq .launch_readiness
```

Beklenen (lansman öncesi):

```json
{
  "billing_production": true,
  "smtp_configured": true,
  "s3_configured": true,
  "sentry_configured": true,
  "google_play_configured": true
}
```

## Play Console

6 abonelik SKU aktif:
- `talkcash_pro_monthly` / `talkcash_pro_yearly`
- `talkcash_family_monthly` / `talkcash_family_yearly`
- `talkcash_business_monthly` / `talkcash_business_yearly`
