import BookingM from "../models/BookingM.js";
import OTP from "../models/OTP.js";
import EventM from "../models/EventM.js";
import { sendOTPEmail, sendBookingEmail } from "../utils/email.js";

// Helper function to generate a random 6-digit number
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 2. Book Event (User Route)
// ==========================================
export const bookEvent = async (req, res) => {
  try {
    const { eventId, otp } = req.body;

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
    if (event.totalSeats <= 0) {
      return res.status(400).json({ error: "No seats available" });
    }

    // Step C: Duplicate Check
    // Prevent the same user from booking the exact same event multiple times
    const existingBooking = await BookingM.findOne({
      userId: req.user._id,
      eventId,
    });
    if (existingBooking) {
      return res.status(400).json({ error: "You have already booked this event" });
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
    
    res.status(201).json({ message: "Booking created. Please wait for admin confirmation." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 3. Confirm Booking (Admin Route)
// ==========================================
// Architecture Note: This route is strictly for Admins (protected by the admin middleware).
// Itफाइनलizes the booking, deducts the seat inventory, and emails the user.
export const confirmBooking = async (req, res) => {
  try {
    const paymentStatus = req.body.paymentStatus;
    
    // Validate that the admin provided a correct payment status
    if (paymentStatus && !["paid", "non_paid"].includes(paymentStatus)) {
      return res.status(400).json({ error: "Invalid payment Status" });
    }

    // .populate() pulls in the full Event and User documents based on their ObjectIds.
    // We need the User data to know who to email, and Event data for the title/seats.
    const booking = await BookingM.findById(req.params.id)
      .populate("eventId")
      .populate("userId");

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Prevent double-confirmation (which would deduct an extra seat by mistake)
    if (booking.status === "confirmed") {
      return res.status(400).json({ error: "Booking is already confirmed" });
    }

    // Inventory Check 2: Check seats AGAIN. 
    // Someone else might have booked the last seat while this booking was pending.
    const event = await EventM.findById(booking.eventId._id);
    if (event.totalSeats <= 0) {
      return res.status(400).json({ error: "No seats available" });
    }

    // Update the booking status
    booking.status = "confirmed";
    if (paymentStatus) {
      booking.paymentStatus = paymentStatus;
    }
    await booking.save();

    // Deduct the seat from the total inventory to prevent overbooking
    event.totalSeats -= 1;
    await event.save();

    // Send the final confirmation email to the CUSTOMER (booking.userId.email)
    if (booking.userId && booking.userId.email) {
      await sendBookingEmail(booking.userId.email, event.title, booking._id);
    }

    res.json({ message: "Booking Confirmed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const bookings = await BookingM.find({ userId: req.user._id }).populate("eventId");
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 5. Cancel Booking (User Route)
// ==========================================
export const cancelBooking = async (req, res) => {
  try {
    const booking = await BookingM.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    // Security check: Ensure user A cannot cancel user B's booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Store the current status in memory before changing it
    const wasConfirmed = booking.status === "confirmed";

    // Mark as cancelled (Optional depending on your business logic, 
    // we are deleting it entirely below, but updating it first can be useful 
    // if you have database triggers or webhooks listening for changes)
    booking.status = "cancelled";
    await booking.save();

    // Inventory Rollback: If the booking was confirmed, a seat was deducted earlier.
    // We must give that seat back to the event inventory so someone else can buy it.
    if (wasConfirmed) {
      const event = await EventM.findById(booking.eventId);
      if (event) {
        event.totalSeats += 1;
        await event.save();
      }
    }
    
    // Permanently remove the booking record from the database
    await booking.deleteOne();
    
    res.json({ message: "Booking cancelled" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};