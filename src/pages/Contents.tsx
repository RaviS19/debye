// The contents page: the one place to pick any lesson. Inside a lesson you only go on to the next one or back here.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MODULES, TRACK_IDS, TRACKS, lessonById, lessonsOf, modulesOf, type TrackId } from '../lessons'
import type { Lesson, ModuleInfo } from '../lessons/types'
import { mastery, nextSuggestion, status } from '../lessons/progress'
import { withMath } from '../components/Learning'
import { Ring } from '../components/Hud'
import { dueCards, useStore, type State } from '../store/store'

type Filter = 'all' | 'todo' | 'started' | 'mastered'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'Not started' },
  { id: 'started', label: 'In progress' },
  { id: 'mastered', label: 'Mastered' },
]
const TRACK_COLOR: Record<TrackId, string> = { L: '#a06fd6', A: '#22d3ee', B: '#fbbf24', C: '#f472b6' }

const KEY = 'debye-contents'
interface View { q: string; filter: Filter; closed: TrackId[]; open: string | null }
function loadView(): View {
  const empty: View = { q: '', filter: 'all', closed: [], open: null }
  try {
    return { ...empty, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') }
  } catch {
    return empty
  }
}

/** Scroll a lesson's entry into view once it has rendered open. */
function reveal(id: string, block: ScrollLogicalPosition = 'nearest') {
  requestAnimationFrame(() => document.getElementById(`lesson-${id}`)?.scrollIntoView({ block, behavior: 'smooth' }))
}

function bucket(s: State, id: string): Filter | 'coming' {
  const st = status(s, id)
  return st === 'mastered' ? 'mastered' : st === 'started' ? 'started' : st === 'coming' ? 'coming' : 'todo'
}

/** Everything a search can find a lesson by: its id, title, subtitle, objectives, sections and problem concepts. */
function haystack(m: ModuleInfo, l?: Lesson) {
  const parts = [m.id, m.title]
  if (l) parts.push(l.title, l.subtitle, ...l.objectives, ...l.sections.map((x) => x.label), ...l.problems.map((p) => (p.concept ?? '').replace(/-/g, ' ')))
  return parts.join(' ').toLowerCase()
}

export function ContentsPage() {
  const s = useStore((s) => s)
  const { hash } = useLocation()
  const [view, setView] = useState<View>(loadView)
  const { q, filter, closed, open } = view
  const set = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch }))
  /** Open another lesson's entry (a "builds on" link), clearing anything that would hide it. */
  const pick = (id: string) => {
    const track = MODULES.find((m) => m.id === id)!.track
    setView((v) => ({ q: '', filter: 'all', closed: v.closed.filter((t) => t !== track), open: id }))
    reveal(id, 'center')
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(view))
    } catch {
      /* private mode: the view just isn't remembered */
    }
  }, [view])

  // /contents#A3 opens A3 (coming back from a lesson, or a tap on the map); /contents#track-B jumps to a track
  useEffect(() => {
    const target = hash.slice(1)
    if (!target) return
    const mod = MODULES.find((m) => m.id === target)
    const track = target.startsWith('track-') ? (target.slice(6) as TrackId) : mod?.track
    if (!track || !TRACK_IDS.includes(track)) return
    setView((v) => ({
      q: mod ? '' : v.q,
      filter: mod ? 'all' : v.filter,
      closed: v.closed.filter((t) => t !== track),
      open: mod ? mod.id : v.open,
    }))
    requestAnimationFrame(() => document.getElementById(mod ? `lesson-${mod.id}` : `track-${track}`)?.scrollIntoView({ block: mod ? 'center' : 'start' }))
  }, [hash])

  const needle = q.trim().toLowerCase()
  const rows = useMemo(
    () =>
      TRACK_IDS.map((t) => ({
        t,
        mods: modulesOf(t).filter((m) => {
          const b = bucket(s, m.id)
          if (filter !== 'all' && b !== filter) return false
          return !needle || needle.split(/\s+/).every((w) => haystack(m, lessonById(m.id)).includes(w))
        }),
      })),
    [s, filter, needle],
  )
  const shown = rows.reduce((a, r) => a + r.mods.length, 0)
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, todo: 0, started: 0, mastered: 0 }
    for (const m of MODULES) {
      const b = bucket(s, m.id)
      if (b === 'coming') continue
      c.all++
      c[b]++
    }
    return c
  }, [s])
  const tip = nextSuggestion(s)
  const tipLesson = tip ? lessonById(tip.lessonId) : undefined
  const filtering = !!needle || filter !== 'all'

  return (
    <>
      <span className="tag">Contents</span>
      <h1>Pick a lesson</h1>
      <p className="lede">Every lesson in one place. Open one to see what it covers, then start it. Inside a lesson you can go on to the next one or come back here.</p>

      {tipLesson && !filtering && (
        <div className="card glow resume">
          <Ring value={mastery(s, tipLesson)} size={64} label={tipLesson.id} color={TRACK_COLOR[MODULES.find((m) => m.id === tipLesson.id)!.track]} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="tag">{s.lessons[tipLesson.id] ? 'Pick up where you left off' : 'Suggested next'}</div>
            <div className="hud-title" style={{ fontSize: 16 }}>{tipLesson.id} · {tipLesson.title}</div>
            <div className="dim small">{tip!.reason}</div>
          </div>
          <Link className="btn primary" to={`/learn/${tipLesson.id}`}>{s.lessons[tipLesson.id] ? 'Continue' : 'Start'}</Link>
        </div>
      )}

      <div className="contents-tools">
        <input
          type="text"
          inputMode="search"
          aria-label="Search lessons"
          placeholder="Search lessons, ideas or sections…"
          value={q}
          onChange={(e) => set({ q: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && set({ q: '' })}
        />
        <div className="row" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.id} className={`pill chip ${filter === f.id ? '' : 'ghost'}`} aria-pressed={filter === f.id} onClick={() => set({ filter: f.id })}>
              {f.label} <span className="count">{counts[f.id]}</span>
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="btn small" onClick={() => set({ closed: closed.length ? [] : [...TRACK_IDS] })}>{closed.length ? 'Expand all' : 'Collapse all'}</button>
        </div>
      </div>

      {filtering && (
        <p className="dim small" role="status">
          {shown ? `${shown} lesson${shown === 1 ? '' : 's'} match.` : `Nothing matches${needle ? ` “${q.trim()}”` : ''}.`}{' '}
          <button className="linklike" onClick={() => set({ q: '', filter: 'all' })}>Show everything</button>
        </p>
      )}

      {rows.map(({ t, mods }) => {
        if (filtering && !mods.length) return null
        const built = lessonsOf(t)
        const done = built.filter((l) => s.lessons[l.id]?.completed).length
        const total = modulesOf(t).length
        const isOpen = filtering || !closed.includes(t)
        return (
          <section key={t} id={`track-${t}`} className="contents-track" style={{ ['--accent' as string]: TRACK_COLOR[t] }}>
            <button className="track-head" aria-expanded={isOpen} onClick={() => !filtering && set({ closed: isOpen ? [...closed, t] : closed.filter((x) => x !== t) })}>
              <span className="chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="hud-title">Track {t} · {TRACKS[t].name}</span>
                <span className="dim small track-sub">
                  {TRACKS[t].book} · {built.length ? `${done} of ${built.length} mastered` : 'coming in a later phase'}
                  {built.length > 0 && built.length < total ? ` · ${total - built.length} more coming` : ''}
                </span>
              </span>
              {built.length > 0 && (
                <span className="track-bar" aria-hidden="true"><i style={{ width: `${(done / built.length) * 100}%` }} /></span>
              )}
            </button>
            {isOpen && (
              <ol className="lesson-list">
                {mods.map((m) => (
                  <LessonRow key={m.id} s={s} m={m} open={open === m.id} toggle={() => { set({ open: open === m.id ? null : m.id }); if (open !== m.id) reveal(m.id) }} onPick={pick} />
                ))}
              </ol>
            )}
          </section>
        )
      })}
    </>
  )
}

const PILL: Record<Filter | 'coming', { cls: string; text: string }> = {
  all: { cls: 'ghost', text: '' },
  todo: { cls: 'ghost', text: 'Not started' },
  started: { cls: '', text: 'In progress' },
  mastered: { cls: 'lime', text: 'Mastered' },
  coming: { cls: 'ghost', text: 'Coming' },
}

function LessonRow({ s, m, open, toggle, onPick }: { s: State; m: ModuleInfo; open: boolean; toggle: () => void; onPick: (id: string) => void }) {
  const l = lessonById(m.id)
  const b = bucket(s, m.id)
  const unmet = m.prereqs.filter((p) => !s.lessons[p]?.completed)
  if (!l) {
    return (
      <li id={`lesson-${m.id}`} className="lesson-row coming">
        <div className="lesson-row-head" aria-disabled="true">
          <Ring value={0} size={52} label={m.id} color={TRACK_COLOR[m.track]} />
          <span className="lesson-row-text"><span className="hud-title">{m.title}</span><span className="dim small">On the roadmap, not built yet</span></span>
          <span className={`pill ${PILL.coming.cls}`}>{PILL.coming.text}</span>
        </div>
      </li>
    )
  }

  const solved = l.problems.filter((p) => s.problems[p.id]?.solved).length
  const due = dueCards(l.cards.map((c) => c.id)).length
  const v = mastery(s, l)
  return (
    <li id={`lesson-${m.id}`} className={`lesson-row ${open ? 'open' : ''}`}>
      <button className="lesson-row-head" aria-expanded={open} aria-controls={`detail-${m.id}`} onClick={toggle}>
        <Ring value={v} size={52} label={m.id} color={TRACK_COLOR[m.track]} />
        <span className="lesson-row-text">
          <span className="hud-title">{l.title}</span>
          <span className="dim small subtitle">{l.subtitle}</span>
        </span>
        <span className="lesson-row-meta">
          <span className={`pill ${PILL[b].cls}`}>{PILL[b].text}</span>
          <span className="kbd">~{l.minutes} min</span>
        </span>
        <span className="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="lesson-detail" id={`detail-${m.id}`}>
          <div className="lesson-detail-grid">
            <div>
              <div className="tag">You will be able to</div>
              <ul className="objectives">
                {l.objectives.map((o) => <li key={o} dangerouslySetInnerHTML={{ __html: withMath(o) }} />)}
              </ul>
              {l.refs[0] && <div className="ref">Read alongside: {l.refs[0]}</div>}
            </div>
            <div>
              <div className="tag">Inside</div>
              <div className="row section-chips">
                {l.sections.map((sec) => (
                  <Link key={sec.id} className="pill ghost chip" to={`/learn/${l.id}#${sec.id}`}>{sec.label}</Link>
                ))}
              </div>
              <div className="small dim" style={{ marginTop: 10 }}>
                {solved} of {l.problems.length} problems solved · {Math.round(v * 100)}% mastered
                {due > 0 ? ` · ${due} card${due === 1 ? '' : 's'} due` : ''}
              </div>
              {m.prereqs.length > 0 && (
                <div className="small" style={{ marginTop: 8 }}>
                  <span className="dim">Builds on </span>
                  {m.prereqs.map((p, i) => (
                    <span key={p}>
                      {i > 0 && ', '}
                      <button className="linklike" onClick={() => onPick(p)} title={MODULES.find((x) => x.id === p)!.title}>
                        {p}{s.lessons[p]?.completed ? ' ✓' : ''}
                      </button>
                    </span>
                  ))}
                  {unmet.length > 0 && b !== 'mastered' && <span className="dim"> (not mastered yet: fine to start, a quick pass there first helps)</span>}
                </div>
              )}
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn primary" to={`/learn/${l.id}`}>{b === 'mastered' ? 'Revisit' : b === 'started' ? 'Continue' : 'Start'} {l.id}</Link>
            {b !== 'todo' && <Link className="btn" to={`/learn/${l.id}#problems`}>Problems</Link>}
          </div>
        </div>
      )}
    </li>
  )
}
