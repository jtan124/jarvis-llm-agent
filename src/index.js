import express from "express";
import intentDetectionRouter from "./routes/intentDetection.js";

const PORT = process.env.PORT || 8080;
const app = express();

// Increase payload limit for large context packages
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "jarvis-llm-agent",
    version: "2.0.0",
    endpoints: ["/detectIntent"],
    gemini_configured: !!process.env.GEMINI_API_KEY
  });
});

// Routes
app.use("/", intentDetectionRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    ok: false,
    error: "Internal server error"
  });
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`✅ LLM Agent running on port ${PORT}`);
  console.log(`✅ Gemini configured: ${!!process.env.GEMINI_API_KEY}`);
}).on('error', (err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});