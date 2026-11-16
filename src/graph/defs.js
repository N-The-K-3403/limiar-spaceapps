// Node registry + pure compute functions for the canvas graph. No React in here, so Node can test it.
// Rule: every number shown on the canvas comes from the JSON files (model, cases, manifest) or from user input.

import { LABELS, NUMERIC, domainReport, evaluate as evalCases, nearestCases, score, variantsOf } from '../model.js'

export const PSI_TO_KPA = 6.894757
export const MOON_G = 1.62 / 9.80665 // lunar surface gravity 1.62 m/s^2
export const MARS_G = 3.71 / 9.80665 // Mars surface gravity 3.71 m/s^2
export const G_MIN = 0.05
export const G_MAX = 0.6

export const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d

export const ATMOSPHERES = [
  { label: 'ISS-like cabin (21% O2, 101.3 kPa)', o2_pct: 21, pressure_kPa: 101.3 },
  { label: 'Lunar-base candidate (30% O2, 10.2 psi)', o2_pct: 30, pressure_kPa: round(10.2 * PSI_TO_KPA, 1) },
  { label: 'Spacesuit (100% O2, 4.3 psi)', o2_pct: 100, pressure_kPa: round(4.3 * PSI_TO_KPA, 1) },
]
export const GRAVITIES = [
  { label: 'Moon (0.165 g)', g: round(MOON_G, 4) },
  { label: 'Mars (0.378 g)', g: round(MARS_G, 4) },
  { label: '1/6 g', g: round(1 / 6, 4) },
  { label: '3/8 g', g: round(3 / 8, 4) },
]

// ---- provenance -----------------------------------------------------------------------------
// A wire inherits the weakest provenance among its inputs. 'input' = typed by the user (never the weak link).
export const PROV_RANK = { input: 4, verified: 3, estimated: 2, unreviewed: 1 }
export const PROV_LABEL = {
  input: 'user input',
  verified: 'verified',
  estimated: 'estimated from figure',
  unreviewed: 'unreviewed',
}
export const weakest = (list) => list.reduce((a, b) => (PROV_RANK[b] < PROV_RANK[a] ? b : a))
const provOfRecord = (p) => (p.startsWith('verified') ? 'verified' : p.startsWith('estimated') ? 'estimated' : 'unreviewed')

export const FAMILIES = { scenario: 'Scenario', model: 'Model', check: 'Check', output: 'Output' }

// ---- shared context (built once from the loaded JSON) ----------------------------------------
const SHORT = { g16: 'leave-1/6 g out', g38: 'leave-3/8 g out', m32: 'post-hoc 32/6 split (fixed seed)' }

export function makeCtx({ model, cases, manifest }) {
  const variants = variantsOf(model)
  const retained = variants
    .filter((v) => v.heldout)
    .map((v) => ({ key: v.key, short: SHORT[v.key], ...evalCases(v.model, cases, v.heldout) }))
  return { model, cases, manifest, variants, retained, inSample: evalCases(model, cases) }
}

// ---- node definitions ------------------------------------------------------------------------
const scenarioFrom = (d) => ({
  x: {
    material: d.material,
    thickness_mm: d.thickness_mm,
    o2_pct: d.o2_pct,
    pressure_kPa: d.pressure_kPa,
    gravity_g: Math.min(G_MAX, Math.max(G_MIN, d.gravity_g)),
  },
  clamped: d.gravity_g < G_MIN || d.gravity_g > G_MAX,
})

export const DEFS = {
  scenario: {
    family: 'scenario',
    title: 'Scenario',
    width: 300,
    blurb: 'Atmosphere, gravity and material of the case you want to ask about.',
    inputs: [],
    outputs: [{ id: 'scenario', type: 'scenario' }],
    defaults: () => ({
      material: 'ACRYPLEN',
      thickness_mm: 0.125,
      o2_pct: 21,
      pressure_kPa: 101.3,
      gravity_g: round(MOON_G, 4),
    }),
    compute: ({ data }) => {
      const s = scenarioFrom(data)
      return { out: { scenario: s.x }, view: s, prov: 'input' }
    },
    inspect: (v) => [
      ['gravity', round(v.x.gravity_g, 4) + ' g' + (v.clamped ? ' (limited to 0.05-0.6)' : '')],
      ['O2', v.x.o2_pct + ' %'],
      ['pressure', v.x.pressure_kPa + ' kPa'],
      ['material', v.x.material + ', ' + v.x.thickness_mm + ' mm'],
    ],
    sources: ['Typed by the user. Gravity is limited to 0.05-0.6 g; 0 g and 1 g are measured reference data, never interpolated.'],
  },

  spread: {
    family: 'model',
    title: 'MARGIN-Spread',
    width: 340,
    blurb: 'Does an already-burning thin sample keep spreading or extinguish? Class plus an uncalibrated score.',
    inputs: [{ id: 'scenario', type: 'scenario' }],
    outputs: [{ id: 'estimate', type: 'estimate' }],
    defaults: () => ({ variant: 'full' }),
    compute: ({ data, inputs, ctx }) => {
      const x = inputs.scenario
      const variant = ctx.variants.find((v) => v.key === data.variant) || ctx.variants[0]
      const z = score(variant.model, x)
      const domain = domainReport(ctx.model, x)
      const outside = domain.filter((d) => d.status === 'outside')
      const est = { z, spread: z >= 0, variant: variant.key, outside: outside.map((d) => d.key) }
      return { out: { estimate: est }, view: { ...est, domain, variantLabel: variant.label }, prov: 'estimated' }
    },
    inspect: (v) => [
      ['class', v.spread ? 'spreads' : 'extinguishes'],
      ['log-odds', (v.z >= 0 ? '+' : '') + round(v.z, 2)],
      ['variant', v.variantLabel],
      ['outside trained range', v.outside.length ? v.outside.join(', ') : 'none'],
    ],
    sources: [
      'Takahashi et al. 2026 (CC BY): Table S1 conditions, Fig. 7 outcomes estimated from the figure.',
      'Logistic fit exported to public/models/takahashi_live_model.json (38 cases, 18 flights). Retrospective, not calibrated.',
    ],
  },

  domain: {
    family: 'check',
    title: 'Domain check',
    width: 300,
    blurb: 'Is each input inside the span the model was trained on? Boundary counts as inside.',
    inputs: [{ id: 'scenario', type: 'scenario' }],
    outputs: [{ id: 'verdict', type: 'verdict' }],
    defaults: () => ({}),
    compute: ({ inputs, ctx }) => {
      const rows = domainReport(ctx.model, inputs.scenario)
      const outside = rows.filter((r) => r.status === 'outside')
      return { out: { verdict: { outside: outside.map((r) => r.key) } }, view: { rows, outside }, prov: 'estimated' }
    },
    inspect: (v) => [
      ['verdict', v.outside.length ? 'outside trained domain' : 'inside trained domain'],
      ['outside', v.outside.length ? v.outside.map((r) => r.key).join(', ') : 'none'],
    ],
    sources: ['Trained spans read from the model JSON (numeric_features min/max, categorical_features).'],
  },

  nearest: {
    family: 'check',
    title: 'Nearest evidence',
    width: 360,
    blurb: "The real cases closest to your scenario, by distance in the model's scaled input space.",
    inputs: [{ id: 'scenario', type: 'scenario' }],
    outputs: [{ id: 'evidence', type: 'evidence' }],
    defaults: () => ({}),
    compute: ({ inputs, ctx }) => {
      const near = nearestCases(ctx.model, ctx.cases, inputs.scenario, 3)
      const outside = domainReport(ctx.model, inputs.scenario)
        .filter((d) => d.status === 'outside')
        .map((d) => d.key)
      const ev = {
        x: inputs.scenario,
        cases: ctx.cases,
        nearIds: near.map((c) => c.test_id),
        outside,
        trained: {
          o2: [ctx.model.numeric_features.o2_pct.min, ctx.model.numeric_features.o2_pct.max],
          p: [ctx.model.numeric_features.pressure_kPa.min, ctx.model.numeric_features.pressure_kPa.max],
        },
      }
      return {
        out: { evidence: ev },
        view: { near },
        prov: weakest(ctx.cases.map((c) => provOfRecord(c.provenance))),
      }
    },
    inspect: (v) => v.near.map((c) => [c.test_id, c.outcome + ', d=' + round(c.distance, 2)]),
    sources: ['Takahashi et al. 2026 (CC BY): outcomes estimated from Fig. 7, joined to Table S1 conditions.'],
  },

  chart: {
    family: 'output',
    title: 'Evidence chart',
    width: 440,
    blurb: 'Every real case on the O2 / pressure plane, the trained span, and where your scenario sits.',
    inputs: [{ id: 'evidence', type: 'evidence' }],
    outputs: [],
    defaults: () => ({}),
    compute: ({ inputs }) => ({ out: {}, view: inputs.evidence, prov: 'estimated' }),
    inspect: (v) => [
      ['cases plotted', String(v.cases.length)],
      ['scenario outside', v.outside.length ? v.outside.join(', ') : 'none'],
    ],
    sources: ['Takahashi et al. 2026 (CC BY), outcomes estimated from Fig. 7. Marker size follows gravity.'],
  },
}

export const portType = (nodeType, side, handleId) => {
  const list = side === 'source' ? DEFS[nodeType]?.outputs : DEFS[nodeType]?.inputs
  return list?.find((p) => p.id === handleId)?.type
}

export { LABELS, NUMERIC }
