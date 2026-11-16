// Turns a parsed description (fields + optional named preset) into a patch for one specific form.
// Pure functions, no React. Numbers only ever come from (a) the person's text or (b) our own preset / material tables. Hard rule 1.
import { MAT, Q } from './plan.js'
import { round } from './psi.js'

const num = (dp, unit) => (v) => (v === null || v === undefined || v === '' ? 'not set' : `${round(Number(v), dp)}${unit ? ' ' + unit : ''}`)

// Display meta per form: key -> { label, show(value) }. Order = order of the chips.
export const PLANNER_FIELDS = [
  { key: 'material_class', label: 'Material', show: (v) => MAT[v]?.label ?? String(v) },
  { key: 'thickness_mm', label: 'Thickness', show: num(4, 'mm') },
  { key: 'o2_pct', label: 'Oxygen', show: num(2, '%') },
  { key: 'pressure_kPa', label: 'Pressure', show: num(1, 'kPa') },
  { key: 'gravity_g', label: 'Gravity', show: num(3, 'g') },
  { key: 'flow_cms', label: 'Airflow', show: num(2, 'cm/s') },
  { key: 'question', label: 'Question', show: (v) => Q[v]?.label ?? String(v) },
]
export const ESTIMATOR_FIELDS = [
  { key: 'material', label: 'Material', show: String },
  { key: 'thickness_mm', label: 'Thickness', show: num(4, 'mm') },
  { key: 'o2_pct', label: 'Oxygen', show: num(2, '%') },
  { key: 'pressure_kPa', label: 'Pressure', show: num(1, 'kPa') },
  { key: 'gravity_g', label: 'Gravity', show: num(3, 'g') },
]

const NUMERIC = ['thickness_mm', 'o2_pct', 'pressure_kPa', 'gravity_g']

function presetNote(p) {
  return `Scenario "${String(p.label).split(/[:(]/)[0].trim()}" supplied oxygen, pressure and gravity from the planner's preset table.`
}

// Planner: patch over { material_class, thickness_mm, o2_pct, pressure_kPa, gravity_g, flow_cms, question }.
export function plannerPatch(parsed, current, presets = []) {
  const patch = {}
  const notes = []
  const p = parsed.preset ? presets.find((x) => x.id === parsed.preset) : null
  if (p) {
    patch.o2_pct = p.spec.o2_pct
    patch.pressure_kPa = p.spec.pressure_kPa
    patch.gravity_g = p.spec.gravity_g
    if (p.id === 'PRESET_SOFIE') {
      patch.material_class = p.spec.material_class
      patch.thickness_mm = p.spec.thickness_mm
      patch.flow_cms = p.spec.flow_cms
    }
    notes.push(presetNote(p))
  }
  Object.assign(patch, parsed.fields)
  if (patch.material_class && patch.material_class !== current.material_class && patch.thickness_mm === undefined) {
    patch.thickness_mm = MAT[patch.material_class].thickness
    notes.push(`Thickness set to the ${MAT[patch.material_class].label} default (${MAT[patch.material_class].thickness} mm) because the text gave none.`)
  }
  return { patch, notes }
}

// Estimator: patch over { material, thickness_mm, o2_pct, pressure_kPa, gravity_g }. `materials` = model.categorical_features.material.
export function estimatorPatch(parsed, current, presets = [], materials = []) {
  const patch = {}
  const notes = []
  const p = parsed.preset ? presets.find((x) => x.id === parsed.preset) : null
  if (p) {
    patch.o2_pct = p.spec.o2_pct
    patch.pressure_kPa = p.spec.pressure_kPa
    patch.gravity_g = p.spec.gravity_g
    notes.push(presetNote(p))
  }
  for (const k of NUMERIC) if (parsed.fields[k] !== undefined) patch[k] = parsed.fields[k]
  const mk = parsed.fields.material_class
  if (mk) {
    const m = MAT[mk]
    if (m.model && materials.includes(m.model)) patch.material = m.model
    else if (m.thin && materials.includes('Filter paper')) {
      patch.material = 'Filter paper'
      notes.push(`${m.label} is not in the model; Filter paper is the closest thin solid it was trained on. It is not the same material.`)
    } else if (m.family === 'pmma' && materials.includes('ACRYPLEN')) {
      patch.material = 'ACRYPLEN'
      notes.push(`${m.label} is not in the model; ACRYPLEN (thin PMMA film) is the closest it was trained on. Read the result as extrapolation.`)
    } else notes.push(`${m.label} has no model here, so the material was left unchanged.`)
  }
  if (parsed.fields.flow_cms !== undefined) notes.push('Airflow is not an Estimator input and was ignored.')
  if (parsed.fields.question !== undefined) notes.push('The Estimator only answers spread vs extinguish; the question was ignored.')
  return { patch, notes }
}
