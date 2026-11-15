import { useMemo, useState } from 'react'
import { LABELS, NUMERIC, domainReport, nearestCases, score } from '../model.js'
import { ATMOSPHERES, G_MAX, G_MIN, round } from '../graph/defs.js'
import { Eyebrow } from '../ui/bits.jsx'
import SliderField, { SLIDE } from '../ui/SliderField.jsx'

const loPct = (z) => Math.max(2, Math.min(98, 50 + (z / 6) * 50))

export default function Estimator({ ctx }) {
  const { model, cases, variants, retained, inSample } = ctx
  const [variantKey, setVariantKey] = useState('full')
  const [x, setX] = useState({ material: 'ACRYPLEN', thickness_mm: 0.125, o2_pct: 21, pressure_kPa: 101.3, gravity_g: 0.165 })
  const set = (k, v) => setX((s) => ({ ...s, [k]: v }))
  const variant = variants.find((v) => v.key === variantKey) || variants[0]
  const ok = NUMERIC.every((k) => Number.isFinite(+x[k]) && x[k] !== '')
  const xn = useMemo(() => ({ ...x, ...Object.fromEntries(NUMERIC.map((k) => [k, Number(x[k])])) }), [x])
  const z = ok ? score(variant.model, xn) : 0
  const domain = ok ? domainReport(model, xn) : []
  const outside = domain.filter((d) => d.status === 'outside')
  const near = ok ? nearestCases(model, cases, xn, 3) : []
  const gravityBad = ok && (xn.gravity_g < G_MIN || xn.gravity_g > G_MAX)

  return (
    <div className="page">
      <div className="hero">
        <Eyebrow n="06">Estimator · MARGIN-Spread</Eyebrow>
        <h1 className="display">Spread or <em>extinguish</em>?</h1>
        <p className="lede">
          Estimates whether an already-burning thin sample keeps spreading during a partial-gravity flight. It does not predict ignition, heat release, flame size or habitat safety.
        </p>
      </div>

      <div className="cols">
        <div className="card sticky">
          <h3>Scenario</h3>
          <div className="lbl" style={{ margin: '10px 0 6px' }}>Atmosphere</div>
          <div className="pills" style={{ marginBottom: 14 }}>
            {ATMOSPHERES.map((a) => (
              <button key={a.label} className="pill" onClick={() => setX((s) => ({ ...s, o2_pct: a.o2_pct, pressure_kPa: a.pressure_kPa }))}>{a.label.split(' (')[0]}</button>
            ))}
          </div>
          <label className="field">
            <span>Material</span>
            <select value={x.material} onChange={(e) => set('material', e.target.value)}>
              {model.categorical_features.material.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          {NUMERIC.map((k) => (
            <SliderField
              key={k}
              label={LABELS[k].name}
              unit={LABELS[k].unit.replace('% O2', '%')}
              value={x[k]}
              onChange={(v) => set(k, v)}
              cfg={SLIDE[k]}
              bands={[{ min: model.numeric_features[k].min, max: model.numeric_features[k].max }]}
              bandLabel="trained range"
              hint={`trained ${model.numeric_features[k].min} to ${model.numeric_features[k].max}`}
            />
          ))}
          <label className="field">
            <span>Model variant</span>
            <select value={variantKey} onChange={(e) => setVariantKey(e.target.value)}>
              {variants.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </label>
          <p className="note">Gravity is limited to {G_MIN}–{G_MAX} g. 0 g and 1 g behave non-monotonically and appear as measured reference data, never as interpolated estimates.</p>
        </div>

        <div className="stack">
          {!ok && <div className="empty">Fill in every field to get an estimate.</div>}
          {ok && (
            <>
              <div className={'card' + (outside.length ? '' : '')} style={{ borderColor: outside.length ? 'rgba(255,82,82,0.5)' : undefined, borderStyle: outside.length ? 'dashed' : undefined }}>
                <div className="eyebrow">Estimated outcome · uncalibrated score, not a probability</div>
                <div className="verdict-big" style={{ fontSize: 34, margin: '8px 0 10px', color: z >= 0 ? 'var(--heat2)' : 'var(--plasma2)' }}>{z >= 0 ? 'Flame spreads' : 'Flame extinguishes'}</div>
                <div className="lo-bar" style={{ maxWidth: 420 }}>
                  <i className="mid" />
                  <i className={'pt ' + (z >= 0 ? '' : 'e') + (outside.length ? ' out' : '')} style={{ left: loPct(z) + '%' }} />
                </div>
                <div className="note num" style={{ marginTop: 6 }}>log-odds {z >= 0 ? '+' : ''}{round(z, 2)} · extinguish ← 0 → spread</div>
                <div className="meta" style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <span className="chip estimated">estimated, retrospective</span>
                  {outside.length > 0 && <span className="chip bad">outside training range</span>}
                  {gravityBad && <span className="chip bad">gravity outside 0.05–0.6 g</span>}
                </div>
              </div>

              <div className="callout warn">
                Estimate from a small retrospective model on figure-derived labels ({cases.length} cases, {ctx.manifest.takahashi_cases.flights} flights). Held-out cases: {retained.map((r, i) => <span key={r.key}>{i > 0 && ', '}{r.ok}/{r.n} ({r.short})</span>)}. The full fit scores {inSample.ok}/{inSample.n} in-sample, which is not a validation.
              </div>

              <div className="card">
                <h3>Domain check</h3>
                <table className="tbl" style={{ marginTop: 10 }}>
                  <thead><tr><th>Input</th><th className="num">Value</th><th>Trained span</th><th>Status</th></tr></thead>
                  <tbody>
                    {domain.map((d) => (
                      <tr key={d.key}>
                        <td>{d.key === 'material' ? 'Material' : LABELS[d.key].name}</td>
                        <td className="num">{typeof d.value === 'number' ? round(d.value, 3) : d.value}</td>
                        <td className="note">{d.min !== undefined ? `${d.min}–${d.max}` : model.categorical_features.material.join(', ')}</td>
                        <td><span className={'chip ' + (d.status === 'inside' ? 'ok' : 'bad')}>{d.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {outside.length > 0 && <p className="note" style={{ marginTop: 10 }}>Extrapolation in: {outside.map((d) => (d.key === 'material' ? 'material' : LABELS[d.key].name)).join(', ')}. The linear score keeps extending beyond the data, so treat the number as a trend, not a measurement.</p>}
              </div>

              <div className="card">
                <h3>Nearest real evidence</h3>
                <p className="note">Takahashi et al. 2026, outcomes estimated from Fig. 7.</p>
                <div className="tbl-wrap" style={{ marginTop: 10 }}>
                  <table className="tbl">
                    <thead><tr><th>Test</th><th>Material</th><th className="num">g</th><th className="num">O₂ %</th><th className="num">kPa</th><th>Outcome</th><th>Label confidence</th></tr></thead>
                    <tbody>
                      {near.map((c) => (
                        <tr key={c.test_id}><td className="num">{c.test_id}</td><td>{c.material}</td><td className="num">{c.gravity_label}</td><td className="num">{c.o2_pct}</td><td className="num">{c.pressure_kPa}</td><td>{c.outcome}</td><td>{c.outcome_confidence}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h3>Limits of this model</h3>
                <ul className="plain note" style={{ marginTop: 8 }}>
                  {model.limits.map((l) => <li key={l}>{l}</li>)}
                  <li>The score is not a calibrated probability.</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
