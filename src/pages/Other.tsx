import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MODULES, TRACKS, LESSONS } from '../lessons'
import { status } from '../lessons/progress'
import { PLOTS, plotById } from '../lessons/plots'
import { Plotter } from '../components/Plotter'
import { FlashcardView } from '../components/Learning'
import { BadgeIcon, Ring } from '../components/Hud'
import { BADGES } from '../store/badges'
import { LEVELS, dueCards, ensureCards, levelFor, resetAll, setState, useStore } from '../store/store'
import { downloadIcs, googleCalendarUrl, requestNotifications } from '../store/reminders'
import { tex } from '../components/Eq'

// ---------- concept map ----------
const COLS: Record<string, number> = {}
MODULES.forEach((m) => (COLS[m.id] = +m.id.slice(1)))
const ROW_Y = { A: 70, B: 205, C: 340 }

/** Split a title into at most two lines of ~15 characters. */
function wrap(t: string): string[] {
  if (t.length <= 15) return [t]
  const words = t.split(' ')
  let a = ''
  while (words.length && (a + ' ' + words[0]).trim().length <= 15) a = (a + ' ' + words.shift()).trim()
  const b = words.join(' ')
  return [a || b.slice(0, 15), b.length > 16 ? b.slice(0, 15) + '…' : b].filter(Boolean)
}

export function MapPage() {
  const s = useStore((s) => s)
  const nav = useNavigate()
  const pos = (id: string) => {
    const m = MODULES.find((x) => x.id === id)!
    return { x: 56 + (COLS[id] - 1) * 112 + (m.track === 'B' ? 56 : m.track === 'C' ? 112 : 0), y: ROW_Y[m.track] }
  }
  const style = {
    mastered: { stroke: '#8fffff', fill: 'rgba(34,211,238,0.35)', glow: 'drop-shadow(0 0 10px #22d3ee)', text: '#fff' },
    started: { stroke: '#22d3ee', fill: 'rgba(34,211,238,0.12)', glow: 'drop-shadow(0 0 5px #22d3ee)', text: '#e8eaf6' },
    available: { stroke: '#22d3ee', fill: 'transparent', glow: 'none', text: '#e8eaf6' },
    locked: { stroke: '#869fb2', fill: 'transparent', glow: 'none', text: '#9aa0c9' },
    coming: { stroke: '#314c72', fill: 'transparent', glow: 'none', text: '#4b6284' },
  }
  return (
    <>
      <span className="tag">Concept map</span>
      <h1>The curriculum</h1>
      <p className="lede">Nodes light up as you master them. Tap an unlit node to open it. Phase 1 covers A1 to A3; the rest are on the roadmap.</p>
      <div className="card glow map-wrap">
        <svg width="1360" height="410" viewBox="0 0 1360 410" role="img" aria-label="Map of curriculum modules">
          {(['A', 'B', 'C'] as const).map((t) => (
            <text key={t} x="6" y={ROW_Y[t] - 44} fill="#869fb2" fontSize="12" fontFamily="Exo" letterSpacing="2">
              TRACK {t} · {TRACKS[t].name.toUpperCase()} · {TRACKS[t].book.toUpperCase()}
            </text>
          ))}
          {MODULES.flatMap((m) =>
            m.prereqs.map((p) => {
              const a = pos(p)
              const b = pos(m.id)
              const lit = s.lessons[p]?.completed
              return <path key={`${p}-${m.id}`} d={`M${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke={lit ? '#22d3ee' : '#1c2c48'} strokeWidth={lit ? 2 : 1.2} />
            }),
          )}
          {MODULES.map((m) => {
            const p = pos(m.id)
            const st = status(s, m.id)
            const c = style[st]
            return (
              <g key={m.id} className="map-node" onClick={() => nav(`/learn/${m.id}`)} style={{ filter: c.glow }}>
                <circle cx={p.x} cy={p.y} r="24" fill={c.fill} stroke={c.stroke} strokeWidth="2" />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fill={c.text} fontSize="14" fontWeight="700">{m.id}</text>
                {wrap(m.title).map((line, i) => (
                  <text key={i} x={p.x} y={p.y + 42 + i * 13} textAnchor="middle" fill={c.text} fontSize="11" fontFamily="PT Sans, sans-serif">{line}</text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="row small dim">
        <span className="pill">Mastered</span>
        <span className="pill ghost">Available</span>
        <span className="dim">Grey: coming in later phases</span>
      </div>
    </>
  )
}

// ---------- review ----------
export function ReviewPage() {
  useStore((s) => s.reviews)
  const all = LESSONS.flatMap((l) => l.cards)
  const due = dueCards()
  const card = all.find((c) => c.id === due[0])
  const [session, setSession] = useState(0)
  return (
    <>
      <span className="tag">Spaced repetition · FSRS</span>
      <h1>Review</h1>
      <p className="lede">Cards come back just before you would forget them. Grade yourself honestly; the schedule adapts to your memory.</p>
      {card ? (
        <>
          <div className="dim small">{due.length} due · {session} reviewed this session</div>
          <FlashcardView key={card.id + session} card={card} onDone={() => setSession((n) => n + 1)} />
        </>
      ) : (
        <div className="card glow" style={{ textAlign: 'center' }}>
          <Ring value={1} label="✓" color="#4ade80" />
          <h2>All caught up</h2>
          <p className="dim">Nothing is due right now. Open a lesson to add its cards to your deck, or come back later.</p>
          <button className="btn" onClick={() => ensureCards(all.map((c) => c.id))}>Add every Phase 1 card</button>
        </div>
      )}
    </>
  )
}

// ---------- plotter ----------
export function PlotPage() {
  const { id } = useParams()
  const spec = id ? plotById(id) : undefined
  if (spec)
    return (
      <>
        <Link className="btn small" to="/plot">← All plots</Link>
        <h1 style={{ marginTop: 14 }}>{spec.title}</h1>
        <Plotter spec={spec} />
      </>
    )
  return (
    <>
      <span className="tag">Equation plotter</span>
      <h1>Plot the physics</h1>
      <p className="lede">Every key equation, live. Drag the sliders, pinch or scroll to zoom, drag to pan, tap the curve for values.</p>
      <div className="grid two">
        {PLOTS.map((p) => (
          <Link key={p.id} to={`/plot/${p.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="hud-title" style={{ fontSize: 14 }}>{p.title}</div>
            {p.equation && <div className="eq-block" style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: tex(p.equation) }} />}
          </Link>
        ))}
      </div>
    </>
  )
}

// ---------- progress ----------
export function ProgressPage() {
  const s = useStore((s) => s)
  const lvl = levelFor(s.xp)
  const solved = Object.values(s.problems).filter((p) => p.solved).length
  const firstTry = Object.values(s.problems).filter((p) => p.firstTry).length
  return (
    <>
      <span className="tag">Progress</span>
      <h1>{lvl.name}</h1>
      <p className="lede">Rank {lvl.index + 1} of {LEVELS.length} · {s.xp} XP</p>
      <div className="grid four">
        <Stat label="Problems solved" v={solved} />
        <Stat label="First-try" v={firstTry} />
        <Stat label="Cards reviewed" v={s.reviews} />
        <Stat label="Days studied" v={s.studyDays.length} />
      </div>
      <h2>Ranks</h2>
      <div className="card">
        {LEVELS.map((l, i) => (
          <div key={l.name} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', color: i <= lvl.index ? 'var(--glow)' : 'var(--text-dim)' }}>
            <span>{i + 1}. {l.name}</span>
            <span className="kbd">{l.xp} XP</span>
          </div>
        ))}
      </div>
      <h2>Badges</h2>
      <div className="grid three">
        {BADGES.map((b) => {
          const got = s.badges[b.id]
          return (
            <div key={b.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', opacity: got ? 1 : 0.7 }}>
              <BadgeIcon glyph={b.glyph} earned={!!got} size={64} />
              <div>
                <div className="hud-title" style={{ fontSize: 13 }}>{b.name}</div>
                <div className="small dim">{b.blurb}</div>
                {got && <div className="kbd">{new Date(got).toLocaleDateString()}</div>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="dim small">XP: lesson mastered +50 · problem first try +20 (later tries +10) · derivation +15 · new simulation +5 · flashcard +2.</p>
    </>
  )
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--glow)', textShadow: '0 0 12px #22d3ee' }}>{v}</div>
      <div className="tag">{label}</div>
    </div>
  )
}

// ---------- settings ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SettingsPage() {
  const s = useStore((s) => s)
  const [perm, setPerm] = useState<string>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const r = s.reminder
  const update = (patch: Partial<typeof r>) => setState((st) => { st.reminder = { ...st.reminder, ...patch } })
  return (
    <>
      <span className="tag">Settings</span>
      <h1>Reminders & comfort</h1>

      <div className="card glow">
        <div className="card-head"><span className="pill">Study reminder</span></div>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={r.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
          Remind me to study
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="dim">at</span>
          <input type="time" value={r.time} onChange={(e) => update({ time: e.target.value })} aria-label="Reminder time" />
        </div>
        <div className="row" style={{ marginTop: 12, gap: 6 }}>
          {DAYS.map((d, i) => (
            <button key={d} className={`btn small ${r.days.includes(i) ? 'primary' : ''}`} onClick={() => update({ days: r.days.includes(i) ? r.days.filter((x) => x !== i) : [...r.days, i] })}>
              {d}
            </button>
          ))}
        </div>
        <p className="dim small" style={{ marginTop: 14 }}>
          Reminders only fire on days you have not studied yet, and a missed day never costs you more than the streak (one missed day is covered by a streak freeze, earned every 7 days).
        </p>
        <h3>How you get reminded</h3>
        <div className="grid two">
          <div className="card">
            <strong>Calendar alarm</strong> <span className="pill lime" style={{ marginLeft: 6 }}>Most reliable</span>
            <p className="small dim" style={{ marginTop: 8 }}>Adds a repeating event with an alarm to your phone or computer calendar. Works even when the app is closed.</p>
            <div className="row">
              <a className="btn primary" href={googleCalendarUrl(r, location.href.split('#')[0])} target="_blank" rel="noopener">Google Calendar</a>
              <button className="btn" onClick={() => downloadIcs(r)}>Download .ics</button>
            </div>
          </div>
          <div className="card">
            <strong>Notifications</strong>
            <p className="small dim" style={{ marginTop: 8 }}>
              Pops up at your time while Debye is open or installed. Full background push comes with the sync server in Phase 3.
            </p>
            {perm === 'granted' ? (
              <span className="pill lime">Allowed</span>
            ) : perm === 'unsupported' ? (
              <span className="pill ghost">Not supported here</span>
            ) : (
              <button className="btn" onClick={async () => setPerm(await requestNotifications())}>Allow notifications</button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="pill violet">Comfort</span></div>
        <div className="ctrl" style={{ maxWidth: 320 }}>
          <label><span>Glow intensity</span><b>{Math.round(s.glow * 100)}%</b></label>
          <input type="range" min={0} max={1.5} step={0.05} value={s.glow} onChange={(e) => setState((st) => { st.glow = +e.target.value })} aria-label="Glow intensity" />
        </div>
        <label className="row" style={{ marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.sound} onChange={(e) => setState((st) => { st.sound = e.target.checked })} />
          Celebration sounds
        </label>
      </div>

      <div className="card">
        <div className="card-head"><span className="pill ghost">Your data</span></div>
        <p className="small dim">Everything is stored on this device only. Nothing is uploaded.</p>
        <ResetButton />
      </div>
    </>
  )
}

function ResetButton() {
  const [armed, setArmed] = useState(false)
  if (!armed)
    return (
      <button className="btn small" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => setArmed(true)}>
        Reset all progress
      </button>
    )
  return (
    <div className="row">
      <span className="small">Erase all XP, badges, cards and progress on this device?</span>
      <button className="btn small" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => { resetAll(); setArmed(false) }}>
        Erase everything
      </button>
      <button className="btn small" onClick={() => setArmed(false)}>Cancel</button>
    </div>
  )
}
