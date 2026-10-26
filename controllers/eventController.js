import EventM from "../models/EventM.js";
import BookingM from "../models/BookingM.js";
import mongoose from "mongoose";
import handleServerError from "../utils/handleServerError.js";

const eventFields = [
  "title",
  "description",
  "date",
  "location",
  "category",
  "totalSeats",
  "ticketPrice",
  "imageUrl",
];

const validateEventInput = (body, partial = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Event details are required." };
  }

  const data = {};
  for (const field of eventFields) {
    if (body[field] === undefined) {
      if (!partial) return { error: `${field} is required.` };
      continue;
    }

    const value = body[field];
    if (["title", "description", "location", "category"].includes(field)) {
      if (typeof value !== "string" || !value.trim()) {
        return { error: `${field} must be a non-empty string.` };
      }
      const normalizedValue = value.trim();
      const maxLength =
        field === "description" ? 5000 : field === "location" ? 200 : 120;
      if (normalizedValue.length > maxLength) {
        return { error: `${field} cannot exceed ${maxLength} characters.` };
      }
      data[field] = normalizedValue;
      continue;
    }

    if (field === "date") {
      if (typeof value !== "string") {
        return { error: "date must be a valid date." };
      }
      const date = new Date(value);
      if (!value || Number.isNaN(date.getTime())) {
        return { error: "date must be a valid date." };
      }
      data.date = date;
      continue;
    }

    if (field === "totalSeats" || field === "ticketPrice") {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return { error: `${field} must be a valid number.` };
      }
      if (
        field === "totalSeats" &&
        (!Number.isInteger(number) || number < 1)
      ) {
        return { error: "totalSeats must be a positive whole number." };
      }
      if (field === "ticketPrice" && number < 0) {
        return { error: "ticketPrice cannot be negative." };
      }
      data[field] = number;
      continue;
    }

    if (field === "imageUrl") {
      if (typeof value !== "string" || value.length > 2048) {
        return { error: "imageUrl must be a valid HTTP or HTTPS URL." };
      }
      try {
        const imageUrl = new URL(value);
        if (!["http:", "https:"].includes(imageUrl.protocol)) {
          return { error: "imageUrl must be a valid HTTP or HTTPS URL." };
        }
        data.imageUrl = imageUrl.toString();
      } catch {
        return { error: "imageUrl must be a valid HTTP or HTTPS URL." };
      }
    }
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: "At least one event field must be provided." };
  }

  return { data };
};

// Get all events with optional query filters
export const getAllEvents = async (req, res) => {
  try {
    const filters = {};
    if (req.query.category) {
      filters.category = req.query.category;
    }
    if (req.query.location) {
      filters.location = req.query.location;
    }
    if (req.query.ticketPrice) {
      filters.ticketPrice = req.query.ticketPrice;
    }

    const events = await EventM.find(filters);
    res.json(events);
  } catch (error) {
    return handleServerError(res, error, "Error loading events");
  }
};

// Get single event by ID (renamed to match routes import)
export const getEventById = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid event ID." });
  }

  try {
    const event = await EventM.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    return handleServerError(res, error, "Error loading event");
  }
};

// Create a new event
export const createEvent = async (req, res) => {
  const { data, error } = validateEventInput(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const event = await EventM.create({
      ...data,
      availableSeats: data.totalSeats,
      createdBy: req.user._id, // required field — set from the logged-in admin
    });
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: "We couldn't create the event." });
  }
};

// Update an existing event
export const updateEvent = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid event ID." });
  }

  const { data, error } = validateEventInput(req.body, true);
  if (error) return res.status(400).json({ error });

  try {
    if (data.totalSeats !== undefined) {
      const confirmedBookings = await BookingM.countDocuments({
        eventId: req.params.id,
        status: "confirmed",
      });
      if (data.totalSeats < confirmedBookings) {
        return res.status(400).json({
          error: "totalSeats cannot be less than the number of confirmed bookings.",
        });
      }
      data.availableSeats = data.totalSeats - confirmedBookings;
    }

    const event = await EventM.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true, runValidators: true },
    );
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "We couldn't update the event." });
  }
};

// Delete an event
export const deleteEvent = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid event ID." });
  }

  try {
    const event = await EventM.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    return handleServerError(res, error, "Error deleting event");
  }
};
