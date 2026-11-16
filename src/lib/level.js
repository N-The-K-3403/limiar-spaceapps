// Explanation level for the assistant. Chosen once in a pop-up before the first AI use, saved in localStorage.
// Module-level store so App, the drawer and the Ask tab all see the same value (useSyncExternalStore).
export const LEVELS = [
  { key: 'Neutral', blurb: 'Plain and balanced. No assumptions about your background.' },
  { key: 'Student', blurb: 'Everyday words, terms explained, at most one short analogy.' },
  { key: 'Professor', blurb: 'Precise and compact. Assumes a combustion or fluid-physics background.' },
  { key: 'Engineer', blurb: 'Conditions, units, limits, and what to run next.' },
]
const KEY = 'limiar.level'
const valid = (v) => LEVELS.some((l) => l.key === v)

const read = () => {
  try {
    const v = window.localStorage.getItem(KEY)
    return valid(v) ? v : null
  } catch {
    return null
  }
}

let current = read()
const listeners = new Set()

export const subscribeLevel = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const getLevel = () => current
export function setLevel(v) {
  if (!valid(v)) return
  current = v
  try {
    window.localStorage.setItem(KEY, v)
  } catch {
    /* storage can be blocked; the choice then lasts for this visit only */
  }
  listeners.forEach((fn) => fn())
}
