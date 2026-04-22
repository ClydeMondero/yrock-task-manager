const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

export async function askGemini(context, prompt) {
  if (!API_KEY) {
    throw new Error("Gemini API key not found. Please set VITE_GEMINI_API_KEY in your .env file.");
  }

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
  `;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nUser Question: ${prompt}`
          }
        ]
      }
    ]
  };

  const response = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to contact Gemini");
  }

  return data.candidates[0].content.parts[0].text;
}
