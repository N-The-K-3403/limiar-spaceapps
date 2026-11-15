import Icon from './icons.jsx'

// Shared "slider under the number" control (Planner, Estimator Scenario card, Workbench Scenario node).
// Rules: the typed number always wins and is never clamped; the slider only helps you pick a value fast.
// The track shows (a) named reference ticks you can click, (b) a shaded band where we have data, (c) a filled part up to the thumb.
// The thumb turns ember when the value is outside the band, and pins to an end with a "beyond" flag when it is outside the slider span.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const sig3 = (v) => (v === 0 ? 0 : +v.toPrecision(3))

export const posOf = (v, min, max, scale) => {
  if (!Number.isFinite(v)) return 0
  if (scale === 'log') {
    if (v <= 0) return -Infinity
    return (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))
  }
  return (v - min) / (max - min)
}
export const valOf = (p, min, max, scale, step) => {
  if (scale === 'log') return sig3(Math.exp(Math.log(min) + p * (Math.log(max) - Math.log(min))))
  const raw = min + p * (max - min)
  return +(Math.round(raw / step) * step).toFixed(6)
}

// Per-variable slider spans and reference ticks. Spans are ergonomic presets, not model limits.
export const SLIDE = {
  o2_pct: { min: 0, max: 100, step: 0.5, ticks: [{ value: 21, label: 'Air', icon: 'wind' }, { value: 30, label: '30' }, { value: 100, label: 'Pure O\u2082' }] },
  pressure_kPa: { min: 20, max: 110, step: 0.5, ticks: [{ value: 29.6, label: 'Suit' }, { value: 56.5, label: '8.2 psi' }, { value: 70.3, label: '10.2 psi' }, { value: 101.3, label: '1 atm' }] },
  gravity_g: { min: 0, max: 1, step: 0.005, ticks: [{ value: 0, label: 'Micro', icon: 'micro' }, { value: 0.165, label: 'Moon', icon: 'moon' }, { value: 0.378, label: 'Mars', icon: 'mars' }, { value: 1, label: 'Earth', icon: 'earth' }] },
  thickness_mm: { min: 0.05, max: 50, step: 0.01, scale: 'log', ticks: [{ value: 0.125, label: '0.125' }, { value: 1, label: '1' }, { value: 10, label: '10' }] },
  flow_cms: { min: 0.1, max: 100, step: 0.1, scale: 'log', ticks: [{ value: 1, label: '1' }, { value: 10, label: '10' }, { value: 100, label: '100' }] },
}

// merge overlapping [lo, hi] ranges
export function mergeBands(list) {
  const s = list.filter((r) => Array.isArray(r) && r.length === 2).map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) })).sort((x, y) => x.min - y.min)
  const out = []
  for (const r of s) {
    const last = out[out.length - 1]
    if (last && r.min <= last.max) last.max = Math.max(last.max, r.max)
    else out.push({ ...r })
  }
  return out
}

// where measured sources exist on one axis (kb.boxes[].axes[k] = [lo, hi]); k is 'o2' | 'p' | 'g' | 'flow'
export const coverBands = (kb, k) => (kb ? mergeBands(kb.boxes.map((b) => b.axes?.[k]).filter(Boolean)) : [])

export function SliderTrack({ value, onChange, min, max, step = 1, scale = 'linear', ticks = [], bands = [], bandLabel = '', unit = '', label = '', className = '' }) {
  const v = value === '' || value === null || value === undefined ? NaN : Number(value)
  const has = Number.isFinite(v)
  const raw = has ? posOf(v, min, max, scale) : 0
  const p = clamp(Number.isFinite(raw) ? raw : 0, 0, 1)
  const beyond = !has ? '' : raw > 1 + 1e-9 ? 'hi' : raw < -1e-9 ? 'lo' : ''
  const out = has && bands.length > 0 && !bands.some((b) => v >= b.min - 1e-9 && v <= b.max + 1e-9)
  const pct = (x) => clamp(posOf(x, min, max, scale), 0, 1) * 100

  const move = (next) => onChange(clamp(next, min, max))
  const onKey = (e) => {
    const k = e.key
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(k)) return
    e.preventDefault()
    const dir = k === 'ArrowRight' || k === 'ArrowUp' || k === 'PageUp' ? 1 : -1
    const mult = e.shiftKey || k.startsWith('Page') ? 10 : 1
    const cur = has ? v : min
    if (scale === 'log') move(sig3(cur * Math.pow(1.05, dir * mult)))
    else move(+(Math.round((cur + dir * mult * step) / step) * step).toFixed(6))
  }

  return (
    <div className={'sl' + (out ? ' out' : '') + (has ? '' : ' empty') + (beyond ? ' beyond-' + beyond : '') + (className ? ' ' + className : '')}>
      <div className="sl-inner">
        <div className="sl-rail">
          {bands.map((b, i) => (
            <i key={i} className="sl-band" style={{ left: pct(b.min) + '%', width: Math.max(0.8, pct(b.max) - pct(b.min)) + '%' }} title={bandLabel ? `${bandLabel}: ${b.min} to ${b.max} ${unit}` : undefined} />
          ))}
          <i className="sl-fill" style={{ width: p * 100 + '%' }} />
          {ticks.map((t) => (
            <i key={t.value} className="sl-mark" style={{ left: pct(t.value) + '%' }} />
          ))}
        </div>
        <input
          className="sl-input nodrag nowheel"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(p * 1000)}
          aria-label={label || undefined}
          aria-valuetext={has ? `${v} ${unit}`.trim() : 'not set'}
          onKeyDown={onKey}
          onChange={(e) => onChange(valOf(Number(e.target.value) / 1000, min, max, scale, step))}
        />
        {beyond && <span className="sl-flag">{beyond === 'hi' ? 'beyond \u203A' : '\u2039 beyond'}</span>}
        <div className="sl-ticks">
          {ticks.map((t) => {
            const x = pct(t.value)
            return (
              <button key={t.value} type="button" className={'sl-tick nodrag' + (x < 9 ? ' first' : x > 91 ? ' last' : '')} style={{ left: x + '%' }} title={`Set to ${t.value} ${unit}`.trim()} onClick={() => onChange(t.value)}>
                {t.icon && <Icon name={t.icon} size={12} />}
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Number field on top (typing is never clamped), slider under it. Use for the web tabs; the canvas builds its own header and reuses SliderTrack.
export default function SliderField({ label, unit, value, onChange, hint, cfg, bands, bandLabel, min0 = 0, className = '' }) {
  const c = cfg || {}
  return (
    <div className={'sf ' + className}>
      <div className="sf-top">
        <span className="sf-label">
          {label}
          {bands && bands.length > 0 && (
            <span className="sl-key" title={bandLabel}>
              <i /> {bandLabel}
            </span>
          )}
        </span>
        <div className="unit sf-num">
          <input type="number" inputMode="decimal" min={min0} step="any" value={value ?? ''} aria-label={label} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
          {unit && <i>{unit}</i>}
        </div>
      </div>
      <SliderTrack value={value} onChange={onChange} min={c.min} max={c.max} step={c.step} scale={c.scale} ticks={c.ticks} bands={bands} bandLabel={bandLabel} unit={unit} label={label} />
      {hint && <small className="note sf-hint">{hint}</small>}
    </div>
  )
}
