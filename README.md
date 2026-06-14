# TalkCash

Sesli komut (NLP), akıllı klavye ve yapay zeka destekli kişisel finans ve yaşam yönetimi uygulaması.

## Mimari

```
talkcash/
├── backend/          # FastAPI + PostgreSQL + Redis + MinIO (S3)
│   └── alembic/      # DB migrations
├── mobile/           # React Native (Expo 52) — TR/EN i18n
├── scripts/          # deploy, release, APK build
└── docker-compose.yml
```

## Özellikler

- JWT Auth + refresh token + PIN + Biyometrik
- Sesli komut (Whisper) + Türkçe NLP + slash komutlar
- OCR fiş tarama + S3/MinIO arşivi
- Çoklu cüzdan + döviz kuru sync
- Bütçe, ajanda, alışveriş, AI mentor (LLM chat)
- Sosyal (borç, split, ortak kasa WS, sahiplik devri)
- Offline kuyruk + optimistic snapshot (cüzdan, işlem, ajanda, alışveriş, sesli komut)

### Çevrimdışı senkron

- Yazma işlemleri ağ/5xx hatasında `mobile/services/offlineQueue.ts` kuyruğuna alınır.
- Anında UI güncellemesi için `mobile/services/syncCache.ts` optimistic snapshot kullanır.
- Uygulama ön plana gelince `useOfflineSync` kuyruğu boşaltır; Ayarlar’dan manuel sync de mümkün.
- Oturum süresi dolunca kuyruk korunur; çıkış yaparken bekleyen işlem varsa uyarı gösterilir.
- Zincirli offline işlemler (kasa oluştur → gelir ekle) client/server ID remapping ile senkronize edilir.
- Bütçe CRUD çevrimdışı kuyruğa alınabilir (`budget_create/update/delete`).
- Push bildirim + deep link + geofencing
- PDF/Excel export
- **Çoklu dil**: Türkçe + English

## Hızlı Başlangıç

```bash
docker compose up -d
cd mobile && npm install && cp .env.example .env && npx expo start --tunnel
```

- API: http://localhost:8000/docs
- Health: http://localhost:8000/health
- MinIO Console: http://localhost:9001 (talkcash / talkcash123)

**Android telefon:** `./scripts/phone-setup.sh` → `./scripts/build-android-apk.sh --staging --wait --download` — [docs/ANDROID_APK.md](docs/ANDROID_APK.md)

## Testler

```bash
cd backend && RATE_LIMIT_ENABLED=false SCHEDULER_ENABLED=false python3 -m pytest tests/ -q
cd mobile && npm test && npx tsc --noEmit
./scripts/verify-release.sh
```

CI: GitHub Actions `main` branch push'ta otomatik çalışır.

## Release

```bash
# Doğrulama (test + smoke)
./scripts/release.sh

# Staging deploy
./scripts/release.sh --staging

# Production deploy (Fly secrets gerekli)
./scripts/release.sh --production

# Play Store submit (EAS + Google credentials gerekli)
./scripts/release.sh --submit-play
```

| Rehber | İçerik |
|--------|--------|
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Fly setup, EAS production build |
| [docs/PLAY_STORE_LISTING.md](docs/PLAY_STORE_LISTING.md) | Mağaza metinleri + checklist |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Gizlilik politikası |
| [docs/PRD_COMPLIANCE.md](docs/PRD_COMPLIANCE.md) | Özellik matrisi |

Staging API:

```bash
./scripts/deploy-staging.sh
```

Production API:

```bash
./scripts/setup-fly-prod.sh
./scripts/deploy-production.sh
```

## Native Build (Siri & Google App Actions)

Expo Go Siri/App Actions desteklemez — development client gerekir:

```bash
cd mobile
npx eas login
eas build --profile development --platform android
```

## Veritabanı Migration

```bash
cd backend && alembic upgrade head
```

TalkCash © 2026
