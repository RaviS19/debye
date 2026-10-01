// A8: two-stream instability in the 1D particle-in-cell code of A1. Two cold electron beams stream
// through each other at ±v0. A bunching of one beam pulls on the other, which bunches it more: the
// field energy grows exponentially until the beams roll up into phase-space vortices.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { createTwoStream, K_CUTOFF, K_MAX_GROWTH, measuredTwoStream, OMEGA_B, stepTwoStream, TS_L, twoStreamGamma, type TwoStreamRun } from '../physics/twoStream'
import { SimFrame, Slider } from './SimFrame'

const NP = 16000
const T_END = 60 // ω_pe t; longer for slow growth near the cut-off (see tEnd below)
const BX = 240
const BV = 120

export function TwoStreamSim() {
  const [running, setRunning] = useState(true)
  const [K, setK] = useState(+K_MAX_GROWTH.toFixed(3))
  const [speed, setSpeed] = useState(2)
  const run = useRef<TwoStreamRun>(createTwoStream(K, { n: NP }))
  const img = useRef<{ canvas: HTMLCanvasElement; data: ImageData; acc: Float32Array } | null>(null)
  const [meas, setMeas] = useState<{ gamma: number; done: boolean } | null>(null)
  const [time, setTime] = useState(0)

  const restart = (k = K) => {
    run.current = createTwoStream(k, { n: NP })
    setMeas(null)
    setTime(0)
    setRunning(true)
  }

  const theory = twoStreamGamma(K) * OMEGA_B
  const tEnd = theory > 0 ? Math.max(T_END, Math.min(150, 7 / theory)) : T_END
  const v0 = run.current.v0

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.05 : 0.62)

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const r = run.current
    const p = r.pic
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const phaseH = H * 0.56
    const vmax = Math.max(1.2, 2.4 * r.v0)
    // phase-space density, one colour per beam
    if (!img.current) {
      const cv = document.createElement('canvas')
      cv.width = BX
      cv.height = BV
      img.current = { canvas: cv, data: new ImageData(BX, BV), acc: new Float32Array(BX * BV * 2) }
    }
    const { canvas: off, data, acc } = img.current
    acc.fill(0)
    for (let i = 0; i < p.x.length; i++) {
      const bx = Math.floor((p.x[i] / TS_L) * BX)
      const by = Math.floor((0.5 - p.v[i] / (2 * vmax)) * BV)
      if (bx < 0 || bx >= BX || by < 0 || by >= BV) continue
      acc[2 * (by * BX + bx) + (i % 2)] += 1
    }
    const px = data.data
    const norm = 1 / Math.max(1, (NP / BX) * 0.35)
    for (let q = 0; q < BX * BV; q++) {
      const a = Math.min(1, Math.sqrt(acc[2 * q] * norm)) // beam going left: magenta
      const b = Math.min(1, Math.sqrt(acc[2 * q + 1] * norm)) // beam going right: cyan
      px[4 * q] = 3 + 244 * a + 31 * b
      px[4 * q + 1] = 7 + 107 * a + 204 * b
      px[4 * q + 2] = 16 + 166 * a + 222 * b
      px[4 * q + 3] = 255
    }
    off.getContext('2d')!.putImageData(data, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, 0, 0, W, phaseH)
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.beginPath()
    ctx.moveTo(0, phaseH / 2)
    ctx.lineTo(W, phaseH / 2)
    ctx.stroke()
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.text
    ctx.fillText('phase space: x across, v up', 8 * u, 14 * u)
    ctx.fillStyle = COLORS.cyan
    ctx.fillText(`beam at +v0 = ${r.v0.toFixed(2)}`, 8 * u, phaseH / 2 - (r.v0 / vmax) * (phaseH / 2) - 8 * u)
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('beam at −v0', 8 * u, phaseH / 2 + (r.v0 / vmax) * (phaseH / 2) + 16 * u)

    // field energy of the fundamental mode, log scale, with the theory slope 2γ
    const gx0 = 44 * u
    const gx1 = W - 10 * u
    const gy0 = phaseH + 26 * u
    const gy1 = H - 22 * u
    const lnW = (a: number) => 2 * Math.log(Math.max(a, 1e-30) / r.amps[0]) // ln(W₁/W₁(0))
    const yMax = 16
    const yMin = -2
    const tMax = Math.max(40, Math.min(tEnd, Math.ceil(p.t / 10) * 10))
    const X = (t: number) => gx0 + (t / tMax) * (gx1 - gx0)
    const Y = (v: number) => gy1 - ((v - yMin) / (yMax - yMin)) * (gy1 - gy0)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    ctx.strokeStyle = COLORS.grid
    for (let v = 0; v <= yMax; v += 4) {
      ctx.beginPath()
      ctx.moveTo(gx0, Y(v))
      ctx.lineTo(gx1, Y(v))
      ctx.stroke()
      ctx.fillText(String(v), gx0 - 4 * u, Y(v) + 4 * u)
    }
    ctx.textAlign = 'center'
    const tStep = tMax > 80 ? 20 : 10
    for (let t = 0; t <= tMax; t += tStep) ctx.fillText(String(t), X(t), gy1 + 13 * u)
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    ctx.fillText(narrow ? 'ln(W_E / W_E0) vs ω_pe t' : 'ln(field energy / initial) vs time ω_pe t', gx0, phaseH + 16 * u)
    ctx.save()
    ctx.beginPath()
    ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.clip()
    if (theory > 0) {
      ctx.setLineDash([6 * u, 5 * u])
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 1.5 * u
      ctx.beginPath()
      ctx.moveTo(X(0), Y(0))
      ctx.lineTo(X(tMax), Y(2 * theory * tMax))
      ctx.stroke()
      ctx.setLineDash([])
    }
    glowStroke(ctx, COLORS.lime, 1.8 * u, () => {
      for (let i = 0; i < r.times.length; i += 2) {
        if (i) ctx.lineTo(X(r.times[i]), Y(lnW(r.amps[i])))
        else ctx.moveTo(X(r.times[i]), Y(lnW(r.amps[i])))
      }
    })
    ctx.restore()
    ctx.fillStyle = COLORS.lime
    ctx.fillText('PIC', gx0 + 8 * u, gy0 + 14 * u)
    if (theory > 0) {
      ctx.fillStyle = COLORS.amber
      ctx.fillText('theory slope 2γ', gx0 + 40 * u, gy0 + 14 * u)
    }
  }

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const r = run.current
      if (r.pic.t < tEnd) {
        stepTwoStream(r, speed)
        if (++frame % 6 === 0) {
          setMeas(measuredTwoStream(r))
          setTime(r.pic.t)
        }
      } else if (running) setRunning(false)
      draw()
    },
    running,
  )

  const good = meas && theory > 0 && Math.abs(meas.gamma / theory - 1) < 0.1
  return (
    <SimFrame
      id="two-stream"
      title="Two-stream instability (1D PIC)"
      running={running}
      setRunning={(on) => (on && run.current.pic.t >= tEnd ? restart() : setRunning(on))}
      onReset={() => restart()}
      hint="Units: ω_pe = 1 for all the electrons together, so each beam has ω_b = ω_pe/√2; the box holds one wavelength, k = 1. The beams start with a tiny ripple in the shape of the growing mode. Watch the field energy climb on a straight line with slope 2γ, then the beams trap each other and roll up into vortices. Slide k·v0/ω_b past √2 ≈ 1.41 and nothing grows."
    >
      <canvas ref={canvas} className="sim" aria-label="Two-stream instability simulation" />
      <div className="readouts">
        <span>k v0 / ω_b = <b>{K.toFixed(2)}</b></span>
        <span>measured γ = <b className={good ? 'ok' : ''}>{meas ? meas.gamma.toFixed(3) : theory > 0 ? '…' : 'no growth'}</b>{meas && !meas.done ? ' (fitting)' : ''}</span>
        <span>cold-beam theory γ = <b>{theory > 0 ? theory.toFixed(3) : 'stable'}</b> ω_pe</span>
        <span>t = <b>{time.toFixed(0)}</b></span>
      </div>
      <div className="controls">
        <Slider
          label="Beam speed, as k·v0/ω_b"
          value={K}
          min={0.3}
          max={1.8}
          step={0.01}
          onChange={(v) => { setK(v); restart(v) }}
          fmt={(v) => `${v.toFixed(2)}${Math.abs(v - K_MAX_GROWTH) < 0.02 ? ' (fastest)' : v >= K_CUTOFF ? ' (stable)' : ''}`}
        />
        <Slider label="Speed" value={speed} min={1} max={6} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
      <p className="small dim" style={{ marginTop: 8, marginBottom: 0 }}>
        Beam speed v0 = {v0.toFixed(3)} in units of ω_pe/k. Theory: γ/ω_b = √(√(1 + 4K²) − K² − 1).
      </p>
    </SimFrame>
  )
}
