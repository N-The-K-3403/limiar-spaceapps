import { useMemo } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { evaluateGraph } from '../graph/evaluate.js'
import { EvalContext } from '../graph/context.js'
import { useGraph } from '../graph/store.js'
import Canvas from '../canvas/Canvas.jsx'
import Palette from '../canvas/Palette.jsx'
import Inspector from '../canvas/Inspector.jsx'

// The node canvas, kept as its own tab: wire a scenario to a model and see where each number comes from.
export default function Workbench({ ctx }) {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const evaluated = useMemo(() => evaluateGraph(nodes, edges, ctx), [nodes, edges, ctx])
  const value = useMemo(() => ({ ...evaluated, ctx }), [evaluated, ctx])
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
