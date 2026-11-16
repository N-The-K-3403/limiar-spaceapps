import { useEffect, useMemo, useRef, useState } from 'react'
import { download } from '../lib/rank.js'
import { Eyebrow, Prov } from '../ui/bits.jsx'
import Icon from '../ui/icons.jsx'

const W = 860
const H = 380
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
const FILTERS = [
  ['all', 'All points'],
  ['verified', 'Verified only'],
  ['estimated from figure', 'Estimated only'],
]

const sx = (v) => M.l + ((Math.log(v) - Math.log(X_MIN)) / (Math.log(X_MAX) - Math.log(X_MIN))) * (W - M.l - M.r)
const clampY = (v) => Math.max(Y_MIN, Math.min(Y_MAX, v))
const sy = (v) => H - M.b - ((clampY(v) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - M.t - M.b)
const fmt = (n) => String(+Number(n).toFixed(2))

function csvOf(points) {
  const cols = ['id', 'flow_cm_s', 'o2_pct', 'strain_1_s', 'mode', 'qc_w_cm2', 'provenance', 'source', 'anchor_sample', 'note']
  const esc = (v) => (v === null || v === undefined ? '' : '"' + String(v).replace(/"/g, '""') + '"')
  return [cols.join(',')].concat(points.map((p) => cols.map((c) => esc(p[c])).join(','))).join('\n')
}

// small legend glyphs: the shapes use the same geometry as the chart markers
const GlyphDiamond = () => (
  <svg className="lg-ico" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="3.2" y="3.2" width="7.6" height="7.6" transform="rotate(45 7 7)" fill="currentColor" stroke="#fff" strokeWidth="1" />
  </svg>
)
const GlyphRing = () => (
  <svg className="lg-ico" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)
const GlyphLine = () => (
  <svg className="lg-ico" width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">
    <line x1="1" y1="7" x2="27" y2="7" stroke="#b3a5d8" strokeWidth="1.6" strokeDasharray="5 4" />
  </svg>
)
const GlyphBand = () => (
  <svg className="lg-ico" width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">
    <rect x="1" y="2" width="26" height="10" rx="2" fill="rgba(179,165,216,0.28)" />
  </svg>
)
const GlyphScenario = () => (
  <svg className="lg-ico" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 4v6M4 7h6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

export default function Evidence({ points, manifest, fit, scenario }) {
  const [selected, setSelected] = useState(null)
  const [hover, setHover] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showFit, setShowFit] = useState(true)
  const wrapRef = useRef(null)
  const rowRefs = useRef({})

  const shown = useMemo(() => points.filter((p) => filter === 'all' || p.provenance === filter), [points, filter])
  const flows = points.map((p) => p.flow_cm_s)
  const o2s = points.map((p) => p.o2_pct)
  const dMin = Math.min(...flows)
  const dMax = Math.max(...flows)
  const scenarioFlow = scenario?.flow_cms === '' || scenario?.flow_cms == null ? NaN : Number(scenario.flow_cms)
  const scenarioO2 = scenario?.o2_pct === '' || scenario?.o2_pct == null ? NaN : Number(scenario.o2_pct)
  const scenarioFitsChart = Number.isFinite(scenarioFlow) && scenarioFlow > 0 && Number.isFinite(scenarioO2)
    && scenarioFlow >= X_MIN && scenarioFlow <= X_MAX && scenarioO2 >= Y_MIN && scenarioO2 <= Y_MAX
  const scenarioMessage = scenarioFitsChart
    ? `Your scenario: ${fmt(scenarioO2)}% O₂ at ${fmt(scenarioFlow)} cm/s. Coordinate reference only; not a measurement or prediction.`
    : Number.isFinite(scenarioFlow) && scenarioFlow > 0 && Number.isFinite(scenarioO2)
      ? 'Your scenario is outside this chart’s displayed range (0.2–100 cm/s, 12–23% O₂); no marker is shown.'
      : 'Set a positive airflow in Planner to place your scenario marker; the source points and fit are unchanged.'
  const sel = shown.find((p) => p.id === selected) || null
  const curve = fit?.curve || []
  const line = curve.map((c, i) => `${i ? 'L' : 'M'}${sx(c.flow).toFixed(1)} ${sy(c.o2).toFixed(1)}`).join(' ')
  const band = curve.length ? curve.map((c, i) => `${i ? 'L' : 'M'}${sx(c.flow).toFixed(1)} ${sy(c.hi).toFixed(1)}`).join(' ') + ' ' + [...curve].reverse().map((c) => `L${sx(c.flow).toFixed(1)} ${sy(c.lo).toFixed(1)}`).join(' ') + ' Z' : ''

  // the active point (hovered or selected) is drawn last so it sits on top
  const drawn = useMemo(() => {
    const rank = (p) => (p.id === selected ? 2 : p.id === hover ? 1 : 0)
    return [...shown].sort((a, b) => rank(a) - rank(b))
  }, [shown, selected, hover])

  const pickFilter = (k) => {
    setFilter(k)
    // a selection that the new filter hides would leave the side card describing something that is not on screen
    const stays = points.find((p) => p.id === selected && (k === 'all' || p.provenance === k))
    if (!stays) setSelected(null)
    setHover(null)
  }

  // clicking a point on the chart scrolls the table (inside its own box, never the page) to that row
  useEffect(() => {
    if (selected == null) return
    const wrap = wrapRef.current
    const row = rowRefs.current[selected]
    if (!wrap || !row) return
    const head = wrap.querySelector('thead')?.offsetHeight || 0
    const w = wrap.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < w.top + head) wrap.scrollTop -= w.top + head - r.top + 4
    else if (r.bottom > w.bottom) wrap.scrollTop += r.bottom - w.bottom + 4
  }, [selected, filter])

  const tiles = [
    { icon: 'scatter', k: 'Points', v: manifest.sofie_points.total, s: `${manifest.sofie_points.verified} verified · ${manifest.sofie_points.estimated} from the figure` },
    { icon: 'wind', k: 'Flow speed', v: `${fmt(dMin)}–${fmt(dMax)}`, s: 'cm/s, in the data' },
    { icon: 'drop', k: 'O₂ at extinction', v: `${fmt(Math.min(...o2s))}–${fmt(Math.max(...o2s))} %`, s: 'lowest to highest point' },
    { icon: 'flame', k: 'Trend minimum', v: fit?.min ? `≈ ${fit.min.o2.toFixed(1)} %` : 'not fitted', s: fit?.min ? `at ${fit.min.flow.toFixed(1)} cm/s (MARGIN-Limit)` : 'MARGIN-Limit unavailable' },
  ]

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-grid">
          <div>
            <Eyebrow n="05">Evidence</Eyebrow>
            <h1 className="display">How much oxygen<br />keeps a flame <em>alive</em>?</h1>
            <p className="lede">
              {manifest.sofie_points.total} points from T’ien et al. 2025 (SoFIE-GEL, Fig. 8): {manifest.sofie_points.verified} verified from Table 2 and {manifest.sofie_points.estimated} read off the figure. 4 cm PMMA spheres, 1 atm, microgravity on the ISS. The link to the Moon or Mars is by analogy, not by data.
            </p>
          </div>
          <div className="glance">
            {tiles.map((t) => (
              <div key={t.k} className="tile">
                <div className="k"><Icon name={t.icon} size={14} />{t.k}</div>
                <div className="v num">{t.v}</div>
                <div className="s">{t.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cols ev-cols">
        <aside className="sticky stack ev-aside" aria-label="Evidence controls">
          <div className="card">
            <h3>Controls</h3>
            <div className="lbl" style={{ margin: '10px 0 6px' }}>Show points</div>
            <div className="pills" role="group" aria-label="Provenance filter">
              {FILTERS.map(([k, l]) => (
                <button key={k} className={'pill' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => pickFilter(k)}>{l}</button>
              ))}
            </div>
            <p className="ev-count num" role="status" aria-live="polite"><b>{shown.length}</b> of {points.length} points shown</p>
            <div className="lbl" style={{ margin: '14px 0 6px' }}>Trend</div>
            <button className={'pill' + (showFit ? ' on' : '')} aria-pressed={showFit && !!fit} onClick={() => setShowFit((v) => !v)} disabled={!fit}>MARGIN-Limit curve</button>
            <div className="ev-actions">
              <button className="btn sm ghost" onClick={() => download('sofie_points.csv', csvOf(shown), 'text/csv')}>
                <Icon name="download" size={14} />Export CSV ({shown.length} rows)
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-h" style={{ marginBottom: 0 }}>
              <h3>Selected point</h3>
              <span className="grow" />
              {sel && <button className="btn sm ghost" onClick={() => setSelected(null)}>Clear</button>}
            </div>
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
              <p className="note" style={{ marginTop: 8 }}>Click a point on the chart or a row in the table to see its source, condition and confidence.</p>
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
        </aside>

        <div className="stack">
          <div className="card" style={{ padding: 14 }}>
            <svg className="map ev-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Oxygen at extinction against flow speed">
              <rect x={sx(X_MIN)} y={M.t} width={sx(dMin) - sx(X_MIN)} height={H - M.t - M.b} fill="rgba(245,243,246,0.04)" />
              <rect x={sx(dMax)} y={M.t} width={sx(X_MAX) - sx(dMax)} height={H - M.t - M.b} fill="rgba(245,243,246,0.04)" />
              <text x={sx(X_MIN) + 6} y={M.t + 14}>no data</text>
              <text x={W - M.r - 6} y={M.t + 14} textAnchor="end">no data</text>
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
              {drawn.map((p) => {
                const cx = sx(p.flow_cm_s)
                const cy = sy(p.o2_pct)
                const color = COLOR[p.mode] || '#99959f'
                const on = selected === p.id
                const hov = hover === p.id
                const active = on || hov
                return (
                  <g
                    key={p.id}
                    className="ev-pt"
                    onClick={() => setSelected(p.id)}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover((h) => (h === p.id ? null : h))}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={on}
                    aria-label={`Point ${p.id}: ${p.o2_pct}% O2 at ${p.flow_cm_s} cm/s`}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(p.id))}
                  >
                    <title>{`#${p.id} · ${p.o2_pct} % O₂ at ${p.flow_cm_s} cm/s`}</title>
                    {active && <circle cx={cx} cy={cy} r={on ? 13 : 11} fill="none" stroke={on ? '#fff' : 'rgba(245,243,246,0.55)'} strokeWidth={on ? 1.6 : 1.2} />}
                    {p.provenance === 'verified' ? (
                      <rect x={cx - 6} y={cy - 6} width={12} height={12} transform={`rotate(45 ${cx} ${cy})`} fill={color} stroke="#fff" strokeWidth={on ? 2.5 : 1.2} />
                    ) : (
                      <circle cx={cx} cy={cy} r={5.5} fill="none" stroke={color} strokeWidth={on ? 3 : active ? 2.6 : 2} />
                    )}
                  </g>
                )
              })}
              {scenarioFitsChart && (
                <g className="ev-scenario-marker" role="img" aria-label="Your scenario, not measured">
                  <title>{`Your scenario (not measured): ${fmt(scenarioO2)}% O₂ at ${fmt(scenarioFlow)} cm/s`}</title>
                  <circle cx={sx(scenarioFlow)} cy={sy(scenarioO2)} r="9" />
                  <path d={`M${sx(scenarioFlow) - 5} ${sy(scenarioO2)}h10M${sx(scenarioFlow)} ${sy(scenarioO2) - 5}v10`} />
                </g>
              )}
            </svg>

            <div className="ev-legend">
              <div className="lg-grp" aria-label="Outcome colours">
                <b>How the flame ended</b>
                {MODES.map(([k, l, c]) => (
                  <span key={k}><i style={{ color: c, background: c }} />{l}</span>
                ))}
              </div>
              <div className="lg-grp" aria-label="Symbols and line">
                <b>Symbols and line</b>
                <span><GlyphDiamond />verified (Table 2)</span>
                <span><GlyphRing />estimated from figure</span>
                {fit && showFit && <span><GlyphLine />quadratic trend in log flow</span>}
                {fit && showFit && <span><GlyphBand />90% band (residual spread only)</span>}
                <span><GlyphScenario />your scenario (not measured)</span>
              </div>
            </div>
            <p className="note ev-what">
              <b>What this chart shows.</b> Each diamond or ring is a test: how fast the air was flowing (left to right, log scale) and the oxygen level at which the flame went out (bottom to top). Colour shows the outcome; shape shows whether the value comes from Table 2 or was read off the figure.
            </p>
            <p className="note ev-scenario-note" role="status" aria-live="polite">{scenarioMessage}</p>
          </div>

          <div className="card">
            <div className="card-h" style={{ marginBottom: 6 }}>
              <h3>Data table</h3>
              <span className="note num">{shown.length} of {points.length} rows</span>
              <span className="grow" />
              <span className="note">Hover or click a row to find it on the chart.</span>
            </div>
            <div className="ev-scroll" ref={wrapRef} tabIndex={0} aria-label="Data table, scrollable">
              <table className="tbl">
                <thead>
                  <tr><th className="num">#</th><th className="num">Flow (cm/s)</th><th className="num">O₂ (%)</th><th>Mode</th><th className="num">q_c (W/cm²)</th><th>Provenance</th></tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const cls = selected === p.id ? 'sel' : hover === p.id ? 'hov' : ''
                    return (
                      <tr
                        key={p.id}
                        ref={(el) => { if (el) rowRefs.current[p.id] = el; else delete rowRefs.current[p.id] }}
                        className={'ev-row ' + cls}
                        tabIndex={0}
                        aria-current={selected === p.id ? 'true' : undefined}
                        onClick={() => setSelected(p.id)}
                        onMouseEnter={() => setHover(p.id)}
                        onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(p.id))}
                      >
                        <td className="num">{p.id}</td>
                        <td className="num">{p.flow_cm_s}</td>
                        <td className="num">{p.o2_pct}</td>
                        <td>{String(p.mode).replace(/_/g, ' ')}</td>
                        <td className="num">{p.qc_w_cm2 ?? ''}</td>
                        <td><Prov prov={p.provenance} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {shown.length === 0 && <div className="empty" style={{ margin: 12 }}>No points match this filter.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
