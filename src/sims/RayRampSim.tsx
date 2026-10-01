// B1: ray tracing in a laser-produced density ramp. A focused fan of rays (Hamilton's ray equations,
// RK4) enters a linear or exponential profile; each ray turns where n_e = n_c cos²θ for its own angle.
// Dots ride along the rays at the group velocity; joined across the fan they trace the pulse front (equal group delay),
// which in a plasma is not a surface of constant phase.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { airyWidth, density, traceRay, type Ramp, type RampKind, type Ray } from '../physics/lightRamp'
import { SimFrame, Slider } from './SimFrame'

const LSTOPS = [5, 8, 10, 15, 20, 30, 50, 80, 100, 150, 200]
const FSTOPS = [2, 3, 4, 5, 6, 8, 10, 15, 20, 40]
const TWO_PI = 2 * Math.PI

interface Fan {
  ramp: Ramp
  rays: Ray[]
  central: Ray
  xc: number // critical surface
  Lx: number // horizontal scale for the view
  t0: number
  t1: number
}

function buildFan(kind: RampKind, LoverLam: number, thetaDeg: number, fnum: number, nRays: number): Fan {
  const L = TWO_PI * LoverLam
  const ramp: Ramp = { kind, L }
  const th0 = (thetaDeg * Math.PI) / 180
  const alpha = Math.atan(1 / (2 * fnum))
  const xc = kind === 'linear' ? L : 0
  const Lx = kind === 'linear' ? L : 1.5 * L
  const cosMin = Math.cos(Math.min(1.45, Math.abs(th0) + alpha))
  // start on a circle about the vacuum focus (aimed at the critical surface): in vacuum, equal times = wavefront
  const R = (kind === 'linear' ? 1.6 * L : 7.5 * L) / cosMin
  const dt = L / 250
  const tMax = 2 * R + 8 * L
  const xStop = xc - 1.3 * Lx - 3 * L
  const rays: Ray[] = []
  for (let i = 0; i < nRays; i++) {
    const th = th0 + alpha * (nRays > 1 ? (2 * i) / (nRays - 1) - 1 : 0)
    rays.push(traceRay(ramp, xc - R * Math.cos(th), -R * Math.sin(th), th, dt, tMax, xStop))
  }
  const central = rays[(nRays - 1) / 2]
  // animate from when the central ray enters the view until about when it leaves again (the way out
  // mirrors the way in)
  const xL = xc - 1.3 * Lx
  let i0 = 0
  while (i0 < central.n - 1 && central.xs[i0] < xL) i0++
  const t0 = Math.max(0, i0 - 10) * dt
  const tTurn = central.turn ? central.turn.t : (central.n - 1) * dt
  return { ramp, rays, central, xc, Lx, t0, t1: Math.min((central.n - 1) * dt, tTurn + 1.1 * (tTurn - t0)) }
}

export function RayRampSim() {
  const [running, setRunning] = useState(true)
  const [kind, setKind] = useState<RampKind>('linear')
  const [theta, setTheta] = useState(25)
  const [fi, setFi] = useState(4) // F/6
  const [li, setLi] = useState(6) // L = 50 λ
  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const nRays = narrow ? 9 : 11
  const LoverLam = LSTOPS[li]
  const fnum = FSTOPS[fi]
  const fan = useMemo(() => buildFan(kind, LoverLam, theta, fnum, nRays), [kind, LoverLam, theta, fnum, nRays])
  const clock = useRef(0)
  const bg = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null)
  useEffect(() => {
    clock.current = fan.t0
  }, [fan])

  const canvas = useCanvas(narrow ? 1.05 : 0.6)

  // view box with equal scales on x and y, fitted to the central ray
  const view = (W: number, H: number) => {
    const { central, xc, Lx } = fan
    let xL = xc - 1.3 * Lx
    const xR = xc + 0.22 * Lx
    let yIn = 0
    for (let i = 0; i < central.n; i++) {
      if (central.xs[i] >= xL) {
        yIn = central.ys[i]
        break
      }
    }
    const yt = central.turn ? central.turn.y : 0
    let yB = Math.min(yIn, yt) - 0.08 * Lx
    let yT = Math.max(yIn, yt) + 0.3 * Lx
    const a = H / W
    if ((yT - yB) / (xR - xL) < a) {
      // spare height goes mostly above the turning point, where the rays head back out
      const extra = a * (xR - xL) - (yT - yB)
      yT += 0.6 * extra
      yB -= 0.4 * extra
    } else {
      // steep beams: widen the view part of the way and let the incoming rays enter from the bottom edge
      const r = (yT - yB) / (xR - xL) / a
      const w = (xR - xL) * Math.sqrt(r)
      xL = xR - w
      yB = yT - a * w
    }
    const s = W / (xR - xL)
    return { xL, xR, yB, yT, s, X: (x: number) => (x - xL) * s, Y: (y: number) => H - (y - yB) * s }
  }

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const v = view(W, H)
    const { ramp, rays, central } = fan
    const th0 = (theta * Math.PI) / 180
    const cos2 = Math.cos(th0) ** 2
    // density background, cached per view
    const key = `${W}x${H}:${kind}:${LoverLam}:${theta}:${fnum}`
    if (!bg.current || bg.current.key !== key) {
      const off = bg.current?.canvas ?? document.createElement('canvas')
      off.width = W
      off.height = H
      const g = off.getContext('2d')!
      g.fillStyle = COLORS.bg
      g.fillRect(0, 0, W, H)
      for (let px = 0; px < W; px += 2) {
        const x = v.xL + (px + 1) / v.s
        const n = density(ramp, x)
        const t = Math.min(n, 1.5) / 1.5
        g.fillStyle = n > 1 ? `rgba(160,111,214,${0.42 + 0.12 * t})` : `rgba(160,111,214,${0.03 + 0.4 * t})`
        g.fillRect(px, 0, 2, H)
      }
      bg.current = { canvas: off, key }
    }
    ctx.drawImage(bg.current.canvas, 0, 0)

    const fs = (narrow ? 10.5 : 11.5) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    // contour lines: n_c/4, n_c cos²θ, n_c
    const xAt = (n: number) => (ramp.kind === 'linear' ? ramp.L * n : ramp.L * Math.log(n))
    const lines: { x: number; color: string; label: string; dash: number[] }[] = [
      { x: xAt(0.25), color: COLORS.magenta, label: 'n_c/4', dash: [3 * u, 5 * u] },
      { x: xAt(cos2), color: COLORS.lime, label: theta > 0 ? 'n_c cos²θ' : '', dash: [7 * u, 5 * u] },
      { x: xAt(1), color: COLORS.amber, label: 'n_c', dash: [] },
    ]
    const placed: { a: number; b: number; row: number }[] = []
    for (const ln of lines) {
      if (!ln.label && ln.color === COLORS.lime) continue
      const px = v.X(ln.x)
      if (px < 0 || px > W) continue
      ctx.strokeStyle = ln.color
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 1.3 * u
      ctx.setLineDash(ln.dash)
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, H)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      const w = ctx.measureText(ln.label).width
      let x0 = px + 4 * u
      if (x0 + w > W - 4 * u) x0 = px - 4 * u - w
      let row = 0
      while (placed.some((p) => p.row === row && x0 < p.b + 6 * u && x0 + w > p.a - 6 * u)) row++
      placed.push({ a: x0, b: x0 + w, row })
      ctx.fillStyle = ln.color
      ctx.fillText(ln.label, x0, 14 * u + row * fs * 1.3)
    }
    // Airy layer around the central turning point, where ray optics fails
    if (central.turn) {
      const d = airyWidth(ramp, th0)
      const a = v.X(central.turn.x - 2 * d)
      const b = v.X(central.turn.x + d)
      ctx.fillStyle = 'rgba(74,222,128,0.12)'
      ctx.fillRect(a, 0, Math.max(1, b - a), H)
    }
    // rays
    const stride = Math.max(1, Math.floor(central.n / 600))
    rays.forEach((r, k) => {
      const isC = r === central
      const path = () => {
        for (let i = 0; i < r.n; i += stride) {
          const px = v.X(r.xs[i])
          const py = v.Y(r.ys[i])
          if (i) ctx.lineTo(px, py)
          else ctx.moveTo(px, py)
        }
      }
      if (isC) glowStroke(ctx, COLORS.cyan, 1.8 * u, path)
      else {
        ctx.strokeStyle = k % 2 ? 'rgba(34,211,238,0.45)' : 'rgba(143,255,255,0.4)'
        ctx.lineWidth = 1.1 * u
        ctx.beginPath()
        path()
        ctx.stroke()
      }
      if (r.turn) {
        ctx.fillStyle = isC ? COLORS.lime : 'rgba(74,222,128,0.75)'
        ctx.beginPath()
        ctx.arc(v.X(r.turn.x), v.Y(r.turn.y), (isC ? 3.6 : 2.2) * u, 0, 7)
        ctx.fill()
      }
    })
    // photons at the current time, and the wavefront through them
    const t = clock.current
    const pts: [number, number][] = []
    for (const r of rays) {
      const f = t / r.dt
      const i = Math.floor(f)
      if (i < 0 || i >= r.n - 1) {
        pts.push([NaN, NaN])
        continue
      }
      const w = f - i
      pts.push([v.X(r.xs[i] * (1 - w) + r.xs[i + 1] * w), v.Y(r.ys[i] * (1 - w) + r.ys[i + 1] * w)])
    }
    ctx.strokeStyle = 'rgba(232,234,246,0.55)'
    ctx.lineWidth = 1.2 * u
    ctx.beginPath()
    let pen = false
    for (const [px, py] of pts) {
      if (!isFinite(px)) {
        pen = false
        continue
      }
      if (pen) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
      pen = true
    }
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.shadowColor = COLORS.glow
    ctx.shadowBlur = 10 * u
    for (const [px, py] of pts) {
      if (!isFinite(px)) continue
      ctx.beginPath()
      ctx.arc(px, py, 2.6 * u, 0, 7)
      ctx.fill()
    }
    ctx.shadowBlur = 0
    // labels and a scale bar
    ctx.fillStyle = COLORS.glow
    ctx.textAlign = 'left'
    ctx.fillText('laser →', 8 * u, H - 10 * u)
    ctx.fillStyle = COLORS.violet
    ctx.textAlign = 'right'
    ctx.fillText(narrow ? 'denser →' : 'density rises →', W - 8 * u, H - 10 * u)
    const bar = LoverLam * TWO_PI * (kind === 'linear' ? 0.25 : 0.5)
    const barPx = bar * v.s
    const bx = W / 2 - barPx / 2
    ctx.strokeStyle = COLORS.text
    ctx.lineWidth = 1.5 * u
    ctx.beginPath()
    ctx.moveTo(bx, H - 14 * u)
    ctx.lineTo(bx + barPx, H - 14 * u)
    ctx.stroke()
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.fillText(`${(bar / TWO_PI).toFixed(bar / TWO_PI < 10 ? 1 : 0)} λ`, W / 2, H - 19 * u)
    ctx.textAlign = 'left'
  }

  useAnimation(
    canvas,
    (dtMs) => {
      const span = fan.t1 - fan.t0
      clock.current += (span / 480) * (dtMs / 16.7)
      if (clock.current > fan.t1) clock.current = fan.t0
      draw()
    },
    running,
  )
  useEffect(() => {
    if (!running) draw()
  })

  // readouts (central ray)
  const th0 = (theta * Math.PI) / 180
  const cos2 = Math.cos(th0) ** 2
  const turn = fan.central.turn
  const L = TWO_PI * LoverLam
  const uMeas = turn ? turn.u : NaN
  const ok = turn && Math.abs(uMeas / cos2 - 1) < 0.005
  const depthMeas = turn ? (kind === 'linear' ? turn.x : -turn.x) / TWO_PI : NaN
  const depthTh = (kind === 'linear' ? L * cos2 : -L * Math.log(cos2)) / TWO_PI
  const us = fan.rays.map((r) => (r.turn ? r.turn.u : NaN)).filter(isFinite)
  const delta = airyWidth(fan.ramp, th0) / TWO_PI

  return (
    <SimFrame
      id="ray-ramp"
      title="Rays in a density ramp"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        clock.current = fan.t0
        setRunning(true)
      }}
      hint="A focused beam (cyan rays) enters the plasma from the left; the shading is the electron density. Each ray is integrated with RK4 from Hamilton's equations dx/dt = ∂ω/∂k, dk/dt = −∂ω/∂x. The white dots ride along the rays at the group velocity: they show where a short pulse is at one instant (in vacuum the line through them is the wavefront; in the plasma it is the pulse front, which is not a surface of constant phase). Watch them slow down and crowd together where the rays turn. Lengths are in vacuum wavelengths λ. Tilt the beam: the turning point (lime) moves out from n_c to n_c cos²θ. Rays at larger angles turn earlier, so a fast (low f-number) beam turns over a spread of densities. The green band marks the Airy layer, a few δ wide, where ray optics breaks down."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${kind === 'linear' ? 'primary' : ''}`} onClick={() => setKind('linear')}>Linear ramp</button>
        <button className={`btn small ${kind === 'exp' ? 'primary' : ''}`} onClick={() => setKind('exp')}>Exponential ramp</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Ray tracing of a laser beam in a density ramp" />
      <div className="readouts">
        <span>
          central ray turns at n = <b className={ok ? 'ok' : ''}>{uMeas.toFixed(4)}</b> n_c; theory n_c cos²θ = <b>{cos2.toFixed(4)}</b> n_c
        </span>
        <span>
          {kind === 'linear' ? 'depth into the ramp' : 'distance below n_c'}: <b className={ok ? 'ok' : ''}>{depthMeas.toFixed(2)}</b> λ; theory{' '}
          {kind === 'linear' ? 'L cos²θ' : 'L ln(1/cos²θ)'} = <b>{depthTh.toFixed(2)}</b> λ
        </span>
        <span>
          fan turns between <b>{Math.min(...us).toFixed(2)}</b> and <b>{Math.max(...us).toFixed(2)}</b> n_c
        </span>
        <span>
          Airy layer δ ≈ <b>{delta.toFixed(2)}</b> λ = <b>{((delta / LoverLam) * 100).toFixed(1)}%</b> of L
        </span>
      </div>
      <div className="controls">
        <Slider label="Angle of incidence θ" value={theta} min={0} max={60} step={1} onChange={setTheta} fmt={(x) => `${x}°`} />
        <Slider label="Beam f-number" value={fi} min={0} max={FSTOPS.length - 1} step={1} onChange={setFi} fmt={(i) => `f/${FSTOPS[i]} (±${((Math.atan(1 / (2 * FSTOPS[i])) * 180) / Math.PI).toFixed(1)}°)`} />
        <Slider label="Scale length L / λ" value={li} min={0} max={LSTOPS.length - 1} step={1} onChange={setLi} fmt={(i) => String(LSTOPS[i])} />
      </div>
    </SimFrame>
  )
}
