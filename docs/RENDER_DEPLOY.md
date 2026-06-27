# TalkCash — Render + Neon + Upstash (Fly.io alternatifi)

**Prod URL:** `https://talkcash-api-prod.onrender.com`

## Hızlı kurulum

### 1. Render Blueprint (önerilen)
1. https://dashboard.render.com → **New → Blueprint**
2. GitHub: `kemalhodja/TalkCash` → `render.yaml` → **Apply**
3. Blueprint **starter** plan kullanır (free tier uyku yok)

### 2. Zorunlu secret'lar (Dashboard → talkcash-api-prod → Environment)

| Key | Örnek |
|-----|--------|
| `S3_ENDPOINT` | Cloudflare R2 endpoint |
| `S3_ACCESS_KEY` | R2 access key |
| `S3_SECRET_KEY` | R2 secret |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play Console JSON (tek satır) |
| `GOOGLE_RTDN_WEBHOOK_SECRET` | Pub/Sub doğrulama |
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_USER` | `resend` |
| `SMTP_PASSWORD` | Resend API key |
| `SENTRY_DSN` | Backend Sentry DSN |
| `OPENAI_API_KEY` | AI koç |
| `GROQ_API_KEY` | Sesli komut STT |

Tam liste: `docs/PRODUCTION_CHECKLIST.md`

### 3. Deploy doğrulama

```powershell
curl https://talkcash-api-prod.onrender.com/health
```

`launch_readiness` alanında tüm maddeler `true` olmalı (billing_production, smtp, s3, sentry, google_play).

Migration otomatik: `entrypoint.sh` → `alembic upgrade head`

### Startup hatası: `Invalid production configuration`

Render loglarında şu üç hata görürsen dashboard'daki **eski dev değerleri** silinmemiş demektir:

```
BILLING_PREMIUM_UNLOCKED must be false in production
GOOGLE_PLAY_VERIFY_MOCK must be false in production
INTERNAL_UPGRADE_SECRET is a known weak default
```

**Hızlı düzeltme (Dashboard):** `talkcash-api-prod` → **Environment** → şunları ayarla:

| Key | Değer |
|-----|--------|
| `BILLING_PREMIUM_UNLOCKED` | `false` |
| `GOOGLE_PLAY_VERIFY_MOCK` | `false` |
| `INTERNAL_UPGRADE_SECRET` | Yeni rastgele 32+ karakter (Generate) |

Sonra **Manual Deploy**.

**API ile (RENDER_API_KEY varsa):**

```powershell
$env:RENDER_API_KEY = "rnd_..."
.\scripts\render-fix-prod-env.ps1 -Deploy
```

**Blueprint sync:** Dashboard → Blueprint → **Sync** (`render.yaml` zaten doğru değerleri tanımlar).

### 4. Mobil production build

```powershell
cd mobile
$env:EXPO_PUBLIC_SENTRY_DSN="https://..."
$env:EAS_PROJECT_ID="d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
npx eas-cli build --profile production --platform android
```

Gradle CI (EAS kotası yok): GitHub Actions → **Android AAB (Gradle — No EAS)**

## Load test & scale (Phase 6)

```bash
python scripts/load_test.py --base http://localhost:8000/api/v1 --workers 10 --duration 30
```

Multi-region plan: `docs/MULTI_REGION.md`

## Phase 1 kontrol listesi

Yerelde:

```bash
bash scripts/validate-phase1.sh
```

Prod ayarları (`render.yaml`):
- `BILLING_PREMIUM_UNLOCKED=false`
- `GOOGLE_PLAY_VERIFY_MOCK=false`
- `S3_ENABLED=true`
- `PASSWORD_RESET_URL=talkcash://reset-password`

Mobil:
- `app.json` → `reset-password` intent filter
- `EXPO_PUBLIC_SENTRY_DSN` production build'de set

## Notlar

- SMTP yoksa şifre sıfırlama uygulama içi fallback ile çalışır; e-posta için Resend önerilir.
- Play Console'da 6 abonelik SKU'su aktif olmalı (`talkcash_pro_monthly` vb.).
