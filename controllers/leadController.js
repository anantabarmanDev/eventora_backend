import Lead from "../models/Lead.js";

export const createLead = async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const message = req.body.message?.trim();

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: "Name, email, and message are required." });
  }

  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    return res.status(400).json({ error: "One or more fields are too long." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email." });
  }

  try {
    await Lead.create({ name, email, message });
    return res.status(201).json({
      message: "Thanks for reaching out. We'll get back to you shortly.",
    });
  } catch (error) {
    console.error("Error saving contact lead:", error);
    return res.status(500).json({ error: "We couldn't save your message." });
  }
};

export const getLeads = async (_req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    return res.json(leads);
  } catch (error) {
    console.error("Error loading contact leads:", error);
    return res.status(500).json({ error: "We couldn't load the leads." });
  }
};
