import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

let genai = null;

// Initialize Gemini with validation
try {
  if (GEMINI_API_KEY) {
    genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("✅ Gemini initialized successfully");
  } else {
    console.warn("⚠️ GEMINI_API_KEY not set - running in fallback mode");
  }
} catch (err) {
  console.error("❌ Failed to initialize Gemini:", err);
}

export async function callGemini(prompt) {
  if (!genai) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY environment variable.");
  }

  const model = genai.getGenerativeModel({ model: GEMINI_MODEL });

  try {
    const resp = await model.generateContent(prompt);
    const text = resp?.response?.text?.() || "";
    
    if (!text) {
      throw new Error("Empty response from Gemini");
    }
    
    return text;
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    throw new Error(`Gemini API failed: ${err.message}`);
  }
}