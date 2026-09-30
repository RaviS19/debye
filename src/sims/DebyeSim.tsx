// A1: drop a test charge into a plasma and watch the electrons form a shielding cloud.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { createDebye, radialProfile, sweepDebye, theoryDensity, type DebyeState } from '../physics/debye'
import { debyeLength, plasmaParameter, sci } from '../physics/constants'
import { SimFrame, Slider } from './SimFrame'

const VIEW = 2.5e-3 // metres across the box
const N = 1400

export function DebyeSim() {
  const [running, setRunning] = useState(true)
  const [logn, setLogn] = useState(16)
  const [T, setT] = useState(10)
  const [strength, setStrength] = useState(0.8)
  const [sign, setSign] = useState<1 | -1>(1)
  const sim = useRef<DebyeState>(createDebye(N))
  const profile = useRef<number[]>(new Array(12).fill(1))
  const ions = useMemo(() => Array.from({ length: 160 }, () => [Math.random(), Math.random()]), [])

  const n = 10 ** logn
  const lamPhys = debyeLength(n, T)
  const lam = Math.max(0.025, Math.min(0.35, lamPhys / VIEW))
  const clipped = lam !== lamPhys / VIEW
  sim.current.lambda = lam
  sim.current.strength = strength
  sim.current.charges[0].sign = sign

  const canvas = useCanvas(0.75)
  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const S = Math.min(W, H) // square physics box, centred
    const ox = (W - S) / 2
    const s = sim.current
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    // ions: fixed background
    ctx.strokeStyle = 'rgba(160,111,214,0.45)'
    ctx.lineWidth = 1
    for (const [x, y] of ions) {
      const px = ox + x * S
      const py = y * S
      ctx.beginPath()
      ctx.moveTo(px - 3, py)
      ctx.lineTo(px + 3, py)
      ctx.moveTo(px, py - 3)
      ctx.lineTo(px, py + 3)
      ctx.stroke()
    }
    // electrons
    ctx.fillStyle = COLORS.cyan
    ctx.shadowColor = COLORS.cyan
    ctx.shadowBlur = 6
    for (let i = 0; i < s.xs.length; i++) ctx.fillRect(ox + s.xs[i] * S - 1.3, s.ys[i] * S - 1.3, 2.6, 2.6)
    ctx.shadowBlur = 0
    // test charge and λ_D circles
    const q = s.charges[0]
    const cx = ox + q.x * S
    const cy = q.y * S
    ctx.setLineDash([5, 6])
    for (const k of [1, 2]) {
      ctx.strokeStyle = k === 1 ? 'rgba(251,191,36,0.9)' : 'rgba(251,191,36,0.35)'
      ctx.beginPath()
      ctx.arc(cx, cy, s.lambda * S * k, 0, 7)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.amber
    ctx.font = `${12 * (W / c.clientWidth)}px Exo, sans-serif`
    ctx.fillText('λD', cx + s.lambda * S * 0.72, cy - s.lambda * S * 0.72)
    const col = q.sign > 0 ? COLORS.magenta : COLORS.lime
    ctx.fillStyle = col
    ctx.shadowColor = col
    ctx.shadowBlur = 22
    ctx.beginPath()
    ctx.arc(cx, cy, 9 * (W / c.clientWidth), 0, 7)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#000'
    ctx.font = `bold ${13 * (W / c.clientWidth)}px Exo, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(q.sign > 0 ? '+' : '−', cx, cy + 4.5 * (W / c.clientWidth))
    ctx.textAlign = 'left'
    // inset: radial density profile vs Boltzmann theory
    const iw = W * 0.3
    const ih = H * 0.28
    const ix = W - iw - 10
    const iy = H - ih - 10
    ctx.fillStyle = 'rgba(5,11,24,0.88)'
    ctx.strokeStyle = COLORS.axis
    ctx.fillRect(ix, iy, iw, ih)
    ctx.strokeRect(ix, iy, iw, ih)
    const rMax = 3 * s.lambda
    const maxY = Math.max(3, ...profile.current) * 1.05
    const PX = (r: number) => ix + (r / rMax) * iw
    const PY = (v: number) => iy + ih - (v / maxY) * ih
    ctx.strokeStyle = 'rgba(143,255,255,0.25)'
    ctx.beginPath()
    ctx.moveTo(ix, PY(1))
    ctx.lineTo(ix + iw, PY(1))
    ctx.stroke()
    glowStroke(ctx, COLORS.magenta, 1.5, () => {
      for (let k = 0; k <= 40; k++) {
        const r = (0.02 + (k / 40) * 0.98) * rMax
        const v = Math.min(theoryDensity(s, r), maxY)
        if (k) ctx.lineTo(PX(r), PY(v))
        else ctx.moveTo(PX(r), PY(v))
      }
    })
    ctx.fillStyle = COLORS.cyan
    profile.current.forEach((v, b) => {
      const r = ((b + 0.5) / profile.current.length) * rMax
      ctx.beginPath()
      ctx.arc(PX(r), PY(Math.min(v, maxY)), 2.5 * (W / c.clientWidth), 0, 7)
      ctx.fill()
    })
    ctx.fillStyle = COLORS.text
    ctx.font = `${10 * (W / c.clientWidth)}px "PT Sans", sans-serif`
    ctx.fillText('n_e(r)/n₀ · dots: measured · line: Boltzmann', ix + 4, iy + 12 * (W / c.clientWidth))
    ctx.fillText('0', ix + 2, iy + ih - 3)
    ctx.fillText('3λD', ix + iw - 22 * (W / c.clientWidth), iy + ih - 3)
  }

  let frames = 0
  useAnimation(
    canvas,
    () => {
      sweepDebye(sim.current, 0.035)
      sweepDebye(sim.current, 0.035)
      if (++frames % 6 === 0) {
        const p = radialProfile(sim.current, 12, 3 * sim.current.lambda)
        profile.current = profile.current.map((v, i) => 0.8 * v + 0.2 * p[i])
      }
      draw()
    },
    running,
  )

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === 'pointermove' && e.buttons === 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const S = Math.min(r.width, r.height)
    const x = (e.clientX - r.left - (r.width - S) / 2) / S
    const y = (e.clientY - r.top) / S
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    sim.current.charges[0].x = x
    sim.current.charges[0].y = y
    if (!running) draw()
  }

  return (
    <SimFrame
      id="debye"
      title="Debye shielding"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        sim.current = createDebye(N)
        profile.current = new Array(12).fill(1)
      }}
      hint="Tap or drag to move the test charge. Electrons (cyan) crowd around a positive charge and flee a negative one. Ions (violet crosses) are too heavy to respond on this timescale. Inside the dashed circle the charge is felt; beyond about two Debye lengths it is hidden."
    >
      <canvas ref={canvas} className="sim" onPointerDown={move} onPointerMove={move} aria-label="Debye shielding simulation" />
      <div className="readouts">
        <span>λ_D = <b>{sci(lamPhys * 1e3)} mm</b></span>
        <span>N_D = <b>{sci(plasmaParameter(n, T))}</b></span>
        <span>box = <b>{VIEW * 1e3} mm</b></span>
        {clipped && <span style={{ color: 'var(--amber)' }}>λ_D outside the view scale; circle clamped</span>}
      </div>
      <div className="controls">
        <Slider label="Electron temperature" value={T} min={1} max={60} step={0.5} onChange={setT} fmt={(v) => `${v} eV`} />
        <Slider label="Density" value={logn} min={15} max={17.5} step={0.05} onChange={setLogn} fmt={(v) => `${sci(10 ** v)} m⁻³`} />
        <Slider label="Test-charge strength (eφ/kT at λ_D)" value={strength} min={0.1} max={1.4} step={0.05} onChange={setStrength} />
        <div className="ctrl">
          <label><span>Test charge sign</span></label>
          <div className="row">
            <button className={`btn small ${sign > 0 ? 'primary' : ''}`} onClick={() => setSign(1)}>Positive</button>
            <button className={`btn small ${sign < 0 ? 'primary' : ''}`} onClick={() => setSign(-1)}>Negative</button>
          </div>
        </div>
      </div>
    </SimFrame>
  )
}
