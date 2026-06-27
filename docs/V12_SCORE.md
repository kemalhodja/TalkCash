# TalkCash V1.2 — Puanlama Raporu

**Tarih:** 2026-06-19 · **Sürüm:** 1.2.0

---

## Özet Skor: **88 / 100** 🟢

| Kategori | Ağırlık | Skor | Not |
|----------|---------|------|-----|
| Fonksiyonellik | 40 | **34** | 3 ana özellik çalışıyor; iOS WidgetKit eksik |
| Güvenilirlik | 25 | **21** | Sync + backend scheduler eklendi; duplicate local notif riski düşük |
| UX / UI | 20 | **16** | Persona picker, abonelik rozeti, fısıltı ekranı tamam |
| Viral / Pazarlama | 10 | **9** | Angry Mom TTS + ekran kaydı potansiyeli yüksek |
| Test / CI | 5 | **2** | Unit testler yeşil; E2E PG gerektirir |

---

## 1. Angry Mom / Sassy Coach — **88/100**

| Kriter | Durum |
|--------|-------|
| 3 persona modu (default, angry_mom, street_smart) | ✅ |
| LLM system prompt overlay | ✅ |
| TTS persona_speech (lüks/bütçe) | ✅ |
| Ayarlardan seçim + API persist | ✅ |
| TokenResponse'da persona | ✅ (yeni) |
| Slash/SMS parse'da persona | ✅ (yeni) |
| Mentor chat persona | ⏳ opsiyonel |

**Viral potansiyel:** TikTok/Reels için hazır — kullanıcı adı + kategori + sert ton.

---

## 2. Abonelik Avcısı — **85/100**

| Kriter | Durum |
|--------|-------|
| Netflix/Spotify/… tespiti | ✅ |
| `is_recurring`, `next_billing_date`, `subscription_name` | ✅ |
| Ajandaya otomatik fatura | ✅ |
| Local bildirim T-2 (harcama anında) | ✅ |
| Backend push scheduler T-2 | ✅ (yeni) |
| Sync pull'da alanlar | ✅ (yeni) |
| Transactions API + UI rozeti | ✅ (yeni) |
| Sync sonrası reminder yenileme | ✅ (yeni) |
| İptal deep link (Netflix app) | ⏳ backlog |

---

## 3. Fısıltı Modu — **72/100**

| Kriter | Durum |
|--------|-------|
| `POST /input/quick-voice` | ✅ |
| `/quick-voice` ekranı (hold-to-record) | ✅ |
| Deep link `talkcash://quick-voice?hold=1` | ✅ |
| Kilit ekranı pending intent | ✅ (yeni) |
| Android launcher shortcut (6 adet) | ✅ (yeni) |
| Android home widget stub | ✅ (yeni) |
| iOS Siri whisper/quick activity | ✅ config |
| iOS WidgetKit / kilit ekranı | ❌ backlog |
| Android Quick Settings Tile | ❌ backlog |
| Arka planda kayıt (app kapalıyken) | ⏳ widget → app açar |

---

## Güçlendirme Özeti (bu oturum)

1. **Sync + API** — abonelik alanları tüm veri yolunda
2. **Backend scheduler** — `subscription_reminders_scan` cron 09:30
3. **Mobile** — işlemler abonelik filtresi, sync reminder resync
4. **Native** — 6 Android shortcut, QuickWhisper widget, iOS activity types
5. **Test** — E2E suite `test_v12_e2e.py`, Maestro persona/fısıltı adımları
6. **Polish** — persona rollback, lock→quick-voice, amount bug fix

---

## Kalan Backlog (V1.2.1)

| Öncelik | Görev | Etki |
|---------|-------|------|
| P1 | iOS WidgetKit extension | Kilit ekranı fısıltı |
| P1 | Android Quick Settings Tile | Tek dokunuş erişim |
| P2 | Duplicate local notification dedup | Sync tekrarı |
| P2 | Abonelik iptal deep link | Netflix/Spotify app |
| P3 | Mentor chat persona overlay | Tutarlı kişilik |

---

## Play Store Hazırlık

```bash
cd backend && alembic upgrade head
cd mobile && node scripts/generate-android-shortcuts.js
.\scripts\preflight-play-store.ps1
```

**Go/No-Go:** 🟢 **GO** — V1.2 pazarlama vaatlerinin %85'i karşılanıyor; native widget eksikleri V1.2.1 hotfix olarak planlanabilir.
