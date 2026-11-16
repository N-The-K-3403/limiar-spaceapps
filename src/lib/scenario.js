import { MATERIALS, MAT } from './plan.js'

export function estimatorMaterialForScenario(scenario, materials) {
  const definition = MAT[scenario?.material_class]
  if (definition?.model && materials.includes(definition.model)) {
    return { material: definition.model, proxy: false, sourceLabel: definition.label }
  }

  const material = definition?.thin && materials.includes('Filter paper')
    ? 'Filter paper'
    : definition?.family === 'pmma' && materials.includes('ACRYPLEN')
      ? 'ACRYPLEN'
      : materials.includes('ACRYPLEN')
        ? 'ACRYPLEN'
        : materials[0]

  return { material, proxy: !!definition, sourceLabel: definition?.label || String(scenario?.material_class || 'unknown material') }
}

export function estimatorScenario(scenario, materials) {
  const { material } = estimatorMaterialForScenario(scenario, materials)
  return {
    material,
    thickness_mm: scenario.thickness_mm,
    o2_pct: scenario.o2_pct,
    pressure_kPa: scenario.pressure_kPa,
    gravity_g: scenario.gravity_g,
  }
}

function classForModelMaterial(material) {
  return MATERIALS.find((item) => item.model === material)?.key
}

export function mergeEstimatorScenario(scenario, values, materials, describedMaterialClass) {
  let material_class = scenario.material_class
  if (MAT[describedMaterialClass]) {
    material_class = describedMaterialClass
  } else if (values.material !== estimatorMaterialForScenario(scenario, materials).material) {
    material_class = classForModelMaterial(values.material) || material_class
  }

  return {
    ...scenario,
    material_class,
    thickness_mm: values.thickness_mm,
    o2_pct: values.o2_pct,
    pressure_kPa: values.pressure_kPa,
    gravity_g: values.gravity_g,
  }
}

export function workbenchScenario(scenario, materials) {
  const mapped = estimatorMaterialForScenario(scenario, materials)
  return {
    material: mapped.material,
    thickness_mm: scenario.thickness_mm,
    o2_pct: scenario.o2_pct,
    pressure_kPa: scenario.pressure_kPa,
    gravity_g: scenario.gravity_g,
    materialProxy: mapped.proxy,
    sourceMaterialLabel: mapped.sourceLabel,
  }
}

export function mergeWorkbenchScenario(scenario, values, materials) {
  let material_class = scenario.material_class
  if (values.material !== estimatorMaterialForScenario(scenario, materials).material) {
    material_class = classForModelMaterial(values.material) || material_class
  }

  return {
    ...scenario,
    material_class,
    thickness_mm: values.thickness_mm,
    o2_pct: values.o2_pct,
    pressure_kPa: values.pressure_kPa,
    gravity_g: values.gravity_g,
  }
}
