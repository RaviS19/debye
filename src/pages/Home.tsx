import { useEffect, useState, useTransition, type JSX, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeIcon } from '../components/Hud'
import { NextSteps, WeekDigest } from '../components/Digest'
import { LEVELS, levelFor, useStore, dueCards, type State } from '../store/store'
import { BADGES } from '../store/badges'
import { TRACK_IDS, TRACKS, lessonsOf, modulesOf, type TrackId } from '../lessons'
import type { Lesson } from '../lessons/types'
import { nudge } from '../store/reminders'
import './home.css'

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const count = (n: number) => WORDS[n] ?? String(n)

/** What to say when a track is finished: its scope, and what comes next. */
const TRACK_DONE: Record<TrackId, { title: string; scope: string; next: string }> = {
  L: {
    title: 'Laser trial complete',
    scope: 'trial lessons, from gain and inversion to femtosecond pulses',
    next: 'The full laser tracks (fundamentals, ultrafast, fiber lasers and metrology) are planned next. Meanwhile, Track A starts the plasma physics.',
  },
  A: {
    title: 'Foundations mastered',
    scope: 'core topics, from Debye shielding to fusion',
    next: 'Keep your cards in review; Track B (laser plasmas with Kruer) builds straight on A5, A6, A9 and A10.',
  },
  B: {
    title: 'Laser–plasma mastered',
    scope: 'topics, from light in a density gradient to hot electrons and simulation',
    next: 'Keep your cards in review; Track C, with Gibbon, short-pulse and relativistic plasmas, is next.',
  },
  C: {
    title: 'Short-pulse mastered',
    scope: 'topics on intense, short-pulse and relativistic laser plasmas',
    next: 'That is the whole curriculum. Keep your cards in review to keep it.',
  },
}

const trackDone = (s: State, t: TrackId) => modulesOf(t).every((m) => s.lessons[m.id]?.completed)

/** One banner per finished track, unless the track after it is finished too. */
function TrackBanners({ s }: { s: State }) {
  const done = TRACK_IDS.filter((t, i) => trackDone(s, t) && !(TRACK_IDS[i + 1] && trackDone(s, TRACK_IDS[i + 1])))
  return (
    <>
      {done.map((t) => {
        const info = TRACK_DONE[t]
        const nextTrack = TRACK_IDS[TRACK_IDS.indexOf(t) + 1]
        const nextLesson = nextTrack ? lessonsOf(nextTrack).find((l) => !s.lessons[l.id]?.completed) : undefined
        return (
          <div key={t} className="card glow" style={{ textAlign: 'center' }}>
            <span className="pill lime">Track {t} complete</span>
            <h2 style={{ marginTop: 10 }}>{info.title}</h2>
            <p className="dim">All {count(modulesOf(t).length)} of {TRACKS[t].book}'s {info.scope}. {info.next}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              {nextLesson && (
                <Link className="btn primary" to={`/learn/${nextLesson.id}`}>
                  {s.lessons[nextLesson.id] ? 'Continue' : 'Start'} {nextLesson.id} · {nextLesson.title}
                </Link>
              )}
              {!nextLesson && nextTrack && <Link className="btn primary" to="/map">See the roadmap</Link>}
              <Link className="btn" to="/you">See what you know</Link>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ---------- the two learning paths ----------

interface Planned { id: string; name: string; lessons: number }
interface Path {
  key: 'laser' | 'plasma'
  title: string
  noun: string
  outcome: string
  tracks: TrackId[]
  /** Tracks from the plan that have no modules in the curriculum yet. */
  planned: Planned[]
  Schematic: () => JSX.Element
}

const TRACK_BLURB: Record<TrackId, string> = {
  L: 'Gain, mode-locking, femtosecond pulses',
  A: 'Debye shielding to fusion · Chen',
  B: 'How plasmas absorb intense light · Kruer',
  C: 'Intense fields, wakefields · Gibbon',
}

const PATHS: Path[] = [
  {
    key: 'laser',
    title: 'Laser Physics',
    noun: 'laser',
    outcome: 'How a laser makes light, and how locked modes become femtosecond pulses.',
    tracks: ['L'],
    // The full laser tracks from the laser plan (plans/laser-plan.html).
    planned: [
      { id: 'E', name: 'Laser fundamentals', lessons: 11 },
      { id: 'F', name: 'Ultrafast lasers', lessons: 11 },
      { id: 'G', name: 'Fiber lasers', lessons: 8 },
      { id: 'H', name: 'Pulse metrology', lessons: 9 },
    ],
    Schematic: LaserPulse,
  },
  {
    key: 'plasma',
    title: 'Plasma Physics',
    noun: 'plasma',
    outcome: 'What makes a gas a plasma, how its particles and waves behave, and how lasers drive it.',
    tracks: ['A', 'B', 'C'],
    planned: [],
    Schematic: Gyration,
  },
]

type ChipKind = 'todo' | 'ready' | 'live' | 'done' | 'soon'
const Chip = ({ kind, children }: { kind: ChipKind; children: ReactNode }) => <span className={`hm-chip ${kind}`}>{children}</span>
const Meter = ({ value }: { value: number }) => (
  <span className="hm-meter" aria-hidden="true"><i style={{ transform: `scaleX(${value})` }} /></span>
)

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function trackState(s: State, ls: Lesson[]): [string, ChipKind] {
  const done = ls.filter((l) => s.lessons[l.id]?.completed).length
  if (done === ls.length) return ['Done', 'done']
  if (ls.some((l) => s.lessons[l.id])) return ['In progress', 'live']
  return ['Ready', 'ready']
}

function ReadyTrack({ s, t }: { s: State; t: TrackId }) {
  const ls = lessonsOf(t)
  const done = ls.filter((l) => s.lessons[l.id]?.completed).length
  const [label, kind] = trackState(s, ls)
  return (
    <li className="hm-track">
      <Link
        className="hm-track-row"
        to={`/contents#track-${t}`}
        aria-label={`Track ${t}, ${TRACKS[t].name}: ${done} of ${plural(ls.length, 'lesson')} done, ${label.toLowerCase()}. Show it in the contents.`}
      >
        <span className="hm-tid">{t}</span>
        <span className="hm-tname">{TRACKS[t].name}<small>{TRACK_BLURB[t]}</small></span>
        <span className="hm-tside">
          <span className="hm-tcount"><Meter value={done / ls.length} />{done} / {ls.length}</span>
          <Chip kind={kind}>{label}</Chip>
        </span>
      </Link>
    </li>
  )
}

function ComingTrack({ t }: { t: TrackId }) {
  return (
    <li className="hm-track soon">
      <div className="hm-track-row">
        <span className="hm-tid">{t}</span>
        <span className="hm-tname">{TRACKS[t].name}<small>{TRACK_BLURB[t]}</small></span>
        <span className="hm-tside"><span className="hm-tcount">{modulesOf(t).length} planned</span><Chip kind="soon">Coming</Chip></span>
      </div>
    </li>
  )
}

function PlannedTracks({ planned }: { planned: Planned[] }) {
  return (
    <li className="hm-track soon">
      <div className="hm-track-row">
        <span className="hm-tid">{planned[0].id}–{planned[planned.length - 1].id}</span>
        <span className="hm-tname">
          Full laser curriculum
          <span className="hm-sub">
            {planned.map((p) => [<span key={p.id}><b>{p.id}</b>{p.name}</span>, <span key={`${p.id}-n`}>{p.lessons}</span>])}
          </span>
        </span>
        <span className="hm-tside">
          <span className="hm-tcount">{planned.reduce((a, p) => a + p.lessons, 0)} planned</span>
          <Chip kind="soon">Coming</Chip>
        </span>
      </div>
    </li>
  )
}

function useNarrow(query = '(max-width: 640px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return narrow
}

/** The way into a path. Navigation runs in a transition, so the button shows "Opening…" for as long as the lesson takes to render. */
function PathAction({ lesson, verb }: { lesson?: Lesson; verb: string }) {
  const navigate = useNavigate()
  const [pending, startTransition] = useTransition()
  if (!lesson) return <button className="hm-cta" type="button" disabled>Coming soon</button>
  const to = `/learn/${lesson.id}`
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (!pending) startTransition(() => navigate(to))
  }
  return (
    <Link className="hm-cta" to={to} onClick={go} aria-busy={pending || undefined} aria-disabled={pending || undefined}>
      <span>{pending ? `Opening ${lesson.id}…` : `${verb} ${lesson.id} · ${lesson.title}`}</span>
      <span className="hm-cta-arrow" aria-hidden="true">→</span>
      <span className="hm-cta-bar" aria-hidden="true" />
    </Link>
  )
}

function PathCard({ s, path }: { s: State; path: Path }) {
  const narrow = useNarrow()
  const [open, setOpen] = useState(!narrow)
  useEffect(() => setOpen(!narrow), [narrow])

  const ready = path.tracks.filter((t) => lessonsOf(t).length > 0)
  const unbuilt = path.tracks.filter((t) => lessonsOf(t).length === 0)
  const lessons = ready.flatMap((t) => lessonsOf(t))
  const done = lessons.filter((l) => s.lessons[l.id]?.completed).length
  const begun = lessons.some((l) => s.lessons[l.id])
  const allDone = lessons.length > 0 && done === lessons.length
  const next = lessons.find((l) => !s.lessons[l.id]?.completed) ?? lessons[0]
  const verb = allDone ? 'Revisit' : next && s.lessons[next.id] ? 'Continue' : 'Start'
  const coming = unbuilt.length + path.planned.length

  return (
    <article className={`hm-path ${path.key}`} aria-labelledby={`hm-${path.key}`}>
      <path.Schematic />
      <div className="hm-path-head">
        <h2 id={`hm-${path.key}`}>{path.title}</h2>
        {allDone ? <Chip kind="done">Complete</Chip> : begun ? <Chip kind="live">In progress · {done} of {lessons.length}</Chip> : <Chip kind="todo">Not started</Chip>}
      </div>
      <p className="hm-outcome">{path.outcome}</p>
      <details className="hm-tracks" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary tabIndex={narrow ? 0 : -1} onClick={(e) => { if (!narrow) e.preventDefault() }}>
          <span className="hm-label">Tracks</span>
          <span className="hm-sum">{ready.length} ready{coming ? ` · ${coming} coming` : ''}</span>
        </summary>
        <ul className="hm-track-list">
          {ready.map((t) => <ReadyTrack key={t} s={s} t={t} />)}
          {unbuilt.map((t) => <ComingTrack key={t} t={t} />)}
          {path.planned.length > 0 && <PlannedTracks planned={path.planned} />}
        </ul>
        {ready.length > 0 && <Link className="hm-more" to={`/contents#track-${ready[0]}`}>See every {path.noun} lesson in the contents</Link>}
      </details>
      <div className="hm-actions"><PathAction lesson={next} verb={verb} /></div>
    </article>
  )
}

// ---------- schematics: illustrations, not measurements ----------

/** A few-cycle pulse: Gaussian envelope times a cosine carrier, in the 400×96 schematic frame. */
const PULSE = (() => {
  const x0 = 200, y0 = 50, A = 30, w = 42, lam = 13
  const env = (x: number) => Math.exp(-(((x - x0) / w) ** 2))
  const xs = Array.from({ length: 231 }, (_, i) => x0 - 115 + i)
  const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`).join('')
  const sparse = xs.filter((_, i) => i % 3 === 0)
  return {
    carrier: path(xs.map((x) => [x, y0 - A * env(x) * Math.cos((2 * Math.PI * (x - x0)) / lam)])),
    upper: path(sparse.map((x) => [x, y0 - A * env(x)])),
    lower: path(sparse.map((x) => [x, y0 + A * env(x)])),
    // intensity FWHM of the Gaussian envelope
    fwhm: w * Math.sqrt(2 * Math.LN2),
  }
})()

function LaserPulse() {
  const a = 200 - PULSE.fwhm / 2, b = 200 + PULSE.fwhm / 2
  return (
    <figure className="hm-schematic">
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="hm-laser-fig">
        <title id="hm-laser-fig">Schematic of an ultrashort optical pulse: an oscillating carrier field inside a Gaussian envelope, travelling along z</title>
        <defs>
          <clipPath id="hm-laser-clip"><rect x="16" y="0" width="362" height="96" /></clipPath>
          <marker id="hm-axis-head" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path className="sx-head axis" d="M0 0L6 3L0 6z" /></marker>
        </defs>
        <text className="sx-label" x="16" y="18">OPTICAL PULSE</text>
        <text className="sx-note" x="392" y="18" textAnchor="end">schematic · not to scale</text>
        <line className="sx-axis" x1="16" y1="50" x2="378" y2="50" markerEnd="url(#hm-axis-head)" />
        <text className="sx-tag" x="384" y="54">z</text>
        <g clipPath="url(#hm-laser-clip)">
          <g className="hm-pulse hm-anim">
            <path className="sx-env" d={PULSE.upper} />
            <path className="sx-env" d={PULSE.lower} />
            <path className="sx-accent hm-draw" d={PULSE.carrier} pathLength={1} strokeWidth={1.6} />
            <path className="sx-bracket" d={`M${a.toFixed(1)} 84V90H${b.toFixed(1)}V84`} />
            <text className="sx-tag" x={b + 5} y="93">cΔτ</text>
            <text className="sx-note" x="246" y="33">envelope</text>
            <text className="sx-note" x="258" y="76">carrier</text>
          </g>
        </g>
      </svg>
    </figure>
  )
}

/** Gyration with B out of the page: ions circle clockwise, electrons counterclockwise (each orbit's field opposes B). */
function Gyration() {
  return (
    <figure className="hm-schematic">
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="hm-plasma-fig">
        <title id="hm-plasma-fig">Schematic of gyration in a magnetic field pointing out of the page: an electron circles counterclockwise on a small, fast orbit and an ion circles clockwise on a large, slow orbit</title>
        <defs>
          <marker id="hm-orbit-head" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path className="sx-head" d="M0 0L6 3L0 6z" /></marker>
        </defs>
        <text className="sx-label" x="16" y="18">GYRATION IN B</text>
        <text className="sx-note" x="392" y="18" textAnchor="end">schematic · not to scale</text>

        <circle className="sx-b" cx="80" cy="50" r="3.5" /><circle className="sx-b-dot" cx="80" cy="50" r="1.2" />
        <circle className="sx-accent hm-draw" cx="80" cy="50" r="10" pathLength={1} strokeWidth={1.2} />
        <path className="sx-accent" d="M88.5 35.3A17 17 0 0 0 71.5 35.3" strokeWidth={1.2} markerEnd="url(#hm-orbit-head)" />
        <g className="hm-ele hm-anim"><circle className="sx-dot" cx="90" cy="50" r="3" /></g>
        <text className="sx-tag" x="80" y="78" textAnchor="middle">e⁻</text>

        <circle className="sx-b" cx="165" cy="50" r="3.5" /><circle className="sx-b-dot" cx="165" cy="50" r="1.2" />
        <circle className="sx-accent hm-draw" cx="165" cy="50" r="30" pathLength={1} strokeWidth={1.2} />
        <path className="sx-accent" d="M146.5 18A37 37 0 0 1 183.5 18" strokeWidth={1.2} markerEnd="url(#hm-orbit-head)" />
        <g className="hm-ion hm-anim"><circle className="sx-dot" cx="195" cy="50" r="5" /></g>
        <text className="sx-tag" x="165" y="93" textAnchor="middle">ion⁺</text>

        <text className="sx-note" x="228" y="40"><tspan className="sx-tag">⊙ B</tspan> out of the page</text>
        <text className="sx-note" x="228" y="56">opposite charges gyrate</text>
        <text className="sx-note" x="228" y="70">in opposite senses</text>
      </svg>
    </figure>
  )
}

// ---------- progress console: the learner's own numbers, or an honest empty state ----------

function ProgressConsole({ s }: { s: State }) {
  const lvl = levelFor(s.xp)
  const nextRank = LEVELS[lvl.index + 1]
  const hasCards = Object.keys(s.cards).length > 0
  const due = dueCards().length
  const { count: days, best, freezes } = s.streak
  return (
    <section className="hm-console" aria-labelledby="hm-console">
      <h2 className="hm-label" id="hm-console">Progress · both paths</h2>
      <dl className="hm-readouts">
        <div className="hm-readout">
          <dt className="hm-label">Rank</dt>
          <dd><span className="hm-val">{lvl.name}</span><span className="hm-meta">Rank {lvl.index + 1} of {LEVELS.length}</span></dd>
        </div>
        <div className="hm-readout">
          <dt className="hm-label">XP</dt>
          <dd>
            <span className="hm-val">{s.xp}</span>
            <Meter value={lvl.progress} />
            <span className="hm-meta">{nextRank ? `${lvl.toNext} XP to ${nextRank.name}` : 'Top rank reached'}</span>
          </dd>
        </div>
        <div className="hm-readout">
          <dt className="hm-label">Streak</dt>
          <dd>
            <span className={`hm-val${days ? '' : ' empty'}`}>{plural(days, 'day')}</span>
            <span className="hm-meta">{best ? `Best ${best} · ${plural(freezes, 'freeze')} left` : 'Starts with your first lesson'}</span>
          </dd>
        </div>
        <div className="hm-readout">
          <dt className="hm-label">Cards due</dt>
          <dd>
            <span className={`hm-val${due ? '' : ' empty'}`}>{hasCards ? due : 'None yet'}</span>
            <span className="hm-meta">{!hasCards ? 'Cards appear after your first lesson' : due ? <Link to="/review">Review now</Link> : 'All caught up'}</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}

export function Home() {
  const s = useStore((s) => s)
  const earned = BADGES.filter((b) => s.badges[b.id])
  const latest = [...earned].sort((a, b) => s.badges[a.id].localeCompare(s.badges[b.id])).slice(-4)

  return (
    <>
      <div className="hm">
        <header className="hm-head">
          <span className="hm-label">Mission control</span>
          <h1>Master Physics</h1>
          <p className="hm-lede">{s.xp === 0 ? 'Two separate learning paths, each with its own lessons and progress.' : nudge()}</p>
        </header>
        <ProgressConsole s={s} />
        <div className="hm-paths">
          {PATHS.map((p) => <PathCard key={p.key} s={s} path={p} />)}
        </div>
      </div>

      <TrackBanners s={s} />

      <NextSteps s={s} />

      <WeekDigest s={s} />

      {earned.length > 0 && (
        <>
          <h2>Latest badges</h2>
          <div className="row">
            {latest.map((b) => (
              <div key={b.id} style={{ textAlign: 'center', width: 110 }}>
                <BadgeIcon glyph={b.glyph} size={64} />
                <div className="small">{b.name}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
