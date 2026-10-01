// B5: two oscillators coupled through a pump, x1″ + 2Γx1′ + ω1²x1 = cE(t)x2, x2″ + 2Γx2′ + ω2²x2 = cE(t)x1,
// E = 2E0 cos ω0t, integrated with RK4. Top: the oscillations (autoscaled). Bottom: log amplitude against time
// with the theory slope. Presets: the decay instability (ω0 ≈ ω1 + ω2), the pumped swing (one oscillator pumped
// at twice its frequency: the Mathieu equation) and the purely growing mode (ω2 ≈ 0, ω0 just below ω1).
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { decayGrowth, fitSlope, gamma0Of, oscAmplitude, purelyGrowing, stepOsc, type OscParams, type OscState } from '../physics/parametric'
import { SimFrame, Slider } from './SimFrame'

type Preset = 'decay' | 'swing' | 'otsi'
const COUPLING = 0.04
const DT = 0.05
const SEED = 1e-6
const T_MAX = 1500
const STOP_LN = Math.log(1e6) // stop once the amplitude has grown a million-fold
const RING = 4096 // samples of x1, x2 kept for the trace panel (every step)

function params(preset: Preset, E0: number, D: number, G: number, w2: number): OscParams {
  if (preset === 'swing') return { w1: 1, w2: 1, w0: 2 + D, c1: COUPLING, c2: COUPLING, E0, G1: G, G2: G }
  if (preset === 'otsi') return { w1: 1, w2: 0.03, w0: 1 + D, c1: COUPLING, c2: COUPLING, E0, G1: G, G2: G }
  return { w1: 1, w2, w0: 1 + w2 + D, c1: COUPLING, c2: COUPLING, E0, G1: G, G2: G }
}

export function PumpedOscillatorsSim() {
  const [running, setRunning] = useState(true)
  const [preset, setPreset] = useState<Preset>('decay')
  const [E0, setE0] = useState(0.7)
  const [D, setD] = useState(0)
  const [G, setG] = useState(0)
  const [w2, setW2] = useState(0.5)
  const [speed, setSpeed] = useState(4)
  const p = useMemo(() => params(preset, E0, D, G, w2), [preset, E0, D, G, w2])
  const fresh = (pr: Preset): OscState => ({ t: 0, y: new Float64Array([SEED, 0, pr === 'swing' ? SEED : 0, 0]) })
  const st = useRef<OscState>(fresh('decay'))
  const ring = useRef({ x1: new Float64Array(RING), x2: new Float64Array(RING), n: 0 })
  const hist = useRef<{ t: number[]; a1: number[]; a2: number[] }>({ t: [], a1: [], a2: [] })
  const [meas, setMeas] = useState<number | null>(null)
  const [time, setTime] = useState(0)
  const [done, setDone] = useState(false)

  const restart = (pr = preset) => {
    st.current = fresh(pr)
    ring.current.n = 0
    hist.current = { t: [], a1: [], a2: [] }
    setMeas(null)
    setTime(0)
    setDone(false)
    setRunning(true)
  }
  const choose = (pr: Preset) => {
    setPreset(pr)
    setD(pr === 'otsi' ? -0.03 : 0)
    setG(0)
    setE0(pr === 'otsi' ? 0.5 : pr === 'swing' ? 1 : 0.7)
    restart(pr)
  }

  // theory
  const g0 = gamma0Of(p)
  const otsi = preset === 'otsi'
  const theory = otsi ? purelyGrowing(p) : decayGrowth(g0, preset === 'swing' ? D : p.w0 - p.w1 - p.w2, G, G)
  const threshold = preset !== 'otsi' && D === 0 ? G : NaN

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.15 : 0.55)

  const draw = () => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width
    const H = cv.height
    const u = W / cv.clientWidth
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const s = st.current
    const R = ring.current

    // ---------- top: traces over the last window ----------
    const tx0 = 8 * u
    const tx1 = W - 8 * u
    const ty0 = 22 * u
    const ty1 = H * 0.46
    const n = Math.min(R.n, RING)
    const winSteps = Math.min(n, Math.round(120 / DT))
    let amax = 1e-300
    for (let j = 0; j < winSteps; j++) {
      const i = (R.n - 1 - j + RING * 4) % RING
      amax = Math.max(amax, Math.abs(R.x1[i]), Math.abs(R.x2[i]))
    }
    const mid = (ty0 + ty1) / 2
    const half = (ty1 - ty0) / 2 - 4 * u
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(tx0, mid)
    ctx.lineTo(tx1, mid)
    ctx.stroke()
    const trace = (arr: Float64Array, color: string) => {
      glowStroke(ctx, color, 1.4 * u, () => {
        for (let j = 0; j < winSteps; j++) {
          const i = (R.n - winSteps + j + RING * 4) % RING
          const x = tx1 - ((winSteps - 1 - j) / Math.round(120 / DT)) * (tx1 - tx0)
          const y = mid - (arr[i] / amax) * half
          if (j) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        }
      })
    }
    // pump, faint
    ctx.strokeStyle = 'rgba(251,191,36,0.35)'
    ctx.lineWidth = u
    ctx.beginPath()
    for (let j = 0; j <= 400; j++) {
      const t = s.t - 120 + (120 * j) / 400
      const x = tx0 + (j / 400) * (tx1 - tx0)
      const y = mid - 0.92 * half * Math.cos(p.w0 * t)
      if (j) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.stroke()
    if (preset !== 'swing') trace(R.x2, COLORS.magenta)
    trace(R.x1, COLORS.cyan)
    ctx.fillStyle = COLORS.white
    ctx.fillText('last 120 time units, autoscaled', tx0, 14 * u)
    ctx.textAlign = 'right'
    let lx = tx1
    const leg = (col: string, txt: string) => {
      ctx.fillStyle = col
      ctx.fillText(txt, lx, 14 * u)
      lx -= ctx.measureText(txt).width + 10 * u
    }
    leg('rgba(251,191,36,0.8)', 'pump')
    if (preset !== 'swing') leg(COLORS.magenta, otsi ? 'x₂ (slow)' : 'x₂')
    leg(COLORS.cyan, preset === 'swing' ? 'x (swing)' : 'x₁')
    ctx.textAlign = 'left'

    // swing pictogram: a pendulum whose length is pumped at ω0 = 2ω
    if (preset === 'swing') {
      const px = tx0 + 46 * u
      const py = ty0 + 4 * u
      const len = (ty1 - ty0) * 0.62 * (1 - 0.12 * Math.cos(p.w0 * s.t))
      const ang = 0.6 * (s.y[0] / amax)
      const bx = px + len * Math.sin(ang)
      const by = py + len * Math.cos(ang)
      ctx.strokeStyle = 'rgba(232,234,246,0.7)'
      ctx.lineWidth = 1.5 * u
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(bx, by)
      ctx.stroke()
      ctx.fillStyle = COLORS.cyan
      ctx.shadowColor = COLORS.cyan
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(bx, by, 6 * u, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // ---------- bottom: log amplitude vs time ----------
    const gx0 = 42 * u
    const gx1 = W - 10 * u
    const gy0 = ty1 + 30 * u
    const gy1 = H - 22 * u
    const h = hist.current
    const tSpan = Math.max(100, Math.ceil(s.t / 100) * 100)
    const l0 = Math.log10(SEED)
    let lmax = l0 + 1
    let lmin = l0 - 1
    for (let i = 0; i < h.t.length; i++) {
      lmax = Math.max(lmax, h.a1[i] / Math.LN10)
      lmin = Math.min(lmin, h.a1[i] / Math.LN10)
    }
    lmax = Math.ceil(lmax + 0.2)
    lmin = Math.floor(lmin - 0.2)
    const X = (t: number) => gx0 + (t / tSpan) * (gx1 - gx0)
    const Y = (l: number) => gy1 - ((l - lmin) / (lmax - lmin)) * (gy1 - gy0)
    ctx.strokeStyle = COLORS.grid
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    const stepL = lmax - lmin > 8 ? 2 : 1
    for (let l = lmin; l <= lmax; l += stepL) {
      ctx.beginPath()
      ctx.moveTo(gx0, Y(l))
      ctx.lineTo(gx1, Y(l))
      ctx.stroke()
      ctx.fillText(`1e${l}`, gx0 - 4 * u, Y(l) + 4 * u)
    }
    ctx.textAlign = 'center'
    const tStep = tSpan > 600 ? 200 : 100
    for (let t = 0; t <= tSpan; t += tStep) ctx.fillText(String(t), X(t), gy1 + 14 * u)
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    ctx.fillText(narrow ? 'amplitude (log) vs t' : 'oscillator amplitude (log scale) vs time', gx0, gy0 - 8 * u)
    ctx.save()
    ctx.beginPath()
    ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.clip()
    // theory line, anchored at the start of the fit window
    if (h.t.length > 10 && isFinite(theory)) {
      const i0 = h.t.findIndex((t) => t >= s.t / 2)
      if (i0 >= 0) {
        const t1 = h.t[i0]
        const l1 = h.a1[i0] / Math.LN10
        const slope = theory / Math.LN10
        ctx.setLineDash([6 * u, 5 * u])
        ctx.strokeStyle = COLORS.amber
        ctx.lineWidth = 1.5 * u
        ctx.beginPath()
        ctx.moveTo(X(0), Y(l1 - slope * t1))
        ctx.lineTo(X(tSpan), Y(l1 + slope * (tSpan - t1)))
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    if (preset !== 'swing') {
      ctx.strokeStyle = 'rgba(244,114,182,0.7)'
      ctx.lineWidth = 1.2 * u
      ctx.beginPath()
      for (let i = 0; i < h.t.length; i++) {
        const y = Y(h.a2[i] / Math.LN10)
        if (i) ctx.lineTo(X(h.t[i]), y)
        else ctx.moveTo(X(h.t[i]), y)
      }
      ctx.stroke()
    }
    glowStroke(ctx, COLORS.cyan, 1.6 * u, () => {
      for (let i = 0; i < h.t.length; i++) {
        const y = Y(h.a1[i] / Math.LN10)
        if (i) ctx.lineTo(X(h.t[i]), y)
        else ctx.moveTo(X(h.t[i]), y)
      }
    })
    ctx.restore()
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.amber
    ctx.fillText('theory slope', gx1 - 4 * u, gy0 + 14 * u)
    ctx.textAlign = 'left'
  }

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const s = st.current
      const R = ring.current
      const h = hist.current
      if (running && !done) {
        const steps = 10 * speed
        for (let k = 0; k < steps; k++) {
          stepOsc(p, s, DT)
          const i = R.n % RING
          R.x1[i] = s.y[0]
          R.x2[i] = s.y[2]
          R.n++
          if (R.n % 5 === 0) {
            h.t.push(s.t)
            h.a1.push(Math.log(oscAmplitude(s.y, 0, p.w1)))
            h.a2.push(Math.log(oscAmplitude(s.y, 1, Math.max(p.w2, 0.1))))
          }
        }
        const last = h.a1[h.a1.length - 1] ?? 0
        if (last - Math.log(SEED) > STOP_LN || s.t >= T_MAX || last < Math.log(SEED) - 12) {
          setDone(true)
          setRunning(false)
        }
        if (++frame % 6 === 0) {
          setTime(s.t)
          setMeas(s.t > 60 ? fitSlope(h.t, h.a1, s.t / 2, s.t) : null)
        }
      }
      draw()
    },
    true,
  )

  const ok = meas !== null && isFinite(theory) && (Math.abs(theory) > 1e-3 ? Math.abs(meas / theory - 1) < 0.05 : Math.abs(meas) < 1.5e-3)
  return (
    <SimFrame
      id="pumped-oscillators"
      title="Pumped coupled oscillators"
      running={running}
      setRunning={(on) => (on && done ? restart() : setRunning(on))}
      onReset={() => restart()}
      hint="Units: ω₁ = 1, time in 1/ω₁. Oscillator 1 starts with a tiny kick and oscillator 2 at rest. At exact matching (Δ = 0) both grow together at γ₀, the straight dashed line. Detune the pump: growth slows as √(γ₀² − Δ²/4) and stops at |Δ| = 2γ₀. Add damping: below γ₀ = Γ nothing grows. The pumped swing is one oscillator pumped at twice its frequency (a child pumping a swing); the purely growing preset makes x₂ grow without oscillating at all."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${preset === 'decay' ? 'primary' : ''}`} onClick={() => choose('decay')}>Decay (ω₀ ≈ ω₁ + ω₂)</button>
        <button className={`btn small ${preset === 'swing' ? 'primary' : ''}`} onClick={() => choose('swing')}>Pumped swing (ω₀ = 2ω)</button>
        <button className={`btn small ${preset === 'otsi' ? 'primary' : ''}`} onClick={() => choose('otsi')}>Purely growing (ω₂ ≈ 0)</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Pumped coupled oscillators simulation" />
      <div className="readouts">
        <span>
          measured growth = <b className={ok ? 'ok' : ''}>{meas === null ? '…' : meas.toFixed(4)}</b>
        </span>
        <span>
          theory = <b>{isFinite(theory) ? theory.toFixed(4) : '—'}</b>
          {otsi ? ' (purely growing root)' : preset === 'swing' ? ' (hω/4 at Δ = 0)' : ' (coupled-mode)'}
        </span>
        {!otsi && (
          <span>
            γ₀ = <b>{g0.toFixed(4)}</b>, Δ = ω₀ − {preset === 'swing' ? '2ω' : 'ω₁ − ω₂'} = <b>{D.toFixed(3)}</b>
          </span>
        )}
        {otsi && (
          <span>
            ω₀ − ω₁ = <b>{D.toFixed(3)}</b>: {D < 0 ? 'pump below ω₁, so x₂ can grow without oscillating' : 'pump above ω₁: no purely growing mode'}
          </span>
        )}
        {isFinite(threshold) && G > 0 && (
          <span>
            threshold: γ₀ {g0 > threshold ? '>' : '<'} Γ = <b>{threshold.toFixed(3)}</b> → <b className={g0 > threshold ? 'ok' : ''}>{g0 > threshold ? 'grows' : 'damped'}</b>
          </span>
        )}
        <span>
          t = <b>{time.toFixed(0)}</b>
          {done ? ' (stopped)' : ''}
        </span>
      </div>
      <div className="controls">
        <Slider label="Pump amplitude E₀" value={E0} min={0} max={1} step={0.01} onChange={(v) => { setE0(v); restart() }} />
        <Slider
          label={otsi ? 'Pump offset ω₀ − ω₁' : 'Frequency mismatch Δ'}
          value={D}
          min={otsi ? -0.1 : -0.08}
          max={otsi ? 0.05 : 0.08}
          step={0.002}
          onChange={(v) => { setD(v); restart() }}
          fmt={(v) => v.toFixed(3)}
        />
        <Slider label="Damping Γ (both)" value={G} min={0} max={0.04} step={0.001} onChange={(v) => { setG(v); restart() }} fmt={(v) => v.toFixed(3)} />
        {preset === 'decay' && <Slider label="Daughter frequency ω₂/ω₁" value={w2} min={0.2} max={1} step={0.05} onChange={(v) => { setW2(v); restart() }} fmt={(v) => v.toFixed(2)} />}
        <Slider label="Speed" value={speed} min={1} max={10} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
