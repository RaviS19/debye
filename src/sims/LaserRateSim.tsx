// L1: switch a laser on. Four-level rate equations for inversion and photons; above threshold the inversion
// spikes, rings (relaxation oscillations) and clamps at N_th while the output grows as r − 1.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { newLaser, relaxationOmega, stepLaser, thresholdInversion, type LaserState } from '../physics/laserRate'
import { SimFrame, Slider } from './SimFrame'

const WINDOW = 3 // upper-state lifetimes shown
const HIST = 600

export function LaserRateSim() {
  const [running, setRunning] = useState(true)
  const [r, setR] = useState(3)
  const [tauC, setTauC] = useState(0.01)
  const [speed, setSpeed] = useState(1)
  const st = useRef<LaserState>(newLaser())
  const hist = useRef<{ t: number; N: number; phi: number }[]>([])
  const ups = useRef<number[]>([])
  const [meas, setMeas] = useState({ N: 0, phi: 0, w: 0 })

  const p = { R: r / tauC, tauC }
  const nTh = thresholdInversion(p)
  const phiUnit = tauC * thresholdInversion(p) // photons in units of τc·R_th (= 1 with τ = 1), so the steady state is r − 1
  const wTheory = relaxationOmega(p)

  const restart = () => {
    st.current = newLaser()
    st.current.phi = 1e-7
    hist.current = []
    ups.current = []
    setMeas({ N: 0, phi: 0, w: 0 })
  }

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.15 : 0.6, () => draw())

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    const pad = 34 * u
    // layout: time traces and power curve side by side, or stacked on phones
    const left = { x: pad, y: 22 * u, w: narrow ? W - pad - 12 * u : W * 0.6 - pad, h: narrow ? H * 0.5 - 44 * u : H - 56 * u }
    const right = narrow
      ? { x: pad, y: H * 0.5 + 22 * u, w: W - pad - 12 * u, h: H * 0.5 - 56 * u }
      : { x: W * 0.6 + pad, y: 22 * u, w: W * 0.4 - pad - 12 * u, h: H - 56 * u }

    const frame = (b: typeof left, xl: string, yl: string) => {
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = u
      ctx.strokeRect(b.x, b.y, b.w, b.h)
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      ctx.fillText(xl, b.x + b.w / 2, b.y + b.h + 28 * u)
      ctx.save()
      ctx.translate(b.x - 20 * u, b.y + b.h / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(yl, 0, 0)
      ctx.restore()
      ctx.textAlign = 'left'
    }

    // time traces
    frame(left, 'time (upper-state lifetimes τ)', 'relative to steady state')
    const h = hist.current
    const t1 = h.length ? h[h.length - 1].t : 0
    const t0 = Math.max(0, t1 - WINDOW)
    const yMax = 4
    const X = (t: number) => left.x + ((t - t0) / WINDOW) * left.w
    const Y = (v: number) => left.y + left.h - Math.min(v / yMax, 1) * left.h
    ctx.strokeStyle = COLORS.grid
    ctx.setLineDash([4 * u, 4 * u])
    ctx.beginPath()
    ctx.moveTo(left.x, Y(1))
    ctx.lineTo(left.x + left.w, Y(1))
    ctx.stroke()
    ctx.setLineDash([])
    const phiSS = Math.max(r - 1, 0.05)
    glowStroke(ctx, COLORS.amber, 1.6 * u, () => h.forEach((q, i) => (i ? ctx.lineTo(X(q.t), Y(q.N / nTh)) : ctx.moveTo(X(q.t), Y(q.N / nTh)))))
    glowStroke(ctx, COLORS.cyan, 1.6 * u, () => h.forEach((q, i) => (i ? ctx.lineTo(X(q.t), Y(q.phi / phiUnit / phiSS)) : ctx.moveTo(X(q.t), Y(q.phi / phiUnit / phiSS)))))
    ctx.fillStyle = COLORS.amber
    ctx.fillText('inversion N / N_th', left.x + 8 * u, left.y + 14 * u)
    ctx.fillStyle = COLORS.cyan
    ctx.fillText(r > 1 ? 'laser output / steady value' : 'laser output (below threshold: none)', left.x + 8 * u, left.y + 28 * u)

    // power curve
    frame(right, 'pump  r = R / R_th', 'output  (τc R_th units)')
    const rMax = 5
    const oMax = 4.5
    const PX = (x: number) => right.x + (x / rMax) * right.w
    const PY = (y: number) => right.y + right.h - (y / oMax) * right.h
    glowStroke(ctx, COLORS.violet, 2 * u, () => {
      ctx.moveTo(PX(0), PY(0))
      ctx.lineTo(PX(1), PY(0))
      ctx.lineTo(PX(rMax), PY(rMax - 1))
    })
    ctx.fillStyle = COLORS.text
    for (let k = 0; k <= rMax; k++) ctx.fillText(String(k), PX(k) - 3 * u, right.y + right.h + 13 * u)
    ctx.fillStyle = COLORS.violet
    ctx.fillText('threshold', PX(1) + 4 * u, PY(0) - 6 * u)
    const s = st.current
    ctx.fillStyle = COLORS.glow
    ctx.beginPath()
    ctx.arc(PX(r), PY(Math.min(s.phi / phiUnit, oMax)), 5 * u, 0, 2 * Math.PI)
    ctx.fill()
  }

  useAnimation(
    canvas,
    () => {
      const s = st.current
      const dt = tauC / 25
      const steps = Math.ceil((0.02 * speed) / dt)
      for (let i = 0; i < steps; i++) {
        const before = s.N
        stepLaser(s, p, dt)
        if (s.t > 0.3 && before < nTh && s.N >= nTh) ups.current.push(s.t)
      }
      hist.current.push({ t: s.t, N: s.N, phi: s.phi })
      while (hist.current.length > HIST || (hist.current.length && hist.current[0].t < s.t - WINDOW)) hist.current.shift()
      const u = ups.current
      let w = 0
      if (u.length >= 3) {
        const last = u.slice(-4)
        w = (2 * Math.PI * (last.length - 1)) / (last[last.length - 1] - last[0])
      }
      if (Math.abs(s.N - meas.N) / nTh > 0.005 || Math.abs(s.phi - meas.phi) > 0.01 || w !== meas.w) setMeas({ N: s.N, phi: s.phi, w })
      draw()
    },
    running,
  )

  const nOk = r > 1 ? Math.abs(meas.N / nTh - 1) < 0.02 : Math.abs(meas.N / (r * nTh) - 1) < 0.02
  const phiOk = r > 1 && Math.abs(meas.phi / phiUnit / (r - 1) - 1) < 0.03
  const wOk = wTheory > 0 && meas.w > 0 && Math.abs(meas.w / wTheory - 1) < 0.1

  return (
    <SimFrame
      id="laser-rate"
      title="Switch on a laser (rate equations)"
      running={running}
      setRunning={setRunning}
      onReset={restart}
      hint="Press Reset to switch the pump on from a dark laser. Above threshold (r > 1) the inversion overshoots, the output spikes, rings and settles, and the inversion clamps at N_th however hard you pump. Drop r below 1 and the laser goes dark. Time is in upper-state lifetimes τ; the photon lifetime τc is the cavity's."
    >
      <canvas ref={canvas} className="sim" aria-label="Laser rate-equation simulation" />
      <div className="readouts">
        <span>inversion N/N_th: theory <b>{r > 1 ? '1.00' : r.toFixed(2)}</b>, measured <b className={nOk ? 'ok' : ''}>{(meas.N / nTh).toFixed(2)}</b></span>
        <span>output: theory <b>{Math.max(r - 1, 0).toFixed(2)}</b>, measured <b className={phiOk ? 'ok' : ''}>{(meas.phi / phiUnit).toFixed(2)}</b></span>
        <span>relaxation ω_R·τ: theory <b>{wTheory ? wTheory.toFixed(1) : '—'}</b>, measured <b className={wOk ? 'ok' : ''}>{meas.w ? meas.w.toFixed(1) : '…'}</b></span>
      </div>
      <div className="controls">
        <Slider label="Pump r = R / R_th" value={r} min={0.2} max={5} step={0.1} onChange={(v) => { setR(v); ups.current = [] }} fmt={(v) => v.toFixed(1)} />
        <Slider label="Photon lifetime τc / τ" value={tauC} min={0.003} max={0.05} step={0.001} onChange={(v) => { setTauC(v); restart() }} fmt={(v) => v.toFixed(3)} />
        <Slider label="Speed" value={speed} min={1} max={5} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
