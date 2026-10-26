import express from "express";
import { createLead, getLeads } from "../controllers/leadController.js";
import { admin, protect } from "../middleware/authM.js";

const router = express.Router();

router.post("/", createLead);
router.get("/", protect, admin, getLeads);

export default router;
