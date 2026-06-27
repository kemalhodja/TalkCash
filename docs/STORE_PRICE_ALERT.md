# Mağaza Karşılaştırmalı Fiyat Alarmı

Kullanıcı aynı ürünü farklı mağazadan kaydettiğinde, anlamlı fiyat farkı varsa TTS ile sesli uyarı oynatılır.

## Senaryo (Soda örneği)

1. Geçen hafta: `Migros'tan 10 TL soda` → `product_history` + `transactions.store_name`
2. Bugün sesli: `Carrefour'dan 15 liraya soda aldım`
3. NLP: ürün `Soda`, fiyat `15`, mağaza `Carrefour`
4. Backend: `ProductHistory`'de farklı mağaza (`Migros`, 10 TL) bulunur → %50 fark ≥ %5 eşik
5. TTS: *"Soda Carrefour harcamalarına ekledim Ahmet. Ama küçük bir not: Bu soda en son Migros'tan 10.00 TL'ye almıştın. Carrefour şu an %50 daha pahalı, bilgin olsun."*

## Veritabanı

| Tablo | Alan | Açıklama |
|-------|------|----------|
| `transactions` | `store_name` | Zorunlu (boşsa `Genel`) |
| `product_history` | `product_name`, `store_name`, `price` | Ürün-mağaza-fiyat geçmişi |

## API yanıtı (`voice_alert`)

```json
{
  "action": "trigger_voice_alert",
  "current_store": "Carrefour",
  "previous_store": "Migros",
  "current_price": 15.0,
  "previous_price": 10.0,
  "percent_diff": 50,
  "product": "Soda",
  "speech_text": "..."
}
```

**Tetikleyen uçlar:**
- `POST /api/v1/execute/confirm` → `result.voice_alert`
- `POST /api/v1/input/process-voice` → `voice_alert` (üst seviye) + `result.voice_alert`
- `POST /api/v1/shopping/.../complete` → `voice_alert`

## Mobil TTS

`mobile/utils/voiceAlert.ts` → `expo-speech` ile `speech_text` okunur.

`input.tsx`, `command.tsx`, `share.tsx`, `BuyToSpendModal.tsx` otomatik çağırır.

## Eşik

`PRICE_DIFF_THRESHOLD = 0.05` (%5) — `backend/app/services/product_price/helpers.py`

## Kod referansları

- Karşılaştırma: `backend/app/services/product_price/service.py`
- Mağaza ayıklama: `backend/app/services/nlp/turkish_parser.py` → `extract_store_name`
- Harcama akışı: `backend/app/services/execute/service.py`

## Pazarlama sloganı

> Hangi market daha ucuz diye katalog katalog gezme. TalkCash'e fısılda, sana sodayı en ucuza hangi mağazadan aldığını anında söylesin!
