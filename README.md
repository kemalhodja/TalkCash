# TalkCash

Sesli komut (NLP), akıllı klavye ve yapay zeka destekli kişisel finans ve yaşam yönetimi uygulaması.

## Mimari

```
talkcash/
├── backend/          # FastAPI + PostgreSQL + Redis + MinIO (S3)
├── mobile/           # React Native (Expo) — TR/EN i18n
├── alembic/          # DB migrations
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
cd mobile && npm install && npx expo start
```

- API: http://localhost:8000/docs
- MinIO Console: http://localhost:9001 (talkcash / talkcash123)

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
pytest tests/ -v            # unit + E2E (PostgreSQL gerekli)
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
