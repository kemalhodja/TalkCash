# TalkCash — Google Play Yayın Rehberi

Bu rehber **internal test → closed test → production** sırasını adım adım anlatır.

**Paket adı:** `io.talkcash.app`  
**API (production):** `https://talkcash-api-prod.onrender.com/api/v1`  
**Gizlilik:** `https://talkcash-api-prod.onrender.com/privacy`  
**Kullanım şartları:** `https://talkcash-api-prod.onrender.com/terms`  
**Destek:** `support@talkcash.io`

---

## 0. Ön kontrol (yerel)

```powershell
# Windows
.\scripts\preflight-play-store.ps1

# veya tüm testler
.\scripts\run-all-tests.ps1
```

Backend production hazır olmalı:

```bash
./scripts/preflight-production.sh
./scripts/deploy-production.sh
API_URL=https://talkcash-api-prod.onrender.com python3 scripts/smoke_test.py
```

Fly production’da migration:

```bash
fly ssh console -a talkcash-api-prod -C "alembic upgrade head"
```

---

## 1. Play Console — Uygulama oluştur

1. [Google Play Console](https://play.google.com/console) → **Create app**
2. **App name:** TalkCash
3. **Default language:** Turkish (Türkiye) — English (United States) ekleyin
4. **App or game:** App · **Finance**
5. Developer Program Policies → onaylayın

---

## 2. Store listing (Mağaza girişi)

**Grow → Store presence → Main store listing**

Metinleri buradan kopyalayın: [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md)

| Alan | TR | EN |
|------|----|----|
| Short description (80) | Harcama sonrası mikro tasarruf ve yatırım koçu | Micro-savings coach after every spend |
| Full description | PLAY_STORE_LISTING.md → tr-TR | en-US |
| App icon | `mobile/assets/icon.png` (512×512) | aynı |
| Feature graphic | 1024×500 PNG (logo + tagline) | — |
| Phone screenshots | min 2, önerilen 8 | Ana sayfa hero, Input, Swap nudge, Insights |

**Screenshot önerilen akış:** Ana sayfa → Harcama gir → Akıllı tasarruf kartı → Analiz → Ayarlar

---

## 3. Abonelikler (Google Play Billing)

Detay: [GOOGLE_PLAY_SUBSCRIPTIONS.md](GOOGLE_PLAY_SUBSCRIPTIONS.md)

Play Console → **Monetize → Subscriptions → Create subscription**

| Product ID | Plan | Önerilen fiyat (TRY) |
|------------|------|----------------------|
| `talkcash_pro_monthly` | Pro | ₺99,99 / ay |
| `talkcash_family_monthly` | Family | ₺169,99 / ay |
| `talkcash_business_monthly` | Business | ₺299,99 / ay |

Her SKU için **Base plan → Monthly → Auto-renewing** oluşturun. Product ID’ler kod ile birebir eşleşmeli (`mobile/services/storeBilling.ts`).

Backend Fly secrets:

```bash
fly secrets set GOOGLE_PLAY_PACKAGE_NAME=io.talkcash.app -a talkcash-api-prod
fly secrets set GOOGLE_PLAY_VERIFY_MOCK=false -a talkcash-api-prod
# Service account JSON (tek satır veya dosya)
fly secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='...' -a talkcash-api-prod
fly secrets set GOOGLE_RTDN_WEBHOOK_SECRET='...' -a talkcash-api-prod
```

RTDN: Play Console → Monetize → Monetization setup → Real-time developer notifications →  
URL: `https://talkcash-api-prod.onrender.com/api/v1/billing/google/rtdn`

---

## 4. Data safety (Veri güvenliği)

Form cevapları: [GOOGLE_PLAY_DATA_SAFETY.md](GOOGLE_PLAY_DATA_SAFETY.md)

Özet: finansal veri, e-posta, ses (isteğe bağlı), konum (isteğe bağlı), fiş fotoğrafı toplanır; hesap silme uygulama içinden yapılır.

---

## 5. Content rating (İçerik derecelendirme)

Play Console → **Policy → App content → Content rating**

IARC anketi — TalkCash için tipik cevaplar:

| Soru | Cevap |
|------|--------|
| Kategori | Utility / Productivity veya Finance |
| Şiddet, cinsellik, uyuşturucu | Hayır |
| Kullanıcı etkileşimi / paylaşım | Sınırlı (hesap, destek e-postası) |
| Konum | Evet, isteğe bağlı (market hatırlatıcı) |
| Finansal bilgi | Evet — kişisel bütçe takibi |

Beklenen sonuç: **Everyone / PEGI 3** benzeri düşük derece.

---

## 6. App content — Diğer formlar

| Form | Durum |
|------|--------|
| Privacy policy URL | `https://talkcash-api-prod.onrender.com/privacy` |
| Ads | No ads |
| Target audience | 18+ (finans uygulaması) |
| News app | No |
| COVID / Health | No |
| Data safety | Bölüm 4 |
| Financial features | **Yes** — personal finance management (not banking/broker) |
| Account deletion | Settings → Account → Delete Account |

**Financial features declaration:** TalkCash broker değildir; harici yatırım uygulamalarına deep link verir. Regüle menkul kıymet işlemi yapmaz.

---

## 7. EAS build + Play yükleme

### Gerekli ortam değişkenleri

```powershell
$env:EXPO_TOKEN = "<expo-access-token>"
$env:EAS_PROJECT_ID = "d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
```

### Production AAB build

```powershell
cd mobile
npx eas-cli build --profile production --platform android --non-interactive
```

veya:

```powershell
.\scripts\submit-play-store.ps1 -BuildOnly
```

### Play Console’a submit (internal track)

1. Expo’da **Google Service Account** bağlayın: `eas credentials` → Android → Google Service Account
2. Submit:

```powershell
.\scripts\submit-play-store.ps1
```

GitHub Actions: **EAS Submit** workflow → platform `android`

---

## 8. Internal testing

1. Play Console → **Testing → Internal testing**
2. Testers listesine Google hesapları ekleyin
3. Yüklenen sürümü **Review and roll out**
4. Opt-in linkini test cihazına gönderin

### Cihaz smoke (yükleme sonrası)

- [ ] Kayıt / giriş
- [ ] Örnek veri yükle (Ayarlar)
- [ ] Kahve harcaması → swap nudge + round-up
- [ ] Akıllı tasarruf transferi
- [ ] Analiz sekmesi (free: hero + broker)
- [ ] Pro paywall görünür
- [ ] (Opsiyonel) Gerçek abonelik satın alma — license tester

---

## 9. Production’a geçiş

Internal test yeşil → **Closed testing** (opsiyonel) → **Production**

`eas.json` submit track’i değiştirmek için:

```json
"submit": {
  "production": { "android": { "track": "production" } }
}
```

---

## Hızlı komut özeti

```powershell
.\scripts\preflight-play-store.ps1
.\scripts\submit-play-store.ps1 -BuildOnly    # sadece AAB
.\scripts\submit-play-store.ps1               # build + submit internal
```

---

## İlgili dosyalar

- [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md) — mağaza metinleri
- [GOOGLE_PLAY_DATA_SAFETY.md](GOOGLE_PLAY_DATA_SAFETY.md) — veri güvenliği formu
- [GOOGLE_PLAY_SUBSCRIPTIONS.md](GOOGLE_PLAY_SUBSCRIPTIONS.md) — SKU kurulumu
- [SETUP_RELEASE.md](SETUP_RELEASE.md) — GitHub / Fly / EAS secrets
- [PRIVACY.md](PRIVACY.md) · [TERMS.md](TERMS.md)
