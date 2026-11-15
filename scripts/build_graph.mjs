// Input: data/*.csv, data/investigations_catalog.json, results/{next_test,qc_design_hull}.json, results/flex_moon_check.txt, web/public/models + data
// Output: web/public/data/graph.json  (single knowledge graph: nodes + edges, provenance on every node and edge)
// Run: node web/scripts/build_graph.mjs
// Provenance values: verified (quote-checked against a paper page) | estimated (read off a figure or fitted by us) | unreviewed (AI-extracted, not human-checked)
import fs from 'node:fs'

const ROOT = new URL('../../', import.meta.url)
const read = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8').replace(/^﻿/, '')
const readJSON = (p) => JSON.parse(read(p))

function parseCSV(text) {
  const rows = []
  let row = [],
    cell = '',
    q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const head = rows[0]
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}
const num = (s) => (s === '' || s === undefined ? null : Number(s))
const range = (lo, hi) => (lo === null || hi === null ? null : [lo, hi])
const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '...' : t
}

const nodes = []
const edges = []
const ids = new Set()
const addNode = (n) => {
  if (ids.has(n.id)) throw new Error('duplicate node id ' + n.id)
  ids.add(n.id)
  nodes.push(n)
}
let ecount = 0
const addEdge = (from, to, rel, prov, extra = {}) => edges.push({ id: 'e' + ++ecount, from, to, rel, prov, ...extra })

// ---------------------------------------------------------------- papers
// [id, stem used in research/docs_text and in data/*.csv doc_txt, title, citation, license, bibtex fields]
const PAPERS = [
  ['PAPER_TAK2026', 'Downward_flame_spread_of_thermally_thin_solid_materials_in_p', 'Downward flame spread of thermally thin solid materials in partial gravity', "Takahashi et al., Proc. Combust. Inst. 42, 106097 (2026)", 'CC BY', { type: 'article', author: 'Takahashi and others', journal: 'Proceedings of the Combustion Institute', volume: '42', pages: '106097', year: '2026' }],
  ['PAPER_TIEN2025', 'Experimental_determination_of_diffusion_flame_extinction_bou', "Experimental determination of diffusion flame extinction boundaries over a solid fuel sphere in microgravity (SoFIE-GEL)", "T'ien et al., Combust. Flame 277, 114244 (2025)", 'CC BY-NC-ND', { type: 'article', author: "T'ien and others", journal: 'Combustion and Flame', volume: '277', pages: '114244', year: '2025' }],
  ['PAPER_LI2024', 'Extinction_of_solid_diffusion_flame_in_microgravity', 'Extinction of solid diffusion flame in microgravity', 'Li et al., Proc. Combust. Inst. 40, 105373 (2024)', 'not stated', { type: 'article', author: 'Li and others', journal: 'Proceedings of the Combustion Institute', volume: '40', pages: '105373', year: '2024' }],
  ['PAPER_MEYER2018', 'Evalspacecraftsmokedetectorperform0gMeyeretal.2018', 'Evaluation of spacecraft smoke detector performance in the low-gravity environment', 'Meyer et al., Fire Safety J. 98 (2018)', 'not stated', { type: 'article', author: 'Meyer and others', journal: 'Fire Safety Journal', volume: '98', year: '2018' }],
  ['PAPER_URBAN2007', 'Particle_and_Smoke_Detection_on_ISS_for_Next_Generation_Smoke_Detectors', 'Particle and Smoke Detection on ISS for Next Generation Smoke Detectors', 'Urban et al., ISDC (2007)', 'not stated', { type: 'inproceedings', author: 'Urban and others', booktitle: 'International Space Development Conference', year: '2007' }],
  ['PAPER_FLEX', 'Detailed_Results_From_the_Flame_Extinguishment', 'Detailed Results From the Flame Extinguishment Experiment (FLEX), March 2009 - December 2011', 'NASA/TP-2015-216046', 'NASA report', { type: 'techreport', title: 'Detailed Results From the FLEX March 2009-Dec 2011', number: 'NASA/TP-2015-216046', institution: 'NASA', year: '2015' }],
  ['PAPER_GOLDMEER1996', 'Extinguishment_of_a_Diffusion_Flame_Over', 'Extinguishment of a diffusion flame over a PMMA cylinder by depressurization in reduced gravity', 'Goldmeer, NASA CR-198550 (1996)', 'NASA report', { type: 'techreport', author: 'Goldmeer', number: 'NASA CR-198550', institution: 'NASA', year: '1996', note: 'title shortened in project file; verify' }],
  ['PAPER_SAFFIRE45', 'Fire_Safety_Implications_of_Preliminary_Results_from_Saffire', 'Fire Safety Implications of Preliminary Results from Saffire IV and V', 'ICES-2021-266', 'not stated', { type: 'inproceedings', booktitle: 'International Conference on Environmental Systems', number: 'ICES-2021-266', year: '2021', note: 'authors to verify' }],
  ['PAPER_SAFFIRE6', 'Preliminary_Results_from_the_Saffire_VI_Experiment', 'Preliminary Results from the Saffire VI Experiment', 'ICES-2024-365', 'not stated', { type: 'inproceedings', booktitle: 'International Conference on Environmental Systems', number: 'ICES-2024-365', year: '2024', note: 'authors to verify' }],
  ['PAPER_THOMSEN', 'Buoyancy_Effects_on_Concurrent_Flame_Spread_Over_Thick_PMMA', 'Buoyancy Effects on Concurrent Flame Spread Over Thick PMMA', 'Thomsen et al.', 'not stated', { type: 'misc', author: 'Thomsen and others', note: 'year and venue to verify' }],
  ['PAPER_SOFIE_OVERVIEW', 'Solid_Fuel_Ignition_and_Extinction_(SoFIE)_Project_on_ISS', 'Solid Fuel Ignition and Extinction (SoFIE) Project on ISS (overview slides)', 'Ferkul et al., slides', 'not stated', { type: 'misc', author: 'Ferkul and others', note: 'slides; year to verify' }],
  ['PAPER_ACME_SLIDES', 'ACME_CSSCI_20220509', 'ACME CSSCI slides (2022-05-09)', 'Stocker, slides (2022-05-09)', 'not stated', { type: 'misc', author: 'Stocker', year: '2022', note: 'slides' }],
  ['PAPER_BASS2_TM', 'BASS-II_TM-20210011385', 'BASS-II Summary Report', 'NASA TM-20210011385 (NTRS 20210011385, Oct 2021)', 'NASA report', { type: 'techreport', title: 'BASS-II Summary Report', number: 'NASA/TM-20210011385', institution: 'NASA', year: '2021' }],
  ['PAPER_LUCI2025', 'LUCI_ASGSR2025_Ferkul', 'Lunar-g Combustion Investigation (LUCI) results', 'Ferkul, ASGSR 2025', 'not stated', { type: 'misc', author: 'Ferkul', year: '2025', note: 'ASGSR 2025 slides' }],
  ['PAPER_FM2_2026', 'FM2_LPSC2026_Ferkul', 'Flammability of Materials on the Moon (FM2) experiment abstract', 'Ferkul, LPSC 2026', 'not stated', { type: 'misc', author: 'Ferkul', year: '2026', note: 'LPSC 2026 abstract' }],
  ['PAPER_FERKUL_LPSC_V2', 'Ferkul-Lunar_and_Planetary_Science_Conf_2026_v2', 'Ferkul, Lunar and Planetary Science Conference 2026 (v2)', 'Ferkul, LPSC 2026 (v2)', 'not stated', { type: 'misc', author: 'Ferkul', year: '2026', note: 'file in docs/, text not extracted' }],
]
const stemToPaper = {}
for (const [id, stem, title, cite, license, bib] of PAPERS) {
  stemToPaper[stem] = id
  addNode({ id, type: 'paper', title, citation: cite, license, bib: { key: id.replace('PAPER_', '').toLowerCase(), ...bib, title: bib.title || title }, prov: 'verified', source: 'docs/ (file in project)' })
}
const paperOf = (stem) => stemToPaper[stem] || null

// ---------------------------------------------------------------- evidence items + limits (quote-checked)
const cov = parseCSV(read('data/coverage_axes.csv'))
for (const r of cov) {
  if (r.quote_check !== 'verified') throw new Error('unverified coverage row ' + r.id)
  addNode({
    id: r.id,
    type: 'evidence',
    title: r.label,
    kind: r.kind,
    material_class: r.material_class,
    regime: r.regime,
    pillars: { prevention: r.prevention === '1', detection: r.detection === '1', suppression: r.suppression === '1' },
    axes: { o2: range(num(r.o2_min), num(r.o2_max)), p_kpa: range(num(r.p_kpa_min), num(r.p_kpa_max)), g: range(num(r.g_min), num(r.g_max)), flow_cms: range(num(r.flow_min_cms), num(r.flow_max_cms)) },
    note: r.note,
    quote: r.quotes,
    pages: r.pdf_pages,
    prov: 'verified',
    source: 'data/coverage_axes.csv (values and quotes checked against paper text)',
  })
  const p = paperOf(r.doc_txt)
  if (p) addEdge(r.id, p, 'reported_in', 'verified', { pages: r.pdf_pages })
}
const lims = parseCSV(read('data/limits_verified.csv'))
for (const r of lims) {
  if (r.quote_check !== 'verified') throw new Error('unverified limit ' + r.id)
  addNode({
    id: r.id,
    type: 'limit',
    title: r.statement,
    material_class: r.material_class,
    regime: r.regime,
    value: r.value,
    unit: r.unit,
    context: r.context,
    kind: r.kind, // measured | predicted (literature prediction)
    quote: r.quote,
    page: Number(r.pdf_page) || null,
    prov: 'verified',
    source: 'data/limits_verified.csv',
  })
  const p = paperOf(r.doc_txt)
  if (p) addEdge(r.id, p, 'reported_in', 'verified', { pages: r.pdf_page })
}

// ---------------------------------------------------------------- PSI investigations (metadata, AI-extracted, unreviewed)
const FUEL_EN = {
  'solido (tecido algodao/fibra de vidro)': ['solid', 'cotton/fiberglass fabric'],
  solido: ['solid', 'solid'],
  'solido (tecido Sibal)': ['solid', 'SIBAL fabric'],
  'fumaca/aerosol': ['smoke', 'smoke / aerosol'],
  'gota de liquido': ['liquid', 'liquid droplet'],
  gas: ['gas', 'gas'],
  'gas (emula material)': ['gas', 'gas (emulates a material)'],
  'gota de liquido (CFD)': ['liquid', 'liquid droplet (CFD)'],
  'gota de liquido (numerico)': ['liquid', 'liquid droplet (numerical)'],
  'solido (CFD)': ['solid', 'solid (CFD)'],
  'gas (soot)': ['gas', 'gas (soot)'],
  'fumaca/aerosol (DNS)': ['smoke', 'smoke / aerosol (DNS)'],
}
const PILLAR_EN = { prevencao: 'prevention', deteccao: 'detection', supressao: 'suppression', complementar: 'complementary' }
const REL_EN = { alta: 'high', media: 'medium' }
const idx = Object.fromEntries(parseCSV(read('data/psi_index.csv')).map((r) => [r.psi_id, r]))
const catalog = readJSON('data/investigations_catalog.json')
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ')
for (const c of catalog) {
  const ix = idx[c.psi_id] || {}
  const pillarRaw = String(ix.pilar || c.pillar_seed || '')
  const pillarKey = pillarRaw.split(' ')[0].replace('supressao', 'supressao')
  const [fuelClass, fuelNote] = FUEL_EN[ix.fuel] || ['unknown', ix.fuel || 'not stated']
  addNode({
    id: c.psi_id,
    type: 'investigation',
    title: c.title,
    acronym: c.acronym || ix.sigla || c.psi_id,
    platform: c.type, // microgravity | ground
    pillar: PILLAR_EN[pillarKey] || 'complementary',
    pillar_note: /alto O2/.test(pillarRaw) ? 'high O2' : /parcial/.test(pillarRaw) ? 'simulated partial gravity (electric field)' : '',
    relevance_seed: REL_EN[ix.relevancia] || 'unknown',
    fuel_class: fuelClass,
    fuel_note: fuelNote,
    hardware: clip(c.hardware, 120),
    flight: clip(c.flight, 80),
    start: c.start || null,
    end: c.end || null,
    doi: c.doi || null,
    license: c.license || ix.license || null,
    related: String(c.related_glds || '').split(',').map((s) => s.trim()).filter(Boolean),
    hypothesis: clip(stripTags(c.hypothesis), 520),
    objective: clip(stripTags(c.objective), 800),
    approach: clip(stripTags(c.approach), 800),
    research_impacts: clip(stripTags(c.research_impacts), 520),
    publications: (c.publications || []).slice(0, 8).map((p) => ({ title: clip(p.title, 160), doi: p.doi || null })),
    n_publications: (c.publications || []).length,
    n_files: c.n_files,
    file_ext_counts: c.file_ext_counts,
    has_experimental_table: Array.isArray(c.experimental_table) && c.experimental_table.length > 0,
    kw: { partial_g: num(ix.kw_partial_g), o2: num(ix.kw_o2), pressure: num(ix.kw_pressure), smoke: num(ix.kw_smoke), suppress: num(ix.kw_suppress) },
    prov: 'unreviewed',
    source: 'data/investigations_catalog.json (PSI landing-page metadata) + data/psi_index.csv; fields AI-extracted, not human-reviewed',
  })
}
for (const c of catalog) for (const r of String(c.related_glds || '').split(',').map((s) => s.trim()).filter(Boolean)) if (ids.has(r)) addEdge(c.psi_id, r, 'related_to', 'unreviewed')

// ---------------------------------------------------------------- catalog rows (AI-extracted per-paper summaries)
const cat1 = parseCSV(read('data/psi_catalog_v1.csv'))
const CAT_PAPERS = {
  SAF45: ['Fire_Safety_Implications_of_Preliminary_Results_from_Saffire'],
  SAF6: ['Preliminary_Results_from_the_Saffire_VI_Experiment'],
  SAME: ['Evalspacecraftsmokedetectorperform0gMeyeretal.2018'],
  SAME_DAFT_CSD: ['Particle_and_Smoke_Detection_on_ISS_for_Next_Generation_Smoke_Detectors'],
  FLEX: ['Detailed_Results_From_the_Flame_Extinguishment'],
  ACME: ['ACME_CSSCI_20220509'],
  THOM: ['Buoyancy_Effects_on_Concurrent_Flame_Spread_Over_Thick_PMMA'],
  BASS2: ['BASS-II_TM-20210011385'],
  SOFIE_GEL: ['Experimental_determination_of_diffusion_flame_extinction_bou', 'Solid_Fuel_Ignition_and_Extinction_(SoFIE)_Project_on_ISS'],
  LI24: ['Extinction_of_solid_diffusion_flame_in_microgravity'],
  SOFIE_PROJ: ['Solid_Fuel_Ignition_and_Extinction_(SoFIE)_Project_on_ISS'],
  TAK26: ['Downward_flame_spread_of_thermally_thin_solid_materials_in_p'],
  GOLD96: ['Extinguishment_of_a_Diffusion_Flame_Over'],
}
// investigation <-> catalog row, mapped by hand from the document text (relation says what the paper uses)
const CAT_INV = { SAME: ['PSI-102'], FLEX: ['PSI-69'], ACME: ['PSI-20'], BASS2: ['PSI-25'], THOM: ['PSI-99'] }
for (const r of cat1) {
  addNode({
    id: 'CAT_' + r.id,
    type: 'summary',
    title: r.investigation,
    facility: r.facility,
    pillar_stated: clip(r.safety_pillar_stated, 260),
    fuel: clip(r.fuel, 300),
    geometry: clip(r.geometry_size, 240),
    flow: clip(r.flow, 240),
    o2: clip(r.o2_pct, 240),
    pressure: clip(r.pressure, 240),
    diluent: clip(r.diluent, 120),
    gravity: clip(r.gravity, 200),
    varied: clip(r.varied, 240),
    held_fixed: clip(r.held_fixed, 200),
    outcome_measured: clip(r.outcome_measured, 300),
    sensors: clip(r.sensors, 240),
    data_availability: clip(r.data_availability, 240),
    n_tests: clip(r.n_tests, 160),
    habitat_link_stated: clip(r.link_moon_mars_habitat_stated, 320),
    pages: r.pdf_pages,
    prov: 'unreviewed',
    source: 'data/psi_catalog_v1.csv: ' + r.source,
  })
  for (const stem of CAT_PAPERS[r.id] || []) if (paperOf(stem)) addEdge('CAT_' + r.id, paperOf(stem), 'summarizes', 'unreviewed', { pages: r.pdf_pages })
  for (const inv of CAT_INV[r.id] || []) if (ids.has(inv)) addEdge('CAT_' + r.id, inv, 'uses_data_from', 'unreviewed')
}
// evidence item -> summary row (same study)
const EV_CAT = (id) => (/^SAF_VI/.test(id) ? 'SAF6' : /^SAF_/.test(id) ? 'SAF45' : /^TAK_/.test(id) ? 'TAK26' : id === 'GEL_RANGE' ? 'SOFIE_GEL' : id === 'FLEX_RANGE' ? 'FLEX' : /^THOM_/.test(id) ? 'THOM' : id === 'SAME_FLOW' ? 'SAME' : null)
for (const r of cov) {
  const c = EV_CAT(r.id)
  if (c && ids.has('CAT_' + c)) addEdge(r.id, 'CAT_' + c, 'part_of', 'verified')
}
// evidence items that are measured on a PSI-hosted investigation (by hand, from the document text)
for (const [ev, inv] of [['THOM_SAF2', 'PSI-99'], ['FLEX_RANGE', 'PSI-69'], ['SAME_FLOW', 'PSI-102']]) if (ids.has(ev) && ids.has(inv)) addEdge(ev, inv, 'measured_in', 'unreviewed')
for (const [lim, inv] of [['L_ACME_BRE', 'PSI-20']]) if (ids.has(lim) && ids.has(inv)) addEdge(lim, inv, 'measured_in', 'unreviewed')

// ---------------------------------------------------------------- datasets, models, recommendation
const manifest = readJSON('web/public/data/manifest.json')
const model = readJSON('web/public/models/takahashi_live_model.json')
const sofie = readJSON('web/public/data/sofie_points.json')
addNode({ id: 'DATA_SOFIE_GEL', type: 'dataset', title: 'SoFIE-GEL oxygen extinction limit vs flow (PMMA 4 cm spheres, 1 atm, ISS)', n: manifest.sofie_points.total, n_verified: manifest.sofie_points.verified, n_estimated: manifest.sofie_points.estimated, prov: 'estimated', source: "5 points from T'ien et al. 2025 Table 2 (verified); the rest digitized from Fig. 8 (estimated). File: data/sofie_points.json. Numbers only; the figure itself is not redistributed (CC BY-NC-ND)." })
addNode({ id: 'DATA_TAK_CASES', type: 'dataset', title: 'Takahashi partial-gravity cases (thin PMMA film and filter paper, 1/12-3/8 g)', n: manifest.takahashi_cases.total, n_spread: manifest.takahashi_cases.spread, n_extinct: manifest.takahashi_cases.extinct, n_flights: manifest.takahashi_cases.flights, prov: 'estimated', source: 'Conditions from Takahashi 2026 Table S1; spread/extinct labels estimated from Fig. 7 (AI-assisted, 4 uncertain). File: data/takahashi_cases.json.' })
addEdge('DATA_SOFIE_GEL', 'PAPER_TIEN2025', 'derived_from', 'estimated')
addEdge('DATA_TAK_CASES', 'PAPER_TAK2026', 'derived_from', 'estimated')
addNode({
  id: 'MODEL_SPREAD',
  type: 'model',
  title: 'MARGIN-Spread (logistic fit on Takahashi cases)',
  maturity: 'estimated-retrospective',
  output: 'class (spread/extinct) + uncalibrated log-odds score',
  trained_on: { n: model.training_rows, flights: model.training_flights },
  domain: Object.fromEntries(Object.entries(model.numeric_features).map(([k, v]) => [k, [v.min, v.max]])),
  materials: model.categorical_features.material,
  limits: model.limits,
  prov: 'estimated',
  source: 'public/models/takahashi_live_model.json (exported by src/export_takahashi_live_model.py)',
})
addEdge('MODEL_SPREAD', 'DATA_TAK_CASES', 'trained_on', 'estimated')
const sofieUse = sofie.filter((p) => p.position_confidence !== 'low')
const fl = sofieUse.map((p) => p.flow_cm_s)
addNode({
  id: 'MODEL_LIMIT',
  type: 'model',
  title: 'MARGIN-Limit (quadratic trend of the O2 extinction limit vs log flow)',
  maturity: 'estimated-retrospective',
  output: 'O2 limit (% O2) with a residual band',
  trained_on: { n: sofieUse.length },
  domain: { flow_cm_s: [Math.min(...fl), Math.max(...fl)], pressure_kPa: [101.3, 101.3], gravity_g: [0, 0] },
  materials: ['PMMA sphere 4 cm'],
  limits: ['PMMA spheres only, 1 atm, microgravity (ISS). The link to the Moon or Mars is by analogy, not by data.', 'Quadratic trend fitted in the browser to figure-digitized points; no GP layer, so the band is the residual spread only.', 'Extrapolation below about 0.4 cm/s is not reliable (project analysis, research/RESULTS.md).'],
  prov: 'estimated',
  source: 'fitted in the browser from public/data/sofie_points.json (see src/graph/limitmodel.js)',
})
addEdge('MODEL_LIMIT', 'DATA_SOFIE_GEL', 'trained_on', 'estimated')

const nt = readJSON('results/next_test.json')
const hull = readJSON('results/qc_design_hull.json')
addNode({
  id: 'REC_PREHEAT',
  type: 'recommendation',
  title: 'Repeat the low vs high preheat (q_c) contrast at about 1.1-1.6 cm/s',
  basis: 'quantitative (project analysis of SoFIE-GEL digitized points; association, not proof of cause)',
  picks: hull.picks.map((p) => ({ flow_cm_s: Math.round(p.flow_cm_s * 100) / 100, q_c_w_cm2: Math.round(p.q_c_w_cm2 * 100) / 100, predicted_o2_limit: Math.round(p.predicted_o2_limit * 10) / 10, prediction_sd: Math.round(p.prediction_sd * 100) / 100 })),
  pin_minimum_flows_cm_s: nt.objective_B_minimum_limit.map((p) => Math.round(p.flow_cm_s * 10) / 10),
  minimum_o2_limit: { mean: Math.round(nt.minimum_o2_limit.mean * 100) / 100, ci90: nt.minimum_o2_limit.ci90.map((v) => Math.round(v * 100) / 100) },
  note: hull.note,
  prov: 'estimated',
  source: 'results/qc_design_hull.json, results/next_test.json (src/qc_design2.py, src/gp_v2.py)',
})
addEdge('REC_PREHEAT', 'DATA_SOFIE_GEL', 'derived_from', 'estimated')

// ---------------------------------------------------------------- gap facts (script-verified)
const flexTxt = read('results/flex_moon_check.txt')
const grab = (re) => {
  const m = flexTxt.match(re)
  return m ? Number(m[1]) : null
}
const flexGap = { tests: grab(/rows (\d+)/), o2_ge_30: grab(/O2>=0\.30: +(\d+)/), o2_ge_30_p_le_10_2: grab(/O2>=0\.30 and p<=10\.2 psi: (\d+)/), o2_ge_30_p_10_2_to_10_6: grab(/O2>=0\.30 and p in \(10\.2, 10\.6\] psi: (\d+)/) }
if (Object.values(flexGap).some((v) => v === null)) throw new Error('could not parse flex_moon_check.txt: ' + JSON.stringify(flexGap))
addNode({
  id: 'GAP_FLEX_LUNAR',
  type: 'gap',
  title: `FLEX: ${flexGap.o2_ge_30} of ${flexGap.tests} tests have O2 >= 30%, but none at or below 10.2 psi`,
  statement: `${flexGap.o2_ge_30_p_10_2_to_10_6} tests with O2 >= 30% sit at 10.2-10.6 psi (above the challenge bound of 10.2 psi); ${flexGap.o2_ge_30_p_le_10_2} tests have O2 >= 30% and p <= 10.2 psi. FLEX burned liquid droplets in microgravity, not solids in partial gravity.`,
  numbers: flexGap,
  prov: 'verified',
  source: 'results/flex_moon_check.txt (src/flex_moon_check.py on PSI-69 FLEX table)',
})
addEdge('GAP_FLEX_LUNAR', 'PSI-69', 'derived_from', 'verified')
addNode({
  id: 'GAP_PSI_PARTIAL_G',
  type: 'gap',
  title: 'No partial-gravity combustion data in PSI',
  statement: 'The challenge text states there is currently no partial-gravity combustion data available in PSI; LUCI and FM2 are expected to add some.',
  quote: 'there is currently no partial-gravity combustion data available in PSI',
  prov: 'verified',
  source: 'research/challenge_text.txt (Flame in Freefall challenge text, Partial-gravity data)',
})

// ---------------------------------------------------------------- platforms (for experiment proposals; every claim is a quote from a project document)
const PLAT = [
  { id: 'PLAT_PARABOLIC', title: 'Parabolic-flight aircraft (partial gravity, seconds)', provides: 'partial gravity (1/12 to 3/8 g tested)', constraint: 'partial-gravity period about 18-28 s per parabola; samples 2 cm x 9 cm in a 27 x 60 x 14 cm chamber', quote: 'Experiments were performed at gravity levels of 1/6 g (lunar), 3/8 g (Martian; 1/3 g in some cases), as well as 1/12 g and 0 g for comparison.', paper: 'PAPER_TAK2026' },
  { id: 'PLAT_LUCI', title: 'Spinning free-flyer (LUCI class, partial gravity, minutes)', provides: 'lunar-g by rotation', constraint: 'rotation 11 RPM at an effective radius of 1.22 m; Coriolis force affects results; burned SIBAL fabric and PMMA rods; launched Feb 4 2025', quote: 'A steady vehicle rotation of 11 RPM is established, with an effective radius of rotation of 1.22 m at the experiment location.', paper: 'PAPER_LUCI2025' },
  { id: 'PLAT_FM2', title: 'FM2 (planned): four solid samples in quiescent partial gravity', provides: 'quiescent lunar/partial gravity (planned)', constraint: 'planned launch late 2026; oxygen sensor included', quote: 'performed, with a planned launch date of late 2026.', paper: 'PAPER_FM2_2026' },
  { id: 'PLAT_SAFFIRE', title: 'Saffire-class free flyer (microgravity, long burns, large samples)', provides: 'microgravity, ~20 cm/s flow, O2 up to 31% at 54 kPa', constraint: 'samples 40 cm wide; flow duct 30 x 45 x 109 cm; tests after leaving ISS', quote: 'flow duct 30 cm high x 45 cm wide x 109 cm long', paper: 'PAPER_SAFFIRE45' },
  { id: 'PLAT_ISS_CIR', title: 'ISS Combustion Integrated Rack / Glovebox (microgravity, hours)', provides: 'microgravity with flow control; SoFIE spheres, BASS ducts', constraint: 'one atmosphere for the published SoFIE-GEL map; pressure varied 0.15-1.1 atm in the study', quote: 'forced flows (0.2 to 80 cm/s), oxygen concentrations (13 % to 34 %) and pressure (0.15-1.1 atm)', paper: 'PAPER_TIEN2025' },
]
for (const p of PLAT) {
  addNode({ id: p.id, type: 'platform', title: p.title, provides: p.provides, constraint: p.constraint, quote: p.quote, prov: 'verified', source: 'quote from ' + p.paper + ' (see results/luci_fm2_quotes.txt, data/psi_catalog_v1.csv)' })
  addEdge(p.id, p.paper, 'reported_in', 'verified')
}

// ---------------------------------------------------------------- scenario presets (each with a verified source quote)
const SC = [
  { id: 'SC_ISS_CABIN', title: 'ISS cabin (air, 1 atm, microgravity)', o2: 21, p_kpa: 101.3, g: 0, quote: 'The ambient gas composition on the ISS is nominally that of air (0.21 oxygen mole fraction, 0.005 carbon dioxide mole fraction, balance nitrogen) at 1.0-atm pressure.', paper: 'PAPER_FLEX' },
  { id: 'SC_MOON_EARLY', title: 'Early Artemis lunar habitat (34% O2, 8.2 psia = 56.5 kPa, 0.165 g)', o2: 34, p_kpa: 56.5, g: 0.165, quote: 'few materials rated even in 1g at 34% O2, 8.2 psia (exploration atmosphere)', paper: 'PAPER_SOFIE_OVERVIEW' },
  { id: 'SC_MOON_CHALLENGE', title: 'Challenge lunar habitat bound (>= 30% O2, <= 10.2 psi = 70.3 kPa, 0.165 g)', o2: 30, p_kpa: Math.round(10.2 * 6.894757 * 10) / 10, g: 0.165, quote: 'The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less.', paper: null },
  { id: 'SC_EVA_SUIT', title: 'Spacesuit (100% O2, 4.3 psi = 29.6 kPa; 0.165 g assumed for a lunar EVA)', o2: 100, p_kpa: Math.round(4.3 * 6.894757 * 10) / 10, g: 0.165, quote: 'spacesuits are filled with 100% oxygen to only 4.3 psi', paper: null },
]
for (const s of SC) {
  addNode({ id: s.id, type: 'scenario', title: s.title, o2: s.o2, p_kpa: s.p_kpa, g: s.g, quote: s.quote, prov: 'verified', source: s.paper ? 'quote from ' + s.paper : 'quote from the challenge text (research/challenge_text.txt)' })
  if (s.paper) addEdge(s.id, s.paper, 'reported_in', 'verified')
}

const out = {
  meta: {
    generated_by: 'web/scripts/build_graph.mjs',
    counts: Object.fromEntries([...new Set(nodes.map((n) => n.type))].map((t) => [t, nodes.filter((n) => n.type === t).length])),
    n_nodes: nodes.length,
    n_edges: edges.length,
    prov_legend: { verified: 'value or quote checked against the paper text', estimated: 'read off a figure or fitted by this project', unreviewed: 'AI-extracted, not checked by a human' },
    licenses: { 'Takahashi 2026': 'CC BY', "T'ien 2025": 'CC BY-NC-ND (numbers cited; figure not redistributed)', 'PSI metadata': 'CC0 where stated per investigation' },
  },
  nodes,
  edges,
}
fs.writeFileSync(new URL('web/public/data/graph.json', ROOT), JSON.stringify(out) + '\n', 'utf8')
console.log(JSON.stringify(out.meta, null, 1))
const byProv = {}
for (const n of nodes) byProv[n.prov] = (byProv[n.prov] || 0) + 1
console.log('nodes by provenance', byProv)
console.log('size KB', Math.round(JSON.stringify(out).length / 1024))
