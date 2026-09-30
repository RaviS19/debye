import { Link } from 'react-router-dom'
import { Ring, BadgeIcon } from '../components/Hud'
import { NextSteps, WeekDigest } from '../components/Digest'
import { levelFor, useStore, dueCards } from '../store/store'
import { BADGES, TRACK_A } from '../store/badges'
import { LESSONS } from '../lessons'
import { mastery } from '../lessons/progress'
import { nudge } from '../store/reminders'

export function Home() {
  const s = useStore((s) => s)
  const lvl = levelFor(s.xp)
  const due = dueCards().length
  const earned = BADGES.filter((b) => s.badges[b.id])
  const trackDone = TRACK_A.every((id) => s.lessons[id]?.completed)

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

      {trackDone && (
        <div className="card glow" style={{ textAlign: 'center' }}>
          <span className="pill lime">Track A complete</span>
          <h2 style={{ marginTop: 10 }}>Foundations mastered</h2>
          <p className="dim">All eleven of Chen's core topics, from Debye shielding to fusion. Keep your cards in review; Track B (laser plasmas with Kruer) builds straight on A5, A6, A9 and A10.</p>
          <Link className="btn" to="/you">See what you know</Link>
        </div>
      )}

      <NextSteps s={s} />

      <WeekDigest s={s} />

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
