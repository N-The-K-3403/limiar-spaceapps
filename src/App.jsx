import { useEffect, useMemo, useState } from 'react'
import { makeCtx } from './graph/defs.js'
import { buildKB } from './lib/psi.js'
import { fitLimit } from './lib/limitmodel.js'
import { defaultSpec, planContext, presetsOf, runPlan } from './lib/plan.js'
import { normalizeSpec } from './ui/spec.js'
import { SourcePeek } from './ui/bits.jsx'
import Icon, { TAB_ICON } from './ui/icons.jsx'
import Assistant from './ui/Assistant.jsx'
import Planner from './tabs/Planner.jsx'
import Evidence from './tabs/Evidence.jsx'
import Estimator from './tabs/Estimator.jsx'
import Library from './tabs/Library.jsx'
import Gaps from './tabs/Gaps.jsx'
import Workbench from './tabs/Workbench.jsx'
import Models from './tabs/Models.jsx'
import Sources from './tabs/Sources.jsx'
import './canvas.css'
import './styles/dash.css'

const BASE = import.meta.env.BASE_URL
const TABS = [
  ['planner', 'Planner'],
  ['evidence', 'Evidence'],
  ['estimator', 'Estimator'],
  ['library', 'Investigations'],
  ['gaps', 'Gaps'],
  ['workbench', 'Workbench'],
  ['models', 'Models'],
  ['sources', 'Sources'],
]
const PERSONAS = ['Student', 'Professor', 'Engineer']

async function load(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(path + ': ' + res.status)
  return res.json()
}

const tabFromHash = () => {
  const h = window.location.hash.replace('#', '')
  return TABS.some(([k]) => k === h) ? h : 'planner'
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(tabFromHash)
  const [raw, setRaw] = useState(defaultSpec)
  const [persona, setPersona] = useState('Student')
  const [chat, setChat] = useState(false)
  const [peek, setPeek] = useState(null)

  useEffect(() => {
    Promise.all([load('models/takahashi_live_model.json'), load('data/takahashi_cases.json'), load('data/manifest.json'), load('data/graph.json'), load('data/sofie_points.json')])
      .then(([model, cases, manifest, graph, sofie]) => setData({ model, cases, manifest, graph, sofie }))
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    window.history.replaceState(null, '', '#' + tab)
    window.scrollTo(0, 0)
  }, [tab])
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && (setPeek(null), setChat(false))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ctx = useMemo(() => (data ? makeCtx(data) : null), [data])
  const kb = useMemo(() => (data ? buildKB({ graph: data.graph, sofie: data.sofie, cases: data.cases }) : null), [data])
  const fit = useMemo(() => (data ? fitLimit(data.sofie) : null), [data])
  const presets = useMemo(() => (kb ? presetsOf(kb) : []), [kb])
  const norm = useMemo(() => normalizeSpec(raw), [raw])
  const planned = useMemo(() => {
    if (!ctx || !kb || !norm.valid) return { plan: null, err: null }
    try {
      return { plan: runPlan(norm.spec, ctx, kb, fit), err: null }
    } catch (e) {
      return { plan: null, err: String(e && e.message ? e.message : e) }
    }
  }, [ctx, kb, fit, norm])
  const plan = planned.plan
  const problems = planned.err ? [...norm.problems, 'The plan could not run: ' + planned.err] : norm.problems

  if (error) return <div className="boot">Could not load data files: {error}</div>
  if (!ctx || !kb) return <div className="boot">Loading model and evidence…</div>

  const getContext = () => (plan ? { active_tab: tab, ...planContext(plan, kb, persona) } : { active_tab: tab, note: 'The planner inputs are incomplete, so no plan is available.' })
  const common = { kb, onCite: setPeek, goTab: setTab }

  return (
    <div className={'app' + (tab === 'workbench' ? ' fixed' : '')}>
      <header className="top">
        <div className="brand">
          <span className="spark" />
          Flame in Freefall
          <small>research workspace</small>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([k, l]) => (
            <button key={k} className={'tab' + (tab === k ? ' on' : '')} title={l} aria-label={l} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
              <Icon name={TAB_ICON[k]} size={15} />
              <span className="tl">{l}</span>
            </button>
          ))}
        </nav>
        <div className="seg" role="group" aria-label="Explanation depth">
          {PERSONAS.map((p) => (
            <button key={p} className={persona === p ? 'on' : ''} aria-pressed={persona === p} onClick={() => setPersona(p)}>{p}</button>
          ))}
        </div>
        <button className="btn primary" onClick={() => setChat((v) => !v)} aria-expanded={chat}><Icon name="chat" size={14} /> Ask Limiar</button>
      </header>

      {tab === 'planner' && <Planner raw={raw} setRaw={setRaw} problems={problems} plan={plan} ctx={ctx} presets={presets} persona={persona} {...common} />}
      {tab === 'evidence' && <Evidence points={data.sofie} manifest={data.manifest} fit={fit} />}
      {tab === 'estimator' && <Estimator ctx={ctx} />}
      {tab === 'library' && <Library kb={kb} />}
      {tab === 'gaps' && <Gaps plan={plan} {...common} />}
      {tab === 'workbench' && (
        <div className="page wide">
          <Workbench ctx={ctx} />
        </div>
      )}
      {tab === 'models' && <Models ctx={ctx} fit={fit} />}
      {tab === 'sources' && <Sources manifest={data.manifest} kb={kb} />}

      {tab !== 'workbench' && (
        <footer className="page" style={{ paddingTop: 0 }}>
          <p className="footnote">
            Data: NASA Physical Sciences Informatics (metadata, unreviewed), Takahashi et al. 2026 (CC BY) and T’ien et al. 2025 (CC BY-NC-ND, numbers cited, figure not redistributed). Student project, not endorsed by NASA. Model outputs are labeled estimates, not measurements.
          </p>
        </footer>
      )}

      <Assistant open={chat} onClose={() => setChat(false)} persona={persona} tab={tab} kb={kb} getContext={getContext} onCite={setPeek} />
      <SourcePeek id={peek} kb={kb} onClose={() => setPeek(null)} />
    </div>
  )
}
