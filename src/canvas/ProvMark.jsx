import { PROV_LABEL } from '../graph/defs.js'

// Provenance by SHAPE, never by color alone:
// verified = solid bright core with glow, estimated = hollow ring, unreviewed = dashed and dim, input = small plasma square.
export default function ProvMark({ prov, label = true }) {
  if (!prov) return null
  return (
    <span className={'prov prov-' + prov} title={PROV_LABEL[prov]}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {prov === 'verified' && <circle cx="6" cy="6" r="3.6" className="pm-core" />}
        {prov === 'estimated' && <circle cx="6" cy="6" r="3.8" className="pm-ring" />}
        {prov === 'unreviewed' && <circle cx="6" cy="6" r="3.8" className="pm-dash" />}
        {prov === 'input' && <rect x="3" y="3" width="6" height="6" className="pm-in" />}
      </svg>
      {label && <span>{PROV_LABEL[prov]}</span>}
    </span>
  )
}
