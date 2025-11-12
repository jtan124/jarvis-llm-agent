import { callGemini } from "./gemini.js";
import { buildIntentPrompt } from "../prompts/intentPrompt.js";
import { extractJson } from "../utils/jsonExtractor.js";

export async function detectIntent(context) {
  try {
    const prompt = buildIntentPrompt(context);
    
    console.log("🤖 Calling Gemini for intent detection...");
    
    const geminiResponse = await callGemini(prompt);
    const parsed = extractJson(geminiResponse);

    if (!parsed || typeof parsed !== "object") {
      console.error("❌ Failed to parse Gemini response:", geminiResponse?.substring(0, 200));
      return {
        targeted: false,
        reason: "Failed to parse LLM response"
      };
    }

    // Validate response structure
    if (parsed.targeted === undefined) {
      console.error("❌ Missing 'targeted' field in response");
      return {
        targeted: false,
        reason: "Invalid response structure"
      };
    }

    if (!parsed.targeted) {
      return {
        targeted: false,
        reason: parsed.reason || "Message not for Jarvis"
      };
    }

    // Ensure intents is always an array
    if (!parsed.intents || !Array.isArray(parsed.intents)) {
      console.error("❌ Invalid intents structure");
      return {
        targeted: false,
        reason: "Invalid response structure - missing intents array"
      };
    }

    // Validate each intent has required fields
    for (const intent of parsed.intents) {
      if (!intent.intent || !intent.confidence) {
        console.error("❌ Invalid intent structure:", intent);
        return {
          targeted: false,
          reason: "Invalid intent structure"
        };
      }
    }

    console.log("✅ Intent detection complete:", {
      targeted: parsed.targeted,
      num_intents: parsed.intents.length,
      intents: parsed.intents.map(i => i.intent)
    });

    return parsed;
    
  } catch (err) {
    console.error("❌ Intent detection failed:", err);
    
    // Return safe fallback
    return {
      targeted: false,
      reason: `Error: ${err.message}`
    };
  }
}