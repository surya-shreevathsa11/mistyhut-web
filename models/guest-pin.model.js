import mongoose from "mongoose";

const guestPinSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    propertySlug: { type: String, required: true, lowercase: true },
    pinHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

guestPinSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GuestPin = mongoose.model("GuestPin", guestPinSchema);
