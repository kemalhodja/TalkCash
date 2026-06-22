# TalkCash — Google Play Store Listing

Play Console → **TalkCash** (`io.talkcash.app`) → **Main store listing**

## App details

| Field | Türkçe (tr-TR) | English (en-US) |
|-------|----------------|-----------------|
| **App name** | TalkCash | TalkCash |
| **Short description** (80 char) | Harcama sonrası mikro tasarruf ve yatırım koçu | Micro-savings coach after every spend |
| **Category** | Finance | Finance |
| **Tags** | budget, micro savings, investment coach, expense tracker | budget, micro savings, investment coach, expense tracker |

## Full description (tr-TR)

TalkCash, sesli komut ve akıllı klavye ile kişisel finansınızı yönetmenizi sağlar — harcama sonrası davranışsal ekonomi ile mikro tasarruf ve yatırım koçluğu sunar.

**Öne çıkanlar**
- **Akıllı tasarruf koçu:** Kahve, yemek siparişi, taksi gibi harcamalarda alternatif öner; tasarrufu Altın/Döviz cüzdanına aktar
- **Yuvarlama tasarrufu:** Harcamaları yuvarlayıp küsuratı yatırım cüzdanına taşı (Pro: otomatik)
- **Portföy koçu (Pro):** Nakit / altın / döviz dağılımı ve 12 aylık projeksiyon
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

TalkCash helps you manage personal finance with voice commands and smart text input — a behavioral micro-savings and micro-investment assistant after every expense.

**Highlights**
- **Smart savings coach:** Suggest cheaper alternatives (coffee, delivery, rides) and move savings to Gold/Forex wallets
- **Round-up savings:** Round expenses and transfer spare change to investment wallets (Pro: automatic)
- **Portfolio coach (Pro):** Cash/gold/forex mix guidance and 12-month projection
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

**Tam rehber:** [GOOGLE_PLAY_RELEASE.md](GOOGLE_PLAY_RELEASE.md)

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
   - Privacy policy URL
   - Support email
   - Internal testing → add testers → upload AAB → roll out to internal testers

## Android internal test checklist

- Package name: `io.talkcash.app`
- Build command: `cd mobile && eas build --profile production --platform android`
- Submit command: `cd mobile && eas submit --profile production --platform android`
- API URL must be HTTPS and reachable from a physical device: `https://talkcash-api-prod.onrender.com/api/v1`
- `EAS_PROJECT_ID` must be set before build; push tokens are skipped when the placeholder project ID is used.
- Google Play service account must be configured in Expo credentials or supplied during `eas submit`.
- Internal testers list must include at least one real Google account before rollout.
- Smoke test after install: register, login, add expense with coffee keyword, confirm swap nudge + round-up transfer, check insights summary.

## Data safety summary

- Financial info: collected, app functionality, linked to user account.
- Personal info: email/name collected for account login, linked to user account.
- Photos/files: receipt images collected only when user uploads/scans receipts.
- Audio: voice command audio is processed when the user starts voice input.
- Location: optional, used only for market reminder/geofencing features.
- App activity/device identifiers: push notification token may be stored for reminders.
- Account deletion: available in Settings → Account → Delete Account; backend deletes receipt images and account data.
- Product analytics: feature usage events are collected for app improvement and reliability.
- Subscription data: premium plan and usage counters are processed for entitlement enforcement.

## Premium positioning

| Plan | Target user | Premium value |
|------|-------------|---------------|
| Free | Personal starter | Core wallets, 3 smart savings nudges/day, round-up |
| Pro | Power user | Unlimited nudges, auto round-up, portfolio coach, advanced insights |
| Family | Household | Shared workspaces, family budgets, richer AI usage |
| Business | Freelancer / small business | Workspace reports, business exports, high limits |

Internal testing can use `POST /api/v1/billing/internal-upgrade` with `X-Internal-Upgrade-Secret` (dev/staging only). Public release uses Google Play Billing via `POST /api/v1/billing/google/verify` and RTDN webhook for subscription sync.

## Google Play Billing (production)

1. Create subscription SKUs in Play Console (Pro / Family / Business).
2. Set `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and `GOOGLE_PLAY_PACKAGE_NAME` on the API.
3. Configure RTDN push to `POST /api/v1/billing/google/rtdn` with `GOOGLE_RTDN_WEBHOOK_SECRET`.
4. Mobile app calls `react-native-iap` → backend verify → premium entitlements unlock.

## Internal test acceptance criteria

- Free user sees paywall for advanced reports and workspace creation.
- Internal upgrade activates Pro/Family/Business without reinstall.
- Insights tab loads cashflow, top categories, budget health, and AI insights for premium users.
- Export PDF/Excel returns 402 for Free and works for premium users.
- OCR and AI usage counters increase after scans and AI insight/chat calls.
- Workspace creation is blocked for Free and available for Family/Business.
- Product analytics records premium paywall and insights screen events.

## Required GitHub secrets / variables

| Name | Purpose |
|------|---------|
| `EXPO_TOKEN` | EAS build/submit |
| `EAS_PROJECT_ID` | Expo project UUID |
| `FLY_API_TOKEN` | Production deploy |
| Google Play service account JSON | Upload to Play (EAS credentials) |

Configure Play service account in Expo: `eas credentials` → Android → Google Service Account.

## Privacy policy URL

Production API serves legal pages at `/privacy` and `/terms` (e.g. `https://talkcash-api-prod.onrender.com/privacy`). Host a custom domain if preferred, then enter that HTTPS URL in Play Console.

## Support email

Use a real monitored address before internal test rollout, for example `support@talkcash.io`, and mirror it in the privacy policy.
