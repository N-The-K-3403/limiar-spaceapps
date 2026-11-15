import { LABELS, NUMERIC } from '../model.js'
import { ATMOSPHERES, G_MAX, G_MIN, GRAVITIES, round } from '../graph/defs.js'
import { useEval } from '../graph/context.js'
import { useGraph } from '../graph/store.js'
import NodeShell, { Waiting } from './NodeShell.jsx'
import DomainBar from './DomainBar.jsx'
import NumField from './NumField.jsx'
import { SliderTrack, SLIDE } from '../ui/SliderField.jsx'

const ok = (res) => res && res.status === 'ok'

function Shell({ id, type, selected, res, children }) {
  return (
    <NodeShell id={id} type={type} selected={selected}>
      {ok(res) ? children : <Waiting res={res} />}
    </NodeShell>
  )
}

const outsideMsg = (r) =>
  r.key === 'material'
    ? `Material ${r.value} is not in the trained set`
    : `${LABELS[r.key].name} ${round(r.value, 3)} ${r.value > r.max ? '>' : '<'} trained ${r.min}-${r.max} ${LABELS[r.key].unit}`

// ---- Scenario -------------------------------------------------------------------------------
export function ScenarioNode({ id, data, selected }) {
  const { results, ctx } = useEval()
  const update = useGraph((s) => s.updateData)
  const res = results[id]
  const set = (k) => (v) => update(id, { [k]: v })
  return (
    <Shell id={id} type="scenario" selected={selected} res={res}>
      <div className="row2">
        <select
          className="nodrag nowheel"
          value=""
          onChange={(e) => {
            const a = ATMOSPHERES[Number(e.target.value)]
            if (a) update(id, { o2_pct: a.o2_pct, pressure_kPa: a.pressure_kPa })
          }}
        >
          <option value="" disabled>
            Atmosphere preset...
          </option>
          {ATMOSPHERES.map((a, i) => (
            <option key={a.label} value={i}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className="nodrag nowheel"
          value=""
          onChange={(e) => {
            const g = GRAVITIES[Number(e.target.value)]
            if (g) update(id, { gravity_g: g.g })
          }}
        >
          <option value="" disabled>
            Gravity preset...
          </option>
          {GRAVITIES.map((g, i) => (
            <option key={g.label} value={i}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      <div className="fields">
        {[['o2_pct', 'Oxygen', '%'], ['pressure_kPa', 'Pressure', 'kPa'], ['gravity_g', 'Gravity', 'g'], ['thickness_mm', 'Thickness', 'mm']].map(([k, label, unit]) => {
          const f = ctx?.model.numeric_features[k]
          return (
            <div key={k} className="fld">
              <NumField label={label} unit={unit} value={data[k]} onCommit={set(k)} />
              <SliderTrack {...SLIDE[k]} value={data[k]} onChange={set(k)} unit={unit} label={label} bands={f ? [{ min: f.min, max: f.max }] : []} bandLabel="trained range" />
            </div>
          )
        })}
      </div>
      <label className="numfield wide">
        <span>Material</span>
        <select className="nodrag nowheel" value={data.material} onChange={(e) => set('material')(e.target.value)}>
          {ctx?.model.categorical_features.material.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {ok(res) && res.view.clamped && (
        <div className="line ember mono">
          Gravity limited to {G_MIN}-{G_MAX} g. 0 g and 1 g are measured reference data, never estimated.
        </div>
      )}
    </Shell>
  )
}

// ---- MARGIN-Spread --------------------------------------------------------------------------
export function SpreadNode({ id, data, selected }) {
  const { results, ctx } = useEval()
  const update = useGraph((s) => s.updateData)
  const res = results[id]
  if (!ok(res)) return <Shell id={id} type="spread" selected={selected} res={res} />
  const v = res.view
  const outside = v.domain.filter((d) => d.status === 'outside')
  const pos = Math.max(0, Math.min(100, 50 + (v.z / 6) * 50))
  const fillLeft = Math.min(50, pos)
  return (
    <Shell id={id} type="spread" selected={selected} res={res}>
      <div className={'result ' + (v.spread ? 'spread' : 'ext') + (outside.length ? ' dim' : '')}>
        <div className="result-label">Estimated outcome</div>
        <div className="result-class">{v.spread ? 'Flame spreads' : 'Flame extinguishes'}</div>
        <div className="fil">
          <div className="fil-track" />
          <div className="fil-fill" style={{ left: fillLeft + '%', width: Math.abs(pos - 50) + '%' }} />
          <div className="fil-mid" />
          <div className="fil-dot" style={{ left: pos + '%' }} />
        </div>
        <div className="fil-ends mono">
          <span>extinguish</span>
          <span>log-odds {(v.z >= 0 ? '+' : '') + round(v.z, 2)}</span>
          <span>spread</span>
        </div>
        <div className="result-note">Uncalibrated score, not a probability.</div>
      </div>

      <div className="dbars">
        {NUMERIC.map((k) => {
          const f = ctx.model.numeric_features[k]
          const row = v.domain.find((d) => d.key === k)
          return <DomainBar key={k} label={LABELS[k].name} unit={LABELS[k].unit} value={row.value} min={f.min} max={f.max} />
        })}
        <div className="dbar">
          <span className="dbar-label">Material</span>
          <span className="mat mono">
            {v.domain.find((d) => d.key === 'material').value}
            <em> trained: {ctx.model.categorical_features.material.join(', ')}</em>
          </span>
        </div>
      </div>
      {outside.map((r) => (
        <div key={r.key} className="line ember mono">
          {outsideMsg(r)}
        </div>
      ))}

      <select className="nodrag nowheel variant" value={data.variant} onChange={(e) => update(id, { variant: e.target.value })}>
        {ctx.variants.map((x) => (
          <option key={x.key} value={x.key}>
            {x.label}
          </option>
        ))}
      </select>
      <div className="line retained">
        Estimate from a small retrospective model on figure-derived labels. Held-out cases:{' '}
        {ctx.retained.map((r, i) => (
          <span key={r.key}>
            {i > 0 && ', '}
            <b className="mono">
              {r.ok}/{r.n}
            </b>{' '}
            ({r.short})
          </span>
        ))}
        .
      </div>
    </Shell>
  )
}

// ---- Domain check ---------------------------------------------------------------------------
export function DomainNode({ id, selected }) {
  const { results } = useEval()
  const res = results[id]
  if (!ok(res)) return <Shell id={id} type="domain" selected={selected} res={res} />
  const { rows, outside } = res.view
  return (
    <Shell id={id} type="domain" selected={selected} res={res}>
      <div className={'verdict ' + (outside.length ? 'bad' : 'good')}>
        {outside.length ? 'Outside the trained domain' : 'Inside the trained domain'}
      </div>
      {outside.map((r) => (
        <div key={r.key} className="line ember mono">
          {outsideMsg(r)}
        </div>
      ))}
      <table className="mini">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.status}>
              <td>{r.key === 'material' ? 'Material' : LABELS[r.key].name}</td>
              <td className="mono num">{typeof r.value === 'number' ? round(r.value, 3) : r.value}</td>
              <td className="mono sm">{r.min !== undefined ? `${r.min}-${r.max}` : 'listed'}</td>
              <td className="mono sm st">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  )
}

// ---- Nearest evidence -----------------------------------------------------------------------
export function NearestNode({ id, selected }) {
  const { results } = useEval()
  const res = results[id]
  if (!ok(res)) return <Shell id={id} type="nearest" selected={selected} res={res} />
  return (
    <Shell id={id} type="nearest" selected={selected} res={res}>
      <table className="mini">
        <thead>
          <tr>
            <th>Test</th>
            <th>Condition</th>
            <th>Outcome</th>
            <th className="num">d</th>
          </tr>
        </thead>
        <tbody>
          {res.view.near.map((c) => (
            <tr key={c.test_id}>
              <td className="mono">{c.test_id}</td>
              <td className="mono sm">
                {c.material}, {c.gravity_label} g, {c.o2_pct}% O2, {c.pressure_kPa} kPa
              </td>
              <td>
                <span className={'oc ' + c.outcome}>{c.outcome}</span>
                <span className="mono sm"> {c.outcome_confidence}</span>
              </td>
              <td className="mono num">{round(c.distance, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="line sm">
        Distance d is in the model's scaled input units. Labels are estimated from Fig. 7 of Takahashi et al. 2026.
      </div>
    </Shell>
  )
}

// ---- Evidence chart -------------------------------------------------------------------------
const CW = 410
const CH = 250
const CM = { l: 44, r: 12, t: 12, b: 36 }

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw))
  const r = raw / p
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p
}
function ticks(lo, hi, n = 5) {
  const step = niceStep((hi - lo) / n)
  const out = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6)
  return out
}

export function ChartNode({ id, selected }) {
  const { results } = useEval()
  const res = results[id]
  if (!ok(res)) return <Shell id={id} type="chart" selected={selected} res={res} />
  const { cases, x, nearIds, trained, outside } = res.view
  const xs = [...cases.map((c) => c.o2_pct), x.o2_pct, ...trained.o2]
  const ys = [...cases.map((c) => c.pressure_kPa), x.pressure_kPa, ...trained.p]
  const xLo = Math.floor(Math.min(...xs) - 2)
  const xHi = Math.ceil(Math.max(...xs) + 2)
  const yLo = Math.floor(Math.min(...ys) - 5)
  const yHi = Math.ceil(Math.max(...ys) + 5)
  const sx = (v) => CM.l + ((v - xLo) / (xHi - xLo)) * (CW - CM.l - CM.r)
  const sy = (v) => CH - CM.b - ((v - yLo) / (yHi - yLo)) * (CH - CM.t - CM.b)
  const bad = outside.length > 0
  return (
    <Shell id={id} type="chart" selected={selected} res={res}>
      <svg className="chart" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Takahashi cases on the oxygen and pressure plane">
        {ticks(xLo, xHi).map((t) => (
          <g key={'x' + t}>
            <line className="gridline" x1={sx(t)} x2={sx(t)} y1={CM.t} y2={CH - CM.b} />
            <text x={sx(t)} y={CH - CM.b + 14} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        {ticks(yLo, yHi).map((t) => (
          <g key={'y' + t}>
            <line className="gridline" x1={CM.l} x2={CW - CM.r} y1={sy(t)} y2={sy(t)} />
            <text x={CM.l - 6} y={sy(t) + 3} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <text x={(CM.l + CW - CM.r) / 2} y={CH - 4} textAnchor="middle">
          Oxygen (% by volume)
        </text>
        <text transform={`translate(11 ${(CM.t + CH - CM.b) / 2}) rotate(-90)`} textAnchor="middle">
          Pressure (kPa)
        </text>
        <rect
          className="trained"
          x={sx(trained.o2[0])}
          y={sy(trained.p[1])}
          width={sx(trained.o2[1]) - sx(trained.o2[0])}
          height={sy(trained.p[0]) - sy(trained.p[1])}
        />
        <text className="trained-label" x={sx(trained.o2[0]) + 4} y={sy(trained.p[1]) + 11}>
          trained span
        </text>
        {cases.map((c) => {
          const r = 3.2 + c.gravity_g * 9
          const near = nearIds.includes(c.test_id)
          return (
            <g key={c.test_id}>
              {near && <circle className="halo" cx={sx(c.o2_pct)} cy={sy(c.pressure_kPa)} r={r + 4} />}
              <circle className={'case ' + c.outcome} cx={sx(c.o2_pct)} cy={sy(c.pressure_kPa)} r={r}>
                <title>
                  {c.test_id}: {c.outcome} ({c.outcome_confidence}), {c.material}, {c.gravity_label} g, {c.o2_pct}% O2, {c.pressure_kPa} kPa
                </title>
              </circle>
            </g>
          )
        })}
        <g className={'marker' + (bad ? ' bad' : '')}>
          <line x1={sx(x.o2_pct) - 9} x2={sx(x.o2_pct) + 9} y1={sy(x.pressure_kPa)} y2={sy(x.pressure_kPa)} />
          <line x1={sx(x.o2_pct)} x2={sx(x.o2_pct)} y1={sy(x.pressure_kPa) - 9} y2={sy(x.pressure_kPa) + 9} />
          <circle cx={sx(x.o2_pct)} cy={sy(x.pressure_kPa)} r="3" />
          <title>
            Your scenario: {x.o2_pct}% O2, {x.pressure_kPa} kPa
          </title>
        </g>
      </svg>
      <div className="legend mono">
        <span>
          <i className="lg spread" /> spread
        </span>
        <span>
          <i className="lg ext" /> extinct
        </span>
        <span>
          <i className="lg halo" /> nearest 3
        </span>
        <span>
          <i className="lg me">+</i> your scenario
        </span>
        <span className="sm">Ring size follows gravity. All labels are estimated from the figure.</span>
      </div>
    </Shell>
  )
}

export const nodeTypes = {
  scenario: ScenarioNode,
  spread: SpreadNode,
  domain: DomainNode,
  nearest: NearestNode,
  chart: ChartNode,
}
