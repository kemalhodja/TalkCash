# TalkCash v1.2 — Persona, Subscription Detective, Quick Whisper

## 1. Angry Mom / Sassy Coach (Persona)

**Ayarlar → Asistan Kişiliği:** `default` | `angry_mom` | `street_smart`

- LLM system prompt overlay: `backend/app/services/nlp/personas.py`
- Lüks harcama / bütçe aşımında TTS: `persona_speech` JSON
- API: `PUT /api/v1/auth/persona` `{ "assistant_persona": "angry_mom" }`

**Örnek (angry_mom + kahve):**
> Ahmet, yine mi dışarıda kahve içtin? Evde kahve mi yok evladım? Bu 85 TL Kahve ile ay sonunu getiremeyeceksin!

## 2. Abonelik Avcısı (Subscription Detective)

**Tetikleyiciler:** "Netflix'e 150 TL ödedim", SMS yapıştırma, spotify aylık...

- `detect_subscription()` → Netflix, Spotify, YouTube Premium, iCloud, vb.
- `transactions`: `is_recurring`, `next_billing_date`, `subscription_name`
- Ajandaya otomatik fatura + mobil local bildirim (2 gün önce)

**Sesli uyarı:**
> Ahmet, iki gün sonra kartından 150.00 TL Netflix çekilecek. İptal etmek istiyorsan tam sırası!

## 3. Fısıltı Modu (Quick Whisper)

**Kısayol:** `talkcash://quick-voice?hold=1` · Android launcher shortcut "Hızlı Fısıltı"

- API: `POST /api/v1/input/quick-voice` (auth, premium gerekmez)
- Basılı tut → fısılda → bırak → arka planda kayıt + bildirim
- Ekran: Ayarlar → Fısıltı Modu veya `/quick-voice`

## Migration

```bash
alembic upgrade head   # 017_v12_persona_subscriptions
```

## Pazarlama

- Persona: TikTok/Reels — "TalkCash beni azarladı" screen recordings
- Subscription: "Kartından habersiz Netflix çekilmesin"
- Whisper: "Taksi 200 — tek dokunuş, uygulama açmadan"
