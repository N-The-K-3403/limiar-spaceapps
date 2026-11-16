import assert from 'node:assert/strict'
import { defaultSpec } from '../src/lib/plan.js'
import {
  estimatorScenario,
  mergeEstimatorScenario,
  mergeWorkbenchScenario,
  workbenchScenario,
} from '../src/lib/scenario.js'

const materials = ['ACRYPLEN', 'Filter paper']
const initial = defaultSpec()
const estimator = estimatorScenario(initial, materials)

assert.equal(estimator.o2_pct, initial.o2_pct)
assert.equal(estimator.pressure_kPa, initial.pressure_kPa)
assert.equal(estimator.material, 'ACRYPLEN')

const changedEstimate = mergeEstimatorScenario(initial, { ...estimator, o2_pct: 21, material: 'Filter paper' }, materials)
assert.equal(changedEstimate.o2_pct, 21)
assert.equal(changedEstimate.material_class, 'paper_thin')
assert.equal(changedEstimate.flow_cms, initial.flow_cms)
assert.equal(changedEstimate.question, initial.question)

const fabric = { ...initial, material_class: 'fabric', flow_cms: 10 }
const fabricEstimate = estimatorScenario(fabric, materials)
assert.equal(fabricEstimate.material, 'Filter paper')
assert.equal(mergeEstimatorScenario(fabric, { ...fabricEstimate, o2_pct: 25 }, materials).material_class, 'fabric')
assert.equal(mergeEstimatorScenario(initial, estimator, materials, 'fabric').material_class, 'fabric')

const graphScenario = workbenchScenario(fabric, materials)
assert.equal(graphScenario.materialProxy, true)
assert.equal(graphScenario.sourceMaterialLabel, 'Fabric (SIBAL, cotton)')
const fromWorkbench = mergeWorkbenchScenario(fabric, { ...graphScenario, gravity_g: 0.3 }, materials)
assert.equal(fromWorkbench.gravity_g, 0.3)
assert.equal(fromWorkbench.material_class, 'fabric')
assert.equal(fromWorkbench.flow_cms, 10)

console.log('all scenario-sharing checks passed')
