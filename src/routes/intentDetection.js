import express from "express";
import { detectIntent } from "../services/intentClassifier.js";

const router = express.Router();

router.post("/detectIntent", async (req, res) => {
  try {
    const {
      current_message,
      conversation_context,
      jarvis_context,
      current_schedule,
      metadata
    } = req.body;

    // Validate required fields
    if (!current_message?.text) {
      return res.status(400).json({
        ok: false,
        error: "current_message.text is required"
      });
    }

    console.log("📨 Intent detection request:", {
      message: current_message.text,
      author: current_message.author,
      has_pending_clarification: !!jarvis_context?.pending_clarification?.active
    });

    const result = await detectIntent({
      current_message,
      conversation_context,
      jarvis_context,
      current_schedule,
      metadata
    });

    return res.json({
      ok: true,
      ...result
    });

  } catch (err) {
    console.error("❌ Intent detection error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: err.message
    });
  }
});

export default router;