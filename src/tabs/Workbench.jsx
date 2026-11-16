import { useEffect, useMemo } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { evaluateGraph } from '../graph/evaluate.js'
import { EvalContext } from '../graph/context.js'
import { useGraph } from '../graph/store.js'
import Canvas from '../canvas/Canvas.jsx'
import Palette from '../canvas/Palette.jsx'
import Inspector from '../canvas/Inspector.jsx'
import { mergeWorkbenchScenario, workbenchScenario } from '../lib/scenario.js'

// The node canvas, kept as its own tab: wire a scenario to a model and see where each number comes from.
export default function Workbench({ ctx, scenario, onScenarioChange }) {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const recipeId = useGraph((s) => s.recipeId)
  const updateData = useGraph((s) => s.updateData)
  const materials = ctx.model.categorical_features.material

  useEffect(() => {
    const node = useGraph.getState().nodes.find((n) => n.type === 'scenario')
    if (!node) return
    const values = workbenchScenario(scenario, materials)
    if (Object.entries(values).every(([key, value]) => Object.is(node.data[key], value))) return
    updateData(node.id, values)
  }, [scenario, materials, recipeId, updateData])

  const evaluated = useMemo(() => evaluateGraph(nodes, edges, ctx), [nodes, edges, ctx])
  const value = useMemo(() => ({ ...evaluated, ctx, onScenarioChange }), [evaluated, ctx, onScenarioChange])
  return (
    <EvalContext.Provider value={value}>
      <ReactFlowProvider>
        <div className="wb">
          <Palette />
          <Canvas />
          <Inspector />
        </div>
      </ReactFlowProvider>
    </EvalContext.Provider>
  )
}
