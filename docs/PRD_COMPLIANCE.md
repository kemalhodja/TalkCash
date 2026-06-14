# TalkCash — PRD Uyumluluk Matrisi

Durum: **Tam** · **Kısmi** · **Eksik**

Son güncelleme: PR #21 — plan eksikleri (ship readiness + UX).

---

## Kapatılan maddeler (PR #21)

| Alan | Özellik | Durum |
|------|---------|--------|
| Ship | JWT refresh token + rotation | **Tam** — `POST /auth/refresh`, 60dk access / 30g refresh |
| Ship | Hesap silme (GDPR) | **Tam** — `DELETE /auth/me` + Ayarlar UI |
| Ship | İşlem düzenle/sil | **Tam** — `PATCH/DELETE /transactions/{id}` |
| Ship | WS auth (query token kaldırıldı) | **Tam** — ilk mesaj `{ action: "auth", token }` |
| Ship | Prod/staging API ayrımı | **Tam** — `EXPO_PUBLIC_APP_ENV`, EAS production URL |
| UX | Bildirim deep link | **Tam** — metadata + push `data.url` + tap navigation |
| UX | Onboarding wizard | **Tam** — hoş geldin + push + PIN yönlendirme |
| UX | Ayarlarda PIN/şifre değiştir | **Tam** — `PUT /auth/pin`, `PUT /auth/password` |
| UX | Borç CRUD | **Kısmi** — düzenle/sil + borrowed UI; settle mevcut |
| UX | Offline kuyruk genişletme | **Kısmi** — transaction update/delete kuyruğu |

---

## Kalan iyileştirmeler

- Tam offline-first: wallet/agenda CRUD kuyruğu, tüm ekranlar
- LLM sohbet mentoru
- Play Store production deploy (`talkcash-api-prod.fly.dev` kurulumu)
- Shared wallet admin CRUD (üye ekle/çıkar, rename)

---

## Yeni API özeti

```
POST   /auth/refresh           Token yenile
POST   /auth/logout            Refresh token iptal
PUT    /auth/password          Şifre değiştir
PUT    /auth/pin               PIN değiştir (mevcut PIN gerekli)
DELETE /auth/me                Hesap sil (şifre gerekli)
PATCH  /transactions/{id}      İşlem düzenle
DELETE /transactions/{id}      İşlem sil
PATCH  /social/debts/{id}      Borç düzenle
DELETE /social/debts/{id}      Borç sil
```

Migration: `005_plan_gaps.py` (refresh_tokens, notifications.metadata_json)
