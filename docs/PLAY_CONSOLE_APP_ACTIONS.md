# Google Play Console — App Actions Yayın Rehberi

TalkCash Android uygulaması `shortcuts.xml` içinde Google Assistant **App Actions** capability'lerini tanımlar. Tam sesli komut desteği için uygulamanın Play Console'a yüklenmesi gerekir.

## Tanımlı capability'ler

| BII | Kullanım | Örnek komut |
|-----|----------|-------------|
| `actions.intent.CREATE_MONEY_TRANSFER` | Harcama | "Hey Google, TalkCash'te 150 lira kahve harcaması ekle" |
| `actions.intent.CREATE_ITEM_LIST` | Alışveriş listesi | "Hey Google, TalkCash listesine süt ekle" |
| `actions.intent.UPDATE_ITEM_LIST` | Listeye ürün ekleme | "Hey Google, TalkCash'e ekmek ekle" |
| `actions.intent.OPEN_APP_FEATURE` | Gelir / fatura | "Hey Google, TalkCash'te gelir ekle" |

Kaynak dosyalar:
- `mobile/plugins/withAssistant.js` → `shortcuts.xml` üretir
- `mobile/config/assistantShortcuts.js` → kısayol tanımları
- `mobile/services/googleAssistant.ts` → parametre → NLP metni

---

## Önkoşullar

1. **Development build** veya **production APK/AAB** (Expo Go çalışmaz)
2. Google Play Console geliştirici hesabı
3. Uygulama paket adı: `io.talkcash.app`
4. Deep link scheme: `talkcash://command`

---

## Adım 1: Production build

```bash
cd mobile
npx eas login
npx eas init
eas build --profile production --platform android
```

`eas.json` production profili `autoIncrement` ile versionCode artırır.

---

## Adım 2: Play Console'a yükleme

1. [Google Play Console](https://play.google.com/console) → **Create app**
2. App name: **TalkCash**
3. **Internal testing** track'e ilk AAB yükleyin (hızlı doğrulama için)
4. Store listing, privacy policy URL, content rating tamamlayın

Minimum gereksinimler:
- Uygulama simgesi (512×512)
- Feature graphic (1024×500)
- Gizlilik politikası URL'si
- Finans kategorisi için veri güvenliği formu

---

## Adım 3: App Actions doğrulama

### 3a. Deep link test (adb)

Build yüklendikten sonra:

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "talkcash://command?text=150%20TL%20kahve%20banka&source=google"
```

Uygulama açılmalı ve komut onay ekranı gelmeli.

### 3b. App Actions test aracı

1. Play Console → uygulamanız → **Grow** → **App Actions**
2. İlk yüklemeden sonra 24–72 saat içinde `shortcuts.xml` indekslenir
3. [App Actions test tool](https://developers.google.com/assistant/app/test-tool) ile BII test edin

Test sorguları (TR):
- `TalkCash'te harcama ekle`
- `TalkCash listesine süt ekle`
- `TalkCash'te fatura ödedim`

### 3c. Statik kısayollar

Ana ekranda TalkCash simgesine **uzun basın** → 4 kısayol görünmeli:
- Harcama Ekle
- Gelir Ekle
- Listeye Ekle
- Fatura Ödedim

---

## Adım 4: Internal test → Production

1. **Internal testing** → test kullanıcıları ekleyin (Gmail listesi)
2. Test kullanıcıları Assistant ile komutları dener
3. Sorun yoksa **Closed testing** → **Production** rollout

App Actions production'da yayına girince Google Assistant tüm kullanıcılara önerebilir.

---

## Sık karşılaşılan sorunlar

| Sorun | Çözüm |
|-------|-------|
| Assistant sadece uygulamayı açar, komutu işlemez | Play Console'a en az internal track yükleyin; `shortcuts.xml` indekslensin |
| Kısayollar uzun basınca görünmüyor | `npx expo prebuild` + production build; `android.app.shortcuts` meta-data kontrol edin |
| Deep link çalışmıyor | `app.json` `intentFilters` ve `talkcash://command` scheme doğrulayın |
| Türkçe komut tanınmıyor | Cihaz dili TR; Google hesabı Assistant dili TR olmalı |
| NLP hata veriyor | `OPENAI_API_KEY` backend'de tanımlı; mobil `EXPO_PUBLIC_API_URL` staging/production URL |

---

## İlgili dosyalar

```
mobile/
├── plugins/withAssistant.js      # shortcuts.xml + strings
├── config/assistantShortcuts.js
├── services/googleAssistant.ts
├── services/assistant.ts
└── app.json                      # intentFilters
```

---

## Faydalı linkler

- [App Actions overview](https://developer.android.com/develop/devices/assistant/overview)
- [Create shortcuts.xml](https://developer.android.com/develop/devices/assistant/action-schema)
- [Built-in intents reference](https://developer.android.com/reference/app-actions/built-in-intents)
- [Expo EAS Submit](https://docs.expo.dev/submit/introduction/)
