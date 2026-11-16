// Vercel serverless function: POST /api/parse  { text, target: 'planner' | 'estimator' }
// Returns { spec, dropped } where spec only holds validated fields (see sanitizeParsed in src/lib/nlspec.js).
import { parseSpec } from './_gemini.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'The assistant is not connected: GEMINI_API_KEY is not set on the server.' })
  try {
    const { text = '', target = 'planner' } = req.body || {}
    const out = await parseSpec({
      text,
      target,
      apiKey,
      model: process.env.GEMINI_MODEL || undefined,
      debug: process.env.GEMINI_DEBUG === 'true',
    })
    return res.status(200).json(out)
  } catch (e) {
    return res.status(502).json({ error: String(e?.message || e) })
  }
}
