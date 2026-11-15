import { create } from 'zustand'
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import { DEFS, portType } from './defs.js'
import { RECIPES } from './recipes.js'
import { wouldCycle } from './evaluate.js'

const first = RECIPES[0].build()
let counter = 1

export const useGraph = create((set, get) => ({
  nodes: first.nodes,
  edges: first.edges,
  recipeId: RECIPES[0].id,
  fitTick: 0, // bumped whenever the canvas should re-fit its view

  loadRecipe: (id) => {
    const r = RECIPES.find((x) => x.id === id)
    if (!r || !r.build) return
    const g = r.build()
    set((s) => ({ nodes: g.nodes, edges: g.edges, recipeId: id, fitTick: s.fitTick + 1 }))
  },

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  isValidConnection: (c) => {
    const { nodes, edges } = get()
    const a = nodes.find((n) => n.id === c.source)
    const b = nodes.find((n) => n.id === c.target)
    if (!a || !b) return false
    const t1 = portType(a.type, 'source', c.sourceHandle)
    const t2 = portType(b.type, 'target', c.targetHandle)
    return !!t1 && t1 === t2 && !wouldCycle(edges, c.source, c.target)
  },

  onConnect: (c) => {
    if (!get().isValidConnection(c)) return
    // one wire per input port: a new wire replaces the old one
    const kept = get().edges.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle))
    set({ edges: addEdge({ ...c, type: 'wire' }, kept) })
  },

  updateData: (id, patch) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) })),

  addNode: (type, position) => {
    if (!DEFS[type]) return
    const id = type + '-' + ++counter
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), { id, type, position, data: DEFS[type].defaults(), selected: true }],
    }))
  },
}))
