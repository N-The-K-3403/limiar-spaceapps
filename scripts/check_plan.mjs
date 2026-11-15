// Runs the Experiment Planner logic on the real JSON files for every preset and a few edge cases. Input: web/public data -> output: pass/fail lines.
// Usage: node web/scripts/check_plan.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { makeCtx } from '../src/graph/defs.js'
import { buildKB } from '../src/lib/psi.js'
import { fitLimit } from '../src/lib/limitmodel.js'
import { defaultSpec, planContext, presetsOf, runPlan } from '../src/lib/plan.js'
import { localBrief } from '../src/lib/assistant.js'
import { rankInvestigations, compareInvestigations, TARGETS } from '../src/lib/rank.js'
import { normalizeSpec } from '../src/ui/spec.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const j = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const data = { model: j('models/takahashi_live_model.json'), cases: j('data/takahashi_cases.json'), manifest: j('data/manifest.json'), graph: j('data/graph.json'), sofie: j('data/sofie_points.json') }
const ctx = makeCtx(data)
const kb = buildKB({ graph: data.graph, sofie: data.sofie, cases: data.cases })
const fit = fitLimit(data.sofie)

let bad = 0
const ok = (cond, msg) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg)
  if (!cond) bad++
}

ok(!!fit && fit.n >= 30, `limit fit built from ${fit?.n} points, sd ${fit?.sd.toFixed(2)}, loo ${fit?.loo.toFixed(2)}`)
ok(ctx.retained.map((r) => `${r.ok}/${r.n}`).join(' ') === '12/17 9/12 5/6', `held-out counts ${ctx.retained.map((r) => `${r.ok}/${r.n}`).join(' ')} (expect 12/17 9/12 5/6)`)
ok(kb.boxes.length >= 17, `${kb.boxes.length} measured/dataset boxes, ${kb.inv.length} investigations`)

const presets = presetsOf(kb)
ok(presets.length >= 4, `${presets.length} presets: ${presets.map((p) => p.id).join(', ')}`)
const specs = [{ id: 'default', spec: defaultSpec() }, ...presets]
for (const p of specs) {
  const n = normalizeSpec({ ...defaultSpec(), ...p.spec })
  ok(n.valid, `${p.id}: spec valid ${n.problems.join(' ')}`)
  try {
    const plan = runPlan(n.spec, ctx, kb, fit)
    const sp = plan.prediction.spread
    ok(plan.priorArt.items.length > 10 && plan.coverage.rows.length >= 3, `${p.id}: prior art ${plan.priorArt.items.length} items, verdict "${plan.priorArt.verdict.level}", ${plan.coverage.gaps.length} gaps, proposal ${plan.proposal.basis}`)
    ok(typeof planContext(plan, kb, 'Student') === 'object' && localBrief(plan, kb).length > 200, `${p.id}: context + local brief ok; spread ${sp.applicable ? sp.rungs.map((r) => r.o2 + '%:' + (r.spread ? 'S' : 'E')).join(' ') : 'n/a'}; limit ${plan.prediction.limit.applicable ? plan.prediction.limit.o2.toFixed(1) + '%' : 'n/a'}`)
  } catch (e) {
    ok(false, `${p.id}: threw ${e.stack}`)
  }
}

// edge cases
for (const [name, patch] of [
  ['liquid droplet, flow empty', { material_class: 'liquid_droplet', gravity_g: 0, o2_pct: 21, pressure_kPa: 101.3, question: 'suppression' }],
  ['smoke detection', { material_class: 'polymer_smoke', gravity_g: 0, question: 'detection', flow_cms: 8.1 }],
  ['1 g', { gravity_g: 1, o2_pct: 21, pressure_kPa: 101.3 }],
  ['100% O2 suit, thick PMMA', { material_class: 'pmma_thick', thickness_mm: 40, o2_pct: 100, pressure_kPa: 29.6, gravity_g: 0.165, question: 'ignition' }],
]) {
  const n = normalizeSpec({ ...defaultSpec(), ...patch })
  try {
    const plan = runPlan(n.spec, ctx, kb, fit)
    ok(!!plan.proposal.title, `${name}: ${plan.proposal.basis}, verdict ${plan.priorArt.verdict.level}`)
  } catch (e) {
    ok(false, `${name}: threw ${e.stack}`)
  }
}
ok(!normalizeSpec({ ...defaultSpec(), o2_pct: '' }).valid && !normalizeSpec({ ...defaultSpec(), o2_pct: 140 }).valid, 'invalid inputs are rejected before the plan runs')

// ranking + compare
for (const t of TARGETS) {
  const r = rankInvestigations(kb, t.key)
  ok(r.rows.length === kb.inv.length && r.rows[0].score >= r.rows.at(-1).score, `ranking ${t.key}: top ${r.rows[0].node.acronym} (${r.rows[0].score.toFixed(2)})`)
}
const cmp = compareInvestigations(kb, ['PSI-25', 'PSI-100'])
ok(cmp.cols.length === 2 && cmp.groups.some((g) => g.rows.some((r) => r.differs)), 'compare BASS-II vs SAFFIRE-III returns differences')

console.log(bad ? `\n${bad} check(s) FAILED` : '\nall checks passed')
process.exit(bad ? 1 : 0)
