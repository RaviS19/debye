// A2: orbit sandbox. B points out of the screen. Add E, a gradient in B, or gravity, and watch
// an ion and an electron drift, sometimes together and sometimes in opposite directions.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { borisStep, type FieldFn, type Particle } from '../physics/boris'
import { SimFrame, Slider } from './SimFrame'

const WX = 24 // world width
const WY = 12 // world height; ion lane centred at +3, electron lane at −3
const ME = 0.2 // electron mass, reduced from 1/1836 so both orbits stay visible

interface Track { p: Particle; x0: number; trail: [number, number][]; lane: number; color: string }

export function OrbitSim() {
  const [running, setRunning] = useState(true)
  const [E, setE] = useState(0.15)
  const [B0, setB0] = useState(1)
  const [grad, setGrad] = useState(0)
  const [g, setG] = useState(0)
  const [vperp, setVperp] = useState(0.8)

  // B along z with a gradient along y. Gravity is added per species below as the
  // equivalent electric field m g / q, so each charge feels the force it should.
  const field: FieldFn = (x) => ({ E: [0, E, 0], B: [0, 0, Math.max(B0 * (1 + grad * x[1]), 0.05)] })

  const spawn = (): Track[] => [
    { p: { x: [2, 0, 0], v: [E / B0, vperp, 0], q: 1, m: 1 }, x0: 2, trail: [], lane: 3, color: COLORS.magenta },
    { p: { x: [2, 0, 0], v: [E / B0, vperp, 0], q: -1, m: ME }, x0: 2, trail: [], lane: -3, color: COLORS.cyan },
  ]
  const tracks = useRef<Track[]>(spawn())
  const time = useRef(0)
  const [drift, setDrift] = useState<[number, number]>([0, 0])

  // theory: v_E + v_∇B + v_g along x (E along +y, ∇B along +y, g along −y, B along +z)
  const theory = (q: number, m: number) => {
    const vE = E / B0
    const vGrad = (-Math.sign(q) * m * vperp * vperp * grad) / (2 * Math.abs(q) * B0)
    const vG = (-(m / q) * g) / B0
    return vE + vGrad + vG
  }

  const canvas = useCanvas(0.6)
  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    // one scale for both axes so circles stay circles when the canvas height is capped
    const sc = Math.min(W / WX, H / WY)
    const ox = (W - WX * sc) / 2
    const sx = sc
    const sy = sc
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = COLORS.grid
    ctx.strokeRect(ox, 0, WX * sc, H)
    // B out of the screen: dotted lattice, denser where B is stronger
    for (const lane of [3, -3]) {
      for (let yy = -2.5; yy <= 2.5; yy += 1) {
        const Bl = B0 * (1 + grad * yy)
        const gap = Math.max(0.6, 1.6 / Math.max(Bl, 0.1))
        for (let xx = 0.3; xx < WX; xx += gap) {
          ctx.fillStyle = 'rgba(143,255,255,0.18)'
          ctx.beginPath()
          ctx.arc(ox + xx * sx, H / 2 - (lane + yy) * sy, 1.6 * u, 0, 7)
          ctx.fill()
        }
      }
    }
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(0, H / 2)
    ctx.lineTo(W, H / 2)
    ctx.stroke()
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('ION (+)', 8 * u, 14 * u)
    ctx.fillStyle = COLORS.cyan
    ctx.fillText('ELECTRON (−)', 8 * u, H / 2 + 14 * u)
    ctx.fillStyle = COLORS.text
    ctx.fillText('⊙ B out of screen', W - 110 * u, 14 * u)
    // arrows for E and g
    const arrow = (x: number, y: number, dy: number, col: string, label: string) => {
      ctx.strokeStyle = col
      ctx.fillStyle = col
      ctx.lineWidth = 2 * u
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y - dy)
      ctx.lineTo(x - 5 * u, y - dy + 7 * u * Math.sign(dy))
      ctx.moveTo(x, y - dy)
      ctx.lineTo(x + 5 * u, y - dy + 7 * u * Math.sign(dy))
      ctx.stroke()
      ctx.fillText(label, x + 8 * u, y - dy / 2)
      ctx.lineWidth = 1
    }
    if (E) arrow(W - 40 * u, H / 2 - 20 * u, Math.sign(E) * 36 * u, COLORS.amber, 'E')
    if (g) arrow(W - 40 * u, H / 2 + 60 * u, -36 * u, COLORS.lime, 'g')
    if (grad) arrow(W - 80 * u, H / 2 - 20 * u, Math.sign(grad) * 36 * u, COLORS.violet, '∇B')

    for (const t of tracks.current) {
      glowStroke(ctx, t.color, 1.6 * u, () => {
        let prev: number | null = null
        for (const [x, y] of t.trail) {
          const px = ox + (((x % WX) + WX) % WX) * sx
          const py = H / 2 - (t.lane + y) * sy
          if (prev === null || Math.abs(px - prev) > W / 2) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
          prev = px
        }
      })
      const [x, y] = t.p.x
      ctx.fillStyle = '#fff'
      ctx.shadowColor = t.color
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(ox + (((x % WX) + WX) % WX) * sx, H / 2 - (t.lane + y) * sy, 4.5 * u, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  useAnimation(
    canvas,
    () => {
      const dt = 0.02
      for (let s = 0; s < 6; s++) {
        for (const t of tracks.current) {
          const gForce: FieldFn = (x, tt) => {
            const b = field(x, tt)
            return { E: [b.E[0], b.E[1] - (t.p.m * g) / t.p.q, 0], B: b.B }
          }
          borisStep(t.p, gForce, time.current, dt)
        }
        time.current += dt
      }
      for (const t of tracks.current) {
        t.trail.push([t.p.x[0], t.p.x[1]])
        if (t.trail.length > 700) t.trail.shift()
      }
      if (Math.round(time.current / 0.12) % 15 === 0 && time.current > 2 * Math.PI) {
        setDrift([
          (tracks.current[0].p.x[0] - tracks.current[0].x0) / time.current,
          (tracks.current[1].p.x[0] - tracks.current[1].x0) / time.current,
        ])
      }
      draw()
    },
    running,
  )

  const reset = () => {
    tracks.current = spawn()
    time.current = 0
    setDrift([0, 0])
  }
  const set = (fn: (v: number) => void) => (v: number) => {
    fn(v)
    setTimeout(reset, 0)
  }

  const presets: [string, () => void][] = [
    ['Pure gyration', () => { setE(0); setGrad(0); setG(0) }],
    ['E × B', () => { setE(0.15); setGrad(0); setG(0) }],
    ['∇B drift', () => { setE(0); setGrad(0.12); setG(0) }],
    ['Gravity drift', () => { setE(0); setGrad(0); setG(0.12) }],
  ]

  return (
    <SimFrame
      id="orbit"
      title="Orbit sandbox"
      running={running}
      setRunning={setRunning}
      onReset={reset}
      hint="Top lane: an ion. Bottom lane: an electron. Both see the same fields. With E×B they drift together at E/B. With a field gradient or gravity they drift in opposite directions, and opposite charges moving apart is a current. The electron is shown 5× lighter than the ion (the real ratio is 1836) so its orbit stays visible."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {presets.map(([label, fn]) => (
          <button key={label} className="btn small" onClick={() => { fn(); setTimeout(reset, 0) }}>{label}</button>
        ))}
      </div>
      <canvas ref={canvas} className="sim" aria-label="Charged particle orbit simulation" />
      <div className="readouts">
        <span style={{ color: 'var(--magenta)' }}>ion drift: <b>{drift[0].toFixed(3)}</b> (theory {theory(1, 1).toFixed(3)})</span>
        <span style={{ color: 'var(--cyan)' }}>electron drift: <b>{drift[1].toFixed(3)}</b> (theory {theory(-1, ME).toFixed(3)})</span>
      </div>
      <div className="controls">
        <Slider label="Electric field E (up)" value={E} min={-0.3} max={0.3} step={0.01} onChange={set(setE)} />
        <Slider label="Magnetic field B₀" value={B0} min={0.5} max={2} step={0.05} onChange={set(setB0)} />
        <Slider label="Field gradient ∇B/B (up)" value={grad} min={0} max={0.15} step={0.01} onChange={set(setGrad)} />
        <Slider label="Gravity g (down)" value={g} min={0} max={0.2} step={0.01} onChange={set(setG)} />
        <Slider label="Gyration speed v⊥" value={vperp} min={0.2} max={1.4} step={0.05} onChange={set(setVperp)} />
      </div>
    </SimFrame>
  )
}
