# TalkCash — PRD Uyumluluk Matrisi

Bu doküman ürün teknik şartnamesi (PRD) maddelerini mevcut kod tabanıyla eşleştirir.

Durum: **Tam** · **Kısmi** · **Eksik**

---

## 1. Giriş Metotları ve Veri Yakalama

| PRD | Durum | Not |
|-----|-------|-----|
| Ses + NLP (Whisper + LLM) | Kısmi | `backend/app/routers/input.py`, `services/nlp/` — OpenAI key gerekir |
| Yerel dil / argo (200 kağıt, yüzlük…) | Tam | `turkish_parser.py`, `english_parser.py` |
| Fısıltı modu | Tam | `VoiceInput.tsx`, whisper flag |
| Onay kartı (Pop-up) | Tam | `ConfirmationCard.tsx` |
| Slash commands (`/150 kahve`) | Tam | `POST /input/slash`, `input.tsx` |
| Numerik klavye | Kısmi | `NumericKeypad.tsx` — metin alanına yazar, doğrudan harcama akışı yok |
| Akıllı tamamlama | Tam | `GET /input/autocomplete` |
| OCR fiş tarama | Tam | `ReceiptScanner.tsx`, `services/ocr/` |
| Fiş doğrulama (tutar eşleştirme) | Tam | `POST /ocr/verify` |
| Dijital garanti arşivi | Tam | S3/MinIO + `receipts.tsx` |
| OCR satır → alışveriş listesi | Eksik | Satır kalemleri extract edilir, listeye aktarılmaz |

---

## 2. Dinamik Kasa ve Varlık Yönetimi

| PRD | Durum | Not |
|-----|-------|-----|
| Çoklu kasa tipleri | Tam | Nakit, banka, kredi, altın, döviz |
| Bağımsız bakiye | Tam | `WalletService` |
| Döviz/altın kur senkronu | Tam | Saatlik `sync_exchange_rates` |
| Gelir girişi (ses/metin) | Tam | NLP + `IncomeModal` |
| Kasalar arası transfer | Tam | NLP + `TransferModal` |
| Net varlık (dashboard) | Tam | `GET /wallets/net-worth` |
| TL karşılığı cüzdan satırı | Tam | `balance_try` alanı (PR #18) |
| Kasa para birimi seçimi | Tam | `WalletCreateModal` currency |
| Kasa düzenle/sil | Eksik | API/UI yok |

---

## 3. Akıllı Ajanda ve Fatura Takibi

| PRD | Durum | Not |
|-----|-------|-----|
| İleri tarihli borç/fatura | Tam | `agenda.tsx`, `AgendaService` |
| Taksit bölücü | Tam | `create_installments` |
| Push hatırlatma (1 gün önce + sabah) | Tam | Scheduler + `NotificationService` |
| Mükerrer kayıt uyarısı | Tam | `DuplicateBillDialog` |
| "Ödendi" tetikleyici + kasadan düşme | Tam | `mark_paid` |
| Gecikmiş (overdue) durumu | Tam | Scheduler 07:00 + UI badge (PR #18) |
| Ajanda düzenle/sil | Eksik | — |
| Ödenen geçmiş görünümü | Eksik | Sadece pending/overdue listelenir |

---

## 4. Alışveriş Listesi

| PRD | Durum | Not |
|-----|-------|-----|
| Ses/klavye ile ekleme | Tam | NLP + shopping tab |
| Akıllı kategorizasyon | Kısmi | TR+EN anahtar kelimeler (PR #18) |
| Gece yarısı sıfırlama | Tam | Scheduler 00:00, tamamlananlar silinir |
| Rutinler (günlük/haftalık) | Tam | Long-press, timezone düzeltmesi (PR #18) |
| Al ve harca | Tam | `BuyToSpendModal` |
| Madde silme | Eksik | Sadece complete |

---

## 5. Yapay Zeka Mentorluk ve Analiz

| PRD | Durum | Not |
|-----|-------|-----|
| Kategori bütçe limitleri | Tam | `budgets.tsx`, %80/%100 uyarı |
| Burn rate / ay sonu tahmini | Tam | API + dashboard kartı (PR #18) |
| Fiyat değişim analizi | Kısmi | OCR + işlem verisi; watchlist/push yok |
| LLM sohbet mentoru | Eksik | Kural tabanlı analiz var |

---

## 6. Sosyal Katman ve Güvenlik

| PRD | Durum | Not |
|-----|-------|-----|
| Ortak kasa + WebSocket | Tam | `social.tsx`, `ws.py`, Redis bridge |
| Borç/alacak defteri | Tam | `POST /social/debt` |
| Hesap bölüştürme + WhatsApp | Tam | `POST /social/split` |
| Biyometrik / PIN | Tam | `lock.tsx`, `useAppLock` — sunucu tercihi hydrate (PR #18) |
| Geofencing | Tam | `geofencing.ts` — kalıcı toggle (PR #18) |
| PDF / Excel export | Tam | `settings.tsx`, `export.py` |
| Bulut senkron | Kısmi | Push kuyruk + pull cache; tam offline-first değil |
| Üye bazlı ortak kasa bakiyesi | Eksik | Tek havuz bakiye |

---

## 7. Teknoloji Seti (PRD önerisi vs gerçek)

| PRD | Gerçek |
|-----|--------|
| Flutter veya RN | **React Native (Expo 52)** |
| FastAPI / Django | **FastAPI** |
| PostgreSQL + Redis | **Evet** (+ MinIO) |
| Whisper + GPT | **OpenAI API** (opsiyonel) |
| Vision / Tesseract | **Tesseract + opsiyonel Vision** |

---

## Öncelikli backlog (kalan)

1. OCR satır kalemlerini alışveriş listesine aktarma
2. Tam offline-first sync (pull cache birincil kaynak)
3. Ajanda düzenle/sil + ödenen geçmiş
4. Fiyat watchlist + push bildirimi
5. Ortak kasa üye bazlı muhasebe
6. WebSocket E2E testleri
