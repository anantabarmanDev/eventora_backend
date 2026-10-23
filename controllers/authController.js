import User from "../models/User.js";
import OTP from "../models/OTP.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendOTPEmail } from "../utils/email.js";

// Helper function to generate a JSON Web Token (JWT) for authenticated sessions
const generateToken = (id, role) => {
  // Signs the token with the user ID, role, and a secret key, valid for 7 days
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" }); 
};

// ==========================================
// Register User Controller
// ==========================================
export const registerUser = async (req, res) => {
  // Extract user details from the incoming request body
  const { name, email, password } = req.body;

  // 1. Check if the user already exists in the database to prevent duplicates
  let userExists = await User.findOne({ email }); 
  if (userExists) {
    return res.status(400).json({ error: "User already exists" });
  }

  // 2. Generate a secure salt and hash the plain text password
  const salt = await bcrypt.genSalt(10); 
  const hashedPassword = await bcrypt.hash(password, salt); 

  try {
    // 3. Create the new user in the database
    // (Fixed: Removed 'new' keyword to resolve the constructor error, and fixed 'roler' typo)
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user", 
      isVerified: false,
    });

    // 4. Generate a random 6-digit OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); 
    console.log(`OTP for ${email}:${otp}`);

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
    res.status(400).json({ error: error.message });
  }
};

// ==========================================
// Login User Controller
// ==========================================
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // 1. Look up the user by their email address
  let user = await User.findOne({ email });

  if (!user) {
    return res
      .status(400)
      .json({ error: "Invalid credentials, Please Sign up first" });
  }

  // 2. Compare the provided password with the hashed password stored in the database
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res
      .status(400)
      .json({ error: "Invalid credentials, Wrong Password!" });
  }

  // 3. Prevent login if the account is unverified, and issue a fresh OTP
  if (!user.isVerified && user.role === "user") {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

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
};

// ==========================================
// Verify OTP Controller
// ==========================================
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  
  // 1. Look up the specific OTP record for this email
  // (Fixed: Removed accidental spaces around "account_verification")
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
  // (Fixed: Added { new: true } so it returns the updated user document)
  const user = await User.findOneAndUpdate(
    { email }, 
    { isVerified: true },
    { new: true } 
  );
  
  // 4. Clean up the used OTP so it cannot be reused
  await OTP.deleteMany({ email, action: "account_verification" }); 
  
  // 5. Log the user in immediately and send the auth token
  res.json({
    message: "Account verified successfully. You can now log in.",
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  });
};