// B4: electrons in a focused beam. A cloud of test electrons at rest in the focal plane of a laser spot
// E ∝ exp(−r²/w²) cos ωt, followed exactly (Lorentz force with the field's own magnetic field, RK4). One tracer
// electron is shown with its period-averaged path, the guiding-centre path predicted by the ponderomotive force,
// a zoom on its quiver, and the energy bookkeeping: drift energy + U_p is conserved, so the electron leaves with
// exactly the ponderomotive energy of the point where it started.
import { useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  createCentre,
  createElectrons,
  STEPS_PER_PERIOD,
  stepCentre,
  stepElectrons,
  upNorm,
  type Centre,
  type Electrons,
  type FocusParams,
  type Polarization,
} from '../physics/ponderomotive'
import { SimFrame, Slider } from './SimFrame'

const N = STEPS_PER_PERIOD
const H = (2 * Math.PI) / N
const N_CLOUD = 90
const T_ON = 10 * Math.PI // five periods of smooth turn-on
const T_MAX = 3000 * 2 * Math.PI
const SPEEDS = [0.25, 0.5, 1, 2, 4] // laser periods per frame
const VIEW = 2.4 // half-width of the view in units of w
const ME_KEV = 510.999

interface Sample {
  t: number // periods, at mid-period
  x: number
  y: number
  X: number // guiding centre
  Y: number
  ke: number // drift energy ½|v̄|² (m_e c²)
  up: number // U_p at the mean position (m_e c²)
  keGc: number
}

interface Run {
  p: FocusParams
  x0: number
  y0: number
  up0: number
  el: Electrons
  start: Float64Array // initial cloud positions (for the "where they came from" ghosts)
  gc: Centre
  k: number
  sx: number
  sy: number
  svx: number
  svy: number
  gx: number
  gy: number
  gvx: number
  gvy: number
  px: Float64Array // tracer x and y over the current period
  py: Float64Array
  ring: Float64Array // tracer x, y over the last two periods (x0,y0,x1,y1,…), oldest first after unrolling
  ringPos: number
  ringFill: number
  avg: Sample[]
  quiver: { amp: number; pred: number; f: number } | null
  maxDev: number
  done: boolean
}

function newRun(p: FocusParams, r0: number, angDeg: number): Run {
  const x0 = r0 * p.w * Math.cos((angDeg * Math.PI) / 180)
  const y0 = r0 * p.w * Math.sin((angDeg * Math.PI) / 180)
  const pos: [number, number][] = [[x0, y0]]
  // the cloud: a golden-angle spiral filling r < 1.6 w uniformly
  for (let i = 0; i < N_CLOUD; i++) {
    const r = 1.6 * p.w * Math.sqrt((i + 0.5) / N_CLOUD)
    const a = i * 2.399963
    pos.push([r * Math.cos(a), r * Math.sin(a)])
  }
  const el = createElectrons(pos)
  return {
    p,
    x0,
    y0,
    up0: upNorm(p, x0 * x0 + y0 * y0, 1e9),
    el,
    start: Float64Array.from(pos.flat()),
    gc: createCentre(x0, y0),
    k: 0,
    sx: 0,
    sy: 0,
    svx: 0,
    svy: 0,
    gx: x0,
    gy: y0,
    gvx: 0,
    gvy: 0,
    px: new Float64Array(N),
    py: new Float64Array(N),
    ring: new Float64Array(4 * N),
    ringPos: 0,
    ringFill: 0,
    avg: [{ t: 0, x: x0, y: y0, X: x0, Y: y0, ke: 0, up: 0, keGc: 0 }],
    quiver: null,
    maxDev: 0,
    done: false,
  }
}

/** One RK4 step for the cloud, the tracer and its guiding centre, with the period bookkeeping. */
function stepRun(R: Run) {
  const { p, el, gc } = R
  stepElectrons(el, p, H, 3.2 * p.w)
  stepCentre(gc, p, H)
  const x = el.x[0]
  const y = el.y[0]
  R.px[R.k] = x
  R.py[R.k] = y
  R.ring[2 * R.ringPos] = x
  R.ring[2 * R.ringPos + 1] = y
  R.ringPos = (R.ringPos + 1) % (2 * N)
  R.ringFill = Math.min(2 * N, R.ringFill + 1)
  R.sx += x
  R.sy += y
  R.svx += el.vx[0]
  R.svy += el.vy[0]
  if (R.k === N / 2 - 1) {
    R.gx = gc.s[0]
    R.gy = gc.s[1]
    R.gvx = gc.s[2]
    R.gvy = gc.s[3]
  }
  R.k++
  if (R.k < N) return
  // a full period: record the averages
  const mx = R.sx / N
  const my = R.sy / N
  const vx = R.svx / N
  const vy = R.svy / N
  const tMid = el.t - Math.PI
  R.avg.push({
    t: tMid / (2 * Math.PI),
    x: mx,
    y: my,
    X: R.gx,
    Y: R.gy,
    ke: 0.5 * (vx * vx + vy * vy),
    up: upNorm(p, mx * mx + my * my, tMid),
    keGc: 0.5 * (R.gvx * R.gvx + R.gvy * R.gvy),
  })
  const f = Math.exp(-(mx * mx + my * my) / (p.w * p.w))
  if (el.t > p.tOn + 2 * Math.PI && f > 0.25) {
    // quiver excursion along x, after removing the slow drift across the period
    let lo = Infinity
    let hi = -Infinity
    for (let k = 0; k < N; k++) {
      const d = R.px[k] - vx * H * (k - (N - 1) / 2)
      lo = Math.min(lo, d)
      hi = Math.max(hi, d)
    }
    R.quiver = { amp: 0.5 * (hi - lo), pred: p.a0 * f, f }
  }
  const trav = Math.hypot(R.gx - R.x0, R.gy - R.y0)
  if (trav > 0.1 * p.w && Math.hypot(R.gx, R.gy) < 2.5 * p.w) R.maxDev = Math.max(R.maxDev, Math.hypot(mx - R.gx, my - R.gy) / trav)
  R.k = 0
  R.sx = R.sy = R.svx = R.svy = 0
  if (Math.hypot(mx, my) > 3 * p.w || el.t > T_MAX) R.done = true
}

interface Stats {
  t: number
  ke: number
  slow: number
  up: number
  done: boolean
  quiver: Run['quiver']
  maxDev: number
  inside: number
}

export function FocusSim() {
  const [running, setRunning] = useState(true)
  const [pol, setPol] = useState<Polarization>('linear')
  const [vxb, setVxb] = useState(true)
  const [a0, setA0] = useState(0.1)
  const [w, setW] = useState(20)
  const [r0, setR0] = useState(0.5)
  const [ang, setAng] = useState(30)
  const [si, setSi] = useState(2)
  const [gen, setGen] = useState(0)
  const run = useRef<Run | null>(null) as React.MutableRefObject<Run>
  if (!run.current) run.current = newRun({ a0, w, pol, tOn: T_ON, vxb }, r0, ang)
  const [stats, setStats] = useState<Stats | null>(null)
  const lastStats = useRef(0)

  useEffect(() => {
    run.current = newRun({ a0, w, pol, tOn: T_ON, vxb }, r0, ang)
    setStats(null)
    drawRef.current()
  }, [a0, w, pol, vxb, r0, ang, gen])

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.5 : 0.56, () => drawRef.current(), narrow ? 640 : 470)
  const drawRef = useRef<() => void>(() => {})

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const Hc = c.height
    const u = W / c.clientWidth
    const stacked = c.clientWidth < 560
    const R = run.current
    const p = R.p
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, Hc)
    const fs = (stacked ? 10.5 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const gap = 10 * u
    let M: [number, number, number]
    let Q: [number, number, number, number]
    let E: [number, number, number, number]
    if (stacked) {
      const side = Math.min(W, Hc * 0.6)
      M = [(W - side) / 2, 0, side]
      const hq = Hc - side - gap
      const wq = Math.min(W * 0.42, hq)
      Q = [0, side + gap, wq, hq]
      E = [wq + gap, side + gap, W - wq - gap, hq]
    } else {
      const side = Hc
      M = [0, 0, side]
      const hq = Hc * 0.46
      Q = [side + gap, 0, W - side - gap, hq]
      E = [side + gap, hq + gap, W - side - gap, Hc - hq - gap]
    }
    const tNow = R.el.t
    const g = upNorm(p, 0, tNow) / upNorm(p, 0, 1e9) // g² of the turn-on

    // ---------- main panel: the focal plane ----------
    {
      const [x0, y0, side] = M
      const cx = x0 + side / 2
      const cy = y0 + side / 2
      const s = (side / 2 - 4 * u) / (VIEW * p.w) // px per c/ω
      const PX = (x: number) => cx + x * s
      const PY = (y: number) => cy - y * s
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, y0, side, side)
      ctx.clip()
      // intensity |E|² ∝ exp(−2r²/w²), scaled by the turn-on
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 2 * p.w * s)
      for (let i = 0; i <= 10; i++) {
        const r = (2 * i) / 10
        rg.addColorStop(i / 10, `rgba(34,211,238,${(0.42 * g * Math.exp(-2 * r * r)).toFixed(4)})`)
      }
      ctx.fillStyle = rg
      ctx.fillRect(x0, y0, side, side)
      // axes and the 1/e radius of the field
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      ctx.beginPath()
      ctx.moveTo(x0, cy)
      ctx.lineTo(x0 + side, cy)
      ctx.moveTo(cx, y0)
      ctx.lineTo(cx, y0 + side)
      ctx.stroke()
      ctx.setLineDash([4 * u, 4 * u])
      ctx.strokeStyle = 'rgba(34,211,238,0.45)'
      ctx.beginPath()
      ctx.arc(cx, cy, p.w * s, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(154,160,201,0.35)'
      ctx.beginPath()
      ctx.arc(cx, cy, 2 * p.w * s, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.setLineDash([])
      // the cloud
      const el = R.el
      ctx.fillStyle = 'rgba(232,234,246,0.85)'
      for (let i = 1; i < el.n; i++) {
        ctx.beginPath()
        ctx.arc(PX(el.x[i]), PY(el.y[i]), 2.1 * u, 0, 2 * Math.PI)
        ctx.fill()
      }
      // guiding centre (prediction) and the tracer's period-averaged path
      const av = R.avg
      ctx.setLineDash([5 * u, 4 * u])
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 1.6 * u
      ctx.beginPath()
      av.forEach((q, i) => (i ? ctx.lineTo(PX(q.X), PY(q.Y)) : ctx.moveTo(PX(q.X), PY(q.Y))))
      ctx.lineTo(PX(R.gc.s[0]), PY(R.gc.s[1]))
      ctx.stroke()
      ctx.setLineDash([])
      glowStroke(ctx, COLORS.magenta, 1.6 * u, () => av.forEach((q, i) => (i ? ctx.lineTo(PX(q.x), PY(q.y)) : ctx.moveTo(PX(q.x), PY(q.y)))))
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 1.5 * u
      ctx.beginPath()
      ctx.arc(PX(R.gc.s[0]), PY(R.gc.s[1]), 6 * u, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.shadowColor = COLORS.magenta
      ctx.shadowBlur = 12 * u
      ctx.beginPath()
      ctx.arc(PX(el.x[0]), PY(el.y[0]), 4 * u, 0, 2 * Math.PI)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = COLORS.magenta
      ctx.beginPath()
      ctx.arc(PX(el.x[0]), PY(el.y[0]), 2.4 * u, 0, 2 * Math.PI)
      ctx.fill()
      ctx.restore()
      // labels
      ctx.fillStyle = COLORS.white
      ctx.textAlign = 'left'
      ctx.fillText('focal plane', x0 + 6 * u, y0 + 14 * u)
      ctx.fillStyle = COLORS.text
      ctx.fillText(`t = ${(tNow / (2 * Math.PI)).toFixed(0)} periods`, x0 + 6 * u, y0 + 28 * u)
      if (tNow < p.tOn) {
        ctx.fillStyle = COLORS.cyan
        ctx.fillText('laser turning on…', x0 + 6 * u, y0 + 42 * u)
      }
      ctx.fillStyle = 'rgba(34,211,238,0.85)'
      ctx.fillText('w', cx + p.w * s * 0.72 + 3 * u, cy + p.w * s * 0.72 + 12 * u)
      ctx.fillStyle = COLORS.text
      ctx.fillText('2w', cx + 2 * p.w * s * 0.72 + 3 * u, cy + 2 * p.w * s * 0.72 + 12 * u)
      // polarization badge
      const bx = x0 + side - 44 * u
      const by = y0 + 26 * u
      ctx.strokeStyle = COLORS.cyan
      ctx.fillStyle = COLORS.cyan
      ctx.lineWidth = 1.6 * u
      if (p.pol === 'linear') {
        ctx.beginPath()
        ctx.moveTo(bx - 16 * u, by)
        ctx.lineTo(bx + 16 * u, by)
        ctx.stroke()
        for (const sg of [-1, 1]) {
          ctx.beginPath()
          ctx.moveTo(bx + sg * 19 * u, by)
          ctx.lineTo(bx + sg * 12 * u, by - 4 * u)
          ctx.lineTo(bx + sg * 12 * u, by + 4 * u)
          ctx.fill()
        }
      } else {
        ctx.beginPath()
        ctx.arc(bx, by, 11 * u, -0.3, 1.5 * Math.PI)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(bx + 11 * u * Math.cos(-0.3) + 4 * u, by + 11 * u * Math.sin(-0.3) + 1 * u)
        ctx.lineTo(bx + 11 * u * Math.cos(-0.3) - 4 * u, by + 11 * u * Math.sin(-0.3) + 2 * u)
        ctx.lineTo(bx + 11 * u * Math.cos(-0.3) + 1 * u, by + 11 * u * Math.sin(-0.3) - 6 * u)
        ctx.fill()
      }
      ctx.textAlign = 'center'
      ctx.fillText('E', bx, by + (p.pol === 'linear' ? 18 : 26) * u)
      // legend
      ctx.textAlign = 'left'
      let ly = y0 + side - (vxb ? 34 : 48) * u
      const lx = x0 + 6 * u
      ctx.fillStyle = COLORS.magenta
      ctx.fillText('tracer, period-averaged path', lx, ly)
      ly += 14 * u
      ctx.fillStyle = COLORS.amber
      ctx.fillText('ponderomotive prediction  R̈ = −∇U_p/m', lx, ly)
      if (!vxb) {
        ly += 14 * u
        ctx.fillStyle = COLORS.red
        ctx.fillText('v × B switched off', lx, ly)
      }
    }

    // ---------- quiver zoom ----------
    {
      const [x0, y0, w, h] = Q
      const top = y0 + 30 * u
      const bot = y0 + h - 18 * u
      const cx = x0 + w / 2
      const cy = (top + bot) / 2
      const half = Math.min(w / 2 - 8 * u, (bot - top) / 2)
      const q = half / (1.3 * p.a0) // px per c/ω
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = u
      ctx.strokeRect(cx - half, cy - half, 2 * half, 2 * half)
      ctx.strokeStyle = COLORS.grid
      ctx.beginPath()
      ctx.moveTo(cx - half, cy)
      ctx.lineTo(cx + half, cy)
      ctx.moveTo(cx, cy - half)
      ctx.lineTo(cx, cy + half)
      ctx.stroke()
      ctx.fillStyle = COLORS.white
      ctx.textAlign = 'left'
      ctx.fillText(stacked ? 'quiver (zoom)' : 'quiver of the tracer (zoomed)', x0 + 2 * u, y0 + 12 * u)
      const sMain = (M[2] / 2 - 4 * u) / (VIEW * p.w)
      ctx.fillStyle = COLORS.text
      ctx.fillText(`×${Math.round(q / sMain)}, last 2 periods`, x0 + 2 * u, y0 + 25 * u)
      // prediction: excursion eE(r̄)/mω² = a0 f(r̄)
      const last = R.avg[R.avg.length - 1]
      const fNow = Math.exp(-(last.x * last.x + last.y * last.y) / (p.w * p.w)) * Math.sqrt(g)
      const pr = p.a0 * fNow * q
      ctx.setLineDash([4 * u, 3 * u])
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 1.3 * u
      ctx.beginPath()
      if (p.pol === 'linear') {
        ctx.moveTo(cx - pr, cy - half)
        ctx.lineTo(cx - pr, cy + half)
        ctx.moveTo(cx + pr, cy - half)
        ctx.lineTo(cx + pr, cy + half)
      } else ctx.arc(cx, cy, Math.max(pr, 0.1), 0, 2 * Math.PI)
      ctx.stroke()
      ctx.setLineDash([])
      // the tracer over the last two periods, minus a straight-line fit (the slow drift)
      const nP = R.ringFill
      if (nP > 4) {
        const pts: [number, number][] = []
        for (let i = 0; i < nP; i++) {
          const j = (R.ringPos - nP + i + 4 * N) % (2 * N)
          pts.push([R.ring[2 * j], R.ring[2 * j + 1]])
        }
        const fit = (k: 0 | 1) => {
          let st = 0
          let sv = 0
          let stt = 0
          let stv = 0
          for (let i = 0; i < nP; i++) {
            st += i
            sv += pts[i][k]
            stt += i * i
            stv += i * pts[i][k]
          }
          const b = (nP * stv - st * sv) / (nP * stt - st * st || 1)
          const a = (sv - b * st) / nP
          return (i: number) => a + b * i
        }
        const fx = fit(0)
        const fy = fit(1)
        const QX = (i: number) => cx + Math.max(-1.45 * p.a0, Math.min(1.45 * p.a0, pts[i][0] - fx(i))) * q
        const QY = (i: number) => cy - Math.max(-1.45 * p.a0, Math.min(1.45 * p.a0, pts[i][1] - fy(i))) * q
        glowStroke(ctx, COLORS.magenta, 1.6 * u, () => {
          for (let i = 0; i < nP; i++) (i ? ctx.lineTo(QX(i), QY(i)) : ctx.moveTo(QX(i), QY(i)))
        })
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(QX(nP - 1), QY(nP - 1), 3 * u, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.textAlign = 'center'
      if (fNow < 0.03) {
        ctx.fillStyle = COLORS.text
        const on = tNow < p.tOn
        ctx.fillText(on ? 'light turning on…' : 'tracer has left the beam:', cx, cy - half * 0.45)
        if (!on) ctx.fillText('no quiver left', cx, cy - half * 0.45 + 14 * u)
      }
      ctx.fillStyle = COLORS.amber
      ctx.fillText(`eE/mω² = ${(p.a0 * fNow).toFixed(3)} c/ω`, cx, y0 + h - 4 * u)
    }

    // ---------- energy bookkeeping ----------
    {
      const [x0, y0, w, h] = E
      const padL = 30 * u
      const padR = 6 * u
      const top = y0 + (stacked ? 54 : 40) * u
      const bot = y0 + h - 30 * u
      const av = R.avg
      const tEnd = av[av.length - 1].t
      const span = [20, 50, 100, 200, 500, 1000, 2000, 5000].find((v) => v >= tEnd * 1.05) ?? 5000
      const X = (t: number) => x0 + padL + (t / span) * (w - padL - padR)
      const Y = (v: number) => bot - (Math.min(v, 1.3) / 1.3) * (bot - top)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      for (const v of [0, 0.5, 1]) {
        ctx.beginPath()
        ctx.moveTo(X(0), Y(v))
        ctx.lineTo(X(span), Y(v))
        ctx.stroke()
        ctx.fillText(v.toFixed(1), X(0) - 4 * u, Y(v) + 4 * u)
      }
      ctx.textAlign = 'center'
      for (let i = 0; i <= 4; i++) ctx.fillText(String((span * i) / 4), X((span * i) / 4), bot + 13 * u)
      ctx.fillText('time (laser periods)', X(span / 2), bot + 26 * u)
      ctx.strokeStyle = COLORS.axis
      ctx.strokeRect(X(0), top, X(span) - X(0), bot - top)
      const up0 = R.up0
      const line = (get: (q: Sample) => number, col: string, wd: number, dash?: number[]) => {
        if (av.length < 2) return
        if (dash) {
          ctx.setLineDash(dash.map((d) => d * u))
          ctx.strokeStyle = col
          ctx.lineWidth = wd
          ctx.beginPath()
          av.forEach((q, i) => (i ? ctx.lineTo(X(q.t), Y(get(q) / up0)) : ctx.moveTo(X(q.t), Y(get(q) / up0))))
          ctx.stroke()
          ctx.setLineDash([])
        } else glowStroke(ctx, col, wd, () => av.forEach((q, i) => (i ? ctx.lineTo(X(q.t), Y(get(q) / up0)) : ctx.moveTo(X(q.t), Y(get(q) / up0)))))
      }
      line((q) => q.up, COLORS.violet, 1.6 * u)
      line((q) => q.ke + q.up, 'rgba(232,234,246,0.8)', 1.3 * u, [2, 3])
      line((q) => q.keGc, COLORS.amber, 1.6 * u, [6, 4])
      line((q) => q.ke, COLORS.cyan, 1.7 * u)
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.white
      ctx.fillText(stacked ? 'energy ÷ U_p(start)' : 'energy of the tracer ÷ U_p at its start', x0 + 2 * u, y0 + 12 * u)
      let lx = x0 + 2 * u
      let ly = y0 + 26 * u
      const leg = (col: string, txt: string) => {
        const wt = ctx.measureText(txt).width
        if (lx + wt > x0 + w) {
          lx = x0 + 2 * u
          ly += 13 * u
        }
        ctx.fillStyle = col
        ctx.fillText(txt, lx, ly)
        lx += wt + 10 * u
      }
      leg(COLORS.cyan, 'drift ½mv̄²')
      leg(COLORS.violet, 'U_p(r̄)')
      leg(COLORS.white, 'sum')
      leg(COLORS.amber, 'theory')
    }
  }

  drawRef.current = draw
  useAnimation(
    canvas,
    (dt) => {
      const R = run.current
      if (!R.done) {
        const steps = Math.max(1, Math.round(SPEEDS[si] * N * Math.min(dt, 25) / 16.7))
        for (let i = 0; i < steps && !R.done; i++) stepRun(R)
      }
      draw()
      const now = performance.now()
      if (now - lastStats.current > 180) {
        lastStats.current = now
        const last = R.avg[R.avg.length - 1]
        let inside = 0
        for (let i = 1; i < R.el.n; i++) if (Math.hypot(R.el.x[i], R.el.y[i]) < R.p.w) inside++
        setStats({ t: last.t, ke: last.ke, slow: last.ke + last.up, up: last.up, done: R.done, quiver: R.quiver, maxDev: R.maxDev, inside })
      }
    },
    running,
  )
  useEffect(() => {
    if (!running) draw()
  })

  // practical units at λ = 1 µm
  const k = pol === 'linear' ? 0.25 : 0.5
  const I18 = pol === 'linear' ? (a0 / 0.8549) ** 2 : (a0 / 0.6045) ** 2
  const upPeakKeV = k * a0 * a0 * ME_KEV
  const R = run.current
  const up0 = R.up0
  const keRatio = stats ? stats.ke / up0 : 0
  const slowRatio = stats ? stats.slow / up0 : 0
  const out = stats ? stats.up < 0.01 * up0 && stats.t > T_ON / (2 * Math.PI) : false
  const fmtSci = (v: number) => {
    const ex = Math.floor(Math.log10(v))
    return `${(v / 10 ** ex).toFixed(2)}×10${String(ex).replace(/[-0-9]/g, (d) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(d)])}`
  }
  const fmtE = (keV: number) => (keV >= 1 ? `${keV.toFixed(keV < 10 ? 2 : 1)} keV` : `${(keV * 1000).toFixed(0)} eV`)

  return (
    <SimFrame
      id="focus-electrons"
      title="Electrons in a focused beam"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setPol('linear')
        setVxb(true)
        setA0(0.1)
        setW(20)
        setR0(0.5)
        setAng(30)
        setSi(2)
        setGen((n) => n + 1)
      }}
      hint="Exact orbits of electrons in the focal plane of a laser spot, with the spot's own magnetic field included. The laser turns on smoothly over five periods. Every electron quivers (zoom panel) and slowly slides down the intensity hill: the electron cloud is pushed out of the beam whatever the starting point, and the magenta path follows the amber ponderomotive prediction. Watch the energy panel: drift energy + U_p stays constant, so the electron leaves with exactly U_p of its starting point. Now switch the v × B force off. With linear polarization the electrons then move only along E (the x axis): the push across the polarization comes entirely from the magnetic force. With circular polarization they leave with only half of U_p."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${pol === 'linear' ? 'primary' : ''}`} onClick={() => setPol('linear')}>linear polarization</button>
        <button className={`btn small ${pol === 'circular' ? 'primary' : ''}`} onClick={() => setPol('circular')}>circular</button>
        <button className={`btn small ${vxb ? '' : 'primary'}`} onClick={() => setVxb(!vxb)}>{vxb ? 'switch v × B off' : 'v × B is off: switch on'}</button>
        <button className="btn small" onClick={() => setGen((n) => n + 1)}>Restart</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Test electrons expelled from a laser focal spot, with a zoom on the quiver and the energy of the tracer electron" />
      <div className="readouts">
        <span>
          drift energy ½m v̄² of the tracer = <b className={out && Math.abs(keRatio - 1) < 0.03 ? 'ok' : ''}>{keRatio.toFixed(3)}</b> U_p(start)
          {out ? ' (out of the beam)' : stats ? ` (drift + U_p = ${slowRatio.toFixed(3)})` : ''}
        </span>
        <span>
          quiver excursion: measured <b className={stats?.quiver && Math.abs(stats.quiver.amp / stats.quiver.pred - 1) < 0.03 ? 'ok' : ''}>{stats?.quiver ? `${stats.quiver.amp.toFixed(4)} c/ω` : '…'}</b> vs eE(r̄)/mω² ={' '}
          <b>{stats?.quiver ? `${stats.quiver.pred.toFixed(4)} c/ω` : '…'}</b>
        </span>
        <span>
          slow path vs ponderomotive prediction: <b className={stats && stats.maxDev < 0.05 ? 'ok' : ''}>{stats ? `${(stats.maxDev * 100).toFixed(1)}%` : '…'}</b> of the distance travelled
        </span>
        <span>
          electrons inside r &lt; w: <b>{stats ? stats.inside : '…'}</b> of {N_CLOUD}
        </span>
        <span>
          at λ = 1 µm: I = <b>{fmtSci(I18 * 1e18)} W/cm²</b>, U_p at the centre <b>{fmtE(upPeakKeV)}</b>, at the start <b>{fmtE(up0 * ME_KEV)}</b>, w = <b>{(w / (2 * Math.PI)).toFixed(1)} µm</b>
        </span>
      </div>
      <div className="controls">
        <Slider label="Field amplitude a₀ = eE₀/mωc" value={a0} min={0.05} max={0.25} step={0.01} onChange={setA0} fmt={(v) => v.toFixed(2)} />
        <Slider label="Spot radius ωw/c" value={w} min={10} max={40} step={1} onChange={setW} fmt={(v) => `${v} (w = ${(v / (2 * Math.PI)).toFixed(1)} λ)`} />
        <Slider label="Tracer starts at r₀/w" value={r0} min={0.1} max={1.5} step={0.05} onChange={setR0} fmt={(v) => v.toFixed(2)} />
        <Slider label="Tracer start angle from E (x axis)" value={ang} min={0} max={90} step={5} onChange={setAng} fmt={(v) => `${v}°`} />
        <Slider label="Speed" value={si} min={0} max={SPEEDS.length - 1} step={1} onChange={setSi} fmt={(i) => `${SPEEDS[i]} periods/frame`} />
      </div>
    </SimFrame>
  )
}
