import User from "../models/user.model.js";
import { getPropertySlug } from "../config/property.js";
import { verifyGuestToken } from "../utils/guest-jwt.util.js";

/**
 * Requires Authorization: Bearer <guest JWT> (api.md guest routes).
 * Sets req.user to the Mongoose User document (same as Passport session).
 */
export default async function requireGuestJwt(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization required" });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: "Authorization required" });
  }
  try {
    const payload = verifyGuestToken(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const slug = getPropertySlug();
    if (payload.propertySlug && payload.propertySlug !== slug) {
      return res.status(403).json({ message: "Invalid property scope" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
