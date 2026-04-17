import { Room } from "../models/pricing.model.js";
import { Cart } from "../models/cart.model.js";
import {
  checkAvailability,
  calculateBookingPrice,
  addToCart,
  deleteRoomFromCart,
  listBookings,
} from "./booking.controller.js";
import {
  assertPropertySlug,
  getBookingPrepaidPercent,
} from "../config/property.js";

export function validatePropertySlugParam(req, res, next) {
  try {
    assertPropertySlug(req.params.propertySlug);
    next();
  } catch {
    return res.status(404).json({ message: "Property not found" });
  }
}

/** POST /quote — shared body handler */
export async function guestQuote(req, res) {
  try {
    const roomInfo = await Room.findOne({ roomId: req.body?.roomId });
    if (!roomInfo) {
      return res.status(400).json({ message: "Room Id required" });
    }

    const { roomId, checkIn, checkOut } = req.body;
    const booking = { roomId, checkIn, checkOut };

    const isRoomAvailable = await checkAvailability(booking);
    if (!Number(Object.keys(isRoomAvailable)[0])) {
      return res.status(400).json({ message: isRoomAvailable[0] });
    }

    const pricing = await calculateBookingPrice(roomId, checkIn, checkOut);
    const pct = getBookingPrepaidPercent();
    const prepaidAmount =
      Math.round(pricing.totalPrice * (pct / 100) * 100) / 100;

    return res.status(200).json({
      roomId,
      checkIn,
      checkOut,
      price: pricing.totalPrice,
      priceBreakdown: pricing.breakdown,
      bookingPrepaidPercent: pct,
      prepaidAmount,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function guestListRooms(_req, res) {
  try {
    const rooms = await Room.find({}).lean();
    const list = rooms.map((r) => ({
      id: parseInt(r.roomId.replace(/\D/g, ""), 10) || r.roomId,
      roomId: r.roomId,
      name: r.name,
      description: r.description,
      type: r.type,
      price: r.pricePerNight,
      capacity: r.capacity,
      images: r.images
        ? { banner: r.images.banner || null, gallery: r.images.gallery || [] }
        : { banner: null, gallery: [] },
    }));
    return res.status(200).json({ success: true, rooms: list });
  } catch (error) {
    console.error("error listing rooms", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
}

/** GET /cart — api.md shape { roomInfo } */
export async function guestListCart(req, res) {
  try {
    const cart = await Cart.find({ userId: req.user._id });
    const roomInfo = cart[0]?.roomInfo ?? [];
    return res.status(200).json({ roomInfo });
  } catch (error) {
    console.error("error listing cart", error);
    return res.status(500).json({ message: "something went wrong" });
  }
}
