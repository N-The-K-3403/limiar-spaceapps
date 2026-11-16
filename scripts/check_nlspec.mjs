// node web/scripts/check_nlspec.mjs  -> sentences in, expected fields out; unknown/out-of-range values must be dropped, never guessed.
import { parseRules, sanitizeParsed } from '../src/lib/nlspec.js'

let bad = 0
const near = (a, b, tol = 0.051) => typeof a === 'number' && Math.abs(a - b) <= tol
const check = (name, ok, extra = '') => {
  if (!ok) bad++
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''))
}

let r = parseRules('thin acrylic film in a lunar habitat at 10.2 psi and 30% oxygen, will the flame spread?')
check('moon example', r.fields.material_class === 'pmma_thin_film' && near(r.fields.pressure_kPa, 70.3) && r.fields.o2_pct === 30 && r.fields.gravity_g === 0.165 && r.fields.question === 'spread' && r.preset === 'SC_MOON_CHALLENGE', JSON.stringify(r.fields))

r = parseRules('PMMA sphere, 21% oxygen, 1 atm, microgravity, 10 cm/s airflow. Extinction limit?')
check('sofie-like', r.fields.material_class === 'pmma_thick' && r.fields.o2_pct === 21 && near(r.fields.pressure_kPa, 101.3) && r.fields.gravity_g === 0 && r.fields.flow_cms === 10 && r.fields.question === 'extinction' && r.fields.thickness_mm === undefined, JSON.stringify(r.fields))

r = parseRules('Filter paper in the ISS cabin. Does it keep burning?')
check('iss preset, nothing invented', r.fields.material_class === 'paper_thin' && r.preset === 'SC_ISS_CABIN' && r.fields.o2_pct === undefined && r.fields.pressure_kPa === undefined && r.fields.question === undefined, JSON.stringify(r.fields))

r = parseRules('1/6 g and 560 mmHg, 125 um film')
check('fraction g, mmHg, micron', near(r.fields.gravity_g, 0.167, 0.001) && near(r.fields.pressure_kPa, 74.7) && near(r.fields.thickness_mm, 0.125, 0.0001), JSON.stringify(r.fields))

r = parseRules('burning in air on Mars')
check('air and Mars', r.fields.o2_pct === 21 && r.fields.gravity_g === 0.378, JSON.stringify(r.fields))

r = parseRules('oxygen at 150%')
check('o2 over 100 is dropped', r.fields.o2_pct === undefined && r.dropped.length === 1, JSON.stringify(r.dropped))

r = parseRules('airflow 5 cm/s, nothing else')
check('airflow is not "air"', r.fields.flow_cms === 5 && r.fields.o2_pct === undefined, JSON.stringify(r.fields))

r = parseRules('hello there')
check('no match returns nothing', Object.keys(r.fields).length === 0 && r.preset === null)

const s = sanitizeParsed({ material_class: 'kapton', o2_pct: '30', gravity_g: 'abc', pressure_kPa: -4, extra: 1, preset: 'NOPE', assumptions: ['ok', 3] })
check('sanitizer: unknown material, bad number, negative pressure, unknown key, unknown preset', s.fields.material_class === undefined && s.fields.o2_pct === 30 && s.fields.gravity_g === undefined && s.fields.pressure_kPa === undefined && s.fields.extra === undefined && s.preset === null && s.assumptions.length === 1 && s.dropped.length === 3, JSON.stringify(s))

console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed')
process.exit(bad ? 1 : 0)
