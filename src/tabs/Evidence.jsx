import { useMemo, useState } from 'react'
import { download } from '../lib/rank.js'
import { Eyebrow, Prov } from '../ui/bits.jsx'

const W = 780
const H = 450
const M = { l: 58, r: 16, t: 16, b: 48 }
const X_MIN = 0.2
const X_MAX = 100
const Y_MIN = 12
const Y_MAX = 23
const X_TICKS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]
const Y_TICKS = [12, 14, 16, 18, 20, 22]
const MODES = [
  ['quenching', 'Quenching', '#b3a5d8'],
  ['in_between', 'In-between', '#d4cbee'],
  ['stagnation_blowoff', 'Stagnation blow-off', '#ff8a4d'],
  ['total_blowoff', 'Total blow-off', '#ff5252'],
]
const COLOR = Object.fromEntries(MODES.map(([k, , c]) => [k, c]))

const sx = (v) => M.l + ((Math.log(v) - Math.log(X_MIN)) / (Math.log(X_MAX) - Math.log(X_MIN))) * (W - M.l - M.r)
const clampY = (v) => Math.max(Y_MIN, Math.min(Y_MAX, v))
const sy = (v) => H - M.b - ((clampY(v) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - M.t - M.b)

function csvOf(points) {
  const cols = ['id', 'flow_cm_s', 'o2_pct', 'strain_1_s', 'mode', 'qc_w_cm2', 'provenance', 'source', 'anchor_sample', 'note']
  const esc = (v) => (v === null || v === undefined ? '' : '"' + String(v).replace(/"/g, '""') + '"')
  return [cols.join(',')].concat(points.map((p) => cols.map((c) => esc(p[c])).join(','))).join('\n')
}

export default function Evidence({ points, manifest, fit }) {
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showFit, setShowFit] = useState(true)
  const shown = useMemo(() => points.filter((p) => filter === 'all' || p.provenance === filter), [points, filter])
  const flows = points.map((p) => p.flow_cm_s)
  const dMin = Math.min(...flows)
  const dMax = Math.max(...flows)
  const sel = points.find((p) => p.id === selected)
  const curve = fit?.curve || []
  const line = curve.map((c, i) => `${i ? 'L' : 'M'}${sx(c.flow).toFixed(1)} ${sy(c.o2).toFixed(1)}`).join(' ')
  const band = curve.length ? curve.map((c, i) => `${i ? 'L' : 'M'}${sx(c.flow).toFixed(1)} ${sy(c.hi).toFixed(1)}`).join(' ') + ' ' + [...curve].reverse().map((c) => `L${sx(c.flow).toFixed(1)} ${sy(c.lo).toFixed(1)}`).join(' ') + ' Z' : ''

  return (
    <div className="page">
      <div className="hero">
        <Eyebrow n="05">Evidence</Eyebrow>
        <h1 className="display">How much oxygen<br />keeps a flame <em>alive</em>?</h1>
        <p className="lede">
          {manifest.sofie_points.total} points from T’ien et al. 2025 (SoFIE-GEL, Fig. 8): {manifest.sofie_points.verified} verified from Table 2 and {manifest.sofie_points.estimated} read off the figure. 4 cm PMMA spheres, 1 atm, microgravity on the ISS. The link to the Moon or Mars is by analogy, not by data.
        </p>
      </div>

      <div className="card-h">
        <div className="seg" role="group" aria-label="Provenance filter">
          {[['all', 'All points'], ['verified', 'Verified only'], ['estimated from figure', 'Estimated only']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className={'pill' + (showFit ? ' on' : '')} onClick={() => setShowFit((v) => !v)} disabled={!fit}>MARGIN-Limit curve</button>
        <span className="grow" />
        <button className="btn sm ghost" onClick={() => download('sofie_points.csv', csvOf(points), 'text/csv')}>Export CSV</button>
      </div>

      <div className="cols" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div className="card" style={{ padding: 14 }}>
          <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Oxygen at extinction against flow speed">
            <rect x={sx(X_MIN)} y={M.t} width={sx(dMin) - sx(X_MIN)} height={H - M.t - M.b} fill="rgba(245,243,246,0.04)" />
            <rect x={sx(dMax)} y={M.t} width={sx(X_MAX) - sx(dMax)} height={H - M.t - M.b} fill="rgba(245,243,246,0.04)" />
            <text x={sx(X_MIN) + 6} y={M.t + 14}>no data</text>
            <text x={sx(dMax) + 6} y={M.t + 14}>no data</text>
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
            <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle">Flow speed (cm/s, log scale)</text>
            <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">O₂ at extinction (% by volume)</text>
            {fit && showFit && (
              <g>
                <path d={band} fill="rgba(179,165,216,0.14)" stroke="none" />
                <path d={line} fill="none" stroke="#b3a5d8" strokeWidth="1.6" strokeDasharray="5 4" />
              </g>
            )}
            {shown.map((p) => {
              const cx = sx(p.flow_cm_s)
              const cy = sy(p.o2_pct)
              const color = COLOR[p.mode] || '#99959f'
              const on = selected === p.id
              return (
                <g key={p.id} onClick={() => setSelected(p.id)} style={{ cursor: 'pointer' }} tabIndex={0} role="button" aria-label={`Point ${p.id}: ${p.o2_pct}% O2 at ${p.flow_cm_s} cm/s`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(p.id)}>
                  {p.provenance === 'verified' ? (
                    <rect x={cx - 6} y={cy - 6} width={12} height={12} transform={`rotate(45 ${cx} ${cy})`} fill={color} stroke="#fff" strokeWidth={on ? 2.5 : 1.2} />
                  ) : (
                    <circle cx={cx} cy={cy} r={5.5} fill="none" stroke={color} strokeWidth={on ? 3 : 2} />
                  )}
                </g>
              )
            })}
          </svg>
          <div className="maplegend">
            {MODES.map(([k, l, c]) => (
              <span key={k}><i style={{ color: c, background: c }} />{l}</span>
            ))}
            <span>◆ verified (Table 2) · ○ estimated from figure</span>
            {fit && showFit && <span>– – quadratic trend in log flow, 90% band (residual spread only)</span>}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Selected point</h3>
            {sel ? (
              <dl className="kv" style={{ marginTop: 10 }}>
                <dt>Point</dt><dd className="num">#{sel.id}{sel.anchor_sample ? ` (${sel.anchor_sample})` : ''}</dd>
                <dt>Flow</dt><dd className="num">{sel.flow_cm_s} cm/s</dd>
                <dt>O₂</dt><dd className="num">{sel.o2_pct} %</dd>
                <dt>Strain rate</dt><dd className="num">{sel.strain_1_s} 1/s</dd>
                <dt>Mode</dt><dd>{String(sel.mode).replace(/_/g, ' ')}</dd>
                <dt>q_c</dt><dd className="num">{sel.qc_w_cm2 != null ? sel.qc_w_cm2 + ' W/cm²' : 'not labelled'}</dd>
                <dt>Provenance</dt><dd><Prov prov={sel.provenance} /></dd>
                <dt>Source</dt><dd className="note">{sel.source}</dd>
                {sel.note && (<><dt>Note</dt><dd className="note">{sel.note}</dd></>)}
              </dl>
            ) : (
              <p className="note" style={{ marginTop: 8 }}>Click a point to see its source, condition and confidence.</p>
            )}
          </div>
          {fit && (
            <div className="card">
              <h3>MARGIN-Limit</h3>
              <dl className="kv" style={{ marginTop: 10 }}>
                <dt>Fit</dt><dd>quadratic in log₁₀(flow), {fit.n} points</dd>
                <dt>Residual sd</dt><dd className="num">{fit.sd.toFixed(2)} % O₂</dd>
                <dt>Leave-one-out</dt><dd className="num">{fit.loo.toFixed(2)} % O₂</dd>
                {fit.min && (<><dt>Minimum</dt><dd className="num">≈ {fit.min.o2.toFixed(1)} % at {fit.min.flow.toFixed(1)} cm/s</dd></>)}
              </dl>
              <p className="note" style={{ marginTop: 8 }}>No Gaussian-process layer here; the band is residual spread only. Unreliable below about 0.4 cm/s. Valid for PMMA spheres at 1 atm in microgravity only.</p>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Data table</h3>
        <div className="tbl-wrap" style={{ marginTop: 10 }}>
          <table className="tbl">
            <thead>
              <tr><th className="num">#</th><th className="num">Flow (cm/s)</th><th className="num">O₂ (%)</th><th>Mode</th><th className="num">q_c (W/cm²)</th><th>Provenance</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} onClick={() => setSelected(p.id)} style={{ cursor: 'pointer', background: selected === p.id ? 'rgba(179,165,216,0.1)' : undefined }}>
                  <td className="num">{p.id}</td>
                  <td className="num">{p.flow_cm_s}</td>
                  <td className="num">{p.o2_pct}</td>
                  <td>{String(p.mode).replace(/_/g, ' ')}</td>
                  <td className="num">{p.qc_w_cm2 ?? ''}</td>
                  <td><Prov prov={p.provenance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
