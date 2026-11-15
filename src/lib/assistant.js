// Client for /api/chat plus a deterministic brief that needs no AI. Both only restate what the plan computed.
import { Q, MAT } from './plan.js'
import { REGIME_LABEL, regimeOfG, round } from './psi.js'

export async function askAssistant({ messages, context, persona }) {
  const res = await fetch(import.meta.env.BASE_URL + 'api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context, persona }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `The assistant returned HTTP ${res.status}.`)
  return j.text
}

export const BRIEF_PROMPT =
  'Write the five-part brief for this experiment plan: 1) has it been done, 2) the gaps, 3) the experiment that would close them, 4) what we predict, 5) what to be careful about. Use only CONTEXT, cite IDs in square brackets, and say "no data" where it is silent.'

// Template brief: every sentence comes straight from a structured part, with its citation.
export function localBrief(plan, kb) {
  const { spec, priorArt, coverage, proposal, prediction } = plan
  const m = MAT[spec.material_class]
  const lines = []
  lines.push(`Experiment: ${m.label}, ${round(spec.o2_pct, 1)}% O2, ${round(spec.pressure_kPa, 1)} kPa, ${round(spec.gravity_g, 3)} g (${REGIME_LABEL[regimeOfG(spec.gravity_g)].toLowerCase()}); question: ${Q[spec.question].label.toLowerCase()}.`)
  const top = priorArt.items.find((i) => i.kind !== 'investigation')
  lines.push(`1. Has this been done? ${priorArt.verdict.text}${top ? ` Closest measured source: ${top.title} [${top.id}], ${Math.round(top.score * 100)}% match.` : ''}`)
  const gaps = coverage.gaps.filter((g) => g.severity !== 'info')
  lines.push(
    gaps.length
      ? `2. Gaps. ${gaps.map((g) => `${g.title}${g.cites.length ? ' [' + g.cites.slice(0, 2).join(', ') + ']' : ''}.`).join(' ')}`
      : '2. Gaps. Every axis you asked about is covered by at least one measured source; see part 1 for how closely.',
  )
  lines.push(
    `3. Proposed experiment (${proposal.basis}). ${proposal.title}. Vary: ${proposal.vary.join('; ')}. Hold: ${proposal.hold.join('; ')}.${proposal.platform ? ` Platform: ${proposal.platform.title} [${proposal.platform.id}].` : ''}`,
  )
  const sp = prediction.spread
  const lim = prediction.limit
  const pred = []
  if (sp?.applicable) {
    pred.push(`MARGIN-Spread by O2 rung: ${sp.rungs.map((r) => `${r.o2}% ${r.spread ? 'spreads' : 'extinguishes'} (score ${round(r.z, 2)}${r.outside.length ? ', outside trained range' : ''})`).join('; ')}. Uncalibrated score, not a probability.`)
  } else if (sp) pred.push(`No spread estimate: ${sp.reason}`)
  if (lim?.applicable) pred.push(`MARGIN-Limit at ${lim.flow} cm/s: about ${round(lim.o2, 1)}% O2 (90% band ${round(lim.lo, 1)} to ${round(lim.hi, 1)}).`)
  lines.push(`4. Prediction. ${pred.join(' ')} Held-out checks: ${prediction.retained.map((r) => `${r.ok}/${r.n} ${r.short}`).join(', ')}; all retrospective, labels estimated from a figure.`)
  lines.push('5. Care. PSI fields are AI-extracted and unreviewed; the estimator was trained on thin films and paper, not on this exact case; this describes evidence, not safety.')
  return lines.join('\n\n')
}
