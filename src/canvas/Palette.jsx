import { useReactFlow } from '@xyflow/react'
import { DEFS, FAMILIES } from '../graph/defs.js'
import { RECIPES } from '../graph/recipes.js'
import { useGraph } from '../graph/store.js'

export default function Palette() {
  const { screenToFlowPosition } = useReactFlow()
  const addNode = useGraph((s) => s.addNode)
  const recipeId = useGraph((s) => s.recipeId)
  const loadRecipe = useGraph((s) => s.loadRecipe)

  const add = (type) => {
    const el = document.querySelector('.canvas .react-flow')
    const r = el.getBoundingClientRect()
    const jitter = (Math.random() - 0.5) * 80
    addNode(type, screenToFlowPosition({ x: r.left + r.width / 2 - 120 + jitter, y: r.top + r.height / 2 - 80 + jitter }))
  }

  return (
    <aside className="palette">
      <h4>Recipes</h4>
      {RECIPES.map((r) => (
        <button
          key={r.id}
          className={'recipe' + (recipeId === r.id ? ' active' : '')}
          disabled={!r.build}
          onClick={() => loadRecipe(r.id)}
          title={r.blurb}
        >
          <span>{r.title}</span>
          {!r.build && <em>soon</em>}
        </button>
      ))}
      <h4>Nodes</h4>
      <p className="sm">Click to drop one on the board. Drag from a port to a matching port to wire it.</p>
      {Object.entries(DEFS).map(([type, d]) => (
        <button key={type} className={`lib fam-${d.family}`} onClick={() => add(type)} title={d.blurb}>
          <span className="lib-dot" />
          <span className="lib-title">{d.title}</span>
          <span className="lib-fam mono">{FAMILIES[d.family]}</span>
        </button>
      ))}
    </aside>
  )
}
