// Experiment Planner logic (F14). Pure functions: spec -> prior art, gaps, proposal, prediction, context for the assistant.
// Rules are explicit and inspectable: per-axis match (inside / near / outside / unknown), no embeddings, no hidden scores.
// An axis that a source does not state counts as NOT confirmed (it lowers the match), never as a match.

import { LABELS, NUMERIC, domainReport, nearestCases, score } from '../model.js'
import { limitDomain } from './limitmodel.js'
import { PSI_TO_KPA, REGIME_LABEL, regimeOfG, round } from './psi.js'

export const G_MIN = 0.05
export const G_MAX = 0.6
export const LUNAR_BOUNDS = { o2_min: 30, p_max_kPa: round(10.2 * PSI_TO_KPA, 1) } // challenge text: >= 30% O2 and <= 10.2 psi

export const MATERIALS = [
  { key: 'pmma_thin_film', label: 'Thin PMMA film (ACRYPLEN)', model: 'ACRYPLEN', family: 'pmma', thin: true, fuel: 'solid', thickness: 0.125 },
  { key: 'paper_thin', label: 'Thin paper (filter paper)', model: 'Filter paper', family: 'paper', thin: true, fuel: 'solid', thickness: 0.12 },
  { key: 'fabric', label: 'Fabric (SIBAL, cotton)', model: null, family: 'fabric', thin: true, fuel: 'solid', thickness: 0.3 },
  { key: 'pmma_thick', label: 'Thick PMMA (rod, sphere, slab)', model: null, family: 'pmma', thin: false, fuel: 'solid', thickness: 40 },
  { key: 'liquid_droplet', label: 'Liquid fuel droplet', model: null, family: 'liquid', thin: false, fuel: 'liquid', thickness: 1 },
  { key: 'polymer_smoke', label: 'Smoke from a heated polymer', model: null, family: 'smoke', thin: false, fuel: 'smoke', thickness: 1 },
]
export const MAT = Object.fromEntries(MATERIALS.map((m) => [m.key, m]))

export const QUESTIONS = [
  { key: 'spread', label: 'Flame spread', re: /spread/, pillar: 'prevention' },
  { key: 'extinction', label: 'Extinction limit', re: /extinct|extinguish/, pillar: 'prevention' },
  { key: 'ignition', label: 'Ignition', re: /ignit/, pillar: 'prevention' },
  { key: 'detection', label: 'Smoke detection', re: /detect/, pillar: 'detection' },
  { key: 'suppression', label: 'Suppression', re: /extinguish|suppress/, pillar: 'suppression' },
]
export const Q = Object.fromEntries(QUESTIONS.map((q) => [q.key, q]))

export const defaultSpec = () => ({ material_class: 'pmma_thin_film', thickness_mm: 0.125, o2_pct: 30, pressure_kPa: LUNAR_BOUNDS.p_max_kPa, gravity_g: 0.165, flow_cms: null, question: 'spread' })

export function presetsOf(kb) {
  const sc = (id, patch = {}) => {
    const n = kb.node(id)
    return n ? { id, label: n.title, spec: { ...defaultSpec(), o2_pct: n.o2, pressure_kPa: n.p_kpa, gravity_g: n.g, ...patch }, cite: id } : null
  }
  return [
    sc('SC_MOON_CHALLENGE'),
    sc('SC_MOON_EARLY'),
    sc('SC_ISS_CABIN', { gravity_g: 0 }),
    sc('SC_EVA_SUIT'),
    { id: 'PRESET_SOFIE', label: 'SoFIE-GEL case: PMMA sphere, 21% O2, 1 atm, microgravity, 10 cm/s', spec: { material_class: 'pmma_thick', thickness_mm: 40, o2_pct: 21, pressure_kPa: 101.3, gravity_g: 0, flow_cms: 10, question: 'extinction' }, cite: 'DATA_SOFIE_GEL' },
  ].filter(Boolean)
}

// ---------------------------------------------------------------- axis matching
const AX = { o2: { label: 'O\u2082', unit: '%' }, p: { label: 'Pressure', unit: 'kPa' }, g: { label: 'Gravity', unit: 'g' }, flow: { label: 'Flow', unit: 'cm/s' } }
const TOL = { o2: () => 3, p: (v) => 0.15 * v, g: () => 0.08, flow: (v) => 0.5 * v + 0.5 }
const fmt = (v) => (Math.abs(v) >= 100 ? round(v, 0) : round(v, 2))
const rng = (r) => (r[0] === r[1] ? `${fmt(r[0])}` : `${fmt(r[0])}\u2013${fmt(r[1])}`)

function axisCheck(key, value, range) {
  const { label, unit } = AX[key]
  if (!range) return { key, label, status: 'unknown', score: 0, detail: `${label}: not stated in the source` }
  const [lo, hi] = range
  if (value >= lo - 1e-9 && value <= hi + 1e-9) return { key, label, status: 'inside', score: 1, range, detail: `${label} ${fmt(value)} ${unit} is inside ${rng(range)}` }
  const dist = value < lo ? lo - value : value - hi
  if (dist <= TOL[key](value)) return { key, label, status: 'near', score: 0.5, range, detail: `${label} ${fmt(value)} ${unit} is close to ${rng(range)}` }
  return { key, label, status: 'outside', score: 0, range, detail: `${label} ${fmt(value)} ${unit} vs ${rng(range)}` }
}

function fuelCheck(specClass, classes) {
  const s = MAT[specClass]
  const label = 'Fuel'
  if (classes.includes(specClass)) return { key: 'fuel', label, status: 'inside', score: 1, detail: `${s.label}: same material class` }
  const rel = classes.map((c) => MAT[c]).find((m) => m && (m.family === s.family || (m.thin && s.thin)))
  if (rel) return { key: 'fuel', label, status: 'near', score: 0.5, detail: `${s.label} vs ${rel.label}: related, not the same` }
  return { key: 'fuel', label, status: 'outside', score: 0, detail: `${s.label} vs ${classes.map((c) => MAT[c]?.label || c).join(', ')}` }
}

function outcomeCheck(question, regime, pillars) {
  const q = Q[question]
  const label = 'Outcome'
  if (q.re.test(regime || '')) return { key: 'outcome', label, status: 'inside', score: 1, detail: `Measures ${q.label.toLowerCase()} (${String(regime).replace(/_/g, ' ')})` }
  if (pillars?.[q.pillar]) return { key: 'outcome', label, status: 'near', score: 0.5, detail: `Same safety pillar (${q.pillar}), different outcome (${String(regime).replace(/_/g, ' ')})` }
  return { key: 'outcome', label, status: 'outside', score: 0, detail: `Measures ${String(regime).replace(/_/g, ' ')}, not ${q.label.toLowerCase()}` }
}

const requestedAxes = (spec) => ['o2', 'p', 'g', ...(spec.flow_cms !== null && spec.flow_cms !== undefined ? ['flow'] : [])]
const specVal = (spec) => ({ o2: spec.o2_pct, p: spec.pressure_kPa, g: spec.gravity_g, flow: spec.flow_cms })

function scoreBox(spec, box) {
  const v = specVal(spec)
  const axes = [fuelCheck(spec.material_class, box.classes), ...requestedAxes(spec).map((k) => axisCheck(k, v[k], box.axes[k])), outcomeCheck(spec.question, box.regime, box.pillars)]
  return { axes, score: axes.reduce((s, a) => s + a.score, 0) / axes.length }
}

// investigations carry no numeric ranges yet (AI-extracted metadata, unreviewed): fuel, gravity regime and pillar only
function scoreInvestigation(spec, inv) {
  const m = MAT[spec.material_class]
  const reg = regimeOfG(spec.gravity_g)
  const fuel = inv.fuel_class === m.fuel ? { key: 'fuel', label: 'Fuel', status: 'inside', score: 1, detail: `${inv.fuel_note} (${inv.fuel_class}) matches ${m.fuel}` } : { key: 'fuel', label: 'Fuel', status: 'outside', score: 0, detail: `${inv.fuel_note} (${inv.fuel_class}) vs ${m.fuel}` }
  const partial = /partial/.test(inv.pillar_note)
  const gScore = reg === 'micro' ? (inv.platform === 'microgravity' ? 1 : 0) : reg === 'partial' ? (partial ? 1 : inv.platform === 'microgravity' ? 0.5 : 0) : inv.platform === 'ground' ? 1 : 0
  const gdetail = reg === 'partial' ? (partial ? 'Simulates partial gravity (electric field)' : inv.platform === 'microgravity' ? 'Microgravity, not partial gravity' : 'Ground test') : inv.platform === 'microgravity' ? 'Flown in microgravity' : 'Ground test'
  const gravity = { key: 'g', label: 'Gravity', status: gScore === 1 ? 'inside' : gScore ? 'near' : 'outside', score: gScore, detail: gdetail }
  const q = Q[spec.question]
  const pOK = inv.pillar === q.pillar ? 1 : inv.pillar === 'complementary' ? 0.5 : 0
  const outcome = { key: 'outcome', label: 'Outcome', status: pOK === 1 ? 'inside' : pOK ? 'near' : 'outside', score: pOK, detail: `PSI safety pillar: ${inv.pillar}` }
  const unknown = ['o2', 'p', ...(spec.flow_cms !== null && spec.flow_cms !== undefined ? ['flow'] : [])].map((k) => ({ key: k, label: AX[k].label, status: 'unknown', score: 0, detail: `${AX[k].label}: not extracted from PSI yet (unreviewed)` }))
  const axes = [fuel, ...unknown.slice(0, 2), gravity, ...unknown.slice(2), outcome]
  return { axes, score: axes.reduce((s, a) => s + a.score, 0) / axes.length }
}

export function priorArt(spec, kb) {
  const items = []
  for (const b of kb.boxes) {
    const r = scoreBox(spec, b)
    items.push({ id: b.id, title: b.title, kind: b.kind, prov: b.prov, ...r, note: b.note, quote: b.quote, pages: b.pages, papers: b.papers, cites: [b.id, ...b.papers] })
  }
  for (const n of kb.inv) {
    const r = scoreInvestigation(spec, n)
    items.push({ id: n.id, title: `${n.acronym}: ${n.title}`, kind: 'investigation', prov: 'unreviewed', ...r, note: n.hypothesis, papers: [], cites: [n.id] })
  }
  const rank = { measured: 0, dataset: 1, investigation: 2 }
  items.sort((a, b) => b.score - a.score || rank[a.kind] - rank[b.kind])
  const measured = items.filter((i) => i.kind !== 'investigation')
  const best = measured[0]
  const full = measured.filter((i) => i.score === 1)
  const n = best ? best.axes.length : 0
  const verdict = full.length
    ? { level: 'direct', text: `Yes. ${full.length} measured source${full.length > 1 ? 's cover' : ' covers'} every axis you asked about.`, ids: full.map((f) => f.id) }
    : best && best.score >= 0.5
      ? { level: 'partial', text: `Partly. The closest measured source confirms ${round(best.score * n, 1)} of ${n} axes (a near match counts half).`, ids: [best.id] }
      : { level: 'none', text: 'No match. No measured source in our evidence overlaps this spec on more than half of its axes.', ids: [] }
  return { items, verdict }
}

// ---------------------------------------------------------------- coverage and gaps
export function coverage(spec, kb) {
  const v = specVal(spec)
  const axes = requestedAxes(spec)
  const fam = MAT[spec.material_class]
  const rows = axes.map((k) => {
    const hits = kb.boxes.filter((b) => b.axes[k] && axisCheck(k, v[k], b.axes[k]).status === 'inside')
    const related = hits.filter((b) => b.classes.some((c) => c === spec.material_class || MAT[c]?.family === fam.family || (MAT[c]?.thin && fam.thin)))
    const near = hits.length ? null : kb.boxes.filter((b) => b.axes[k]).map((b) => ({ b, d: Math.max(b.axes[k][0] - v[k], v[k] - b.axes[k][1]) })).sort((x, y) => x.d - y.d)[0]
    return { key: k, label: AX[k].label, unit: AX[k].unit, value: v[k], hits: hits.map((b) => b.id), related: related.map((b) => b.id), nearest: near ? { id: near.b.id, dist: round(near.d, 2), range: near.b.axes[k] } : null }
  })
  const confirmed = kb.boxes.map((b) => ({ b, n: axes.filter((k) => axisCheck(k, v[k], b.axes[k]).status === 'inside').length, fuel: fuelCheck(spec.material_class, b.classes).score }))
  const joint = confirmed.filter((c) => c.n === axes.length)
  const jointFuel = joint.filter((c) => c.fuel > 0)
  const closest = [...confirmed].sort((a, b) => b.n - a.n || b.fuel - a.fuel).slice(0, 3).map((c) => ({ id: c.b.id, covers: c.n, of: axes.length, fuel: c.fuel }))

  const gaps = []
  for (const r of rows) {
    if (!r.hits.length) gaps.push({ id: 'GAP_' + r.key, severity: 'high', title: `No measured source covers ${r.label} = ${fmt(r.value)} ${r.unit}`, detail: r.nearest ? `Nearest range is ${rng(r.nearest.range)} (${r.nearest.id}).` : 'No source states this axis.', cites: r.nearest ? [r.nearest.id] : [] })
    else if (!r.related.length) gaps.push({ id: 'GAP_' + r.key + '_fuel', severity: 'medium', title: `${r.label} = ${fmt(r.value)} ${r.unit} is covered only on other fuels`, detail: `Covered by ${r.hits.join(', ')}; none uses a related material.`, cites: r.hits.slice(0, 3) })
  }
  if (!joint.length) gaps.push({ id: 'GAP_JOINT', severity: 'high', title: `No single source covers all ${axes.length} axes together`, detail: `Closest: ${closest.map((c) => `${c.id} (${c.covers}/${c.of})`).join(', ')}.`, cites: closest.map((c) => c.id) })
  else if (!jointFuel.length) gaps.push({ id: 'GAP_JOINT_FUEL', severity: 'medium', title: 'All axes are covered together, but never on a related material', detail: `Covered on other fuels by ${joint.map((c) => c.b.id).join(', ')}.`, cites: joint.map((c) => c.b.id) })
  const q = Q[spec.question]
  const pillarHits = kb.boxes.filter((b) => b.pillars?.[q.pillar] || q.re.test(b.regime || ''))
  if (!pillarHits.length) gaps.push({ id: 'GAP_PILLAR', severity: 'high', title: `No measured source addresses ${q.label.toLowerCase()}`, detail: '', cites: [] })
  if (regimeOfG(spec.gravity_g) === 'partial' && kb.node('GAP_PSI_PARTIAL_G')) gaps.push({ id: 'GAP_PSI_PARTIAL_G', severity: 'info', title: kb.node('GAP_PSI_PARTIAL_G').title, detail: kb.node('GAP_PSI_PARTIAL_G').statement, cites: ['GAP_PSI_PARTIAL_G'] })
  if (spec.o2_pct >= LUNAR_BOUNDS.o2_min && spec.pressure_kPa <= LUNAR_BOUNDS.p_max_kPa && kb.node('GAP_FLEX_LUNAR')) gaps.push({ id: 'GAP_FLEX_LUNAR', severity: 'info', title: kb.node('GAP_FLEX_LUNAR').title, detail: kb.node('GAP_FLEX_LUNAR').statement, cites: ['GAP_FLEX_LUNAR'] })
  return { rows, joint: joint.map((c) => c.b.id), jointFuel: jointFuel.map((c) => c.b.id), closest, gaps, note: 'Coverage counts verified evidence items and our two digitized datasets. PSI investigation conditions are not extracted yet (unreviewed), so they are not counted here.' }
}

// ---------------------------------------------------------------- experiment proposal (rule-based; quantitative only where we have a basis)
function pickPlatform(spec, kb) {
  const m = MAT[spec.material_class]
  const reg = regimeOfG(spec.gravity_g)
  let id, why
  if (reg === 'micro') {
    id = m.thin && m.family === 'fabric' ? 'PLAT_SAFFIRE' : 'PLAT_ISS_CIR'
    why = id === 'PLAT_SAFFIRE' ? 'large fabric samples with long burns' : 'microgravity with controlled flow, hours of run time'
  } else if (reg === 'partial') {
    id = m.family === 'fabric' ? 'PLAT_FM2' : m.thin ? 'PLAT_PARABOLIC' : 'PLAT_FM2'
    why = id === 'PLAT_PARABOLIC' ? 'the platform behind the existing partial-gravity data, but only seconds per parabola' : 'quiescent partial gravity for minutes (planned, not yet flown)'
  } else return null
  const n = kb.node(id)
  return n ? { id, title: n.title, why, constraint: n.constraint, quote: n.quote } : null
}

export function proposeExperiment(spec, cov, kb, ctx) {
  const m = MAT[spec.material_class]
  const reg = regimeOfG(spec.gravity_g)
  const platform = pickPlatform(spec, kb)
  const high = cov.gaps.filter((g) => g.severity === 'high')
  const sofieLike = spec.material_class === 'pmma_thick' && reg === 'micro' && Math.abs(spec.pressure_kPa - 101.3) < 2 && spec.question === 'extinction'
  const rec = kb.node('REC_PREHEAT')
  if (sofieLike && rec) {
    return {
      basis: 'quantitative',
      title: rec.title,
      summary: 'The remaining uncertainty in the SoFIE-GEL O\u2082 limit is explained mostly by sample preheating (q_c), not by new flow speeds.',
      ladder: null,
      vary: ['Sample preheating history (q_c): about 0.17 vs 1.2 W/cm\u00b2'],
      hold: ['PMMA 4 cm sphere', '1 atm', 'microgravity', 'flow about 1.1\u20131.6 cm/s'],
      measure: ['O\u2082 at extinction', 'q_c from the preheating record'],
      conditions: rec.picks.map((p) => `${p.flow_cm_s} cm/s, q_c ${p.q_c_w_cm2} W/cm\u00b2 \u2192 predicted limit ${p.predicted_o2_limit}% O\u2082 (sd ${p.prediction_sd})`),
      platform,
      reasoning: ['Our analysis: lower q_c goes with a lower extinction O\u2082 (about 3.8\u20134.6 % O\u2082 per decade of q_c).', 'This is an association in digitized points, not proof of cause; spheres were reused about 3 times.', 'New flow speeds add little: the mean limit is already known to about \u00b10.3 % O\u2082 across most of the range.'],
      uncertainty: [rec.note || 'Digitized points; q_c is an output of the flame itself.'],
      cites: ['REC_PREHEAT', 'DATA_SOFIE_GEL', 'PAPER_TIEN2025'],
    }
  }
  const o2 = spec.o2_pct
  let ladder = null
  let title, vary, hold, measure, reasoning
  const holdBase = [`${m.label}`, `pressure ${fmt(spec.pressure_kPa)} kPa`, `gravity ${fmt(spec.gravity_g)} g`, `thickness ${fmt(spec.thickness_mm)} mm`]
  if (spec.question === 'detection') {
    title = `Smoke-detector response in your atmosphere at ${fmt(spec.gravity_g)} g`
    vary = ['Airflow past the detector: 0, 2, 8 cm/s (the range SAME already covered)', 'Smoke source material']
    hold = [`atmosphere ${fmt(o2)}% O\u2082, ${fmt(spec.pressure_kPa)} kPa`, `gravity ${fmt(spec.gravity_g)} g`]
    measure = ['Particle size distribution', 'Detector alarm time', 'Smoke concentration at the sensor']
    reasoning = ['Existing smoke data (SAME) cover microgravity at 8.1 cm/s and below; your atmosphere and gravity are the new axes.', 'This is a rule-based suggestion built from the coverage gaps, not a model result.']
  } else if (spec.question === 'suppression') {
    title = `Extinguishment boundary in your atmosphere at ${fmt(spec.gravity_g)} g`
    vary = ['Diluent or agent concentration (FLEX varied CO\u2082 and N\u2082 dilution)', 'Pressure around the spec value']
    hold = [`fuel ${m.label}`, `gravity ${fmt(spec.gravity_g)} g`, `O\u2082 ${fmt(o2)}%`]
    measure = ['Extinction yes/no per step', 'Time to extinction', 'Final O\u2082 and agent concentration']
    reasoning = ['FLEX measured extinguishment of liquid droplets in microgravity, not solids in partial gravity; the suppression gap is the fuel and gravity pair.', 'This is a rule-based suggestion, not a model result.']
  } else {
    const steps = [-6, -3, 0, 3].map((d) => Math.min(100, Math.max(10, round(o2 + d, 1))))
    ladder = [...new Set(steps)]
    title = `${Q[spec.question].label}: O\u2082 ladder at ${fmt(spec.gravity_g)} g, ${fmt(spec.pressure_kPa)} kPa`
    vary = [`O\u2082 in steps: ${ladder.join(', ')} %`]
    hold = holdBase
    measure = spec.question === 'extinction' ? ['Extinction yes/no per rung', 'Final O\u2082 (post-burn sensor)'] : ['Spread vs extinguish per rung', 'Flame spread rate', 'O\u2082 at the end of the test (it can fall during a burn)']
    reasoning = [`The rungs bracket ${fmt(o2)}% O\u2082 so the outcome can flip inside the ladder; spacing follows the FM2 plan (about 4 points between tests).`, ...(high.length ? [`It targets the gaps found: ${high.map((g) => g.title.toLowerCase()).join('; ')}.`] : ['Your axes are already covered; this repeats the condition on a related fuel.'])]
  }
  const outside = ctx ? domainReport(ctx.model, specToX(spec)).filter((d) => d.status === 'outside').map((d) => d.key) : []
  return {
    basis: 'rule-based',
    title,
    summary: 'A rule-based suggestion built from the coverage gaps. No quantitative basis in our data for this exact condition.',
    ladder,
    vary,
    hold,
    measure,
    conditions: [],
    platform,
    reasoning,
    uncertainty: [outside.length ? `The classifier was not trained on: ${outside.join(', ')}. Treat any estimate for these rungs as an extrapolation.` : 'Spacing and rung count are rules of thumb, not an optimized design.'],
    cites: [...new Set([...(platform ? [platform.id] : []), ...cov.gaps.flatMap((g) => g.cites)])],
  }
}

// ---------------------------------------------------------------- prediction (MARGIN models)
export function specToX(spec, o2 = spec.o2_pct) {
  const m = MAT[spec.material_class]
  return { material: m.model || 'untrained:' + spec.material_class, thickness_mm: spec.thickness_mm, o2_pct: o2, pressure_kPa: spec.pressure_kPa, gravity_g: Math.min(G_MAX, Math.max(G_MIN, spec.gravity_g)), clampedFrom: spec.gravity_g }
}

function spreadAt(ctx, x) {
  const z = score(ctx.variants[0].model, x)
  const domain = domainReport(ctx.model, x)
  return { z, spread: z >= 0, domain, outside: domain.filter((d) => d.status === 'outside').map((d) => d.key) }
}

export function predict(spec, proposal, ctx, fit) {
  const m = MAT[spec.material_class]
  const reg = regimeOfG(spec.gravity_g)
  const out = { spread: null, limit: null, nearest: [], retained: ctx.retained }
  if (m.fuel !== 'solid') out.spread = { applicable: false, reason: `MARGIN-Spread covers thin solid fuels only; no model for ${m.fuel} fuels.` }
  else if (reg !== 'partial') out.spread = { applicable: false, reason: reg === 'micro' ? '0 g is measured reference data here, never estimated (see the evidence and the limit model).' : '1 g is measured reference data here, never estimated.' }
  else {
    const x = specToX(spec)
    const rungs = (proposal.ladder || [spec.o2_pct]).map((o) => ({ o2: o, ...spreadAt(ctx, specToX(spec, o)) }))
    const centre = spreadAt(ctx, x)
    out.spread = { applicable: true, x, centre, rungs, outsideMaterial: !m.model || !m.thin, near: nearestCases(ctx.model, ctx.cases, x, 3) }
  }
  if (fit && spec.material_class === 'pmma_thick' && spec.flow_cms) {
    const dom = limitDomain(fit, spec)
    out.limit = { applicable: true, flow: spec.flow_cms, ...fit.predict(spec.flow_cms), domain: dom, outside: dom.filter((d) => d.status === 'outside').map((d) => d.key), fit: { n: fit.n, sd: fit.sd, loo: fit.loo } }
  } else out.limit = { applicable: false, reason: spec.material_class !== 'pmma_thick' ? 'MARGIN-Limit covers PMMA spheres only (SoFIE-GEL).' : 'Give an airflow value (cm/s) to run MARGIN-Limit.' }
  return out
}

// ---------------------------------------------------------------- the whole plan
export function runPlan(spec, ctx, kb, fit) {
  const pa = priorArt(spec, kb)
  const cov = coverage(spec, kb)
  const proposal = proposeExperiment(spec, cov, kb, ctx)
  const prediction = predict(spec, proposal, ctx, fit)
  const cites = [...new Set([...pa.items.slice(0, 5).flatMap((i) => i.cites), ...cov.gaps.flatMap((g) => g.cites), ...proposal.cites])]
  return { spec, priorArt: pa, coverage: cov, proposal, prediction, cites }
}

// compact, structured context for the assistant: only what the five parts computed (it never gets to invent numbers)
export function planContext(plan, kb, persona = 'Student') {
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '\u2026' : s)
  const evidence = {}
  for (const id of plan.cites) {
    const n = kb.node(id)
    if (n) evidence[id] = { type: n.type, title: n.title, prov: n.prov, citation: n.citation, quote: clip(n.quote, 260), statement: clip(n.statement, 260), source: clip(n.source, 160) }
    else {
      const b = kb.boxes.find((x) => x.id === id)
      if (b) evidence[id] = { type: b.kind, title: b.title, prov: b.prov, note: clip(b.note, 200) }
    }
  }
  const sp = plan.prediction.spread
  const lim = plan.prediction.limit
  return {
    persona,
    spec: { ...plan.spec, material: MAT[plan.spec.material_class].label, question: Q[plan.spec.question].label, regime: REGIME_LABEL[regimeOfG(plan.spec.gravity_g)] },
    part1_prior_art: { verdict: plan.priorArt.verdict.text, top: plan.priorArt.items.slice(0, 6).map((i) => ({ id: i.id, kind: i.kind, prov: i.prov, match: round(i.score, 2), axes: i.axes.map((a) => `${a.label}: ${a.status} (${a.detail})`) })) },
    part2_gaps: plan.coverage.gaps.map((g) => ({ id: g.id, severity: g.severity, title: g.title, detail: g.detail, cites: g.cites })),
    part3_proposal: { basis: plan.proposal.basis, title: plan.proposal.title, vary: plan.proposal.vary, hold: plan.proposal.hold, measure: plan.proposal.measure, conditions: plan.proposal.conditions, platform: plan.proposal.platform && { id: plan.proposal.platform.id, title: plan.proposal.platform.title, why: plan.proposal.platform.why }, reasoning: plan.proposal.reasoning, uncertainty: plan.proposal.uncertainty },
    part4_prediction: {
      spread: sp?.applicable ? { rungs: sp.rungs.map((r) => ({ o2: r.o2, class: r.spread ? 'spreads' : 'extinguishes', log_odds: round(r.z, 2), outside_trained_range: r.outside })), material_outside_trained_set: sp.outsideMaterial, nearest_cases: sp.near.map((c) => `${c.test_id}: ${c.outcome}, ${c.material}, ${c.gravity_label} g, ${c.o2_pct}% O2, ${c.pressure_kPa} kPa`), held_out_accuracy: plan.prediction.retained.map((r) => `${r.ok}/${r.n} ${r.short}`), note: 'uncalibrated score, not a probability' } : { applicable: false, reason: sp?.reason },
      limit: lim?.applicable ? { flow_cms: lim.flow, o2_limit_pct: round(lim.o2, 1), band90: [round(lim.lo, 1), round(lim.hi, 1)], outside_trained_range: lim.outside, loo_rmse: round(lim.fit.loo, 2) } : { applicable: false, reason: lim?.reason },
    },
    evidence,
  }
}

export { LABELS, NUMERIC }
