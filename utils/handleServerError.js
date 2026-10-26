const handleServerError = (res, error, context) => {
  console.error(`${context}:`, error);
  return res.status(500).json({ error: "Internal server error." });
};

export default handleServerError;
