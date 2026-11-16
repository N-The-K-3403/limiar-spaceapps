// TEMP (delete by hand): prints counts from web/public/data/graph.json. Read-only. input -> stdout.
import fs from 'node:fs'
const g = JSON.parse(fs.readFileSync('D:/Users/elias/Documents/nasaspaceapps/web/public/data/graph.json', 'utf8'))
const out = {}
out.topKeys = Object.keys(g)
out.nodes = (g.nodes || []).length
out.edges = (g.edges || []).length
const by = (arr, f) => { const m = {}; for (const x of arr) { const k = f(x); m[k] = (m[k] || 0) + 1 } return m }
out.nodeTypes = by(g.nodes || [], (n) => n.type || n.kind || 'na')
out.edgeTypes = by(g.edges || [], (e) => e.type || e.kind || e.rel || 'na')
const nodes = g.nodes || []
const sample = {}
for (const n of nodes) { const t = n.type || n.kind || 'na'; if (!sample[t]) sample[t] = Object.keys(n) }
out.nodeKeysByType = sample
const inv = nodes.filter((n) => (n.type || n.kind) === 'investigation')
out.investigations = inv.length
out.pillars = by(inv, (n) => n.pillar)
out.platforms = by(inv, (n) => n.platform)
out.fuelClass = by(inv, (n) => n.fuel_class)
out.withExperimentalTable = inv.filter((n) => n.has_experimental_table).length
out.invAcronyms = inv.map((n) => n.acronym).join(', ')
const papers = nodes.filter((n) => (n.type || n.kind) === 'paper')
out.papers = papers.map((n) => n.title || n.id)
const gaps = nodes.filter((n) => (n.type || n.kind) === 'gap')
out.gaps = gaps.map((n) => n.title || n.id)
const ev = nodes.filter((n) => ['measured', 'dataset', 'evidence'].includes(n.type || n.kind))
out.measuredEvidence = ev.map((n) => (n.title || n.id) + ' [' + (n.prov || n.provenance || '') + ']')
console.log(JSON.stringify(out, null, 1))
