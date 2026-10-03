// L3: spectral-phase playground. Choose a bandwidth, add GDD, TOD or a slab of glass, and see the pulse in time
// with its instantaneous frequency painted on (red = lower frequency, blue = higher). A live FFT does the work.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { C_UM_PER_FS, GLASSES, gddBroadened, gvd, makeGrid, shapePulse, transformLimit, widthAtHalf } from '../physics/pulse'
import { SimFrame, Slider } from './SimFrame'

const LAMBDA0 = 800 // nm
const GRID = makeGrid(8192, 8000)

/** Map an offset frequency to a colour from red (−) through white to blue (+). */
function chirpColor(x: number) {
  const s = Math.max(-1, Math.min(1, x))
  if (s < 0) return `rgb(255, ${Math.round(255 * (1 + s * 0.75))}, ${Math.round(255 * (1 + s))})`
  return `rgb(${Math.round(255 * (1 - s))}, ${Math.round(255 * (1 - s * 0.35))}, 255)`
}

export function PulseSim() {
  const [running, setRunning] = useState(false)
  const [bwNm, setBwNm] = useState(30)
  const [gdd, setGdd] = useState(0)
  const [tod, setTod] = useState(0)
  const [glass, setGlass] = useState(0)
  const [mm, setMm] = useState(0)

  const glassGdd = mm * gvd(GLASSES[glass], LAMBDA0 / 1000)
  const total = gdd + glassGdd
  const tauTL = transformLimit(LAMBDA0, bwNm)
  const dwFwhm = (2 * Math.PI * C_UM_PER_FS * 1e3 * bwNm) / (LAMBDA0 * LAMBDA0)
  const out = useMemo(() => shapePulse(GRID, dwFwhm, total, tod), [dwFwhm, total, tod])
  const measured = widthAtHalf(out.I, GRID.dt)
  const theory = tod === 0 ? gddBroadened(tauTL, total) : NaN

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
    const pad = 16 * u
    const spec = narrow ? { x: pad, y: 24 * u, w: W - 2 * pad, h: H * 0.32 } : { x: pad, y: 24 * u, w: W * 0.36 - pad, h: H - 60 * u }
    const time = narrow
      ? { x: pad, y: spec.y + spec.h + 46 * u, w: W - 2 * pad, h: H - (spec.y + spec.h + 46 * u) - 30 * u }
      : { x: W * 0.36 + 2 * pad, y: 24 * u, w: W * 0.64 - 3 * pad, h: H - 60 * u }

    // spectrum vs wavelength with spectral phase
    const lamSpan = Math.max(3 * bwNm, 30)
    const lamX = (lam: number) => spec.x + ((lam - (LAMBDA0 - lamSpan)) / (2 * lamSpan)) * spec.w
    const w0 = (2 * Math.PI * C_UM_PER_FS * 1e3) / LAMBDA0 // rad/fs
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = u
    ctx.strokeRect(spec.x, spec.y, spec.w, spec.h)
    const pts: [number, number, number][] = []
    for (let k = 0; k < GRID.n; k++) {
      const lam = (2 * Math.PI * C_UM_PER_FS * 1e3) / (w0 + GRID.w[k])
      if (Math.abs(lam - LAMBDA0) < lamSpan) pts.push([lam, out.spec[k], out.phase[k]])
    }
    pts.sort((a, b) => a[0] - b[0])
    glowStroke(ctx, COLORS.cyan, 1.8 * u, () => pts.forEach(([l, s], i) => (i ? ctx.lineTo(lamX(l), spec.y + spec.h - s * spec.h * 0.9) : ctx.moveTo(lamX(l), spec.y + spec.h - s * spec.h * 0.9))))
    // phase, drawn only where there is light; scaled to ±(its largest value there)
    const lit = pts.filter((p) => p[1] > 0.02)
    const pMax = Math.max(1, ...lit.map((p) => Math.abs(p[2])))
    ctx.strokeStyle = COLORS.amber
    ctx.lineWidth = 1.4 * u
    ctx.beginPath()
    lit.forEach(([l, , ph], i) => {
      const y = spec.y + spec.h / 2 - (ph / pMax) * spec.h * 0.42
      if (i) ctx.lineTo(lamX(l), y)
      else ctx.moveTo(lamX(l), y)
    })
    ctx.stroke()
    ctx.fillStyle = COLORS.cyan
    ctx.fillText('spectrum', spec.x + 6 * u, spec.y + 14 * u)
    ctx.fillStyle = COLORS.amber
    ctx.fillText(`spectral phase (±${pMax.toFixed(0)} rad)`, spec.x + 6 * u, spec.y + 28 * u)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.fillText(`${(LAMBDA0 - lamSpan).toFixed(0)}`, spec.x + 12 * u, spec.y + spec.h + 14 * u)
    ctx.fillText(`${LAMBDA0} nm`, spec.x + spec.w / 2, spec.y + spec.h + 14 * u)
    ctx.fillText(`${(LAMBDA0 + lamSpan).toFixed(0)}`, spec.x + spec.w - 12 * u, spec.y + spec.h + 14 * u)
    ctx.textAlign = 'left'

    // pulse in time
    const span = Math.min(3800, Math.max(3 * measured, 4 * tauTL, 40))
    const tX = (t: number) => time.x + ((t + span) / (2 * span)) * time.w
    let peak = 0
    for (const v of out.I) peak = Math.max(peak, v)
    const yScale = peak > 0.25 ? 1.05 : peak * 1.15 // keep a stretched pulse visible, and say so
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = u
    ctx.strokeRect(time.x, time.y, time.w, time.h)
    // transform-limited reference
    ctx.setLineDash([4 * u, 4 * u])
    ctx.strokeStyle = COLORS.violet
    ctx.beginPath()
    for (let i = 0; i <= 200; i++) {
      const t = -span + (i / 200) * 2 * span
      const v = Math.exp((-4 * Math.LN2 * t * t) / (tauTL * tauTL))
      const y = time.y + time.h - Math.min(v / yScale, 1.05) * time.h
      if (i) ctx.lineTo(tX(t), y)
      else ctx.moveTo(tX(t), y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    // coloured filled pulse
    const dwRef = dwFwhm
    for (let k = 1; k < GRID.n; k++) {
      const t = GRID.t[k]
      if (t < -span || t > span) continue
      const v = out.I[k]
      if (v < peak * 0.002) continue
      const x0 = tX(GRID.t[k - 1])
      const x1 = tX(t)
      ctx.fillStyle = chirpColor(out.instFreq[k] / dwRef)
      const y = time.y + time.h - (v / yScale) * time.h
      ctx.fillRect(x0 - 0.5 * u, y, x1 - x0 + u, time.y + time.h - y)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = COLORS.text
    ctx.fillText(`pulse intensity in time (window ±${span.toFixed(0)} fs)`, time.x + 6 * u, time.y + 14 * u)
    ctx.fillStyle = COLORS.violet
    ctx.fillText('dashed: transform limit', time.x + 6 * u, time.y + 28 * u)
    if (yScale < 1) {
      ctx.fillStyle = COLORS.amber
      ctx.fillText(`peak is ${(peak * 100).toFixed(0)}% of the transform limit (vertical scale stretched)`, time.x + 6 * u, time.y + 42 * u)
    }
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.fillText('earlier ← time → later   (red: lower frequency, blue: higher)', time.x + time.w / 2, time.y + time.h + 14 * u)
    ctx.textAlign = 'left'
  }

  useEffect(draw)

  // Play sweeps the GDD back and forth, like scanning a compressor through its best setting.
  const sweep = useRef(0)
  useAnimation(
    canvas,
    (dt) => {
      sweep.current += dt / 2500
      setGdd(Math.round((2000 * Math.sin(sweep.current)) / 10) * 10)
    },
    running,
  )

  const ok = Number.isFinite(theory) && Math.abs(measured / theory - 1) < 0.02
  return (
    <SimFrame
      id="pulse-phase"
      title="Spectral-phase playground"
      running={running}
      setRunning={setRunning}
      onReset={() => { setGdd(0); setTod(0); setMm(0); setBwNm(30) }}
      hint="Start with a flat phase: the pulse is as short as its bandwidth allows. Add GDD and the colours spread out in time, red first for positive GDD, and the pulse stretches. Add glass instead and watch the same thing happen, then cancel it with negative GDD as a compressor would. TOD bends the phase curve's ends and throws satellite pulses to one side. Play sweeps the GDD like a compressor scan. Centre wavelength 800 nm."
    >
      <canvas ref={canvas} className="sim" aria-label="Ultrashort pulse spectral phase simulation" />
      <div className="readouts">
        <span>transform limit <b>{tauTL.toFixed(1)} fs</b></span>
        <span>total GDD <b>{total.toFixed(0)} fs²</b></span>
        <span>FWHM: theory <b>{Number.isFinite(theory) ? `${theory.toFixed(1)} fs` : '— (TOD on)'}</b>, measured <b className={ok ? 'ok' : ''}>{measured.toFixed(1)} fs</b></span>
      </div>
      <div className="controls">
        <Slider label="Bandwidth Δλ (FWHM)" value={bwNm} min={5} max={100} step={1} onChange={setBwNm} fmt={(v) => `${v} nm`} />
        <Slider label="GDD (stretcher / compressor)" value={gdd} min={-3000} max={3000} step={10} onChange={setGdd} fmt={(v) => `${v} fs²`} />
        <Slider label="TOD" value={tod} min={-30000} max={30000} step={500} onChange={setTod} fmt={(v) => `${v} fs³`} />
        <Slider label={`Glass: ${GLASSES[glass].name}`} value={mm} min={0} max={25} step={0.5} onChange={setMm} fmt={(v) => `${v} mm (${glassGdd.toFixed(0)} fs²)`} />
        <div className="ctrl">
          <label><span>Glass type</span></label>
          <div className="row" style={{ gap: 6 }}>
            {GLASSES.map((g, i) => (
              <button key={g.name} className={`btn small ${i === glass ? 'primary' : ''}`} onClick={() => setGlass(i)}>{g.name}</button>
            ))}
          </div>
        </div>
      </div>
    </SimFrame>
  )
}
