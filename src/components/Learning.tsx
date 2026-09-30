// Step-through derivations, problems and flashcards.
import { useState } from 'react'
import { tex } from './Eq'
import { finishDerivation, recordProblem, reviewCard, Rating, useStore } from '../store/store'
import type { Grade } from 'ts-fsrs'

// ---------- derivation ----------
export interface DerivStep {
  text: string
  math?: string
  why?: string
}

export function Derivation({ lessonId, id, title, steps }: { lessonId: string; id: string; title: string; steps: DerivStep[] }) {
  const done = useStore((s) => s.lessons[lessonId]?.derivations.includes(id))
  const [shown, setShown] = useState(done ? steps.length : 1)
  const [tryMode, setTryMode] = useState(false)
  const [peek, setPeek] = useState(false)
  const next = () => {
    const n = shown + 1
    setShown(n)
    setPeek(false)
    if (n >= steps.length) finishDerivation(lessonId, id)
  }
  return (
    <div className="card">
      <div className="card-head">
        <span className="pill violet">Derivation</span>
        <span className="hud-title">{title}</span>
        <label className="small dim" style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={tryMode} onChange={(e) => setTryMode(e.target.checked)} />
          Try each step first
        </label>
      </div>
      <div className="steps">
        {steps.slice(0, shown).map((s, i) => (
          <div className="step" key={i}>
            <div className="step-n">STEP {String(i + 1).padStart(2, '0')}</div>
            <div>{s.text}</div>
            {s.math && <div className="eq-block" dangerouslySetInnerHTML={{ __html: tex(s.math, true) }} />}
            {s.why && (
              <details className="why">
                <summary>Why?</summary>
                <div className="small">{s.why}</div>
              </details>
            )}
          </div>
        ))}
        {shown < steps.length && tryMode && !peek && (
          <div className="step hidden-step">
            <div className="step-n">STEP {String(shown + 1).padStart(2, '0')} · YOUR TURN</div>
            <div>{steps[shown].text}</div>
            <div className="small">Work it out on paper, then reveal to compare.</div>
          </div>
        )}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {shown < steps.length ? (
          <button className="btn primary" onClick={next}>
            {tryMode ? 'Reveal step' : 'Next step'} ({shown}/{steps.length})
          </button>
        ) : (
          <span className="pill lime">Derivation complete</span>
        )}
        {shown > 1 && (
          <button className="btn small" onClick={() => setShown(1)}>
            Start over
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- problems ----------
/** `concept` is a short tag ("debye-length", "exb-drift") the learner model uses to find weak spots. */
export type Problem =
  | { id: string; kind: 'numeric'; prompt: string; answer: number; tol: number; unit: string; hints: string[]; solution: string; concept?: string }
  | { id: string; kind: 'mcq'; prompt: string; options: string[]; correct: number; hints: string[]; solution: string; concept?: string }

export function ProblemCard({ p, index }: { p: Problem; index: number }) {
  const rec = useStore((s) => s.problems[p.id])
  const [val, setVal] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null)
  const [hints, setHints] = useState(0)
  const solved = !!rec?.solved

  const checkNumeric = () => {
    const x = parseFloat(val.replace(/,/g, '').replace(/×10\^?/i, 'e').replace(/x10\^?/i, 'e'))
    if (!isFinite(x)) return setMsg({ good: false, text: 'Enter a number, e.g. 23.5 or 2.35e1.' })
    const p2 = p as Extract<Problem, { kind: 'numeric' }>
    const ok = Math.abs(x - p2.answer) <= p2.tol * Math.abs(p2.answer)
    recordProblem(p.id, ok)
    setMsg(ok ? { good: true, text: 'Correct.' } : { good: false, text: wrongNudge(x, p2.answer) })
  }
  const pick = (i: number) => {
    if (solved) return
    const p2 = p as Extract<Problem, { kind: 'mcq' }>
    setPicked(i)
    const ok = i === p2.correct
    recordProblem(p.id, ok)
    setMsg(ok ? { good: true, text: 'Correct.' } : { good: false, text: 'Not quite. Try another option or take a hint.' })
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="pill ghost">Problem {index + 1}</span>
        {solved && <span className="pill lime">{rec.firstTry ? 'First try' : 'Solved'}</span>}
      </div>
      <div dangerouslySetInnerHTML={{ __html: withMath(p.prompt) }} />
      {p.kind === 'numeric' ? (
        <div className="row" style={{ marginTop: 10 }}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="your answer"
            value={val}
            disabled={solved}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkNumeric()}
            style={{ width: 160 }}
            aria-label="Answer"
          />
          <span className="dim">{p.unit}</span>
          <button className="btn primary" disabled={solved} onClick={checkNumeric}>
            Check
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {p.options.map((o, i) => (
            <button
              key={i}
              className={`opt ${solved && i === p.correct ? 'right' : ''} ${picked === i && i !== p.correct ? 'wrong' : ''}`}
              onClick={() => pick(i)}
              dangerouslySetInnerHTML={{ __html: withMath(o) }}
            />
          ))}
        </div>
      )}
      {msg && <div className={`feedback ${msg.good ? 'good' : 'bad'}`}>{msg.text}</div>}
      {!solved && hints < p.hints.length && (
        <button className="btn small" style={{ marginTop: 10 }} onClick={() => setHints(hints + 1)}>
          Hint {hints + 1}
        </button>
      )}
      {p.hints.slice(0, hints).map((h, i) => (
        <div key={i} className="sym-panel small" dangerouslySetInnerHTML={{ __html: withMath(h) }} />
      ))}
      {(solved || (rec?.attempts ?? 0) >= 3) && (
        <details className="why" style={{ marginTop: 10 }}>
          <summary>Worked solution</summary>
          <div className="small" dangerouslySetInnerHTML={{ __html: withMath(p.solution) }} />
        </details>
      )}
    </div>
  )
}

function wrongNudge(x: number, ans: number) {
  const r = x / ans
  const lg = Math.log10(Math.abs(r))
  if (Math.abs(Math.abs(lg) - Math.round(Math.abs(lg))) < 0.02 && Math.round(Math.abs(lg)) >= 1)
    return `Off by a factor of 10^${Math.round(lg)}. Check your unit conversions.`
  if (Math.abs(r - 2 * Math.PI) < 0.1 || Math.abs(r - 1 / (2 * Math.PI)) < 0.01) return 'Off by 2π. Angular frequency ω or ordinary frequency f?'
  return r > 1 ? 'Too high. Try again or take a hint.' : 'Too low. Try again or take a hint.'
}

/** Renders $...$ spans in plain strings with KaTeX. */
export function withMath(s: string) {
  return s
    .split(/(\$[^$]+\$)/g)
    .map((part) => (part.startsWith('$') ? tex(part.slice(1, -1)) : part.replace(/</g, '&lt;')))
    .join('')
}

// ---------- flashcards ----------
export interface Flashcard {
  id: string
  front: string
  back: string
}

export function FlashcardView({ card, onDone }: { card: Flashcard; onDone: () => void }) {
  const [flipped, setFlipped] = useState(false)
  const grade = (g: Grade) => {
    reviewCard(card.id, g)
    setFlipped(false)
    onDone()
  }
  return (
    <div className="card glow">
      <div className="flash" onClick={() => setFlipped(true)} style={{ cursor: flipped ? 'default' : 'pointer' }}>
        <div>
          <div className="tag">{flipped ? 'Answer' : 'Question'}</div>
          <div style={{ fontSize: 19, marginTop: 8 }} dangerouslySetInnerHTML={{ __html: withMath(flipped ? card.back : card.front) }} />
          {!flipped && <div className="kbd" style={{ marginTop: 14 }}>Tap to reveal</div>}
        </div>
      </div>
      {flipped && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn small" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => grade(Rating.Again)}>Forgot</button>
          <button className="btn small" onClick={() => grade(Rating.Hard)}>Hard</button>
          <button className="btn small" style={{ borderColor: 'var(--lime)', color: 'var(--lime)' }} onClick={() => grade(Rating.Good)}>Good</button>
          <button className="btn small" onClick={() => grade(Rating.Easy)}>Easy</button>
        </div>
      )}
    </div>
  )
}
