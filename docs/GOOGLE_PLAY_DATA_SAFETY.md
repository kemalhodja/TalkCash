# Google Play — Data Safety Form (TalkCash)

Play Console → **App content → Data safety**

Use these answers when filling the form. Adjust if your production deployment differs.

## Overview

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | **Yes** |
| Is all data encrypted in transit? | **Yes** (HTTPS/TLS) |
| Can users request account deletion? | **Yes** (in-app Settings → Delete Account) |

---

## Data types collected

### Personal info

| Data type | Collected | Shared | Purpose | Required | Linked to identity |
|-----------|-----------|--------|---------|----------|-------------------|
| Email address | Yes | No | Account creation, login | Yes | Yes |
| Name | Yes | No | Profile display | Optional | Yes |

### Financial info

| Data type | Collected | Shared | Purpose | Required | Linked to identity |
|-----------|-----------|--------|---------|----------|-------------------|
| User payment info | No (handled by Google Play) | — | — | — | — |
| Purchase history | Yes | No | Subscription entitlements | For premium | Yes |
| Other financial info | Yes | No | Wallets, transactions, budgets, micro-savings | Core feature | Yes |

Note: TalkCash stores expense amounts and categories entered by the user. It does **not** store bank credentials or card numbers.

### Photos and videos

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Photos | Yes (optional) | No | Receipt OCR when user scans/uploads |

### Audio

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Voice or sound recordings | Yes (optional) | No | Voice expense entry; processed then discarded per privacy policy |

### Location

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Approximate location | Optional | No | Market/geofence reminders when user enables |
| Precise location | Optional | No | Same as above |

### App activity

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| App interactions | Yes | No | Product analytics (feature usage, crashes) |

### Device or other IDs

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Device or other IDs | Yes (push token) | No | Push notifications for bills/budget alerts |

---

## Data handling

| Question | Answer |
|----------|--------|
| Data is encrypted in transit | Yes |
| Users can request deletion | Yes — in-app account deletion |
| Data used for tracking across apps | No |
| Committed to Play Families Policy | N/A (not targeting children under 13) |

---

## Security practices (optional section)

- Data encrypted in transit: **Yes**
- Users can request that data be deleted: **Yes**
- Independent security review: **No** (unless you have one)

---

## Privacy policy URL

```
https://talkcash-api-prod.onrender.com/privacy
```

Must match the URL entered in Store settings and in-app links (`mobile/constants/links.ts`).

---

## Account deletion

**In-app path:** Settings → Account → Delete Account

**Backend:** Deletes user data, receipt images, and subscription linkage per [PRIVACY.md](PRIVACY.md).

If Play asks for a **data deletion URL** (web form), you may use the same privacy page anchor or add a dedicated `/account-deletion` page later.
