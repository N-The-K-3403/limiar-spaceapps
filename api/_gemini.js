// Shared by the Vercel function (api/chat.js) and the Vite dev middleware (vite.config.js).
// The key is read by the caller from the environment and never reaches the browser.

const SYSTEM = `You are the explainer inside "Flame in Freefall", a research tool on microgravity and partial-gravity combustion evidence (NASA PSI data and two papers).

Rules you must follow:
1. Use ONLY the JSON in CONTEXT. Never use outside knowledge for numbers, conditions, or results.
2. Never produce a number that is not in CONTEXT. Do not round, extrapolate, convert, or average on your own.
3. Cite the IDs you rely on in square brackets, exactly as they appear in CONTEXT, e.g. [SAF_VI2] or [GAP_JOINT]. Put the citation right after the sentence it supports.
4. If CONTEXT does not say, write "no data" for that point. Never fill a gap with a guess.
5. Always keep the provenance honest: say "estimated from a figure" or "unreviewed" where CONTEXT marks it so. A model score is an uncalibrated score, not a probability. Validation is retrospective.
6. If an input is outside the trained range, say so before giving the estimate.
7. Do not give safety advice or claim a habitat is safe or unsafe. You describe evidence.
8. Match the reader level in "persona": Student = plain words and one short analogy at most; Professor = precise, compact; Engineer = conditions, units, limits, what to run next.
9. Plain text only, no markdown tables. Short paragraphs. English.`

const clip = (s, n) => (s.length > n ? s.slice(0, n) + '\n[context truncated]' : s)

export async function chatReply({ messages, context, persona, apiKey, model }) {
  if (!Array.isArray(messages) || !messages.length) throw new Error('No messages.')
  const ctx = clip(JSON.stringify(context ?? {}, null, 1), 24000)
  const contents = messages.slice(-12).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.text ?? '').slice(0, 4000) }],
  }))
  const body = {
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\nPersona: ${persona || 'Student'}\n\nCONTEXT:\n${ctx}` }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1100 },
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `Gemini returned HTTP ${res.status}`)
  const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')
  if (!text) throw new Error('Gemini returned no text (it may have been blocked).')
  return text.trim()
}
