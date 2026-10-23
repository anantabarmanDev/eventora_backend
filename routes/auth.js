import express from "express";

import {
  registerUser,
  loginUser,
  verifyOtp,
} from "../controllers/authController.js";

const Router = express.Router();

Router.post("/register", registerUser);
Router.post("/login", loginUser);
Router.post("/verify-otp", verifyOtp);

export default Router;