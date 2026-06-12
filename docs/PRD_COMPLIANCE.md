# TalkCash — PRD Uyumluluk Matrisi

Durum: **Tam** · **Kısmi** · **Eksik**

Son güncelleme: PR #19 — kalan PRD maddeleri kapatıldı.

---

## Kapatılan maddeler (PR #19)

| PRD | Özellik | Durum |
|-----|---------|--------|
| 1.3 | OCR satır → alışveriş listesi | **Tam** — `POST /shopping/import-receipt` |
| 2.1 | Kasa düzenle/sil | **Tam** — `PATCH/DELETE /wallets/{id}` |
| 3.1 | Ajanda düzenle/sil + ödenen geçmiş | **Tam** — `PATCH/DELETE /agenda/{id}`, `GET /agenda/history` |
| 4.1 | Alışveriş madde silme | **Tam** — `DELETE /shopping/{id}` |
| 5.2 | Fiyat watchlist + push | **Tam** — `GET/POST/DELETE /ai/watchlist`, scheduler 10:00 |
| 6.1 | Ortak kasa üye muhasebesi | **Tam** — ledger + `GET .../members` |
| 6.2 | Offline-first okuma | **Kısmi** — sync snapshot + transfer/gelir kuyruğu (PR #20) |

---

## Kalan iyileştirmeler (düşük öncelik)

- Tam offline-first: tüm ekranlar + wallet push kuyruğu
- LLM sohbet mentoru
- Fiyat watchlist UI ayrı ekran (dashboard’da mevcut)
- Play Store / production release

---

## API özeti

```
PATCH  /wallets/{id}          Kasa güncelle
DELETE /wallets/{id}          Kasa deaktive et
PATCH  /agenda/{id}           Fatura düzenle
DELETE /agenda/{id}           Fatura sil
GET    /agenda/history        Ödenen geçmiş
POST   /shopping/import-receipt  Fiş → liste
DELETE /shopping/{id}         Liste maddesi sil
GET    /ai/watchlist          Fiyat izleme listesi
POST   /ai/watchlist          Ürün ekle
DELETE /ai/watchlist/{id}     Ürün kaldır
GET    /social/shared-wallet/{id}/members  Üye özeti
POST   /social/shared-wallet/{id}/contribution  Katkı
```

Migration: `004_prd_gaps.py` (paid_at, price_watch_items, shared_wallet_entries)
