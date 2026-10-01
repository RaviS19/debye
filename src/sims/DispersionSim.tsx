// A5: dispersion explorer. The electrostatic branches of a hydrogen plasma on one log–log chart, with
// sliders for density, temperatures and field, a k cursor with phase and group velocities, and a
// "measure with PIC" button that runs the 1D particle-in-cell code and drops the measured ω on the chart.
import { useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { cyclotronFrequency, debyeLength, e, me, mp, plasmaFrequency } from '../physics/constants'
import {
  bohmGross,
  bohmGrossGroup,
  createEpwRun,
  epwFrequency,
  ionAcoustic,
  ionAcousticGroup,
  ionCyclotronWave,
  lowerHybrid,
  soundSpeed,
  stepEpwRun,
  upperHybrid,
  type EpwRun,
} from '../physics/eswaves'
import { SimFrame, Slider } from './SimFrame'

const MU = me / mp
const KX = [-3, 1] // log10 kλ_De
const WY = [-6, 1.2] // log10 ω/ω_pe
const PIC_N = 12000
const PIC_STEPS = 900
const PIC_PER_FRAME = 8
const K_MIN = 0.05
const K_MAX = 0.45

type Branch = 'epw' | 'iaw' | 'uh' | 'eic' | 'lh'
const BRANCHES: { key: Branch; label: string; color: string; magnetized: boolean }[] = [
  { key: 'epw', label: 'electron plasma (Bohm–Gross)', color: COLORS.cyan, magnetized: false },
  { key: 'iaw', label: 'ion acoustic', color: COLORS.magenta, magnetized: false },
  { key: 'uh', label: 'upper hybrid (k ⊥ B)', color: COLORS.amber, magnetized: true },
  { key: 'eic', label: 'ion cyclotron (k nearly ⊥ B)', color: COLORS.violet, magnetized: true },
  { key: 'lh', label: 'lower hybrid', color: COLORS.lime, magnetized: true },
]

interface Point { K: number; w: number; faded: boolean }

export function DispersionSim() {
  const [running, setRunning] = useState(true)
  const [logn, setLogn] = useState(18)
  const [logTe, setLogTe] = useState(1)
  const [logTi, setLogTi] = useState(0)
  const [logB, setLogB] = useState(-0.3)
  const [logK, setLogK] = useState(Math.log10(0.25))
  const [shown, setShown] = useState<Record<Branch, boolean>>({ epw: true, iaw: true, uh: true, eic: true, lh: true })
  const [points, setPoints] = useState<Point[]>([])
  const [picState, setPicState] = useState<{ K: number; progress: number; w: number | null; faded: boolean } | null>(null)
  const pic = useRef<EpwRun | null>(null)

  const n = 10 ** logn
  const Te = 10 ** logTe
  const Ti = 10 ** logTi
  const B = 10 ** logB
  const K = 10 ** logK
  const tau = Ti / Te
  const wpe = plasmaFrequency(n)
  const wc = cyclotronFrequency(B) / wpe
  const lD = debyeLength(n, Te)
  const vth = Math.sqrt((Te * e) / me)
  const cs = soundSpeed(Te, Ti)

  const fn: Record<Branch, (k: number) => number> = {
    epw: (k) => bohmGross(k),
    iaw: (k) => ionAcoustic(k, MU, tau),
    uh: (k) => upperHybrid(k, wc),
    eic: (k) => ionCyclotronWave(k, MU, tau, wc),
    lh: () => lowerHybrid(MU, wc),
  }

  const startPic = () => {
    const Kp = Math.min(K_MAX, Math.max(K_MIN, K))
    pic.current = createEpwRun(Kp, PIC_N)
    setPicState({ K: Kp, progress: 0, w: null, faded: false })
    setRunning(true)
  }

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.35 : 0.56, () => draw(), narrow ? 620 : 480)

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
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`

    // ---- dispersion chart ----
    const chartW = stacked ? W : W * 0.63
    const chartH = stacked ? H * 0.6 : H
    const padL = 44 * u
    const padB = 34 * u
    const padT = 10 * u
    const padR = 10 * u
    const pw = chartW - padL - padR
    const ph = chartH - padT - padB
    const X = (lk: number) => padL + ((lk - KX[0]) / (KX[1] - KX[0])) * pw
    const Y = (lw: number) => padT + (1 - (lw - WY[0]) / (WY[1] - WY[0])) * ph
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    for (let t = KX[0]; t <= KX[1]; t++) {
      ctx.beginPath()
      ctx.moveTo(X(t), padT)
      ctx.lineTo(X(t), padT + ph)
      ctx.stroke()
      ctx.fillText(t === 0 ? '1' : `10${sup(t)}`, X(t), padT + ph + 14 * u)
    }
    ctx.textAlign = 'right'
    for (let t = Math.ceil(WY[0]); t <= WY[1]; t++) {
      ctx.beginPath()
      ctx.moveTo(padL, Y(t))
      ctx.lineTo(padL + pw, Y(t))
      ctx.stroke()
      ctx.fillText(t === 0 ? '1' : `10${sup(t)}`, padL - 5 * u, Y(t) + 4 * u)
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, padT, pw, ph)
    ctx.fillStyle = COLORS.white
    ctx.textAlign = 'center'
    ctx.fillText('k λ_De', padL + pw / 2, chartH - 6 * u)
    ctx.save()
    ctx.translate(12 * u, padT + ph / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('ω / ω_pe', 0, 0)
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, padT, pw, ph)
    ctx.clip()
    // heavy electron Landau damping region
    ctx.fillStyle = 'rgba(251,95,95,0.06)'
    ctx.fillRect(X(Math.log10(0.4)), padT, X(KX[1]) - X(Math.log10(0.4)), ph)
    ctx.fillStyle = 'rgba(251,95,95,0.75)'
    ctx.textAlign = 'right'
    ctx.fillText('EPW damped', padL + pw - 4 * u, padT + 14 * u)
    // reference levels
    const ref = (lw: number, text: string) => {
      ctx.setLineDash([3 * u, 5 * u])
      ctx.strokeStyle = 'rgba(154,160,201,0.45)'
      ctx.beginPath()
      ctx.moveTo(padL, Y(lw))
      ctx.lineTo(padL + pw, Y(lw))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      ctx.fillText(text, padL + pw - 4 * u, Y(lw) - 4 * u)
    }
    ref(0, 'ω_pe')
    ref(0.5 * Math.log10(MU), 'ω_pi')
    if (shown.eic || shown.lh) ref(Math.log10(MU * wc), 'Ω_ci')
    // branches (the electron plasma wave last, so it stays on top of the upper hybrid line)
    const NPTS = Math.round(pw / (2 * u))
    for (const b of [...BRANCHES.slice(1), BRANCHES[0]]) {
      if (!shown[b.key]) continue
      if (b.key === 'lh') ctx.setLineDash([7 * u, 5 * u])
      glowStroke(ctx, b.color, 2 * u, () => {
        for (let i = 0; i <= NPTS; i++) {
          const lk = KX[0] + ((KX[1] - KX[0]) * i) / NPTS
          const lw = Math.log10(fn[b.key](10 ** lk))
          const py = Math.max(-1e4, Math.min(1e4, Y(lw)))
          if (i) ctx.lineTo(X(lk), py)
          else ctx.moveTo(X(lk), py)
        }
      })
      ctx.setLineDash([])
    }
    // cursor
    ctx.strokeStyle = 'rgba(143,255,255,0.55)'
    ctx.lineWidth = u
    ctx.beginPath()
    ctx.moveTo(X(logK), padT)
    ctx.lineTo(X(logK), padT + ph)
    ctx.stroke()
    for (const b of BRANCHES) {
      if (!shown[b.key]) continue
      ctx.fillStyle = b.color
      ctx.beginPath()
      ctx.arc(X(logK), Y(Math.log10(fn[b.key](K))), 3.5 * u, 0, 7)
      ctx.fill()
    }
    // PIC measurements
    for (const p of points) {
      const px = X(Math.log10(p.K))
      const py = Y(Math.log10(p.w))
      ctx.strokeStyle = COLORS.lime
      ctx.lineWidth = 2 * u
      ctx.fillStyle = p.faded ? 'rgba(3,7,16,1)' : '#fff'
      ctx.shadowColor = COLORS.lime
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(px, py, 5 * u, 0, 7)
      ctx.fill()
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    ctx.restore()

    // ---- PIC panel ----
    const px0 = stacked ? 0 : chartW + 8 * u
    const py0 = stacked ? chartH + 6 * u : 0
    const pW = stacked ? W : W - chartW - 8 * u
    const pH = stacked ? H - chartH - 6 * u : H
    ctx.strokeStyle = COLORS.grid
    ctx.strokeRect(px0 + 0.5, py0 + 0.5, pW - 1, pH - 1)
    ctx.textAlign = 'left'
    const run = pic.current
    if (!run) {
      ctx.fillStyle = COLORS.text
      const lines = ['PIC: press "Measure ω with PIC".', 'Warm electrons (v_th = √(kTe/m))', 'ring at one chosen k; the code', 'times the oscillation and drops', 'the point on the chart.']
      lines.forEach((l, i) => ctx.fillText(l, px0 + 10 * u, py0 + 22 * u + i * 16 * u))
      return
    }
    const p = run.pic
    // phase space
    const psH = pH * 0.55
    ctx.fillStyle = COLORS.text
    ctx.fillText(`PIC phase space, kλ_D = ${run.K.toFixed(2)}`, px0 + 8 * u, py0 + 15 * u)
    ctx.fillStyle = COLORS.cyan
    ctx.globalAlpha = 0.55
    const vmax = 4
    for (let i = 0; i < p.x.length; i += 5) {
      const x = px0 + 6 * u + (p.x[i] / p.L) * (pW - 12 * u)
      const y = py0 + 22 * u + (0.5 - p.v[i] / (2 * vmax)) * (psH - 26 * u)
      ctx.fillRect(x, y, 1.4 * u, 1.4 * u)
    }
    ctx.globalAlpha = 1
    // mode amplitude trace
    const ty = py0 + psH + (pH - psH) * 0.55
    const th = (pH - psH) * 0.36
    const tx0 = px0 + 8 * u
    const tw = pW - 16 * u
    const tmax = PIC_STEPS * p.dt
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(tx0, ty)
    ctx.lineTo(tx0 + tw, ty)
    ctx.stroke()
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('mode amplitude E_k(t)', tx0, py0 + psH + 12 * u)
    const peak = Math.max(1e-9, run.peak)
    glowStroke(ctx, COLORS.magenta, 1.5 * u, () => {
      for (let i = 0; i < run.trace.length; i += 2) {
        const x = tx0 + (run.times[i] / tmax) * tw
        const y = ty - (run.trace[i] / peak) * th
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
    })
    ctx.strokeStyle = COLORS.lime
    for (const z of run.zeros) {
      const x = tx0 + (z / tmax) * tw
      ctx.beginPath()
      ctx.moveTo(x, ty - 4 * u)
      ctx.lineTo(x, ty + 4 * u)
      ctx.stroke()
    }
    ctx.fillStyle = COLORS.text
    ctx.fillText(`t = ${p.t.toFixed(0)} / ω_pe`, tx0, py0 + pH - 6 * u)
  }

  // redraw after resizes and slider changes while paused (the animation loop is not running then)
  useEffect(() => {
    if (!running) draw()
  })

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const run = pic.current
      if (run && run.trace.length <= PIC_STEPS) {
        stepEpwRun(run, PIC_PER_FRAME)
        if (++frame % 6 === 0 || run.trace.length > PIC_STEPS) {
          const w = epwFrequency(run)
          const done = run.trace.length > PIC_STEPS
          setPicState({ K: run.K, progress: Math.min(1, run.trace.length / PIC_STEPS), w, faded: run.faded })
          if (done && w) setPoints((ps) => [...ps, { K: run.K, w, faded: run.faded }])
        }
      }
      draw()
    },
    running,
  )

  const cursorEpw = bohmGross(K)
  const cursorIaw = ionAcoustic(K, MU, tau)
  const kPhys = K / lD
  const bg = picState ? bohmGross(picState.K) : 1
  const picOk = picState?.w != null && Math.abs(picState.w / bg - 1) < 0.05
  const busy = !!picState && picState.progress < 1
  const Kp = Math.min(K_MAX, Math.max(K_MIN, K))

  return (
    <SimFrame
      id="dispersion"
      title="Dispersion explorer (+ measure it with PIC)"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        pic.current = null
        setPicState(null)
        setPoints([])
      }}
      hint="Axes are normalized: k in units of 1/λ_De and ω in units of ω_pe, for a hydrogen plasma. In these units the unmagnetized branches are universal; T_i/T_e moves the ion acoustic line and B/√n moves the magnetized ones. Drag the k cursor to read phase and group velocities, then measure the electron plasma wave with the particle-in-cell code at a few k between 0.05 and 0.45. Above about 0.3 the PIC points sit visibly above Bohm–Gross: that is kinetic physics the fluid model leaves out (A9)."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {BRANCHES.map((b) => (
          <button
            key={b.key}
            className="sym-chip"
            style={{ borderColor: shown[b.key] ? b.color : undefined, color: shown[b.key] ? b.color : undefined }}
            onClick={() => setShown((s) => ({ ...s, [b.key]: !s[b.key] }))}
          >
            {shown[b.key] ? '●' : '○'} {b.label}
          </button>
        ))}
      </div>
      <canvas ref={canvas} className="sim" aria-label="Dispersion relation explorer with particle-in-cell measurement" />
      <div className="row" style={{ marginTop: 10, gap: 6 }}>
        <button className="btn small primary" disabled={busy} onClick={startPic}>
          {busy ? `PIC running… ${Math.round((picState?.progress ?? 0) * 100)}%` : `Measure ω with PIC at kλ_D = ${Kp.toFixed(2)}`}
        </button>
        {points.length > 0 && <button className="btn small" onClick={() => setPoints([])}>Clear points</button>}
      </div>
      <div className="readouts">
        <span>λ_D = <b>{num(lD)} m</b></span>
        <span>f_pe = <b>{num(wpe / (2 * Math.PI))} Hz</b></span>
        <span>c_s = <b>{num(cs / 1000)} km/s</b></span>
        <span>f_ce = <b>{num(cyclotronFrequency(B) / (2 * Math.PI))} Hz</b></span>
        <span>f_UH = <b>{num((upperHybrid(0, wc) * wpe) / (2 * Math.PI))} Hz</b></span>
        <span>f_LH = <b>{num((lowerHybrid(MU, wc) * wpe) / (2 * Math.PI))} Hz</b></span>
      </div>
      <div className="readouts">
        <span>cursor: kλ_D = <b>{K < 0.01 ? K.toExponential(1) : K.toFixed(3)}</b>, wavelength <b>{num((2 * Math.PI) / kPhys)} m</b></span>
        <span style={{ color: COLORS.cyan }}>EPW: ω/ω_pe <b>{cursorEpw.toFixed(3)}</b>, v_φ <b>{num((cursorEpw / K) * vth)}</b>, v_g <b>{num(bohmGrossGroup(K) * vth)} m/s</b></span>
        <span style={{ color: COLORS.magenta }}>ion wave: v_φ <b>{num((cursorIaw / K) * vth)}</b>, v_g <b>{num(ionAcousticGroup(K, MU, tau) * vth)} m/s</b></span>
      </div>
      {picState && (
        <div className="readouts">
          <span>PIC at kλ_D = <b>{picState.K.toFixed(2)}</b></span>
          <span>measured ω/ω_pe = <b className={picOk ? 'ok' : ''}>{picState.w ? picState.w.toFixed(3) : '…'}</b></span>
          <span>Bohm–Gross = <b>{bg.toFixed(3)}</b>{picState.w ? ` (${picState.w >= bg ? '+' : ''}${((picState.w / bg - 1) * 100).toFixed(1)}%)` : ''}</span>
          {picState.faded && <span style={{ color: 'var(--amber)' }}>wave damped into the noise (Landau damping, A9)</span>}
        </div>
      )}
      <div className="controls">
        <Slider label="Density n" value={logn} min={14} max={22} step={0.1} onChange={setLogn} fmt={(v) => `${num(10 ** v, 2)} m⁻³`} />
        <Slider label="Electron T_e" value={logTe} min={-0.5} max={4} step={0.05} onChange={setLogTe} fmt={(v) => `${num(10 ** v, 2)} eV`} />
        <Slider label="Ion T_i" value={logTi} min={-2} max={4} step={0.05} onChange={setLogTi} fmt={(v) => `${num(10 ** v, 2)} eV`} />
        <Slider label="Magnetic field B" value={logB} min={-3} max={1} step={0.05} onChange={setLogB} fmt={(v) => `${num(10 ** v, 2)} T`} />
        <Slider label="k cursor (kλ_De)" value={logK} min={KX[0]} max={0.7} step={0.01} onChange={setLogK} fmt={(v) => (10 ** v < 0.01 ? (10 ** v).toExponential(1) : (10 ** v).toFixed(3))} />
      </div>
    </SimFrame>
  )
}

/** Engineering notation like constants.sci, but keeps trailing zeros of whole numbers (10 stays 10). */
function num(x: number, digits = 3): string {
  if (x === 0 || !isFinite(x)) return String(x)
  const exp = Math.floor(Math.log10(Math.abs(x)))
  if (exp >= -2 && exp <= 3) {
    const s = x.toPrecision(digits)
    if (s.includes('e')) return String(Number(s))
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s
  }
  return `${(x / 10 ** exp).toPrecision(digits)}×10${sup(exp)}`
}

function sup(t: number) {
  return String(t).replace(/[-0-9]/g, (d) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(d)])
}
