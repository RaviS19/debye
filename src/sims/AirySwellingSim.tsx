// B1: the 1D standing wave of light reflected in a linear density ramp. The wave equation
// E'' + k0²(cos²θ − x/L)E = 0 is integrated numerically (RK4) and compared with the WKB envelope and
// the Airy solution; the peak swelling is measured against 3.6 (ωL/c)^{1/3} cos θ.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  AIRY_ZMAX,
  SWELL_COEF,
  airyIntensity,
  columnMinMax,
  peakIntensity,
  reflectionPhase,
  solveWave,
  swellingPeak,
  wkbEnvelope,
} from '../physics/lightRamp'
import { SimFrame, Slider } from './SimFrame'

const TWO_PI = 2 * Math.PI
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export function AirySwellingSim() {
  const [running, setRunning] = useState(true)
  const [lg, setLg] = useState(Math.log10(20)) // log10(L/λ)
  const [theta, setTheta] = useState(0)
  const [zoom, setZoom] = useState(false)
  const LoverLam = Math.round(10 ** lg * 10) / 10
  const k0L = TWO_PI * LoverLam
  const th = (theta * Math.PI) / 180

  const sol = useMemo(() => {
    const s = solveWave({ ramp: { kind: 'linear', L: k0L }, theta: th, h: k0L > 600 ? 0.1 : 0.05, vacuum: 1.5 * TWO_PI, depth: 6 })
    const airy = new Float64Array(s.n)
    for (let i = 0; i < s.n; i++) airy[i] = s.x[i] >= 0 ? airyIntensity(s.x[i], k0L, th) : NaN
    const pk = peakIntensity(s)
    // global phase of the standing wave (the field is real up to one complex constant when ν = 0)
    let bi = 0
    let best = 0
    for (let i = 0; i < s.n; i++) {
      const v = s.re[i] ** 2 + s.im[i] ** 2
      if (v > best) {
        best = v
        bi = i
      }
    }
    return { s, airy, pk, phi: Math.atan2(s.im[bi], s.re[bi]) }
  }, [k0L, th])

  const phase = useRef(0)
  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 0.95 : 0.52)
  const cols = useRef<{ mn: Float64Array; mx: Float64Array } | null>(null)
  // the static picture (grid, density, curves) is rendered once per set-up into two layers; each frame
  // only redraws the breathing E(x,t)² between them
  const layers = useRef<{ key: string; base: HTMLCanvasElement; top: HTMLCanvasElement } | null>(null)

  const geometry = (W: number, H: number, u: number) => {
    const { s, pk } = sol
    const padL = 34 * u
    const padR = 8 * u
    const top = 20 * u
    const bot = H - 24 * u
    const xT = s.xTurn
    const d = s.delta
    const x0 = zoom ? Math.max(s.x[0], xT - 12 * d) : s.x[0]
    const x1 = zoom ? xT + 4 * d : Math.min(s.x[s.n - 1], xT + 5 * d)
    const yMax = Math.max(4.5, pk.value) * 1.15
    const X = (x: number) => padL + ((x - x0) / (x1 - x0)) * (W - padL - padR)
    const Y = (v: number) => bot - (Math.min(v, yMax * 1.02) / yMax) * (bot - top)
    return { padL, padR, top, bot, x0, x1, yMax, X, Y }
  }

  const renderLayers = (W: number, H: number, u: number) => {
    const { s, airy, pk } = sol
    const { padL, padR, top, bot, x0, x1, yMax, X, Y } = geometry(W, H, u)
    const mk = (old?: HTMLCanvasElement) => {
      const cv = old ?? document.createElement('canvas')
      cv.width = W
      cv.height = H
      return cv
    }
    const base = mk(layers.current?.base)
    const topL = mk(layers.current?.top)
    const fs = (narrow ? 10.5 : 11.5) * u
    // ---- base: background, density, grid, markers, axes ----
    let ctx = base.getContext('2d')!
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = 'rgba(160,111,214,0.14)'
    ctx.beginPath()
    ctx.moveTo(X(x0), bot)
    for (let k = 0; k <= 200; k++) {
      const x = x0 + ((x1 - x0) * k) / 200
      const n = Math.min(1.3, Math.max(0, x) / k0L)
      ctx.lineTo(X(x), bot - n * 0.75 * (bot - top))
    }
    ctx.lineTo(X(x1), bot)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    const step = yMax > 40 ? 10 : yMax > 16 ? 5 : 2
    for (let v = 0; v <= yMax; v += step) {
      ctx.beginPath()
      ctx.moveTo(padL, Y(v))
      ctx.lineTo(W - padR, Y(v))
      ctx.stroke()
      ctx.fillText(String(v), padL - 4 * u, Y(v) + 4 * u)
    }
    const vline = (x: number, color: string, label: string, dash: number[], right = false) => {
      if (x < x0 || x > x1) return
      ctx.strokeStyle = color
      ctx.setLineDash(dash)
      ctx.lineWidth = 1.2 * u
      ctx.beginPath()
      ctx.moveTo(X(x), top)
      ctx.lineTo(X(x), bot)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.textAlign = right ? 'left' : 'right'
      ctx.fillText(label, X(x) + (right ? 4 : -4) * u, top - 6 * u)
    }
    vline(s.xTurn, COLORS.lime, theta > 0 ? 'n_c cos²θ' : 'n = n_c', [6 * u, 4 * u])
    if (theta > 0) vline(k0L, COLORS.amber, 'n_c', [], true)
    vline(0, COLORS.violet, narrow ? 'edge' : 'plasma edge', [3 * u, 4 * u], true)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    const span = (x1 - x0) / TWO_PI
    const tick = zoom ? (span > 12 ? 5 : span > 5 ? 2 : span > 2 ? 1 : 0.5) : [1, 2, 5, 10, 20, 50, 100].find((t) => span / t <= (narrow ? 4 : 7)) ?? 100
    const labelW = ctx.measureText('x / λ').width
    for (let t = Math.ceil(x0 / TWO_PI / tick) * tick; t <= x1 / TWO_PI; t += tick) {
      const px = X(t * TWO_PI)
      if (px < padL + 6 * u || px > W - padR - labelW - 14 * u) continue
      ctx.fillText(String(+t.toFixed(1)), px, H - 8 * u)
    }
    ctx.textAlign = 'right'
    ctx.fillText('x / λ', W - padR, H - 8 * u)
    ctx.save()
    ctx.translate(11 * u, (top + bot) / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('|E|² / |E_vac|²', 0, 0)
    ctx.restore()
    // ---- top: the curves (transparent layer) ----
    ctx = topL.getContext('2d')!
    ctx.clearRect(0, 0, W, H)
    const path = (val: (i: number) => number) => () => {
      let pen = false
      for (let i = 0; i < s.n; i++) {
        const x = s.x[i]
        const v = val(i)
        if (x < x0 || x > x1 || !isFinite(v)) {
          pen = false
          continue
        }
        if (pen) ctx.lineTo(X(x), Y(v))
        else ctx.moveTo(X(x), Y(v))
        pen = true
      }
    }
    // Airy (wide, under), then the numerical |E|² on top
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = COLORS.amber
    ctx.lineWidth = (narrow ? 3 : 4) * u
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    path((i) => airy[i])()
    ctx.stroke()
    ctx.globalAlpha = 1
    glowStroke(ctx, COLORS.cyan, 1.3 * u, path((i) => s.re[i] ** 2 + s.im[i] ** 2))
    // WKB envelope (smooth)
    ctx.strokeStyle = COLORS.magenta
    ctx.lineWidth = 1.6 * u
    ctx.setLineDash([7 * u, 5 * u])
    ctx.beginPath()
    let pen = false
    for (let k = 0; k <= 400; k++) {
      const x = x0 + ((x1 - x0) * k) / 400
      const v = wkbEnvelope(x, k0L, th)
      if (!isFinite(v) || v > yMax * 1.02) {
        pen = false
        continue
      }
      if (pen) ctx.lineTo(X(x), Y(v))
      else ctx.moveTo(X(x), Y(v))
      pen = true
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.white
    ctx.beginPath()
    ctx.arc(X(pk.x), Y(pk.value), 3.5 * u, 0, 7)
    ctx.fill()
    return { base, top: topL }
  }

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const { s } = sol
    const key = `${W}x${H}:${k0L}:${theta}:${zoom}`
    if (!layers.current || layers.current.key !== key) layers.current = { key, ...renderLayers(W, H, u) }
    ctx.drawImage(layers.current.base, 0, 0)
    // E(x,t)²: the standing wave breathing at 2ω
    const { padL, padR, bot, x0, x1, Y } = geometry(W, H, u)
    const ncol = Math.max(10, Math.round((W - padL - padR) / u))
    if (!cols.current || cols.current.mn.length !== ncol) cols.current = { mn: new Float64Array(ncol), mx: new Float64Array(ncol) }
    const { mn, mx } = cols.current
    const colX = (k: number) => padL + ((k + 0.5) / ncol) * (W - padL - padR)
    const cw = Math.cos(phase.current + sol.phi)
    const sw = Math.sin(phase.current + sol.phi)
    columnMinMax(s.x, s.n, (i) => (s.re[i] * cw + s.im[i] * sw) ** 2, x0, x1, mn, mx)
    ctx.fillStyle = 'rgba(34,211,238,0.18)'
    ctx.beginPath()
    ctx.moveTo(colX(0), bot)
    for (let k = 0; k < ncol; k++) if (isFinite(mx[k])) ctx.lineTo(colX(k), Y(mx[k]))
    ctx.lineTo(colX(ncol - 1), bot)
    ctx.closePath()
    ctx.fill()
    ctx.drawImage(layers.current.top, 0, 0)
  }

  useAnimation(
    canvas,
    (dt) => {
      phase.current += 0.045 * (dt / 16.7)
      draw()
    },
    running,
  )
  useEffect(() => {
    if (!running) draw()
  })

  const { s, pk } = sol
  const theory = swellingPeak(k0L, th)
  const okPeak = Math.abs(pk.value / theory - 1) < 0.01
  const below = (s.xTurn - pk.x) / s.delta
  const okPos = Math.abs(below / -AIRY_ZMAX - 1) < 0.01
  const phMeas = Math.atan2(s.rIm, s.rRe)
  const phTh = wrap(reflectionPhase(k0L, th))
  const okPh = Math.abs(wrap(phMeas - phTh)) < 0.05

  return (
    <SimFrame
      id="airy-swelling"
      title="Standing wave at the turning point"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setLg(Math.log10(20))
        setTheta(0)
        setZoom(false)
      }}
      hint="The cyan curve is |E|² from a numerical solution of the wave equation E″ + k0²(cos²θ − x/L)E = 0 in a linear ramp, normalized to the incident wave in vacuum; the shading under it is the instantaneous E(x,t)², a standing wave breathing at twice the laser frequency. Amber: the Airy solution 4π cos θ (ωL/c)^⅓ Ai²(ζ). Dashed magenta: the WKB envelope 4 cos θ/√(cos²θ − x/L), which blows up at the turning point where the Airy function stays finite. Lengths in vacuum wavelengths λ. Lengthen the ramp and watch the peak grow as L^⅓; zoom in to see that near the turning point every ramp looks the same in Airy units."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${!zoom ? 'primary' : ''}`} onClick={() => setZoom(false)}>Whole ramp</button>
        <button className={`btn small ${zoom ? 'primary' : ''}`} onClick={() => setZoom(true)}>Turning point</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Standing wave of light in a linear density ramp" />
      <div className="readouts">
        <span>
          peak |E|²/|E_vac|² = <b className={okPeak ? 'ok' : ''}>{pk.value.toFixed(2)}</b>; theory {SWELL_COEF.toFixed(2)} (ωL/c)^⅓ cos θ = <b>{theory.toFixed(2)}</b>
        </span>
        <span>
          peak sits <b className={okPos ? 'ok' : ''}>{below.toFixed(3)}</b> δ before the turning point (Airy: <b>{(-AIRY_ZMAX).toFixed(3)}</b> δ)
        </span>
        <span>
          reflection phase <b className={okPh ? 'ok' : ''}>{phMeas.toFixed(3)}</b> rad; (4/3)(ωL/c)cos³θ − π/2 = <b>{phTh.toFixed(3)}</b> (mod 2π)
        </span>
        <span>
          ωL/c = <b>{k0L.toFixed(0)}</b>, δ = (c²L/ω²)^⅓ = <b>{(s.delta / TWO_PI).toFixed(2)}</b> λ, |r|² = <b>{s.R.toFixed(4)}</b>
        </span>
      </div>
      <div className="controls">
        <Slider label="Scale length L / λ" value={lg} min={Math.log10(2)} max={Math.log10(200)} step={0.01} onChange={setLg} fmt={() => String(LoverLam)} />
        <Slider label="Angle of incidence θ (s-polarized)" value={theta} min={0} max={60} step={1} onChange={setTheta} fmt={(x) => `${x}°`} />
      </div>
    </SimFrame>
  )
}
