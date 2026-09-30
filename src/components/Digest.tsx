// The weekly digest (Home and the You page) and the next-step suggestions.
import { Link } from 'react-router-dom'
import type { State } from '../store/store'
import { LESSONS, MODULES, lessonById } from '../lessons'
import { fadingLessons, suggestions, weakSpots, weekStats, type Suggestion } from '../learner/digest'

const DAY = 86400000

function lastSevenDays(days: string[]) {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    out.push({ key, label: 'SMTWTFS'[d.getDay()], done: days.includes(key) })
  }
  return out
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null
  if (!before) return <span className="delta up">new</span>
  const d = now - before
  if (!d) return <span className="delta">same as last week</span>
  // Only gains get an arrow; a quieter week is shown as a plain fact, not a warning.
  return d > 0 ? <span className="delta up">▲ {d} vs last week</span> : <span className="delta">last week {before}</span>
}

export function WeekDigest({ s }: { s: State }) {
  const week = weekStats(s, LESSONS)
  const prev = weekStats(s, LESSONS, Date.now() - 7 * DAY)
  const weak = weakSpots(s, LESSONS, 4)
  const fading = fadingLessons(s, LESSONS).slice(0, 2)
  const dots = lastSevenDays(s.studyDays)
  const quiet = week.xp === 0 && prev.xp === 0
  return (
    <div className="card">
      <div className="card-head">
        <span className="pill ghost">Your week</span>
        {week.mastered.length > 0 && <span className="pill lime">Mastered {week.mastered.join(', ')}</span>}
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {dots.map((d) => (
          <div key={d.key} style={{ textAlign: 'center', flex: 1 }}>
            <div className={`day-dot ${d.done ? 'on' : ''}`} />
            <div className="kbd" style={{ marginTop: 4 }}>{d.label}</div>
          </div>
        ))}
      </div>
      {!quiet && (
        <div className="digest-stats">
          <div><b>{week.xp}</b><span>XP</span><Delta now={week.xp} before={prev.xp} /></div>
          <div><b>{week.solved}</b><span>problems solved</span><Delta now={week.solved} before={prev.solved} /></div>
          <div><b>{week.reviews}</b><span>cards reviewed</span><Delta now={week.reviews} before={prev.reviews} /></div>
          <div><b>{week.minutes}</b><span>minutes studied</span><Delta now={week.minutes} before={prev.minutes} /></div>
        </div>
      )}
      {(weak.length > 0 || fading.length > 0) && (
        <>
          <div className="tag" style={{ marginTop: 14 }}>Worth another look</div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {weak.map((w) => (
              <Link key={w.concept} className="pill ghost chip" to={`/learn/${w.lessonId}#problems`} title={w.reason}>
                {w.label} · {w.lessonId}
              </Link>
            ))}
            {fading.map((f) => (
              <Link key={f.lessonId} className="pill ghost chip" to="/review">
                {f.lessonId} cards fading
              </Link>
            ))}
          </div>
        </>
      )}
      {quiet && <p className="dim small" style={{ marginBottom: 0 }}>Your weekly summary appears here once you start: XP, problems, reviews, minutes and the ideas worth another look.</p>}
    </div>
  )
}

const KIND_PILL: Record<Suggestion['kind'], string> = { continue: 'Continue', next: 'Next up', prep: 'Warm-up', revisit: 'Revisit' }

export function NextSteps({ s }: { s: State }) {
  const list = suggestions(s, LESSONS, MODULES)
  if (!list.length) return null
  const [first, ...rest] = list
  const l = lessonById(first.lessonId)!
  return (
    <>
      <div className="card glow">
        <div className="card-head">
          <span className="pill">{KIND_PILL[first.kind]}</span>
          <span className="tag">{l.id} · {l.minutes} min</span>
        </div>
        <h2 style={{ marginTop: 0 }}>{l.title}</h2>
        <p className="dim">{l.subtitle}. {first.reason}</p>
        <Link className="btn primary" to={`/learn/${l.id}${first.kind === 'revisit' ? '#problems' : ''}`}>{s.lessons[l.id] ? 'Continue' : 'Start lesson'}</Link>
      </div>
      {rest.length > 0 && (
        <div className="grid two">
          {rest.map((x) => (
            <Link key={x.lessonId + x.kind} to={`/learn/${x.lessonId}${x.kind === 'revisit' ? '#problems' : ''}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="pill ghost">{KIND_PILL[x.kind]}</span>
              <div className="hud-title" style={{ fontSize: 14, marginTop: 8 }}>{x.title}</div>
              <div className="small dim" style={{ marginTop: 4 }}>{x.reason}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
