import BookingM from "../models/BookingM.js";
import OTP from "../models/OTP.js";
import EventM from "../models/EventM.js";
import { sendOTPEmail, sendBookingEmail } from "../utils/email.js";
import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import handleServerError from "../utils/handleServerError.js";

// Helper function to generate a random 6-digit number
const generateOtp = () => {
  return randomInt(100000, 1000000).toString();
};

// ==========================================
// 1. Send Booking OTP
// ==========================================
// Architecture Note: We use a 2-step booking process. Before a user can book,
// they must verify their intent via email to prevent spam/bot bookings.
export const sendBookingOTP = async (req, res) => {
  try {
    const otp = generateOtp();

    // Security/Cleanup: Remove any existing unverified OTPs for this user
    // to prevent conflicting codes if they click "resend" multiple times.
    await OTP.findOneAndDelete({
      email: req.user.email,
      action: "event_booking",
    });

    // Store the new OTP in the database so we can verify it later
    await OTP.create({
      email: req.user.email,
      otp: otp,
      action: "event_booking",
    });

    // Dispatch the email containing the code
    await sendOTPEmail(req.user.email, otp, "event_booking");
    res.json({ message: "OTP sent to Email" });
  } catch (error) {
    return handleServerError(res, error, "Error sending booking OTP");
  }
};

// ==========================================
// 2. Book Event (User Route)
// ==========================================
export const bookEvent = async (req, res) => {
  try {
    const { eventId, otp } = req.body || {};

    if (
      !mongoose.isValidObjectId(eventId) ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({ error: "A valid event ID and OTP are required." });
    }

    // Step A: Verify Identity
    // Check if the provided OTP matches what is in the database for this specific user
    const otpRecord = await OTP.findOne({
      email: req.user.email,
      otp,
      action: "event_booking",
    });

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Step B: Inventory Check
    // Ensure the event exists and has seats remaining
    const event = await EventM.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    if (event.availableSeats <= 0) {
      return res.status(400).json({ error: "No seats available" });
    }

    // Step C: Duplicate Check
    // Prevent the same user from booking the exact same event multiple times
    const existingBooking = await BookingM.findOne({
      userId: req.user._id,
      eventId,
    });
    if (existingBooking) {
      return res
        .status(400)
        .json({ error: "You have already booked this event" });
    }

    // Step D: Create the Booking Record
    // The booking starts as 'pending'. The seat is NOT deducted yet.
    // We wait for Admin confirmation or Payment before deducting the seat.
    const booking = await BookingM.create({
      userId: req.user._id,
      eventId,
      status: "pending",
      paymentStatus: "non_paid",
      amount: event.ticketPrice,
    });

    // Clean up the used OTP so it cannot be reused for another booking
    await OTP.deleteMany({ email: req.user.email, action: "event_booking" });

    res.status(201).json({
      message: "Booking created. Please wait for admin confirmation.",
    });
  } catch (error) {
    return handleServerError(res, error, "Error creating booking");
  }
};

// ==========================================
// 3. Confirm Booking (Admin Route)
// ==========================================
// Architecture Note: This route is strictly for Admins (protected by the admin middleware).
// It finalizes the booking, deducts the seat inventory, and emails the user.
export const confirmBooking = async (req, res) => {
  try {
    const paymentStatus = req.body.paymentStatus;

    // Validate that the admin provided a correct payment status
    if (
      paymentStatus !== undefined &&
      !["paid", "non_paid"].includes(paymentStatus)
    ) {
      return res.status(400).json({ error: "Invalid payment Status" });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid booking ID." });
    }

    // .populate() pulls in the full Event and User documents based on their ObjectIds.
    // We need the User data to know who to email, and Event data for the title/seats.
    const booking = await BookingM.findById(req.params.id)
      .populate("eventId")
      .populate("userId");

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.status !== "pending") {
      return res
        .status(400)
        .json({ error: `Cannot confirm a ${booking.status} booking.` });
    }

    // Inventory Check 2: Check seats AGAIN.
    // Someone else might have booked the last seat while this booking was pending.
    const event = await EventM.findById(booking.eventId?._id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    if (event.availableSeats <= 0) {
      return res.status(400).json({ error: "No seats available" });
    }

    // Update the booking status
    booking.status = "confirmed";
    if (paymentStatus) {
      booking.paymentStatus = paymentStatus;
    }
    await booking.save();

    // totalSeats is the event's capacity; only availableSeats changes.
    event.availableSeats -= 1;
    await event.save();

    // Send the final confirmation email to the CUSTOMER
    // Signature: sendBookingEmail(userEmail, userName, eventTitle)
    if (booking.userId && booking.userId.email) {
      await sendBookingEmail(
        booking.userId.email,
        booking.userId.name,
        event.title,
      );
    }

    res.json({ message: "Booking Confirmed" });
  } catch (error) {
    return handleServerError(res, error, "Error confirming booking");
  }
};

// ==========================================
// Get All Bookings (Admin Route)
// ==========================================
export const getAllBookings = async (req, res) => {
  try {
    const bookings = await BookingM.find()
      .populate("eventId", "title date ticketPrice")
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    return handleServerError(res, error, "Error loading bookings");
  }
};

// ==========================================
// 4. Get My Bookings (User Route)
// ==========================================
export const getMyBookings = async (req, res) => {
  try {
    // Find all bookings belonging to the currently logged-in user.
    // .populate("eventId") fetches the actual event details (title, date, etc.)
    // so the frontend can display them without making a second API call.
    const bookings = await BookingM.find({ userId: req.user._id }).populate(
      "eventId",
    );
    res.json(bookings);
  } catch (error) {
    return handleServerError(res, error, "Error loading user's bookings");
  }
};

// Admin cancellation keeps the booking record for the admin's history.
export const cancelBookingAsAdmin = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid booking ID." });
    }

    const booking = await BookingM.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled" });
    }

    if (booking.status === "confirmed") {
      const event = await EventM.findById(booking.eventId);
      if (event) {
        event.availableSeats = Math.min(
          event.totalSeats,
          (event.availableSeats ?? 0) + 1,
        );
        await event.save();
      }
    }

    booking.status = "cancelled";
    await booking.save();

    return res.json({ message: "Booking cancelled", booking });
  } catch (error) {
    return handleServerError(res, error, "Error cancelling booking");
  }
};

// ==========================================
// 5. Cancel Booking (User Route)
// ==========================================
export const cancelBooking = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid booking ID." });
    }

    const booking = await BookingM.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Security check: Ensure user A cannot cancel user B's booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled" });
    }

    const wasConfirmed = booking.status === "confirmed";
    booking.status = "cancelled";
    await booking.save();

    if (wasConfirmed) {
      const event = await EventM.findById(booking.eventId);
      if (event) {
        event.availableSeats = Math.min(
          event.totalSeats,
          (event.availableSeats ?? 0) + 1,
        );
        await event.save();
      }
    }

    return res.json({ message: "Booking cancelled", booking });
  } catch (error) {
    return handleServerError(res, error, "Error cancelling user's booking");
  }
};
