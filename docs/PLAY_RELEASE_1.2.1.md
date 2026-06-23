# TalkCash — Google Play sürüm yükleme (1.2.1)

## Durum

| Alan | Değer |
|------|-------|
| versionName | **1.2.1** (`mobile/app.json`) |
| versionCode (EAS) | **21** (uzakta artırıldı, AAB henüz yok) |
| Son başarılı AAB | **#19** — v1.2.0 |
| API | https://talkcash-api-prod.onrender.com/api/v1 |

## Engel: EAS ücretsiz kota

Expo hesabı (`muallim35`) bu ay Android build kotasını doldurdu. Kota **1 Temmuz 2026** civarında sıfırlanır.

Yerel Gradle derlemesi Windows Defender / dosya kilidi nedeniyle başarısız (`Could not move temporary workspace`).

## Seçenek A — EAS kotası açılınca (önerilen)

```powershell
cd mobile
$env:EAS_PROJECT_ID = "d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
npx eas-cli build --profile production --platform android --non-interactive --wait
```

AAB indir:

```powershell
npx eas-cli build:download --platform android --latest --output ..\dist\talkcash-1.2.1.aab
```

## Seçenek B — GitHub Actions

1. GitHub → **Actions** → **EAS Build** → **Run workflow**
2. Platform: `android`, Profile: `production`
3. `EXPO_TOKEN` ve `EAS_PROJECT_ID` repo secrets/variables gerekli

## Seçenek C — Play Console manuel yükleme

1. [Play Console](https://play.google.com/console) → **TalkCash** → **Testing** → **Internal testing**
2. **Create new release**
3. **App bundle** yükle (`talkcash-1.2.1.aab`)
4. Release notes (TR):

   ```
   - PIN'i kaldırma (Ayarlar)
   - Beni hatırla
   - Şifre göster/gizle
   - Giriş ve kilit ekranı iyileştirmeleri
   ```

5. **Review release** → **Start rollout to Internal testing**

## Seçenek D — Yerel derleme (Defender hariç tutma)

Windows Güvenlik → Virüs ve tehdit koruması → **Ayarlar** → **Dışlamalar**:

- `C:\GradleHome`
- `C:\TalkCashBuild`
- `%LOCALAPPDATA%\TalkCashGradle`
- `%LOCALAPPDATA%\Android\Sdk`

Sonra:

```powershell
.\scripts\launch-android.ps1
# veya release AAB:
cd C:\TalkCashBuild\mobile\android
$env:GRADLE_USER_HOME = "C:\GradleHome"
.\gradlew.bat bundleRelease
```

**Not:** Yerel release AAB, Play’e yüklemek için EAS üretim keystore gerekir (`eas credentials`). Debug imzası mevcut sürümü güncelleyemez.

## Play Console kontrol listesi

- [ ] Privacy policy: https://talkcash-api-prod.onrender.com/privacy
- [ ] 30 ülke fiyatlandırması (`docs/PRICING.md`, `mobile/store/regional-pricing.json`)
- [ ] Data safety formu
- [ ] Ekran görüntüleri
- [ ] Abonelik SKU’ları (6 adet)

## EAS Submit (Service Account varsa)

```powershell
$env:EAS_PROJECT_ID = "d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
.\scripts\submit-play-store.ps1 -SubmitOnly
```

Google Play Service Account JSON olmadan `eas submit` çalışmaz; AAB’yi konsoldan manuel yükleyin.
