import { getBezierPath } from '@xyflow/react'
import { useEval } from '../graph/context.js'

// A wire drawn by the provenance it carries (weakest of its inputs):
//   input      = thin solid plasma line (typed by the user)
//   verified   = solid, bright, gradient plasma -> heat
//   estimated  = dotted (a chain of small beads), gradient
//   unreviewed = long dashes, dim
// A pulse travels along live wires. It is hidden under prefers-reduced-motion (see canvas.css).
export default function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }) {
  const { edgeInfo } = useEval()
  const info = edgeInfo[id] || { live: false, prov: 'unreviewed' }
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 })
  const gid = 'wg-' + id
  const cls = `wire prov-${info.prov}${selected ? ' sel' : ''}`
  return (
    <g className={cls}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0%" stopColor="var(--plasma2)" />
          <stop offset="100%" stopColor="#ffb02e" />
        </linearGradient>
      </defs>
      {info.prov === 'verified' && <path d={path} className="wire-glow" stroke={`url(#${gid})`} />}
      <path d={path} className="wire-line" stroke={info.prov === 'input' ? 'var(--plasma2)' : `url(#${gid})`} />
      <path d={path} className="wire-hit" />
      {info.live && (
        <circle r="2.6" className="pulse">
          <animateMotion dur="2.8s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </g>
  )
}
