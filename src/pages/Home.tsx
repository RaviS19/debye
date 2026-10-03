import { Link } from 'react-router-dom'
import { Ring, BadgeIcon } from '../components/Hud'
import { NextSteps, WeekDigest } from '../components/Digest'
import { levelFor, useStore, dueCards, type State } from '../store/store'
import { BADGES } from '../store/badges'
import { READY_TRACKS, TRACK_IDS, TRACKS, lessonsOf, modulesOf, type TrackId } from '../lessons'
import { mastery } from '../lessons/progress'
import { nudge } from '../store/reminders'

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

/** The laser-physics trial: its own module, pinned above everything else on Home. */
function TrialModule({ s }: { s: State }) {
  const lessons = lessonsOf('L')
  if (!lessons.length) return null
  const done = lessons.filter((l) => s.lessons[l.id]?.completed).length
  const next = lessons.find((l) => !s.lessons[l.id]?.completed) ?? lessons[0]
  return (
    <section aria-label="Track L" className="card glow trial">
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <span className="pill violet">New · Trial module</span>
        <span className="dim small">{done} of {count(lessons.length)} done</span>
      </div>
      <h2 style={{ marginTop: 10 }}>Track L · <span style={{ whiteSpace: 'nowrap' }}>{TRACKS.L.name}</span></h2>
      <p className="dim" style={{ marginTop: 0 }}>
        A first taste of the laser physics coming to Debye: how a laser makes light, how locked modes become a pulse train, and what a
        femtosecond pulse is made of. {count(lessons.length).replace(/^./, (c) => c.toUpperCase())} short lessons with live simulations, following Silfvast, Keller and Weiner.
      </p>
      <div className="grid three">
        {lessons.map((l) => (
          <Link key={l.id} to={`/contents#${l.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14, alignItems: 'center' }}>
            <Ring value={mastery(s, l)} size={64} label={l.id} color="#a06fd6" />
            <div>
              <div className="hud-title" style={{ fontSize: 14 }}>{l.title}</div>
              <div className="dim small">{s.lessons[l.id]?.completed ? 'Mastered' : `${Math.round(mastery(s, l) * 100)}% mastered`}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <Link className="btn primary" to={`/learn/${next.id}`}>
          {done === lessons.length ? 'Revisit' : s.lessons[next.id] ? 'Continue' : 'Start'} {next.id} · {next.title}
        </Link>
        <Link className="btn" to="/contents#track-L">See it in the contents</Link>
      </div>
    </section>
  )
}

/** Where every track stands, and the way into the contents: the one place to pick any lesson. */
function ContentsOverview({ s }: { s: State }) {
  const built = READY_TRACKS.reduce((a, t) => a + lessonsOf(t).length, 0)
  return (
    <section aria-label="Contents" className="card contents-overview">
      <div className="card-head">
        <span className="pill">Contents</span>
        <span className="dim small">{built} lessons ready across {count(READY_TRACKS.length)} tracks</span>
      </div>
      {READY_TRACKS.map((t) => {
        const ls = lessonsOf(t)
        const done = ls.filter((l) => s.lessons[l.id]?.completed).length
        return (
          <Link key={t} to={`/contents#track-${t}`} className="overview-row">
            <span className="hud-title">Track {t} · {TRACKS[t].name}</span>
            <span className="meter"><span style={{ width: `${(done / ls.length) * 100}%` }} /></span>
            <span className="kbd">{done} / {ls.length}</span>
          </Link>
        )
      })}
      <Link className="btn primary" to="/contents" style={{ marginTop: 12 }}>Open the contents</Link>
    </section>
  )
}

export function Home() {
  const s = useStore((s) => s)
  const lvl = levelFor(s.xp)
  const due = dueCards().length
  const earned = BADGES.filter((b) => s.badges[b.id])
  const latest = [...earned].sort((a, b) => s.badges[a.id].localeCompare(s.badges[b.id])).slice(-4)

  return (
    <>
      <span className="tag">Mission control</span>
      <h1>Plasma physics</h1>
      <p className="lede">{s.xp === 0 ? 'From a hot gas to fusion and laser plasmas, one interactive lesson at a time.' : nudge()}</p>

      <TrialModule s={s} />

      <div className="grid four">
        <div className="card glow" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <Ring value={lvl.progress} label={String(lvl.index + 1)} color="#a06fd6" />
          <div className="hud-title" style={{ fontSize: 13, marginTop: 8 }}>{lvl.name}</div>
          <div className="dim small">{s.xp} XP{lvl.toNext ? ` · ${lvl.toNext} to next rank` : ''}</div>
        </div>
        <div className="card glow" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <Ring value={Math.min(s.streak.count / 7, 1)} label={String(s.streak.count)} color="#fbbf24" />
          <div className="hud-title" style={{ fontSize: 13, marginTop: 8 }}>Day streak</div>
          <div className="dim small">best {s.streak.best} · {s.streak.freezes} freeze{s.streak.freezes === 1 ? '' : 's'}</div>
        </div>
        <div className="card glow" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <Ring value={due ? 0.15 : 1} label={String(due)} color="#4ade80" />
          <div className="hud-title" style={{ fontSize: 13, marginTop: 8 }}>Cards due</div>
          <Link className="small" to="/review">{due ? 'Review now' : 'All caught up'}</Link>
        </div>
        <div className="card glow" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <Ring value={earned.length / BADGES.length} label={`${earned.length}`} color="#f472b6" />
          <div className="hud-title" style={{ fontSize: 13, marginTop: 8 }}>Badges</div>
          <Link className="small" to="/you">of {BADGES.length}</Link>
        </div>
      </div>

      <TrackBanners s={s} />

      <NextSteps s={s} />

      <WeekDigest s={s} />

      <ContentsOverview s={s} />

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
