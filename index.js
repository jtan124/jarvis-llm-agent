import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const app = express();
app.use(express.json());

const genai = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// --- helper functions -------------------------------------------------
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function naiveFallbackParse(text) {
  const out = {
    event_name: text.trim().slice(0, 64),
    iso_datetime: "",
    person: "",
    location: "",
  };

  const mWith = text.match(/\bwith\s+([A-Z][a-zA-Z]+)/);
  if (mWith) out.person = mWith[1];
  const mAt = text.match(/\bat\s+([^,]+?)(?:\s+(?:on|at|for)\b|$)/i);
  if (mAt) out.location = mAt[1].trim();

  return out;
}

async function parseWithGemini(text, author, tz) {
  if (!genai) return { data: naiveFallbackParse(text), provider: "fallback", model: "none" };

  const model = genai.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
You are an event parser for a family scheduling assistant.
User message: """${text}"""
Author: ${author}
Assume timezone ${tz || "Asia/Singapore"}.
Return ONLY JSON matching:
{
  "event_name": "string",
  "iso_datetime": "ISO UTC datetime string",
  "person": "string",
  "location": "string"
}
If missing, leave empty strings.
`;

  try {
    const resp = await model.generateContent(prompt);
    const txt = resp?.response?.text?.() || "";
    const parsed = extractJson(txt);
    if (!parsed || typeof parsed !== "object")
      return { data: naiveFallbackParse(text), provider: "fallback", model: GEMINI_MODEL };

    const data = {
      event_name: String(parsed.event_name || ""),
      iso_datetime: String(parsed.iso_datetime || ""),
      person: String(parsed.person || ""),
      location: String(parsed.location || ""),
    };
    return { data, provider: "gemini", model: GEMINI_MODEL };
  } catch (err) {
    console.error("Gemini error:", err.message);
    return { data: naiveFallbackParse(text), provider: "fallback", model: GEMINI_MODEL };
  }
}

// --- routes ------------------------------------------------------------
app.get("/", (_req, res) =>
  res.json({ ok: true, service: "jarvis-llm-agent", model: GEMINI_MODEL })
);

app.post("/parseEvent", async (req, res) => {
  try {
    const { text, author = "Unknown", tz = "Asia/Singapore" } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: "text_required" });

    const result = await parseWithGemini(text, author, tz);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("parseEvent error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// --- startup -----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ LLM Agent running on port ${PORT} (model=${GEMINI_MODEL})`);
});
