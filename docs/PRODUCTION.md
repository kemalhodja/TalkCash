# TalkCash Production Launch

Staging kurulumu tamamlandıktan sonra mağaza yayını için bu sırayı izleyin.

## 1. Backend (Fly.io)

```bash
./scripts/setup-fly-staging.sh      # ilk kurulum (bir kez)
./scripts/preflight-staging.sh      # deploy öncesi kontrol
./scripts/deploy-staging.sh         # deploy + smoke test
```

GitHub Actions ile otomatik deploy için repository secret:

| Secret | Nasıl alınır |
|--------|----------------|
| `FLY_API_TOKEN` | `fly tokens create deploy` |

`main` branch'e backend değişikliği push edildiğinde **Deploy Staging (Fly.io)** workflow'u deploy + smoke test çalıştırır.

### Zorunlu Fly secrets

- `SECRET_KEY`, `DATABASE_URL`
- `REDIS_URL` (degraded moddan kaçınmak için)
- `OPENAI_API_KEY` (sesli komut / NLP)
- `S3_ENABLED=true` + R2/S3 credentials (fiş görselleri)

---

## 2. Mobil (EAS Build)

### Repository değişkenleri (GitHub → Settings → Variables)

| Variable | Örnek |
|----------|-------|
| `EXPO_PUBLIC_API_URL` | `https://talkcash-api.fly.dev/api/v1` |
| `EAS_PROJECT_ID` | Expo dashboard project UUID |

### Repository secret

| Secret | Nasıl alınır |
|--------|----------------|
| `EXPO_TOKEN` | [expo.dev](https://expo.dev) → Access Tokens |

### Build komutları

```bash
cd mobile
npm install

# Internal test (APK)
eas build --profile preview --platform android

# Store release
eas build --profile production --platform all
```

GitHub Actions: **EAS Build** → profile `production`, platform `android` / `ios` / `all`

### Production profile (`eas.json`)

- `EXPO_PUBLIC_API_URL` → staging/production API HTTPS URL
- `autoIncrement: true` → build number otomatik artar
- iOS App Store / Google Play submit: `eas submit --profile production`

---

## 3. Yayın öncesi kontrol listesi

### API

- [ ] `./scripts/preflight-staging.sh` geçiyor
- [ ] `API_URL=https://talkcash-api.fly.dev python3 scripts/smoke_test.py` geçiyor
- [ ] `/health` → `status: ok`, `database: true`
- [ ] S3/R2 secret'ları ayarlı

### Mobil

- [ ] `EXPO_PUBLIC_API_URL` production/staging HTTPS (localhost değil)
- [ ] Kayıt, giriş, harcama, alışveriş, ajanda akışları cihazda test edildi
- [ ] `docs/SMOKE_TEST.md` fiziksel cihaz checklist'i tamamlandı
- [ ] iOS: App Store Connect bundle `io.talkcash.app`
- [ ] Android: package `io.talkcash.app`

### Güvenlik

- [ ] `SECRET_KEY` varsayılan değil
- [ ] API anahtarları sadece sunucuda
- [ ] CORS production domain'e kısıtlandı (opsiyonel, önerilir)

---

## 4. Sorun giderme

| Belirti | Çözüm |
|---------|-------|
| EAS build `EXPO_PUBLIC_API_URL` hatası | GitHub variable ayarla |
| Smoke test register 500 | `alembic upgrade head` + enum migration (PR #9) |
| Fiş görselleri kayboluyor | S3/R2 secrets kontrol et |
| Cihaz API'ye ulaşamıyor | HTTPS URL + firewall; localhost kullanma |
