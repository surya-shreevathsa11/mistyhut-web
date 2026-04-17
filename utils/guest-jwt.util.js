import jwt from "jsonwebtoken";
import { getPropertySlug } from "../config/property.js";

function getSecret() {
  return process.env.GUEST_JWT_SECRET || process.env.SESSION_SECRET;
}

export function signGuestToken(userId, propertySlug = getPropertySlug()) {
  const secret = getSecret();
  if (!secret) {
    throw new Error("GUEST_JWT_SECRET or SESSION_SECRET must be set");
  }
  return jwt.sign(
    { sub: String(userId), propertySlug },
    secret,
    { expiresIn: process.env.GUEST_JWT_EXPIRES_IN || "7d" },
  );
}

export function verifyGuestToken(token) {
  const secret = getSecret();
  if (!secret) {
    throw new Error("GUEST_JWT_SECRET or SESSION_SECRET must be set");
  }
  return jwt.verify(token, secret);
}
