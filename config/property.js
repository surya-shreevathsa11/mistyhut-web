/**
 * Single-property defaults for Misty Hut (aligns with api.md propertySlug).
 * Override with PROPERTY_SLUG, PROPERTY_ID, PROPERTY_NAME in env.
 */
export function getPropertySlug() {
  return (process.env.PROPERTY_SLUG || "misty-hut").toLowerCase().trim();
}

export function getPropertyPublic() {
  return {
    id: process.env.PROPERTY_ID || "000000000000000000000001",
    slug: getPropertySlug(),
    name: process.env.PROPERTY_NAME || "Misty Hut Stays",
  };
}

export function assertPropertySlug(slug) {
  if (!slug || String(slug).toLowerCase() !== getPropertySlug()) {
    const err = new Error("Property not found");
    err.statusCode = 404;
    throw err;
  }
}

/** 1–100; used for quote + Razorpay order amount (prepaid portion). */
export function getBookingPrepaidPercent() {
  const n = Number(process.env.BOOKING_PREPAID_PERCENT ?? 100);
  if (Number.isNaN(n) || n < 1 || n > 100) return 100;
  return Math.round(n);
}
