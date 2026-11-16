import { PROV_LABEL } from '../graph/defs.js'
import Icon from './icons.jsx'
import DecimalInput from './DecimalInput.jsx'

export const provKey = (p) => (!p ? 'unreviewed' : String(p).startsWith('verified') ? 'verified' : String(p).startsWith('estimated') ? 'estimated' : 'unreviewed')

// provenance is carried by shape (solid / ring / dashed), color only reinforces it
export function Prov({ prov }) {
  const k = provKey(prov)
  return (
    <span className={'chip ' + k}>
      <i className={'dot' + (k === 'estimated' ? ' ring' : k === 'unreviewed' ? ' dash' : '')} />
      {PROV_LABEL[k]}
    </span>
  )
}

const SYM = { inside: 'check', near: 'tilde', outside: 'x', unknown: 'help' }
export function AxisChip({ a }) {
  return (
    <span className={'ax ' + a.status} title={a.detail}>
      {a.label} <Icon name={SYM[a.status]} size={12} />
    </span>
  )
}

// Six-axis glyph next to the match percentage: one vertex per axis, in the same order as the chips.
// filled = inside, half = close, hollow = outside, dashed = not stated. Axes the plan did not use (no airflow asked) are left out.
const HEX_ORDER = ['fuel', 'o2', 'p', 'g', 'flow', 'outcome']
const HEX_TXT = { inside: 'inside', near: 'close', outside: 'outside', unknown: 'not stated' }
export function AxisHex({ axes, size = 30 }) {
  const by = {}
  for (const a of axes || []) by[a.key] = a
  const c = 15
  const R = 10.5
  const pt = (i) => {
    const t = ((-90 + 60 * i) * Math.PI) / 180
    return [c + R * Math.cos(t), c + R * Math.sin(t)]
  }
  const outline = HEX_ORDER.map((_, i) => pt(i).map((n) => n.toFixed(1)).join(',')).join(' ')
  const tip = HEX_ORDER.filter((k) => by[k]).map((k) => `${by[k].label}: ${HEX_TXT[by[k].status]}`).join(' \u00b7 ')
  return (
    <svg className="hx" width={size} height={size} viewBox="0 0 30 30" role="img" aria-label={'Match by axis. ' + tip}>
      <title>{tip}</title>
      <polygon points={outline} className="hx-line" />
      {HEX_ORDER.map((k, i) => {
        const a = by[k]
        if (!a) return null
        const [x, y] = pt(i)
        return (
          <g key={k} className={'hx-v ' + a.status}>
            <circle cx={x} cy={y} r="3.3" className={a.status === 'inside' ? 'hx-fill' : 'hx-ring'} />
            {a.status === 'near' && <path d={`M${x.toFixed(1)},${(y - 3.3).toFixed(1)} A3.3,3.3 0 0 0 ${x.toFixed(1)},${(y + 3.3).toFixed(1)} Z`} className="hx-half" />}
          </g>
        )
      })}
    </svg>
  )
}

export const titleOf = (kb, id) => kb.node(id)?.title || kb.boxes.find((b) => b.id === id)?.title || id

export function Cite({ id, kb, onCite }) {
  return (
    <button type="button" className="cite" title={titleOf(kb, id)} onClick={() => onCite && onCite(id)}>
      {id}
    </button>
  )
}

// text with [ID, ID] tokens turned into citation chips
const TOKEN = /(\[[A-Za-z0-9_\-, ]+\])/g
const IS_TOKEN = /^\[[A-Za-z0-9_\-, ]+\]$/
export function Rich({ text, kb, onCite }) {
  return (
    <>
      {String(text)
        .split(TOKEN)
        .map((p, i) =>
          IS_TOKEN.test(p) ? (
            p
              .slice(1, -1)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((id) => <Cite key={i + id} id={id} kb={kb} onCite={onCite} />)
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
    </>
  )
}

export function Eyebrow({ n, children }) {
  return (
    <div className="eyebrow">
      {n && <b>{n}</b>} {n && '/'} {children}
    </div>
  )
}

export function NumField({ label, unit, value, onChange, min, max, step = 'any', hint, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="unit">
        <DecimalInput value={value ?? ''} placeholder={placeholder} aria-label={label} onChange={onChange} />
        {unit && <i>{unit}</i>}
      </div>
      {hint && <small className="note">{hint}</small>}
    </label>
  )
}

// small modal that shows where a cited ID comes from
export function SourcePeek({ id, kb, onClose }) {
  if (!id) return null
  const n = kb.node(id)
  const b = kb.boxes.find((x) => x.id === id)
  const quote = (n && n.quote) || (b && b.quote)
  const prov = (n && n.prov) || (b && b.prov)
  const links = kb.neighbors(id).slice(0, 8)
  return (
    <div className="peek-back" onClick={onClose}>
      <div className="peek card" role="dialog" aria-label={'Source ' + id} onClick={(e) => e.stopPropagation()}>
        <div className="card-h">
          <span className="chip lav">{id}</span>
          <span className="chip">{(n && n.type) || (b && b.kind) || 'item'}</span>
          {prov && <Prov prov={prov} />}
          <span className="grow" />
          <button className="btn sm ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <h3>{titleOf(kb, id)}</h3>
        <dl className="kv" style={{ marginTop: 10 }}>
          {n?.citation && (<><dt>Citation</dt><dd>{n.citation}</dd></>)}
          {n?.license && (<><dt>License</dt><dd>{n.license}</dd></>)}
          {n?.statement && (<><dt>Statement</dt><dd>{n.statement}</dd></>)}
          {b?.note && (<><dt>Note</dt><dd>{b.note}</dd></>)}
          {quote && (<><dt>Quote</dt><dd className="note">{String(quote).split('||').map((q) => q.trim()).filter(Boolean).slice(0, 3).join('  \u2022  ')}{(n?.page || n?.pages || b?.pages) ? `  (p. ${String(n?.page || n?.pages || b?.pages).split('||')[0]})` : ''}</dd></>)}
          {(n?.source || b) && (<><dt>Source</dt><dd className="note">{n?.source || (b.kind === 'dataset' ? 'computed from the project data files' : 'data/coverage_axes.csv')}</dd></>)}
          {links.length > 0 && (
            <>
              <dt>Linked</dt>
              <dd>
                <ul className="plain" style={{ margin: 0, paddingLeft: 16 }}>
                  {links.map((l, i) => (
                    <li key={i} className="note">
                      {l.dir === 'out' ? l.rel : 'is ' + l.rel + ' of'} {l.node.id} <span className="muted">({String(l.node.title || l.node.id).slice(0, 60)})</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
