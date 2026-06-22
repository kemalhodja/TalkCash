# TalkCash — Render deploy checklist (5 dk)

Repo push edildi: `render.yaml` GitHub'da hazir.

## Simdi yap (sirayla)

### 1. Neon — PostgreSQL
https://console.neon.tech
- Sign up / login
- **New Project** → Region: **Frankfurt (AWS eu-central-1)**
- Dashboard → **Connection string** → **URI** kopyala
- Ornek: `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
- Render icin `postgresql://` → `postgresql+asyncpg://` yap (basina +asyncpg ekle)

### 2. Upstash — Redis
https://console.upstash.com
- **Create database** → Type: Regional → Region: **eu-central-1**
- **Redis Connect** → `UPSTASH_REDIS_REST_URL` degil, **Redis URL** (`rediss://default:...@...upstash.io:6379`)

### 3. Render — Blueprint
https://dashboard.render.com/blueprints
- **New Blueprint Instance**
- GitHub bagla → repo: **kemalhodja/TalkCash**
- Branch: **main** → `render.yaml` gorunmeli → **Apply**

### 4. Environment variables (Render dashboard)
`talkcash-api-prod` → **Environment**:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | `postgresql+asyncpg://...?sslmode=require` |
| `REDIS_URL` | `rediss://...` |
| `OPENAI_API_KEY` | `sk-...` (varsa) |

`SECRET_KEY` otomatik uretilir. **Save** → **Manual Deploy**.

### 5. Health (5-10 dk sonra)
```powershell
curl https://talkcash-api-prod.onrender.com/health
```
Beklenen: `"status":"ok"` veya `"degraded"` (db: true)

### 6. Mobil build #18
```powershell
cd mobile
$env:EAS_PROJECT_ID="d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
npx eas-cli build --profile production --platform android
```

### 7. Play Console
Build #17 AAB veya #18 AAB → Internal testing → yukle

---

Neon + Upstash URL'lerini hazirlayinca buraya yapistir — Render env formatini birlikte kontrol ederiz.
