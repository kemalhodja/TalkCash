# TalkCash — PRD Uyumluluk Matrisi

Durum: **Tam** · **Kısmi** · **Eksik**

Son güncelleme: PR #21 — roadmap Phase 1–2 tamamlandı.

---

## Kapatılan maddeler (PR #21)

| Alan | Özellik | Durum |
|------|---------|--------|
| Ship | JWT refresh + hesap silme + işlem CRUD | **Tam** |
| Ship | WS auth (first-message) + prod/staging EAS | **Tam** |
| Ship | Production Fly deploy scripts | **Tam** — `fly.prod.toml`, `deploy-production.sh`, CI |
| UX | Onboarding + bildirim deep link + güvenlik ayarları | **Tam** |
| UX | Borç CRUD + borrowed/lent UI | **Tam** |
| UX | Offline kuyruk genişletme | **Kısmi** — wallet/agenda CRUD + transaction ops |
| UX | Shared wallet admin | **Tam** — rename, invite, delete, remove member |
| UX | LLM chat mentor | **Tam** — `POST /ai/chat`, mobil mentor sekmesi |

---

## Kalan iyileştirmeler

- Tam offline-first: optimistic snapshot (shopping add), tüm ekranlar
- Play Store release (EAS submit + listing)
- Production Fly app kurulumu (`./scripts/setup-fly-prod.sh`)
- Shared wallet: ownership transfer

---

## API özeti (yeni)

```
POST   /ai/chat                    LLM mentor sohbet
GET    /ai/chat/history            Sohbet geçmişi
PATCH  /social/shared-wallet/{id}  Ortak kasa yeniden adlandır
POST   /social/shared-wallet/{id}/members  Üye davet
DELETE /social/shared-wallet/{id}/members/{uid}  Üye çıkar
DELETE /social/shared-wallet/{id}  Ortak kasa sil
```

Sync kuyruk tipleri: `wallet_create`, `wallet_update`, `wallet_delete`, `agenda_add_bill`, `agenda_update`, `agenda_delete`, `agenda_mark_paid`

Migration: `006_chat_messages.py`

Production deploy: `./scripts/setup-fly-prod.sh` → `./scripts/deploy-production.sh`
