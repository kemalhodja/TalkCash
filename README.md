# TalkCash

Sesli komut (NLP), akıllı klavye ve yapay zeka destekli kişisel finans ve yaşam yönetimi uygulaması.

## Mimari

```
talkcash/
├── backend/          # FastAPI + PostgreSQL + Redis + MinIO (S3)
│   └── alembic/      # DB migrations
├── mobile/           # React Native (Expo) — TR/EN i18n
├── scripts/          # deploy-staging.sh
└── docker-compose.yml
```

## Özellikler

- JWT Auth + PIN + Biyometrik
- Sesli komut (Whisper) + Türkçe NLP
- OCR fiş tarama + S3/MinIO arşivi
- Çoklu cüzdan + döviz kuru sync
- Bütçe, ajanda, alışveriş, AI mentor
- Sosyal (borç, split, ortak kasa WS)
- Push bildirim + süpermarket POI geofencing (91 statik POI + OSM Overpass)
- PDF/Excel export
- **Çoklu dil**: Türkçe + English

## Hızlı Başlangıç

```bash
docker compose up -d
cd mobile && npm install && cp .env.example .env && npx expo start
```

- API: http://localhost:8000/docs
- Health: http://localhost:8000/health (PostgreSQL + Redis durumu)
- MinIO Console: http://localhost:9001 (talkcash / talkcash123)

Fiziksel cihazda test için `mobile/.env` içinde `EXPO_PUBLIC_API_URL` değerini bilgisayarınızın LAN IP'si ile güncelleyin.

**Android telefon:** `./scripts/phone-setup.sh` → `./scripts/build-android-apk.sh --wait --download` — [docs/ANDROID_APK.md](docs/ANDROID_APK.md)

## Native Build (Siri & Google App Actions)

Siri "Siri'ye Ekle" ve Android App Actions native modül gerektirir (Expo Go desteklemez).

```bash
cd mobile
npm install
npx eas login          # expo.dev hesabı
npx eas init           # projectId üretir → app.config.js / .env
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

Yerel geliştirme:

```bash
npx expo prebuild
npx expo run:ios     # veya run:android
```

## Veritabanı Migration

```bash
cd backend
alembic upgrade head        # migrate
alembic revision --autogenerate -m "description"  # yeni migration
```

Docker başlangıcında migration otomatik çalışır (`entrypoint.sh`).

## Testler

```bash
cd backend
pytest tests/ -v --ignore=tests/e2e   # unit (55 test)
pytest tests/e2e/ -v                  # E2E (27 test, PostgreSQL + Redis)

cd mobile
npm test                              # unit (20 test)
```

CI: GitHub Actions `main` branch push'ta otomatik çalışır.

## Deploy & Yayın

| Rehber | İçerik |
|--------|--------|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Fly.io / Railway staging, Docker prod, mobil API URL |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Fly setup, EAS production build, mağaza yayın checklist |
| [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md) | Deploy sonrası API + cihaz smoke test checklist |

Release doğrulama: `./scripts/verify-release.sh`
| [docs/PLAY_CONSOLE_APP_ACTIONS.md](docs/PLAY_CONSOLE_APP_ACTIONS.md) | Google Play + App Actions yayın adımları |

Staging API (Fly.io):

```bash
./scripts/deploy-staging.sh
# veya: cd backend && fly deploy
# Secret: FLY_API_TOKEN → GitHub Actions "Deploy Staging (Fly.io)"
```

## Ortam Değişkenleri

```env
DATABASE_URL=postgresql+asyncpg://talkcash:talkcash@db:5432/talkcash
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your-secret-key
OPENAI_API_KEY=sk-...

# S3 / MinIO
S3_ENABLED=true
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=talkcash
S3_SECRET_KEY=talkcash123
S3_BUCKET=talkcash
S3_PUBLIC_URL=http://localhost:9000/talkcash

# Geofencing (OSM Overpass)
OVERPASS_ENABLED=true
OVERPASS_URL=https://overpass-api.de/api/interpreter
GEOFENCE_CACHE_TTL=3600
```

TalkCash © 2025
