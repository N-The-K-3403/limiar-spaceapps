// Vercel serverless function: POST /api/chat  { messages: [{role, text}], context, persona }
import { chatReply } from './_gemini.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'The assistant is not connected: GEMINI_API_KEY is not set on the server.' })
  try {
    const { messages = [], context = null, persona = 'Student' } = req.body || {}
    const text = await chatReply({ messages, context, persona, apiKey, model: process.env.GEMINI_MODEL || undefined })
    return res.status(200).json({ text })
  } catch (e) {
    return res.status(502).json({ error: String(e?.message || e) })
  }
}
