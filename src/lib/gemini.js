// ── API key pool ──────────────────────────────────────────────────────────────
// Supports multiple keys for quota fallback.
// Options (in priority order):
//   1. VITE_GEMINI_API_KEYS — comma-separated list: "key1,key2,key3"
//   2. Individual: VITE_GEMINI_API_KEY, VITE_GEMINI_API_KEY_2 … VITE_GEMINI_API_KEY_5
function getApiKeys() {
  const multi = import.meta.env.VITE_GEMINI_API_KEYS
  if (multi?.trim()) return multi.split(',').map(k => k.trim()).filter(Boolean)
  return [
    import.meta.env.VITE_GEMINI_API_KEY,
    import.meta.env.VITE_GEMINI_API_KEY_2,
    import.meta.env.VITE_GEMINI_API_KEY_3,
    import.meta.env.VITE_GEMINI_API_KEY_4,
    import.meta.env.VITE_GEMINI_API_KEY_5,
  ].filter(Boolean)
}

function isQuotaError(e) {
  const m = (e.message ?? '').toLowerCase()
  return m.includes('quota') || m.includes('rate limit') ||
         m.includes('429')   || m.includes('resource_exhausted') ||
         m.includes('retry')
}

const MODEL   = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-3-flash-preview'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
// Convenience aliases (both point to the same URL)
const CHAT_URL  = API_URL
const PARSE_URL = API_URL

// ── Generic fetch with per-key retry ─────────────────────────────────────────
async function fetchWithFallback(url, body) {
  const keys = getApiKeys()
  if (!keys.length) throw new Error('No Gemini API key set — add VITE_GEMINI_API_KEY to .env')

  let lastError
  for (const key of keys) {
    try {
      const res  = await fetch(`${url}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? `Gemini API error ${res.status}`)
      return data
    } catch (e) {
      lastError = e
      if (isQuotaError(e)) continue   // quota hit — try next key
      throw e                         // other error — bail immediately
    }
  }

  throw new Error(
    `All ${keys.length} API key${keys.length > 1 ? 's' : ''} hit quota. ` +
    `Last error: ${lastError?.message}`
  )
}

// ── Rocky chatbot ─────────────────────────────────────────────────────────────
export async function askGemini(context, prompt) {
  const systemPrompt = `
You are the AI Assistant for "YROCK Nexus", an operations management hub.
Your goal is to help the user manage their tasks, events, and program flows.

DATA CONTEXT:
${JSON.stringify(context, null, 2)}

STRICT GUARD RAILS:
1. ONLY answer questions related to the DATA CONTEXT provided above or general operations management (scheduling, tasks, team coordination).
2. If the user asks about unrelated topics (e.g., jokes, general knowledge, coding, cooking, politics, or personal advice), politely refuse and redirect them to ask about the YROCK operations.
3. NEVER make up data that isn't in the context. If a task or event isn't there, say you can't find it.
4. Do not provide information about yourself or the underlying model unless it relates to how you can help with Nexus.

INSTRUCTIONS:
1. Use the DATA CONTEXT above to answer all questions.
2. Be concise and professional.
3. If the user asks for a summary, use bullet points.
4. If the user asks to "draft a message", provide a telegram-ready message.
5. If you don't know the answer or the data isn't there, just say so.
6. The date today is ${new Date().toDateString()}.
  `

  const data = await fetchWithFallback(CHAT_URL, {
    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser Question: ${prompt}` }] }],
  })

  return data.candidates[0].content.parts[0].text
}

// ── Program flow parsing ──────────────────────────────────────────────────────
const PARSE_PROMPT = `You are extracting a church service program flow schedule into structured JSON.

Parse the input and return a JSON array. Each element must have exactly these fields:
- "title": string — segment/activity name (keep original text, e.g. "Praise & Worship")
- "start_time": string — HH:MM 24-hour format (e.g. "08:00", "14:30")
- "end_time": string — HH:MM 24-hour format
- "duration": number — duration in minutes as integer
- "assignee": string — person(s) or ministry responsible. Multiple with " / " separator. Empty string if none.
- "notes": string — additional notes. Empty string if none.
- "color": string — one of exactly: blue, green, purple, red, orange, pink, yellow, slate

Color guidelines:
- Worship / praise / music / song → "purple"
- Prayer / devotion / quiet time → "blue"
- Announcements / admin / offering / collection → "yellow"
- Teaching / sermon / message / Word → "green"
- Games / icebreaker / activities → "orange"
- Special / highlight moment → "red"
- Transition / intermission / break → "pink"
- Other / default → "slate"

Strict rules:
1. If end_time missing, calculate from start_time + duration.
2. If duration missing, calculate from end_time - start_time.
3. Normalize all times to HH:MM 24-hour (e.g. "8:00am"→"08:00", "2:30 PM"→"14:30", "8"→"08:00").
4. Columns labeled "PIC", "In-Charge", "Person in Charge", "Presenter", "Speaker", "By", "Leader", "Team" → extract value to "assignee" field.
5. Multiple assignees: join with " / ".
6. Sort rows by start_time ascending.
7. Skip rows with no time and no title (headers, empty rows, totals).
8. Return ONLY a valid JSON array. No markdown fences, no explanation.`

async function callGeminiParse(parts) {
  const data = await fetchWithFallback(PARSE_URL, {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  })

  const raw   = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed
  try { parsed = JSON.parse(clean) } catch {
    throw new Error('AI returned invalid JSON. Try again or use a clearer image.')
  }

  if (!Array.isArray(parsed)) {
    const firstArr = Object.values(parsed).find(v => Array.isArray(v))
    if (firstArr) return firstArr
    throw new Error('AI response was not an array. Please try again.')
  }

  return parsed
}

/**
 * Parse program flow from an image (whiteboard, printed schedule, photo).
 * @param {string} base64   base64-encoded image (no data: prefix)
 * @param {string} mimeType e.g. "image/jpeg"
 */
export async function parseProgramFromImage(base64, mimeType) {
  return callGeminiParse([
    { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
    { text: PARSE_PROMPT },
  ])
}

/**
 * Parse program flow from plain text / CSV (e.g. exported Google Sheet).
 * @param {string} text raw text or CSV content
 */
export async function parseProgramFromText(text) {
  return callGeminiParse([
    { text: `${PARSE_PROMPT}\n\nInput data to parse:\n\n${text}` },
  ])
}
