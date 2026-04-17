# API contract and migration map

This document completes the **API Coverage Gap** work: it fixes the **authoritative contract** for this repo and maps the **external reference API** (your `api.md` / platform doc) to **current Misty Hut** routes and **frontend consumers**.

## 1. Contract decision

| Role | What it means here |
|------|-------------------|
| **Deployed contract (this repo)** | Whatever is mounted in [`server.js`](../server.js) and called from [`public/js/`](../public/js/). This is the API clients in this codebase actually depend on. **Treat this as authoritative for Misty Hut until routes are migrated.** |
| **Reference contract (`api.md`)** | The platform-style, namespaced API (guest JWT, manager/admin property CRUD, inquiries, `/health`, etc.). **None of those greenfield routes are implemented in this server yet** except where a **legacy equivalent** exists under a different path (see migration map). |

**Recommendation:** Keep building Misty Hut against **current** paths. When aligning with the shared platform, add **new** route modules under `/api/guest/*`, `/api/manager/*`, etc., and optionally keep **temporary aliases** from old paths to avoid breaking the SPA—then update `public/js/` in a second step.

---

## 2. Route migration map (reference → Misty Hut)

**Legend:** *Reference* = path from `api.md`. *Misty Hut* = path implemented today. *Consumers* = files in this repo that call the Misty Hut path (line numbers approximate).

### Health & public

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `GET /health` | *Not implemented* | — |

### Staff auth

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `GET /api/auth/status` | `GET /api/auth/status` | [`public/js/main.js`](../public/js/main.js), [`public/js/cart.js`](../public/js/cart.js) |
| `POST /api/auth/logout` | `POST /api/auth/logout` | [`public/js/main.js`](../public/js/main.js) |
| `GET /api/auth/manager/google` | `GET /api/auth/google` | [`public/js/main.js`](../public/js/main.js) (redirect), [`public/js/cart.js`](../public/js/cart.js) |
| `GET /api/auth/manager/google/callback` | `GET /api/auth/google/callback` | *(browser redirect only; defined in [`routes/auth.routes.js`](../routes/auth.routes.js))* |

### Admin login (password + OTP)

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `POST /api/admin/login` | `POST /api/admin/login` | [`public/js/admin.js`](../public/js/admin.js) |
| `POST /api/admin/login/verify-otp` | `POST /api/admin/verify-otp` | [`public/js/admin.js`](../public/js/admin.js) |
| `POST /api/admin/login/resend-otp` | *Not implemented* | — |
| `POST /api/admin/logout` | `POST /api/admin/logout` | [`public/js/admin.js`](../public/js/admin.js) |

### Guest magic-pin & JWT

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `POST /api/guest-auth/request-pin` | *Not implemented* | — |
| `POST /api/guest-auth/verify-pin` | *Not implemented* | — |

**Note:** This app uses **session** auth (`isAuthenticated`) for booking/cart, not guest Bearer JWT.

### Guest bookings & cart

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `POST /api/guest/bookings/quote` | `POST /api/booking/checkAvailability` | [`public/js/main.js`](../public/js/main.js) |
| `GET /api/guest/bookings/rooms` | `GET /api/booking/rooms` | [`public/js/main.js`](../public/js/main.js), [`public/js/admin.js`](../public/js/admin.js) |
| `GET /api/guest/bookings/cart` | `GET /api/booking/cart` | [`public/js/main.js`](../public/js/main.js), [`public/js/cart.js`](../public/js/cart.js) |
| `POST /api/guest/bookings/cart/items` | `POST /api/booking/cart` | [`public/js/cart.js`](../public/js/cart.js) |
| `DELETE /api/guest/bookings/cart/items` | `DELETE /api/booking/cart` | [`public/js/cart.js`](../public/js/cart.js) |
| `GET /api/guest/bookings` | `GET /api/booking/bookings` | [`public/js/main.js`](../public/js/main.js) |
| *(checkout flow)* | `POST /api/booking/checkout` *(reference doc has no direct equivalent; use payments `order` in platform)* | [`public/js/cart.js`](../public/js/cart.js) |

### Guest payments (Razorpay)

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `POST /api/guest/payments/order` | *Not implemented as `/order`* — checkout is `POST /api/booking/checkout` | [`public/js/cart.js`](../public/js/cart.js) |
| `POST /api/guest/payments/verify` | `POST /api/payment/verify` | [`public/js/cart.js`](../public/js/cart.js) |
| `POST /api/guest/payments/webhook` | `POST /api/payment/razorpay-webhook` | *(Razorpay server-to-server; raw body wired in [`server.js`](../server.js))* |

### Public inquiries

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `POST /api/inquiries` | *Not implemented* | — |

### Admin — properties, managers, inquiries (platform)

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `GET/POST/PATCH/DELETE /api/admin/property...` | *Not implemented* | — |
| `GET/POST/PATCH/DELETE /api/admin/managers...` | *Not implemented* | — |
| `GET/PATCH/DELETE /api/admin/inquiries...` | *Not implemented* | — |

### Admin — bookings (overlap)

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `GET /api/admin/bookings` | `GET /api/admin/bookings` | [`public/js/admin.js`](../public/js/admin.js) |
| `PATCH /api/admin/bookings/:bookingId` | `PATCH /api/admin/bookings/:bookingId` | [`public/js/admin.js`](../public/js/admin.js) |
| *(not in reference quick list)* | `DELETE /api/admin/bookings/:bookingId` | [`public/js/admin.js`](../public/js/admin.js) |

### Admin — rooms & pricing (platform “manager” vs this app’s “admin JWT”)

In `api.md`, many of these live under `/api/manager/rooms`. **Misty Hut** implements the same style of operations under **`/api/admin`** with JWT middleware.

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `PUT /api/manager/rooms/base-price` | `PUT /api/admin/base-price` | [`public/js/admin.js`](../public/js/admin.js) |
| `GET/POST/DELETE .../seasonal-price` | `GET/POST/DELETE /api/admin/seasonal-price...` | [`public/js/admin.js`](../public/js/admin.js) |
| `GET/POST/DELETE .../block-dates` | `GET/POST/DELETE /api/admin/block-dates...` | [`public/js/admin.js`](../public/js/admin.js) |
| `POST /api/manager/rooms/cloudinary-room-signature` | `GET /api/admin/cloud-signature` *(method/path differ)* | [`public/js/admin.js`](../public/js/admin.js) |
| `GET/PATCH .../rooms/:roomId/images...` | `GET/PATCH /api/admin/rooms/:roomId/...` | [`public/js/admin.js`](../public/js/admin.js) |

### Manager namespace (subscription, property card, manager bookings)

| Reference (`api.md`) | Misty Hut (current) | Consumers |
|---------------------|---------------------|-----------|
| `GET /api/manager/property` | *Not implemented* | — |
| `POST /api/manager/subscription/*`, `GET .../status` | *Not implemented* | — |
| `GET /api/manager/bookings`, `PATCH ...` | *Not implemented* *(admin uses `/api/admin/bookings`)* | [`public/js/admin.js`](../public/js/admin.js) for admin-only UI |

---

## 3. Frontend consumer index (by file)

| File | Calls |
|------|--------|
| [`public/js/main.js`](../public/js/main.js) | `/api/auth/status`, `/api/auth/logout`, `/api/auth/google`, `/api/booking/checkAvailability`, `/api/booking/cart`, `/api/booking/bookings`, `/api/booking/rooms` |
| [`public/js/cart.js`](../public/js/cart.js) | `/api/auth/status`, `/api/auth/google`, `/api/booking/cart`, `/api/booking/checkout`, `/api/payment/verify` |
| [`public/js/admin.js`](../public/js/admin.js) | `/api/admin/login`, `/api/admin/verify-otp`, `/api/admin/logout`, `/api/admin/base-price`, `/api/admin/seasonal-price`, `/api/admin/block-dates`, `/api/admin/bookings`, `/api/admin/cloud-signature`, `/api/admin/rooms/*`, `/api/booking/rooms` |

---

## 4. Next steps (when aligning with `api.md`)

1. Add missing routes incrementally (e.g. `GET /health`, guest JWT flows) **or** publish a **Misty Hut–specific** OpenAPI/README that lists only [`server.js`](../server.js) routes.
2. If renaming paths, register **duplicate routes** for one release cycle, then update [`public/js/`](../public/js/) using the tables above.
