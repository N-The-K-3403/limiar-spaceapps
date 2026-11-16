import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { makeCtx } from './graph/defs.js'
import { buildKB } from './lib/psi.js'
import { fitLimit } from './lib/limitmodel.js'
import { defaultSpec, planContext, presetsOf, runPlan } from './lib/plan.js'
import { normalizeSpec } from './ui/spec.js'
import { SourcePeek } from './ui/bits.jsx'
import Icon, { TAB_ICON } from './ui/icons.jsx'
import Assistant from './ui/Assistant.jsx'
import LevelModal from './ui/LevelModal.jsx'
import WorkbenchHelpModal from './ui/WorkbenchHelpModal.jsx'
import { getLevel, setLevel, subscribeLevel } from './lib/level.js'
import Chat from './tabs/Chat.jsx'
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
  ['workbench', 'Node Workspace'],
  ['ai', 'Assistant'],
  ['models', 'Models'],
  ['sources', 'Sources'],
]

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
  const [scenario, setScenario] = useState(defaultSpec)
  const level = useSyncExternalStore(subscribeLevel, getLevel) // explanation level, chosen in a pop-up before the first AI use
  const persona = level || 'Neutral'
  const [levelAsk, setLevelAsk] = useState(false) // true while the level pop-up is open
  const askRef = useRef(null) // { resolve } of the AI action waiting for the pop-up
  const closeLevel = useCallback((v) => {
    const a = askRef.current
    askRef.current = null
    setLevelAsk(false)
    if (a) a.resolve(v)
  }, [])
  // Every AI action awaits this first: resolves at once if a level is saved, otherwise opens the pop-up (null = cancelled).
  const needLevel = useCallback(() => {
    const cur = getLevel()
    if (cur) return Promise.resolve(cur)
    return new Promise((resolve) => {
      askRef.current = { resolve }
      setLevelAsk(true)
    })
  }, [])
  const openLevel = useCallback(() => {
    askRef.current = { resolve: () => {} }
    setLevelAsk(true)
  }, [])
  const pickLevel = (k) => {
    setLevel(k)
    closeLevel(k)
  }
  const [chat, setChat] = useState(false)
  const [peek, setPeek] = useState(null)
  const [workbenchHelp, setWorkbenchHelp] = useState(false)
  const workbenchHelpSeen = useRef(false)
  const selectTab = useCallback((next) => {
    if (next === 'workbench' && !workbenchHelpSeen.current) {
      workbenchHelpSeen.current = true
      setWorkbenchHelp(true)
    }
    setTab(next)
  }, [])

  useEffect(() => {
    Promise.all([load('models/takahashi_live_model.json'), load('data/takahashi_cases.json'), load('data/manifest.json'), load('data/graph.json'), load('data/sofie_points.json'), load('data/project_brief.json').catch(() => null)])
      .then(([model, cases, manifest, graph, sofie, brief]) => setData({ model, cases, manifest, graph, sofie, brief }))
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
    const onKey = (e) => e.key === 'Escape' && (setPeek(null), setChat(false), setWorkbenchHelp(false), closeLevel(null))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeLevel])

  const ctx = useMemo(() => (data ? makeCtx(data) : null), [data])
  const kb = useMemo(() => (data ? buildKB({ graph: data.graph, sofie: data.sofie, cases: data.cases }) : null), [data])
  const fit = useMemo(() => (data ? fitLimit(data.sofie) : null), [data])
  const presets = useMemo(() => (kb ? presetsOf(kb) : []), [kb])
  const norm = useMemo(() => normalizeSpec(scenario), [scenario])
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

  const getContext = () => {
    const base = plan ? { active_tab: tab, ...planContext(plan, kb, persona) } : { active_tab: tab, note: 'The planner inputs are incomplete, so no plan is available.' }
    return data.brief ? { project_brief: data.brief, ...base } : base
  }
  const common = { kb, onCite: setPeek, goTab: selectTab }

  return (
    <div className={'app' + (tab === 'workbench' ? ' fixed' : '')}>
      <header className="top">
        <div className="brand">
          <img className="brand-mark" src={BASE + 'logo-only-limiar.png'} alt="" />
          <img className="brand-wordmark" src={BASE + 'text-only-limiar.png'} alt="Limiar" />
          <small>research workspace</small>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([k, l]) => (
            <button key={k} className={'tab' + (tab === k ? ' on' : '')} title={l} aria-label={l} aria-current={tab === k ? 'page' : undefined} onClick={() => selectTab(k)}>
              <Icon name={TAB_ICON[k]} size={15} />
              <span className="tl">{l}</span>
            </button>
          ))}
        </nav>
        <button className="btn primary" onClick={() => setChat((v) => !v)} aria-expanded={chat}><Icon name="chat" size={14} /> Ask Limiar</button>
      </header>

      {tab === 'planner' && <Planner raw={scenario} setRaw={setScenario} problems={problems} plan={plan} ctx={ctx} presets={presets} persona={persona} needLevel={needLevel} {...common} />}
      {tab === 'evidence' && <Evidence points={data.sofie} manifest={data.manifest} fit={fit} scenario={scenario} />}
      {tab === 'estimator' && <Estimator ctx={ctx} presets={presets} scenario={scenario} setScenario={setScenario} />}
      {tab === 'library' && <Library kb={kb} />}
      {tab === 'gaps' && <Gaps plan={plan} {...common} />}
      {tab === 'workbench' && (
        <div className="page wide">
          <Workbench ctx={ctx} scenario={scenario} onScenarioChange={setScenario} />
        </div>
      )}
      {tab === 'ai' && <Chat kb={kb} level={level} openLevel={openLevel} needLevel={needLevel} getContext={getContext} onCite={setPeek} />}
      {tab === 'models' && <Models ctx={ctx} fit={fit} />}
      {tab === 'sources' && <Sources manifest={data.manifest} kb={kb} />}

      {tab !== 'workbench' && (
        <footer className="page" style={{ paddingTop: 0 }}>
          <p className="footnote">
            Data: NASA Physical Sciences Informatics (metadata, unreviewed), Takahashi et al. 2026 (CC BY) and T’ien et al. 2025 (CC BY-NC-ND, numbers cited, figure not redistributed). Student project, not endorsed by NASA. Model outputs are labeled estimates, not measurements.
          </p>
        </footer>
      )}

      <Assistant open={chat} onClose={() => setChat(false)} persona={persona} level={level} openLevel={openLevel} needLevel={needLevel} tab={tab} kb={kb} getContext={getContext} onCite={setPeek} />
      <SourcePeek id={peek} kb={kb} onClose={() => setPeek(null)} />
      {workbenchHelp && <WorkbenchHelpModal onClose={() => setWorkbenchHelp(false)} />}
      {levelAsk && <LevelModal current={level} onPick={pickLevel} onClose={() => closeLevel(null)} />}
    </div>
  )
}
