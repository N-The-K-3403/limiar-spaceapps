// Transparent ranking of PSI investigations for a habitat target + side-by-side comparison. Pure functions.
// Every score is a weighted mean of 7 visible features (0-1). Inputs are PSI metadata that is AI-extracted and unreviewed;
// keyword counts come from psi_index.csv (hits in the PSI text), so they say "mentioned", not "measured".

export const TARGETS = [
  { key: 'spacecraft', label: 'Spacecraft', g: 'micro', pillars: { prevention: 1, detection: 1, suppression: 0.8, complementary: 0.3 }, w: { relevance: 3, fuel: 3, gravity: 2, o2: 3, pressure: 3, pillar: 2, data: 2 } },
  { key: 'station', label: 'Space station', g: 'micro', pillars: { prevention: 1, detection: 1, suppression: 0.8, complementary: 0.3 }, w: { relevance: 3, fuel: 3, gravity: 2, o2: 2, pressure: 2, pillar: 3, data: 3 } },
  { key: 'moon', label: 'Moon base', g: 'partial', pillars: { prevention: 1, detection: 0.8, suppression: 0.8, complementary: 0.4 }, w: { relevance: 2, fuel: 3, gravity: 4, o2: 3, pressure: 3, pillar: 2, data: 2 } },
  { key: 'rover', label: 'Pressurized rover', g: 'partial', pillars: { prevention: 0.8, detection: 1, suppression: 1, complementary: 0.4 }, w: { relevance: 2, fuel: 2, gravity: 4, o2: 3, pressure: 4, pillar: 2, data: 2 } },
]
export const FEATURES = [
  { key: 'relevance', label: 'PSI relevance tag', hint: 'high = 1, medium = 0.5 (seed from the first screening; unreviewed)' },
  { key: 'fuel', label: 'Solid fuel', hint: 'solid 1, smoke 0.7, liquid 0.35, gas 0.25 (habitat fires start in solid materials)' },
  { key: 'gravity', label: 'Gravity fit', hint: 'partial-gravity targets favor partial gravity (and keyword hits); spacecraft favor microgravity' },
  { key: 'o2', label: 'O\u2082 relevance', hint: 'keyword hits about oxygen in the PSI text, scaled to the maximum; \u201chigh O\u2082\u201d tag = 1' },
  { key: 'pressure', label: 'Pressure relevance', hint: 'keyword hits about pressure in the PSI text, scaled to the maximum' },
  { key: 'pillar', label: 'Safety pillar fit', hint: 'prevention / detection / suppression weighted by the target' },
  { key: 'data', label: 'Data on hand', hint: 'experimental table available 0.5 + downloadable files 0.5' },
]

const clamp = (v) => Math.max(0, Math.min(1, v))

export function rankInvestigations(kb, targetKey, weights) {
  const t = TARGETS.find((x) => x.key === targetKey) || TARGETS[0]
  const w = { ...t.w, ...(weights || {}) }
  const mx = (f) => Math.max(1, ...kb.inv.map(f))
  const maxO2 = mx((n) => n.kw.o2 || 0)
  const maxP = mx((n) => n.kw.pressure || 0)
  const maxPG = mx((n) => n.kw.partial_g || 0)
  const total = Object.values(w).reduce((s, v) => s + v, 0) || 1
  const rows = kb.inv.map((n) => {
    const partial = /partial/.test(n.pillar_note)
    const base = t.g === 'partial' ? (partial ? 1 : n.platform === 'microgravity' ? 0.45 : 0.15) : n.platform === 'microgravity' ? 1 : 0.2
    const f = {
      relevance: n.relevance_seed === 'high' ? 1 : n.relevance_seed === 'medium' ? 0.5 : 0.25,
      fuel: { solid: 1, smoke: 0.7, liquid: 0.35, gas: 0.25 }[n.fuel_class] ?? 0.2,
      gravity: clamp(base + (t.g === 'partial' ? 0.4 * ((n.kw.partial_g || 0) / maxPG) : 0)),
      o2: /high O2/.test(n.pillar_note) ? 1 : (n.kw.o2 || 0) / maxO2,
      pressure: (n.kw.pressure || 0) / maxP,
      pillar: t.pillars[n.pillar] ?? 0.3,
      data: (n.has_experimental_table ? 0.5 : 0) + (n.n_files > 0 ? 0.5 : 0),
    }
    const parts = FEATURES.map((ft) => ({ key: ft.key, label: ft.label, value: f[ft.key], weight: w[ft.key], points: (f[ft.key] * w[ft.key]) / total }))
    return { id: n.id, node: n, score: parts.reduce((s, p) => s + p.points, 0), parts }
  })
  rows.sort((a, b) => b.score - a.score)
  return { target: t, weights: w, rows }
}

// ---------------------------------------------------------------- compare
const clip = (s, n = 160) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '\u2026' : s || '\u2014')
const FIELD_GROUPS = [
  ['Context', [['Environment', (n) => (n.platform === 'microgravity' ? 'Microgravity (flight)' : 'Ground'), null], ['Hardware', (n) => clip(n.hardware, 90)], ['Flight', (n) => clip(n.flight, 60)], ['Period', (n) => (n.start ? `${n.start} to ${n.end || '?'}` : '\u2014')]]],
  ['Question', [['PSI safety pillar', (n) => n.pillar], ['Fuel class', (n) => `${n.fuel_class}${n.fuel_note ? ' (' + n.fuel_note + ')' : ''}`], ['Hypothesis', (n) => clip(n.hypothesis, 220)]]],
  ['Conditions (from the paper summary, where one exists)', [['Fuel and geometry', (n, s) => (s ? clip(s.fuel + '; ' + s.geometry, 200) : '\u2014')], ['O\u2082', (n, s) => (s ? clip(s.o2, 160) : '\u2014')], ['Pressure', (n, s) => (s ? clip(s.pressure, 160) : '\u2014')], ['Flow', (n, s) => (s ? clip(s.flow, 160) : '\u2014')], ['Gravity', (n, s) => (s ? clip(s.gravity, 140) : '\u2014')], ['What varied', (n, s) => (s ? clip(s.varied, 180) : '\u2014')], ['Held fixed', (n, s) => (s ? clip(s.held_fixed, 160) : '\u2014')], ['Outcome measured', (n, s) => (s ? clip(s.outcome_measured, 200) : '\u2014')], ['Sensors', (n, s) => (s ? clip(s.sensors, 160) : '\u2014')]]],
  ['Data', [['Experimental table', (n) => (n.has_experimental_table ? 'yes' : 'no')], ['Files in PSI', (n) => String(n.n_files)], ['Publications', (n) => String(n.n_publications)], ['License', (n) => n.license || '\u2014']]],
]

export function compareInvestigations(kb, ids) {
  const cols = ids.map((id) => ({ id, node: kb.node(id), summary: kb.summaryOf(id) })).filter((c) => c.node)
  const groups = FIELD_GROUPS.map(([title, fields]) => ({
    title,
    rows: fields.map(([label, fn]) => {
      const values = cols.map((c) => fn(c.node, c.summary))
      const norm = values.map((v) => String(v).toLowerCase().trim())
      return { label, values, differs: new Set(norm).size > 1 }
    }),
  }))
  return { cols, groups, note: cols.some((c) => !c.summary) ? 'Condition rows come from the paper summaries we extracted (unreviewed); investigations without one show a dash.' : 'Condition rows come from paper summaries we extracted (unreviewed).' }
}

// ---------------------------------------------------------------- export
export const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
export const toCSV = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')

export function toBibtex(papers) {
  return papers
    .map((p) => {
      const b = p.bib || {}
      const { type = 'misc', key = p.id.toLowerCase(), ...f } = b
      const fields = Object.entries({ ...f, title: f.title || p.title, note: [f.note, p.license && 'license: ' + p.license].filter(Boolean).join('; ') }).filter(([, v]) => v)
      return `@${type}{${key},\n` + fields.map(([k, v]) => `  ${k} = {${String(v).replace(/[{}]/g, '')}}`).join(',\n') + '\n}'
    })
    .join('\n\n')
}

export function download(name, text, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
