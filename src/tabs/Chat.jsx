import { useEffect, useRef, useState } from 'react'
import { askAssistant } from '../lib/assistant.js'
import { MAX_CHATS, MAX_MSGS, loadChats, newChat, saveChats, titleFrom } from '../lib/chats.js'
import ChatMessage from '../ui/ChatMessage.jsx'
import Icon from '../ui/icons.jsx'
import { Eyebrow } from '../ui/bits.jsx'

const STARTERS = [
  'What is this project, in a few sentences?',
  'Which data does it use, and under which licences?',
  'What can MARGIN-Spread say, and what can it not?',
  'What does the Gaps map show?',
]

// Full-page chatbot with saved chats (create, rename, delete). The conversation list lives in localStorage; see src/lib/chats.js.
export default function Chat({ kb, level, openLevel, needLevel, getContext, onCite }) {
  const [chats, setChats] = useState(() => {
    const c = loadChats()
    return c.length ? c : [newChat()]
  })
  const [activeId, setActiveId] = useState(() => chats[0]?.id)
  const [text, setText] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState(null)
  const [note, setNote] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [renameId, setRenameId] = useState(null)
  const [renameText, setRenameText] = useState('')
  const end = useRef(null)

  const active = chats.find((c) => c.id === activeId) || chats[0]
  useEffect(() => saveChats(chats), [chats])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [active?.messages.length, busyId, err])

  const patch = (id, fn) => setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c)))

  const add = () => {
    if (chats.length >= MAX_CHATS) return setNote(`You have ${MAX_CHATS} chats, the limit. Delete one to start another.`)
    const c = newChat()
    setChats((cs) => [c, ...cs])
    setActiveId(c.id)
    setErr(null)
    setNote(null)
  }
  const remove = (id) => {
    const rest = chats.filter((c) => c.id !== id)
    const next = rest.length ? rest : [newChat()]
    setChats(next)
    if (id === activeId) setActiveId(next[0].id)
    setConfirmId(null)
    setErr(null)
  }
  const commitRename = () => {
    if (renameId) patch(renameId, (c) => ({ ...c, title: titleFrom(renameText) }))
    setRenameId(null)
  }

  const send = async (t) => {
    const q = (t ?? text).trim()
    if (!q || busyId || !active) return
    const lvl = await needLevel() // pop-up on first use; null = cancelled
    if (!lvl) return
    const id = active.id
    const msgs = [...active.messages, { role: 'user', text: q }]
    const kept = msgs.slice(-MAX_MSGS)
    setNote(msgs.length > MAX_MSGS ? `Only the last ${MAX_MSGS} messages of a chat are kept.` : null)
    patch(id, (c) => ({ ...c, title: c.messages.length === 0 ? titleFrom(q) : c.title, messages: kept }))
    setText('')
    setErr(null)
    setBusyId(id)
    try {
      const reply = await askAssistant({ messages: kept.map(({ role, text }) => ({ role, text })), context: getContext(), persona: lvl })
      patch(id, (c) => ({ ...c, messages: [...c.messages, { role: 'model', text: reply }].slice(-MAX_MSGS) }))
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <div className="hero">
        <Eyebrow n="07">Assistant</Eyebrow>
        <h1 className="display">Ask about <em>the project</em>.</h1>
        <p className="lede">
          General questions about the project, its data, its models and their limits. It reads a short project brief and, when one exists, your current plan. It does not search the web. Answers are written by AI, cite source IDs where they use them, and say “no data” when the material is silent.
        </p>
      </div>

      <div className="chat">
        <aside className="card chat-list" aria-label="Chats">
          <button className="btn primary" onClick={add}><Icon name="plus" size={14} /> New chat</button>
          <ul>
            {chats.map((c) => (
              <li key={c.id} className={'chat-item' + (c.id === active?.id ? ' on' : '')}>
                {renameId === c.id ? (
                  <input
                    className="chat-rename"
                    autoFocus
                    value={renameText}
                    maxLength={60}
                    aria-label="Chat title"
                    onChange={(e) => setRenameText(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => (e.key === 'Enter' ? commitRename() : e.key === 'Escape' && setRenameId(null))}
                  />
                ) : (
                  <button className="chat-title" title={c.title} onClick={() => { setActiveId(c.id); setErr(null); setConfirmId(null) }}>{c.title}</button>
                )}
                {confirmId === c.id ? (
                  <span className="chat-confirm">
                    Delete?
                    <button className="btn sm" onClick={() => remove(c.id)}>Yes</button>
                    <button className="btn sm ghost" onClick={() => setConfirmId(null)}>No</button>
                  </span>
                ) : (
                  renameId !== c.id && (
                    <span className="chat-act">
                      <button className="ib" title="Rename" aria-label={'Rename ' + c.title} onClick={() => { setRenameId(c.id); setRenameText(c.title) }}><Icon name="edit" size={14} /></button>
                      <button className="ib" title="Delete" aria-label={'Delete ' + c.title} onClick={() => setConfirmId(c.id)}><Icon name="trash" size={14} /></button>
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
          <p className="note">Saved in this browser only.</p>
        </aside>

        <section className="card chat-main" aria-label="Conversation">
          <div className="chat-h">
            <b>{active?.title}</b>
            <span className="grow" />
            <button className="btn sm ghost" onClick={openLevel} title="Change how the assistant explains things"><Icon name="sparkle" size={13} /> Level: {level || 'Neutral'}</button>
          </div>
          <div className="msgs" role="log" aria-live="polite">
            {active?.messages.length === 0 && (
              <div className="sugg">
                <div className="lbl">Try asking</div>
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}
            {active?.messages.map((m, i) => <ChatMessage key={i} m={m} kb={kb} onCite={onCite} />)}
            {busyId === active?.id && <div className="note"><span className="spin" /> thinking…</div>}
            {err && <ChatMessage m={{ role: 'error', text: err }} kb={kb} onCite={onCite} />}
            <div ref={end} />
          </div>
          {note && <p className="note" style={{ margin: '0 0 6px' }}>{note}</p>}
          <form className="ask" onSubmit={(e) => { e.preventDefault(); send() }}>
            <textarea
              rows={2}
              value={text}
              maxLength={4000}
              placeholder="Ask about the project, the data or the models…"
              aria-label="Question"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <button className="btn primary" type="submit" disabled={!!busyId || !text.trim()}>Send</button>
          </form>
        </section>
      </div>
    </div>
  )
}
