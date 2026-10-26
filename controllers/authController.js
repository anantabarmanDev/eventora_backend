import User from "../models/User.js";
import OTP from "../models/OTP.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import { sendOTPEmail } from "../utils/email.js";
import handleServerError from "../utils/handleServerError.js";

const generateOtp = () => randomInt(100000, 1000000).toString();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Helper function to generate a JSON Web Token (JWT) for authenticated sessions
const generateToken = (id, role) => {
  // Signs the token with the user ID, role, and a secret key, valid for 7 days
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ==========================================
// Register User Controller
// ==========================================
export const registerUser = async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body?.password;

  if (!name || name.length > 120) {
    return res.status(400).json({ error: "Please provide a valid name." });
  }
  if (!isValidEmail(email) || email.length > 254) {
    return res.status(400).json({ error: "Please provide a valid email." });
  }
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      error: "Password must be at least 6 characters and no more than 72 bytes.",
    });
  }

  try {
    // 1. Check if the user already exists in the database to prevent duplicates
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }

    // 2. Generate a secure salt and hash the plain text password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create the new user in the database
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
      isVerified: false,
    });

    // 4. Generate a random 6-digit OTP for email verification
    const otp = generateOtp();

    // 5. Save the OTP to the database and send it to the user's email
    await OTP.create({ email, otp, action: "account_verification" });
    await sendOTPEmail(email, otp, "account_verification");

    // 6. Return a success response indicating the user needs to verify their email
    res.status(201).json({
      message:
        "User registered Successfully. Please check your email for OTP to verify your account.",
      email: user.email,
    });
  } catch (error) {
    return handleServerError(res, error, "Error registering user");
  }
};

// ==========================================
// Login User Controller
// ==========================================
export const loginUser = async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body?.password;

  if (
    !isValidEmail(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length === 0 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({ error: "Invalid email or password." });
  }

  try {
    // 1. Look up the user by their email address
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // 2. Compare the provided password with the hashed password stored in the database
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // 3. Prevent login if the account is unverified, and issue a fresh OTP
    if (!user.isVerified && user.role === "user") {
      const otp = generateOtp();

      // Remove any older OTPs to prevent confusion, then save and send the new one
      await OTP.deleteMany({ email, action: "account_verification" });
      await OTP.create({ email, otp, action: "account_verification" });
      await sendOTPEmail(email, otp, "account_verification");

      return res.status(400).json({
        error: "Account not verified. A new OTP has been sent to your email.",
      });
    }

    // 4. If credentials match and account is verified, send user data and login token
    res.json({
      message: "Login Successful",
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return handleServerError(res, error, "Error logging in user");
  }
};

// ==========================================
// Resend Account Verification OTP
// ==========================================
export const resendOtp = async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  if (!isValidEmail(email) || email.length > 254) {
    return res.status(400).json({ error: "Please provide a valid email." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: "Account is already verified" });
    }

    const otp = generateOtp();

    await OTP.deleteMany({ email, action: "account_verification" });
    await OTP.create({ email, otp, action: "account_verification" });
    await sendOTPEmail(email, otp, "account_verification");

    return res.json({
      message: "A new verification code has been sent to your email.",
    });
  } catch (error) {
    return handleServerError(res, error, "Error resending account OTP");
  }
};

// ==========================================
// Verify OTP Controller
// ==========================================
export const verifyOtp = async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const otp = req.body?.otp;

  if (
    !isValidEmail(email) ||
    email.length > 254 ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp)
  ) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  try {
    // 1. Look up the specific OTP record for this email
    const otpRecord = await OTP.findOne({
      email,
      otp,
      action: "account_verification",
    });

    // 2. Reject the request if the OTP is wrong or missing
    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // 3. Mark the user's account as verified in the database
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true },
    );

    // 4. Guard against the rare case where the email doesn't exist in User collection
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 5. Clean up the used OTP so it cannot be reused
    await OTP.deleteMany({ email, action: "account_verification" });

    // 6. Log the user in immediately and send the auth token
    res.json({
      message: "Account verified successfully. You can now log in.",
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return handleServerError(res, error, "Error verifying account OTP");
  }
};
