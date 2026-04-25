# Frontend API Contract (Prompt-Ready)

This is a frontend-first API contract for Misty Hut booking flows.
It includes only endpoints used by frontend runtime code (`public/js/main.js`, `public/js/cart.js`, `public/js/api-config.js`).

Use this document as a source prompt to recreate the same API behavior in another backend service.

---

## 1) Runtime context and global rules

### API base and routing
- Base URL used by frontend client: `https://api.varalabs.in` (or `window._MISTY_API_BASE_` override).
- Property slug expected by frontend: `misty-hut`.
- All payloads are JSON.
- Frontend sends `Content-Type: application/json` when body is present.

### Auth model
- Public routes: no auth token.
- Guest routes: `Authorization: Bearer <guest_jwt>`.
- Frontend stores JWT and guest profile in localStorage:
  - token key: `misty_guest_jwt`
  - user key: `misty_guest_user`

### Status handling pattern expected by frontend
- `2xx`: treat as success, parse JSON body.
- `401`: treated as "please sign in again" for guest/cart/booking routes.
- non-`2xx`: frontend expects JSON with `message` where possible.

---

## 2) Endpoint inventory (exact paths used)

### Public (no auth)
- `GET /api/public/properties/misty-hut/rooms`
- `POST /api/public/properties/misty-hut/quote`

### Guest auth (no auth)
- `POST /api/guest-auth/request-pin`
- `POST /api/guest-auth/verify-pin`

### Guest booking/cart (Bearer token required)
- `POST /api/guest/bookings/quote`
- `GET /api/guest/bookings/cart`
- `POST /api/guest/bookings/cart/items`
- `DELETE /api/guest/bookings/cart/items`
- `GET /api/guest/bookings`

### Guest payment (Bearer token required)
- `POST /api/guest/payments/order`
- `POST /api/guest/payments/verify`

---

## 3) Detailed endpoint contract

## A. Public catalog and quote

### `GET /api/public/properties/misty-hut/rooms`
Purpose:
- Populate room cards on homepage.
- Provide room allowlist used by frontend validation.
- Provide optional site gallery images.

Expected success shape (minimum fields actually used):
```json
{
  "success": true,
  "rooms": [
    {
      "id": 1,
      "roomId": "R1",
      "name": "ROOM-1",
      "description": "Room description...",
      "price": 4000,
      "images": {
        "banner": "https://...",
        "gallery": ["https://...", "https://..."]
      }
    }
  ],
  "siteGallery": {
    "images": ["https://..."]
  }
}
```

Frontend assumptions:
- `success === true`.
- `rooms` is an array.
- `roomId` preferred; fallback is `"R" + id`.
- If `images.banner` missing, frontend uses fallback image.

---

### `POST /api/public/properties/misty-hut/quote`
Purpose:
- Availability + pricing check when user is logged out.
- Also used to build prepaid options in checkout flow.

Request body:
```json
{
  "roomId": "R1",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD"
}
```

Success payload should include quote fields used by frontend prepaid renderer:
```json
{
  "success": true,
  "prepaidOptions": [
    {
      "id": "saver",
      "label": "Saver",
      "percent": 10,
      "prepaidAmount": 400,
      "refundAvailable": false
    },
    {
      "id": "flexi",
      "label": "Flexi",
      "percent": 30,
      "prepaidAmount": 1200,
      "refundAvailable": true
    }
  ],
  "primaryPrepaidOptionId": "saver"
}
```

Error payload (recommended):
```json
{
  "success": false,
  "message": "Dates not available."
}
```

---

## B. Guest auth

### `POST /api/guest-auth/request-pin`
Purpose:
- Send one-time code to guest email for sign-in.

Request body:
```json
{
  "propertySlug": "misty-hut",
  "email": "guest@example.com",
  "name": "Guest Name"
}
```

Success payload:
```json
{
  "success": true,
  "message": "PIN sent."
}
```

Error payload:
```json
{
  "success": false,
  "message": "Could not send code."
}
```

---

### `POST /api/guest-auth/verify-pin`
Purpose:
- Verify code and return guest JWT + guest profile.

Request body:
```json
{
  "propertySlug": "misty-hut",
  "email": "guest@example.com",
  "pin": "123456",
  "name": "Guest Name"
}
```

Success payload required by frontend:
```json
{
  "success": true,
  "token": "guest_jwt_token",
  "guest": {
    "name": "Guest Name",
    "email": "guest@example.com",
    "avatar": "https://optional-avatar-url"
  }
}
```

Failure payload:
```json
{
  "success": false,
  "message": "Invalid code."
}
```

---

## C. Guest quote/cart/bookings

### `POST /api/guest/bookings/quote`
Purpose:
- Same as public quote, but for logged-in guest flow.
- Frontend auto-switches to this endpoint when guest token exists.

Request body:
```json
{
  "roomId": "R1",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD"
}
```

Response shape:
- Same format as public quote route is preferred.

---

### `GET /api/guest/bookings/cart`
Purpose:
- Load selected rooms on cart page and navbar count.

Frontend accepts either:
- `roomInfo: []` (preferred), or
- `message: []` (legacy fallback).

Recommended success payload:
```json
{
  "success": true,
  "roomInfo": [
    {
      "roomId": "R1",
      "roomName": "ROOM-1",
      "checkIn": "YYYY-MM-DD",
      "checkOut": "YYYY-MM-DD",
      "adults": 2,
      "children": 1,
      "price": 4000,
      "priceBreakdown": [
        {
          "date": "YYYY-MM-DD",
          "price": 4000,
          "reason": "Base price"
        }
      ]
    }
  ]
}
```

Unauthorized:
- return `401`.

---

### `POST /api/guest/bookings/cart/items`
Purpose:
- Add room/date combination to cart.

Request body:
```json
{
  "roomId": "R1",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "adults": 2,
  "children": 1
}
```

Response:
- Any `2xx` JSON is acceptable.
- For failure, include `message`.

---

### `DELETE /api/guest/bookings/cart/items`
Purpose:
- Remove specific cart line.

Request body:
```json
{
  "roomId": "R1",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD"
}
```

Response:
- Any `2xx` JSON is acceptable.

---

### `GET /api/guest/bookings`
Purpose:
- Populate "My Bookings" list in profile modal.

Expected success payload (minimum shape used):
```json
{
  "success": true,
  "data": [
    {
      "status": "pending",
      "totalAmount": 4000,
      "guest": { "name": "Guest Name" },
      "rooms": [
        {
          "roomId": "R1",
          "roomName": "ROOM-1",
          "checkIn": "YYYY-MM-DD",
          "checkOut": "YYYY-MM-DD"
        }
      ]
    }
  ]
}
```

---

## D. Guest payment

### `POST /api/guest/payments/order`
Purpose:
- Create payment order for Razorpay checkout popup.

Request body:
```json
{
  "name": "Guest Name",
  "email": "guest@example.com",
  "phone": "9876543210",
  "prepaidOptionId": "saver",
  "prepaidPercent": 10
}
```

Success payload required by frontend:
```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_xxx",
    "key": "rzp_live_or_test_key",
    "expectedPrepaidAmount": 1200,
    "totalAmount": 4000
  }
}
```

Notes:
- Frontend expects HTTP `201` for success.
- Razorpay amount paid is derived from:
  - `expectedPrepaidAmount` if present
  - otherwise `totalAmount`

---

### `POST /api/guest/payments/verify`
Purpose:
- Verify Razorpay payment signature after checkout success callback.

Request body:
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

Success payload expected by frontend:
```json
{
  "success": true
}
```

On success:
- Frontend redirects to `/?payment=success`.

---

## 4) Quote endpoint compatibility matrix

The frontend has one helper `quoteRoom(...)`:
- logged out: calls `POST /api/public/properties/misty-hut/quote`
- logged in: calls `POST /api/guest/bookings/quote`

To avoid UI inconsistency, keep response schema aligned across both quote endpoints.

---

## 5) Prompt block: replicate this API

Use this directly when prompting another team/service:

```text
Build a JSON API compatible with this frontend contract.

Base:
- Base URL configurable.
- Property slug: misty-hut.
- JSON only.

Auth:
- Public routes: no auth.
- Guest routes: Bearer JWT.
- Return 401 for unauthorized guest access.

Implement these endpoints exactly:
1) GET /api/public/properties/misty-hut/rooms
2) POST /api/public/properties/misty-hut/quote
3) POST /api/guest-auth/request-pin
4) POST /api/guest-auth/verify-pin
5) POST /api/guest/bookings/quote
6) GET /api/guest/bookings/cart
7) POST /api/guest/bookings/cart/items
8) DELETE /api/guest/bookings/cart/items
9) GET /api/guest/bookings
10) POST /api/guest/payments/order
11) POST /api/guest/payments/verify

Critical response requirements:
- verify-pin must return: { success, token, guest }.
- payment-order must return HTTP 201 + data.razorpayOrderId + data.key.
- payment-verify must return { success: true } on valid signature.
- quote responses should include prepaidOptions and primaryPrepaidOptionId.
- cart GET should return roomInfo array (message array fallback tolerated).
- Errors should include user-readable "message".
```

---

## 6) Scope note

- This document intentionally excludes backend code in this repository.
- It describes only the API behavior required by the current frontend.
