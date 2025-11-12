export function extractJson(text) {
  if (!text) return null;
  
  // Try to extract JSON from markdown code block
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : text;
  
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("JSON parse error:", err.message);
    return null;
  }
}