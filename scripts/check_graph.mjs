// Headless check of the canvas evaluator: loads the real JSON, builds recipe 1, evaluates, prints what the nodes would show.
import fs from 'node:fs'
import { makeCtx } from '../src/graph/defs.js'
import { evaluateGraph, wouldCycle } from '../src/graph/evaluate.js'
import { RECIPES } from '../src/graph/recipes.js'

const rd = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'))
const ctx = makeCtx({
  model: rd('../public/models/takahashi_live_model.json'),
  cases: rd('../public/data/takahashi_cases.json'),
  manifest: rd('../public/data/manifest.json'),
})
console.log('retained:', ctx.retained.map((r) => `${r.ok}/${r.n} ${r.short}`).join(' | '), '| in-sample', `${ctx.inSample.ok}/${ctx.inSample.n}`)

const g = RECIPES[0].build()
const positions = Object.fromEntries(g.nodes.map((n) => [n.id, n.position]))
if (!(positions.scn.x < positions.spr.x && positions.spr.x < positions.dom.x && positions.dom.x < positions.cht.x)) {
  throw new Error('Recipe nodes are not laid out from scenario through model and checks to evidence.')
}
if (positions.dom.x !== positions.nrs.x || g.nodes.some((n) => !Number.isFinite(n.position.x) || !Number.isFinite(n.position.y))) {
  throw new Error('Recipe auto-layout returned an invalid check-node position.')
}
console.log('layout: scenario < model < checks < evidence')
const { results, edgeInfo, order } = evaluateGraph(g.nodes, g.edges, ctx)
console.log('order:', order.join(' > '))
for (const n of g.nodes) {
  const r = results[n.id]
  console.log(n.id, r.status, r.prov || '', r.status === 'ok' && n.type === 'spread' ? JSON.stringify({ z: r.view.z, spread: r.view.spread, outside: r.view.outside }) : '')
}
console.log('near:', results.nrs.view.near.map((c) => `${c.test_id} ${c.outcome} d=${c.distance.toFixed(2)}`).join('; '))
console.log('domain outside:', results.dom.view.outside.map((r) => r.key).join(', ') || 'none')
console.log('edges:', Object.entries(edgeInfo).map(([k, v]) => `${k}:${v.type}/${v.prov}`).join(' '))

// scenario inside the trained span (ISS-like cabin, 1/6 g): no outside flags, wire prov still weakest-of
g.nodes.find((n) => n.id === 'scn').data = { material: 'ACRYPLEN', thickness_mm: 0.125, o2_pct: 21, pressure_kPa: 101.3, gravity_g: 0.1667 }
const iss = evaluateGraph(g.nodes, g.edges, ctx)
console.log('ISS-like outside:', iss.results.dom.view.outside.length === 0 ? 'none (no warning at the boundary)' : 'UNEXPECTED')

// gravity clamp and wiring rules
g.nodes.find((n) => n.id === 'scn').data.gravity_g = 1
const clamp = evaluateGraph(g.nodes, g.edges, ctx)
console.log('1 g request clamped to', clamp.results.scn.view.x.gravity_g, 'clamped flag', clamp.results.scn.view.clamped)
console.log('cycle test (cht -> scn would loop?):', wouldCycle(g.edges, 'cht', 'scn'), '| unrelated:', wouldCycle(g.edges, 'spr', 'dom'))
const cut = evaluateGraph(g.nodes, g.edges.filter((e) => e.id !== 'e1'), ctx)
console.log('spread with wire removed:', cut.results.spr.status, cut.results.spr.missing)
