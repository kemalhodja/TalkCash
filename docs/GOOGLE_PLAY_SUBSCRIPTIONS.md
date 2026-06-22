# Google Play — Subscription SKU Setup

Product IDs must match exactly across Play Console, mobile app, and backend.

## Product IDs (copy-paste)

```
talkcash_pro_monthly
talkcash_family_monthly
talkcash_business_monthly
```

**Code references:**
- Mobile: `mobile/services/storeBilling.ts`
- Backend: `backend/app/services/billing/google_play.py`

---

## Play Console steps

For **each** product ID:

1. **Monetize → Subscriptions → Create subscription**
2. **Product ID:** (exact ID from table above — cannot change later)
3. **Name & description** (user-visible):

| Product ID | Name (TR) | Name (EN) |
|------------|-----------|-----------|
| talkcash_pro_monthly | TalkCash Pro | TalkCash Pro |
| talkcash_family_monthly | TalkCash Aile | TalkCash Family |
| talkcash_business_monthly | TalkCash İş | TalkCash Business |

4. **Base plan → Add base plan**
   - Billing period: **Monthly**
   - Renewal type: **Auto-renewing**
   - Price: set per market (see below)
5. **Activate** the base plan and subscription

---

## Suggested pricing (TRY)

Align with backend plan config (`DEFAULT_PLAN_CONFIG` — informational only; Play Console price is authoritative):

| SKU | Suggested TRY/month | Backend reference (kuruş) |
|-----|---------------------|---------------------------|
| talkcash_pro_monthly | ₺99,99 | 9999 |
| talkcash_family_monthly | ₺169,99 | 16999 |
| talkcash_business_monthly | ₺299,99 | 29999 |

**Yıllık plan (Play Console’da ayrı base plan veya offer):**

| SKU (önerilen) | Yıllık TRY | Aylık eşdeğer |
|----------------|------------|---------------|
| talkcash_pro_monthly (annual offer) | ₺899,99 | ~₺75 |
| talkcash_family_monthly (annual offer) | ₺1.599,99 | ~₺133 |
| talkcash_business_monthly (annual offer) | ₺2.499,99 | ~₺208 |

Detaylı benchmark: [PRICING.md](PRICING.md)

Add **United States** and other markets if targeting globally.

---

## License testers

Play Console → **Settings → License testing**

Add Gmail accounts for sandbox purchases before production rollout.

---

## Service account (EAS submit + API verify)

1. Play Console → **Setup → API access**
2. Link Google Cloud project
3. Create service account with **Release manager** (submit) and ensure **Financial data** access for subscriptions API
4. Download JSON key
5. Configure:
   - **EAS:** `eas credentials` → Android → Google Service Account
   - **Fly production:** `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

---

## RTDN (Real-time developer notifications)

1. Play Console → **Monetize → Monetization setup**
2. Topic: create Pub/Sub or use Play’s RTDN endpoint
3. For TalkCash HTTP webhook:

```
POST https://talkcash-api-prod.onrender.com/api/v1/billing/google/rtdn
Header: X-Webhook-Secret: <GOOGLE_RTDN_WEBHOOK_SECRET>
```

---

## Entitlements unlocked per plan

| Plan | Key features |
|------|----------------|
| Free | 3 smart savings nudges/day, round-up manual |
| Pro | Unlimited nudges, auto round-up, portfolio coach, advanced insights |
| Family | Pro + shared workspaces (3) |
| Business | Family + business exports, higher limits |

---

## Test purchase flow

1. Install internal test build
2. Settings → Premium → choose plan
3. Complete Google Play test purchase
4. App calls `POST /api/v1/billing/google/verify`
5. Verify `GET /api/v1/billing/me` shows `is_premium: true`
