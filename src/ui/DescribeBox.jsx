import { useState } from 'react'
import { parseSpecText } from '../lib/assistant.js'
import { download } from '../lib/rank.js'
import Icon from './icons.jsx'

// "Describe it in words" box, shared by the Planner and the Estimator.
// Props:
//   target      'planner' | 'estimator' (sent to the parser, picks the examples)
//   current     the form state object (raw values)
//   setCurrent  state setter for that object (accepts an updater function)
//   fields      display meta [{ key, label, show(value) }] for the chips
//   toPatch     (parsed, current) -> { patch, notes }  builds the change for this specific form
// Trust rules: every change is shown as old -> new, labelled with how it was read (AI or rules), and can be undone.
// Anything the text did not state is listed as "not stated, kept", never guessed.
const EXAMPLES = {
  planner: [
    'Thin acrylic film in a lunar habitat at 10.2 psi and 30% oxygen, will the flame spread?',
    'PMMA sphere in microgravity, 21% oxygen, 1 atm, 10 cm/s airflow: where does it extinguish?',
    'Cotton fabric inside a spacesuit, does it ignite?',
  ],
  estimator: [
    'Filter paper at 30% oxygen, 70 kPa, Mars gravity',
    'Thin acrylic film in air at 1 atm on the Moon',
    '0.125 mm PMMA, 25% O2, 80 kPa, 0.1 g',
  ],
}

const same = (a, b) => (a === '' || a === null || a === undefined ? a === b || (b === '' || b === null || b === undefined) : String(a) === String(b) || Number(a) === Number(b))

export default function DescribeBox({ target, current, setCurrent, fields, toPatch }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)

  const run = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    setRes(null)
    try {
      const parsed = await parseSpecText(text, target, current)
      const { patch, notes } = toPatch(parsed, current)
      const changed = []
      const already = []
      for (const f of fields) {
        if (!(f.key in patch)) continue
        if (same(current[f.key], patch[f.key])) already.push({ ...f, to: patch[f.key] })
        else changed.push({ ...f, from: current[f.key], to: patch[f.key] })
      }
      const kept = fields.filter((f) => !(f.key in patch)).map((f) => ({ ...f, value: current[f.key] }))
      const applied = { ...current, ...patch }
      setRes({ parsed, notes, changed, already, kept, snapshot: current, applied, text: text.trim() })
      setCurrent((s) => ({ ...s, ...patch }), { parsed, patch })
    } catch (e) {
      setRes({ error: String(e.message || e) })
    } finally {
      setBusy(false)
    }
  }

  const undo = () => {
    if (res?.snapshot) setCurrent(res.snapshot)
    setRes(null)
  }
  const stale = res?.applied ? JSON.stringify(current) !== JSON.stringify(res.applied) : false
  const modeLabel = res?.parsed?.mode === 'ai' ? 'read by AI (Gemini)' : 'read by rules, no AI'
  const exportSpec = () =>
    download(
      'experiment_spec.json',
      JSON.stringify({ target, read_by: res.parsed.mode === 'ai' ? 'AI (Gemini), validated' : 'built-in rules, no AI', description: res.text, spec: res.applied, assumptions: [...res.notes, ...res.parsed.assumptions] }, null, 1),
      'application/json',
    )

  return (
    <div className="describe">
      <div className="describe-h">
        <Icon name="sparkle" size={15} />
        <b>Describe it in words</b>
        <span className="note">The form below fills in. You can edit every value afterwards.</span>
      </div>
      <textarea
        className="describe-ta"
        rows={3}
        maxLength={1500}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && run()}
        placeholder={EXAMPLES[target]?.[0] || 'Describe the experiment…'}
        aria-label="Describe the experiment in plain language"
      />
      <div className="describe-row">
        <div className="describe-ex">
          <span className="lbl">Try</span>
          {(EXAMPLES[target] || []).map((ex) => (
            <button key={ex} type="button" className="ex" title={ex} onClick={() => setText(ex)}>{ex}</button>
          ))}
        </div>
        <button className="btn primary" disabled={busy || !text.trim()} onClick={run}>
          {busy ? (<><span className="spin" /> Reading…</>) : (<><Icon name="sparkle" size={14} /> Fill the form</>)}
        </button>
      </div>

      {res?.error && <div className="callout bad" style={{ marginTop: 10 }}>{res.error}</div>}

      {res?.parsed && (
        <div className="understood" role="status">
          <div className="u-h">
            <span className="lbl">What I understood</span>
            <span className={'chip ' + (res.parsed.mode === 'ai' ? 'lav' : '')}><Icon name={res.parsed.mode === 'ai' ? 'sparkle' : 'list'} size={12} /> {modeLabel}</span>
            <span className="grow" />
            {!stale && <button className="btn sm ghost" onClick={undo}><Icon name="undo" size={13} /> Undo</button>}
            <button className="btn sm ghost" onClick={exportSpec}><Icon name="download" size={13} /> Spec (JSON)</button>
          </div>
          {res.parsed.aiError && <p className="note">AI parser unavailable ({res.parsed.aiError}). The built-in rules read the text instead.</p>}
          {stale && <p className="note">You edited the form after this was filled, so Undo is off. The summary below shows what was read.</p>}
          {res.changed.length > 0 ? (
            <div className="u-chips">
              {res.changed.map((c) => (
                <span key={c.key} className="uc" title={res.parsed.mode === 'ai' ? 'filled by AI, check it' : 'filled by rules, check it'}>
                  {res.parsed.mode === 'ai' && <Icon name="sparkle" size={11} />}
                  <i>{c.label}</i> {c.from === '' || c.from === null || c.from === undefined ? 'not set' : c.show(c.from)} <em>→</em> <b>{c.show(c.to)}</b>
                </span>
              ))}
            </div>
          ) : (
            <p className="note">{res.already.length ? 'Everything the text stated was already set.' : 'Nothing in that text matched an input. Try a value with its unit, such as "30% oxygen", "70 kPa" or "0.165 g".'}</p>
          )}
          {res.already.length > 0 && res.changed.length > 0 && <p className="note">Already set: {res.already.map((a) => `${a.label} ${a.show(a.to)}`).join(' · ')}.</p>}
          {res.kept.length > 0 && <p className="note"><b>Not stated, kept:</b> {res.kept.map((k) => `${k.label} ${k.show(k.value)}`).join(' · ')}.</p>}
          {[...res.notes, ...res.parsed.assumptions].length > 0 && (
            <p className="note"><b>Assumptions:</b> {[...res.notes, ...res.parsed.assumptions].join(' ')}</p>
          )}
          {res.parsed.dropped.length > 0 && <p className="note bad-t"><b>Ignored:</b> {res.parsed.dropped.join(' ')}</p>}
        </div>
      )}
    </div>
  )
}
