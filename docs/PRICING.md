# TalkCash — Global Fiyatlandırma

Son güncelleme: Haziran 2026  
**Pazar:** Global (Google Play + gelecekte CN/RU alternatif mağazalar)  
**Ankor:** USD · **Tüm fiyatlar vergi dahil (brüt)**

Makine okunabilir bölgesel tablo: `mobile/store/regional-pricing.json`

---

## 1. Resmi fiyatlar (steady-state, vergi dahil)

### Aylık

| Plan | USD | EUR | GBP | TRY |
|------|-----|-----|-----|-----|
| **Free** | $0 | €0 | £0 | ₺0 |
| **Pro** | **$8,99** | **€8,99** | **£7,99** | **₺89,99** |
| **Family** | **$14,99** | **€14,99** | **£12,99** | **₺149,99** |
| **Business** | **$24,99** | **€24,99** | **£21,99** | **₺249,99** |

### Yıllık (~%25 indirim)

| Plan | USD/yıl | EUR/yıl | GBP/yıl | TRY/yıl |
|------|---------|---------|---------|---------|
| **Pro** | **$79,99** | **€79,99** | **£69,99** | **₺749,99** |
| **Family** | **$134,99** | **€134,99** | **£119,99** | **₺1.299,99** |
| **Business** | **$224,99** | **€224,99** | **£199,99** | **₺1.999,99** |

### Google Play SKU (6 adet)

```
talkcash_pro_monthly      talkcash_pro_yearly
talkcash_family_monthly   talkcash_family_yearly
talkcash_business_monthly talkcash_business_yearly
```

**Lansman önceliği:** Pro + Family (Business v1.3)

---

## 2. Nüfus yoğun ülkeler — bölgesel fiyat (PPP, vergi dahil)

| Ülke | Kod | Play | Pro/ay | Pro/yıl | Not |
|------|-----|------|--------|---------|-----|
| Hindistan | IN | ✅ | ₹399 | ₹3.499 | PPP |
| Çin (anakara) | CN | ❌ | ¥38 | ¥328 | AppGallery gelecek |
| ABD | US | ✅ | $8,99 | $79,99 | Ankor |
| Endonezya | ID | ✅ | Rp69.000 | Rp599.000 | PPP |
| Pakistan | PK | ✅ | ₨699 | ₨5.999 | PPP |
| Brezilya | BR | ✅ | R$24,90 | R$219,90 | PPP |
| Nijerya | NG | ✅ | ₦3.999 | ₦34.999 | PPP |
| Bangladeş | BD | ✅ | ৳499 | ৳4.299 | PPP |
| Rusya | RU | ⚠️ | ₽449 | ₽3.990 | Play billing kısıtlı → RuStore |
| Meksika | MX | ✅ | MX$129 | MX$1.099 | |
| Filipinler | PH | ✅ | ₱249 | ₱2.199 | |
| Vietnam | VN | ✅ | ₫99.000 | ₫849.000 | |
| Türkiye | TR | ✅ | ₺89,99 | ₺749,99 | |
| Mısır | EG | ✅ | E£149,99 | E£1.299,99 | |
| Japonya | JP | ✅ | ¥1.200 | ¥10.800 | |

Tam liste: `mobile/store/regional-pricing.json`

### Play Console — ülke dağıtımı

**Monetize → Subscriptions → [SKU] → Base plan → Countries**

Önerilen ilk dalga (30 ülke): `regional-pricing.json` → `play_console_countries_recommended`

---

## 3. Çin & Rusya — özel not

| Ülke | Google Play | Önerilen kanal |
|------|-------------|----------------|
| **Çin** | Yok (anakara) | Huawei AppGallery, Xiaomi GetApps, OPPO/vivo |
| **Rusya** | Billing kısıtlı | RuStore, doğrudan APK + yerel ödeme (gelecek) |

Fiyat referansları `regional-pricing.json` içinde — Play dışı mağazalar için aynı PPP mantığı.

---

## 4. Promosyonlar (ilk 90 gün)

| Teklif | US | TR |
|--------|----|----|
| 7 gün ücretsiz deneme | ✅ | ✅ |
| Pro intro (ilk ay) | $4,99 | ₺39,99 |
| Paywall varsayılan | **Yıllık** | **Yıllık** |

---

## 5. Free plan limitleri (güncel)

| Özellik | Free |
|---------|------|
| AI koç | 15/ay |
| Sesli harcama kaydı | **3/ay** |
| Fiş OCR | 5/ay |
| Swap önerisi | 3/gün |

---

## 6. Vergi

Tüm liste fiyatları **KDV/VAT dahil (brüt)**. Play Console’a brüt gir.

| Bölge | Not |
|-------|-----|
| TR | %20 KDV dahil |
| AB | Ülke VAT dahil |
| ABD | Eyalet vergisi checkout’ta eklenebilir |

---

## 7. Kod durumu

| Öğe | Durum |
|-----|--------|
| 6 SKU (aylık + yıllık) | ✅ Kod |
| Paywall yıllık/aylık | ✅ |
| Bölgesel JSON | ✅ |
| Play Console fiyat girişi | ❌ Manuel |
| CN/RU mağaza | ❌ Gelecek |

Detay: [GOOGLE_PLAY_SUBSCRIPTIONS.md](GOOGLE_PLAY_SUBSCRIPTIONS.md) · [PLAY_STORE_REGIONS.md](PLAY_STORE_REGIONS.md)
