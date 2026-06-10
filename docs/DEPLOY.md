# TalkCash Staging & Production Deploy

Bu rehber backend API'yi staging ortamına deploy etmeyi anlatır. Mobil uygulama EAS Build ile ayrı yayınlanır.

## Mimari (önerilen staging)

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│ Expo (EAS)  │ ─────────────► │ Fly.io API       │
│ mobile app  │                │ talkcash-api     │
└─────────────┘                └────────┬─────────┘
                                        │
                         ┌──────────────┼──────────────┐
                         ▼              ▼              ▼
                   PostgreSQL       Redis          S3/R2
                   (Fly/Neon)    (Upstash/Fly)   (opsiyonel)
```

---

## Seçenek A: Fly.io (önerilen)

### 1. Önkoşullar

```bash
# https://fly.io/docs/hands-on/install-flyctl/
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. PostgreSQL

```bash
fly postgres create --name talkcash-db --region fra --initial-cluster-size 1
fly postgres attach talkcash-db -a talkcash-api
```

`DATABASE_URL` otomatik secret olarak eklenir.

### 3. Redis (Upstash önerilir)

1. [Upstash](https://upstash.com) → Redis → region `eu-central-1`
2. Connection string'i kopyalayın
3. `fly secrets set REDIS_URL="redis://..." -a talkcash-api`

### 4. API deploy

```bash
cd backend
fly apps create talkcash-api   # ilk sefer
fly secrets set SECRET_KEY="$(openssl rand -hex 32)" -a talkcash-api
fly secrets set OPENAI_API_KEY="sk-..." -a talkcash-api
fly deploy
```

Staging URL: `https://talkcash-api.fly.dev`

### 5. Sağlık kontrolü

```bash
curl https://talkcash-api.fly.dev/health
```

Beklenen yanıt:

```json
{
  "status": "ok",
  "checks": { "database": true, "redis": true }
}
```

`degraded` görürseniz PostgreSQL veya Redis bağlantısını kontrol edin.

### 6. GitHub Actions ile deploy

Repository secret ekleyin: `FLY_API_TOKEN` ([fly tokens create deploy](https://fly.io/user/personal_access_tokens))

Actions → **Deploy Staging (Fly.io)** → Run workflow

---

## Seçenek B: Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Root directory: `backend`
3. Dockerfile path: `Dockerfile`
4. Add-ons: PostgreSQL + Redis
5. Variables (Railway otomatik `DATABASE_URL` / `REDIS_URL` inject eder):

| Değişken | Değer |
|----------|-------|
| `SECRET_KEY` | rastgele 64 karakter |
| `OPENAI_API_KEY` | OpenAI anahtarınız |
| `SCHEDULER_ENABLED` | `true` |

Start command (Railway Dockerfile CMD kullanır): `./entrypoint.sh`

Public domain: Settings → Networking → Generate Domain

---

## Mobil uygulamayı staging'e bağlama

`mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://talkcash-api.fly.dev/api/v1
```

EAS build:

```bash
cd mobile
eas build --profile preview --platform android \
  --env EXPO_PUBLIC_API_URL=https://talkcash-api.fly.dev/api/v1
```

GitHub repository variable: `EXPO_PUBLIC_API_URL` (EAS workflow için)

---

## Docker Compose (VPS / kendi sunucunuz)

```bash
cp backend/.env.production.example backend/.env
# .env dosyasını düzenleyin
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Güvenlik kontrol listesi

- [ ] `SECRET_KEY` varsayılan değer değil
- [ ] `OPENAI_API_KEY` sadece sunucuda (mobil uygulamada değil)
- [ ] HTTPS zorunlu (Fly/Railway varsayılan)
- [ ] PostgreSQL şifresi güçlü
- [ ] MinIO/S3 bucket public write kapalı

---

## Sorun giderme

| Belirti | Çözüm |
|---------|-------|
| `/health` → `degraded` | `DATABASE_URL`, `REDIS_URL` secret'larını kontrol edin |
| Migration hatası | `fly ssh console -a talkcash-api` → `alembic upgrade head` |
| Mobil cihaz API'ye ulaşamıyor | `localhost` yerine staging HTTPS URL kullanın |
| CORS hatası | Backend `allow_origins=["*"]` — production'da domain kısıtlayın |
