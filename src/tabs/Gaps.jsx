import { useState } from 'react'
import { MAT, Q } from '../lib/plan.js'
import { REGIME_LABEL, regimeOfG, round } from '../lib/psi.js'
import { Cite, Eyebrow, Prov } from '../ui/bits.jsx'
import CoverageMap from '../ui/CoverageMap.jsx'

export default function Gaps({ plan, kb, onCite, goTab }) {
  const [picked, setPicked] = useState(null)
  const box = kb.boxes.find((b) => b.id === picked)
  const hot = plan ? plan.coverage.closest.map((c) => c.id) : []

  return (
    <div className="page">
      <div className="hero">
        <Eyebrow n="04">Coverage and gaps</Eyebrow>
        <h1 className="display">Where the evidence <em>ends</em>.</h1>
        <p className="lede">
          Every measured source and dataset we hold, drawn on oxygen and pressure. A box is a range the source swept, not a guarantee that every point inside was tested. Your experiment is the cross.
        </p>
      </div>

      <div className="cols" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
        <div className="card">
          <div className="card-h">
            <h3 style={{ margin: 0 }}>Oxygen and pressure</h3>
            <span className="grow" />
            {plan && <span className="chip lav">{MAT[plan.spec.material_class].label} · {REGIME_LABEL[regimeOfG(plan.spec.gravity_g)]}</span>}
          </div>
          <CoverageMap kb={kb} spec={plan?.spec} hot={hot} picked={picked} onPick={setPicked} />
          {box && (
            <div className="callout" style={{ marginTop: 14 }}>
              <div className="card-h" style={{ marginBottom: 6 }}>
                <b>{box.title}</b>
                <Prov prov={box.prov} />
                <span className="chip">{box.kind}</span>
              </div>
              <div className="note">
                O₂ {box.axes.o2 ? box.axes.o2.join('–') : 'not stated'} % · pressure {box.axes.p ? box.axes.p.map((v) => round(v, 1)).join('–') : 'not stated'} kPa · gravity {box.axes.g ? box.axes.g.join('–') : 'not stated'} g · flow {box.axes.flow ? box.axes.flow.join('–') : 'not stated'} cm/s
              </div>
              {box.note && <div className="note" style={{ marginTop: 4 }}>{box.note}</div>}
              <div style={{ marginTop: 6 }}><Cite id={box.id} kb={kb} onCite={onCite} /></div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h3>Gaps for your spec</h3>
            {!plan && <p className="note">Fix the inputs in the planner first.</p>}
            {plan && (
              <>
                <p className="note" style={{ marginBottom: 10 }}>
                  {Q[plan.spec.question].label} · {round(plan.spec.o2_pct, 1)}% O₂ · {round(plan.spec.pressure_kPa, 1)} kPa · {round(plan.spec.gravity_g, 3)} g
                </p>
                <div className="stack">
                  {plan.coverage.gaps.length === 0 && <div className="callout good">No gap found against the evidence we hold.</div>}
                  {plan.coverage.gaps.map((g) => (
                    <div key={g.id} className={'callout ' + (g.severity === 'high' ? 'bad' : g.severity === 'medium' ? 'warn' : '')}>
                      <b>{g.title}</b>
                      {g.detail && <div className="note" style={{ marginTop: 4 }}>{g.detail}</div>}
                      <div style={{ marginTop: 4 }}>{g.cites.map((c) => <Cite key={c} id={c} kb={kb} onCite={onCite} />)}</div>
                    </div>
                  ))}
                </div>
                <button className="btn primary" style={{ marginTop: 14 }} onClick={() => goTab('planner')}>Plan an experiment for this</button>
              </>
            )}
          </div>
          {kb.gaps.length > 0 && (
            <div className="card">
              <h3>Gaps we recorded</h3>
              <div className="stack">
                {kb.gaps.map((g) => (
                  <div key={g.id} className="callout">
                    <b>{g.title}</b>
                    <div className="note" style={{ marginTop: 4 }}>{g.statement}</div>
                    <div style={{ marginTop: 4 }}><Cite id={g.id} kb={kb} onCite={onCite} /> <Prov prov={g.prov} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {plan && <p className="note">{plan.coverage.note}</p>}
        </div>
      </div>
    </div>
  )
}
