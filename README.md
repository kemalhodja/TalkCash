# TalkCash

Sesli komut (NLP), akıllı klavye ve yapay zeka destekli ajanda/alışveriş listesi özelliklerini barındıran kişisel finans ve yaşam yönetimi uygulaması.

## Mimari

```
talkcash/
├── backend/          # FastAPI — API, NLP, OCR, AI analiz
├── mobile/           # React Native (Expo) — iOS & Android
└── docker-compose.yml
```

## Modüller (PRD)

| Modül | Açıklama | Backend | Mobile |
|-------|----------|---------|--------|
| 1. Veri Girişi | Sesli komut, slash command, OCR | `services/nlp`, `routers/input`, `routers/ocr` | `input.tsx`, `VoiceInput` |
| 2. Kasa Yönetimi | Çoklu cüzdan, transfer, net varlık | `services/wallet` | `index.tsx`, `WalletCard` |
| 3. Ajanda | Fatura/taksit takibi, bildirimler | `services/agenda` | `agenda.tsx` |
| 4. Alışveriş Listesi | Kategorizasyon, buy-to-spend | `services/shopping` | `shopping.tsx` |
| 5. AI Mentor | Bütçe uyarıları, tahmin, fiyat takibi | `services/ai_mentor` | Dashboard entegrasyonu |
| 6. Sosyal | Borç defteri, hesap bölme | `services/social` | API hazır |

## Hızlı Başlangıç

### Backend

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API dokümantasyonu: http://localhost:8000/docs

### Docker ile

```bash
docker compose up -d
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Teknoloji Seti

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, PostgreSQL, Redis
- **AI/NLP:** OpenAI Whisper + GPT-4o-mini (yerel Türkçe parser fallback)
- **OCR:** Tesseract (Türkçe dil paketi)
- **Mobile:** React Native, Expo Router

## API Örnekleri

```bash
# Metin parse
curl -X POST "http://localhost:8000/api/v1/input/parse?text=150%20TL%20kahve%20Starbucks"

# Slash command
curl -X POST "http://localhost:8000/api/v1/input/slash?command=/150%20kahve%20banka"

# Net varlık
curl "http://localhost:8000/api/v1/wallets/net-worth?user_id=UUID"
```

## Ortam Değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL bağlantı dizesi |
| `REDIS_URL` | Redis bağlantı dizesi |
| `OPENAI_API_KEY` | Whisper + GPT için (opsiyonel, yerel parser fallback var) |
| `SECRET_KEY` | JWT imzalama anahtarı |

## Lisans

TalkCash © 2025
