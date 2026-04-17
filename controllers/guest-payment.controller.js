import Razorpay from "razorpay";
import crypto from "crypto";
import { Booking } from "../models/booking.model.js";
import { buildCartCheckoutTotals } from "./booking.controller.js";
import { getBookingPrepaidPercent } from "../config/property.js";

export async function guestCreateOrder(req, res) {
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ message: "Mandatory fields must not be empty" });
    }

    const built = await buildCartCheckoutTotals(req.user._id);
    if (built.empty) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    if (built.error === "availability") {
      return res.status(400).json({ message: built.message });
    }
    if (built.error === "calc") {
      return res.status(500).json({ message: built.message });
    }

    const { totalBookingPrice, totalBreakDown } = built;
    const pct = getBookingPrepaidPercent();
    const expectedPrepaidAmount =
      Math.round(totalBookingPrice * (pct / 100) * 100) / 100;

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const receiptId = crypto.randomBytes(6).toString("hex");
    const order = await razorpay.orders.create({
      amount: Math.round(expectedPrepaidAmount * 100),
      currency: "INR",
      receipt: `booking_${receiptId}`,
    });

    const booking = await Booking.create({
      userId: req.user._id,
      guest: { name, email, phone },
      rooms: totalBreakDown,
      totalAmount: totalBookingPrice,
      amountPaid: 0,
      razorpayOrderId: order.id,
      status: "pending",
    });

    return res.status(201).json({
      message:
        "Booking created successfully. Complete the payment to finalize.",
      data: {
        bookingId: booking._id,
        guest: {
          name: booking.guest.name,
          email: booking.guest.email,
          phone: booking.guest.phone,
        },
        rooms: booking.rooms,
        totalAmount: booking.totalAmount,
        prepaidPercentApplied: pct,
        expectedPrepaidAmount,
        amountPaid: booking.amountPaid,
        razorpayOrderId: booking.razorpayOrderId,
        status: booking.status,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("guestCreateOrder", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
