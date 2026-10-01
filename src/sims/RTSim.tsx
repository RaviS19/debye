// A8: Rayleigh–Taylor instability. Heavy fluid resting on light fluid in a 2D Boussinesq solver.
// A ripple on the interface grows exponentially at σ ≈ √(Agk), then rolls up into fingers with
// mushroom caps. The right panel tracks ln|w_k| and compares the measured slope with theory.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { createRT, measuredGrowth, rtDiffuse, rtLinearGrowth, rtSharp, rtTimeStep, stepRT, type RT } from '../physics/rayleighTaylor'
import { SimFrame, Slider } from './SimFrame'

const DELTA = 0.02
const T_END = 12
const LIGHT = [10, 38, 66]
const HEAVY = [168, 58, 140]

export function RTSim() {
  const [running, setRunning] = useState(true)
  const [A, setA] = useState(0.25)
  const [mode, setMode] = useState(2)
  const [lnu, setLnu] = useState(Math.log10(3e-4))
  const [noise, setNoise] = useState(1)
  const [flipped, setFlipped] = useState(false)
  const [speed, setSpeed] = useState(1)
  const nu = 10 ** lnu
  const make = (a = A, m = mode, n = nu, z = noise, f = flipped) => createRT({ A: a, nu: n, delta: DELTA, mode: m, eta0: 0.002 / m, noise: z / 100, flipped: f, seed: 5 })
  const sim = useRef<RT>(make())
  const img = useRef<{ canvas: HTMLCanvasElement; data: ImageData } | null>(null)
  const [meas, setMeas] = useState<{ sigma: number; done: boolean; noisy?: boolean } | null>(null)
  const [time, setTime] = useState(0)

  const restart = (a = A, m = mode, n = nu, z = noise, f = flipped) => {
    sim.current = make(a, m, n, z, f)
    setMeas(null)
    setTime(0)
    setRunning(true)
  }

  const k = 2 * Math.PI * mode
  const ideal = rtSharp(A, 1, k)
  const linear = useMemo(() => rtLinearGrowth({ A, nu, delta: DELTA, mode }), [A, nu, mode])

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.0 : 0.56)

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const s = sim.current
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const stacked = c.clientWidth < 560
    // fluid panel: the box is 1 wide and 2 tall
    const pad = 6 * u
    const fh = H - 2 * pad
    const fw = fh / 2
    const fx = pad
    const fy = pad
    if (!img.current) {
      const cv = document.createElement('canvas')
      cv.width = s.nx
      cv.height = s.nz + 1
      img.current = { canvas: cv, data: new ImageData(s.nx, s.nz + 1) }
    }
    const { canvas: off, data } = img.current
    const px = data.data
    const inv = 1 / s.A
    for (let j = 0; j <= s.nz; j++) {
      const row = s.nz - j // top of the image is the top of the box
      for (let i = 0; i < s.nx; i++) {
        const h = Math.min(1, Math.max(0, 0.5 * (1 - s.b[j * s.nx + i] * inv))) // heavy fraction
        const glow = Math.max(0, 1 - Math.abs(2 * h - 1) * 2.5)
        const q = 4 * (row * s.nx + i)
        px[q] = LIGHT[0] + (HEAVY[0] - LIGHT[0]) * h + 90 * glow
        px[q + 1] = LIGHT[1] + (HEAVY[1] - LIGHT[1]) * h + 200 * glow
        px[q + 2] = LIGHT[2] + (HEAVY[2] - LIGHT[2]) * h + 190 * glow
        px[q + 3] = 255
      }
    }
    off.getContext('2d')!.putImageData(data, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, fx, fy, fw, fh)
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = u
    ctx.strokeRect(fx, fy, fw, fh)
    const fs = (stacked ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = 'rgba(232,234,246,0.9)'
    ctx.fillText(flipped ? 'light' : 'heavy', fx + 5 * u, fy + fs + 3 * u)
    ctx.fillText(flipped ? 'heavy' : 'light', fx + 5 * u, fy + fh - 6 * u)
    // gravity arrow
    const gx = fx + fw - 12 * u
    const gy0 = fy + 10 * u
    const gy1 = fy + 42 * u
    ctx.strokeStyle = COLORS.amber
    ctx.fillStyle = COLORS.amber
    ctx.lineWidth = 2 * u
    ctx.beginPath()
    ctx.moveTo(gx, gy0)
    ctx.lineTo(gx, gy1)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(gx - 5 * u, gy1 - 7 * u)
    ctx.lineTo(gx, gy1)
    ctx.lineTo(gx + 5 * u, gy1 - 7 * u)
    ctx.stroke()
    ctx.textAlign = 'right'
    ctx.fillText('g', gx - 6 * u, gy0 + fs)
    ctx.textAlign = 'left'

    // growth panel: ln of the mode amplitude vs time
    const gx0 = fx + fw + (stacked ? 34 : 50) * u
    const gx1 = W - 10 * u
    const gy0p = pad + (stacked ? 34 : 24) * u
    const gy1p = H - 30 * u
    const tMax = Math.max(6, Math.min(T_END, Math.ceil(s.t)))
    // reference: the velocity amplitude a quarter e-fold after the start (the ripple starts at rest)
    const tRef = 0.25 / Math.max(rtDiffuse(A, 1, k, DELTA), 0.1)
    let iRef = s.times.findIndex((t) => t >= tRef)
    if (iRef < 0) iRef = s.times.length - 1
    const a0 = Math.max(s.amps[iRef], 1e-30)
    const yMin = -2
    const yMax = 10
    const X = (t: number) => gx0 + (t / tMax) * (gx1 - gx0)
    const Y = (v: number) => gy1p - ((v - yMin) / (yMax - yMin)) * (gy1p - gy0p)
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    for (let v = 0; v <= yMax; v += 2) {
      ctx.beginPath()
      ctx.moveTo(gx0, Y(v))
      ctx.lineTo(gx1, Y(v))
      ctx.stroke()
      ctx.fillText(String(v), gx0 - 4 * u, Y(v) + 4 * u)
    }
    ctx.textAlign = 'center'
    for (let t = 0; t <= tMax; t += 2) ctx.fillText(String(t), X(t), gy1p + 13 * u)
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(gx0, gy0p, gx1 - gx0, gy1p - gy0p)
    ctx.fillText('time (√(L/g))', (gx0 + gx1) / 2, H - 4 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    if (stacked) {
      ctx.fillText('ln |w_k|, shifted', gx0, pad + 10 * u)
      ctx.fillText('growth of the ripple', gx0, pad + 24 * u)
    } else ctx.fillText('ln |w_k|: growth of the seeded ripple (shifted to start near 0)', gx0, pad + 14 * u)

    ctx.save()
    ctx.beginPath()
    ctx.rect(gx0, gy0p, gx1 - gx0, gy1p - gy0p)
    ctx.clip()
    // theory slopes, anchored where the fit starts
    if (!flipped) {
      const t0 = 2.5 / rtDiffuse(A, 1, k, DELTA)
      let i0 = s.times.findIndex((t) => t >= t0)
      if (i0 < 0) i0 = s.times.length - 1
      const y0 = Math.log(s.amps[i0] / a0)
      const tA = s.times[i0]
      const line = (sl: number, col: string) => {
        ctx.setLineDash([6 * u, 5 * u])
        ctx.strokeStyle = col
        ctx.lineWidth = 1.5 * u
        ctx.beginPath()
        ctx.moveTo(X(0), Y(y0 - sl * tA))
        ctx.lineTo(X(tMax), Y(y0 + sl * (tMax - tA)))
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (s.t >= t0) {
        line(ideal, COLORS.violet)
        line(linear, COLORS.amber)
      }
    }
    glowStroke(ctx, COLORS.lime, 1.8 * u, () => {
      for (let i = 0; i < s.times.length; i += 2) {
        const y = Math.log(Math.max(s.amps[i], 1e-30) / a0)
        if (i) ctx.lineTo(X(s.times[i]), Y(y))
        else ctx.moveTo(X(s.times[i]), Y(y))
      }
    })
    ctx.restore()
    // legend
    const lx = gx0 + 8 * u
    let ly = gy0p + 14 * u
    const leg = (col: string, txt: string) => {
      ctx.fillStyle = col
      ctx.fillRect(lx, ly - 4 * u, 12 * u, 3 * u)
      ctx.fillStyle = COLORS.text
      ctx.fillText(txt, lx + 16 * u, ly)
      ly += 14 * u
    }
    leg(COLORS.lime, 'simulation')
    if (!flipped) {
      leg(COLORS.violet, '√(Agk)')
      leg(COLORS.amber, stacked ? 'with δ, ν' : 'linear theory with δ and ν')
    }
  }

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const s = sim.current
      if (s.t < T_END) {
        for (let n = 0; n < speed; n++) stepRT(s, rtTimeStep(s))
        if (++frame % 6 === 0) {
          setMeas(flipped ? null : measuredGrowth(s))
          setTime(s.t)
        }
      } else if (running) {
        setTime(s.t)
        setRunning(false)
      }
      draw()
    },
    running,
  )

  const good = meas && isFinite(meas.sigma) && Math.abs(meas.sigma / linear - 1) < 0.1
  return (
    <SimFrame
      id="rayleigh-taylor"
      title="Rayleigh–Taylor instability (2D fluid)"
      running={running}
      setRunning={(r) => (r && sim.current.t >= T_END ? restart() : setRunning(r))}
      onReset={() => restart()}
      hint="Units: box width L = 1, g = 1, time in √(L/g). The interface starts with a ripple of mode number m (wavelength L/m) whose height is 0.2% of its wavelength, plus a little noise. While it is small it grows as e^(σt): a straight line on the right. Change the mode number: shorter ripples grow faster, as √k. Raise the viscosity to see short waves slowed most. Then press Flip: with the light fluid on top the ripple just sloshes."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${!flipped ? 'primary' : ''}`} onClick={() => { setFlipped(false); restart(A, mode, nu, noise, false) }}>Heavy on top</button>
        <button className={`btn small ${flipped ? 'primary' : ''}`} onClick={() => { setFlipped(true); restart(A, mode, nu, noise, true) }}>Flip: light on top</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Rayleigh–Taylor simulation" />
      <div className="readouts">
        {flipped ? (
          <span>stable: the ripple oscillates as a gravity wave, ω ≈ <b>{rtDiffuse(A, 1, k, DELTA).toFixed(2)}</b></span>
        ) : (
          <>
            {meas && !isFinite(meas.sigma) ? (
              <span>measured σ: <b>none</b> (the seed noise went nonlinear first; lower the noise)</span>
            ) : (
              <span>measured σ = <b className={good ? 'ok' : ''}>{meas ? meas.sigma.toFixed(3) : '…'}</b>{meas && !meas.done ? ' (fitting)' : ''}</span>
            )}
            <span>linear theory (δ, ν) = <b>{linear.toFixed(3)}</b></span>
            <span>ideal √(Agk) = <b>{ideal.toFixed(3)}</b></span>
          </>
        )}
        <span>t = <b>{time.toFixed(1)}</b></span>
      </div>
      <div className="controls">
        <Slider label="Atwood number A" value={A} min={0.05} max={0.5} step={0.05} onChange={(v) => { setA(v); restart(v) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Mode number m (k = 2πm/L)" value={mode} min={1} max={5} step={1} onChange={(v) => { setMode(v); restart(A, v) }} />
        <Slider label="Viscosity ν" value={lnu} min={-4} max={-2.5} step={0.25} onChange={(v) => { setLnu(v); restart(A, mode, 10 ** v) }} fmt={(v) => (10 ** v).toExponential(1)} />
        <Slider label="Seed noise" value={noise} min={0} max={10} step={1} onChange={(v) => { setNoise(v); restart(A, mode, nu, v) }} fmt={(v) => `${v}%`} />
        <Slider label="Speed" value={speed} min={1} max={3} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
