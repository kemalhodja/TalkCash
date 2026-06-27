# V1.2 Uygulama Planı

## Faz 1 — Veri katmanı (P0)
| # | Görev | Dosyalar |
|---|-------|----------|
| 1 | Sync pull + mobile cache: abonelik alanları | `sync/service.py`, `syncCache.ts` |
| 2 | Transactions API serialize | `transactions.py`, `schemas/transaction.py` |
| 3 | TokenResponse + AuthUser persona | `auth.py`, `schemas/auth.py`, `auth.ts` |

## Faz 2 — Akış düzeltmeleri (P0–P1)
| # | Görev | Dosyalar |
|---|-------|----------|
| 4 | Kilit ekranı → quick-voice pending intent | `useAssistantLinking.ts`, `lock.tsx` |
| 5 | quick-voice amount bug | `quick-voice.tsx` |
| 6 | Persona tüm NLP girişlerinde | `input.py`, `engine.py` |
| 7 | Backend T-2 abonelik push scheduler | `subscription/scheduler.py`, `notifications/service.py`, `scheduler.py` |
| 8 | Sync sonrası local reminder yenileme | `notifications.ts`, `syncCache.ts` |

## Faz 3 — UI & Native (P1)
| # | Görev | Dosyalar |
|---|-------|----------|
| 9 | İşlemler ekranı abonelik rozeti + filtre | `transactions.tsx`, i18n |
| 10 | Android shortcuts regenerate | `shortcuts.xml`, `assistant_shortcuts.xml` |
| 11 | iOS Siri + app.json intentFilters | `withAssistant.js`, `app.json` |
| 12 | Android widget stub (deep link) | `QuickWhisperWidget.kt`, plugin |

## Faz 4 — Güçlendirme (P2)
| # | Görev | Dosyalar |
|---|-------|----------|
| 13 | E2E testler | `test_v12_e2e.py` |
| 14 | Settings persona rollback | `settings.tsx` |
| 15 | Maestro smoke adımı | `smoke.yaml` |

## Faz 5 — Puanlama
Rubrik: Fonksiyonellik (40), Güvenilirlik (25), UX (20), Viral/Pazarlama (10), Test (5)
