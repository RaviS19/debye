// B3: the angle sweep. A full-wave solution of obliquely incident light on a linear density ramp, for p or s
// polarization: the light's field |cB_z| (or |E_z|), the resonant |E_x| spike at n_c, a zoom on the critical
// region with the fields oscillating in time, and the absorbed fraction against angle, built up live.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { absorption, airyWidth, denisovAbs, solveWave, TAU_OPT, tauOf, thetaOfTau, type Pol, type WaveSolution } from '../physics/resonanceAbs'
import { SimFrame, Slider } from './SimFrame'

const L_STOPS = [1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100] // L/λ
const NU_STOPS = [1e-6, 3e-6, 1e-5, 3e-5, 1e-4, 3e-4, 1e-3, 3e-3, 1e-2]
const N_SWEEP = 40
const deg = Math.PI / 180

/** Largest angle shown for a ramp: where τ reaches 2.6 (absorption < 1e-6 beyond), at most 80°. */
function thetaMaxDeg(k0L: number) {
  const s = 2.6 / Math.cbrt(k0L)
  return s >= 1 ? 80 : Math.min(80, Math.ceil(Math.asin(s) / deg))
}

interface Sweep {
  key: string
  th: number[] // deg
  p: number[]
  s: number[]
  done: number
}

const fmtNu = (v: number) => {
  const e = Math.floor(Math.log10(v) + 1e-9)
  const m = Math.round(v / 10 ** e)
  return `${m === 1 ? '' : m + '×'}10${String(e).replace(/[-0-9]/g, (d) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(d)])}`
}

export function ResonanceSim() {
  const [running, setRunning] = useState(true)
  const [pol, setPol] = useState<Pol>('p')
  const [li, setLi] = useState(6) // L = 10 λ
  const [ni, setNi] = useState(5) // ν_c/ω = 3e-4
  const LoverLam = L_STOPS[li]
  const k0L = 2 * Math.PI * LoverLam
  const nuc = NU_STOPS[ni]
  const thMax = thetaMaxDeg(k0L)
  const optDeg = thetaOfTau(k0L, TAU_OPT) / deg
  const [thDeg, setThDeg] = useState(() => Math.round(thetaOfTau(2 * Math.PI * 10, TAU_OPT) / deg * 10) / 10)
  const th = Math.min(thDeg, thMax) * deg
  const phase = useRef(0)

  // the full solution at the current angle, both polarizations, and the pure resonance part
  const sols = useMemo(() => {
    const p = solveWave({ k0L, theta: th, nuc, pol: 'p' })
    const s = solveWave({ k0L, theta: th, nuc, pol: 's' })
    const res = absorption(k0L, th, 0, 'p')
    return { p, s, res }
  }, [k0L, th, nuc])
  const sol: WaveSolution = pol === 'p' ? sols.p : sols.s
  const tau = tauOf(k0L, th)

  // the absorption-vs-angle sweep, computed a few angles per animation frame whatever the play state
  const sweep = useRef<Sweep>({ key: '', th: [], p: [], s: [], done: 0 })
  const [, setTick] = useState(0)
  useEffect(() => {
    const key = `${k0L}|${nuc}`
    const sw: Sweep = { key, th: [], p: [], s: [], done: 0 }
    for (let i = 0; i < N_SWEEP; i++) sw.th.push((thMax * i) / (N_SWEEP - 1))
    sweep.current = sw
    let raf = 0
    const work = () => {
      const t0 = performance.now()
      while (sw.done < N_SWEEP && performance.now() - t0 < 5) {
        const t = sw.th[sw.done] * deg
        sw.p.push(absorption(k0L, t, nuc, 'p'))
        sw.s.push(absorption(k0L, t, nuc, 's'))
        sw.done++
      }
      drawRef.current()
      if (sw.done < N_SWEEP) raf = requestAnimationFrame(work)
      else setTick((n) => n + 1)
    }
    raf = requestAnimationFrame(work)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k0L, nuc, thMax])

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.75 : 0.6, () => drawRef.current(), narrow ? 680 : 460)
  const drawRef = useRef<() => void>(() => {})

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const stacked = c.clientWidth < 560
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = (stacked ? 10.5 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const gap = 10 * u
    // regions: A (whole ramp), B (zoom), C (curve)
    let A: [number, number, number, number]
    let B: [number, number, number, number]
    let Cr: [number, number, number, number]
    if (stacked) {
      const hA = H * 0.27
      const hB = H * 0.27
      A = [0, 0, W, hA]
      B = [0, hA + gap, W, hB]
      Cr = [0, hA + hB + 2 * gap, W, H - hA - hB - 2 * gap]
    } else {
      const lw = W * 0.6
      A = [0, 0, lw - gap / 2, H / 2 - gap / 2]
      B = [0, H / 2 + gap / 2, lw - gap / 2, H / 2 - gap / 2]
      Cr = [lw + gap / 2, 0, W - lw - gap / 2, H]
    }
    const s = sol
    const sinT = Math.sin(th)
    const L = k0L
    const delta = airyWidth(L)
    const xt = L * Math.cos(th) ** 2
    const n = s.x.length

    // ---------- panel A: whole ramp, with the field oscillating in time ----------
    {
      const [x0, y0, w, h] = A
      const padL = 6 * u
      const top = y0 + 30 * u
      const bot = y0 + h - 18 * u
      const xa = -0.03 * (L + 3 * delta)
      const xb = L + 3 * delta
      const X = (x: number) => x0 + padL + ((x - xa) / (xb - xa)) * (w - 2 * padL)
      let fmax = 0
      for (let k = 0; k < n; k++) if (s.x[k] <= xb) fmax = Math.max(fmax, Math.hypot(s.fRe[k], s.fIm[k]))
      const ymax = Math.max(1.2, fmax * 1.08)
      const mid = (top + bot) / 2
      const Y = (v: number) => mid - (Math.max(-ymax, Math.min(v, ymax)) / ymax) * ((bot - top) / 2)
      const Yn = (un: number) => bot - (un / 1.25) * (bot - top) * 0.95
      // density
      ctx.fillStyle = 'rgba(160,111,214,0.12)'
      ctx.beginPath()
      ctx.moveTo(X(0), bot)
      ctx.lineTo(X(xb), Yn(xb / L))
      ctx.lineTo(X(xb), bot)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(160,111,214,0.7)'
      ctx.lineWidth = 1.2 * u
      ctx.beginPath()
      ctx.moveTo(X(xa), bot)
      ctx.lineTo(X(0), bot)
      ctx.lineTo(X(xb), Yn(xb / L))
      ctx.stroke()
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      ctx.beginPath()
      ctx.moveTo(X(xa), mid)
      ctx.lineTo(X(xb), mid)
      ctx.stroke()
      vline(ctx, X(L), top - 4 * u, bot, COLORS.red, u)
      vline(ctx, X(xt), top - 4 * u, bot, COLORS.amber, u)
      // envelopes: max within each pixel bin (so the spike is not missed), gaps filled by interpolation
      const nb = Math.max(60, Math.round((w - 2 * padL) / u))
      const hb = new Float64Array(nb).fill(-1)
      const eb = new Float64Array(nb).fill(-1)
      const bin = (x: number) => Math.floor(((x - xa) / (xb - xa)) * nb)
      for (let k = 0; k < n; k++) {
        const b = bin(s.x[k])
        if (b < 0 || b >= nb) continue
        hb[b] = Math.max(hb[b], Math.hypot(s.fRe[k], s.fIm[k]))
        eb[b] = Math.max(eb[b], s.ex[k])
      }
      const bc = (b: number) => xa + ((b + 0.5) / nb) * (xb - xa)
      const fa = sampler(s, th)
      const inst = new Float64Array(nb)
      for (let b = 0; b < nb; b++) {
        const [re, im] = fa(bc(b))
        inst[b] = re * Math.cos(phase.current) + im * Math.sin(phase.current)
        if (bc(b) < 0) {
          hb[b] = Math.hypot(re, im)
          eb[b] = pol === 'p' ? sinT * hb[b] : hb[b]
        }
      }
      fillGaps(hb)
      fillGaps(eb)
      const bx = (b: number) => X(bc(b))
      // instantaneous field, only where the wavelength spans enough pixels to be drawn honestly
      const pxPerLambda = ((2 * Math.PI) / (xb - xa)) * (w - 2 * padL) / u
      if (pxPerLambda >= 7) {
        ctx.strokeStyle = 'rgba(143,255,255,0.75)'
        ctx.lineWidth = 1.2 * u
        ctx.beginPath()
        for (let b = 0; b < nb; b++) (b ? ctx.lineTo(bx(b), Y(inst[b])) : ctx.moveTo(bx(b), Y(inst[b])))
        ctx.stroke()
      }
      for (const sg of [1, -1]) {
        glowStroke(ctx, COLORS.cyan, 1.6 * u, () => {
          for (let b = 0; b < nb; b++) (b ? ctx.lineTo(bx(b), Y(sg * hb[b])) : ctx.moveTo(bx(b), Y(sg * hb[b])))
        })
      }
      if (pol === 'p') {
        glowStroke(ctx, COLORS.magenta, 1.4 * u, () => {
          for (let b = 0; b < nb; b++) (b ? ctx.lineTo(bx(b), Y(eb[b])) : ctx.moveTo(bx(b), Y(eb[b])))
        })
      }
      // labels: title, then a legend row
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.white
      ctx.fillText(stacked ? 'whole ramp (units of E₀)' : 'the whole ramp (fields in units of E₀, live)', x0 + padL, y0 + 12 * u)
      let lx = x0 + padL
      const ly = y0 + 25 * u
      const leg = (col: string, txt: string) => {
        ctx.fillStyle = col
        ctx.fillText(txt, lx, ly)
        lx += ctx.measureText(txt).width + 12 * u
      }
      leg(COLORS.cyan, pol === 'p' ? '±|cB_z|, cB_z(t)' : '±|E_z|, E_z(t)')
      if (pol === 'p') leg(COLORS.magenta, '|E_x|')
      leg(COLORS.violet, 'n(x)')
      if (pol === 'p') {
        const peak = Math.max(...s.ex)
        if (peak > ymax) {
          ctx.fillStyle = COLORS.magenta
          ctx.textAlign = 'right'
          ctx.fillText(`${peak.toFixed(0)} E₀ ↑`, X(L) - 5 * u, top + 10 * u)
        }
      }
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText('0', X(0) - 3 * u, y0 + h - 4 * u)
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.amber
      const close = Math.abs(X(L) - X(xt)) < 46 * u
      if (!close) ctx.fillText('n_c cos²θ', X(xt), y0 + h - 4 * u)
      ctx.fillStyle = COLORS.red
      ctx.textAlign = 'right'
      ctx.fillText(close ? `n_c cos²θ ≈ n_c (${LoverLam} λ)` : `n_c (x = ${LoverLam} λ)`, Math.min(x0 + w - 2 * u, X(L) + 30 * u), y0 + h - 4 * u)
    }

    // ---------- panel B: zoom on the critical region, log scale ----------
    {
      const [x0, y0, w, h] = B
      const padL = 30 * u
      const padR = 6 * u
      const top = y0 + 36 * u
      const bot = y0 + h - 18 * u
      const xa = Math.max(-0.5, Math.min(xt - 3 * delta, L - 5 * delta))
      const xb = L + 2.5 * delta
      const X = (x: number) => x0 + padL + ((x - xa) / (xb - xa)) * (w - padL - padR)
      const nb = Math.max(60, Math.round((w - padL - padR) / u))
      const hb = new Float64Array(nb).fill(-1)
      const eb = new Float64Array(nb).fill(-1)
      const bin = (x: number) => Math.floor(((x - xa) / (xb - xa)) * nb)
      for (let k = 0; k < n; k++) {
        const b = bin(s.x[k])
        if (b < 0 || b >= nb) continue
        hb[b] = Math.max(hb[b], Math.hypot(s.fRe[k], s.fIm[k]))
        eb[b] = Math.max(eb[b], s.ex[k])
      }
      const fa = sampler(s, th)
      for (let b = 0; b < nb; b++) {
        const x = xa + ((b + 0.5) / nb) * (xb - xa)
        if (x < 0) {
          const [re, im] = fa(x)
          hb[b] = Math.hypot(re, im)
          eb[b] = sinT * hb[b]
        }
      }
      fillGaps(hb)
      fillGaps(eb)
      let hi = 0
      for (let b = 0; b < nb; b++) hi = Math.max(hi, hb[b], pol === 'p' ? eb[b] : 0)
      const dHi = Math.ceil(Math.log10(hi * 1.5))
      const dLo = dHi - (stacked ? 4 : 5)
      const Y = (v: number) => bot - ((Math.log10(Math.max(v, 10 ** (dLo - 1))) - dLo) / (dHi - dLo)) * (bot - top)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, top - 2 * u, w, bot - top + 4 * u)
      ctx.clip()
      ctx.fillStyle = 'rgba(251,191,36,0.07)'
      ctx.fillRect(X(xt), top, X(L) - X(xt), bot - top)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      for (let d = dLo; d <= dHi; d++) {
        ctx.beginPath()
        ctx.moveTo(X(xa), Y(10 ** d))
        ctx.lineTo(X(xb), Y(10 ** d))
        ctx.stroke()
      }
      vline(ctx, X(L), top, bot, COLORS.red, u)
      vline(ctx, X(xt), top, bot, COLORS.amber, u)
      const bx = (b: number) => X(xa + ((b + 0.5) / nb) * (xb - xa))
      if (pol === 'p') {
        // the damping-limited prediction for the peak, |D_x|/ε0 ÷ (ν/ω)
        const pred = s.driver / nuc
        ctx.setLineDash([5 * u, 4 * u])
        ctx.strokeStyle = 'rgba(244,114,182,0.6)'
        ctx.beginPath()
        ctx.moveTo(X(xa), Y(pred))
        ctx.lineTo(X(xb), Y(pred))
        ctx.stroke()
        ctx.setLineDash([])
        glowStroke(ctx, COLORS.magenta, 1.5 * u, () => {
          for (let b = 0; b < nb; b++) (b ? ctx.lineTo(bx(b), Y(eb[b])) : ctx.moveTo(bx(b), Y(eb[b])))
        })
      }
      glowStroke(ctx, COLORS.cyan, 1.8 * u, () => {
        for (let b = 0; b < nb; b++) (b ? ctx.lineTo(bx(b), Y(hb[b])) : ctx.moveTo(bx(b), Y(hb[b])))
      })
      ctx.restore()
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      for (let d = dLo; d <= dHi; d++) ctx.fillText(d === 0 ? '1' : `10${sup(d)}`, x0 + padL - 4 * u, Y(10 ** d) + 4 * u)
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.white
      ctx.fillText(stacked ? 'zoom near n_c (log scale)' : 'zoom on the critical region (log scale, units of E₀)', x0 + 4 * u, y0 + 12 * u)
      let lx = x0 + 4 * u
      const ly = y0 + 25 * u
      const leg = (col: string, txt: string) => {
        ctx.fillStyle = col
        ctx.fillText(txt, lx, ly)
        lx += ctx.measureText(txt).width + 12 * u
      }
      leg(COLORS.cyan, pol === 'p' ? '|cB_z|' : '|E_z|')
      if (pol === 'p') leg(COLORS.magenta, stacked ? '|E_x|' : '|E_x| (dashed: E_d ω/ν)')
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.amber
      const close = Math.abs(X(L) - X(xt)) < 64 * u
      if (!close) ctx.fillText('light turns', X(xt), y0 + h - 4 * u)
      ctx.fillStyle = COLORS.red
      ctx.fillText(pol === 'p' ? 'ε = 0' : 'n_c', X(L), y0 + h - 4 * u)
      if (X(L) - X(xt) > 110 * u) {
        ctx.fillStyle = 'rgba(251,191,36,0.8)'
        ctx.fillText('tunnelling', (X(L) + X(xt)) / 2, bot - 6 * u)
      }
    }

    // ---------- panel C: absorbed fraction vs angle ----------
    {
      const [x0, y0, w, h] = Cr
      const padL = 34 * u
      const padR = 8 * u
      const top = y0 + 22 * u
      const bot = y0 + h - 30 * u
      const X = (d: number) => x0 + padL + (d / thMax) * (w - padL - padR)
      const Y = (f: number) => bot - f * (bot - top)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        ctx.beginPath()
        ctx.moveTo(X(0), Y(f))
        ctx.lineTo(X(thMax), Y(f))
        ctx.stroke()
        ctx.fillText(`${Math.round(f * 100)}%`, X(0) - 4 * u, Y(f) + 4 * u)
      }
      const stepDeg = thMax <= 12 ? 2 : thMax <= 25 ? 5 : thMax <= 50 ? 10 : 20
      ctx.textAlign = 'center'
      for (let d = 0; d <= thMax + 1e-9; d += stepDeg) {
        ctx.beginPath()
        ctx.moveTo(X(d), top)
        ctx.lineTo(X(d), bot)
        ctx.stroke()
        ctx.fillText(`${d}°`, X(d), bot + 13 * u)
      }
      ctx.strokeStyle = COLORS.axis
      ctx.strokeRect(X(0), top, X(thMax) - X(0), bot - top)
      ctx.fillStyle = COLORS.white
      ctx.fillText('angle of incidence θ', X(thMax / 2), bot + 26 * u)
      ctx.textAlign = 'left'
      ctx.fillText('absorbed fraction', x0 + 2 * u, y0 + 12 * u)
      // optimum
      ctx.setLineDash([3 * u, 4 * u])
      ctx.strokeStyle = 'rgba(232,234,246,0.35)'
      ctx.beginPath()
      ctx.moveTo(X(optDeg), top)
      ctx.lineTo(X(optDeg), bot)
      ctx.stroke()
      ctx.setLineDash([])
      // Ginzburg's approximation (resonance only)
      ctx.setLineDash([5 * u, 5 * u])
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 1.3 * u
      ctx.beginPath()
      for (let i = 0; i <= 160; i++) {
        const d = (thMax * i) / 160
        const y = Y(Math.min(1, denisovAbs(tauOf(k0L, d * deg))))
        if (i) ctx.lineTo(X(d), y)
        else ctx.moveTo(X(d), y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      const sw = sweep.current
      const curve = (arr: number[], col: string, wdt: number) => {
        if (sw.done < 2) return
        glowStroke(ctx, col, wdt, () => {
          for (let i = 0; i < sw.done; i++) (i ? ctx.lineTo(X(sw.th[i]), Y(arr[i])) : ctx.moveTo(X(sw.th[i]), Y(arr[i])))
        })
      }
      curve(sw.s, COLORS.violet, (pol === 's' ? 2 : 1.4) * u)
      curve(sw.p, COLORS.cyan, (pol === 'p' ? 2 : 1.4) * u)
      // current point
      ctx.fillStyle = '#fff'
      ctx.shadowColor = pol === 'p' ? COLORS.cyan : COLORS.violet
      ctx.shadowBlur = 12 * u
      ctx.beginPath()
      ctx.arc(X(th / deg), Y(sol.fA), 4.5 * u, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
      // legend
      const lx = X(thMax) - (stacked ? 112 : 118) * u
      let ly = top + 14 * u
      const leg = (col: string, txt: string, dashed = false) => {
        ctx.strokeStyle = col
        ctx.lineWidth = 2 * u
        if (dashed) ctx.setLineDash([4 * u, 3 * u])
        ctx.beginPath()
        ctx.moveTo(lx, ly - 4 * u)
        ctx.lineTo(lx + 16 * u, ly - 4 * u)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = col
        ctx.fillText(txt, lx + 21 * u, ly)
        ly += 15 * u
      }
      ctx.textAlign = 'left'
      leg(COLORS.cyan, 'p-polarized')
      leg(COLORS.violet, 's-polarized')
      leg(COLORS.amber, 'φ²/2 (approx.)', true)
      ctx.fillStyle = 'rgba(232,234,246,0.6)'
      ctx.textAlign = X(optDeg) > X(thMax) - 60 * u ? 'right' : 'left'
      ctx.fillText('τ = 0.68', X(optDeg) + (ctx.textAlign === 'right' ? -4 : 4) * u, bot - 6 * u)
      if (sw.done < N_SWEEP) {
        ctx.fillStyle = COLORS.text
        ctx.textAlign = 'right'
        ctx.fillText('sweeping…', X(thMax) - 4 * u, bot - 6 * u)
      }
    }
  }

  drawRef.current = draw
  useAnimation(
    canvas,
    (dt) => {
      phase.current = (phase.current + (dt / 1600) * 2 * Math.PI) % (2 * Math.PI)
      draw()
    },
    running,
  )
  // redraw when paused and the inputs change
  useEffect(() => {
    if (!running) draw()
  })

  const peakEx = pol === 'p' ? Math.max(...sols.p.ex) : NaN
  const peakTheory = sols.p.driver / nuc // |E_x| at n_c = |D_x/ε0| / |ε(n_c)|, |ε(n_c)| ≈ ν/ω
  const okPeak = Math.abs(peakEx / peakTheory - 1) < 0.05
  const okDiss = Math.abs(sol.fDiss / sol.fA - 1) < 0.01
  const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 2 : 1)}%`

  return (
    <SimFrame
      id="resonance-sweep"
      title="Angle sweep: the Denisov curve"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setPol('p')
        setLi(6)
        setNi(5)
        setThDeg(Math.round((thetaOfTau(2 * Math.PI * 10, TAU_OPT) / deg) * 10) / 10)
      }}
      hint="A full-wave solution of Maxwell’s equations with a cold, weakly collisional plasma in a linear ramp (fields in units of the incident amplitude E₀, lengths in λ). Start with p-polarized light and sweep the angle: at 0° nothing points along the gradient, at large angles the light turns too far below n_c, and in between about half the light is absorbed at τ ≈ 0.68. Now shrink the collision rate ν by a factor 100: the |E_x| spike grows 100 times taller and narrower, yet the absorbed fraction hardly moves. Switch to s polarization: only the small collisional absorption is left, and it vanishes as ν → 0. Change L/λ and watch the optimum angle move as L^(−1/3)."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${pol === 'p' ? 'primary' : ''}`} onClick={() => setPol('p')}>p-polarized (E in the plane)</button>
        <button className={`btn small ${pol === 's' ? 'primary' : ''}`} onClick={() => setPol('s')}>s-polarized (E ⟂ plane)</button>
        <button className="btn small" onClick={() => setThDeg(Math.round(optDeg * 10) / 10)}>Go to optimum angle</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Resonance absorption: fields in a density ramp and absorption against angle" />
      <div className="readouts">
        <span>τ = (k₀L)^⅓ sin θ = <b>{tau.toFixed(3)}</b></span>
        <span>light turns at <b>{(Math.cos(th) ** 2).toFixed(3)} n_c</b></span>
        <span>
          absorbed (full wave): p <b className={pol === 'p' ? 'ok' : ''}>{pct(sols.p.fA)}</b>, s <b className={pol === 's' ? 'ok' : ''}>{pct(sols.s.fA)}</b>
        </span>
        <span>
          resonance alone (ν → 0): exact <b>{pct(sols.res)}</b>, Ginzburg’s φ²/2 <b>{pct(Math.min(1, denisovAbs(tau)))}</b>
        </span>
        {pol === 'p' && (
          <span>
            peak |E_x| = <b className={okPeak ? 'ok' : ''}>{peakEx.toPrecision(3)} E₀</b> vs |D_x|/ε₀ ÷ (ν/ω) = <b>{peakTheory.toPrecision(3)} E₀</b>
          </span>
        )}
        <span>
          energy check: dissipated <b className={okDiss ? 'ok' : ''}>{pct(sol.fDiss)}</b> vs 1 − |r|² = <b>{pct(sol.fA)}</b>
        </span>
      </div>
      <div className="controls">
        <Slider label="Angle of incidence θ" value={Math.min(thDeg, thMax)} min={0} max={thMax} step={0.1} onChange={setThDeg} fmt={(v) => `${v.toFixed(1)}°`} />
        <Slider
          label="Ramp length L (edge to n_c)"
          value={li}
          min={0}
          max={L_STOPS.length - 1}
          step={1}
          onChange={(i) => {
            setLi(i)
            const kl = 2 * Math.PI * L_STOPS[i]
            setThDeg((d) => Math.min(d, thetaMaxDeg(kl)))
          }}
          fmt={(i) => `${L_STOPS[i]} λ (k₀L = ${(2 * Math.PI * L_STOPS[i]).toFixed(0)})`}
        />
        <Slider label="Collision rate ν_c/ω at n_c" value={ni} min={0} max={NU_STOPS.length - 1} step={1} onChange={setNi} fmt={(i) => fmtNu(NU_STOPS[i])} />
      </div>
    </SimFrame>
  )
}

function vline(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, color: string, u: number) {
  ctx.save()
  ctx.setLineDash([4 * u, 4 * u])
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.8
  ctx.lineWidth = 1.1 * u
  ctx.beginPath()
  ctx.moveTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.stroke()
  ctx.restore()
}

const sup = (d: number) => String(d).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)])

/** Complex field at increasing positions x: linear interpolation of the solution; analytic incident + reflected
 *  wave in the vacuum (x < 0), with the incident amplitude 1. */
function sampler(s: WaveSolution, th: number) {
  let j = 0
  const kx = Math.cos(th)
  const n = s.x.length
  return (x: number): [number, number] => {
    if (x <= 0) {
      const a = Math.cos(kx * x)
      const b = Math.sin(kx * x)
      // e^{i kx x} + r e^{−i kx x}
      return [a + s.rRe * a + s.rIm * b, b + s.rIm * a - s.rRe * b]
    }
    while (j < n - 2 && s.x[j + 1] < x) j++
    const t = Math.max(0, Math.min(1, (x - s.x[j]) / (s.x[j + 1] - s.x[j] || 1)))
    return [s.fRe[j] + t * (s.fRe[j + 1] - s.fRe[j]), s.fIm[j] + t * (s.fIm[j + 1] - s.fIm[j])]
  }
}

/** Replace −1 entries (empty bins) by linear interpolation between their filled neighbours. */
function fillGaps(a: Float64Array) {
  const n = a.length
  let last = -1
  for (let i = 0; i < n; i++) {
    if (a[i] >= 0) {
      if (last >= 0 && i - last > 1) for (let k = last + 1; k < i; k++) a[k] = a[last] + ((a[i] - a[last]) * (k - last)) / (i - last)
      else if (last < 0) for (let k = 0; k < i; k++) a[k] = a[i]
      last = i
    }
  }
  if (last >= 0) for (let k = last + 1; k < n; k++) a[k] = a[last]
}
