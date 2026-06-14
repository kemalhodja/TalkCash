# TalkCash Smoke Test Checklist

Deploy sonrası ve mağaza yayını öncesi bu listeyi takip edin.

## Otomatik API testi

```bash
# Tam doğrulama (test + smoke)
./scripts/verify-release.sh

# Sadece API smoke
python3 scripts/smoke_test.py

# Staging
API_URL=https://talkcash-api.fly.dev python3 scripts/smoke_test.py
```

Deploy script'i smoke test'i otomatik çalıştırır: `./scripts/deploy-staging.sh`

---

## Fiziksel cihaz (15 dk)

### Kurulum
- [ ] `mobile/.env` → `EXPO_PUBLIC_API_URL=https://talkcash-api.fly.dev/api/v1`
- [ ] EAS preview APK veya `npx expo start` + LAN IP
- [ ] Kayıt / giriş / PIN oluştur

### Temel akışlar
- [ ] Ana sayfa: net varlık ve kasalar yükleniyor
- [ ] Giriş sekmesi: `150 kahve banka` → onay → işlem kaydı
- [ ] İşlemler sekmesi: yeni harcama görünüyor
- [ ] Alışveriş: ürün ekle → satın al → kasadan düş
- [ ] Ajanda: fatura ekle → öde
- [ ] Bütçe: limit aşım uyarısı (varsa)
- [ ] Ayarlar: dil EN ↔ TR değişimi
- [ ] PDF export paylaşımı açılıyor

### Asistan (native build gerekir)
- [ ] Siri kısayolu → TalkCash açılıyor → harcama kaydı
- [ ] Google App Action deep link (Android)

### Çevrimdışı
- [ ] Uçak modu → harcama ekle → "çevrimdışı kuyruk" mesajı
- [ ] Bağlantı gelince Ayarlar → Senkronize
- [ ] Zincirli sync: yeni kasa oluştur → gelir ekle (tek batch'te ID eşleşmesi)
- [ ] Alışveriş çakışması: sunucuda tamamlanmış ürün → sync çakışma diyaloğu → sunucuyu koru
- [ ] Bekleyen işlem varken çıkış → uyarı diyaloğu
- [ ] 401 oturum süresi dolunca kuyruk korunuyor (yeniden giriş → sync)

### Otomatik offline E2E

```bash
# Backend: zincir sync, bütçe pull, alışveriş çakışması
cd backend && python3 -m pytest tests/e2e/test_offline_sync.py -q

# Mobil: flushQueue ID remap + ağ hatasında kuyruk koruma
cd mobile && npm test -- --testPathPattern=offlineIntegration

# API smoke (wallet_create + wallet_income zinciri + sync/pull budgets)
python3 scripts/smoke_test.py
```

### Play Store öncesi

```bash
./scripts/release.sh --checklist   # tüm testler + verify-release
./scripts/release.sh --production  # Fly prod + EAS AAB
./scripts/release.sh --submit-play # Play Console yükleme
```

### Fiş (S3 açık olmalı)
- [ ] Fiş tara → görsel Fiş Arşivi'nde görünüyor
- [ ] Uygulama yeniden başlat → görsel hâlâ erişilebilir

---

## Fly.io secret kontrolü

```bash
fly secrets list -a talkcash-api
```

Beklenen: `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `S3_ENABLED`, `S3_*`

---

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Smoke test `execute` fail | Wallet seed / DB migration |
| Fiş görseli 404 | S3 secret'ları + `S3_ENABLED=true` |
| Mobil API timeout | `EXPO_PUBLIC_API_URL` HTTPS staging URL |
| `degraded` health | Redis URL kontrol (opsiyonel) |
