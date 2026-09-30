import { useRef, type ReactNode } from 'react'
import { touchSim } from '../store/store'

/** Card chrome shared by all simulations. Records the first interaction for XP and badges. */
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
  const touch = () => {
    if (touched.current) return
    touched.current = true
    touchSim(id)
  }
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
      {hint && <p className="dim small" style={{ marginTop: 10, marginBottom: 0 }}>{hint}</p>}
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
