// A4: where does the diamagnetic current come from? Thousands of particles gyrate about guiding centres
// that never move. In a density or temperature gradient, more of them cross a line one way than the other,
// so the fluid flows even though no guiding centre drifts.
import { useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { advanceDiamag, createDiamag, measuredFlux, meanDensity, theoryDrift, type Diamag } from '../physics/diamag'
import { SimFrame, Slider } from './SimFrame'

const LX = 32
const LY = 16
const N = 3200
const ARROW = 60 // arrow length (world units) per unit of fluid speed (v_th)

/** A handful of particles near the counting line whose orbits and fixed guiding centres are drawn. */
function pickTagged(d: Diamag): number[] {
  const out: number[] = []
  for (const f of [0.18, 0.32, 0.46, 0.6, 0.74, 0.88]) {
    const X = d.a + f * (d.b - d.a)
    let best = -1
    let bd = Infinity
    for (let i = 0; i < d.N; i++) {
      const dy = Math.abs(d.Y[i] - d.y0)
      if (dy > 2.2 || d.rho[i] < 0.8 || d.rho[i] > 2.0) continue
      const dist = Math.abs(d.X[i] - X) + 0.3 * Math.abs(dy - 1.2)
      if (dist < bd) {
        bd = dist
        best = i
      }
    }
    if (best >= 0) out.push(best)
  }
  return out
}

export function DiamagSim() {
  const [running, setRunning] = useState(true)
  const [gn, setGn] = useState(0.04)
  const [gT, setGT] = useState(0)
  const [charge, setCharge] = useState<1 | -1>(1)
  const [speed, setSpeed] = useState(2)
  const [orbits, setOrbits] = useState(true)
  const make = (g = gn, t = gT, q = charge) => createDiamag({ n: N, Lx: LX, Ly: LY, gn: g, gT: t, charge: q })
  const sim = useRef<Diamag>(make())
  const tags = useRef<number[]>(pickTagged(sim.current))
  const [stats, setStats] = useState({ up: 0, down: 0, u: 0, periods: 0 })

  const restart = (g = gn, t = gT, q = charge) => {
    sim.current = make(g, t, q)
    tags.current = pickTagged(sim.current)
    setStats({ up: 0, down: 0, u: 0, periods: 0 })
  }

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 0.8 : 0.55, () => draw(), 520)

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const d = sim.current
    const tagged = tags.current
    const head = 20 * u // legend strip above the box
    const foot = 22 * u // gradient labels under the box
    // phones show the middle 24 of the 32 units so the orbits stay big enough to see
    const vx0 = c.clientWidth < 560 ? 4 : 0
    const VW = LX - 2 * vx0
    const sc = Math.min(W / VW, (H - head - foot) / LY) // one scale for x and y so orbits stay circular
    const ox = (W - VW * sc) / 2
    const oy = head + (H - head - foot - LY * sc) / 2
    const X = (x: number) => ox + (x - vx0) * sc
    const Y = (y: number) => oy + (LY - y) * sc // y up
    const wrapY = (y: number) => ((y % LY) + LY) % LY
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)

    // measurement band
    ctx.fillStyle = 'rgba(34,211,238,0.06)'
    ctx.fillRect(X(d.a), Y(LY), (d.b - d.a) * sc, LY * sc)
    ctx.setLineDash([4 * u, 5 * u])
    ctx.strokeStyle = 'rgba(143,255,255,0.35)'
    ctx.lineWidth = u
    ctx.beginPath()
    ctx.moveTo(X(d.a), Y(0))
    ctx.lineTo(X(d.a), Y(LY))
    ctx.moveTo(X(d.b), Y(0))
    ctx.lineTo(X(d.b), Y(LY))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = COLORS.grid
    ctx.strokeRect(X(vx0), Y(LY), VW * sc, LY * sc)

    // particles
    const col = charge > 0 ? COLORS.magenta : COLORS.cyan
    ctx.fillStyle = col
    ctx.globalAlpha = 0.75
    const r = Math.max(1, 1.5 * u)
    for (let i = 0; i < d.N; i++) {
      const px = d.x[i]
      if (px < vx0 || px > vx0 + VW) continue
      ctx.fillRect(X(px) - r / 2, Y(wrapY(d.y[i])) - r / 2, r, r)
    }
    ctx.globalAlpha = 1

    // tagged orbits and their fixed guiding centres
    if (orbits) {
      for (const i of tagged) {
        ctx.strokeStyle = 'rgba(232,234,246,0.28)'
        ctx.lineWidth = u
        ctx.beginPath()
        ctx.arc(X(d.X[i]), Y(d.Y[i]), d.rho[i] * sc, 0, 7)
        ctx.stroke()
        ctx.strokeStyle = COLORS.white
        ctx.lineWidth = 1.5 * u
        const gx = X(d.X[i])
        const gy = Y(d.Y[i])
        const s = 4 * u
        ctx.beginPath()
        ctx.moveTo(gx - s, gy)
        ctx.lineTo(gx + s, gy)
        ctx.moveTo(gx, gy - s)
        ctx.lineTo(gx, gy + s)
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.shadowColor = col
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(X(d.x[i]), Y(wrapY(d.y[i])), 3.2 * u, 0, 7)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // recent crossings of the counting line
    for (let i = 0; i < d.N; i++) {
      const f = d.flash[i]
      if (f === 0) continue
      ctx.globalAlpha = Math.min(1, Math.abs(f))
      ctx.fillStyle = f > 0 ? COLORS.lime : COLORS.amber
      ctx.beginPath()
      ctx.arc(X(d.x[i]), Y(wrapY(d.y[i])), 2.8 * u, 0, 7)
      ctx.fill()
      d.flash[i] = f > 0 ? Math.max(0, f - 0.06) : Math.min(0, f + 0.06)
    }
    ctx.globalAlpha = 1

    // counting line
    glowStroke(ctx, COLORS.glow, 1.6 * u, () => {
      ctx.moveTo(X(d.a), Y(d.y0))
      ctx.lineTo(X(d.b), Y(d.y0))
    })

    // fluid velocity arrows at the band centre: measured (solid) beside theory (dashed)
    const uMeas = measuredFlux(d) / meanDensity(d)
    const uTh = theoryDrift(d)
    const arrow = (x: number, v: number, color: string, dashed: boolean) => {
      const len = Math.max(-LY * 0.42, Math.min(LY * 0.42, v * ARROW)) * sc
      if (Math.abs(len) < 2 * u) return
      const x0 = X(x)
      const y0 = Y(d.y0)
      const y1 = y0 - len
      const hd = Math.sign(len) * Math.min(8 * u, Math.abs(len) / 2)
      if (dashed) ctx.setLineDash([4 * u, 4 * u])
      glowStroke(ctx, color, 2.4 * u, () => {
        ctx.moveTo(x0, y0)
        ctx.lineTo(x0, y1)
      })
      ctx.setLineDash([])
      glowStroke(ctx, color, 2.4 * u, () => {
        ctx.moveTo(x0 - 6 * u, y1 + hd)
        ctx.lineTo(x0, y1)
        ctx.lineTo(x0 + 6 * u, y1 + hd)
      })
    }
    const xm = (d.a + d.b) / 2
    arrow(xm - 0.7, uMeas, COLORS.lime, false)
    arrow(xm + 0.7, uTh, COLORS.white, true)

    // labels
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const label = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
      ctx.textAlign = align
      const w = ctx.measureText(text).width
      const bx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2
      ctx.fillStyle = 'rgba(3,7,16,0.72)'
      ctx.fillRect(bx - 3 * u, y - fs, w + 6 * u, fs + 5 * u)
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
    }
    label(charge > 0 ? 'IONS (+)' : 'ELECTRONS (−)', X(vx0) + 6 * u, Y(LY) + 16 * u, col)
    label('⊙ B out of screen', X(vx0 + VW) - 6 * u, Y(LY) + 16 * u, COLORS.text, 'right')
    label(`↑ ${d.up}`, X(d.a) + 4 * u, Y(d.y0) - 7 * u, COLORS.lime)
    label(`↓ ${d.down}`, X(d.b) - 4 * u, Y(d.y0) + 17 * u, COLORS.amber, 'right')
    const tipY = (v: number) => Y(d.y0) - Math.max(-LY * 0.42, Math.min(LY * 0.42, v * ARROW)) * sc + (v >= 0 ? -4 * u : 13 * u)
    label(`u ×${ARROW}`, X(xm - 0.7) - 4 * u, tipY(uMeas), COLORS.lime, 'right')
    label('v_D', X(xm + 0.7) + 4 * u, tipY(uTh), COLORS.white, 'left')

    // legend above the box
    ctx.textAlign = 'left'
    let lx = X(vx0)
    const ly = oy - 6 * u
    const item = (sym: () => void, text: string, color: string) => {
      sym()
      ctx.fillStyle = color
      ctx.fillText(text, lx + 12 * u, ly)
      lx += 12 * u + ctx.measureText(text).width + 14 * u
    }
    item(() => {
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 1.5 * u
      ctx.beginPath()
      ctx.moveTo(lx, ly - 4 * u)
      ctx.lineTo(lx + 8 * u, ly - 4 * u)
      ctx.moveTo(lx + 4 * u, ly - 8 * u)
      ctx.lineTo(lx + 4 * u, ly)
      ctx.stroke()
    }, 'guiding centre (fixed)', COLORS.white)
    for (const [text, color] of [['crossed ↑', COLORS.lime], ['crossed ↓', COLORS.amber]] as const) {
      item(() => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(lx + 4 * u, ly - 4 * u, 3 * u, 0, 7)
        ctx.fill()
      }, text, color)
    }

    // gradient labels under the box
    const fy = H - 8 * u
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    const short = c.clientWidth < 560
    const parts: string[] = []
    if (gn > 0) parts.push(short ? 'n' : 'density')
    if (gT > 0) parts.push(short ? 'T' : 'temperature')
    const what = parts.join(short ? ', ' : ' and ')
    ctx.fillText(parts.length ? `low ${what}` : 'uniform plasma', X(vx0), fy)
    ctx.textAlign = 'right'
    ctx.fillText(parts.length ? `high ${what}` : '', X(vx0 + VW), fy)
    if (parts.length) {
      ctx.textAlign = 'center'
      ctx.fillStyle = gT > 0 && gn === 0 ? COLORS.amber : COLORS.glow
      ctx.fillText(`∇${gn > 0 ? 'n' : ''}${gn > 0 && gT > 0 ? ', ∇' : ''}${gT > 0 ? 'T' : ''} →`, X(LX / 2), fy)
    }
    ctx.textAlign = 'left'
  }

  // redraw after resizes and slider changes while paused (the animation loop is not running then)
  useEffect(() => {
    if (!running) draw()
  })

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const dt = 0.05 * speed
      advanceDiamag(sim.current, dt, Math.ceil(dt / 0.025))
      if (++frame % 10 === 0) {
        const d = sim.current
        setStats({ up: d.up, down: d.down, u: measuredFlux(d) / meanDensity(d), periods: d.t / (2 * Math.PI) })
      }
      draw()
    },
    running,
  )

  const uTh = theoryDrift(sim.current)
  const ok = stats.periods >= 1 && Math.abs(stats.u - uTh) <= 0.1 * Math.abs(uTh) + 0.002

  return (
    <SimFrame
      id="diamagnetic"
      title="Where does the diamagnetic current come from?"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint="Units: lengths in thermal Larmor radii ρ = v_th/ω_c, speeds in v_th = √(kT/m), B out of the screen. Every guiding centre (+) is nailed in place, yet more ions cross the glowing line upward than downward, because the upward crossers come from the denser side. The band average (all horizontal lines in the shaded band) gives the fluid velocity. Try a temperature gradient with uniform density, then switch to electrons."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${charge > 0 ? 'primary' : ''}`} onClick={() => { setCharge(1); restart(gn, gT, 1) }}>Ions</button>
        <button className={`btn small ${charge < 0 ? 'primary' : ''}`} onClick={() => { setCharge(-1); restart(gn, gT, -1) }}>Electrons</button>
        <button className="btn small" onClick={() => setOrbits(!orbits)}>{orbits ? 'Hide orbits' : 'Show orbits'}</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Diamagnetic drift simulation" />
      <div className="readouts">
        <span>crossings: <b style={{ color: 'var(--lime)' }}>↑ {stats.up}</b> <b style={{ color: 'var(--amber)' }}>↓ {stats.down}</b></span>
        <span>guiding-centre velocity: <b>0</b></span>
        <span>fluid velocity u_y measured: <b className={ok ? 'ok' : ''}>{stats.periods > 0.05 ? stats.u.toFixed(4) : '…'}</b></span>
        <span>theory v_D = (∂p/∂x)/(qnB): <b>{uTh.toFixed(4)}</b></span>
        <span>time: <b>{stats.periods.toFixed(1)} gyro-periods</b></span>
      </div>
      <div className="controls">
        <Slider label="Density gradient ρ/L_n" value={gn} min={0} max={0.055} step={0.005} onChange={(v) => { setGn(v); restart(v) }} fmt={(v) => v.toFixed(3)} />
        <Slider label="Temperature gradient ρ/L_T" value={gT} min={0} max={0.05} step={0.005} onChange={(v) => { setGT(v); restart(gn, v) }} fmt={(v) => v.toFixed(3)} />
        <Slider label="Speed" value={speed} min={1} max={4} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
