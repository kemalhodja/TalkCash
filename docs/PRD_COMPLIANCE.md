# TalkCash — PRD Uyumluluk Matrisi

Durum: **Tam** · **Kısmi** · **Eksik**

Son güncelleme: PR #22 + remaining PRD — tüm roadmap maddeleri tamamlandı.

---

## Kapatılan maddeler

| Alan | Özellik | Durum |
|------|---------|--------|
| Ship | JWT refresh + hesap silme + işlem CRUD | **Tam** |
| Ship | WS auth + prod/staging EAS | **Tam** |
| Ship | Production Fly deploy scripts + CI | **Tam** |
| UX | Onboarding + deep link + güvenlik | **Tam** |
| UX | Borç CRUD + borrowed/lent UI | **Tam** |
| UX | Offline kuyruk + optimistic snapshot | **Tam** — tüm kuyruk tipleri |
| UX | Shared wallet admin | **Tam** — rename, invite, delete, remove member, **ownership transfer** |
| UX | LLM chat mentor | **Tam** |
| UX | Avant-garde mobil UI | **Tam** — tüm ekranlar + modallar |
| Ship | Play Store release hazırlığı | **Tam** — listing, submit script, privacy, EAS submit CI |
| Ship | Production Fly kurulum | **Tam** — `setup-fly-prod.sh`, preflight, deploy |

---

## Manuel adımlar (operasyonel)

Bu adımlar kod dışında bir kez yapılır:

1. `./scripts/setup-fly-prod.sh` + Fly secrets (REDIS, OpenAI, S3, ALLOWED_ORIGINS)
2. `./scripts/deploy-production.sh`
3. Expo `eas credentials` → Google Play service account
4. `./scripts/submit-play-store.sh` veya GitHub **EAS Submit**
5. Play Console: content rating, data safety, internal → production

---

## API özeti

```
POST   /ai/chat                              LLM mentor
GET    /ai/chat/history                      Sohbet geçmişi
PATCH  /social/shared-wallet/{id}            Yeniden adlandır
POST   /social/shared-wallet/{id}/members    Üye davet
DELETE /social/shared-wallet/{id}/members/{uid}  Üye çıkar
POST   /social/shared-wallet/{id}/transfer     Sahiplik devri
DELETE /social/shared-wallet/{id}            Kasayı sil
```

Sync kuyruk + optimistic cache: `shopping_*`, `wallet_*`, `transaction_*`, `agenda_*`, `execute`

Production: `./scripts/setup-fly-prod.sh` → `./scripts/deploy-production.sh`  
Play Store: `./scripts/submit-play-store.sh` — [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md)
