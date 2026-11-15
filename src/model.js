// Scoring and domain checks for the Takahashi spread/extinct logistic model.
// Every coefficient comes from public/models/takahashi_live_model.json (exported by src/export_takahashi_live_model.py).

export const NUMERIC = ['gravity_g', 'o2_pct', 'pressure_kPa', 'thickness_mm']

export const LABELS = {
  gravity_g: { name: 'Gravity', unit: 'g' },
  o2_pct: { name: 'Oxygen', unit: '% O2' },
  pressure_kPa: { name: 'Pressure', unit: 'kPa' },
  thickness_mm: { name: 'Thickness', unit: 'mm' },
}

export function variantsOf(m) {
  const manual = m.manual_six_holdout_model
  return [
    { key: 'full', label: 'Full fit (all 38 cases)', model: m, heldout: null },
    {
      key: 'g16',
      label: 'Blind: leave-1/6 g out',
      model: m.gravity_holdout_models['Leave-1/6g-Out'],
      heldout: (c) => c.gravity_label === '1/6',
    },
    {
      key: 'g38',
      label: 'Blind: leave-3/8 g out',
      model: m.gravity_holdout_models['Leave-3/8g-Out'],
      heldout: (c) => c.gravity_label === '3/8',
    },
    {
      key: 'm32',
      label: 'Seed-selected split (32 train / 6 held out)',
      model: manual,
      heldout: (c) => manual.blind_evaluation.heldout_flights.includes(c.flight_id),
    },
  ]
}

export function score(model, x) {
  let z = model.intercept
  for (const k of NUMERIC) {
    const f = model.numeric_features[k]
    z += (model.coefficients['numeric__' + k] * (x[k] - f.mean)) / f.scale
  }
  const key = 'categorical__material_' + x.material
  if (key in model.coefficients) z += model.coefficients[key]
  return z
}

export function evaluate(model, cases, pick) {
  const rows = pick ? cases.filter(pick) : cases
  const ok = rows.filter((c) => score(model, c) >= 0 === (c.outcome === 'spread')).length
  return { ok, n: rows.length }
}

// 'inside' (boundary included, no warning) | 'outside'
export function rangeStatus(value, feature) {
  return value < feature.min || value > feature.max ? 'outside' : 'inside'
}

export function domainReport(model, x) {
  const rows = NUMERIC.map((k) => {
    const f = model.numeric_features[k]
    return { key: k, value: x[k], status: rangeStatus(x[k], f), min: f.min, max: f.max }
  })
  const materialOk = model.categorical_features.material.includes(x.material)
  rows.push({ key: 'material', value: x.material, status: materialOk ? 'inside' : 'outside' })
  return rows
}

export function nearestCases(model, cases, x, k = 3) {
  return cases
    .map((c) => {
      let d2 = c.material === x.material ? 0 : 4
      for (const key of NUMERIC) {
        const f = model.numeric_features[key]
        d2 += ((c[key] - x[key]) / f.scale) ** 2
      }
      return { ...c, distance: Math.sqrt(d2) }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
}
