import { LEVELS } from '../lib/level.js'
import Icon from './icons.jsx'

// Shown before the first AI action (and when the person clicks the "Level" chip). onPick(key) saves and continues; onClose cancels.
export default function LevelModal({ current, onPick, onClose }) {
  return (
    <div className="peek-back" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card level-modal" role="dialog" aria-modal="true" aria-labelledby="level-title">
        <div className="card-h">
          <Icon name="sparkle" size={16} />
          <h3 id="level-title" style={{ margin: 0 }}>How should the assistant explain things?</h3>
        </div>
        <p className="note" style={{ marginBottom: 12 }}>
          It writes from the evidence in this tool and nothing else. Pick the level you want the explanations at. You can change it any time from the Level button in the assistant.
        </p>
        <div className="level-grid">
          {LEVELS.map((l) => (
            <button key={l.key} className={'level-opt' + (current === l.key ? ' on' : '')} onClick={() => onPick(l.key)}>
              <b>{l.key}</b>
              <span>{l.blurb}</span>
            </button>
          ))}
        </div>
        <div className="card-h" style={{ marginTop: 14, marginBottom: 0 }}>
          <span className="note">Answers are written by AI and label themselves as such.</span>
          <span className="grow" />
          <button className="btn sm ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
