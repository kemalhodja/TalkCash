# TalkCash — Render + Neon + Upstash (Fly.io alternatifi)

**Prod URL:** `https://talkcash-api-prod.onrender.com`

## Hızlı kurulum

### 1. Neon PostgreSQL (ücretsiz)
1. https://console.neon.tech → proje oluştur (Frankfurt)
2. **Connection string** kopyala (`postgresql://...`)

### 2. Upstash Redis (ücretsiz)
1. https://console.upstash.com → Redis → eu-central-1
2. **REDIS_URL** kopyala (`rediss://...`)

### 3. Render Blueprint
1. https://dashboard.render.com → **New → Blueprint**
2. GitHub: `kemalhodja/TalkCash`
3. `render.yaml` otomatik algılanır → **Apply**
4. `talkcash-api-prod` → **Environment** → şunları ekle:
   - `DATABASE_URL` → `postgresql+asyncpg://...?sslmode=require` (Neon'dan, `postgresql://` → `+asyncpg` ekle)
   - `REDIS_URL` → Upstash URL
   - `OPENAI_API_KEY` → (opsiyonel ama ses/LLM için gerekli)

### 4. Deploy + health

```powershell
.\scripts\deploy-render.ps1
```

veya manuel:

```powershell
curl https://talkcash-api-prod.onrender.com/health
```

Migration otomatik: `entrypoint.sh` → `alembic upgrade head`

### 5. Mobil build #18 (Render URL ile)

Build #17 Fly URL kullanıyor — Render sonrası yeni build şart:

```powershell
cd mobile
$env:EAS_PROJECT_ID="d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
npx eas-cli build --profile production --platform android
```

## Notlar

- Render **free** plan: 15 dk idle sonra uyur, ilk istek ~30 sn sürebilir
- `GOOGLE_PLAY_VERIFY_MOCK=true` — Play billing doğrulama mock (service account eklenince `false` yap)
- Fiş görselleri için ileride R2/S3 açılabilir
