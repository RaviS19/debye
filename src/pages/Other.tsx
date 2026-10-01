import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { COMING_TRACKS, MODULES, READY_TRACKS, TRACKS, TRACK_IDS, LESSONS, listJoin, tracksPhrase } from '../lessons'
import { nextSuggestion, status } from '../lessons/progress'
import { PLOTS, plotById } from '../lessons/plots'
import { Plotter } from '../components/Plotter'
import { FlashcardView } from '../components/Learning'
import { Ring } from '../components/Hud'
import { dueCards, ensureCards, resetAll, setState, useStore } from '../store/store'
import { exportCode, importCode, setSyncEnabled, useSyncStatus } from '../store/sync'
import { rhythm } from '../learner/digest'
import { downloadIcs, googleCalendarUrl, requestNotifications } from '../store/reminders'
import { tex } from '../components/Eq'
import { TutorModelCard } from '../tutor/ModelSettings'

// ---------- concept map ----------
// One row per track. Each later row starts under the lesson it branches from (Track B leaves Track A after A6),
// so the cross-track prerequisites (A6, A9, A10 into B; B into C) run short and downwards instead of across the map.
const COL_W = 112
const ROWS = { A: { y: 86, x0: 56 }, B: { y: 221, x0: 560 }, C: { y: 356, x0: 672 } }
const nodePos = (id: string) => {
  const m = MODULES.find((x) => x.id === id)!
  return { x: ROWS[m.track].x0 + (+m.id.slice(1) - 1) * COL_W, y: ROWS[m.track].y }
}
const MAP_W = Math.max(...MODULES.map((m) => nodePos(m.id).x)) + 74
const MAP_H = ROWS.C.y + 70

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
  const pos = nodePos
  // On a narrow screen the map scrolls sideways: start with the lesson you are on (or should open next) in view.
  const wrapRef = useRef<HTMLDivElement>(null)
  const focus = nextSuggestion(s)?.lessonId
  useEffect(() => {
    const w = wrapRef.current
    if (!w || !focus) return
    const x = nodePos(focus).x
    if (x > w.clientWidth - 80) w.scrollLeft = x - w.clientWidth / 2
    // only when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /** Edge path: along a row, node to node (arcing over any node it skips); between rows, from under the title down to the node. */
  const edge = (from: string, to: string) => {
    const a = pos(from)
    const b = pos(to)
    if (a.y === b.y) {
      if (b.x - a.x <= COL_W) return `M${a.x + 24} ${a.y} L${b.x - 24} ${b.y}`
      return `M${a.x + 17} ${a.y - 17} Q${(a.x + b.x) / 2} ${a.y - 62} ${b.x - 17} ${b.y - 17}`
    }
    const y0 = a.y + 42 + (wrap(MODULES.find((m) => m.id === from)!.title).length - 1) * 13 + 8
    const y1 = b.y - 26
    const ym = (y0 + y1) / 2
    return `M${a.x} ${y0} C${a.x} ${ym}, ${b.x} ${ym}, ${b.x} ${y1}`
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
      <p className="lede">
        Nodes light up as you master them. Tap any node to open it. {tracksPhrase(READY_TRACKS)} {READY_TRACKS.length === 1 ? 'is' : 'are'} ready
        {COMING_TRACKS.length ? `; ${listJoin(COMING_TRACKS.map((t) => `${READY_TRACKS.includes(t) ? 'the rest of ' : ''}Track ${t}`))} ${COMING_TRACKS.length === 1 ? 'is' : 'are'} on the roadmap.` : '.'}
      </p>
      <div className="card glow map-wrap" ref={wrapRef}>
        <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="Map of curriculum modules">
          {TRACK_IDS.map((t) => (
            <g key={t}>
              <text x="6" y={ROWS[t].y - 50} fill="#869fb2" fontSize="12" fontFamily="Exo" letterSpacing="2">
                TRACK {t} · {TRACKS[t].name.toUpperCase()} · {TRACKS[t].book.toUpperCase()}
              </text>
              {/* a faint rail from the heading to a row that starts further right */}
              {ROWS[t].x0 > 100 && <path d={`M8 ${ROWS[t].y} H${ROWS[t].x0 - 32}`} stroke="#1c2c48" strokeWidth="1.4" strokeDasharray="2 6" strokeLinecap="round" />}
            </g>
          ))}
          {MODULES.flatMap((m) =>
            m.prereqs.map((p) => {
              const lit = s.lessons[p]?.completed && status(s, m.id) !== 'coming'
              const cross = MODULES.find((x) => x.id === p)!.track !== m.track
              return (
                <path key={`${p}-${m.id}`} d={edge(p, m.id)} fill="none" stroke={lit ? '#22d3ee' : cross ? '#3b5680' : '#1c2c48'} strokeWidth={lit ? 2 : 1.4} strokeDasharray={cross ? '6 4' : undefined} />
              )
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
        <span className="dim">
          <svg width="28" height="8" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}><path d="M0 4 H28" stroke="#4b6284" strokeWidth="1.6" strokeDasharray="6 4" /></svg>
          Builds on another track
        </span>
        {COMING_TRACKS.length > 0 && (
          <span className="dim">
            Grey: {listJoin(COMING_TRACKS.map((t) => `${READY_TRACKS.includes(t) ? 'the rest of ' : ''}Track ${t} (${TRACKS[t].book})`))}, coming in {COMING_TRACKS.length === 1 ? 'a later phase' : 'later phases'}
          </span>
        )}
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
          <button className="btn" onClick={() => ensureCards(all.map((c) => c.id))}>Add every lesson's cards</button>
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
        <Plotter key={spec.id} spec={spec} />
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
        <BestTime />
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
              Pops up at your time while Debye is open or installed as an app. For reminders when it is closed, use the calendar alarm.
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

      <TutorModelCard />

      <SyncCard />

      <div className="card">
        <div className="card-head"><span className="pill ghost">Your data</span></div>
        <ResetButton />
      </div>
    </>
  )
}

function BestTime() {
  const s = useStore((s) => s)
  const r = rhythm(s)
  if (r.bestHour === null) return null
  const t = `${String(r.bestHour).padStart(2, '0')}:00`
  if (s.reminder.time === t) return <p className="small" style={{ marginTop: 10 }}>This matches when you usually study.</p>
  return (
    <p className="small" style={{ marginTop: 10 }}>
      You usually study around <b>{t}</b>.{' '}
      <button className="btn small" onClick={() => setState((st) => { st.reminder = { ...st.reminder, time: t } })}>Use {t}</button>
    </p>
  )
}

const SYNC_TEXT: Record<string, string> = {
  connecting: 'Connecting…',
  synced: 'On. Progress on your other devices merges in automatically.',
  saving: 'Saving…',
  off: 'Off. Progress stays on this device.',
}

function SyncCard() {
  const enabled = useStore((s) => s.sync.enabled)
  const st = useSyncStatus()
  const [code, setCode] = useState('')
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <div className="card">
      <div className="card-head"><span className="pill">Sync and transfer</span></div>
      {st.state === 'unavailable' ? (
        <p className="small dim">Progress is saved in this browser. Automatic sync works when Debye is opened on claude.ai while signed in; here, use a progress code below to move progress between devices.</p>
      ) : (
        <>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
            Sync my progress across devices
          </label>
          <p className="small" style={{ marginTop: 8 }}>
            {st.state === 'error' ? st.detail : SYNC_TEXT[st.state]}
          </p>
          <p className="small dim">Synced progress is private to your claude.ai account: nobody else who opens Debye can see it. XP, streaks, lessons, problems, flashcard schedules and your study history travel; reminders and display settings stay on each device.</p>
        </>
      )}
      <h3>Progress code</h3>
      <p className="small dim">Copy a code here and paste it on another device (or into the Android app later). Pasting merges: nothing already on that device is lost.</p>
      <div className="row">
        <button className="btn small" onClick={async () => {
          const c = await exportCode()
          setCode(c)
          try {
            await navigator.clipboard.writeText(c)
            setMsg({ ok: true, text: 'Code copied to your clipboard.' })
          } catch {
            setMsg({ ok: true, text: 'Select the code below and copy it.' })
          }
        }}>Create a code</button>
      </div>
      {code && <textarea readOnly value={code} rows={3} className="code-box" onFocus={(e) => e.target.select()} aria-label="Your progress code" />}
      <div className="row" style={{ marginTop: 10 }}>
        <input type="text" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a code from another device" style={{ flex: 1, minWidth: 180 }} aria-label="Progress code to import" />
        <button className="btn small" disabled={!paste.trim()} onClick={async () => {
          try {
            await importCode(paste)
            setPaste('')
            setMsg({ ok: true, text: 'Progress merged into this device.' })
          } catch (e) {
            setMsg({ ok: false, text: (e as Error).message || 'That code could not be read.' })
          }
        }}>Merge it in</button>
      </div>
      {msg && <div className={`feedback ${msg.ok ? 'good' : 'bad'}`}>{msg.text}</div>}
    </div>
  )
}

function ResetButton() {
  const [armed, setArmed] = useState(false)
  const synced = useStore((s) => s.sync.enabled)
  if (!armed)
    return (
      <button className="btn small" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => setArmed(true)}>
        Reset all progress
      </button>
    )
  return (
    <div className="row">
      <span className="small">Erase all XP, badges, cards and progress{synced ? ', here and on your synced devices' : ' on this device'}?</span>
      <button className="btn small" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => { resetAll(); setArmed(false) }}>
        Erase everything
      </button>
      <button className="btn small" onClick={() => setArmed(false)}>Cancel</button>
    </div>
  )
}
