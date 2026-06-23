# TalkCash — Gradle ile AAB (EAS Build yok)

## Özet

Production AAB artık **doğrudan Gradle** ile üretilir. EAS kotası gerekmez.

| | Eski (EAS) | Yeni (Gradle) |
|---|-----------|---------------|
| Derleme | `eas build` | `./gradlew bundleRelease` |
| Kota | Aylık limit | **Yok** |
| CI | EAS sunucusu | GitHub Actions (ücretsiz) |

---

## 1. Keystore (bir kez — EAS'ten indir)

Play'deki mevcut sürüm EAS keystore ile imzalı. **Aynı keystore şart.**

```powershell
cd mobile
npx eas-cli credentials -p android
```

Menü: **production** → **Keystore** → **Download**

İndirilen `.jks` dosyasını şuraya koy:

```
mobile/android/app/release.keystore
```

`mobile/android/keystore.properties` oluştur (`keystore.properties.example` kopyala):

```properties
storeFile=release.keystore
storePassword=...
keyAlias=...
keyPassword=...
```

> `keystore.properties` ve `release.keystore` asla git'e eklenmez.

---

## 2. Yerel derleme (Windows)

```powershell
.\scripts\build-aab-gradle.ps1
```

Çıktı: `dist\talkcash-prod.aab`

**Defender sorunu varsa** Docker:

```powershell
.\scripts\build-aab-docker.ps1
```

---

## 3. GitHub Actions (önerilen)

Repo → **Settings → Secrets → Actions**:

| Secret | Değer |
|--------|-------|
| `ANDROID_KEYSTORE_BASE64` | `certutil -encode release.keystore tmp.b64` → içeriği (header/footer olmadan) |
| `ANDROID_KEYSTORE_PASSWORD` | store şifresi |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key şifresi |

**Actions → Android AAB (Gradle — No EAS) → Run workflow**

Artifact: `talkcash-production-aab`

---

## 4. Play Console'a yükle

1. [Play Console](https://play.google.com/console) → TalkCash → Internal testing
2. **Create new release** → `talkcash-prod.aab` yükle
3. versionCode **24**, versionName **1.2.1**

---

## Sürüm numarası

`mobile/android/app/build.gradle` içinde:

- `versionCode` — her Play yüklemesinde +1
- `versionName` — `app.json` ile aynı tutun (şu an **1.2.1**)

Son başarılı Play build: **versionCode 19** (v1.2.0). Yeni build: **24**.
