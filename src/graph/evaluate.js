// Graph evaluator: Kahn topological order, each node a pure function of its data and its wired inputs.
// Output per node: { status: 'ok' | 'waiting' | 'error', view, out: {port: {value, prov}}, prov, inProv, own }.

import { DEFS, portType, weakest } from './defs.js'

export function evaluateGraph(nodes, edges, ctx) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const live = edges.filter((e) => byId.has(e.source) && byId.has(e.target))

  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  const outs = new Map(nodes.map((n) => [n.id, []]))
  for (const e of live) {
    indeg.set(e.target, indeg.get(e.target) + 1)
    outs.get(e.source).push(e.target)
  }
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    for (const t of outs.get(id)) {
      indeg.set(t, indeg.get(t) - 1)
      if (indeg.get(t) === 0) queue.push(t)
    }
  }

  const results = {}
  for (const n of nodes) if (!order.includes(n.id)) results[n.id] = { status: 'error', message: 'cycle in graph', out: {} }

  for (const id of order) {
    const n = byId.get(id)
    const def = DEFS[n.type]
    if (!def) {
      results[id] = { status: 'error', message: 'unknown node type ' + n.type, out: {} }
      continue
    }
    const inputs = {}
    const inProv = []
    const missing = []
    for (const port of def.inputs) {
      const e = live.find((x) => x.target === id && x.targetHandle === port.id)
      const o = e ? results[e.source]?.out?.[e.sourceHandle] : undefined
      if (!o) missing.push(port.type)
      else {
        inputs[port.id] = o.value
        inProv.push(o.prov)
      }
    }
    if (missing.length) {
      results[id] = { status: 'waiting', missing, out: {} }
      continue
    }
    try {
      const r = def.compute({ data: n.data, inputs, ctx })
      const prov = weakest([r.prov, ...inProv])
      const out = {}
      for (const [port, value] of Object.entries(r.out)) out[port] = { value, prov }
      results[id] = { status: 'ok', view: r.view, out, prov, own: r.prov, inProv }
    } catch (err) {
      results[id] = { status: 'error', message: String(err.message || err), out: {} }
    }
  }

  const edgeInfo = {}
  for (const e of live) {
    const src = results[e.source]
    const o = src?.out?.[e.sourceHandle]
    edgeInfo[e.id] = o
      ? { live: true, prov: o.prov, own: src.own, inProv: src.inProv, type: portType(byId.get(e.source).type, 'source', e.sourceHandle) }
      : { live: false, prov: 'unreviewed', type: portType(byId.get(e.source).type, 'source', e.sourceHandle) }
  }
  return { results, edgeInfo, order }
}

// Would adding source -> target create a cycle? (walk downstream from target looking for source)
export function wouldCycle(edges, source, target) {
  if (source === target) return true
  const seen = new Set()
  const stack = [target]
  while (stack.length) {
    const id = stack.pop()
    if (id === source) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const e of edges) if (e.source === id) stack.push(e.target)
  }
  return false
}
