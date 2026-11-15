// Input: public/models + public/data JSON -> Output: console check that the in-browser scorer reproduces the known held-out results.
import { readFileSync } from 'node:fs'
import { evaluate, variantsOf } from '../src/model.js'

const read = (p) => JSON.parse(readFileSync(new URL('../public/' + p, import.meta.url), 'utf8'))
const model = read('models/takahashi_live_model.json')
const cases = read('data/takahashi_cases.json')

const expected = { g16: [12, 17], g38: [9, 12], m32: [5, 6] }
let failed = false
for (const v of variantsOf(model).filter((x) => x.heldout)) {
  const r = evaluate(v.model, cases, v.heldout)
  const [ok, n] = expected[v.key]
  const pass = r.ok === ok && r.n === n
  failed = failed || !pass
  console.log(`${pass ? 'PASS' : 'FAIL'} ${v.label}: ${r.ok}/${r.n} (expected ${ok}/${n})`)
}
const inSample = evaluate(model, cases)
console.log(`full fit in-sample: ${inSample.ok}/${inSample.n} (expected 34/38 from the dashboard table)`)
if (inSample.ok !== 34 || inSample.n !== 38) failed = true
process.exit(failed ? 1 : 0)
