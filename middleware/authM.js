import jwt from "jsonwebtoken";
import User from "../models/User.js";

// User Authentication Middleware
export const protect = async (req, res, next) => {
  let token =
    req.headers.authorization && req.headers.authorization.startsWith("Bearer")
      ? req.headers.authorization.split(" ")[1]
      : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Not Authorized, User not found.." });
      }
      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, Token failed" });
    }
  } else {
    return res.status(401).json({ message: "Not Authorized, No Token" });
  }
};

// Admin Authorization Middleware
export const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden, Admin access required" });
  }
};
