// MARGIN-Limit: quadratic trend of the O2 extinction limit vs log10(flow), fitted in the browser to the SoFIE-GEL points.
// Input: points [{flow_cm_s, o2_pct}] (T'ien et al. 2025 Fig. 8 digitized + 5 Table 2 values). Output: predict(flow) with a 90% band.
// Limits (research/RESULTS.md sec. 1, 7): no GP layer, band = residual spread only; unreliable below ~0.4 cm/s; PMMA 4 cm spheres, 1 atm, microgravity.

function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]])
  for (let i = 0; i < 3; i++) {
    let p = i
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r
    ;[M[i], M[p]] = [M[p], M[i]]
    for (let r = 0; r < 3; r++) {
      if (r === i) continue
      const f = M[r][i] / M[i][i]
      for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c]
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]]
}
function inv3(A) {
  const cols = [0, 1, 2].map((j) => solve3(A, [0, 1, 2].map((i) => (i === j ? 1 : 0))))
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => cols[j][i]))
}

export const LIMIT_DOMAIN = { pressure_kPa: [101.3, 101.3], gravity_g: [0, 0] }

export function fitLimit(points) {
  const pts = points.filter((p) => p.flow_cm_s > 0 && Number.isFinite(p.o2_pct))
  const n = pts.length
  if (n < 6) return null
  const row = (f) => {
    const x = Math.log10(f)
    return [1, x, x * x]
  }
  const X = pts.map((p) => row(p.flow_cm_s))
  const y = pts.map((p) => p.o2_pct)
  const XtX = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, r) => s + r[i] * r[j], 0)))
  const Xty = [0, 1, 2].map((i) => X.reduce((s, r, k) => s + r[i] * y[k], 0))
  const coef = solve3(XtX, Xty)
  const inv = inv3(XtX)
  const hat = (r) => r.reduce((s, ri, i) => s + ri * r.reduce((t, rj, j) => t + inv[i][j] * rj, 0), 0)
  const fitv = (r) => coef[0] * r[0] + coef[1] * r[1] + coef[2] * r[2]
  const res = X.map((r, k) => y[k] - fitv(r))
  const sse = res.reduce((s, e) => s + e * e, 0)
  const sd = Math.sqrt(sse / (n - 3))
  const loo = Math.sqrt(res.reduce((s, e, k) => s + (e / (1 - hat(X[k]))) ** 2, 0) / n)
  const flows = pts.map((p) => p.flow_cm_s)
  const T90 = 1.7 // t quantile, ~30 dof
  const predict = (flow) => {
    const r = row(flow)
    const o2 = fitv(r)
    const half = T90 * sd * Math.sqrt(1 + hat(r))
    return { o2, lo: o2 - half, hi: o2 + half, half }
  }
  // curve for charts (log-spaced over the data range)
  const lo = Math.min(...flows)
  const hi = Math.max(...flows)
  const curve = Array.from({ length: 60 }, (_, i) => {
    const f = lo * (hi / lo) ** (i / 59)
    return { flow: f, ...predict(f) }
  })
  // minimum of the fitted curve inside the data range (vertex of the parabola in log10 flow)
  const xv = -coef[1] / (2 * coef[2])
  const inside = coef[2] > 0 && 10 ** xv >= lo && 10 ** xv <= hi
  return { n, coef, sd, loo, flowRange: [lo, hi], predict, curve, min: inside ? { flow: 10 ** xv, o2: predict(10 ** xv).o2 } : null, points: pts }
}

// Applicability of the limit model to a spec: only microgravity, 1 atm, with a flow value.
export function limitDomain(fit, spec) {
  const rows = []
  const flow = spec.flow_cms
  rows.push({ key: 'flow_cms', label: 'Flow', unit: 'cm/s', value: flow, min: fit.flowRange[0], max: fit.flowRange[1], status: flow < fit.flowRange[0] || flow > fit.flowRange[1] ? 'outside' : 'inside' })
  rows.push({ key: 'pressure_kPa', label: 'Pressure', unit: 'kPa', value: spec.pressure_kPa, min: 101.3, max: 101.3, status: Math.abs(spec.pressure_kPa - 101.3) > 1.5 ? 'outside' : 'inside' })
  rows.push({ key: 'gravity_g', label: 'Gravity', unit: 'g', value: spec.gravity_g, min: 0, max: 0, status: spec.gravity_g > 0.005 ? 'outside' : 'inside' })
  return rows
}
