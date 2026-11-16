// Shared by the Vercel function (api/chat.js) and the Vite dev middleware (vite.config.js).
// The key is read by the caller from the environment and never reaches the browser.
import { MATERIAL_KEYS, PRESET_IDS, QUESTION_KEYS, sanitizeParsed } from '../src/lib/nlspec.js'

const SYSTEM = `You are Lhai, the AI explainer inside Limiar, a research workspace on microgravity and partial-gravity combustion evidence (NASA PSI data and two papers).

Rules you must follow:
1. Use ONLY the JSON in CONTEXT. Never use outside knowledge for numbers, conditions, or results.
2. Never produce a number that is not in CONTEXT. Do not round, extrapolate, convert, or average on your own.
3. Cite the IDs you rely on in square brackets, exactly as they appear in CONTEXT, e.g. [SAF_VI2] or [GAP_JOINT]. Put the citation right after the sentence it supports.
4. If CONTEXT does not say, write "no data" for that point. Never fill a gap with a guess.
5. Always keep the provenance honest: say "estimated from a figure" or "unreviewed" where CONTEXT marks it so. A model score is an uncalibrated score, not a probability. Validation is retrospective.
6. If an input is outside the trained range, say so before giving the estimate.
7. Do not give safety advice or claim a habitat is safe or unsafe. You describe evidence.
8. Match the reader level in "persona": Neutral = plain, balanced wording, no extra analogy, no assumption about background; Student = plain words and one short analogy at most; Professor = precise, compact; Engineer = conditions, units, limits, what to run next.
9. Plain text only, no markdown tables. Short paragraphs. English.
10. CONTEXT may contain "project_brief" (what the project is, its data, models and limits). Facts taken from it need no ID: write "(project brief)" after the sentence. If a question about the project is not covered by CONTEXT, say it is not covered. Never describe the project's results or limits beyond what the brief states.`

const clip = (s, n) => (s.length > n ? s.slice(0, n) + '\n[context truncated]' : s)

export async function chatReply({ messages, context, persona, apiKey, model }) {
  if (!Array.isArray(messages) || !messages.length) throw new Error('No messages.')
  const ctx = clip(JSON.stringify(context ?? {}, null, 1), 40000)
  const contents = messages.slice(-12).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.text ?? '').slice(0, 4000) }],
  }))
  const body = {
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\nPersona: ${persona || 'Neutral'}\n\nCONTEXT:\n${ctx}` }] },
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

// ---- text -> experiment spec (api/parse.js). The model only READS the text into fields; it never supplies numbers.
const PARSE_SYSTEM = `You convert a short plain-English description of a combustion experiment into JSON fields. You are a reader, not an expert.

Rules:
1. Include a field ONLY if the text states it, or names one of these fixed references: Moon = 0.165 g, Mars = 0.378 g, microgravity / zero-g / weightless = 0 g, Earth = 1 g, air = 21 % O2, 1 atm = 101.325 kPa.
2. Never guess, estimate, or infer a number from context. If a value is not stated, OMIT the key.
3. Convert units: psi x 6.894757 -> kPa; atm x 101.325 -> kPa; mmHg or torr x 0.133322 -> kPa; um / 1000 -> mm; cm x 10 -> mm; m/s x 100 -> cm/s; mm/s / 10 -> cm/s. A fraction such as 1/6 g is 0.1667 g.
4. material_class: pmma_thin_film (thin PMMA / acrylic film), paper_thin (filter paper), fabric (cotton, SIBAL, cloth), pmma_thick (PMMA rod, sphere, slab), liquid_droplet, polymer_smoke (smoke from a heated polymer). Omit it if the material is not one of these.
5. question: spread, extinction (extinction limit), ignition, detection (smoke detection), suppression. Omit if unclear.
6. preset: set it ONLY if the text names that scenario (ISS cabin, spacesuit, early Artemis habitat, lunar habitat, SoFIE-GEL). Do not copy its numbers; just name it.
7. assumptions: at most 3 short strings, only for things you had to interpret. Never put numbers there that are not in the text.
8. Return JSON only.`

const PARSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    material_class: { type: 'STRING', enum: MATERIAL_KEYS },
    thickness_mm: { type: 'NUMBER' },
    o2_pct: { type: 'NUMBER' },
    pressure_kPa: { type: 'NUMBER' },
    gravity_g: { type: 'NUMBER' },
    flow_cms: { type: 'NUMBER' },
    question: { type: 'STRING', enum: QUESTION_KEYS },
    preset: { type: 'STRING', enum: PRESET_IDS },
    assumptions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
}

export async function parseSpec({ text, target, apiKey, model }) {
  const t = String(text || '').trim().slice(0, 1500)
  if (!t) throw new Error('Write a description first.')
  const body = {
    systemInstruction: { parts: [{ text: PARSE_SYSTEM + `\n\nTarget form: ${target === 'estimator' ? 'estimator scenario' : 'experiment planner'}.` }] },
    contents: [{ role: 'user', parts: [{ text: t }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 500, responseMimeType: 'application/json', responseSchema: PARSE_SCHEMA },
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `Gemini returned HTTP ${res.status}`)
  const raw = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')
  if (!raw) throw new Error('Gemini returned no text (it may have been blocked).')
  let obj
  try {
    obj = JSON.parse(raw.replace(/^```json|```$/g, '').trim())
  } catch {
    throw new Error('Gemini did not return valid JSON.')
  }
  // server-side validation: unknown keys, unknown enums and out-of-range numbers never leave this function
  const s = sanitizeParsed(obj)
  return { spec: { ...s.fields, preset: s.preset, assumptions: s.assumptions }, dropped: s.dropped }
}
