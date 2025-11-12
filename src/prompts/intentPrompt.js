export function buildIntentPrompt(context) {
  const {
    current_message,
    conversation_context,
    jarvis_context,
    current_schedule,
    metadata
  } = context;

  const last3Messages = formatMessages(conversation_context?.last_3_messages || []);
  const last3Interactions = formatInteractions(jarvis_context?.last_3_interactions || []);
  const scheduleList = formatSchedule(current_schedule || []);
  const pendingClarification = jarvis_context?.pending_clarification;
  
  const currentDate = metadata?.current_date || new Date().toISOString().split('T')[0];
  const timezone = metadata?.timezone || "Asia/Singapore";

  return `You are an intent classifier for Jarvis, a scheduling assistant bot.

## YOUR TASK (2 STEPS):

### STEP 1: Is this message for Jarvis?
Determine if the current message is intended for Jarvis or just group chatter.

**Indicators message IS for Jarvis:**
- Explicitly mentions "Jarvis"
- Continues a conversation Jarvis started (responding to clarification)
- Contains scheduling intent keywords (add, change, delete, schedule, meeting, etc.)
- Author previously interacted with Jarvis recently

**Indicators message is NOT for Jarvis:**
- Casual chat between group members
- No scheduling context
- Unrelated to calendar/events

### STEP 2: If for Jarvis, what's the intent(s)?

**Intent Categories:**
1. **add** - Create new schedule entry
2. **edit** - Modify existing entry
3. **delete** - Remove entry
4. **clarify** - Responding to Jarvis's clarification request
5. **off_topic** - Unrelated message during clarification
6. **inconclusive** - Unclear/ambiguous

**IMPORTANT: Multiple Intents**
If user message contains MULTIPLE distinct actions, return array of intents.
Example: "change surgery to 3pm and add dinner tomorrow" → [edit, add]

---

## CONTEXT PROVIDED:

**Current Date: ${currentDate}**
**Timezone: ${timezone} (SGT)**
**IMPORTANT: All times are in Singapore Time (SGT/UTC+8). Do NOT convert to UTC.**

**Current Message:**
Author: ${current_message.author}
Text: "${current_message.text}"
Timestamp: ${current_message.timestamp}

**Last 3 Group Messages:**
${last3Messages}

**Last 3 Jarvis Interactions:**
${last3Interactions}

${pendingClarification?.active ? `**⚠️ PENDING CLARIFICATION:**
Event: ${pendingClarification.partial_event?.event_name || "Unknown"}
Missing: ${pendingClarification.missing_fields?.join(", ")}
Status: Waiting for user to provide missing information
` : ""}

**Current Schedule:**
${scheduleList}

---

## DATA EXTRACTION RULES (FOR "ADD" INTENT):

When intent is "add", extract event data in Singapore Time (SGT).

**Date Parsing:**
- "today" → ${currentDate}
- "tomorrow" → ${getTomorrowDate(currentDate)}
- "21 Nov", "Nov 21" → 2025-11-21
- "next Monday" → calculate from ${currentDate}

**Time Parsing (in SGT):**
- "6pm" → 18:00
- "3:30pm" → 15:30
- "10am" → 10:00
- "noon" → 12:00
- "midnight" → 00:00

**ISO Datetime Format (SGT):**
- Format: "YYYY-MM-DDTHH:mm:ss+08:00"
- Examples:
  - "tomorrow at 6pm" → "${getTomorrowDate(currentDate)}T18:00:00+08:00"
  - "today at 10am" → "${currentDate}T10:00:00+08:00"
  - "21 Nov 3pm" → "2025-11-21T15:00:00+08:00"

**CRITICAL: NO UTC CONVERSION**
- User says "6pm" → store as 18:00:00+08:00 (NOT 10:00:00Z)
- User says "10am" → store as 10:00:00+08:00 (NOT 02:00:00Z)
- Always use +08:00 timezone offset

**has_time Flag:**
- true: if time mentioned (e.g., "6pm", "10am")
- false: if ONLY date mentioned (e.g., "tomorrow", "21 Nov")

**Person Detection:**
- "I have dinner" → person = ${current_message.author}
- "John has meeting" → person = "John"
- "dinner with Christine" → person = ${current_message.author}, event_name = "Dinner with Christine"

---

## OUTPUT FORMAT (JSON only):

{
  "targeted": true|false,
  "intents": [
    {
      "intent": "add|edit|delete|clarify|off_topic|inconclusive",
      "confidence": 0.0-1.0,
      "reason": "Brief explanation",
      "metadata": {
        "extracted_data": {
          "event_name": "string",
          "iso_datetime": "YYYY-MM-DDTHH:mm:ss+08:00 or empty",
          "person": "string",
          "location": "string",
          "has_time": true|false
        }
      }
    }
  ]
}

## EXAMPLES:

**Example 1: "add dinner tomorrow at 6pm"**
Current date: 2025-11-12
Output:
{
  "targeted": true,
  "intents": [{
    "intent": "add",
    "confidence": 0.95,
    "reason": "User wants to add dinner tomorrow at 6pm SGT",
    "metadata": {
      "extracted_data": {
        "event_name": "Dinner",
        "iso_datetime": "2025-11-13T18:00:00+08:00",
        "person": "Ben",
        "location": "",
        "has_time": true
      }
    }
  }]
}

**Example 2: "meeting today at 3pm"**
Current date: 2025-11-12
Output:
{
  "targeted": true,
  "intents": [{
    "intent": "add",
    "confidence": 0.95,
    "reason": "User wants to add meeting today at 3pm SGT",
    "metadata": {
      "extracted_data": {
        "event_name": "Meeting",
        "iso_datetime": "2025-11-12T15:00:00+08:00",
        "person": "Ben",
        "location": "",
        "has_time": true
      }
    }
  }]
}

**Example 3: "surgery 21 Nov" (no time)**
Output:
{
  "targeted": true,
  "intents": [{
    "intent": "add",
    "confidence": 0.90,
    "reason": "User wants to add surgery on 21 Nov, no time specified",
    "metadata": {
      "extracted_data": {
        "event_name": "Surgery",
        "iso_datetime": "2025-11-21T00:00:00+08:00",
        "person": "Ben",
        "location": "",
        "has_time": false
      }
    }
  }]
}

**Example 4: "I have lunch with Christine tomorrow"**
Current date: 2025-11-12
Output:
{
  "targeted": true,
  "intents": [{
    "intent": "add",
    "confidence": 0.92,
    "reason": "User has lunch with Christine tomorrow",
    "metadata": {
      "extracted_data": {
        "event_name": "Lunch with Christine",
        "iso_datetime": "2025-11-13T00:00:00+08:00",
        "person": "Ben",
        "location": "",
        "has_time": false
      }
    }
  }]
}

**Example 5: "change surgery to 3pm"**
Output:
{
  "targeted": true,
  "intents": [{
    "intent": "edit",
    "confidence": 0.92,
    "reason": "User wants to change surgery time to 3pm",
    "metadata": {
      "target_event_name": "Surgery",
      "action": "update_time",
      "extracted_data": {
        "new_time": "3pm"
      }
    }
  }]
}

**Example 6: "Solis Paragon" (clarification)**
Context: Bot asked for location
Output:
{
  "targeted": true,
  "intents": [{
    "intent": "clarify",
    "confidence": 0.98,
    "reason": "User providing missing location",
    "metadata": {
      "field": "location",
      "value": "Solis Paragon"
    }
  }]
}

**Example 7: "Anyone want coffee?" (not for Jarvis)**
Output:
{
  "targeted": false,
  "reason": "Casual group conversation, no scheduling intent"
}

Now analyze the provided context and classify the current message. Return ONLY the JSON response.`;
}

function getTomorrowDate(currentDate) {
  const date = new Date(currentDate);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function formatMessages(messages) {
  if (!messages || messages.length === 0) return "None";
  return messages.map((msg, idx) => {
    const speaker = msg.is_bot ? "Jarvis (BOT)" : msg.author;
    return `${idx + 1}. ${speaker}: "${msg.text}"`;
  }).join("\n");
}

function formatInteractions(interactions) {
  if (!interactions || interactions.length === 0) return "None";
  return interactions.map((int, idx) => {
    return `${idx + 1}. ${int.author || "User"}: "${int.user_message}" → Intent: ${int.intent} → Status: ${int.workflow_state}`;
  }).join("\n");
}

function formatSchedule(schedule) {
  if (!schedule || schedule.length === 0) return "Empty";
  return schedule.map((ev, idx) => {
    return `${idx + 1}. ${ev.event_name} - ${ev.person} - ${ev.date} ${ev.time} - ${ev.location}`;
  }).join("\n");
}