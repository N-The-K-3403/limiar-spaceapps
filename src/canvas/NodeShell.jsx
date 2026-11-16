import { Handle, Position } from '@xyflow/react'
import { DEFS, FAMILIES } from '../graph/defs.js'
import { useEval } from '../graph/context.js'
import { useGraph } from '../graph/store.js'
import ProvMark from './ProvMark.jsx'

export function Waiting({ res }) {
  const msg =
    res?.status === 'error' ? 'Error: ' + res.message : 'Waiting for a ' + (res?.missing || ['wire']).join(', ') + ' wire'
  return <div className={'wait mono' + (res?.status === 'error' ? ' bad' : '')}>{msg}</div>
}

export default function NodeShell({ id, type, selected, children }) {
  const def = DEFS[type]
  const { results } = useEval()
  const res = results[id]
  // which ports have a wire: a string, so the selector result is stable between renders
  const wired = useGraph((s) =>
    s.edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? 'o:' + e.sourceHandle : 'i:' + e.targetHandle))
      .join(','),
  )
  const on = (k) => wired.split(',').includes(k)

  return (
    <div className={`node fam-${def.family}${selected ? ' selected' : ''}`} style={{ width: def.width }}>
      <div className="node-head">
        <span className="fam">{FAMILIES[def.family]}</span>
        <span className="title">{def.title}</span>
        <span className="grow" />
        <ProvMark prov={res?.status === 'ok' ? res.prov : null} label={false} />
      </div>
      <div className="ports mono">
        <span>{def.inputs.map((p) => p.type).join(', ')}</span>
        <span>{def.outputs.map((p) => p.type).join(', ')}</span>
      </div>
      {def.inputs.map((p) => (
        <Handle
          key={p.id}
          id={p.id}
          type="target"
          position={Position.Left}
          className={'port' + (on('i:' + p.id) ? ' on' : '')}
          style={{ top: 41 }}
        />
      ))}
      {def.outputs.map((p) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Right}
          className={'port' + (on('o:' + p.id) ? ' on' : '')}
          style={{ top: 41 }}
        />
      ))}
      <div className="node-body">
        <p className="node-caption">{def.blurb}</p>
        {children}
      </div>
    </div>
  )
}
