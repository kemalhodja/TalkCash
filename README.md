# TalkCash

Sesli komut (NLP), akıllı klavye ve yapay zeka destekli kişisel finans ve yaşam yönetimi uygulaması.

## Mimari

```
talkcash/
├── backend/          # FastAPI + PostgreSQL + Redis + APScheduler
├── mobile/           # React Native (Expo) — iOS & Android
├── .github/workflows # CI (pytest)
└── docker-compose.yml
```

## Özellikler

| Modül | Durum |
|-------|-------|
| JWT Auth + PIN + Biyometrik | ✅ |
| Sesli komut (Whisper) + Türkçe NLP | ✅ |
| OCR fiş tarama + dosya arşivi | ✅ |
| Çoklu cüzdan + döviz kuru sync | ✅ |
| Ajanda, taksit, mükerrer kontrol | ✅ |
| Alışveriş listesi + buy-to-spend | ✅ |
| Bütçe limitleri CRUD | ✅ |
| AI mentor (uyarı, tahmin, fiyat) | ✅ |
| Sosyal (borç, split, ortak kasa WS) | ✅ |
| Push bildirim + geofencing | ✅ |
| PDF/Excel export | ✅ |
| İşlem geçmişi | ✅ |

## Hızlı Başlangıç

```bash
docker compose up -d
cd mobile && npm install && npx expo start
```

API docs: http://localhost:8000/docs

## Testler

```bash
cd backend && pip install -r requirements.txt && pytest tests/ -v
```

## Ortam Değişkenleri

```env
DATABASE_URL=postgresql+asyncpg://talkcash:talkcash@db:5432/talkcash
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your-secret-key
OPENAI_API_KEY=sk-...  # Ses için gerekli; metin için yerel parser fallback var
```

TalkCash © 2025
