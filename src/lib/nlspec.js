// Text -> experiment spec, without AI, plus the sanitizer that every parsed result (rules OR Gemini) must pass.
// Shared by the browser (DescribeBox) and the server (api/parse.js). No imports on purpose: it must run in Node and in Vite.
// Hard rule 1: nothing here invents a number. A value comes back only if the text states it or names a fixed reference
// (Moon 0.165 g, Mars 0.378 g, microgravity 0 g, Earth 1 g, air 21 % O2, 1 atm). Everything else stays "not stated".

export const PSI_TO_KPA = 6.894757
export const ATM_KPA = 101.325
export const MMHG_KPA = 0.133322

export const MATERIAL_KEYS = ['pmma_thin_film', 'paper_thin', 'fabric', 'pmma_thick', 'liquid_droplet', 'polymer_smoke']
export const QUESTION_KEYS = ['spread', 'extinction', 'ignition', 'detection', 'suppression']
export const PRESET_IDS = ['SC_MOON_CHALLENGE', 'SC_MOON_EARLY', 'SC_ISS_CABIN', 'SC_EVA_SUIT', 'PRESET_SOFIE']
// same defaults as MATERIALS[].thickness in src/lib/plan.js (kept here so the server can use this file)
export const DEFAULT_THICKNESS = { pmma_thin_film: 0.125, paper_thin: 0.12, fabric: 0.3, pmma_thick: 40, liquid_droplet: 1, polymer_smoke: 1 }

// Qualitative phrases with a documented, fixed reading. Single source of truth: the rules below AND the Gemini prompt use it.
// Hard rule 1 still holds: the value comes from THIS table, never from the model's own judgement, and every use is
// reported as an assumption so the person checks it. Vague words that are not listed here ("high oxygen") stay unset.
export const GLOSSARY = [
  {
    key: 'gravity_g',
    value: 0.165,
    words: 'low gravity, lower gravity, reduced gravity, partial gravity, low-g, hypogravity',
    re: /\b(?:low(?:er)?|reduced|partial|decreased|weak(?:er)?)[- ]?g(?:ravity)?\b|\bhypo-?gravity\b|\bgravity (?:is |was )?(?:lower|reduced|low)\b/,
    note: (m) => `"${m}" has no fixed value; read as 0.165 g (lunar gravity, the project's partial-gravity reference). Check it.`,
  },
  {
    key: 'flow_cms',
    value: 0,
    words: 'no airflow, still air, quiescent, stagnant air, no forced flow, no ventilation',
    re: /\bno (?:forced )?(?:air)?flow\b|\bstill air\b|\bquiescent\b|\bstagnant\b|\bno ventilation\b/,
    note: (m) => `"${m}" read as 0 cm/s airflow.`,
  },
]

export function glossaryPrompt() {
  return GLOSSARY.map((g) => `- ${g.key} = ${g.value} for: ${g.words}`).join('\n')
}

const NUM_KEYS = ['thickness_mm', 'o2_pct', 'pressure_kPa', 'gravity_g', 'flow_cms']
const RANGE = { thickness_mm: [0.001, 1000], o2_pct: [0, 100], pressure_kPa: [0.1, 1000], gravity_g: [0, 3], flow_cms: [0, 1000] }
const NAME = { thickness_mm: 'Thickness', o2_pct: 'Oxygen', pressure_kPa: 'Pressure', gravity_g: 'Gravity', flow_cms: 'Airflow' }
const DP = { thickness_mm: 4, o2_pct: 2, pressure_kPa: 1, gravity_g: 3, flow_cms: 2 }

// Validate anything that claims to be a spec: known keys only, known enums only, numbers in a sane range.
export function sanitizeParsed(obj) {
  const o = obj && typeof obj === 'object' ? obj : {}
  const fields = {}
  const dropped = []
  if (o.material_class !== undefined && o.material_class !== null) {
    if (MATERIAL_KEYS.includes(o.material_class)) fields.material_class = o.material_class
    else dropped.push(`Unknown material "${String(o.material_class).slice(0, 40)}" ignored.`)
  }
  if (o.question !== undefined && o.question !== null) {
    if (QUESTION_KEYS.includes(o.question)) fields.question = o.question
    else dropped.push(`Unknown question "${String(o.question).slice(0, 40)}" ignored.`)
  }
  for (const k of NUM_KEYS) {
    const v = o[k]
    if (v === undefined || v === null || v === '') continue
    const n = Number(v)
    const [lo, hi] = RANGE[k]
    if (!Number.isFinite(n)) dropped.push(`${NAME[k]} "${String(v).slice(0, 20)}" is not a number; ignored.`)
    else if (n < lo || n > hi) dropped.push(`${NAME[k]} ${n} is outside ${lo} to ${hi}; ignored.`)
    else fields[k] = +n.toFixed(DP[k])
  }
  const preset = PRESET_IDS.includes(o.preset) ? o.preset : null
  const assumptions = Array.isArray(o.assumptions) ? o.assumptions.filter((s) => typeof s === 'string' && s.trim()).slice(0, 6).map((s) => s.trim().slice(0, 180)) : []
  return { fields, preset, assumptions, dropped }
}

const NUM = '(\\d+(?:[.,]\\d+)?)'
const toN = (s) => parseFloat(String(s).replace(',', '.'))

export function parseRules(text) {
  const low = String(text || '')
    .replace(/[\u00b5\u03bc]/g, 'u')
    .replace(/\u2082/g, '2')
    .toLowerCase()
  const f = {}
  const notes = []

  // oxygen
  let m = low.match(new RegExp(NUM + '\\s*(?:%|percent)\\s*(?:o2|oxygen)'))
  if (!m) m = low.match(new RegExp('(?:o2|oxygen)\\s*(?:level|concentration|content)?\\s*(?:of|at|=|:|is)\\s*' + NUM + '\\s*(?:%|percent)?(?!\\s*(?:kpa|psi|atm|mmhg|torr|bar|mm|cm))'))
  if (m) f.o2_pct = toN(m[1])
  else if (/pure oxygen|100\s*%\s*(?:o2|oxygen)/.test(low)) f.o2_pct = 100
  else if (/\bair\b(?!\s*-?\s*flow)/.test(low)) {
    f.o2_pct = 21
    notes.push('"air" read as 21 % oxygen.')
  }

  // pressure
  const pm = low.match(new RegExp(NUM + '\\s*(kpa|psia|psi|atm|mmhg|torr|mbar|bar)\\b'))
  if (pm) {
    const v = toN(pm[1])
    const u = pm[2]
    f.pressure_kPa = u === 'kpa' ? v : u === 'psi' || u === 'psia' ? v * PSI_TO_KPA : u === 'atm' ? v * ATM_KPA : u === 'mmhg' || u === 'torr' ? v * MMHG_KPA : u === 'mbar' ? v / 10 : v * 100
  } else if (/sea[- ]level|\bone atmosphere\b/.test(low)) {
    f.pressure_kPa = ATM_KPA
    notes.push('"sea level" read as 1 atm.')
  }

  // gravity: a stated number wins over a named reference
  const gf = low.match(new RegExp('(?<![\\w.])' + NUM + '\\s*\\/\\s*' + NUM + '\\s*g\\b(?!\\w)'))
  const gn = low.match(new RegExp('(?<![\\w./])' + NUM + '\\s*g\\b(?!\\s*\\/)(?!\\w)'))
  if (gf && toN(gf[2]) > 0) f.gravity_g = toN(gf[1]) / toN(gf[2])
  else if (gn) f.gravity_g = toN(gn[1])
  else if (/micro-?gravity|zero[- ]?g(?:ravity)?\b|weightless|free[- ]?fall/.test(low)) f.gravity_g = 0
  else if (/\bmoon\b|lunar/.test(low)) f.gravity_g = 0.165
  else if (/\bmars\b|martian/.test(low)) f.gravity_g = 0.378
  else if (/earth gravity|normal gravity|terrestrial|ground test/.test(low)) f.gravity_g = 1
  else {
    const g = GLOSSARY[0].re.exec(low)
    if (g) {
      f.gravity_g = GLOSSARY[0].value
      notes.push(GLOSSARY[0].note(g[0]))
    }
  }

  // airflow (cm/s, m/s, mm/s) and thickness (mm, um, cm)
  const fm = low.match(new RegExp(NUM + '\\s*(cm|mm|m)\\s*\\/\\s*s\\b'))
  if (fm) f.flow_cms = fm[2] === 'cm' ? toN(fm[1]) : fm[2] === 'm' ? toN(fm[1]) * 100 : toN(fm[1]) / 10
  else {
    const g = GLOSSARY[1].re.exec(low)
    if (g) {
      f.flow_cms = GLOSSARY[1].value
      notes.push(GLOSSARY[1].note(g[0]))
    }
  }
  const tm = low.match(new RegExp(NUM + '\\s*(mm|um|microns?|micrometers?|cm)\\b(?!\\s*\\/)'))
  if (tm) {
    const v = toN(tm[1])
    f.thickness_mm = tm[2] === 'mm' ? v : tm[2] === 'cm' ? v * 10 : v / 1000
    if (tm[2] === 'cm') notes.push('A size in cm was read as the thickness / diameter in mm (x10).')
  }

  // material
  const thin = /\b(thin|film|foil|sheet)\b/.test(low)
  const thick = /\b(sphere|spherical|rod|slab|cylinder|bulk|thick|cast|block)\b/.test(low)
  if (/pmma|acrylic|acryplen|plexiglas|perspex|polymethyl/.test(low)) {
    if (thick && !thin) f.material_class = 'pmma_thick'
    else if (thin) f.material_class = 'pmma_thin_film'
    else if (f.thickness_mm !== undefined) f.material_class = f.thickness_mm >= 3 ? 'pmma_thick' : 'pmma_thin_film'
    else {
      f.material_class = 'pmma_thin_film'
      notes.push('PMMA with no shape or thickness: assumed a thin film.')
    }
  } else if (/paper|cellulose|tissue/.test(low)) f.material_class = 'paper_thin'
  else if (/fabric|cotton|cloth|textile|sibal|fleece|nomex/.test(low)) f.material_class = 'fabric'
  else if (/droplet|liquid|heptane|methanol|ethanol/.test(low)) f.material_class = 'liquid_droplet'
  else if (/smoke|aerosol|pyrolysis/.test(low)) f.material_class = 'polymer_smoke'

  // question (first match wins)
  if (/detect|alarm/.test(low)) f.question = 'detection'
  else if (/suppress|fire extinguisher|put out/.test(low)) f.question = 'suppression'
  else if (/ignit/.test(low)) f.question = 'ignition'
  else if (/spread|propagat/.test(low)) f.question = 'spread'
  else if (/extinct|extinguish|limiting oxygen/.test(low)) f.question = 'extinction'

  // named scenarios -> a preset id. The numbers come from our own preset table, never from this file.
  let preset = null
  if (/spacesuit|space suit|\beva\b/.test(low)) preset = 'SC_EVA_SUIT'
  else if (/early artemis/.test(low)) preset = 'SC_MOON_EARLY'
  else if (/\biss\b|space station|\bcabin\b|\bkibo\b/.test(low)) preset = 'SC_ISS_CABIN'
  else if (/lunar habitat|moon habitat|lunar base|artemis|habitat/.test(low)) preset = 'SC_MOON_CHALLENGE'
  else if (/sofie/.test(low)) preset = 'PRESET_SOFIE'

  const s = sanitizeParsed({ ...f, preset, assumptions: notes })
  return { fields: s.fields, preset: s.preset, assumptions: s.assumptions, dropped: s.dropped }
}
