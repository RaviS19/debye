import { Link } from 'react-router-dom'
import { Ring, BadgeIcon } from '../components/Hud'
import { levelFor, useStore, dueCards } from '../store/store'
import { BADGES } from '../store/badges'
import { LESSONS, lessonById } from '../lessons'
import { mastery, nextSuggestion } from '../lessons/progress'
import { nudge } from '../store/reminders'

export function Home() {
  const s = useStore((s) => s)
  const lvl = levelFor(s.xp)
  const next = nextSuggestion(s)
  const nextLesson = next && lessonById(next.lessonId)
  const due = dueCards().length
  const earned = BADGES.filter((b) => s.badges[b.id])
  const week = lastSevenDays(s.studyDays)

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
          <Link className="small" to="/progress">of {BADGES.length}</Link>
        </div>
      </div>

      {nextLesson && (
        <div className="card glow">
          <div className="card-head">
            <span className="pill">Next up</span>
            <span className="tag">{nextLesson.id} · {nextLesson.minutes} min</span>
          </div>
          <h2 style={{ marginTop: 0 }}>{nextLesson.title}</h2>
          <p className="dim">{nextLesson.subtitle}. {next.reason}</p>
          <Link className="btn primary" to={`/learn/${nextLesson.id}`}>{s.lessons[nextLesson.id] ? 'Continue' : 'Start lesson'}</Link>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <span className="pill ghost">This week</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {week.map((d) => (
            <div key={d.key} style={{ textAlign: 'center', flex: 1 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  margin: '0 auto',
                  borderRadius: '50%',
                  border: '1px solid var(--line-strong)',
                  background: d.done ? 'radial-gradient(circle, #8fffff, #22d3ee 60%, transparent 70%)' : 'transparent',
                  boxShadow: d.done ? '0 0 12px #22d3ee' : 'none',
                }}
              />
              <div className="kbd" style={{ marginTop: 4 }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <h2>Track A · Foundations</h2>
      <div className="grid three">
        {LESSONS.map((l) => (
          <Link key={l.id} to={`/learn/${l.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14, alignItems: 'center' }}>
            <Ring value={mastery(s, l)} size={64} label={l.id} />
            <div>
              <div className="hud-title" style={{ fontSize: 14 }}>{l.title}</div>
              <div className="dim small">{s.lessons[l.id]?.completed ? 'Mastered' : `${Math.round(mastery(s, l) * 100)}% mastered`}</div>
            </div>
          </Link>
        ))}
      </div>

      {earned.length > 0 && (
        <>
          <h2>Latest badges</h2>
          <div className="row">
            {earned.slice(-4).map((b) => (
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
