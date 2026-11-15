import { DEFS, FAMILIES, PROV_LABEL } from '../graph/defs.js'
import { useEval } from '../graph/context.js'
import { useGraph } from '../graph/store.js'
import ProvMark from './ProvMark.jsx'

function Key() {
  return (
    <div className="key">
      <h4>Provenance key</h4>
      {['verified', 'estimated', 'unreviewed', 'input'].map((p) => (
        <div key={p} className="key-row">
          <ProvMark prov={p} />
        </div>
      ))}
      <p className="sm">Shapes carry the meaning, color only reinforces it. A wire inherits the weakest provenance among its inputs.</p>
    </div>
  )
}

export default function Inspector() {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const { results, edgeInfo } = useEval()
  const node = nodes.find((n) => n.selected)
  const edge = !node && edges.find((e) => e.selected)

  let body
  if (node) {
    const def = DEFS[node.type]
    const res = results[node.id]
    body = (
      <>
        <div className="insp-kicker mono">{FAMILIES[def.family]} node</div>
        <h3>{def.title}</h3>
        <p>{def.blurb}</p>
        <div className="insp-prov">{res?.status === 'ok' ? <ProvMark prov={res.prov} /> : <span className="sm mono">{res?.status || 'idle'}</span>}</div>
        {res?.status === 'ok' && (
          <>
            <h4>Values</h4>
            <table className="mini">
              <tbody>
                {def.inspect(res.view).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="mono">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {res.inProv.length > 0 && (
              <p className="sm">
                Provenance = weakest of: this node ({PROV_LABEL[res.own]}) and its inputs ({res.inProv.map((p) => PROV_LABEL[p]).join(', ')}).
              </p>
            )}
          </>
        )}
        <h4>Sources</h4>
        <ul className="plain sm">
          {def.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </>
    )
  } else if (edge) {
    const info = edgeInfo[edge.id]
    const from = nodes.find((n) => n.id === edge.source)
    const to = nodes.find((n) => n.id === edge.target)
    body = (
      <>
        <div className="insp-kicker mono">Wire</div>
        <h3>
          {DEFS[from.type].title} to {DEFS[to.type].title}
        </h3>
        <p>
          Carries a <b className="mono">{info?.type}</b> value.
        </p>
        <div className="insp-prov">{info?.live ? <ProvMark prov={info.prov} /> : <span className="sm mono">no data flowing</span>}</div>
        {info?.live && (
          <p className="sm">
            Drawn by the weakest provenance among what produced it: {PROV_LABEL[info.own]}
            {info.inProv.length ? ' and its inputs (' + info.inProv.map((p) => PROV_LABEL[p]).join(', ') + ')' : ''}.
          </p>
        )}
      </>
    )
  } else {
    body = (
      <>
        <div className="insp-kicker mono">Inspector</div>
        <h3>Select a node or a wire</h3>
        <p className="sm">Provenance, values and sources appear here. Wires carry typed values; only matching ports connect.</p>
        <Key />
      </>
    )
  }

  return (
    <aside className="inspector">
      <div className="insp-scroll">{body}</div>
      <div className="assistant">
        <h4>Assistant</h4>
        <p className="sm">Gemini explainer, wired to the selection and citing node IDs. Not connected yet (build step 5).</p>
        <textarea disabled rows={2} placeholder="Ask about the selected node..." />
      </div>
    </aside>
  )
}
