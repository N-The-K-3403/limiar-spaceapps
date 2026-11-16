import { lazy, Suspense } from 'react'
import { Cite } from './bits.jsx'

const MarkdownContent = lazy(() => import('./MarkdownContent.jsx'))

// One chat message, shared by the floating drawer and the Ask tab. Model messages carry an "AI-written" label (hard rule 4).
export default function ChatMessage({ m, kb, onCite }) {
  return (
    <div className={'msg ' + (m.role === 'user' ? 'me' : '')}>
      <div className="who">
        {m.role === 'user' ? 'You' : m.role === 'error' ? 'Not available' : 'Limiar'}
        {m.role === 'model' && <span className="chip lav" style={{ marginLeft: 8 }}>AI-written</span>}
      </div>
      {m.role === 'user' ? (
        <div className="bubble">{m.text}</div>
      ) : m.role === 'error' ? (
        <div className="callout bad">{m.text}</div>
      ) : (
        <div className="prose">
          <Suspense fallback={<div className="note">Formatting response…</div>}>
            <MarkdownContent text={m.text} kb={kb} onCite={onCite} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
