const COPY = {
  canvas: {
    title: 'Canvas',
    body: 'Pin evidence, charts, estimates and graph nodes as cards on an infinite board; drag, connect, annotate and export. Planned with React Flow.',
  },
  investigations: {
    title: 'Investigations',
    body: 'Catalog of NASA PSI investigations with filters, a transparent relevance ranking with adjustable weights, and side-by-side comparison. PSI fields are still unreviewed (0 of 2945), so everything shown here will carry the unreviewed badge.',
  },
  graph: {
    title: 'Knowledge graph',
    body: 'Navigate materials, investigations, papers, models and conditions; every edge carries its source. Waiting on a single graph.json that merges the existing graph, notes and CSVs.',
  },
}

export default function Soon({ id }) {
  const c = COPY[id]
  return (
    <div className="card">
      <h2>{c.title} - not built yet</h2>
      <p>{c.body}</p>
      <p className="note">Spec: web/FEATURES.md</p>
    </div>
  )
}
