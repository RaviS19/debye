// B9 flagship: run your own 1D electromagnetic PIC simulation of stimulated Raman scattering. A laser enters
// from the left, crosses a vacuum gap and an underdense slab of mobile electrons (ions fixed), and leaves at the
// right. Top: the light split into its right-moving part (the laser) and left-moving part (the backscatter), the
// plasma wave E_x, and the electrons' phase space. Bottom: the spectrum of the light leaving through the left
// edge with the Raman line from the matching conditions, the reflectivity against time, and f(u_x) with its hot
// tail. Units: ω0 = c = 1.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useCanvas } from '../components/useCanvas'
import { createEmPic, laserDrive, meanSquare, peakFrequency, slabDensity, spectrumOf, srsPrediction, stepEmPic, vteOf, type EmPic } from '../physics/emPic'
import { quiverOverC } from '../physics/lightRamp'
import { sci } from '../physics/constants'
import { SimFrame, Slider } from './SimFrame'

const DX = 0.2 // cell size and time step, in c/ω0 and 1/ω0
const GAP = 15 // vacuum on each side
const LEN = 100 // slab length, ramps included
const RAMP = 5
const NX = Math.round((2 * GAP + LEN) / DX)
const LBOX = NX * DX
const NFFT = 512 // samples of the reflected light (every 4 steps: a window of 410/ω0)
const FRAME_MS = 5.5 // physics budget per frame
const NXB = 260 // phase-space image bins
const NVB = 110
const NFV = 120 // f(u_x) bins
const T_END = 3000
const MAXWELL_TAIL = 3.17e-5 // fraction of a 1D Maxwellian with u_x > 4 v_te

const intensity = (a0: number, lam: number) => 1e18 * (a0 / quiverOverC(1e18, lam)) ** 2
const PS_PER_UNIT = (0.351e-6 / (2 * Math.PI * 2.99792458e8)) * 1e12 // 1/ω0 in ps at 351 nm

interface Readout {
  first: number // Raman peak when the reflectivity first passed 1%
  t: number
  R: number
  Ravg: number
  peak: number
  hot: number
  escaped: number
  escE: number
  msStep: number
  steps: number
}

/**
 * useAnimation (useCanvas.ts) for a sim with two canvases: the loop runs while either canvas is on screen. On a phone
 * the two panels stack and can be taller than the screen, so the diagnostics may be in view while the main canvas is not.
 */
function useAnimation2(
  a: React.RefObject<HTMLCanvasElement | null>,
  b: React.RefObject<HTMLCanvasElement | null>,
  frame: (dtMs: number) => void,
  running: boolean,
) {
  const f = useRef(frame)
  f.current = frame
  useEffect(() => {
    const ca = a.current
    const cb = b.current
    if (!ca || !cb || !running) return
    let visA = true
    let visB = true
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === ca) visA = e.isIntersecting
        else visB = e.isIntersecting
      }
    })
    io.observe(ca)
    io.observe(cb)
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(t - last, 50)
      last = t
      if (visA || visB) f.current(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [a, b, running])
}

export function PicSrsSim() {
  const [running, setRunning] = useState(true)
  const [nn, setNn] = useState(0.1)
  const [T, setT] = useState(2)
  const [a0, setA0] = useState(0.08)
  const [ppc, setPpc] = useState(32)
  const [speed, setSpeed] = useState(8)
  const make = (n = nn, te = T, a = a0, p = ppc) =>
    createEmPic({ nx: NX, dx: DX, density: (x) => slabDensity({ x0: GAP, x1: GAP + LEN, ramp: RAMP, n }, x), ppc: p, TeKeV: te, laser: laserDrive(a), seed: 1 })
  const sim = useRef<EmPic>(null as unknown as EmPic)
  if (!sim.current) sim.current = make()
  const hist = useRef<{ t: number[]; R: number[] }>({ t: [], R: [] })
  const sums = useRef({ inS: 0, outS: 0, seen: 0 })
  const firstPeak = useRef(NaN)
  const spec = useRef<{ omega: Float64Array; power: Float64Array } | null>(null)
  const timing = useRef({ ms: 0.8 })
  const psImg = useRef<{ canvas: HTMLCanvasElement; data: ImageData; bins: Float32Array } | null>(null)
  const fv = useRef(new Float64Array(NFV))
  const [ro, setRo] = useState<Readout>({ first: NaN, t: 0, R: 0, Ravg: 0, peak: NaN, hot: 0, escaped: 0, escE: 0, msStep: 0, steps: 0 })

  const restart = (n = nn, te = T, a = a0, p = ppc) => {
    sim.current = make(n, te, a, p)
    hist.current = { t: [], R: [] }
    sums.current = { inS: 0, outS: 0, seen: 0 }
    spec.current = null
    firstPeak.current = NaN
    setRo({ first: NaN, t: 0, R: 0, Ravg: 0, peak: NaN, hot: 0, escaped: 0, escE: 0, msStep: 0, steps: 0 })
    setRunning(true)
  }

  const pr = useMemo(() => srsPrediction(nn, T, a0), [nn, T, a0])
  const vte = vteOf(T)
  const lD = vte / Math.sqrt(nn)
  // velocity window: thermal core, the plasma wave's phase velocity and room above it for trapped electrons
  const uHi = Math.max(0.45, 6 * vte, pr ? 2.3 * pr.vphi : 0)
  const uLo = -Math.max(0.3, 6 * vte)

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.3 : 0.74, undefined, 600)
  const canvas2 = useCanvas(narrow ? 1.35 : 0.34, undefined, 520)

  const drawMain = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const s = sim.current
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = (narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const padL = (narrow ? 6 : 34) * u
    const padR = 6 * u
    const X = (x: number) => padL + (x / LBOX) * (W - padL - padR)
    const lab = 15 * u // room for a panel title
    // panel boxes
    const p1 = [lab + 2 * u, H * 0.3] as const
    const p2 = [H * 0.3 + lab, H * 0.47] as const
    const p3 = [H * 0.47 + lab, H - 16 * u] as const
    const box = (y0: number, y1: number) => {
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = u
      ctx.strokeRect(X(0), y0, X(LBOX) - X(0), y1 - y0)
    }
    const title = (txt: string, y: number, col: string) => {
      ctx.fillStyle = col
      ctx.textAlign = 'left'
      ctx.fillText(txt, X(0) + 2 * u, y - 4 * u)
    }
    // --- light ---
    {
      const [y0, y1] = p1
      // density profile, shaded
      ctx.fillStyle = 'rgba(160,111,214,0.13)'
      ctx.beginPath()
      ctx.moveTo(X(0), y1)
      for (let k = 0; k <= 200; k++) {
        const x = (LBOX * k) / 200
        ctx.lineTo(X(x), y1 - (slabDensity({ x0: GAP, x1: GAP + LEN, ramp: RAMP, n: nn }, x) / nn) * (y1 - y0) * 0.9)
      }
      ctx.lineTo(X(LBOX), y1)
      ctx.fill()
      box(y0, y1)
      const ym = (y0 + y1) / 2
      const amp = (y1 - y0) * 0.46
      const scale = 1.25 * a0
      ctx.strokeStyle = COLORS.grid
      ctx.beginPath()
      ctx.moveTo(X(0), ym)
      ctx.lineTo(X(LBOX), ym)
      ctx.stroke()
      const trace = (f: Float64Array, col: string, lw: number) =>
        glowStroke(ctx, col, lw * u, () => {
          for (let j = 0; j < f.length; j++) {
            const y = ym - Math.max(-1.08, Math.min(1.08, f[j] / scale)) * amp
            if (j) ctx.lineTo(X(j * DX), y)
            else ctx.moveTo(X(j * DX), y)
          }
        })
      trace(s.fp, COLORS.amber, 1.2)
      trace(s.fm, COLORS.cyan, 1.4)
      title(narrow ? 'light: laser F₊ →, backscatter ← F₋' : 'light: the laser F₊ = (E_y + B_z)/2 moving right (amber), backscatter F₋ = (E_y − B_z)/2 moving left (cyan)', y0, COLORS.white)
      ctx.fillStyle = COLORS.violet
      ctx.textAlign = 'right'
      ctx.fillText(`plasma ${nn.toFixed(2)} n_c`, X(GAP + LEN / 2) + 30 * u, y1 - 4 * u)
      ctx.textAlign = 'left'
    }
    // --- plasma wave ---
    {
      const [y0, y1] = p2
      box(y0, y1)
      const ym = (y0 + y1) / 2
      let emax = 0.004
      for (let f = 0; f < s.ex.length; f++) emax = Math.max(emax, Math.abs(s.ex[f]))
      ctx.strokeStyle = COLORS.grid
      ctx.beginPath()
      ctx.moveTo(X(0), ym)
      ctx.lineTo(X(LBOX), ym)
      ctx.stroke()
      glowStroke(ctx, COLORS.lime, 1.2 * u, () => {
        for (let f = 0; f < s.ex.length; f++) {
          const y = ym - (s.ex[f] / emax) * (y1 - y0) * 0.45
          if (f) ctx.lineTo(X((f + 0.5) * DX), y)
          else ctx.moveTo(X((f + 0.5) * DX), y)
        }
      })
      title(narrow ? `plasma wave E_x (max ${emax.toFixed(3)})` : `plasma wave E_x, autoscaled (peak eE_x/mcω0 = ${emax.toFixed(3)})`, y0, COLORS.lime)
    }
    // --- phase space ---
    {
      const [y0, y1] = p3
      if (!psImg.current) {
        const cv = document.createElement('canvas')
        cv.width = NXB
        cv.height = NVB
        psImg.current = { canvas: cv, data: new ImageData(NXB, NVB), bins: new Float32Array(NXB * NVB) }
      }
      const { canvas: off, data, bins } = psImg.current
      bins.fill(0)
      const ix = NXB / LBOX
      const iv = NVB / (uHi - uLo)
      for (let i = 0; i < s.np; i++) {
        const bx = (s.x[i] * ix) | 0
        const bv = ((uHi - s.ux[i]) * iv) | 0
        if (bv < 0 || bv >= NVB || bx < 0 || bx >= NXB) continue
        bins[bv * NXB + bx] += 1
      }
      let bmax = 1
      for (let k = 0; k < bins.length; k++) if (bins[k] > bmax) bmax = bins[k]
      const lg = 1 / Math.log(1 + bmax)
      const px = data.data
      for (let k = 0; k < bins.length; k++) {
        const v = bins[k] > 0 ? Math.log(1 + bins[k]) * lg : 0
        const q = 4 * k
        // dark → cyan → white, with single particles still visible
        const a = bins[k] > 0 ? 0.18 + 0.82 * v : 0
        px[q] = 6 + 200 * a * a * a
        px[q + 1] = 12 + 220 * a
        px[q + 2] = 26 + 225 * a
        px[q + 3] = 255
      }
      off.getContext('2d')!.putImageData(data, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(off, X(0), y0, X(LBOX) - X(0), y1 - y0)
      box(y0, y1)
      const V = (v: number) => y0 + ((uHi - v) / (uHi - uLo)) * (y1 - y0)
      ctx.strokeStyle = 'rgba(154,160,201,0.4)'
      ctx.beginPath()
      ctx.moveTo(X(0), V(0))
      ctx.lineTo(X(LBOX), V(0))
      ctx.stroke()
      if (pr) {
        ctx.setLineDash([6 * u, 5 * u])
        ctx.strokeStyle = COLORS.amber
        ctx.lineWidth = 1.3 * u
        ctx.beginPath()
        ctx.moveTo(X(0), V(pr.vphi))
        ctx.lineTo(X(LBOX), V(pr.vphi))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.amber
        ctx.textAlign = 'right'
        ctx.fillText('v = v_φ of the Raman plasma wave', X(LBOX) - 4 * u, V(pr.vphi) - 4 * u)
        ctx.textAlign = 'left'
      }
      title(narrow ? 'electrons: x across, u_x up (log density)' : 'electron phase space: x across, u_x = γv_x/c up (log of the number of electrons)', y0, COLORS.white)
      if (!narrow) {
        ctx.fillStyle = COLORS.text
        ctx.textAlign = 'right'
        ctx.fillText(uHi.toFixed(2), X(0) - 4 * u, y0 + fs)
        ctx.fillText('0', X(0) - 4 * u, V(0) + 4 * u)
        ctx.fillText(uLo.toFixed(2), X(0) - 4 * u, y1)
        ctx.textAlign = 'left'
      }
      // x axis
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      const step = narrow ? 40 : 20
      for (let x = 0; x <= LBOX + 1e-9; x += step) ctx.fillText(String(x), X(x), H - 4 * u)
      ctx.textAlign = 'right'
      if (!narrow) ctx.fillText('x  (c/ω0)', X(LBOX), H - 4 * u)
      ctx.textAlign = 'left'
    }
  }

  const drawDiag = () => {
    const c = canvas2.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const s = sim.current
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = (narrow ? 10 : 10.5) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    // three panels: side by side on wide screens, stacked on phones
    const gap = 10 * u
    const rects: [number, number, number, number][] = []
    if (narrow) {
      const ph = (H - 2 * gap) / 3
      for (let k = 0; k < 3; k++) rects.push([30 * u, k * (ph + gap) + 16 * u, W - 6 * u, k * (ph + gap) + ph - 16 * u])
    } else {
      const pw = (W - 2 * gap) / 3
      for (let k = 0; k < 3; k++) rects.push([k * (pw + gap) + 30 * u, 18 * u, k * (pw + gap) + pw - 4 * u, H - 18 * u])
    }
    const frame = (r: [number, number, number, number], txt: string, col: string) => {
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = u
      ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1])
      ctx.fillStyle = col
      ctx.textAlign = 'left'
      ctx.fillText(txt, r[0], r[1] - 5 * u)
    }
    const xTicks = (r: [number, number, number, number], lo: number, hi: number, ticks: number[], fmt: (v: number) => string) => {
      ctx.fillStyle = COLORS.text
      for (const t of ticks) {
        const f = (t - lo) / (hi - lo)
        ctx.textAlign = f > 0.97 ? 'right' : f < 0.03 ? 'left' : 'center'
        ctx.fillText(fmt(t), r[0] + f * (r[2] - r[0]), r[3] + 12 * u)
      }
      ctx.textAlign = 'left'
    }
    // (a) spectrum of the backscattered light
    {
      const r = rects[0]
      frame(r, 'backscatter spectrum, log scale vs ω/ω0', COLORS.cyan)
      const w0 = 0.2
      const w1 = 1.2
      const Xw = (w: number) => r[0] + ((w - w0) / (w1 - w0)) * (r[2] - r[0])
      xTicks(r, w0, w1, [0.2, 0.4, 0.6, 0.8, 1.0, 1.2], (v) => v.toFixed(1))
      const sp = spec.current
      if (sp) {
        let pmax = 1e-300
        for (let k = 0; k < sp.omega.length; k++) if (sp.omega[k] >= w0 && sp.omega[k] <= w1) pmax = Math.max(pmax, sp.power[k])
        const dec = 5
        const Yp = (p: number) => r[1] + (-Math.log10(Math.max(p / pmax, 10 ** -dec)) / dec) * (r[3] - r[1])
        ctx.save()
        ctx.beginPath()
        ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1])
        ctx.clip()
        glowStroke(ctx, COLORS.cyan, 1.3 * u, () => {
          let first = true
          for (let k = 0; k < sp.omega.length; k++) {
            const w = sp.omega[k]
            if (w < w0 - 0.02 || w > w1 + 0.02) continue
            if (first) ctx.moveTo(Xw(w), Yp(sp.power[k]))
            else ctx.lineTo(Xw(w), Yp(sp.power[k]))
            first = false
          }
        })
        ctx.restore()
      } else {
        ctx.fillStyle = COLORS.text
        ctx.fillText('collecting…', r[0] + 8 * u, (r[1] + r[3]) / 2)
      }
      const vmark = (w: number, col: string, txt: string, dy: number) => {
        ctx.setLineDash([4 * u, 4 * u])
        ctx.strokeStyle = col
        ctx.lineWidth = 1.2 * u
        ctx.beginPath()
        ctx.moveTo(Xw(w), r[1])
        ctx.lineTo(Xw(w), r[3])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = col
        ctx.textAlign = w > 0.8 ? 'right' : 'left'
        ctx.fillText(txt, Xw(w) + (w > 0.8 ? -4 : 4) * u, r[1] + dy)
        ctx.textAlign = 'left'
      }
      if (pr) vmark(pr.ws, COLORS.amber, 'Raman', 13 * u)
      vmark(1, COLORS.text, 'ω0', 26 * u)
    }
    // (b) reflectivity vs time
    {
      const r = rects[1]
      frame(r, 'reflectivity vs time ω0t', COLORS.magenta)
      const tMax = Math.max(500, Math.ceil(s.t / 500) * 500)
      xTicks(r, 0, tMax, [0, tMax / 2, tMax], (v) => v.toFixed(0))
      const { t, R } = hist.current
      let rmax = 0.05
      for (const v of R) rmax = Math.max(rmax, v)
      rmax = rmax <= 0.05 ? 0.05 : rmax <= 0.1 ? 0.1 : rmax <= 0.2 ? 0.2 : rmax <= 0.5 ? 0.5 : 1
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.round(rmax * 100)}%`, r[0] - 3 * u, r[1] + fs)
      ctx.fillText('0', r[0] - 3 * u, r[3])
      ctx.textAlign = 'left'
      glowStroke(ctx, COLORS.magenta, 1.3 * u, () => {
        for (let i = 0; i < t.length; i++) {
          const x = r[0] + (t[i] / tMax) * (r[2] - r[0])
          const y = r[3] - Math.min(1, R[i] / rmax) * (r[3] - r[1])
          if (i) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        }
      })
    }
    // (c) f(u_x)
    {
      const r = rects[2]
      frame(r, 'f(u_x), log scale: hot tail', COLORS.lime)
      const bins = fv.current
      bins.fill(0)
      const ib = NFV / (uHi - uLo)
      let tot = 0
      for (let i = 0; i < s.np; i++) {
        if (!s.alive[i]) continue
        const b = ((s.ux[i] - uLo) * ib) | 0
        if (b >= 0 && b < NFV) bins[b] += 1
        tot++
      }
      const du = (uHi - uLo) / NFV
      const peak = (tot * du) / (Math.sqrt(2 * Math.PI) * Math.max(vte, 1e-6))
      const dec = 5
      const Yf = (f: number) => r[1] + (-Math.log10(Math.max(f / (peak * 1.3), 10 ** -dec)) / dec) * (r[3] - r[1])
      const Xu = (v: number) => r[0] + ((v - uLo) / (uHi - uLo)) * (r[2] - r[0])
      xTicks(r, uLo, uHi, [-0.2, 0, 0.2, 0.4, 0.6, 0.8].filter((v) => v >= uLo && v <= uHi), (v) => v.toFixed(1))
      // initial Maxwellian
      ctx.setLineDash([5 * u, 4 * u])
      ctx.strokeStyle = COLORS.violet
      ctx.lineWidth = 1.2 * u
      ctx.beginPath()
      let started = false
      for (let k = 0; k <= 160; k++) {
        const v = uLo + ((uHi - uLo) * k) / 160
        const f = peak * Math.exp((-v * v) / (2 * vte * vte))
        if (f < peak * 10 ** -dec) {
          started = false
          continue
        }
        if (started) ctx.lineTo(Xu(v), Yf(f))
        else ctx.moveTo(Xu(v), Yf(f))
        started = true
      }
      ctx.stroke()
      ctx.setLineDash([])
      glowStroke(ctx, COLORS.lime, 1.3 * u, () => {
        let first = true
        for (let b = 0; b < NFV; b++) {
          if (bins[b] <= 0) {
            first = true
            continue
          }
          const x = Xu(uLo + (b + 0.5) * du)
          if (first) ctx.moveTo(x, Yf(bins[b]))
          else ctx.lineTo(x, Yf(bins[b]))
          first = false
        }
      })
      if (pr) {
        ctx.setLineDash([4 * u, 4 * u])
        ctx.strokeStyle = COLORS.amber
        ctx.beginPath()
        ctx.moveTo(Xu(pr.vphi), r[1])
        ctx.lineTo(Xu(pr.vphi), r[3])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.amber
        ctx.fillText('v_φ', Xu(pr.vphi) + 3 * u, r[1] + 13 * u)
      }
      ctx.fillStyle = COLORS.violet
      ctx.fillText(narrow ? 'dashed: start' : 'dashed: initial', r[0] + 4 * u, r[1] + 13 * u)
    }
  }

  let frameNo = 0
  useAnimation2(
    canvas,
    canvas2,
    () => {
      const s = sim.current
      if (s.t < T_END) {
        const steps = Math.max(1, Math.min(speed, Math.floor(FRAME_MS / timing.current.ms)))
        const t0 = performance.now()
        stepEmPic(s, steps)
        const ms = (performance.now() - t0) / steps
        timing.current.ms = 0.9 * timing.current.ms + 0.1 * ms
        // reflectivity over the last two laser periods, and over the whole run
        const per = Math.round((2 * Math.PI) / (s.dt * s.dec))
        const R = meanSquare(s, s.inL, 2 * per) > 1e-12 ? meanSquare(s, s.outL, 2 * per) / meanSquare(s, s.inL, 2 * per) : 0
        hist.current.t.push(s.t)
        hist.current.R.push(R)
        const sm = sums.current
        for (; sm.seen < s.nSamples; sm.seen++) {
          const r = sm.seen % s.ring
          sm.inS += s.inL[r] ** 2
          sm.outS += s.outL[r] ** 2
        }
        if (++frameNo % 6 === 0) {
          spec.current = spectrumOf(s, s.outL, NFFT)
          let hot = 0
          let tot = 0
          const v4 = 4 * vte
          for (let i = 0; i < s.np; i++) {
            if (!s.alive[i]) continue
            tot++
            if (s.ux[i] > v4) hot++
          }
          let eSum = 0
          for (const e of s.escaped) eSum += e
          // a Raman line is only meaningful once the backscatter is well above the noise
          const Rwin = s.nSamples >= NFFT ? meanSquare(s, s.outL, NFFT) / Math.max(1e-30, meanSquare(s, s.inL, NFFT)) : 0
          const peak = spec.current && Rwin > 2e-4 ? peakFrequency(spec.current, 0.3, 0.95) : NaN
          if (isNaN(firstPeak.current) && isFinite(peak) && Rwin > 0.01) firstPeak.current = peak
          setRo({
            first: firstPeak.current,
            t: s.t,
            R,
            Ravg: sm.inS > 0 ? sm.outS / sm.inS : 0,
            peak,
            hot: tot ? hot / tot : 0,
            escaped: s.escaped.length,
            escE: s.escaped.length ? (eSum / s.escaped.length) * 510.99895 : 0,
            msStep: timing.current.ms,
            steps,
          })
        }
      } else if (running) setRunning(false)
      drawMain()
      drawDiag()
    },
    running,
  )

  const okPeak = pr && isFinite(ro.first) && Math.abs(ro.first / pr.ws - 1) < 0.03
  const r = DX / lD
  return (
    <SimFrame
      id="pic-srs"
      title="Run your own 1D PIC of stimulated Raman scattering"
      running={running}
      setRunning={(on) => (on && sim.current.t >= T_END ? restart() : setRunning(on))}
      onReset={() => restart()}
      hint="Units: ω0 = c = 1, so x is in c/ω0 = λ0/2π (the box is about 21 laser wavelengths) and time in 1/ω0. A laser enters from the left; the slab holds mobile electrons on fixed ions. Watch the cyan backscatter grow out of the particle noise, the plasma wave E_x grow with it, and electrons near the dashed line v_φ get trapped and swirl into vortices. The spectrum’s peak should sit on the Raman line from the matching conditions (B5, B6), and f(u_x) grows a hot tail near v_φ (B8). Then change one thing at a time: density, temperature (Landau damping), laser strength, and particles per cell (does the answer change? that is a convergence test)."
    >
      <canvas ref={canvas} className="sim" aria-label="1D PIC simulation: light, plasma wave and electron phase space" />
      <canvas ref={canvas2} className="sim" style={{ marginTop: 8 }} aria-label="Backscatter spectrum, reflectivity and electron velocity distribution" />
      <div className="readouts">
        <span>
          Raman line ω_s/ω0: theory from matching <b>{pr ? pr.ws.toFixed(3) : 'none (n > n_c/4)'}</b>
          {pr && <> ({(351 / pr.ws).toFixed(0)} nm for a 351 nm laser)</>}; measured as the reflectivity first passes 1%{' '}
          <b className={okPeak ? 'ok' : ''}>{isFinite(ro.first) ? ro.first.toFixed(3) : ro.t < 200 ? '…' : 'not yet'}</b>, now <b>{isFinite(ro.peak) ? ro.peak.toFixed(3) : '—'}</b>
        </span>
        <span>
          reflectivity now <b>{(ro.R * 100).toFixed(1)}%</b>, run average <b>{(ro.Ravg * 100).toFixed(1)}%</b>
        </span>
        {pr && (
          <span>
            theory: γ₀ = <b>{pr.gamma0.toFixed(4)}</b>, Landau ν = <b>{pr.nu.toExponential(1)}</b>, net γ = <b>{pr.gamma.toFixed(4)}</b> ω0 (kλ_De = {pr.klD.toFixed(2)}, v_φ = {pr.vphi.toFixed(2)}c)
          </span>
        )}
        <span>
          hot electrons (u_x &gt; 4v_te): <b className={ro.hot > 10 * MAXWELL_TAIL ? 'ok' : ''}>{ro.hot ? sci(ro.hot, 2) : '0'}</b> (Maxwellian {sci(MAXWELL_TAIL, 2)}); escaped <b>{ro.escaped}</b>
          {ro.escaped > 0 && <>, mean {ro.escE.toFixed(0)} keV</>}
        </span>
        <span>
          grid: Δx/λ_De = <b className={r <= 2 ? 'ok' : ''}>{r.toFixed(2)}</b>
          {r > 2 && ' (grid heating likely)'}, ω_peΔt = <b>{(Math.sqrt(nn) * DX).toFixed(3)}</b>, cΔt = Δx, {sim.current.np.toLocaleString()} particles,{' '}
          {ro.msStep ? `${ro.msStep.toFixed(2)} ms/step × ${ro.steps}` : '…'}
        </span>
        <span>
          ω0t = <b>{ro.t.toFixed(0)}</b> ({(ro.t * PS_PER_UNIT).toFixed(2)} ps at 351 nm)
        </span>
      </div>
      <div className="controls">
        <Slider label="Density n/n_c" value={nn} min={0.03} max={0.22} step={0.01} onChange={(v) => { setNn(v); restart(v) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Electron temperature" value={T} min={0.5} max={5} step={0.1} onChange={(v) => { setT(v); restart(nn, v) }} fmt={(v) => `${v.toFixed(1)} keV`} />
        <Slider
          label="Laser a₀ = v_os/c"
          value={a0}
          min={0.02}
          max={0.12}
          step={0.005}
          onChange={(v) => { setA0(v); restart(nn, T, v) }}
          fmt={(v) => `${v.toFixed(3)} · ${sci(intensity(v, 0.351), 2)} W/cm² at 351 nm`}
        />
        <Slider label="Particles per cell" value={ppc} min={8} max={128} step={8} onChange={(v) => { setPpc(v); restart(nn, T, a0, v) }} />
        <Slider label="Steps per frame (max)" value={speed} min={1} max={16} step={1} onChange={setSpeed} />
      </div>
    </SimFrame>
  )
}
