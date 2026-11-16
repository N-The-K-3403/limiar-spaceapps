// Check for src/lib/specpatch.js: parsed text + current form -> patch (what changes, what is kept, what is ignored). Input: none. Output: PASS/FAIL lines.
import { parseRules } from '../src/lib/nlspec.js'
import { plannerPatch, estimatorPatch } from '../src/lib/specpatch.js'
import { defaultSpec } from '../src/lib/plan.js'

let bad = 0
const ok = (name, cond, extra = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra))
  if (!cond) bad++
}

// stand-in for presetsOf(kb): same shape, same ids
const presets = [
  { id: 'SC_MOON_CHALLENGE', label: 'Challenge lunar habitat: >= 30% O2', spec: { ...defaultSpec(), o2_pct: 30, pressure_kPa: 70.3, gravity_g: 0.165 } },
  { id: 'SC_ISS_CABIN', label: 'ISS cabin', spec: { ...defaultSpec(), o2_pct: 21, pressure_kPa: 101.3, gravity_g: 0 } },
  { id: 'PRESET_SOFIE', label: 'SoFIE-GEL case', spec: { material_class: 'pmma_thick', thickness_mm: 40, o2_pct: 21, pressure_kPa: 101.3, gravity_g: 0, flow_cms: 10, question: 'extinction' } },
]
const materials = ['ACRYPLEN', 'Filter paper']
const cur = { ...defaultSpec(), o2_pct: 25, pressure_kPa: 90, gravity_g: 1 }

// 1. the acceptance sentence from changes_for_next.md 1.1
let r = plannerPatch(parseRules('thin acrylic film in a lunar habitat at 10.2 psi and 30% oxygen, will the flame spread?'), cur, presets)
ok('planner: stated numbers win over the preset', r.patch.o2_pct === 30 && Math.abs(r.patch.pressure_kPa - 70.3) < 0.1 && r.patch.gravity_g === 0.165 && r.patch.question === 'spread', JSON.stringify(r.patch))
ok('planner: material unchanged, thickness untouched', r.patch.material_class === 'pmma_thin_film' && !('thickness_mm' in r.patch), JSON.stringify(r.patch))

// 2. a material change with no thickness stated takes the material default, and says so
r = plannerPatch(parseRules('cotton fabric at 21% oxygen'), cur, presets)
ok('planner: new material -> default thickness + note', r.patch.material_class === 'fabric' && r.patch.thickness_mm === 0.3 && r.notes.some((n) => /default/.test(n)), JSON.stringify(r))

// 3. a stated thickness is not overridden by the default
r = plannerPatch(parseRules('0.2 mm cotton fabric'), cur, presets)
ok('planner: stated thickness kept', r.patch.thickness_mm === 0.2, JSON.stringify(r.patch))

// 4. nothing stated -> empty patch (nothing invented)
r = plannerPatch(parseRules('hello there'), cur, presets)
ok('planner: no match, empty patch', Object.keys(r.patch).length === 0, JSON.stringify(r.patch))

// 5. SoFIE preset brings material, thickness and flow with it
r = plannerPatch(parseRules('run the SoFIE case'), cur, presets)
ok('planner: SoFIE preset fills the whole case', r.patch.material_class === 'pmma_thick' && r.patch.thickness_mm === 40 && r.patch.flow_cms === 10 && r.patch.gravity_g === 0, JSON.stringify(r.patch))

// 6. estimator: material mapping and ignored fields
const x = { material: 'ACRYPLEN', thickness_mm: 0.125, o2_pct: 21, pressure_kPa: 101.3, gravity_g: 0.165 }
r = estimatorPatch(parseRules('filter paper at 30% oxygen, 70 kPa, Mars gravity'), x, presets, materials)
ok('estimator: paper -> Filter paper, numbers set', r.patch.material === 'Filter paper' && r.patch.o2_pct === 30 && r.patch.pressure_kPa === 70 && r.patch.gravity_g === 0.378, JSON.stringify(r.patch))
r = estimatorPatch(parseRules('cotton fabric, 5 cm/s airflow, will it ignite?'), x, presets, materials)
ok('estimator: fabric -> closest + note, flow and question ignored', r.patch.material === 'Filter paper' && r.notes.length === 3 && !('flow_cms' in r.patch) && !('question' in r.patch), JSON.stringify(r))
r = estimatorPatch(parseRules('heptane droplet at 21% oxygen'), x, presets, materials)
ok('estimator: no model -> material unchanged, says so', !('material' in r.patch) && r.patch.o2_pct === 21 && r.notes.some((n) => /no model/.test(n)), JSON.stringify(r))

console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed')
process.exit(bad ? 1 : 0)
