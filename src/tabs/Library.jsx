import { useMemo, useState } from 'react'
import { FEATURES, TARGETS, compareInvestigations, download, rankInvestigations, toCSV } from '../lib/rank.js'
import { round } from '../lib/psi.js'
import { Eyebrow, Prov } from '../ui/bits.jsx'

const PILLARS = ['all', 'prevention', 'detection', 'suppression', 'complementary']
const MAX_COMPARE = 4

export default function Library({ kb }) {
  const [target, setTarget] = useState('moon')
  const [weights, setWeights] = useState({})
  const [pillar, setPillar] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState([])
  const [showW, setShowW] = useState(false)

  const ranked = useMemo(() => rankInvestigations(kb, target, weights), [kb, target, weights])
  const rows = ranked.rows
    .map((r, i) => ({ ...r, rank: i + 1 }))
    .filter((r) => (pillar === 'all' || r.node.pillar === pillar) && (!q.trim() || (r.node.acronym + ' ' + r.node.title + ' ' + r.node.fuel_note).toLowerCase().includes(q.trim().toLowerCase())))
  const cmp = sel.length >= 2 ? compareInvestigations(kb, sel) : null
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id]))
  const wmax = Math.max(1, ...Object.values(ranked.weights))

  const exportCsv = () =>
    download(
      `ranking_${target}.csv`,
      toCSV(
        ranked.rows.map((r, i) => ({ rank: i + 1, id: r.id, acronym: r.node.acronym, title: r.node.title, pillar: r.node.pillar, platform: r.node.platform, fuel: r.node.fuel_class, score: round(r.score, 3), ...Object.fromEntries(r.parts.map((p) => ['f_' + p.key, round(p.value, 2)])) })),
        ['rank', 'id', 'acronym', 'title', 'pillar', 'platform', 'fuel', 'score', ...FEATURES.map((f) => 'f_' + f.key)],
      ),
      'text/csv',
    )

  return (
    <div className="page">
      <div className="hero">
        <Eyebrow n="02">Investigations</Eyebrow>
        <h1 className="display">Ranked by <em>relevance</em>,<br />with the working shown.</h1>
        <p className="lede">
          {kb.inv.length} NASA PSI investigations scored for a habitat target. Each score is a weighted mean of seven visible features. The PSI fields are AI-extracted and unreviewed, so every row says so.
        </p>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="seg" role="group" aria-label="Habitat target">
            {TARGETS.map((t) => (
              <button key={t.key} className={target === t.key ? 'on' : ''} onClick={() => { setTarget(t.key); setWeights({}) }}>{t.label}</button>
            ))}
          </div>
          <span className="grow" />
          <button className="btn sm ghost" onClick={() => setShowW((v) => !v)}>{showW ? 'Hide weights' : 'Adjust weights'}</button>
          <button className="btn sm ghost" onClick={exportCsv}>Export CSV</button>
        </div>
        {showW && (
          <div className="whybox" style={{ marginBottom: 14 }}>
            {FEATURES.map((f) => (
              <div key={f.key} className="brk" style={{ gridTemplateColumns: '170px 1fr 30px' }} title={f.hint}>
                <span>{f.label}</span>
                <input type="range" min="0" max="5" step="1" value={ranked.weights[f.key]} onChange={(e) => setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }))} aria-label={f.label + ' weight'} />
                <span className="note num">{ranked.weights[f.key]}</span>
              </div>
            ))}
            <p className="note">Weights start from the target’s defaults. Setting a weight to 0 removes that feature from the score.</p>
          </div>
        )}
        <div className="card-h" style={{ marginBottom: 4 }}>
          <div className="pills">
            {PILLARS.map((p) => (
              <button key={p} className={'pill' + (pillar === p ? ' on' : '')} onClick={() => setPillar(p)}>{p === 'all' ? 'All pillars' : p}</button>
            ))}
          </div>
          <span className="grow" />
          <input className="input" style={{ maxWidth: 240 }} placeholder="Search investigations" aria-label="Search investigations" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {rows.length === 0 && <div className="empty">No investigation matches this filter.</div>}
        {rows.map((r) => {
          const n = r.node
          return (
            <div key={r.id} className="row" style={{ gridTemplateColumns: '24px 32px minmax(0,1fr) auto' }}>
              <input type="checkbox" aria-label={'Compare ' + n.acronym} checked={sel.includes(r.id)} disabled={!sel.includes(r.id) && sel.length >= MAX_COMPARE} onChange={() => toggle(r.id)} />
              <div className="rk">{String(r.rank).padStart(2, '0')}</div>
              <div style={{ minWidth: 0 }}>
                <div className="t">{n.acronym}</div>
                <div className="sub">{n.title}</div>
                <div className="meta">
                  <span className="chip">{n.pillar}</span>
                  <span className="chip">{n.platform}</span>
                  <span className="chip">{n.fuel_class}{n.fuel_note && n.fuel_note !== n.fuel_class ? ': ' + n.fuel_note : ''}</span>
                  {n.has_experimental_table && <span className="chip ok">experimental table</span>}
                  <span className="chip">{n.n_files} files</span>
                  <Prov prov="unreviewed" />
                </div>
                <details className="why">
                  <summary>Why this rank</summary>
                  <div className="whybox">
                    {r.parts.map((p) => (
                      <div key={p.key} className="brk" title={FEATURES.find((f) => f.key === p.key)?.hint}>
                        <span>{p.label} ×{p.weight}</span>
                        <span className="meter"><i style={{ width: p.value * 100 + '%' }} /></span>
                        <span className="note num">{round(p.points * 100, 1)}</span>
                      </div>
                    ))}
                    <p className="note" style={{ marginTop: 8 }}>Bars show each feature (0–1); the number is its contribution to the score. {n.hypothesis ? n.hypothesis.slice(0, 260) + (n.hypothesis.length > 260 ? '\u2026' : '') : ''}</p>
                    {n.doi && <p className="note">DOI {n.doi} · license {n.license || 'not stated'}</p>}
                  </div>
                </details>
              </div>
              <div className="match">
                <b>{Math.round(r.score * 100)}</b>
                <span>SCORE</span>
                <div className="meter"><i style={{ width: (r.score / (ranked.rows[0].score || 1)) * 100 + '%' }} /></div>
              </div>
            </div>
          )
        })}
        <p className="note" style={{ marginTop: 10 }}>Score is relative to {ranked.target.label.toLowerCase()} priorities, not an absolute measure of quality. Keyword counts mean “mentioned in the PSI text”, not “measured”.</p>
      </div>

      <section className="card" id="compare">
        <div className="card-h">
          <Eyebrow n="03">Compare</Eyebrow>
          <span className="grow" />
          <span className="chip">{sel.length} / {MAX_COMPARE}</span>
          {sel.length > 0 && <button className="btn sm ghost" onClick={() => setSel([])}>Clear</button>}
        </div>
        <h3 style={{ fontSize: 22 }}>Same question, different tests.</h3>
        {!cmp && <p className="note" style={{ marginTop: 8 }}>Tick 2–4 investigations above. Differences are highlighted, never averaged away.</p>}
        {cmp && (
          <div className="tbl-wrap" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead>
                <tr><th />{cmp.cols.map((c) => <th key={c.id}>{c.node.acronym}</th>)}</tr>
              </thead>
              <tbody>
                {cmp.groups.map((g) => [
                  <tr key={g.title} className="grp"><td colSpan={cmp.cols.length + 1}>{g.title}</td></tr>,
                  ...g.rows.map((r) => (
                    <tr key={g.title + r.label}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{r.label}</td>
                      {r.values.map((v, i) => <td key={i} className={r.differs ? 'diff' : ''}>{v}</td>)}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
            <p className="note" style={{ marginTop: 8 }}>{cmp.note}</p>
          </div>
        )}
      </section>
    </div>
  )
}
