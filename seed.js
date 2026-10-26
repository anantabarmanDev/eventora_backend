import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

import User from "./models/User.js";
import EventM from "./models/EventM.js";
import BookingM from "./models/BookingM.js";
import OTP from "./models/OTP.js";

dotenv.config();

// ─────────────────────────────────────────────
// Connect to MongoDB
// ─────────────────────────────────────────────
await mongoose.connect(process.env.MONGODB_URL);
console.log("✅ Connected to MongoDB");

// ─────────────────────────────────────────────
// Wipe existing data (clean slate)
// ─────────────────────────────────────────────
await Promise.all([
    User.deleteMany(),
    EventM.deleteMany(),
    BookingM.deleteMany(),
    OTP.deleteMany(),
]);
console.log("🗑️  Cleared existing data");

// ─────────────────────────────────────────────
// 1. USERS
// ─────────────────────────────────────────────
const salt = await bcrypt.genSalt(10);

const hashedAdminPass = await bcrypt.hash("Admin@123", salt);
const hashedUserPass1 = await bcrypt.hash("User@1234", salt);
const hashedUserPass2 = await bcrypt.hash("User@1234", salt);
const hashedUserPass3 = await bcrypt.hash("User@1234", salt);

const [admin, alice, bob, carol] = await User.insertMany([
    {
        name: "Admin",
        email: "admin@eventora.com",
        password: hashedAdminPass,
        role: "admin",
        isVerified: true,
    },
    {
        name: "Alice Johnson",
        email: "alice@example.com",
        password: hashedUserPass1,
        role: "user",
        isVerified: true,
    },
    {
        name: "Bob Smith",
        email: "bob@example.com",
        password: hashedUserPass2,
        role: "user",
        isVerified: true,
    },
    {
        name: "Carol Davis",
        email: "carol@example.com",
        password: hashedUserPass3,
        role: "user",
        isVerified: true,
    },
]);
console.log("👤 Users created:", [admin, alice, bob, carol].map(u => u.email).join(", "));

// ─────────────────────────────────────────────
// 2. EVENTS
// ─────────────────────────────────────────────
const events = await EventM.insertMany([
    {
        title: "Mumbai Tech Summit 2025",
        description:
            "Join India's leading technology conference featuring keynotes from top industry leaders, hands-on workshops, and networking opportunities across AI, Cloud, and Web3.",
        date: new Date("2025-03-15"),
        location: "Bombay Exhibition Centre, Mumbai",
        category: "Technology",
        totalSeats: 500,
        availableSeats: 500,
        ticketPrice: 1499,
        imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
        createdBy: admin._id,
    },
    {
        title: "Sunburn Music Festival",
        description:
            "Asia's biggest electronic dance music festival returns with world-class DJs, stunning light shows, and an electrifying atmosphere. Three days of non-stop music and fun.",
        date: new Date("2025-04-05"),
        location: "Candolim Beach, Goa",
        category: "Music",
        totalSeats: 5000,
        availableSeats: 4850,
        ticketPrice: 3999,
        imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
        createdBy: admin._id,
    },
    {
        title: "IPL Opening Ceremony & Match",
        description:
            "Witness the spectacular opening ceremony of IPL followed by the first match of the season. Enjoy live performances, fireworks, and top-class cricket action.",
        date: new Date("2025-03-28"),
        location: "Wankhede Stadium, Mumbai",
        category: "Sports",
        totalSeats: 33000,
        availableSeats: 32000,
        ticketPrice: 800,
        imageUrl: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800",
        createdBy: admin._id,
    },
    {
        title: "India Art Fair 2025",
        description:
            "South Asia's leading art fair, showcasing contemporary and modern works from over 70 galleries across India and the world. Open to collectors, enthusiasts, and curious minds.",
        date: new Date("2025-05-10"),
        location: "NSIC Exhibition Grounds, New Delhi",
        category: "Art",
        totalSeats: 1200,
        availableSeats: 1100,
        ticketPrice: 499,
        imageUrl: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800",
        createdBy: admin._id,
    },
    {
        title: "Bangalore Food & Wine Festival",
        description:
            "A curated celebration of India's finest cuisines and wines. Meet celebrity chefs, attend cooking masterclasses, and taste award-winning food and beverages.",
        date: new Date("2025-04-20"),
        location: "Palace Grounds, Bengaluru",
        category: "Food",
        totalSeats: 2000,
        availableSeats: 1950,
        ticketPrice: 999,
        imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
        createdBy: admin._id,
    },
    {
        title: "Stand-Up Comedy Night with Zakir Khan",
        description:
            "India's most beloved stand-up comedian brings his brand new show to Hyderabad. An unforgettable evening of laughter, storytelling, and relatable humour.",
        date: new Date("2025-03-22"),
        location: "Shilpa Kala Vedika, Hyderabad",
        category: "Comedy",
        totalSeats: 800,
        availableSeats: 750,
        ticketPrice: 699,
        imageUrl: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800",
        createdBy: admin._id,
    },
    {
        title: "Startup Pitch Day — Chennai",
        description:
            "A high-energy event where 20 hand-picked startups pitch to a panel of VCs and angel investors. Attend as a founder, investor, or spectator to experience the startup ecosystem.",
        date: new Date("2025-06-01"),
        location: "IIT Madras Research Park, Chennai",
        category: "Business",
        totalSeats: 300,
        availableSeats: 280,
        ticketPrice: 299,
        imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
        createdBy: admin._id,
    },
    {
        title: "Classical Dance Recital — Bharatanatyam",
        description:
            "An enchanting evening of classical Bharatanatyam dance performed by Padma Shri awardee Dr. Leela Samson and her troupe. A rare, soulful cultural experience.",
        date: new Date("2025-05-25"),
        location: "Kamani Auditorium, New Delhi",
        category: "Culture",
        totalSeats: 600,
        availableSeats: 580,
        ticketPrice: 350,
        imageUrl: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=800",
        createdBy: admin._id,
    },
]);
console.log(`🎉 Events created: ${events.length} events`);

// ─────────────────────────────────────────────
// 3. BOOKINGS
// ─────────────────────────────────────────────
const bookings = await BookingM.insertMany([
    // Alice booked Tech Summit (confirmed + paid)
    {
        userId: alice._id,
        eventId: events[0]._id,
        status: "confirmed",
        paymentStatus: "paid",
        amount: events[0].ticketPrice,
    },
    // Alice booked Food Festival (pending)
    {
        userId: alice._id,
        eventId: events[4]._id,
        status: "pending",
        paymentStatus: "non_paid",
        amount: events[4].ticketPrice,
    },
    // Bob booked Sunburn Music Festival (confirmed + paid)
    {
        userId: bob._id,
        eventId: events[1]._id,
        status: "confirmed",
        paymentStatus: "paid",
        amount: events[1].ticketPrice,
    },
    // Bob booked Comedy Night (pending)
    {
        userId: bob._id,
        eventId: events[5]._id,
        status: "pending",
        paymentStatus: "non_paid",
        amount: events[5].ticketPrice,
    },
    // Carol booked IPL Match (confirmed + non_paid)
    {
        userId: carol._id,
        eventId: events[2]._id,
        status: "confirmed",
        paymentStatus: "non_paid",
        amount: events[2].ticketPrice,
    },
]);
console.log(`📋 Bookings created: ${bookings.length} bookings`);

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🌱 Seed complete! Here are your credentials:");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("👑 Admin  → email: admin@eventora.com  | password: Admin@123");
console.log("👤 User 1 → email: alice@example.com   | password: User@1234");
console.log("👤 User 2 → email: bob@example.com     | password: User@1234");
console.log("👤 User 3 → email: carol@example.com   | password: User@1234");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

await mongoose.disconnect();
console.log("🔌 Disconnected from MongoDB");
process.exit(0);
