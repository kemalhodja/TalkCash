# Android APK — telefona kurulum

TalkCash Play Store'da değil; APK'yı **EAS build** ile üretip telefona kurarsın.

## Hızlı yol (tek komut)

```bash
chmod +x scripts/phone-setup.sh scripts/build-android-apk.sh scripts/download-android-apk.sh

# Backend + health + talimatlar
./scripts/phone-setup.sh

# APK build (LAN IP otomatik) — build bitince dist/ klasörüne indir:
./scripts/build-android-apk.sh --wait --download
```

Sadece son APK'yı indirmek (build daha önce alındıysa):

```bash
./scripts/download-android-apk.sh
# → dist/talkcash-preview.apk
```

Manuel IP:

```bash
API_HOST=192.168.1.42 ./scripts/build-android-apk.sh
```

Staging (internet):

```bash
cd mobile
eas build --profile preview --platform android \
  --env EXPO_PUBLIC_API_URL=https://talkcash-api.fly.dev/api/v1
```

## APK indir ve kur

1. Build bitince: https://expo.dev → **talkcash** → **Builds** → **Download**
2. Linki Android telefonda aç
3. **Bilinmeyen kaynaklardan yükleme** izni ver (Chrome / Dosyalar)
4. APK'yı kur

Bilgisayardan indirmek için:

```bash
cd mobile
eas build:download --platform android --latest
```

## Kurulum sonrası kontrol

Uygulamada **Ayarlar → Sunucu bağlantısı → Bağlantıyı test et**

| Durum | Anlam |
|-------|--------|
| Bağlantı OK | API erişilebilir |
| localhost uyarısı | APK yanlış build edilmiş — bilgisayar IP ile yeniden build |
| Bağlantı yok | Aynı Wi‑Fi, firewall, backend kapalı |

## Sık hatalar

| Sorun | Çözüm |
|-------|--------|
| Network request failed | Telefondan tarayıcıda `http://IP:8000/health` aç |
| localhost in APK | `./scripts/build-android-apk.sh` ile yeniden build |
| Expo Go çalışmıyor | Normal — preview APK kullan |
| IP değişti | Yeni IP ile **yeniden build** (URL APK içinde sabit) |

## Önkoşullar

```bash
npm install -g eas-cli   # veya npx eas
npx eas login
cd mobile && npx eas init   # ilk sefer
```

GitHub Actions: **EAS Build** workflow, profile `preview`, platform `android`  
Gerekli secret: `EXPO_TOKEN`, variable: `EXPO_PUBLIC_API_URL`, `EAS_PROJECT_ID`
