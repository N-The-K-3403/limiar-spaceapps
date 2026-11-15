import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { chatReply } from './api/_gemini.js'

// Dev-only twin of api/chat.js so `npm run dev` has a working assistant.
// Put GEMINI_API_KEY=... in web/.env.local (gitignored). It is read here, in Node, and never sent to the page.
function devChat(env) {
  return {
    name: 'dev-chat',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        const send = (code, obj) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        if (req.method !== 'POST') return send(405, { error: 'Use POST.' })
        if (!env.GEMINI_API_KEY) return send(503, { error: 'The assistant is not connected: add GEMINI_API_KEY to web/.env.local and restart the dev server.' })
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', async () => {
          try {
            const { messages = [], context = null, persona = 'Student' } = JSON.parse(raw || '{}')
            const text = await chatReply({ messages, context, persona, apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || undefined })
            send(200, { text })
          } catch (e) {
            send(502, { error: String(e?.message || e) })
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), devChat(env)] }
})
