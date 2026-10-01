import { useEffect, useRef, useState, type ReactNode } from 'react'
import { touchSim } from '../store/store'

/** Card chrome shared by all simulations. Records the first interaction for XP and badges, and if a sim
 *  runs for a while with nobody touching it, lights up its hint so the learner knows what to try. */
export function SimFrame({
  id,
  title,
  running,
  setRunning,
  onReset,
  children,
  hint,
}: {
  id: string
  title: string
  running: boolean
  setRunning: (r: boolean) => void
  onReset: () => void
  children: ReactNode
  hint?: string
}) {
  const touched = useRef(false)
  const [idle, setIdle] = useState(false)
  const touch = (e: { type: string }) => {
    setIdle(false)
    if (touched.current) return
    touched.current = true
    // Award after the gesture finishes: a badge modal opened on pointerdown would swallow the click.
    const ends = e.type === 'pointerdown' ? ['pointerup', 'pointercancel'] : ['keyup']
    const award = () => {
      ends.forEach((t) => window.removeEventListener(t, award))
      setTimeout(() => touchSim(id), 0)
    }
    ends.forEach((t) => window.addEventListener(t, award))
  }
  useEffect(() => {
    if (!running || !hint || touched.current) return
    const t = setTimeout(() => setIdle(true), 40_000)
    return () => clearTimeout(t)
  }, [running, hint])
  return (
    <div className="card glow" onPointerDownCapture={touch} onKeyDownCapture={touch}>
      <div className="card-head">
        <span className="pill">Simulation</span>
        <span className="hud-title">{title}</span>
        <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
          <button className="btn small" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Play'}</button>
          <button className="btn small" onClick={onReset}>Reset</button>
        </div>
      </div>
      {children}
      {hint && (
        <p className={`small ${idle ? 'hint-pulse' : 'dim'}`} style={{ marginTop: 10, marginBottom: 0 }}>
          {idle && <strong>Try this: </strong>}
          {hint}
        </p>
      )}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  fmt?: (v: number) => string
}) {
  return (
    <div className="ctrl">
      <label>
        <span>{label}</span>
        <b>{fmt ? fmt(value) : value}</b>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} aria-label={label} />
    </div>
  )
}
