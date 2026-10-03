// L2: lock the phases of a laser's longitudinal modes and watch noise turn into a pulse train.
// Top: the mode comb under the gain curve, with each mode's phase as a little clock hand.
// Bottom: the output intensity over three cavity round trips.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { fwhm, gaussianAmplitudes, lockedPulseWidth, max, mean, modeSumIntensity, phases, rng } from '../physics/modeLock'
import { SimFrame, Slider } from './SimFrame'

const SAMPLES = 1200
const TRIPS = 3

export function ModeLockSim() {
  const [running, setRunning] = useState(true)
  const [bw, setBw] = useState(8) // gain FWHM in mode spacings
  const [lock, setLock] = useState(0)
  const [seed, setSeed] = useState(7)
  const M = Math.ceil(1.6 * bw)
  const amp = useRef(gaussianAmplitudes(M, bw))
  const base = useRef(phases(2 * M + 1, 0, seed))
  const drift = useRef(new Float64Array(2 * M + 1))
  const rand = useRef(rng(11))
  const I = useRef(new Float64Array(SAMPLES))
  const shift = useRef(0)
  const [meas, setMeas] = useState({ width: 0, ratio: 0 })

  const rebuild = (b = bw, sd = seed) => {
    const m = Math.ceil(1.6 * b)
    amp.current = gaussianAmplitudes(m, b)
    base.current = phases(2 * m + 1, 0, sd)
    drift.current = new Float64Array(2 * m + 1)
  }

  const sumA = amp.current.reduce((s, v) => s + v, 0)
  const sumA2 = amp.current.reduce((s, v) => s + v * v, 0)
  const theoryRatio = (sumA * sumA) / sumA2
  const theoryWidth = lockedPulseWidth(bw)

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.1 : 0.62, () => draw())

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
    const a = amp.current
    const n = a.length
    const m = (n - 1) / 2
    // --- comb ---
    const top = { x: 14 * u, y: 24 * u, w: W - 28 * u, h: H * 0.38 }
    const cx = (k: number) => top.x + ((k + 0.5) / n) * top.w
    ctx.strokeStyle = COLORS.violet
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    for (let i = 0; i <= 200; i++) {
      const k = (i / 200) * (n - 1)
      const nn = k - m
      const g = Math.exp((-4 * Math.LN2 * nn * nn) / (bw * bw))
      const x = cx(k)
      const y = top.y + top.h - g * top.h * 0.82
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
    const phs = currentPhases()
    const r = Math.min(6 * u, (top.w / n) * 0.45)
    for (let k = 0; k < n; k++) {
      const hgt = a[k] * a[k] * top.h * 0.82
      const x = cx(k)
      ctx.strokeStyle = COLORS.cyan
      ctx.lineWidth = Math.max(1, Math.min(3 * u, (top.w / n) * 0.35))
      ctx.beginPath()
      ctx.moveTo(x, top.y + top.h)
      ctx.lineTo(x, top.y + top.h - hgt)
      ctx.stroke()
      if (a[k] > 0.15 && r > 2 * u) {
        const yy = top.y + top.h - hgt - r - 3 * u
        ctx.strokeStyle = COLORS.axis
        ctx.lineWidth = u
        ctx.beginPath()
        ctx.arc(x, yy, r, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.strokeStyle = COLORS.amber
        ctx.lineWidth = 1.4 * u
        ctx.beginPath()
        ctx.moveTo(x, yy)
        ctx.lineTo(x + r * Math.sin(phs[k]), yy - r * Math.cos(phs[k]))
        ctx.stroke()
      }
    }
    ctx.fillStyle = COLORS.text
    ctx.fillText('modes under the gain curve, spaced by Δν = c/2L; hands show each mode’s phase', top.x, 14 * u)
    // --- intensity ---
    const bot = { x: 14 * u, y: top.y + top.h + 34 * u, w: W - 28 * u, h: H - (top.y + top.h + 34 * u) - 24 * u }
    const Iv = I.current
    const yTop = theoryRatio * sumA2 * 1.05
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = u
    ctx.beginPath()
    ctx.moveTo(bot.x, bot.y + bot.h)
    ctx.lineTo(bot.x + bot.w, bot.y + bot.h)
    ctx.stroke()
    // mean power line
    ctx.setLineDash([4 * u, 4 * u])
    ctx.strokeStyle = COLORS.lime
    const ym = bot.y + bot.h - (sumA2 / yTop) * bot.h
    ctx.beginPath()
    ctx.moveTo(bot.x, ym)
    ctx.lineTo(bot.x + bot.w, ym)
    ctx.stroke()
    ctx.setLineDash([])
    glowStroke(ctx, COLORS.cyan, 1.6 * u, () => {
      for (let k = 0; k < SAMPLES; k++) {
        const x = bot.x + (k / (SAMPLES - 1)) * bot.w
        const y = bot.y + bot.h - (Iv[k] / yTop) * bot.h
        if (k) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
    })
    ctx.fillStyle = COLORS.text
    ctx.fillText('output intensity over three round trips T_R = 2L/c', bot.x, bot.y - 8 * u)
    ctx.fillStyle = COLORS.lime
    ctx.fillText('average power', bot.x + bot.w - 90 * u, ym - 5 * u)
    for (let t = 0; t <= TRIPS; t++) {
      ctx.fillStyle = COLORS.text
      ctx.fillText(`${t} T_R`, bot.x + (t / TRIPS) * bot.w - (t === TRIPS ? 26 * u : t ? 12 * u : 0), bot.y + bot.h + 15 * u)
    }
  }

  const currentPhases = () => {
    const b = base.current
    const d = drift.current
    const out = new Float64Array(b.length)
    for (let k = 0; k < b.length; k++) out[k] = (1 - lock) * (b[k] + d[k])
    return out
  }

  useAnimation(
    canvas,
    () => {
      // unlocked modes wander: their phases random-walk, so the noise pattern keeps changing
      const d = drift.current
      const rr = rand.current
      for (let k = 0; k < d.length; k++) d[k] += (1 - lock) * 0.05 * (rr() - 0.5)
      const ph = currentPhases()
      // slide the time window so the train moves across the screen
      shift.current = (shift.current + 0.004) % 1
      const M2 = (amp.current.length - 1) / 2
      for (let k = 0; k < ph.length; k++) ph[k] -= 2 * Math.PI * (k - M2) * shift.current
      modeSumIntensity(amp.current, ph, SAMPLES, TRIPS, I.current)
      const width = (fwhm(I.current) / SAMPLES) * TRIPS
      const ratio = max(I.current) / mean(I.current)
      if (Math.abs(width - meas.width) > 0.002 || Math.abs(ratio - meas.ratio) > 0.05) setMeas({ width, ratio })
      draw()
    },
    running,
  )

  const locked = lock > 0.97
  const wOk = locked && Math.abs(meas.width / theoryWidth - 1) < 0.05
  return (
    <SimFrame
      id="mode-lock"
      title="Mode-locking: modes to pulses"
      running={running}
      setRunning={setRunning}
      onReset={() => { setLock(0); setSeed(seed + 1); rebuild(bw, seed + 1) }}
      hint="Start with random phases: the modes beat into noise with the same average power. Slide the locking to 1 and every mode lines up once per round trip: a short, bright pulse. Then widen the gain bandwidth: more locked modes, shorter pulse. Time is in round trips T_R; frequency in mode spacings Δν = 1/T_R."
    >
      <canvas ref={canvas} className="sim" aria-label="Mode-locking simulation" />
      <div className="readouts">
        <span>modes in the gain FWHM <b>{bw}</b></span>
        <span>pulse FWHM / T_R: theory <b>{theoryWidth.toFixed(3)}</b>, measured <b className={wOk ? 'ok' : ''}>{locked ? meas.width.toFixed(3) : 'no pulse yet'}</b></span>
        <span>peak / average: locked theory <b>{theoryRatio.toFixed(1)}</b>, now <b className={locked && Math.abs(meas.ratio / theoryRatio - 1) < 0.05 ? 'ok' : ''}>{meas.ratio.toFixed(1)}</b></span>
      </div>
      <div className="controls">
        <Slider label="Phase locking" value={lock} min={0} max={1} step={0.01} onChange={setLock} fmt={(v) => (v >= 1 ? 'locked' : v.toFixed(2))} />
        <Slider label="Gain bandwidth (mode spacings)" value={bw} min={2} max={24} step={1} onChange={(v) => { setBw(v); rebuild(v) }} />
      </div>
    </SimFrame>
  )
}
