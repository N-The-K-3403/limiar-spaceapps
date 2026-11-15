import { LUNAR_BOUNDS } from '../lib/plan.js'

// O2 (linear) against pressure (log): every measured source and dataset as a box, the lunar-habitat target dashed,
// the spec as a cross. Sources that do not state both axes are listed below the map, never drawn.
const W = 760
const H = 440
const M = { l: 58, r: 16, t: 14, b: 46 }
const X0 = 0
const X1 = 45
const Y0 = 10
const Y1 = 350
const X_TICKS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]
const Y_TICKS = [10, 20, 50, 100, 200, 350]

const sx = (v) => M.l + ((v - X0) / (X1 - X0)) * (W - M.l - M.r)
const sy = (v) => H - M.b - ((Math.log(v) - Math.log(Y0)) / (Math.log(Y1) - Math.log(Y0))) * (H - M.t - M.b)

const regimeOf = (g) => (!g ? 'earth' : g[1] < 0.02 ? 'micro' : g[0] < 0.8 ? 'partial' : 'earth')

export default function CoverageMap({ kb, spec, hot = [], picked, onPick }) {
  const plotted = kb.boxes.filter((b) => b.axes.o2 && b.axes.p)
  const hidden = kb.boxes.filter((b) => !(b.axes.o2 && b.axes.p))
  const me = spec && Number.isFinite(spec.o2_pct) && Number.isFinite(spec.pressure_kPa) ? { x: sx(Math.min(X1, Math.max(X0, spec.o2_pct))), y: sy(Math.min(Y1, Math.max(Y0, spec.pressure_kPa))) } : null
  const tx = sx(LUNAR_BOUNDS.o2_min)
  const ty = sy(LUNAR_BOUNDS.p_max_kPa)
  return (
    <div>
      <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Coverage map: oxygen against pressure">
        {X_TICKS.map((t) => (
          <g key={'x' + t}>
            <line className="gl" x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} />
            <text x={sx(t)} y={H - M.b + 16} textAnchor="middle">{t}</text>
          </g>
        ))}
        {Y_TICKS.map((t) => (
          <g key={'y' + t}>
            <line className="gl" x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} />
            <text x={M.l - 8} y={sy(t) + 3} textAnchor="end">{t}</text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle">Oxygen (% by volume)</text>
        <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">Pressure (kPa, log scale)</text>
        <rect className="target" x={tx} y={ty} width={sx(X1) - tx} height={H - M.b - ty} />
        <text x={tx + 6} y={H - M.b - 6} style={{ fill: 'var(--heat2)' }}>lunar-habitat target</text>
        {plotted.map((b) => {
          const x = sx(b.axes.o2[0])
          const y = sy(b.axes.p[1])
          const w = Math.max(7, sx(b.axes.o2[1]) - x)
          const h = Math.max(7, sy(b.axes.p[0]) - y)
          const cx = b.axes.o2[0] === b.axes.o2[1] ? x - 3.5 : x
          const cy = b.axes.p[0] === b.axes.p[1] ? y - 3.5 : y
          const cls = ['box', regimeOf(b.axes.g), b.kind === 'dataset' ? 'dataset' : '', hot.includes(b.id) || picked === b.id ? 'hot' : ''].join(' ')
          return (
            <rect key={b.id} className={cls} x={cx} y={cy} width={w} height={h} rx={2} tabIndex={0} role="button" aria-label={b.title} style={{ cursor: 'pointer' }} onClick={() => onPick && onPick(b.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick && onPick(b.id)}>
              <title>{b.id + ': ' + b.title}</title>
            </rect>
          )
        })}
        {me && (
          <g className="me">
            <line x1={me.x - 9} x2={me.x + 9} y1={me.y} y2={me.y} />
            <line x1={me.x} x2={me.x} y1={me.y - 9} y2={me.y + 9} />
            <circle cx={me.x} cy={me.y} r={4} />
          </g>
        )}
      </svg>
      <div className="maplegend">
        <span><i style={{ color: 'var(--plasma2)' }} />microgravity</span>
        <span><i style={{ color: 'var(--heat1)' }} />partial gravity</span>
        <span><i style={{ color: 'var(--text2)' }} />1 g</span>
        <span><i style={{ color: 'var(--text2)', borderStyle: 'dashed' }} />dataset (estimated)</span>
        <span><b style={{ color: '#fff' }}>+</b> your spec</span>
      </div>
      {hidden.length > 0 && (
        <p className="note" style={{ marginTop: 8 }}>
          Not drawn (oxygen or pressure not stated in the source): {hidden.map((b) => b.id).join(', ')}.
        </p>
      )}
    </div>
  )
}
