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

function moonRecipe() {
  const lunarBase = ATMOSPHERES[1]
  const moon = GRAVITIES[0]
  return {
    nodes: [
      {
        id: 'scn',
        type: 'scenario',
        position: { x: 0, y: 70 },
        data: {
          ...DEFS.scenario.defaults(),
          material: 'ACRYPLEN',
          thickness_mm: 0.125,
          o2_pct: lunarBase.o2_pct,
          pressure_kPa: lunarBase.pressure_kPa,
          gravity_g: moon.g,
        },
      },
      { id: 'spr', type: 'spread', position: { x: 400, y: -20 }, data: DEFS.spread.defaults() },
      { id: 'dom', type: 'domain', position: { x: 400, y: 500 }, data: DEFS.domain.defaults() },
      { id: 'nrs', type: 'nearest', position: { x: 780, y: 470 }, data: DEFS.nearest.defaults() },
      { id: 'cht', type: 'chart', position: { x: 780, y: -20 }, data: DEFS.chart.defaults() },
    ],
    edges: [
      wire('e1', 'scn', 'scenario', 'spr', 'scenario'),
      wire('e2', 'scn', 'scenario', 'dom', 'scenario'),
      wire('e3', 'scn', 'scenario', 'nrs', 'scenario'),
      wire('e4', 'nrs', 'evidence', 'cht', 'evidence'),
    ],
  }
}

export const RECIPES = [
  {
    id: 'moon',
    title: 'Moon estimate',
    blurb: 'Lunar-base atmosphere, thin acrylic film: estimate, domain check, nearest real cases, chart.',
    build: moonRecipe,
  },
  { id: 'gaps', title: 'Where are the gaps?', blurb: 'Coverage against the lunar-habitat target. Coming next.', build: null },
  { id: 'compare', title: 'Compare investigations', blurb: 'Two PSI investigations side by side. Coming next.', build: null },
]
