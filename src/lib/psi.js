// Knowledge base built once from graph.json + the data files. Pure JS (no React) so Node can test it.
// Everything shown in the dashboard comes from here; nothing is typed in by hand except labels.

export const PSI_TO_KPA = 6.894757
export const round = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? v : Math.round(v * 10 ** d) / 10 ** d)

// gravity regime of a number: used to compare a spec against investigations that only say "microgravity" / "ground"
export const regimeOfG = (g) => (g < 0.02 ? 'micro' : g < 0.8 ? 'partial' : 'earth')
export const REGIME_LABEL = { micro: 'Microgravity', partial: 'Partial gravity', earth: 'Normal gravity (1 g)' }

const span = (arr) => (arr.length ? [Math.min(...arr), Math.max(...arr)] : null)

export function buildKB({ graph, sofie, cases }) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const of = (t) => graph.nodes.filter((n) => n.type === t)

  // adjacency: id -> [{ rel, other, dir, prov }]
  const adj = new Map()
  const link = (a, b, e, dir) => {
    if (!adj.has(a)) adj.set(a, [])
    adj.get(a).push({ rel: e.rel, other: b, dir, prov: e.prov, pages: e.pages })
  }
  for (const e of graph.edges) {
    link(e.from, e.to, e, 'out')
    link(e.to, e.from, e, 'in')
  }
  const papersOf = (id) => (adj.get(id) || []).filter((l) => l.dir === 'out' && l.rel === 'reported_in' && byId.get(l.other)?.type === 'paper').map((l) => l.other)

  // measured boxes: verified evidence items with numeric axes
  const boxes = of('evidence').map((n) => ({
    id: n.id,
    title: n.title,
    kind: 'measured',
    prov: 'verified',
    classes: [n.material_class],
    regime: n.regime,
    pillars: n.pillars,
    axes: { o2: n.axes.o2, p: n.axes.p_kpa, g: n.axes.g, flow: n.axes.flow_cms },
    note: n.note,
    quote: n.quote,
    pages: n.pages,
    papers: papersOf(n.id),
  }))

  // dataset boxes, computed from the JSON files (never typed)
  if (cases?.length) {
    boxes.push({
      id: 'DATA_TAK_CASES',
      title: 'Takahashi partial-gravity cases (digitized labels)',
      kind: 'dataset',
      prov: 'estimated',
      classes: ['pmma_thin_film', 'paper_thin'],
      regime: 'flame_spread_limit',
      pillars: { prevention: true, detection: false, suppression: false },
      axes: { o2: span(cases.map((c) => c.o2_pct)), p: span(cases.map((c) => c.pressure_kPa)), g: span(cases.map((c) => c.gravity_g)), flow: null },
      note: `${cases.length} cases, ${new Set(cases.map((c) => c.flight_id)).size} flights; spread/extinct labels estimated from Fig. 7`,
      papers: ['PAPER_TAK2026'],
    })
  }
  const sofieUse = (sofie || []).filter((p) => p.position_confidence !== 'low')
  if (sofieUse.length) {
    boxes.push({
      id: 'DATA_SOFIE_GEL',
      title: 'SoFIE-GEL oxygen extinction limit points (PMMA spheres, 1 atm)',
      kind: 'dataset',
      prov: 'estimated',
      classes: ['pmma_thick'],
      regime: 'extinction_limit',
      pillars: { prevention: true, detection: false, suppression: false },
      axes: { o2: span(sofieUse.map((p) => p.o2_pct)), p: [101.3, 101.3], g: [0, 0], flow: span(sofieUse.map((p) => p.flow_cm_s)) },
      note: `${sofieUse.length} points; only 5 are table values, the rest are read off Fig. 8`,
      papers: ['PAPER_TIEN2025'],
    })
  }

  const inv = of('investigation')
  // catalog summary row linked to an investigation (CAT_* -uses_data_from-> PSI-*)
  const summaryOf = (id) => (adj.get(id) || []).filter((l) => l.rel === 'uses_data_from' && l.dir === 'in').map((l) => byId.get(l.other)).find(Boolean) || null

  return {
    graph,
    byId,
    adj,
    boxes,
    inv,
    papers: of('paper'),
    limits: of('limit'),
    gaps: of('gap'),
    platforms: of('platform'),
    scenarios: of('scenario'),
    models: of('model'),
    sofieUse,
    summaryOf,
    papersOf,
    node: (id) => byId.get(id),
    neighbors: (id) => (adj.get(id) || []).map((l) => ({ ...l, node: byId.get(l.other) })).filter((l) => l.node),
  }
}
