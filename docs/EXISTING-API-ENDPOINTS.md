# Existing API Endpoints Used by Frontend

This document lists only the API endpoints that are actually called by frontend code (`public/js/main.js` and `public/js/cart.js`).

Configured API base in frontend client (`public/js/api-config.js`):
- `https://api.varalabs.in`

Property slug used by frontend:
- `misty-hut`

---

## 1) Public endpoints (no auth)

- `GET /api/public/properties/misty-hut/rooms`
- `POST /api/public/properties/misty-hut/quote` *(used when guest token is not present)*

## 2) Guest auth endpoints (no auth)

- `POST /api/guest-auth/request-pin`
- `POST /api/guest-auth/verify-pin`

## 3) Guest booking/cart endpoints (Bearer token)

- `POST /api/guest/bookings/quote` *(used when guest token is present)*
- `GET /api/guest/bookings/cart`
- `POST /api/guest/bookings/cart/items`
- `DELETE /api/guest/bookings/cart/items`
- `GET /api/guest/bookings`

## 4) Guest payment endpoints (Bearer token)

- `POST /api/guest/payments/order`
- `POST /api/guest/payments/verify`

---

## 5) Common request payloads used in frontend

### Request PIN
```json
{
  "propertySlug": "misty-hut",
  "email": "guest@example.com",
  "name": "Guest Name"
}
```

### Verify PIN
```json
{
  "propertySlug": "misty-hut",
  "email": "guest@example.com",
  "pin": "123456",
  "name": "Guest Name"
}
```

### Add cart item
```json
{
  "roomId": "R1",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "adults": 2,
  "children": 1
}
```

### Remove cart item
```json
{
  "roomId": "R1",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD"
}
```

### Create payment order
```json
{
  "name": "Guest Name",
  "email": "guest@example.com",
  "phone": "9876543210",
  "prepaidOptionId": "standard",
  "prepaidPercent": 30
}
```

### Verify payment
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

---

## Notes

- This file intentionally excludes backend route definitions and any endpoint not referenced by current frontend flows.
- `quoteRoom(...)` in frontend resolves to:
  - `POST /api/public/properties/misty-hut/quote` when logged out
  - `POST /api/guest/bookings/quote` when logged in
