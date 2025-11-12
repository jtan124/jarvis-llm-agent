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

  const prompt = `You are an event parser for a family scheduling assistant.

CRITICAL RULES:
1. ONLY extract information EXPLICITLY stated in the user message
2. NEVER invent, guess, or hallucinate dates, times, or any other information
3. If the user does NOT mention a date, leave "iso_datetime" as an empty string
4. If the user does NOT mention a time, leave "iso_datetime" as an empty string
5. If the user does NOT mention a location, leave "location" as an empty string
6. If the user does NOT mention a person, leave "person" as an empty string
7. Fix obvious typos in location names (e.g., "homr" → "home")
8. Handle relative dates: "today", "tomorrow", "tonight"

Current date: ${new Date().toISOString().split('T')[0]}
Today is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

User message: """${text}"""
Author: ${author}
Timezone: ${tz || "Asia/Singapore"}

Extract ONLY what is EXPLICITLY mentioned:
- If user says "9am" but NO date → "iso_datetime" should be EMPTY
- If user says "21 Nov" but NO time → "iso_datetime" should have date with time as 00:00:00
- If user says "today at 6pm" → parse "today" as current date + 6pm
- If user says "tomorrow" → use tomorrow's date
- If user says "tonight" → use today's date + evening time (if specified)
- If user says "dinner" → "event_name" is "Dinner"
- If user says "homr" → "location" is "home" (fix typo)

Return ONLY JSON:
{
  "event_name": "string or empty",
  "iso_datetime": "ISO UTC datetime string or empty",
  "person": "string or empty",
  "location": "string or empty"
}

Examples:
User: "9am" → {"event_name": "", "iso_datetime": "", "person": "", "location": ""}
User: "21 Nov" → {"event_name": "", "iso_datetime": "2025-11-21T00:00:00Z", "person": "", "location": ""}
User: "surgery 21 Nov 9am at Solis" → {"event_name": "Surgery", "iso_datetime": "2025-11-21T01:00:00Z", "person": "", "location": "Solis"}
User: "dinner today at 6pm" → {"event_name": "Dinner", "iso_datetime": "<today's date>T10:00:00Z", "person": "", "location": ""}
User: "Ben dinner at homr today at 6pm" → {"event_name": "Dinner", "iso_datetime": "<today's date>T10:00:00Z", "person": "Ben", "location": "home"}
User: "meeting tomorrow" → {"event_name": "Meeting", "iso_datetime": "<tomorrow's date>T00:00:00Z", "person": "", "location": ""}
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