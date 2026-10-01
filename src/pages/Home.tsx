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

      {READY_TRACKS.map((t) => (
        <section key={t} aria-label={`Track ${t}`}>
          <h2>Track {t} · <span style={{ whiteSpace: 'nowrap' }}>{TRACKS[t].name}</span></h2>
          <div className="grid three">
            {lessonsOf(t).map((l) => (
              <Link key={l.id} to={`/learn/${l.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14, alignItems: 'center' }}>
                <Ring value={mastery(s, l)} size={64} label={l.id} />
                <div>
                  <div className="hud-title" style={{ fontSize: 14 }}>{l.title}</div>
                  <div className="dim small">{s.lessons[l.id]?.completed ? 'Mastered' : `${Math.round(mastery(s, l) * 100)}% mastered`}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

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
