# Google Play — Subscription SKU Setup

Product IDs must match exactly across Play Console, mobile app, and backend.

## Product IDs (6 SKU — monthly + yearly)

```
talkcash_pro_monthly
talkcash_pro_yearly
talkcash_family_monthly
talkcash_family_yearly
talkcash_business_monthly
talkcash_business_yearly
```

**Code references:**
- Mobile: `mobile/services/storeBilling.ts`
- Backend: `backend/app/services/billing/google_play.py`
- Regional prices: `mobile/store/regional-pricing.json`

---

## Play Console steps (each product ID)

1. **Monetize → Subscriptions → Create subscription**
2. **Product ID:** exact ID from list above
3. **Name (TR / EN):**

| Product ID | TR | EN |
|------------|----|----|
| talkcash_pro_monthly | TalkCash Pro (Aylık) | TalkCash Pro (Monthly) |
| talkcash_pro_yearly | TalkCash Pro (Yıllık) | TalkCash Pro (Yearly) |
| talkcash_family_monthly | TalkCash Aile (Aylık) | TalkCash Family (Monthly) |
| talkcash_family_yearly | TalkCash Aile (Yıllık) | TalkCash Family (Yearly) |
| talkcash_business_monthly | TalkCash İş (Aylık) | TalkCash Business (Monthly) |
| talkcash_business_yearly | TalkCash İş (Yıllık) | TalkCash Business (Yearly) |

4. **Base plan** — one subscription product can have:
   - **Monthly** (P1M) auto-renewing, OR create separate product IDs as above (TalkCash uses separate IDs per period)
5. **Price:** tax-inclusive per country — see [PRICING.md](PRICING.md) and `regional-pricing.json`
6. **Free trial:** 7 days
7. **Intro offer (launch 90d):** Pro first month US $4.99 / TR ₺39.99
8. **Countries:** [PLAY_STORE_REGIONS.md](PLAY_STORE_REGIONS.md) — 30 countries wave 1
9. **Activate**

**Launch priority:** Pro + Family monthly/yearly first. Business optional v1.3.

---

## Anchor prices (tax-inclusive)

| Plan | USD/mo | USD/yr | TRY/mo | TRY/yr |
|------|--------|--------|--------|--------|
| Pro | $8.99 | $79.99 | ₺89.99 | ₺749.99 |
| Family | $14.99 | $134.99 | ₺149.99 | ₺1.299,99 |
| Business | $24.99 | $224.99 | ₺249.99 | ₺1.999,99 |

Backend reference (USD cents, informational): Pro 899, Family 1499, Business 2499.

---

## China & Russia

| Market | Google Play billing | Action |
|--------|---------------------|--------|
| China | Not available | Future: AppGallery — see PLAY_STORE_REGIONS.md |
| Russia | Limited/blocked | Future: RuStore — reference prices in regional-pricing.json |

Do not block global Play rollout waiting for CN/RU.

---

## License testers

Play Console → **Settings → License testing** — add Gmail accounts.

---

## RTDN

```
POST https://talkcash-api-prod.onrender.com/api/v1/billing/google/rtdn
Header: X-Webhook-Secret: <GOOGLE_RTDN_WEBHOOK_SECRET>
```

---

## Test flow

1. Internal test build (AAB #19+)
2. Settings → Premium → **Yearly** (default) → purchase
3. `POST /api/v1/billing/google/verify`
4. `GET /api/v1/billing/me` → `is_premium: true`
