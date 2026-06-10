# TalkCash

Sesli komut (NLP), akıllı klavye ve yapay zeka destekli kişisel finans ve yaşam yönetimi uygulaması.

## Mimari

```
talkcash/
├── backend/          # FastAPI + PostgreSQL + Redis + APScheduler
├── mobile/           # React Native (Expo) — iOS & Android
└── docker-compose.yml
```

## PRD Modülleri — Tamamlandı

| # | Modül | Backend | Mobile |
|---|-------|---------|--------|
| 1 | Veri Girişi (Ses/NLP, Slash, OCR) | ✅ Whisper, GPT, Tesseract | ✅ Ses kaydı, fiş tarama, klavye |
| 2 | Dinamik Kasa Yönetimi | ✅ Çoklu cüzdan, kur sync, net varlık | ✅ Dashboard, WalletCard |
| 3 | Akıllı Ajanda & Fatura | ✅ Taksit, mükerrer kontrol, scheduler | ✅ Fatura ekleme, duplicate dialog |
| 4 | Alışveriş Listesi | ✅ Kategorizasyon, daily reset cron | ✅ Buy-to-spend modal, rutinler |
| 5 | AI Mentorluk | ✅ Bütçe uyarısı, burn rate, fiyat takibi | ✅ Dashboard entegrasyonu |
| 6 | Sosyal Katman | ✅ Ortak kasa WS, borç, split bill | ✅ WhatsApp paylaşım, sosyal tab |
| 7 | Güvenlik | ✅ JWT, PIN, biyometrik | ✅ Login, lock screen, SecureStore |
| 8 | Bildirimler | ✅ Push (Expo), ajanda hatırlatıcı cron | ✅ Local + push notifications |
| 9 | Geofencing | — | ✅ Market yakını hatırlatma |
| 10 | Export | ✅ PDF + Excel | ✅ Ayarlar ekranından indirme |

## Hızlı Başlangıç

```bash
# Tüm altyapı
docker compose up -d

# Sadece backend (geliştirme)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Mobile
cd mobile && npm install && npx expo start
```

API docs: http://localhost:8000/docs

## Scheduler Görevleri

| Görev | Zamanlama |
|-------|-----------|
| Alışveriş listesi sıfırlama | Her gece 00:00 |
| Ajanda hatırlatıcıları | Her gün 08:00 ve 20:00 |
| Döviz/altın kuru sync | Her saat |

## Ortam Değişkenleri

```env
DATABASE_URL=postgresql+asyncpg://talkcash:talkcash@db:5432/talkcash
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your-secret-key
OPENAI_API_KEY=sk-...  # Opsiyonel (yerel parser fallback var)
```

## Lisans

TalkCash © 2025
