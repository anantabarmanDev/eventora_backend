import { Router } from "express";
import { protect, admin } from "../middleware/authM.js";
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/eventController.js";

// Instantiate the router (lowercase 'router')
const router = Router();

// Get All Events
router.get("/", getAllEvents);

// Get event by ID
router.get("/:id", getEventById);

// Create new event (Admin only)
router.post("/", protect, admin, createEvent);

// Update Event (Admin only)
router.put("/:id", protect, admin, updateEvent);

// Delete event (Admin only)
router.delete("/:id", protect, admin, deleteEvent);

export default router;
