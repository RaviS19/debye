// A3: magnetic mirror. Launch one particle and watch it bounce (or escape), with its point in
// velocity space sliding around the energy circle. Or fire an isotropic ensemble and count losses.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { borisStep, dot, mirrorField, mirrorZmax, type Particle } from '../physics/boris'
import { lossConeAngle, lossFraction } from '../physics/constants'
import { SimFrame, Slider } from './SimFrame'

const L = 14
const V = 1
const ENSEMBLE = 400

function launch(pitchDeg: number, phase = 0): Particle {
  const th = (pitchDeg * Math.PI) / 180
  const vp = V * Math.sin(th)
  // offset by one Larmor radius so the guiding centre sits on the axis
  return { x: [0, vp, 0], v: [vp * Math.cos(phase), 0, V * Math.cos(th)], q: 1, m: 1 }
}

function isotropic(): Particle[] {
  return Array.from({ length: ENSEMBLE }, (_, i) => {
    const mu = 2 * ((i + 0.5) / ENSEMBLE) - 1 // uniform cos θ → isotropic
    const deg = (Math.acos(mu) * 180) / Math.PI
    return launch(deg)
  })
}

export function MirrorSim() {
  const [running, setRunning] = useState(true)
  const [R, setR] = useState(4)
  const [pitch, setPitch] = useState(45)
  const [mode, setMode] = useState<'single' | 'ensemble'>('single')
  const one = useRef<Particle>(launch(45))
  const trail = useRef<[number, number][]>([])
  const mu0 = useRef(0)
  const ens = useRef<(Particle | null)[]>([])
  const lost = useRef(0)
  const [status, setStatus] = useState<{ state: string; mu: number }>({ state: 'bouncing', mu: 1 })
  const [lostFrac, setLostFrac] = useState(0)

  const zm = mirrorZmax(R, L)
  const field = mirrorField(1, L)
  const thetaM = (lossConeAngle(R) * 180) / Math.PI

  const muOf = (p: Particle) => {
    const B = field(p.x, 0).B
    const b = Math.hypot(...B)
    const vpar = dot(p.v, B) / b
    const vperp2 = dot(p.v, p.v) - vpar * vpar
    return vperp2 / (2 * b)
  }

  const resetSingle = (deg = pitch) => {
    one.current = launch(deg)
    trail.current = []
    mu0.current = muOf(one.current)
    setStatus({ state: 'bouncing', mu: 1 })
  }
  const resetEnsemble = () => {
    ens.current = isotropic()
    lost.current = 0
    setLostFrac(0)
  }
  if (mu0.current === 0) mu0.current = muOf(one.current)

  const canvas = useCanvas(typeof innerWidth !== 'undefined' && innerWidth < 560 ? 0.95 : 0.62)
  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    // wide screens: velocity panel on the right; phones: stacked underneath
    const stacked = c.clientWidth < 560
    const mainW = stacked ? W : W * 0.68
    const mainH = stacked ? H * 0.62 : H
    const zSpan = zm * 1.35
    const X = (z: number) => mainW / 2 + (z / zSpan) * (mainW / 2)
    const Y = (x: number) => mainH / 2 - x * (mainH / 11)
    // field lines: flux conservation, r ∝ 1/√B
    for (const r0 of [1.2, 2.4, 3.6, 4.8]) {
      for (const s of [1, -1]) {
        ctx.strokeStyle = 'rgba(143,255,255,0.22)'
        ctx.beginPath()
        for (let k = 0; k <= 80; k++) {
          const z = -zSpan + (2 * zSpan * k) / 80
          const r = r0 / Math.sqrt(1 + (z * z) / (L * L))
          if (k) ctx.lineTo(X(z), Y(s * r))
          else ctx.moveTo(X(z), Y(s * r))
        }
        ctx.stroke()
      }
    }
    // coils at the throats
    for (const z of [-zm, zm]) {
      ctx.fillStyle = 'rgba(251,191,36,0.85)'
      ctx.shadowColor = COLORS.amber
      ctx.shadowBlur = 12
      ctx.fillRect(X(z) - 5 * u, Y(3.4), 10 * u, 16 * u)
      ctx.fillRect(X(z) - 5 * u, Y(-3.4) - 16 * u, 10 * u, 16 * u)
      ctx.shadowBlur = 0
    }
    ctx.fillStyle = COLORS.text
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    ctx.fillText('side view: z along the axis →', 8 * u, 14 * u)

    // velocity-space panel
    const px0 = stacked ? W / 2 : mainW + (W - mainW) / 2
    const py0 = stacked ? H * 0.93 : H * 0.55
    const pr = stacked ? (H - mainH) * 0.62 : Math.min(W - mainW, H) * 0.38
    ctx.strokeStyle = COLORS.axis
    ctx.beginPath()
    ctx.moveTo(px0 - pr * 1.1, py0)
    ctx.lineTo(px0 + pr * 1.1, py0)
    ctx.moveTo(px0, py0)
    ctx.lineTo(px0, py0 - pr * 1.15)
    ctx.stroke()
    // loss cones (shaded wedges along ±v∥)
    const tm = lossConeAngle(R)
    ctx.fillStyle = 'rgba(251,95,95,0.2)'
    for (const s of [1, -1]) {
      ctx.beginPath()
      ctx.moveTo(px0, py0)
      ctx.arc(px0, py0, pr, s > 0 ? -tm : Math.PI, s > 0 ? 0 : Math.PI + tm)
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(143,255,255,0.35)'
    ctx.beginPath()
    ctx.arc(px0, py0, pr, Math.PI, 2 * Math.PI)
    ctx.stroke()
    ctx.fillStyle = COLORS.text
    ctx.fillText('v∥', px0 + pr * 1.1 - 12 * u, py0 + 14 * u)
    ctx.fillText('v⊥', px0 + 4 * u, py0 - pr * 1.15 + 10 * u)
    ctx.fillStyle = COLORS.red
    ctx.textAlign = 'right'
    ctx.fillText('loss cone', px0 + pr * 0.95, py0 - 6 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    ctx.fillText('velocity space', stacked ? 8 * u : px0 - pr, stacked ? mainH + 16 * u : py0 + 30 * u)

    const plotV = (p: Particle, col: string, rad: number) => {
      const B = field(p.x, 0).B
      const b = Math.hypot(...B)
      const vpar = dot(p.v, B) / b
      const vperp = Math.sqrt(Math.max(0, dot(p.v, p.v) - vpar * vpar))
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(px0 + (vpar / V) * pr, py0 - (vperp / V) * pr, rad, 0, 7)
      ctx.fill()
    }

    if (mode === 'single') {
      glowStroke(ctx, COLORS.magenta, 1.5 * u, () => {
        trail.current.forEach(([z, x], i) => (i ? ctx.lineTo(X(z), Y(x)) : ctx.moveTo(X(z), Y(x))))
      })
      const p = one.current
      ctx.fillStyle = '#fff'
      ctx.shadowColor = COLORS.magenta
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(X(p.x[2]), Y(p.x[0]), 4.5 * u, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.shadowColor = COLORS.cyan
      ctx.shadowBlur = 10
      plotV(p, COLORS.glow, 5 * u)
      ctx.shadowBlur = 0
    } else {
      for (const p of ens.current) {
        if (!p) continue
        ctx.fillStyle = COLORS.cyan
        ctx.fillRect(X(p.x[2]) - u, Y(p.x[0]) - u, 2.2 * u, 2.2 * u)
        plotV(p, 'rgba(143,255,255,0.6)', 1.6 * u)
      }
    }
  }

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const dt = 0.06
      const steps = 22
      if (mode === 'single') {
        const p = one.current
        if (Math.abs(p.x[2]) < zm * 1.3) {
          for (let s = 0; s < steps; s++) borisStep(p, field, 0, dt)
          trail.current.push([p.x[2], p.x[0]])
          if (trail.current.length > 900) trail.current.shift()
        }
        if (++frame % 8 === 0) {
          const escaped = Math.abs(p.x[2]) > zm
          setStatus({ state: escaped ? 'escaped' : 'bouncing', mu: muOf(p) / mu0.current })
        }
      } else {
        const ps = ens.current
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i]
          if (!p) continue
          for (let s = 0; s < steps; s++) borisStep(p, field, 0, dt)
          if (Math.abs(p.x[2]) > zm) {
            ps[i] = null
            lost.current++
          }
        }
        if (++frame % 8 === 0) setLostFrac(lost.current / ENSEMBLE)
      }
      draw()
    },
    running,
  )

  const trapped = Math.sin((pitch * Math.PI) / 180) ** 2 > 1 / R

  return (
    <SimFrame
      id="mirror"
      title="Magnetic mirror"
      running={running}
      setRunning={setRunning}
      onReset={() => (mode === 'single' ? resetSingle() : resetEnsemble())}
      hint="As the particle moves into the stronger field near a coil, μ = mv⊥²/2B stays constant, so v⊥ must grow. Energy is fixed, so v∥ shrinks until the particle turns around. In the velocity-space panel, watch its point slide along the circle. Particles that start inside the red loss cone never turn around."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${mode === 'single' ? 'primary' : ''}`} onClick={() => { setMode('single'); resetSingle() }}>One particle</button>
        <button className={`btn small ${mode === 'ensemble' ? 'primary' : ''}`} onClick={() => { setMode('ensemble'); resetEnsemble() }}>Fire 400 (isotropic)</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Magnetic mirror simulation" />
      <div className="readouts">
        <span>loss-cone angle θ_m = <b>{thetaM.toFixed(1)}°</b></span>
        {mode === 'single' ? (
          <>
            <span>prediction: <b className={trapped ? 'ok' : ''}>{trapped ? 'trapped' : 'escapes'}</b></span>
            <span>now: <b>{status.state}</b></span>
            <span>μ / μ₀ = <b>{status.mu.toFixed(3)}</b></span>
          </>
        ) : (
          <>
            <span>lost so far: <b>{(lostFrac * 100).toFixed(1)}%</b></span>
            <span>theory 1 − cos θ_m: <b className={Math.abs(lostFrac - lossFraction(R)) < 0.03 ? 'ok' : ''}>{(lossFraction(R) * 100).toFixed(1)}%</b></span>
          </>
        )}
      </div>
      <div className="controls">
        <Slider label="Mirror ratio R = B_max / B₀" value={R} min={1.5} max={10} step={0.5} onChange={(v) => { setR(v); mode === 'single' ? resetSingle() : resetEnsemble() }} />
        {mode === 'single' && (
          <Slider label="Launch pitch angle θ₀" value={pitch} min={5} max={85} step={1} onChange={(v) => { setPitch(v); resetSingle(v) }} fmt={(v) => `${v}°`} />
        )}
      </div>
    </SimFrame>
  )
}
