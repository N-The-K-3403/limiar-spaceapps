// Mini range bar: the trained span as a plasma band, a marker where the current value sits.
// Inside (boundary included) = quiet. Outside = ember marker plus a line naming the variable.
export default function DomainBar({ label, unit, value, min, max }) {
  const inside = value >= min && value <= max
  const pad = (max - min) * 0.3
  const lo = Math.min(min, value) - pad
  const hi = Math.max(max, value) + pad
  const pct = (v) => ((v - lo) / (hi - lo)) * 100
  return (
    <div className="dbar">
      <span className="dbar-label">{label}</span>
      <span className="dbar-track">
        <span className="dbar-band" style={{ left: pct(min) + '%', width: pct(max) - pct(min) + '%' }} />
        <span className={'dbar-mark ' + (inside ? 'in' : 'out')} style={{ left: pct(value) + '%' }} />
      </span>
      <span className={'dbar-val mono' + (inside ? '' : ' out')}>
        {Math.round(value * 1000) / 1000}
        {unit ? ' ' + unit : ''}
      </span>
    </div>
  )
}
