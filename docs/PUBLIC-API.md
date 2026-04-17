# Public (non-admin) HTTP API

This document describes **guest-facing** JSON APIs exposed by the Misty Hut Express server. **Admin UI and `/api/admin/*` were removed** from this repo; operations run on the centralized backend (see [CENTRAL-API-MAPPING.md](./CENTRAL-API-MAPPING.md)). See [API-CONTRACT-AND-MIGRATION.md](./API-CONTRACT-AND-MIGRATION.md) for migration maps.

**Stack:** Express 4, MongoDB (Mongoose), Passport (Google OAuth) + `express-session`, Razorpay.

**Mount points:** [`server.js`](../server.js) wires:

- `/api/auth` → [`routes/auth.routes.js`](../routes/auth.routes.js)
- `/api/booking` → [`routes/booking.route.js`](../routes/booking.route.js) + [`controllers/booking.controller.js`](../controllers/booking.controller.js)
- `/api/payment` → [`routes/razorpay.route.js`](../routes/razorpay.route.js) + [`controllers/razorpay.controller.js`](../controllers/razorpay.controller.js)

---

## Cross-cutting behavior

### CORS and credentials

- [`server.js`](../server.js) enables `cors` with `credentials: true` and `origin` from `CORS_ORIGIN` (default `http://localhost:3000`).
- Browsers sending cookies (session) must use requests with credentials enabled and a matching origin.

### Body size

- Global JSON body limit: **128kb** (`express.json({ limit: "128kb" })`).

### Session authentication (guest / site user)

- Session middleware runs **after** static file serving but **before** API routers.
- Protected booking routes use [`middleware/auth.middleware.js`](../middleware/auth.middleware.js): if `req.isAuthenticated()` is false, the handler responds with **401** and `{ "message": "Please Sign-In to proceed" }`.
- Successful Google OAuth establishes a Passport session; [`config/passport.js`](../config/passport.js) serializes the MongoDB user id and deserializes the full [`User`](../models/user.model.js) document (`googleId`, `name`, `email`, `avatar`, timestamps).

**Important:** This app uses **cookie sessions**, not Bearer JWT, for cart and checkout. When migrating to the centralized API, guest flows use **Bearer JWT** after magic-pin sign-in (see [CENTRAL-API-MAPPING.md](./CENTRAL-API-MAPPING.md)).

### Dates

- User-facing date strings are expected as **`YYYY-MM-DD`** (see `parseDateOnly` in the booking controller). Internally, “date-only” values are stored/processed as **UTC midnight** for that calendar day.
- Availability compares against existing bookings with status **`confirmed`** or **`blocked`**, and against [`BlockedDate`](../models/blocked-date.model.js) ranges from the admin side.

### Room identifiers

- `roomId` values must match the string enum loaded from the `ROOM_IDS` environment variable (see [`models/cart.model.js`](../models/cart.model.js)).

---

## Authentication (`/api/auth`)

Base path: **`/api/auth`**

| Method & path | Auth | Description |
|---------------|------|-------------|
| `GET /api/auth/google` | Public (redirect) | Starts Google OAuth with scopes `profile` and `email`. |
| `GET /api/auth/google/callback` | Public (OAuth redirect) | OAuth callback; on success saves session and redirects to `/`. On Passport failure, redirects to `/`. |
| `GET /api/auth/status` | Public | Returns whether a session user is present and the serialized user. |
| `POST /api/auth/logout` | Public | Ends the session (safe to call when not logged in). |

### `GET /api/auth/google`

- **Handler:** `passport.authenticate("google", { scope: ["profile", "email"] })`.
- **Response:** HTTP redirect to Google (not JSON).

### `GET /api/auth/google/callback`

- **Handler:** `passport.authenticate("google", { failureRedirect: "/" })`, then `req.session.save` and redirect `/`.
- **Response:** Redirect; no JSON body on success path.

### `GET /api/auth/status`

- **200 OK** when logged in:

```json
{
  "loggedIn": true,
  "user": {
    "_id": "...",
    "googleId": "...",
    "name": "...",
    "email": "...",
    "avatar": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

- **200 OK** when not logged in:

```json
{ "loggedIn": false }
```

(`user` shape comes from Mongoose; fields follow [`models/user.model.js`](../models/user.model.js).)

### `POST /api/auth/logout`

- **200 OK:**

```json
{ "success": true }
```

- Calls `req.logout`, then `req.session.destroy`.

---

## Booking & cart (`/api/booking`)

Base path: **`/api/booking`**

| Method & path | Session required? | Controller |
|---------------|-------------------|------------|
| `GET /api/booking/rooms` | No | `listRooms` |
| `POST /api/booking/checkAvailability` | No | `availabilityAndPrice` |
| `GET /api/booking/cart` | Yes | `listCart` |
| `POST /api/booking/cart` | Yes | `addToCart` |
| `DELETE /api/booking/cart` | Yes | `deleteRoomFromCart` |
| `POST /api/booking/checkout` | Yes | `bookRooms` |
| `GET /api/booking/bookings` | Yes | `listBookings` |

---

### `GET /api/booking/rooms`

Public catalog of all rooms for the marketing site.

**200 OK:**

```json
{
  "success": true,
  "rooms": [
    {
      "id": 1,
      "roomId": "room_1",
      "name": "...",
      "description": "...",
      "type": "Room",
      "price": 2500,
      "images": {
        "banner": "https://...",
        "gallery": ["https://..."]
      }
    }
  ]
}
```

- `id` is derived from `roomId` by stripping non-digits and parsing as integer, or falls back to `roomId` if no digits.
- `price` is **base** `pricePerNight` from the database (per-night display); seasonal overrides are applied in pricing endpoints.
- **500:** `{ "success": false, "message": "Something went wrong" }`.

---

### `POST /api/booking/checkAvailability`

Validates the requested stay, checks conflicts with bookings and blocked dates, then returns **total price** and **per-night breakdown** (base vs variable/seasonal prices).

**Request body (JSON):**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `roomId` | string | Yes | Must exist in `Room` collection. |
| `checkIn` | string | Yes | `YYYY-MM-DD`; parsed as UTC midnight. |
| `checkOut` | string | Yes | Exclusive end in the pricing loop (nights = each day from `checkIn` up to but not including `checkOut`). |

**Business rules (non-exhaustive):**

- Room must exist; otherwise **400** `{ "message": "Room Id required" }` (when `Room.findOne` fails for `req.body.roomId`).
- `checkIn >= checkOut` or `checkIn <= today` (today in UTC date-only) → **400** with message like `"Please select a proper checkIn"`.
- Overlap with an existing booking (`status` in `confirmed` or `blocked`) → **400** with a message naming the room.
- Overlap with admin-blocked dates → **400** with a blocked message.

**200 OK** (shape from controller):

```json
{
  "roomId": "room_1",
  "checkIn": "2026-05-01T00:00:00.000Z",
  "checkOut": "2026-05-03T00:00:00.000Z",
  "price": 5000,
  "priceBreakdown": [
    { "date": "2026-05-01", "price": 2500, "reason": "Base price" },
    { "date": "2026-05-02", "price": 2500, "reason": "Base price" }
  ]
}
```

- **500:** `{ "message": "Something went wrong" }`.

---

### `GET /api/booking/cart`

**Auth:** Session (401 if not logged in).

**200 OK** — response uses the key **`message`** for the cart lines array (not `items` or `cart`):

```json
{
  "message": [
    {
      "roomId": "room_1",
      "roomName": "...",
      "type": "Room",
      "price": 5000,
      "priceBreakdown": [ ... ],
      "adults": 2,
      "children": 0,
      "checkIn": "2026-05-01T00:00:00.000Z",
      "checkOut": "2026-05-03T00:00:00.000Z"
    }
  ]
}
```

If the user has no cart document, `message` may be **`undefined`** (empty cart edge case).

**500:** `{ "message": "something went wrong" }`.

---

### `POST /api/booking/cart`

**Auth:** Session.

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `roomId` | string | Yes |
| `checkIn` | string (`YYYY-MM-DD`) | Yes |
| `checkOut` | string (`YYYY-MM-DD`) | Yes |
| `adults` | number (coerced) | Yes |
| `children` | number (coerced) | Yes |

**Validation:**

- Same availability rules as `checkAvailability`.
- Guest counts validated against [`Room.capacity`](../models/pricing.model.js): `minAdults`, `maxAdults`, `maxChildren`, `maxTotal`.
- Cannot add the same `roomId` with **overlapping** date range to an existing cart line (**400**).

**201 Created:** full [`Cart`](../models/cart.model.js) document when the cart is first created.

**200 OK:** updated cart document when appending to an existing cart.

**400:** `{ "message": "<reason>" }` (availability, guests, or overlap).

**500:** `{ "message": "Something went wrong" }`.

---

### `DELETE /api/booking/cart`

**Auth:** Session.

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `roomId` | string | Yes |
| `checkIn` | string | Yes |
| `checkOut` | string | Yes |

Dates are normalized to UTC midnight for matching.

**200 OK** when cart becomes empty after removal:

```json
{ "message": "Room removed and cart deleted (cart was empty)" }
```

**200 OK** when cart still has lines:

```json
{
  "message": "Room removed from cart",
  "cart": { ... }
}
```

**400:** `{ "message": "roomId, checkIn and checkOut are required" }`.

**404:** `{ "message": "Cart not found" }` or `{ "message": "Room booking not found in cart" }`.

**500:** `{ "message": "Something went wrong" }`.

---

### `POST /api/booking/checkout`

**Auth:** Session.

Creates a **pending** [`Booking`](../models/booking.model.js), creates a **Razorpay order** for the cart total, and returns data needed for the client-side Razorpay checkout (including the publishable key).

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `email` | string | Yes |
| `phone` | string | Yes |

**400** if any missing: `{ "message": "Mandatory fields must not be empty" }`.

**400** if cart empty: `{ "message": "Cart is empty" }`.

For each cart line, availability is **re-checked**; failure returns **400** `{ "message": "<reason>" }`.

**201 Created:**

```json
{
  "message": "Booking created successfully. Complete the payment to finalize.",
  "data": {
    "bookingId": "<ObjectId>",
    "guest": { "name": "...", "email": "...", "phone": "..." },
    "rooms": [ ... ],
    "totalAmount": 10000,
    "amountPaid": 0,
    "razorpayOrderId": "order_...",
    "status": "pending",
    "key": "<RAZORPAY_KEY_ID>"
  }
}
```

- Razorpay `amount` is `totalAmount * 100` paise, currency **INR**.
- `key` is the Razorpay **Key ID** (publishable), from environment.

**500:** `{ "message": "Something went wrong" }`.

---

### `GET /api/booking/bookings`

**Auth:** Session.

Returns bookings for the logged-in user where:

- `rooms.checkOut` is **on or after** today (UTC date-only), and  
- `status` is **`confirmed`** or **`cancelled`**.

**200 OK:**

```json
{ "data": [ /* Booking documents, newest first */ ] }
```

Each booking includes `guest`, `rooms`, `totalAmount`, `amountPaid`, `razorpayOrderId`, `status`, timestamps, etc.

**500:** `{ "message": "Something went wrong" }`.

---

## Payments (`/api/payment`)

Base path: **`/api/payment`**

| Method & path | Auth | Description |
|---------------|------|---------------|
| `POST /api/payment/razorpay-webhook` | Razorpay HMAC | Server-to-server webhook from Razorpay. |
| `POST /api/payment/verify` | Signature in body | Client-side verification after Razorpay checkout (HMAC with API secret). |

---

### `POST /api/payment/razorpay-webhook`

**Not** session-based. Intended for Razorpay’s servers only.

**Headers:**

- `x-razorpay-signature`: HMAC-SHA256 hex digest of the **raw** JSON body using `RAZORPAY_WEBHOOK_SECRET`.

**Behavior ([`razorpay.controller.js`](../controllers/razorpay.controller.js)):**

- Missing signature or secret → **400** `{ "message": "Invalid webhook" }`.
- Signature mismatch → **400** `{ "message": "Invalid signature" }`.
- Handles events: `payment.captured`, `payment.failed`, `order.paid` (others logged and ignored).
- On success path, responds **200** `{ "status": "ok" }`. On thrown errors in the outer try/catch, still responds **200** `{ "status": "error", "message": "..." }` to reduce retry storms (see code comments).

**`payment.captured`:** finds booking by `payload.payment.entity.order_id`, sets status **`confirmed`**, stores payment id, sets `amountPaid`, saves, deletes user’s cart, sends guest and admin confirmation emails (Resend).

**`payment.failed`:** finds booking, keeps status effectively **pending** for retry, sends failure email to guest.

**`order.paid`:** backup path to set **`confirmed`** if not already confirmed.

**Note:** [`server.js`](../server.js) registers `express.raw({ type: "application/json" })` for this path **after** global `express.json`. In practice the global JSON parser may run first depending on middleware order; if webhook verification fails in production, confirm that the HMAC is computed over the **exact raw bytes** Razorpay sent (Razorpay docs).

---

### `POST /api/payment/verify`

Called from the browser after a successful Razorpay payment to confirm the payment **before** or **in parallel with** webhooks.

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `razorpay_order_id` | string | Yes |
| `razorpay_payment_id` | string | Yes |
| `razorpay_signature` | string | Yes |

**Verification:** `HMAC-SHA256( razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET )` compared to `razorpay_signature`.

**400:** `{ "success": false, "message": "Invalid payment signature" }`.

**404:** `{ "success": false, "message": "Booking not found" }`.

**200 OK:**

```json
{
  "success": true,
  "message": "Payment verified successfully",
  "booking": {
    "id": "<ObjectId>",
    "status": "confirmed"
  }
}
```

- Updates the booking: `status` → `confirmed`, `razorpayPaymentId` set.  
- Email sending is **commented out** in this handler (webhook path sends mail on `payment.captured`).

**500:** `{ "success": false, "message": "Payment verification failed" }`.

**Security note:** This endpoint does not require a logged-in user; it relies on knowledge of `razorpay_order_id` and a valid Razorpay signature. Protect against abuse with rate limiting at the edge if needed.

---

## Quick reference table

| Endpoint | Method | Session |
|----------|--------|---------|
| `/api/auth/google` | GET | No |
| `/api/auth/google/callback` | GET | No |
| `/api/auth/status` | GET | No |
| `/api/auth/logout` | POST | No |
| `/api/booking/rooms` | GET | No |
| `/api/booking/checkAvailability` | POST | No |
| `/api/booking/cart` | GET, POST, DELETE | Yes |
| `/api/booking/checkout` | POST | Yes |
| `/api/booking/bookings` | GET | Yes |
| `/api/payment/razorpay-webhook` | POST | Razorpay HMAC |
| `/api/payment/verify` | POST | No (signature-based) |

---

## Related docs

- [API-CONTRACT-AND-MIGRATION.md](./API-CONTRACT-AND-MIGRATION.md) — migration map vs a reference platform API and frontend call sites.
- [oauth.md](./oauth.md) — OAuth setup notes if present.
- [rooms.md](./rooms.md) — room content conventions if present.
