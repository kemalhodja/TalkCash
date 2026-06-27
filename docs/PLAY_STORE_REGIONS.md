# TalkCash — Play Store bölgesel dağıtım

Global uygulama için ülke listesi, PPP fiyatları ve Play dışı pazarlar.

**Veri kaynağı:** `mobile/store/regional-pricing.json`  
**Fiyat özeti:** [PRICING.md](PRICING.md)

---

## Google Play — ilk dalga (30 ülke)

Play Console → Subscription → Countries/regions → **Add all**, sonra PPP ayarı:

```
US CA GB DE FR ES IT NL PL TR
IN BR MX ID PK NG BD PH VN EG JP
AU ZA SA AE AR CO CL MY TH KR
```

Her SKU için **2 base plan**: `monthly` (P1M) + `yearly` (P1Y).

---

## Nüfus sıralaması — öncelik

| Sıra | Ülke | Nüfus ~ | Play | Pro/ay (brüt) |
|------|------|---------|------|---------------|
| 1 | Hindistan | 1,4B | ✅ | ₹399 |
| 2 | Çin | 1,4B | ❌ | ¥38 (AppGallery) |
| 3 | ABD | 335M | ✅ | $8,99 |
| 4 | Endonezya | 280M | ✅ | Rp69.000 |
| 5 | Pakistan | 240M | ✅ | ₨699 |
| 6 | Nijerya | 230M | ✅ | ₦3.999 |
| 7 | Brezilya | 215M | ✅ | R$24,90 |
| 8 | Bangladeş | 175M | ✅ | ৳499 |
| 9 | Rusya | 145M | ⚠️ | ₽449 (RuStore) |
| 10 | Meksika | 130M | ✅ | MX$129 |
| 11 | Japonya | 125M | ✅ | ¥1.200 |
| 12 | Filipinler | 115M | ✅ | ₱249 |
| 13 | Mısır | 110M | ✅ | E£149,99 |
| 14 | Vietnam | 100M | ✅ | ₫99.000 |
| 15 | Türkiye | 85M | ✅ | ₺89,99 |

---

## Çin (CN)

- **Google Play:** Anakara’da yok
- **Fiyat (referans):** Pro ¥38/ay, ¥328/yıl (vergi dahil)
- **Gelecek kanallar:** Huawei AppGallery, Xiaomi GetApps
- **Not:** Ayrı APK + yerel ödeme (WeChat/Alipay) gerekir

---

## Rusya (RU)

- **Google Play:** Billing büyük ölçüde devre dışı (2022+)
- **Fiyat (referans):** Pro ₽449/ay, ₽3.990/yıl
- **Gelecek kanal:** RuStore
- **Not:** Play SKU oluşturulabilir ama tahsilat beklenmez

---

## Play Console kurulum checklist

1. [ ] 6 SKU oluştur (3 plan × 2 period)
2. [ ] 30 ülke fiyatlandır (`regional-pricing.json`)
3. [ ] 7 gün free trial (Pro + Family)
4. [ ] Intro offer: US $4,99 / TR ₺39,99 (90 gün)
5. [ ] Tax: tax-inclusive (TR/AB)
6. [ ] License testers ekle
7. [ ] RTDN webhook → Render prod

---

## iOS (gelecek)

App Store Connect’te **aynı fiyat tier** + ülke matrisi; SKU isimleri farklı olacak (`io.talkcash.app.pro.monthly` vb.).
