import { useState } from 'react'
import { MATERIALS, MAT, QUESTIONS, Q, defaultSpec, planContext } from '../lib/plan.js'
import { PSI_TO_KPA, REGIME_LABEL, regimeOfG, round } from '../lib/psi.js'
import { BRIEF_PROMPT, askAssistant, localBrief } from '../lib/assistant.js'
import { download } from '../lib/rank.js'
import { AxisChip, Cite, Eyebrow, Prov, Rich } from '../ui/bits.jsx'
import Icon from '../ui/icons.jsx'
import SliderField, { SLIDE, coverBands } from '../ui/SliderField.jsx'

const REG = [['Microgravity', 0], ['Moon', 0.165], ['Mars', 0.378], ['Earth 1 g', 1]]
const loPct = (z) => Math.max(2, Math.min(98, 50 + (z / 6) * 50))

function Part({ n, title, tag, children }) {
  return (
    <section className="card" id={'part-' + n}>
      <div className="card-h">
        <Eyebrow n={String(n).padStart(2, '0')}>{tag}</Eyebrow>
      </div>
      <h3 style={{ fontSize: 22, marginBottom: 12 }}>{title}</h3>
      {children}
    </section>
  )
}

function PriorRow({ it, i, onCite, kb }) {
  const quote = it.quote ? String(it.quote).split('||')[0].trim().slice(0, 240) : ''
  return (
    <div className="row">
      <div className="rk">{String(i + 1).padStart(2, '0')}</div>
      <div style={{ minWidth: 0 }}>
        <div className="t">{it.title}</div>
        {it.note && <div className="sub">{it.note}</div>}
        <div className="meta">
          <Prov prov={it.prov} />
          <span className="chip">{it.kind}</span>
          {it.axes.map((a) => (
            <AxisChip key={a.key} a={a} />
          ))}
        </div>
        <details className="why">
          <summary>Why this rank</summary>
          <div className="whybox">
            {it.axes.map((a) => (
              <div key={a.key} className="brk">
                <span>{a.label}</span>
                <span className="meter"><i style={{ width: a.score * 100 + '%' }} /></span>
                <span className="note">{a.score}</span>
              </div>
            ))}
            <p className="note" style={{ marginTop: 8 }}>
              Match = mean of the axis scores (inside 1, near 0.5, outside or not stated 0). {it.axes.map((a) => a.detail).join(' \u00b7 ')}
            </p>
            {quote && <p className="note">Source text: “{quote}”</p>}
            <div>{it.cites.slice(0, 4).map((c) => <Cite key={c} id={c} kb={kb} onCite={onCite} />)}</div>
          </div>
        </details>
      </div>
      <div className="match">
        <b>{Math.round(it.score * 100)}%</b>
        <span>MATCH</span>
        <div className="meter"><i style={{ width: it.score * 100 + '%' }} /></div>
      </div>
    </div>
  )
}

export default function Planner({ raw, setRaw, problems, plan, kb, ctx, presets, persona, onCite, goTab }) {
  const [brief, setBrief] = useState(null)
  const set = (k, v) => {
    setBrief(null)
    setRaw((s) => ({ ...s, [k]: v }))
  }
  const setMaterial = (key) => {
    setBrief(null)
    setRaw((s) => ({ ...s, material_class: key, thickness_mm: MAT[key].thickness }))
  }
  const usePreset = (p) => {
    setBrief(null)
    setRaw({ ...defaultSpec(), ...p.spec })
  }

  const writeBrief = async (useAI) => {
    if (!plan) return
    if (!useAI) return setBrief({ mode: 'local', text: localBrief(plan, kb) })
    setBrief({ mode: 'ai', busy: true })
    try {
      const text = await askAssistant({ messages: [{ role: 'user', text: BRIEF_PROMPT }], context: planContext(plan, kb, persona), persona })
      setBrief({ mode: 'ai', text })
    } catch (e) {
      setBrief({ mode: 'error', text: String(e.message || e) })
    }
  }

  const measured = plan ? plan.priorArt.items.filter((i) => i.kind !== 'investigation') : []
  const inv = plan ? plan.priorArt.items.filter((i) => i.kind === 'investigation') : []
  const sp = plan?.prediction.spread
  const lim = plan?.prediction.limit
  const gapsN = plan ? plan.coverage.gaps.filter((g) => g.severity !== 'info').length : 0
  const nearRung = sp?.applicable ? [...sp.rungs].sort((a, b) => Math.abs(a.o2 - plan.spec.o2_pct) - Math.abs(b.o2 - plan.spec.o2_pct))[0] : null
  const bandsOf = { o2_pct: coverBands(kb, 'o2'), pressure_kPa: coverBands(kb, 'p'), gravity_g: coverBands(kb, 'g'), flow_cms: coverBands(kb, 'flow') }

  return (
    <div className="page">
      <div className="hero hero-grid">
        <div>
          <Eyebrow n="01">Experiment planner</Eyebrow>
          <h1 className="display">
            Describe an experiment.<br />
            See what <em>evidence</em> exists.
          </h1>
          <p className="lede">
            State the fuel, atmosphere and gravity. You get five cited answers: has it been done, what is missing, what to run next, what we expect, and a written brief. Where the data stops, it says so.
          </p>
        </div>
        {plan && (
          <div className="glance" aria-label="Plan at a glance">
            <div className={'tile ' + (plan.priorArt.verdict.level === 'direct' ? 'good' : plan.priorArt.verdict.level === 'partial' ? 'warn' : 'bad')}>
              <div className="k"><Icon name="book" size={14} /> Has it been done?</div>
              <div className="v">{plan.priorArt.verdict.level === 'direct' ? 'Yes' : plan.priorArt.verdict.level === 'partial' ? 'Partly' : 'No match'}</div>
              <div className="s">{measured.length} measured sources checked</div>
            </div>
            <div className={'tile ' + (gapsN === 0 ? 'good' : gapsN > 2 ? 'bad' : 'warn')}>
              <div className="k"><Icon name="map" size={14} /> What is missing?</div>
              <div className="v">{gapsN} gap{gapsN === 1 ? '' : 's'}</div>
              <div className="s">on the axes you set</div>
            </div>
            <div className="tile">
              <div className="k"><Icon name="earth" size={14} /> Regime</div>
              <div className="v">{REGIME_LABEL[regimeOfG(plan.spec.gravity_g)]}</div>
              <div className="s">{round(plan.spec.gravity_g, 3)} g</div>
            </div>
            <div className={'tile' + (nearRung && nearRung.outside.length ? ' warn' : '')}>
              <div className="k"><Icon name="flame" size={14} /> Model estimate</div>
              <div className="v">{nearRung ? (nearRung.spread ? 'Spreads' : 'Extinguishes') : lim?.applicable ? round(lim.o2, 1) + '% O\u2082' : 'No model'}</div>
              <div className="s">{nearRung ? `at ${nearRung.o2}% O\u2082${nearRung.outside.length ? ' \u00b7 extrapolation' : ''}` : lim?.applicable ? 'extinction limit' : 'outside model scope'}</div>
            </div>
          </div>
        )}
      </div>

      <div className="cols">
        <aside className="sticky">
          <div className="card">
            <div className="card-h">
              <h3 style={{ margin: 0 }}>Your experiment</h3>
              <span className="grow" />
              <button className="btn sm ghost" onClick={() => { setBrief(null); setRaw(defaultSpec()) }}><Icon name="reset" size={13} /> Reset</button>
            </div>
            <div className="lbl" style={{ marginBottom: 6 }}>Start from</div>
            <div className="preset-grid">
              {presets.map((p) => (
                <button key={p.id} className="preset" title={p.label} onClick={() => usePreset(p)}>
                  <b>{p.label.split(/[:(]/)[0].trim()}</b>
                  <span>{`${p.spec.o2_pct}% O\u2082 \u00b7 ${round(p.spec.pressure_kPa, 1)} kPa \u00b7 ${p.spec.gravity_g} g`}</span>
                </button>
              ))}
            </div>

            <label className="field">
              <span>Material</span>
              <select value={raw.material_class} onChange={(e) => setMaterial(e.target.value)}>
                {MATERIALS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </label>
            <SliderField label="Thickness" unit="mm" value={raw.thickness_mm} onChange={(v) => set('thickness_mm', v)} cfg={SLIDE.thickness_mm} />
            <SliderField label="Oxygen" unit="%" value={raw.o2_pct} onChange={(v) => set('o2_pct', v)} cfg={SLIDE.o2_pct} bands={bandsOf.o2_pct} bandLabel="measured data" />
            <SliderField
              label="Pressure (absolute)"
              unit="kPa"
              value={raw.pressure_kPa}
              onChange={(v) => set('pressure_kPa', v)}
              cfg={SLIDE.pressure_kPa}
              bands={bandsOf.pressure_kPa}
              bandLabel="measured data"
              hint={Number.isFinite(+raw.pressure_kPa) && raw.pressure_kPa !== '' ? `\u2248 ${round(raw.pressure_kPa / PSI_TO_KPA, 2)} psi` : undefined}
            />
            <SliderField
              label="Gravity"
              unit="g"
              value={raw.gravity_g}
              onChange={(v) => set('gravity_g', v)}
              cfg={SLIDE.gravity_g}
              bands={bandsOf.gravity_g}
              bandLabel="measured data"
              hint="Micro and Earth are measured reference points. Nothing between them is interpolated."
            />
            <SliderField label="Airflow (optional)" unit="cm/s" value={raw.flow_cms} onChange={(v) => set('flow_cms', v)} cfg={SLIDE.flow_cms} bands={bandsOf.flow_cms} bandLabel="measured data" />
            <div className="lbl" style={{ marginBottom: 6 }}>Question</div>
            <div className="pills">
              {QUESTIONS.map((q) => (
                <button key={q.key} className={'pill' + (raw.question === q.key ? ' on' : '')} onClick={() => set('question', q.key)}>{q.label}</button>
              ))}
            </div>
            {problems.length > 0 && (
              <div className="callout bad" style={{ marginTop: 14 }}>
                {problems.map((p) => <div key={p}>{p}</div>)}
              </div>
            )}
            {plan && (
              <p className="note" style={{ marginTop: 14 }}>
                Regime: <b>{REGIME_LABEL[regimeOfG(plan.spec.gravity_g)]}</b>. Everything on the right is computed from your inputs by visible rules; nothing is typed in by hand.
              </p>
            )}
          </div>
        </aside>

        <div className="stack">
          {!plan && <div className="empty">Fix the inputs on the left to run the plan.</div>}
          {plan && (
            <>
              <nav className="jump" aria-label="Jump to a part">
                {[['Prior art', 1], ['Gaps', 2], ['Next experiment', 3], ['Prediction', 4], ['Brief', 5]].map(([l, n]) => (
                  <a key={n} href={'#part-' + n} onClick={(e) => { e.preventDefault(); document.getElementById('part-' + n)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><b>{String(n).padStart(2, '0')}</b> {l}</a>
                ))}
              </nav>
              <Part n={1} tag="Prior art" title="Has this been done?">
                <div className={'callout ' + (plan.priorArt.verdict.level === 'direct' ? 'good' : plan.priorArt.verdict.level === 'partial' ? 'warn' : 'bad')}>
                  <b>{plan.priorArt.verdict.text}</b>
                  <span> {plan.priorArt.verdict.ids.slice(0, 3).map((id) => <Cite key={id} id={id} kb={kb} onCite={onCite} />)}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {measured.slice(0, 2).map((it, i) => <PriorRow key={it.id} it={it} i={i} kb={kb} onCite={onCite} />)}
                </div>
                {measured.length > 2 && (
                  <details className="why" style={{ marginTop: 2 }}>
                    <summary>Show {Math.min(3, measured.length - 2)} more measured sources</summary>
                    <div style={{ marginTop: 4 }}>
                      {measured.slice(2, 5).map((it, i) => <PriorRow key={it.id} it={it} i={i + 2} kb={kb} onCite={onCite} />)}
                    </div>
                  </details>
                )}
                <details className="why" style={{ marginTop: 6 }}>
                  <summary>PSI investigations (metadata unreviewed; no numeric conditions extracted yet)</summary>
                  <div style={{ marginTop: 8 }}>
                    {inv.slice(0, 4).map((it, i) => <PriorRow key={it.id} it={it} i={i} kb={kb} onCite={onCite} />)}
                  </div>
                </details>
              </Part>

              <Part n={2} tag="Coverage and gaps" title="What is missing?">
                <table className="tbl">
                  <thead>
                    <tr><th>Axis</th><th className="num">Your value</th><th>Measured sources inside</th><th>On a related fuel</th></tr>
                  </thead>
                  <tbody>
                    {plan.coverage.rows.map((r) => (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        <td className="num">{round(r.value, 3)} {r.unit}</td>
                        <td>{r.hits.length ? <span className="chip ok">{r.hits.length}</span> : <span className="chip bad">none</span>} {r.hits.slice(0, 3).map((id) => <Cite key={id} id={id} kb={kb} onCite={onCite} />)}</td>
                        <td>{r.related.length ? <span className="chip ok">{r.related.length}</span> : <span className="chip bad">none</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="stack" style={{ marginTop: 14 }}>
                  {plan.coverage.gaps.length === 0 && <div className="callout good">No gap found against the evidence we hold.</div>}
                  {plan.coverage.gaps.map((g) => (
                    <div key={g.id} className={'callout ' + (g.severity === 'high' ? 'bad' : g.severity === 'medium' ? 'warn' : '')}>
                      <span className={'chip ' + (g.severity === 'high' ? 'bad' : g.severity === 'medium' ? 'estimated' : '')} style={{ marginRight: 8 }}>{g.severity}</span>
                      <b>{g.title}</b>
                      {g.detail && <div className="note" style={{ marginTop: 4 }}>{g.detail}</div>}
                      <div style={{ marginTop: 4 }}>{g.cites.map((c) => <Cite key={c} id={c} kb={kb} onCite={onCite} />)}</div>
                    </div>
                  ))}
                </div>
                <p className="note" style={{ marginTop: 10 }}>{plan.coverage.note}</p>
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => goTab('gaps')}>See it on the map</button>
              </Part>

              <Part n={3} tag={plan.proposal.basis === 'quantitative' ? 'Proposed experiment \u00b7 quantitative basis' : 'Proposed experiment \u00b7 rule-based'} title={plan.proposal.title}>
                <p className="lede" style={{ fontSize: 14 }}>{plan.proposal.summary}</p>
                <div className="trio">
                  <div><h5><Icon name="scatter" size={14} /> Vary</h5><ul>{plan.proposal.vary.map((v) => <li key={v}>{v}</li>)}</ul></div>
                  <div><h5><Icon name="layers" size={14} /> Hold</h5><ul>{plan.proposal.hold.map((v) => <li key={v}>{v}</li>)}</ul></div>
                  <div><h5><Icon name="gauge" size={14} /> Measure</h5><ul>{plan.proposal.measure.map((v) => <li key={v}>{v}</li>)}</ul></div>
                </div>
                <dl className="kv" style={{ marginTop: 12 }}>
                  {plan.proposal.conditions.length > 0 && (<><dt>Conditions</dt><dd><ul>{plan.proposal.conditions.map((v) => <li key={v}>{v}</li>)}</ul></dd></>)}
                  {plan.proposal.platform && (
                    <>
                      <dt>Platform</dt>
                      <dd>
                        <b>{plan.proposal.platform.title}</b> <Cite id={plan.proposal.platform.id} kb={kb} onCite={onCite} />
                        <div className="note">{plan.proposal.platform.why}. {plan.proposal.platform.constraint}</div>
                      </dd>
                    </>
                  )}
                  <dt>Why</dt><dd><ul>{plan.proposal.reasoning.map((v) => <li key={v}>{v}</li>)}</ul></dd>
                  <dt>Uncertainty</dt><dd><ul>{plan.proposal.uncertainty.map((v) => <li key={v}>{v}</li>)}</ul></dd>
                </dl>
                <div style={{ marginTop: 8 }}>{plan.proposal.cites.slice(0, 6).map((c) => <Cite key={c} id={c} kb={kb} onCite={onCite} />)}</div>
              </Part>

              <Part n={4} tag="Prediction · MARGIN models" title="What do we expect?">
                {sp && !sp.applicable && <div className="callout warn"><b>MARGIN-Spread: not applicable.</b> {sp.reason}</div>}
                {sp?.applicable && (
                  <>
                    <div className="lbl" style={{ marginBottom: 4 }}>MARGIN-Spread: does a burning thin sample keep spreading?</div>
                    {sp.outsideMaterial && <div className="callout warn" style={{ margin: '8px 0' }}>This material is outside the classifier’s training set; read the score as a trend, not a result.</div>}
                    {sp.rungs.map((r) => (
                      <div key={r.o2} className="rung">
                        <span className="num">{r.o2}% O₂</span>
                        <span className={'cls ' + (r.spread ? 's' : 'e')}>{r.spread ? 'spreads' : 'extinguishes'}</span>
                        <div className="lo-bar" title={'log-odds ' + round(r.z, 2)}>
                          <i className="mid" />
                          <i className={'pt ' + (r.spread ? '' : 'e') + (r.outside.length ? ' out' : '')} style={{ left: loPct(r.z) + '%' }} />
                        </div>
                        <span className="note num">{r.z >= 0 ? '+' : ''}{round(r.z, 2)}{r.outside.length ? ' \u00b7 outside' : ''}</span>
                      </div>
                    ))}
                    <p className="note">Dashed marker = at least one input is outside the trained range ({sp.rungs.find((r) => r.outside.length)?.outside.join(', ') || 'none'}). Uncalibrated score, not a probability.</p>
                    <div className="lbl" style={{ margin: '14px 0 6px' }}>Nearest real cases (Takahashi 2026, labels estimated from Fig. 7)</div>
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead><tr><th>Test</th><th>Material</th><th className="num">g</th><th className="num">O₂ %</th><th className="num">kPa</th><th>Outcome</th></tr></thead>
                        <tbody>
                          {sp.near.map((c) => (
                            <tr key={c.test_id}><td className="num">{c.test_id}</td><td>{c.material}</td><td className="num">{c.gravity_label}</td><td className="num">{c.o2_pct}</td><td className="num">{c.pressure_kPa}</td><td>{c.outcome}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {lim && !lim.applicable && <p className="note" style={{ marginTop: 12 }}><b>MARGIN-Limit:</b> {lim.reason}</p>}
                {lim?.applicable && (
                  <div className="callout" style={{ marginTop: 14 }}>
                    <div className="lbl">MARGIN-Limit: O₂ at extinction, PMMA sphere, {lim.flow} cm/s</div>
                    <div className="big-num" style={{ margin: '6px 0' }}>{round(lim.o2, 1)}%</div>
                    <div className="note">90% band {round(lim.lo, 1)} to {round(lim.hi, 1)} % O₂ · leave-one-out error {round(lim.fit.loo, 2)} · {lim.fit.n} points{lim.outside.length ? ' · outside range: ' + lim.outside.join(', ') : ''}</div>
                  </div>
                )}
                <p className="note" style={{ marginTop: 12 }}>
                  Estimates from small retrospective models on figure-derived labels. Held-out checks: {plan.prediction.retained.map((r) => `${r.ok}/${r.n} (${r.short})`).join(', ')}.
                </p>
              </Part>

              <Part n={5} tag="Brief" title="Write it up">
                <p className="lede" style={{ fontSize: 14 }}>
                  The assistant writes from the four parts above and nothing else. The no-AI summary is a fixed template over the same parts, so you can always check a sentence against its source.
                </p>
                <div className="row-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                  <button className="btn primary" disabled={brief?.busy} onClick={() => writeBrief(true)}>{brief?.busy ? 'Writing\u2026' : 'Write the brief with the assistant'}</button>
                  <button className="btn" onClick={() => writeBrief(false)}>Summary without AI</button>
                  <button className="btn ghost" onClick={() => download('plan_context.json', JSON.stringify(planContext(plan, kb, persona), null, 1), 'application/json')}><Icon name="download" size={14} /> Download plan (JSON)</button>
                </div>
                {brief?.busy && <div className="note"><span className="spin" /> asking the assistant…</div>}
                {brief?.mode === 'error' && (
                  <div className="callout bad">
                    {brief.text}
                    <div className="note" style={{ marginTop: 6 }}>The template summary does not need the assistant.</div>
                  </div>
                )}
                {brief?.text && brief.mode !== 'error' && (
                  <div className="callout">
                    <div className="chip lav" style={{ marginBottom: 8 }}>{brief.mode === 'ai' ? 'written by the assistant from parts 1\u20134' : 'template summary, no AI'}</div>
                    <div className="prose"><Rich text={brief.text} kb={kb} onCite={onCite} /></div>
                  </div>
                )}
              </Part>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
