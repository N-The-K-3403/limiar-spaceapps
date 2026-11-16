// Starter recipes: pre-wired graphs so the site never opens on an empty board.
import { DEFS, ATMOSPHERES, GRAVITIES } from './defs.js'

const wire = (id, source, sourceHandle, target, targetHandle) => ({
  id,
  source,
  sourceHandle,
  target,
  targetHandle,
  type: 'wire',
})

const LAYERS = ['scenario', 'model', 'check', 'output']
const NODE_HEIGHT = { scenario: 520, spread: 460, domain: 340, nearest: 330, chart: 420 }

function layoutLeftToRight(nodes) {
  const positioned = new Map()
  let x = 0

  for (const family of LAYERS) {
    const layer = nodes.filter((node) => DEFS[node.type].family === family)
    if (!layer.length) continue
    const gapY = 90
    const layerHeight = layer.reduce((sum, node) => sum + (NODE_HEIGHT[node.type] || 360), 0) + gapY * (layer.length - 1)
    let y = -layerHeight / 2
    const width = Math.max(...layer.map((node) => DEFS[node.type].width))

    for (const node of layer) {
      const height = NODE_HEIGHT[node.type] || 360
      positioned.set(node.id, { ...node, position: { x, y } })
      y += height + gapY
    }
    x += width + 90
  }

  if (positioned.size !== nodes.length) throw new Error('A recipe node has an unknown family and cannot be auto-laid out.')
  return nodes.map((node) => positioned.get(node.id))
}

function moonRecipe() {
  const lunarBase = ATMOSPHERES[1]
  const moon = GRAVITIES[0]
  const nodes = [
    {
      id: 'scn',
      type: 'scenario',
      data: {
        ...DEFS.scenario.defaults(),
        material: 'ACRYPLEN',
        thickness_mm: 0.125,
        o2_pct: lunarBase.o2_pct,
        pressure_kPa: lunarBase.pressure_kPa,
        gravity_g: moon.g,
      },
    },
    { id: 'spr', type: 'spread', data: DEFS.spread.defaults() },
    { id: 'dom', type: 'domain', data: DEFS.domain.defaults() },
    { id: 'nrs', type: 'nearest', data: DEFS.nearest.defaults() },
    { id: 'cht', type: 'chart', data: DEFS.chart.defaults() },
  ]
  const edges = [
    wire('e1', 'scn', 'scenario', 'spr', 'scenario'),
    wire('e2', 'scn', 'scenario', 'dom', 'scenario'),
    wire('e3', 'scn', 'scenario', 'nrs', 'scenario'),
    wire('e4', 'nrs', 'evidence', 'cht', 'evidence'),
  ]
  return { nodes: layoutLeftToRight(nodes), edges }
}

export const RECIPES = [
  {
    id: 'moon',
    title: 'Moon estimate',
    blurb: 'Lunar-base atmosphere, thin acrylic film: estimate, domain check, nearest real cases, chart.',
    build: moonRecipe,
  },
]
