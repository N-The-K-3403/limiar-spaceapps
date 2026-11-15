// The form keeps raw values (so a field can be empty while typing); the plan only runs on a validated copy.
export function normalizeSpec(s) {
  const n = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
  const out = { ...s, thickness_mm: n(s.thickness_mm), o2_pct: n(s.o2_pct), pressure_kPa: n(s.pressure_kPa), gravity_g: n(s.gravity_g), flow_cms: n(s.flow_cms) }
  const req = [out.thickness_mm, out.o2_pct, out.pressure_kPa, out.gravity_g]
  const problems = []
  if (!req.every(Number.isFinite)) problems.push('Fill in thickness, O\u2082, pressure and gravity.')
  else {
    if (out.o2_pct < 0 || out.o2_pct > 100) problems.push('O\u2082 must be between 0 and 100 %.')
    if (out.pressure_kPa <= 0) problems.push('Pressure must be above 0 kPa (absolute, not gauge).')
    if (out.gravity_g < 0) problems.push('Gravity cannot be negative.')
    if (out.thickness_mm <= 0) problems.push('Thickness must be above 0 mm.')
  }
  if (out.flow_cms !== null && (!Number.isFinite(out.flow_cms) || out.flow_cms < 0)) problems.push('Airflow must be empty or 0 or more.')
  return { spec: out, valid: problems.length === 0, problems }
}
