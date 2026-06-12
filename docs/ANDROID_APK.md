# Android APK — telefona kurulum

TalkCash Play Store'da değil; APK'yı **EAS build** ile üretip telefona kurarsın.

## Hızlı yol (tek komut)

```bash
chmod +x scripts/*.sh

# Backend + health + talimatlar
./scripts/phone-setup.sh

# APK build (LAN IP otomatik) — build bitince dist/ klasörüne indir:
./scripts/build-android-apk.sh --wait --download

# USB ile kur (adb gerekir):
./scripts/install-android-adb.sh
```

Sadece son APK'yı indirmek (build daha önce alındıysa):

```bash
./scripts/download-android-apk.sh
# → dist/talkcash-preview.apk
```

Manuel IP:

```bash
API_HOST=192.168.1.42 ./scripts/build-android-apk.sh --wait --download
```

Staging (internet — aynı Wi‑Fi şart değil):

```bash
./scripts/build-android-apk.sh --staging --wait --download
```

## GitHub Actions ile APK

1. Repo **Settings → Secrets**: `EXPO_TOKEN`
2. **Settings → Variables**: `EXPO_PUBLIC_API_URL`, `EAS_PROJECT_ID`
3. **Actions → EAS Build** → platform `android`, profile `preview`
4. Build bitince **Artifacts** → `talkcash-preview-apk` indir

## APK indir ve kur

1. Build bitince: https://expo.dev → **talkcash** → **Builds** → **Download**
2. Linki Android telefonda aç **veya** `dist/talkcash-preview.apk` dosyasını aktar
3. **Bilinmeyen kaynaklardan yükleme** izni ver (Chrome / Dosyalar)
4. APK'yı kur

USB (adb):

```bash
# USB hata ayıklama açık, cihaz bağlı
./scripts/install-android-adb.sh
```

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
| Bağlantı yok | Aynı Wi‑Fi, firewall, backend kapalı — karttaki ipuçlarına bak |

## Sık hatalar

| Sorun | Çözüm |
|-------|--------|
| Network request failed | Telefondan tarayıcıda `http://IP:8000/health` aç |
| localhost in APK | `./scripts/build-android-apk.sh` ile yeniden build |
| Expo Go çalışmıyor | Normal — preview APK kullan |
| IP değişti | Yeni IP ile **yeniden build** (URL APK içinde sabit) |
| eas login hatası | `cd mobile && npx eas login && npx eas init` |

## Önkoşullar

```bash
npm install -g eas-cli   # veya npx eas
npx eas login
cd mobile && npx eas init   # ilk sefer
```

GitHub Actions: **EAS Build** workflow, profile `preview`, platform `android`  
Gerekli secret: `EXPO_TOKEN`, variable: `EXPO_PUBLIC_API_URL`, `EAS_PROJECT_ID`
