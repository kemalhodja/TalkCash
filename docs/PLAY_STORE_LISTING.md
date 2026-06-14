# TalkCash — Google Play Store Listing

Play Console → **TalkCash** (`io.talkcash.app`) → **Main store listing**

## App details

| Field | Türkçe (tr-TR) | English (en-US) |
|-------|----------------|-----------------|
| **App name** | TalkCash | TalkCash |
| **Short description** (80 char) | Sesli komutla bütçe, ajanda ve alışveriş yönetimi | Voice-first budget, bills, and shopping manager |
| **Category** | Finance | Finance |
| **Tags** | budget, finance, expense tracker, voice assistant | budget, finance, expense tracker, voice assistant |

## Full description (tr-TR)

TalkCash, sesli komut ve akıllı klavye ile kişisel finansınızı yönetmenizi sağlar.

**Öne çıkanlar**
- Sesli harcama girişi (Whisper + Türkçe NLP)
- Çoklu cüzdan, transfer ve net varlık takibi
- Bütçe limitleri ve anlık uyarılar
- Ajanda: faturalar, taksitler, tekrarlayan ödemeler
- Alışveriş listesi + fiş tarama (OCR)
- AI finans mentoru
- Ortak kasa, borç defteri, hesap bölme
- Offline kuyruk — bağlantı gelince otomatik senkron
- TR/EN dil desteği

**Gizlilik**
Verileriniz şifreli bağlantı üzerinden sunucuya iletilir. PIN ve biyometrik kilitleme desteklenir.

## Full description (en-US)

TalkCash helps you manage personal finance with voice commands and smart text input.

**Highlights**
- Voice expense entry (Whisper + NLP)
- Multi-wallet net worth tracking
- Budget limits with alerts
- Bills, installments, recurring payments
- Shopping list + receipt OCR
- AI finance mentor
- Shared wallets, debt book, bill splitting
- Offline queue with automatic sync
- Turkish and English

## Graphics checklist

| Asset | Size | Notes |
|-------|------|-------|
| App icon | 512×512 PNG | Teal `#00D4AA` on dark `#06080F` |
| Feature graphic | 1024×500 PNG | TalkCash logo + tagline |
| Phone screenshots | 1080×1920 min | Home, transactions, voice input, agenda |
| 7-inch tablet | Optional | Same flows |

Generate screenshots from real device: `cd mobile && npx expo start`, capture after login.

## Release checklist

1. **Backend production**
   ```bash
   ./scripts/setup-fly-prod.sh
   # Set REDIS_URL, OPENAI_API_KEY, S3_*, ALLOWED_ORIGINS
   ./scripts/deploy-production.sh
   ```

2. **Production build**
   ```bash
   cd mobile && eas build --profile production --platform android
   ```

3. **Submit**
   ```bash
   ./scripts/submit-play-store.sh
   ```
   Or GitHub Actions → **EAS Submit** → platform `android`

4. **Play Console**
   - Content rating questionnaire
   - Data safety form (financial data, location optional)
   - Internal testing → add testers → promote to production

## Required GitHub secrets / variables

| Name | Purpose |
|------|---------|
| `EXPO_TOKEN` | EAS build/submit |
| `EAS_PROJECT_ID` | Expo project UUID |
| `FLY_API_TOKEN` | Production deploy |
| Google Play service account JSON | Upload to Play (EAS credentials) |

Configure Play service account in Expo: `eas credentials` → Android → Google Service Account.

## Privacy policy URL

Host `docs/PRIVACY.md` on GitHub Pages or your domain before public release.
