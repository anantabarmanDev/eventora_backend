
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import eventRoutes from "./routes/events.js";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/booking.js";
import leadRoutes from "./routes/leads.js";

dotenv.config();

const {
  MONGODB_URL,
  JWT_SECRET,
  CLIENT_URL,
  EMAIL_USER,
  EMAIL_PASS,
  NODE_ENV,
} = process.env;
const PORT = Number(process.env.PORT || 5000);

if (!MONGODB_URL) {
  throw new Error("MONGODB_URL must be configured.");
}

if (
  !JWT_SECRET ||
  JWT_SECRET !== JWT_SECRET.trim() ||
  JWT_SECRET.length < 32 ||
  JWT_SECRET.startsWith("replace-with-")
) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}

if (!EMAIL_USER || !EMAIL_PASS) {
  throw new Error("EMAIL_USER and EMAIL_PASS must be configured.");
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

if (NODE_ENV === "production" && !CLIENT_URL) {
  throw new Error("CLIENT_URL must be configured in production.");
}

const configuredClientUrl = CLIENT_URL || "http://localhost:5173";
let clientOrigin;
try {
  const parsedClientUrl = new URL(configuredClientUrl);
  if (
    parsedClientUrl.protocol !== "http:" &&
    parsedClientUrl.protocol !== "https:"
  ) {
    throw new Error();
  }
  if (NODE_ENV === "production" && parsedClientUrl.protocol !== "https:") {
    throw new Error();
  }
  clientOrigin = parsedClientUrl.origin;
} catch {
  throw new Error("CLIENT_URL must be a valid HTTP or HTTPS URL.");
}

const app = express();

// Middleware
app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/leads", leadRoutes);

// Do not accept traffic until the database connection is ready.
await mongoose.connect(MONGODB_URL);
console.log("Connected to MongoDB");

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
