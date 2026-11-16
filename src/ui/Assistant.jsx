import { useEffect, useRef, useState } from 'react'
import { askAssistant } from '../lib/assistant.js'
import ChatMessage from './ChatMessage.jsx'

const SUGGEST = {
  planner: ['Explain this plan in plain words', 'Which gap matters most, and why?', 'What would change the prediction?'],
  gaps: ['Why is the joint gap the important one?', 'What is the closest source to my spec?'],
  library: ['Which investigations matter most for a Moon cabin at 30% oxygen?'],
  evidence: ['What does the SoFIE-GEL curve tell us, and what does it not?'],
  estimator: ['Why is this estimate outside the trained domain?'],
  default: ['What is still unknown for partial gravity?', 'Explain this page'],
}

export default function Assistant({ open, onClose, persona, level, openLevel, needLevel, tab, kb, getContext, onCite }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs, busy])

  const send = async (t) => {
    const q = (t ?? text).trim()
    if (!q || busy) return
    const lvl = await needLevel() // first-use pop-up; null = cancelled
    if (!lvl) return
    const next = [...msgs, { role: 'user', text: q }]
    setMsgs(next)
    setText('')
    setBusy(true)
    try {
      const reply = await askAssistant({ messages: next.filter((m) => m.role !== 'error').map(({ role, text }) => ({ role, text })), context: getContext(), persona: lvl })
      setMsgs([...next, { role: 'model', text: reply }])
    } catch (e) {
      setMsgs([...next, { role: 'error', text: String(e.message || e) }])
    } finally {
      setBusy(false)
    }
  }
  const sugg = SUGGEST[tab] || SUGGEST.default

  return (
    <aside className={'drawer' + (open ? ' open' : '')} aria-label="Ask Limiar assistant" inert={!open}>
      <div className="drawer-h">
        <div className="card-h" style={{ marginBottom: 0 }}>
          <span className="eyebrow">Assistant</span>
          <button className="btn sm ghost" onClick={openLevel} title="Change how the assistant explains things">Level: {level || 'Neutral'}</button>
          <span className="grow" />
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <h3>Ask about the evidence.</h3>
        <p className="note">Answers cite their source IDs. If the data does not say, it says “no data”. It only sees your current plan, never the open web.</p>
      </div>
      <div className="msgs" role="log" aria-live="polite">
        {msgs.length === 0 && (
          <div className="sugg">
            {sugg.map((s) => (
              <button key={s} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => <ChatMessage key={i} m={m} kb={kb} onCite={onCite} />)}
        {busy && <div className="note"><span className="spin" /> thinking…</div>}
        <div ref={end} />
      </div>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); send() }}>
        <textarea rows={2} value={text} placeholder="Ask about fuels, oxygen limits, gaps…" aria-label="Question" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>Send</button>
      </form>
    </aside>
  )
}
