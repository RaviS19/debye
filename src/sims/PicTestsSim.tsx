// B9: four sanity checks of the same 1D electromagnetic PIC code, each against an exact answer.
//   Vacuum pulse: the characteristic field solver (cΔt = Δx) moves light exactly at c; a Yee solver below its
//     Courant limit lags and spreads (numerical dispersion).
//   Plasma oscillation: cold electrons ring at the leapfrog frequency (2/Δt) asin(ω_peΔt/2), and blow up for
//     ω_peΔt > 2.
//   Light in plasma: ω² = ω_pe² + c²k², and every electron keeps p_y − eA_y.
//   Noise and heating: thermal field noise ∝ 1/(particles per cell); numerical heating when Δx ≫ λ_D.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  canonicalError,
  createEmPic,
  createYeePulse,
  emOmegaNumerical,
  energies,
  leapfrogGrowth,
  leapfrogRatio,
  meanUx2,
  modeOf,
  noiseRatio,
  stepEmPic,
  stepYee,
  yeeGroupVelocity,
  type EmPic,
  type YeePulse,
} from '../physics/emPic'
import { sci } from '../physics/constants'
import { SimFrame, Slider } from './SimFrame'

type Mode = 'pulse' | 'osc' | 'light' | 'heat'
const MODES: Record<Mode, string> = { pulse: 'Vacuum pulse', osc: 'Plasma oscillation', light: 'Light in plasma', heat: 'Noise and grid heating' }
const HEAT_VTE = 0.05 // v_te/c in the heating test
const HEAT_DX = 0.1

// --- vacuum pulse: 500 cells of width 1, Gaussian envelope σ = 12 cells ---
const PN = 500
const PX0 = 70
const PSIG = 12
/** Initial displacement in the oscillation test: visible when stable, tiny when leapfrog is unstable (ω_peΔt > 2). */
const oscAmp = (wpdt: number) => (wpdt > 2 ? 1e-8 : 0.01)
const pulseShape = (x: number, kc: number) => Math.exp(-(((x - PX0) / PSIG) ** 2)) * Math.cos(kc * (x - PX0))

interface Hist {
  t: number[]
  y: number[]
}

export function PicTestsSim() {
  const [running, setRunning] = useState(true)
  const [mode, setMode] = useState<Mode>('pulse')
  const [courant, setCourant] = useState(0.5)
  const [cells, setCells] = useState(8) // cells per carrier wavelength
  const [wpdt, setWpdt] = useState(0.2)
  const [nl, setNl] = useState(0.3) // n/n_c in the light test
  const [m, setM] = useState(3)
  const [ratio, setRatio] = useState(1) // Δx/λ_D
  const [ppc, setPpc] = useState(64)
  const pic = useRef<EmPic | null>(null)
  const yee = useRef<YeePulse | null>(null)
  const hist = useRef<Hist>({ t: [], y: [] })
  const aux = useRef<{ zeros: number[]; prev: number; tPrev: number; phase: number; prevPh: number; tPh: number; u0: number; wsum: number; wn: number; a0: number; blown: boolean }>({
    zeros: [],
    prev: 0,
    tPrev: 0,
    phase: 0,
    prevPh: NaN,
    tPh: 0,
    u0: 1,
    wsum: 0,
    wn: 0,
    a0: 0,
    blown: false,
  })
  const [, setTick] = useState(0)
  const frameNo = useRef(0)

  const setup = (md: Mode = mode, o: { courant?: number; cells?: number; wpdt?: number; nl?: number; m?: number; ratio?: number; ppc?: number } = {}) => {
    const cv = o.courant ?? courant
    const cl = o.cells ?? cells
    const w = o.wpdt ?? wpdt
    const n = o.nl ?? nl
    const mm = o.m ?? m
    const r = o.ratio ?? ratio
    const pp = o.ppc ?? ppc
    hist.current = { t: [], y: [] }
    aux.current = { zeros: [], prev: 0, tPrev: 0, phase: 0, prevPh: NaN, tPh: 0, u0: 1, wsum: 0, wn: 0, a0: 0, blown: false }
    yee.current = null
    if (md === 'pulse') {
      const kc = (2 * Math.PI) / cl
      const s = createEmPic({ nx: PN, dx: 1, density: () => 0, ppc: 1, TeKeV: 1 })
      for (let j = 0; j < s.fp.length; j++) s.fp[j] = pulseShape(j, kc)
      pic.current = s
      yee.current = createYeePulse(PN + 1, 1, cv, PX0, PSIG, kc)
    } else if (md === 'osc') {
      const dx = 0.1
      // above the limit, start from a tiny displacement so the growth stays linear (well under a cell) until the run stops
      const s = createEmPic({ nx: 64, dx, periodic: true, density: () => (w / dx) ** 2, ppc: 20, TeKeV: 0, cold: true, displace: { amp: oscAmp(w), mode: 1 } })
      aux.current.prev = modeOf(s.ex, 1)[0]
      // stable: E₁(t) is the real (cosine) part of mode 1, normalized to its start; unstable: the mode's amplitude
      aux.current.a0 = w > 2 ? Math.hypot(...modeOf(s.ex, 1)) : Math.abs(aux.current.prev)
      pic.current = s
    } else if (md === 'light') {
      const nx = 256
      const dx = 0.15
      const k = (2 * Math.PI * mm) / (nx * dx)
      pic.current = createEmPic({ nx, dx, periodic: true, density: () => n, ppc: 8, TeKeV: 0, cold: true, pump: { a: 0.05, k } })
    } else {
      const wp = (r * HEAT_VTE) / HEAT_DX
      const s = createEmPic({ nx: 64, dx: HEAT_DX, periodic: true, density: () => wp * wp, ppc: pp, TeKeV: HEAT_VTE * HEAT_VTE * 510.99895, seed: 2 })
      aux.current.u0 = meanUx2(s)
      pic.current = s
    }
  }
  if (!pic.current) setup()

  const choose = (md: Mode) => {
    setMode(md)
    setup(md)
    setRunning(true)
  }

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.05 : 0.5, undefined, 480)

  // derived theory
  const kcPulse = (2 * Math.PI) / cells
  const vgYee = yeeGroupVelocity(kcPulse, courant)
  const lf = leapfrogRatio(wpdt)
  const lfGrow = leapfrogGrowth(wpdt)
  const kLight = (2 * Math.PI * m) / (256 * 0.15)
  const wLight = Math.sqrt(nl + kLight * kLight)
  const wpHeat = (ratio * HEAT_VTE) / HEAT_DX

  const draw = () => {
    const c = canvas.current
    const s = pic.current
    if (!c || !s) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = (narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const pl = (narrow ? 8 : 40) * u
    const pr = 8 * u
    const top: [number, number] = [18 * u, H * 0.58]
    const bot: [number, number] = [H * 0.58 + 22 * u, H - 18 * u]
    const box = (y: [number, number], txt: string, col: string) => {
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = u
      ctx.strokeRect(pl, y[0], W - pl - pr, y[1] - y[0])
      ctx.fillStyle = col
      ctx.textAlign = 'left'
      ctx.fillText(txt, pl + 2 * u, y[0] - 5 * u)
    }
    const line = (n: number, X: (i: number) => number, Y: (i: number) => number, col: string, lw = 1.4, dashed = false) => {
      if (dashed) {
        ctx.save()
        ctx.setLineDash([5 * u, 4 * u])
        ctx.strokeStyle = col
        ctx.lineWidth = lw * u
        ctx.beginPath()
        for (let i = 0; i < n; i++) (i ? ctx.lineTo(X(i), Y(i)) : ctx.moveTo(X(i), Y(i)))
        ctx.stroke()
        ctx.restore()
        return
      }
      glowStroke(ctx, col, lw * u, () => {
        for (let i = 0; i < n; i++) (i ? ctx.lineTo(X(i), Y(i)) : ctx.moveTo(X(i), Y(i)))
      })
    }
    const xs = (L: number) => (x: number) => pl + (x / L) * (W - pl - pr)
    const timeTrace = (tMax: number, yLo: number, yHi: number, title: string, col: string, theory?: (t: number) => number, logY = false) => {
      box(bot, title, col)
      const { t, y } = hist.current
      const X = (tt: number) => pl + (tt / tMax) * (W - pl - pr)
      const tr = (v: number) => (logY ? Math.log10(Math.max(v, 1e-30)) : v)
      const Y = (v: number) => bot[1] - ((tr(v) - yLo) / (yHi - yLo)) * (bot[1] - bot[0])
      ctx.save()
      ctx.beginPath()
      ctx.rect(pl, bot[0], W - pl - pr, bot[1] - bot[0])
      ctx.clip()
      if (theory) line(200, (i) => X((tMax * i) / 199), (i) => Y(theory((tMax * i) / 199)), COLORS.amber, 1.2, true)
      line(t.length, (i) => X(t[i]), (i) => Y(y[i]), col)
      ctx.restore()
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      for (const f of [0, 0.5, 1]) ctx.fillText((tMax * f).toFixed(0), X(tMax * f), H - 5 * u)
      ctx.textAlign = 'left'
    }

    if (mode === 'pulse') {
      const X = xs(PN)
      const Y = (v: number) => (top[0] + top[1]) / 2 - v * (top[1] - top[0]) * 0.44
      box(top, narrow ? 'E_y: PIC solver (cyan), Yee (magenta)' : 'E_y(x): the PIC field solver at cΔt = Δx (cyan), Yee FDTD at your Courant number (magenta), exact (dashed)', COLORS.white)
      const kc = kcPulse
      const t = s.t
      line(PN + 1, (j) => X(j), (j) => Y(pulseShape(j - t, kc)), COLORS.text, 1, true)
      const y = yee.current!
      line(y.n, (i) => X(i), (i) => Y(y.E[i]), COLORS.magenta, 1.2)
      line(s.fp.length, (j) => X(j), (j) => Y(s.fp[j] + s.fm[j]), COLORS.cyan, 1.3)
      // where an exact pulse would be
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      ctx.fillText('x = x₀ + ct', X(PX0 + t), top[1] - 4 * u)
      ctx.textAlign = 'left'
      // bottom: lag of the Yee envelope behind the light front
      const tMax = PN - 2 * PX0
      timeTrace(tMax, -0.5, Math.max(4, ...hist.current.y.map((v) => v + 1)), 'Yee pulse lag behind x₀ + ct (cells) vs time', COLORS.magenta, (tt) => (1 - vgYee) * tt)
    } else if (mode === 'osc') {
      const X = xs(s.L)
      const wp = wpdt / s.dt
      const grow = Math.min(1e6, Math.max(1, ...hist.current.y.slice(-40).map(Math.abs)))
      const vmax = 1.5 * oscAmp(wpdt) * wp * grow
      const Y = (v: number) => (top[0] + top[1]) / 2 - (v / vmax) * (top[1] - top[0]) * 0.42
      box(top, 'electrons: position x across, velocity v_x up', COLORS.white)
      ctx.fillStyle = COLORS.cyan
      const step = Math.max(1, Math.floor(s.np / 640))
      for (let i = 0; i < s.np; i += step) {
        const y = Y(s.ux[i])
        if (y > top[0] && y < top[1]) ctx.fillRect(X(s.x[i]) - u, y - u, 2 * u, 2 * u)
      }
      const blow = lfGrow > 0
      timeTrace(
        40,
        blow ? -1 : -1.2,
        blow ? 6 : 1.2,
        blow ? 'log₁₀ |E₁|/E₁(0) vs ω_pe t; dashed: the predicted growth' : 'E₁(t)/E₁(0) vs ω_pe t; dashed: cos(ω_pe t), the exact answer',
        COLORS.lime,
        blow ? (tt) => Math.exp(lfGrow * tt) : (tt) => Math.cos(tt),
        blow,
      )
    } else if (mode === 'light') {
      const X = xs(s.L)
      const amp = 0.05
      const Y = (v: number) => (top[0] + top[1]) / 2 - (v / (1.3 * amp * Math.max(1, kLight / wLight, 1 / wLight))) * (top[1] - top[0]) * 0.45
      box(top, narrow ? 'E_y (cyan), electron u_y (dots), a_y (dashed)' : 'E_y(x) (cyan); every electron’s u_y = p_y/mc (dots) sits on a_y = eA_y/mc (dashed): p_y − eA_y = 0', COLORS.white)
      ctx.fillStyle = 'rgba(244,114,182,0.75)'
      const step = Math.max(1, Math.floor(s.np / 700))
      for (let i = 0; i < s.np; i += step) ctx.fillRect(X(s.x[i]) - u, Y(s.uy[i]) - u, 2 * u, 2 * u)
      line(s.ay.length, (j) => X(j * s.dx), (j) => Y(s.ay[j]), COLORS.amber, 1.1, true)
      line(s.fp.length, (j) => X(j * s.dx), (j) => Y(s.fp[j] + s.fm[j]), COLORS.cyan, 1.3)
      const tMax = 60
      timeTrace(tMax, -1.2, 1.2, narrow ? 'E_y(x = 0) vs ω0 t; dashed: ω² = ω_pe² + c²k²' : 'E_y at x = 0 over its amplitude vs ω0 t; dashed: cos(ωt) with ω² = ω_pe² + c²k²', COLORS.cyan, (tt) => Math.cos(wLight * tt))
    } else {
      const X = xs(s.L)
      const vmax = 5 * HEAT_VTE * Math.sqrt(Math.max(1, ...hist.current.y))
      const Y = (v: number) => (top[0] + top[1]) / 2 - (v / vmax) * (top[1] - top[0]) * 0.48
      box(top, narrow ? 'electrons: x across, v_x up' : 'electrons: x across, v_x up (thermal plasma, periodic box of 64 cells)', COLORS.white)
      ctx.fillStyle = COLORS.cyan
      const step = Math.max(1, Math.floor(s.np / 1500))
      for (let i = 0; i < s.np; i += step) ctx.fillRect(X(s.x[i]) - 0.8 * u, Y(s.ux[i]) - 0.8 * u, 1.6 * u, 1.6 * u)
      const ymax = Math.max(1.6, ...hist.current.y.map((v) => Math.ceil(v * 2) / 2))
      timeTrace(400, 0.8, ymax, 'temperature T_x/T₀ vs ω_pe t', COLORS.amber, () => 1)
    }
  }

  useAnimation(
    canvas,
    () => {
      const s = pic.current!
      const a = aux.current
      if (mode === 'pulse') {
        const y = yee.current!
        if (s.t < PN - 2 * PX0) {
          stepEmPic(s, 2)
          while (y.t < s.t - 1e-9) stepYee(y, 1)
          // lag of the Yee envelope's centroid behind x₀ + ct
          let p = 0
          let q = 0
          for (let i = 0; i < y.n; i++) {
            const e2 = y.E[i] * y.E[i]
            p += i * e2
            q += e2
          }
          hist.current.t.push(s.t)
          hist.current.y.push(PX0 + s.t - p / q)
        } else setup('pulse')
      } else if (mode === 'osc') {
        const wp = wpdt / s.dt
        if (!a.blown && s.t * wp < 40) {
          for (let k = 0; k < 2; k++) {
            stepEmPic(s, 1)
            const md1 = modeOf(s.ex, 1)
            const v = md1[0]
            if (a.prev < 0 && v >= 0) a.zeros.push(a.tPrev + ((s.t - a.tPrev) * -a.prev) / (v - a.prev))
            a.prev = v
            a.tPrev = s.t
            const r = lfGrow > 0 ? Math.hypot(md1[0], md1[1]) / a.a0 : v / a.a0
            hist.current.t.push(s.t * wp)
            hist.current.y.push(r)
            if (Math.abs(r) > 1e5) {
              a.blown = true
              break
            }
          }
        }
      } else if (mode === 'light') {
        if (s.t < 60) {
          stepEmPic(s, 2)
          const e0 = s.fp[0] + s.fm[0]
          hist.current.t.push(s.t)
          hist.current.y.push(e0 / 0.05)
          // phase of the wave's Fourier mode, to measure ω
          const ey = new Float64Array(s.fp.length)
          for (let j = 0; j < ey.length; j++) ey[j] = s.fp[j] + s.fm[j]
          const [re, im] = modeOf(ey, m)
          const ph = Math.atan2(im, re)
          if (!isNaN(a.prevPh)) {
            let d = ph - a.prevPh
            while (d > Math.PI) d -= 2 * Math.PI
            while (d < -Math.PI) d += 2 * Math.PI
            a.phase += d
          } else a.tPh = s.t
          a.prevPh = ph
        } else setup('light')
      } else {
        const wp = wpHeat
        if (s.t * wp < 400) {
          // about 2 ω_pe⁻¹ per frame, capped at about 120,000 particle pushes (≈ 5 ms) to stay within the physics budget
          const want = Math.max(1, Math.round(2 / (wp * s.dt)))
          const steps = Math.min(want, Math.max(1, Math.floor(120000 / s.np)))
          stepEmPic(s, steps)
          hist.current.t.push(s.t * wp)
          hist.current.y.push(meanUx2(s) / a.u0)
          if (s.t * wp > 10) {
            a.wsum += energies(s).ex / (0.5 * meanUx2(s) * wp * wp * s.L)
            a.wn++
          }
        }
      }
      draw()
      if (++frameNo.current % 4 === 0) setTick((k) => k + 1)
    },
    running,
  )

  // ---------- readouts ----------
  const s = pic.current!
  const a = aux.current
  let readouts: React.ReactNode = null
  if (mode === 'pulse') {
    let err = 0
    for (let j = 0; j < s.fp.length; j++) err = Math.max(err, Math.abs(s.fp[j] + s.fm[j] - pulseShape(j - s.t, kcPulse)))
    const lag = hist.current.y.length ? hist.current.y[hist.current.y.length - 1] : 0
    readouts = (
      <>
        <span>PIC solver (cΔt = Δx): largest error vs the exact pulse <b className={err < 1e-9 ? 'ok' : ''}>{err ? sci(err, 2) : '0'}</b> (round-off): speed exactly c</span>
        <span>Yee at cΔt/Δx = {courant.toFixed(2)}: group velocity theory <b>{vgYee.toFixed(4)}c</b>, measured <b className={s.t > 100 && Math.abs(1 - lag / s.t - vgYee) < 0.01 ? 'ok' : ''}>{s.t > 20 ? (1 - lag / s.t).toFixed(4) : '…'}c</b></span>
        <span>carrier: {cells} cells per wavelength (kΔx = {kcPulse.toFixed(2)})</span>
      </>
    )
  } else if (mode === 'osc') {
    const z = a.zeros
    const wp = wpdt / s.dt
    const meas = z.length >= 3 ? (2 * Math.PI * (z.length - 1)) / (z[z.length - 1] - z[0]) / wp : NaN
    readouts =
      lfGrow > 0 ? (
        <>
          <span>ω_peΔt = <b>{wpdt.toFixed(2)}</b> &gt; 2: leapfrog is unstable</span>
          <span>predicted growth <b>{lfGrow.toFixed(3)}</b> ω_pe (×{Math.exp(lfGrow * wpdt).toFixed(2)} per step){a.blown ? ': the run blew up' : ''}</span>
        </>
      ) : (
        <>
          <span>measured ω/ω_pe = <b className={isFinite(meas) && Math.abs(meas / lf - 1) < 0.005 ? 'ok' : ''}>{isFinite(meas) ? meas.toFixed(4) : '…'}</b></span>
          <span>leapfrog (2/ω_peΔt) asin(ω_peΔt/2) = <b>{lf.toFixed(4)}</b></span>
          <span>exact: <b>1</b> (error {((lf - 1) * 100).toFixed(2)}%)</span>
        </>
      )
  } else if (mode === 'light') {
    const meas = s.t > 5 ? Math.abs(a.phase) / (s.t - a.tPh) : NaN
    const canon = canonicalError(s) / 0.05
    readouts = (
      <>
        <span>kc/ω0 = {kLight.toFixed(3)}, ω_pe/ω0 = {Math.sqrt(nl).toFixed(3)}</span>
        <span>measured ω = <b className={isFinite(meas) && Math.abs(meas / wLight - 1) < 0.01 ? 'ok' : ''}>{isFinite(meas) ? meas.toFixed(4) : '…'}</b>, theory √(ω_pe² + c²k²) = <b>{wLight.toFixed(4)}</b>, the code’s own relation {emOmegaNumerical(kLight, nl, 0.15).toFixed(4)}</span>
        <span>phase speed {(wLight / kLight).toFixed(2)}c, group speed {(kLight / wLight).toFixed(2)}c</span>
        <span>largest |p_y − eA_y| = <b className={canon < 0.02 ? 'ok' : ''}>{(canon * 100).toFixed(2)}%</b> of m v_os</span>
      </>
    )
  } else {
    const meas = a.wn ? a.wsum / a.wn : NaN
    const th = noiseRatio(ppc, ratio)
    const Tnow = hist.current.y.length ? hist.current.y[hist.current.y.length - 1] : 1
    readouts = (
      <>
        <span>Δx/λ_D = <b>{ratio.toFixed(1)}</b>, ω_peΔt = {(wpHeat * HEAT_DX).toFixed(3)}, {s.np.toLocaleString()} particles</span>
        <span>T_x/T₀ = <b className={Math.abs(Tnow - 1) < 0.05 ? 'ok' : ''}>{Tnow.toFixed(3)}</b> at ω_pe t = {(s.t * wpHeat).toFixed(0)}</span>
        <span>field noise W_E/W_K: measured <b className={isFinite(meas) && Math.abs(meas / th - 1) < 0.15 ? 'ok' : ''}>{isFinite(meas) ? sci(meas, 3) : '…'}</b>, thermal estimate <b>{sci(th, 3)}</b> ∝ 1/ppc{ratio > 2 ? ' (an equilibrium estimate: it fails once the grid heats the plasma)' : ''}</span>
      </>
    )
  }

  return (
    <SimFrame
      id="pic-tests"
      title="Sanity checks for a PIC code"
      running={running}
      setRunning={setRunning}
      onReset={() => setup()}
      hint="Every new code is run on problems with known answers first. Vacuum pulse: units of the cell, c = 1; the PIC solver moves light one cell per step along its characteristics, so it is exact; the Yee solver (A6) is exact only at cΔt = Δx. Plasma oscillation: units of ω_pe; push ω_peΔt past 2 and watch leapfrog explode. Light in plasma: units ω0 = c = 1. Noise and heating: units of ω_pe and λ_D; raise Δx/λ_D above about 3 and the plasma heats itself, a pure artefact of the grid."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {(Object.keys(MODES) as Mode[]).map((md) => (
          <button key={md} className={`btn small ${mode === md ? 'primary' : ''}`} onClick={() => choose(md)}>
            {MODES[md]}
          </button>
        ))}
      </div>
      <canvas ref={canvas} className="sim" aria-label="PIC code sanity checks" />
      <div className="readouts">{readouts}</div>
      <div className="controls">
        {mode === 'pulse' && (
          <>
            <Slider label="Yee Courant number cΔt/Δx" value={courant} min={0.2} max={1} step={0.05} onChange={(v) => { setCourant(v); setup('pulse', { courant: v }) }} fmt={(v) => v.toFixed(2)} />
            <Slider label="Cells per carrier wavelength" value={cells} min={4} max={32} step={1} onChange={(v) => { setCells(v); setup('pulse', { cells: v }) }} />
          </>
        )}
        {mode === 'osc' && (
          <Slider label="Time step ω_peΔt" value={wpdt} min={0.1} max={2.3} step={0.05} onChange={(v) => { setWpdt(v); setup('osc', { wpdt: v }) }} fmt={(v) => v.toFixed(2)} />
        )}
        {mode === 'light' && (
          <>
            <Slider label="Density n/n_c (ω_pe²/ω0²)" value={nl} min={0} max={0.9} step={0.05} onChange={(v) => { setNl(v); setup('light', { nl: v }) }} fmt={(v) => v.toFixed(2)} />
            <Slider label="Wavelengths in the box" value={m} min={1} max={8} step={1} onChange={(v) => { setM(v); setup('light', { m: v }) }} />
          </>
        )}
        {mode === 'heat' && (
          <>
            <Slider label="Cell size Δx/λ_D" value={ratio} min={0.5} max={8} step={0.5} onChange={(v) => { setRatio(v); setup('heat', { ratio: v }) }} fmt={(v) => v.toFixed(1)} />
            <Slider label="Particles per cell" value={ppc} min={8} max={256} step={8} onChange={(v) => { setPpc(v); setup('heat', { ppc: v }) }} />
          </>
        )}
      </div>
    </SimFrame>
  )
}
