// "You": rank, weekly digest, and what the learner model has worked out (concepts, answer patterns,
// memory curve, study rhythm, predictions), then badges. Every number here comes from this learner's own data.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BadgeIcon } from '../components/Hud'
import { WeekDigest } from '../components/Digest'
import { BADGES } from '../store/badges'
import { FSRS_W, LEVELS, levelFor, scheduler, setState, useStore, type State } from '../store/store'
import { LESSONS, MODULES, lessonById } from '../lessons'
import { band, conceptMastery } from '../learner/concepts'
import { MISTAKES, patterns, rhythm } from '../learner/digest'
import { memoryModel } from '../learner/memory'
import { FEATURES, predictModel } from '../learner/predict'

const BAND_COLOR = { solid: 'var(--lime)', shaky: 'var(--amber)', weak: 'var(--red)', untested: 'var(--text-dim)' }

export function YouPage() {
  const s = useStore((s) => s)
  const lvl = levelFor(s.xp)
  const solved = Object.values(s.problems).filter((p) => p.solved).length
  const firstTry = Object.values(s.problems).filter((p) => p.firstTry).length
  return (
    <>
      <span className="tag">You</span>
      <h1>{lvl.name}</h1>
      <p className="lede">
        Rank {lvl.index + 1} of {LEVELS.length} · {s.xp} XP · <Link to="/settings">Reminders and settings</Link>
      </p>
      <div className="grid four">
        <Stat label="Problems solved" v={solved} />
        <Stat label="First-try" v={firstTry} />
        <Stat label="Cards reviewed" v={s.reviews} />
        <Stat label="Days studied" v={s.studyDays.length} />
      </div>

      <WeekDigest s={s} />
      <Concepts s={s} />
      <Patterns s={s} />
      <Memory s={s} />
      <Rhythm s={s} />
      <Ahead s={s} />

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
      <h2>Ranks</h2>
      <div className="card">
        {LEVELS.map((l, i) => (
          <div key={l.name} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', color: i <= lvl.index ? 'var(--glow)' : 'var(--text-dim)' }}>
            <span>{i + 1}. {l.name}</span>
            <span className="kbd">{l.xp} XP</span>
          </div>
        ))}
      </div>
      <p className="dim small">XP: lesson mastered +50 · problem first try +20 (later tries +10) · derivation +15 · new simulation +5 · flashcard +2.</p>
    </>
  )
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="stat-v">{v}</div>
      <div className="tag">{label}</div>
    </div>
  )
}

// ---------- concepts ----------
function Concepts({ s }: { s: State }) {
  const { concepts, state } = useMemo(() => conceptMastery(s, LESSONS), [s])
  const tested = [...state.values()]
  const solid = tested.filter((c) => band(c) === 'solid').length
  return (
    <>
      <h2>What you know</h2>
      <div className="card">
        <p className="small dim" style={{ marginTop: 0 }}>
          Each tag is one idea from the problems. Its estimate rises with clean first-try answers and drops with misses, hints and peeks at the solution (Bayesian Knowledge Tracing).
          {tested.length ? ` ${solid} of ${tested.length} ideas you have practised look solid.` : ''}
        </p>
        <div className="row small" style={{ gap: 14, marginBottom: 8 }}>
          {(['solid', 'shaky', 'weak', 'untested'] as const).map((b) => (
            <span key={b}><span className="dot" style={{ background: BAND_COLOR[b] }} /> {b === 'untested' ? 'not practised yet' : b}</span>
          ))}
        </div>
        {LESSONS.map((l) => {
          const tags = [...new Set(l.problems.map((p) => p.concept ?? p.id))]
          return (
            <div key={l.id} className="concept-row">
              <Link to={`/learn/${l.id}#problems`} className="kbd concept-lesson">{l.id}</Link>
              <div className="row" style={{ gap: 6, flex: 1 }}>
                {tags.map((t) => {
                  const cs = state.get(t)
                  const b = band(cs)
                  return (
                    <span key={t} className="concept-chip" style={{ borderColor: BAND_COLOR[b], color: b === 'untested' ? 'var(--text-dim)' : 'var(--text)' }} title={cs ? `${cs.n} answer${cs.n === 1 ? '' : 's'}` : 'not practised yet'}>
                      {concepts.get(t)?.label ?? t}
                      {cs && <b style={{ color: BAND_COLOR[b] }}> {Math.round(cs.p * 100)}%</b>}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ---------- answer patterns ----------
function Patterns({ s }: { s: State }) {
  const p = useMemo(() => patterns(s, LESSONS), [s])
  const pct = (a: number, n: number) => (n ? `${Math.round((a / n) * 100)}%` : '–')
  if (!p.numeric.n && !p.mcq.n) return null
  return (
    <>
      <h2>How you solve</h2>
      <div className="grid three">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="stat-v">{pct(p.numeric.first, p.numeric.n)}</div>
          <div className="tag">numeric, first try</div>
          <div className="small dim">{p.numeric.first} of {p.numeric.n}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="stat-v">{pct(p.mcq.first, p.mcq.n)}</div>
          <div className="tag">multiple choice, first try</div>
          <div className="small dim">{p.mcq.first} of {p.mcq.n}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="stat-v">{Math.round(p.hintRate * 100)}%</div>
          <div className="tag">problems where you took a hint</div>
        </div>
      </div>
      {p.mistakes.length > 0 && (
        <div className="card">
          <div className="card-head"><span className="pill ghost">Your usual slips</span></div>
          {p.mistakes.slice(0, 4).map((m) => (
            <div key={m.kind} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', flexWrap: 'nowrap', alignItems: 'baseline' }}>
              <span><b>{MISTAKES[m.kind]?.label ?? m.kind}</b> <span className="dim small">{MISTAKES[m.kind]?.advice}</span></span>
              <span className="kbd">×{m.n}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ---------- memory ----------
function Memory({ s }: { s: State }) {
  const m = useMemo(() => memoryModel(s.log.reviews, s.retention, FSRS_W), [s.log.reviews, s.retention])
  const recall = useMemo(() => {
    const sched = scheduler()
    const now = new Date()
    return LESSONS.map((l) => {
      const rs = l.cards.map((c) => s.cards[c.id]).filter((c) => c && c.stability > 0).map((c) => sched.get_retrievability(c!, now, false) as number)
      return { id: l.id, n: rs.length, r: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN }
    }).filter((x) => x.n > 0)
  }, [s.cards, s.log.reviews.length, s.retention])
  return (
    <>
      <h2>Your memory</h2>
      <div className="card">
        <div className="ctrl" style={{ maxWidth: 360 }}>
          <label>
            <span>Target recall when a card returns</span>
            <b>{Math.round(s.retention * 100)}%</b>
          </label>
          <input type="range" min={0.8} max={0.95} step={0.01} value={s.retention} onChange={(e) => setState((st) => { st.retention = +e.target.value })} aria-label="Target recall" />
        </div>
        <p className="small dim">Higher means more frequent reviews and fewer lapses. 90% is a good balance.</p>
        {m.personal ? (
          <p>
            You hold cards about <b>{m.k.toFixed(2)}×</b> as long as the average FSRS learner, so cards are scheduled for a {Math.round(m.effectiveRetention * 100)}% model target to hit your {Math.round(m.desired * 100)}%.
            <span className="dim small"> Fitted to {m.n} reviews. Recall so far {Math.round(m.observed * 100)}% against {Math.round(m.predicted * 100)}% predicted.</span>
          </p>
        ) : (
          <p className="small dim">
            Your personal memory curve switches on after 12 reviews of cards at least half a day old ({m.n} so far). Until then the default FSRS curve schedules your cards.
          </p>
        )}
        {m.n > 0 && (
          <div className="calib">
            {m.bins.filter((b) => b.n > 0).map((b) => (
              <div key={b.lo} className="calib-col">
                <div className="calib-bars">
                  <div className="bar pred" style={{ height: `${b.predicted * 100}%` }} title={`predicted ${Math.round(b.predicted * 100)}%`} />
                  <div className="bar obs" style={{ height: `${b.observed * 100}%` }} title={`remembered ${Math.round(b.observed * 100)}%`} />
                </div>
                <div className="kbd">{Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}%</div>
                <div className="kbd">n={b.n}</div>
              </div>
            ))}
            <div className="small dim" style={{ alignSelf: 'center' }}>
              <span className="dot" style={{ background: 'var(--violet)' }} /> predicted <br />
              <span className="dot" style={{ background: 'var(--cyan)' }} /> you remembered
            </div>
          </div>
        )}
        {recall.length > 0 && (
          <>
            <div className="tag" style={{ marginTop: 12 }}>Recall right now, by lesson</div>
            {recall.map((x) => (
              <div key={x.id} className="row" style={{ flexWrap: 'nowrap', gap: 10, margin: '4px 0' }}>
                <span className="kbd" style={{ width: 34 }}>{x.id}</span>
                <div className="meter"><div style={{ width: `${x.r * 100}%`, background: x.r < 0.8 ? 'var(--amber)' : 'var(--cyan)' }} /></div>
                <span className="kbd" style={{ width: 40, textAlign: 'right' }}>{Math.round(x.r * 100)}%</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}

// ---------- rhythm ----------
function Rhythm({ s }: { s: State }) {
  const r = useMemo(() => rhythm(s), [s])
  if (!r.sessions) return null
  const max = Math.max(1, ...r.hours)
  const suggest = r.bestHour !== null ? `${String(r.bestHour).padStart(2, '0')}:00` : null
  return (
    <>
      <h2>Study rhythm</h2>
      <div className="card">
        <div className="hours" aria-label="Sessions by hour of day">
          {r.hours.map((h, i) => (
            <div key={i} className="hour" title={`${i}:00 · ${h} session${h === 1 ? '' : 's'}`}>
              <div style={{ height: `${(h / max) * 100}%` }} className={i === r.bestHour ? 'best' : ''} />
            </div>
          ))}
        </div>
        <div className="row kbd" style={{ justifyContent: 'space-between' }}>
          <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span>
        </div>
        <p className="small" style={{ marginBottom: 0 }}>
          {r.sessions} session{r.sessions === 1 ? '' : 's'} in the last 60 days, about {Math.round(r.avgSession)} minutes each.
          {suggest && ` You study most around ${suggest}.`}
        </p>
        {suggest && (s.reminder.time !== suggest || !s.reminder.enabled) && (
          <button className="btn small" style={{ marginTop: 10 }} onClick={() => setState((st) => { st.reminder = { ...st.reminder, enabled: true, time: suggest } })}>
            Remind me at {suggest}
          </button>
        )}
      </div>
    </>
  )
}

// ---------- predictions ----------
const DRAG: Record<string, string> = {
  lesson: 'answers in this lesson needed several tries',
  concept: 'reuses an idea you found tricky',
  prereq: 'prerequisites not mastered yet',
  recent: 'recent first-try accuracy dipped',
  hints: 'leaning on hints lately',
}

function Ahead({ s }: { s: State }) {
  const m = useMemo(() => predictModel(s, LESSONS, MODULES), [s])
  const rows = m.predictions.slice(0, 5)
  if (!rows.length) return null
  return (
    <>
      <h2>Looking ahead</h2>
      <div className="card">
        <p className="small dim" style={{ marginTop: 0 }}>
          Predicted chance of solving a new problem cleanly on the first try, from a small model trained on your own answers.
        </p>
        {rows.map((p) => {
          const l = lessonById(p.lessonId)!
          return (
            <div key={p.lessonId} className="row" style={{ flexWrap: 'nowrap', gap: 10, margin: '6px 0' }}>
              <Link to={`/learn/${l.id}`} className="kbd" style={{ width: 34 }}>{l.id}</Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="meter"><div style={{ width: `${p.p * 100}%`, background: p.p < 0.45 ? 'var(--amber)' : 'var(--cyan)' }} /></div>
                <div className="small dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}{p.drag ? ` · ${DRAG[p.drag]}` : ''}</div>
              </div>
              <span className="kbd" style={{ width: 40, textAlign: 'right' }}>{Math.round(p.p * 100)}%</span>
            </div>
          )
        })}
        <details className="why" style={{ marginTop: 10 }}>
          <summary>How this model works</summary>
          <div className="small">
            <p>
              Logistic regression on {m.n} first attempt{m.n === 1 ? '' : 's'} of yours, fitted on this device. It starts from sensible default weights and moves away from them only as your own answers show otherwise.
              {m.holdout
                ? ` Trained on your earlier answers, it called ${Math.round(m.holdout.acc * 100)}% of your latest ${m.holdout.n} correctly (always guessing your usual outcome scores ${Math.round(m.holdout.baseline * 100)}%).`
                : ' Its accuracy is shown here after 20 answers.'}
            </p>
            <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {FEATURES.map((f, i) => (
                  <tr key={f.key}>
                    <td style={{ padding: '2px 0' }}>{f.label}</td>
                    <td className="kbd" style={{ textAlign: 'right' }}>{m.w[i] >= 0 ? '+' : ''}{m.w[i].toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </>
  )
}
