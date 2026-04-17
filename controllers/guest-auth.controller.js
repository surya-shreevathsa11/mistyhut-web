import crypto from "crypto";
import User from "../models/user.model.js";
import { GuestPin } from "../models/guest-pin.model.js";
import { getPropertyPublic, getPropertySlug } from "../config/property.js";
import { signGuestToken } from "../utils/guest-jwt.util.js";
import { sendGuestPinEmail } from "../utils/resend.util.js";

function hashPin(pin) {
  return crypto.createHash("sha256").update(pin, "utf8").digest("hex");
}

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email) {
  const s = String(email || "");
  const at = s.indexOf("@");
  if (at < 1) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const vis = local.slice(0, Math.min(2, local.length));
  return `${vis}***@${domain}`;
}

export async function requestGuestPin(req, res) {
  try {
    const { propertySlug, email, name } = req.body || {};
    if (!propertySlug || !email || !name) {
      return res.status(400).json({
        message: "propertySlug, email, and name are required",
      });
    }
    if (String(propertySlug).toLowerCase() !== getPropertySlug()) {
      return res.status(404).json({ message: "Property not found" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const pin = generatePin();
    const pinHash = hashPin(pin);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await GuestPin.deleteMany({
      email: normalizedEmail,
      propertySlug: getPropertySlug(),
    });
    await GuestPin.create({
      email: normalizedEmail,
      propertySlug: getPropertySlug(),
      pinHash,
      expiresAt,
    });

    try {
      await sendGuestPinEmail(normalizedEmail, name, pin);
    } catch (e) {
      console.error("sendGuestPinEmail:", e);
      return res.status(503).json({
        message: "Could not send email. Check RESEND_API_KEY and configuration.",
      });
    }

    const property = getPropertyPublic();
    return res.status(200).json({
      success: true,
      property,
      emailMasked: maskEmail(normalizedEmail),
    });
  } catch (error) {
    console.error("requestGuestPin", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function verifyGuestPin(req, res) {
  try {
    const { propertySlug, email, name, pin } = req.body || {};
    if (!propertySlug || !email || !pin) {
      return res.status(400).json({
        message: "propertySlug, email, and pin are required",
      });
    }
    if (String(propertySlug).toLowerCase() !== getPropertySlug()) {
      return res.status(404).json({ message: "Property not found" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const record = await GuestPin.findOne({
      email: normalizedEmail,
      propertySlug: getPropertySlug(),
    }).sort({ createdAt: -1 });

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ message: "PIN expired or not found" });
    }

    if (hashPin(String(pin).trim()) !== record.pinHash) {
      return res.status(401).json({ message: "Invalid PIN" });
    }

    await GuestPin.deleteMany({
      email: normalizedEmail,
      propertySlug: getPropertySlug(),
    });

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
      });
    } else if (name && user.name !== name) {
      user.name = name;
      await user.save();
    }

    const token = signGuestToken(user._id);
    const property = getPropertyPublic();
    const expiresIn = process.env.GUEST_JWT_EXPIRES_IN || "7d";

    return res.status(200).json({
      success: true,
      token,
      tokenType: "Bearer",
      expiresIn: String(expiresIn),
      guest: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      property,
    });
  } catch (error) {
    console.error("verifyGuestPin", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
