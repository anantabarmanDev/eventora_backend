import express from "express";
import { protect, admin } from "../middleware/authM.js";
import {
  bookEvent,
  sendBookingOTP,
  getAllBookings,
  getMyBookings,
  confirmBooking,
  cancelBookingAsAdmin,
  cancelBooking,
} from "../controllers/bookingController.js";

const router = express.Router();

// Create a new booking
router.post("/", protect, bookEvent);

// Send OTP for booking verification
router.post("/send-otp", protect, sendBookingOTP);

// Get all bookings (Admin only)
router.get("/", protect, admin, getAllBookings);

// Get logged-in user's bookings
router.get("/my", protect, getMyBookings);

// Confirm booking (Admin only)
router.put("/:id/confirm", protect, admin, confirmBooking);

// Cancel a booking as an admin, retaining it in booking history
router.put("/:id/cancel", protect, admin, cancelBookingAsAdmin);

// Cancel a booking
router.delete("/:id", protect, cancelBooking);

export default router;
