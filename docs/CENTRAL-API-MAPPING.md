# Misty Hut → centralized backend API mapping

This maps **current Misty Hut guest/public** routes to the contract in  
[`vara-portfolio/server/docs/api.md`](../../vara-portfolio/server/docs/api.md).

**Assumed base URL:** `http://localhost:3000`  
**Property slug:** `misty-hut` (use wherever `propertySlug` is required)

---

## Public (no auth)

Browse and quote **before** guest sign-in. Same catalog/quote semantics as authenticated guest quote, scoped by slug.

| Current (Misty Hut) | Central API |
|---------------------|-------------|
| `GET /api/booking/rooms` | `GET http://localhost:3000/api/public/properties/misty-hut/rooms` |
| `POST /api/booking/checkAvailability` | `POST http://localhost:3000/api/public/properties/misty-hut/quote` |

**Request body** for quote (unchanged conceptually):

```json
{ "roomId": "...", "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD" }
```

**Response shape:** Central `quote` matches **`POST /api/guest/bookings/quote`** (see guest section). Misty Hut today returns ISO date objects for `checkIn`/`checkOut` in the JSON body; the central contract documents `YYYY-MM-DD` strings in the quote response plus **`bookingPrepaidPercent`** and **`prepaidAmount`** — plan frontend updates when switching.

---

## Guest auth (replaces session + Google for booking flows)

Misty Hut today uses **Passport Google OAuth + cookies** for cart/checkout. The centralized API uses **guest JWT** from **magic-pin** (`Authorization: Bearer <token>`), scoped to one property.

| Current (Misty Hut) | Central API | Notes |
|---------------------|-------------|--------|
| `GET /api/auth/google` → `GET /api/auth/google/callback` | *No direct guest equivalent* | Guest sign-in is not Google in the central doc. |
| `GET /api/auth/status` (session) | *Not in guest table* | Staff still has `GET /api/auth/status` for **manager** session; guest identity comes from JWT after `verify-pin`. |
| `POST /api/auth/logout` | *Guest:* drop JWT client-side; no cookie session for guest APIs | Optional: central may add a guest revoke endpoint later — not in `api.md`. |

**Magic-pin flow (required for guest routes below):**

| Step | Central API |
|------|-------------|
| Request PIN | `POST http://localhost:3000/api/guest-auth/request-pin` — body: `{ "propertySlug": "misty-hut", "email": "...", "name": "..." }` |
| Verify PIN → JWT | `POST http://localhost:3000/api/guest-auth/verify-pin` — body: `{ "propertySlug": "misty-hut", "email": "...", "pin": "...", "name": "..." }` optional |

Then send **`Authorization: Bearer <token>`** on all `/api/guest/*` calls.

---

## Guest — bookings & cart (Bearer JWT)

| Current (Misty Hut) | Central API |
|---------------------|-------------|
| `POST /api/booking/checkAvailability` | `POST http://localhost:3000/api/guest/bookings/quote` |
| `GET /api/booking/rooms` | `GET http://localhost:3000/api/guest/bookings/rooms` |
| `GET /api/booking/cart` | `GET http://localhost:3000/api/guest/bookings/cart` |
| `POST /api/booking/cart` | `POST http://localhost:3000/api/guest/bookings/cart/items` |
| `DELETE /api/booking/cart` | `DELETE http://localhost:3000/api/guest/bookings/cart/items` |
| `GET /api/booking/bookings` | `GET http://localhost:3000/api/guest/bookings` |

**Bodies** (aligned with central doc):

- **Quote:** `{ "roomId", "checkIn", "checkOut" }`
- **Add cart line:** `{ "roomId", "checkIn", "checkOut", "adults", "children" }`
- **Remove cart line:** `{ "roomId", "checkIn", "checkOut" }` (`YYYY-MM-DD`)

**Response differences to handle in the SPA:**

| Area | Misty Hut today | Central (`api.md`) |
|------|-----------------|----------------------|
| Cart GET | `{ "message": [ ...lines ] }` | `{ "roomInfo": [ ... ] }` |
| List bookings | `{ "data": [ ... ] }` | `{ "data": [ ... ] }` ✓ |
| Quote | no prepaid fields | includes `bookingPrepaidPercent`, `prepaidAmount` |

---

## Guest — Razorpay

| Current (Misty Hut) | Central API |
|---------------------|-------------|
| `POST /api/booking/checkout` | `POST http://localhost:3000/api/guest/payments/order` |
| `POST /api/payment/verify` | `POST http://localhost:3000/api/guest/payments/verify` |
| `POST /api/payment/razorpay-webhook` | `POST http://localhost:3000/api/guest/payments/webhook` |

**Checkout / order:** Body stays `{ "name", "email", "phone" }` on the central server; requires **Bearer** guest JWT.

**201 response:** Central includes **`prepaidPercentApplied`**, **`expectedPrepaidAmount`** in `data` (per `api.md`). Misty Hut today returns `totalAmount`, `amountPaid`, `razorpayOrderId`, `status`, `key` — align UI with the new fields if prepay rules apply.

**Webhook:** Configure Razorpay to call the **central** full URL (e.g. `https://<your-api-host>/api/guest/payments/webhook`). Webhook secret is **per property** on the central backend — not the old single-env Misty Hut secret unless migrated.

---

## One-line quick reference

```
# Public
GET  http://localhost:3000/api/public/properties/misty-hut/rooms
POST http://localhost:3000/api/public/properties/misty-hut/quote

# Guest auth
POST http://localhost:3000/api/guest-auth/request-pin
POST http://localhost:3000/api/guest-auth/verify-pin

# Guest (Bearer)
POST   http://localhost:3000/api/guest/bookings/quote
GET    http://localhost:3000/api/guest/bookings/rooms
GET    http://localhost:3000/api/guest/bookings/cart
POST   http://localhost:3000/api/guest/bookings/cart/items
DELETE http://localhost:3000/api/guest/bookings/cart/items
GET    http://localhost:3000/api/guest/bookings

POST http://localhost:3000/api/guest/payments/order
POST http://localhost:3000/api/guest/payments/verify
POST http://localhost:3000/api/guest/payments/webhook   # server-only
```

---

## Open questions (worth confirming before cutover)

1. **Guest login:** Will Misty Hut **replace Google OAuth for shoppers** with **magic-pin** + JWT, or will you add Google-as-guest on the central server? The published `api.md` guest path is PIN-only.
2. **Port / host:** You asked for `localhost:3000`. If the Vara server actually runs on another port in dev, only the origin changes; paths and `misty-hut` stay the same.
3. **Property record:** Is `misty-hut` already created in the central DB with Razorpay keys, Resend, and rooms seeded so `roomId` values match the old site?
4. **CORS:** The browser origin for the Misty Hut static site must be allowed on the **central** API (`CORS_ORIGIN` / comma-separated list per `api.md`).
5. **Staff / admin:** The local admin SPA and `/api/admin/*` were **removed** from this repo; use the centralized backend’s manager/admin APIs for operations.

If you want, the next step is a small checklist PR: replace `fetch`/`credentials` cart calls with Bearer token + new URLs, and rename `message` → `roomInfo` for cart parsing.
