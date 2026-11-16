// Saved chats for the Ask tab. localStorage only, every access guarded. Errors are never stored (they are shown once, in the UI).
export const MAX_CHATS = 30
export const MAX_MSGS = 40
const KEY = 'limiar.chats'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export const newChat = () => ({ id: uid(), title: 'New chat', created: Date.now(), messages: [] })
export const titleFrom = (t) => String(t).replace(/\s+/g, ' ').trim().slice(0, 40) || 'New chat'

const ok = (c) => c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages)

export function loadChats() {
  try {
    const a = JSON.parse(window.localStorage.getItem(KEY) || '[]')
    return Array.isArray(a)
      ? a
          .filter(ok)
          .slice(0, MAX_CHATS)
          .map((c) => ({ ...c, messages: c.messages.filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string').slice(-MAX_MSGS) }))
      : []
  } catch {
    return []
  }
}

export function saveChats(chats) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(chats.slice(0, MAX_CHATS)))
  } catch {
    /* storage full or blocked: chats then live only until the page closes */
  }
}
