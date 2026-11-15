import { useEffect, useRef } from 'react'
import { Background, BackgroundVariant, Controls, ReactFlow, useReactFlow } from '@xyflow/react'
import { useGraph } from '../graph/store.js'
import { nodeTypes } from './nodes.jsx'
import WireEdge from './WireEdge.jsx'

const edgeTypes = { wire: WireEdge }

export default function Canvas() {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const onNodesChange = useGraph((s) => s.onNodesChange)
  const onEdgesChange = useGraph((s) => s.onEdgesChange)
  const onConnect = useGraph((s) => s.onConnect)
  const isValidConnection = useGraph((s) => s.isValidConnection)
  const fitTick = useGraph((s) => s.fitTick)
  const { fitView } = useReactFlow()
  const ref = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.12, duration: 350 }), 60)
    return () => clearTimeout(t)
  }, [fitTick, fitView])

  // brighter grid dots near the cursor: set CSS variables directly, no React re-render
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mx', e.clientX - r.left + 'px')
    ref.current.style.setProperty('--my', e.clientY - r.top + 'px')
  }

  return (
    <div className="canvas" ref={ref} onPointerMove={onMove}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.25}
        maxZoom={1.6}
        connectionRadius={28}
        deleteKeyCode={['Backspace', 'Delete']}
        colorMode="dark"
      >
        <Background id="dots" variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#1c212b" />
        <Background id="hot" className="bg-hot" variant={BackgroundVariant.Dots} gap={22} size={1.6} color="#ffb02e" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  )
}
