import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { chatReply, parseSpec } from './api/_gemini.js'

// Dev-only twins of api/chat.js and api/parse.js so `npm run dev` has a working assistant and describe box.
// Put GEMINI_API_KEY=... in web/.env.local (gitignored). It is read here, in Node, and never sent to the page.
function devApi(env, debug) {
  const route = (server, path, run) =>
    server.middlewares.use(path, (req, res) => {
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
          send(200, await run(JSON.parse(raw || '{}')))
        } catch (e) {
          send(502, { error: String(e?.message || e) })
        }
      })
    })
  const common = { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || undefined, debug }
  return {
    name: 'dev-api',
    configureServer(server) {
      route(server, '/api/chat', async ({ messages = [], context = null, persona = 'Neutral' }) => ({
        text: await chatReply({ messages, context, persona, ...common }),
      }))
      route(server, '/api/parse', ({ text = '', target = 'planner' }) => parseSpec({ text, target, ...common }))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const debug = mode !== 'production' || env.GEMINI_DEBUG === 'true'
  return { plugins: [react(), devApi(env, debug)] }
})
