// A5: phase vs group velocity. A packet built from many modes that obey a chosen dispersion relation.
// Crests travel at ω/k; the envelope (and the energy) travels at dω/dk. The space–time diagram below
// shows both as slopes.
import { useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  createPacket,
  createTracker,
  evalPacket,
  PACKET_MODELS,
  phaseGroup,
  trackedGroupVelocity,
  trackedPhaseVelocity,
  trackPacket,
  type Packet,
  type PacketTracker,
} from '../physics/eswaves'
import { SimFrame, Slider } from './SimFrame'

type Model = keyof typeof PACKET_MODELS
const NX = 480
const NT = 150
const KSIG = 10 // kσ: packet width in radians of phase (sets how cleanly crests track v_φ)

interface State {
  packet: Packet
  tracker: PacketTracker
  xs: Float64Array
  re: Float64Array
  env: Float64Array
  t: number
  L: number
  sigma: number
  rows: Float32Array // space–time history, NT rows of NX/2 samples, newest at row `head`
  head: number
  filled: number
}

function build(model: Model, k0: number): State {
  const sigma = KSIG / k0
  const L = 12 * sigma
  const packet = createPacket(PACKET_MODELS[model].w, k0, sigma, L, L * 0.3)
  const xs = new Float64Array(NX).map((_, i) => (i * L) / NX)
  const re = new Float64Array(NX)
  const env = new Float64Array(NX)
  evalPacket(packet, xs, 0, re, env)
  return { packet, tracker: createTracker(xs, env), xs, re, env, t: 0, L, sigma, rows: new Float32Array(NT * (NX / 2)), head: 0, filled: 0 }
}

const RANGES: Record<Model, [number, number, number]> = {
  epw: [0.25, 1.2, 0.5],
  iaw: [0.2, 2, 0.8],
  cold: [0.25, 1.2, 0.5],
}

export function WavePacketSim() {
  const [running, setRunning] = useState(true)
  const [model, setModel] = useState<Model>('epw')
  const [k0, setK0] = useState(0.5)
  const [speed, setSpeed] = useState(1)
  const st = useRef<State>(build('epw', 0.5))
  const img = useRef<{ canvas: HTMLCanvasElement; data: ImageData } | null>(null)
  const [meas, setMeas] = useState({ vp: 0, vg: 0, t: 0 })

  const restart = (m = model, k = k0) => {
    st.current = build(m, k)
    setMeas({ vp: 0, vg: 0, t: 0 })
  }
  const theory = phaseGroup(PACKET_MODELS[model].w, k0)
  const w0 = PACKET_MODELS[model].w(k0)

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 0.95 : 0.55, () => draw())

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const s = st.current
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const topH = H * 0.46
    const X = (x: number) => (x / s.L) * W
    const mid = topH * 0.56
    const amp = topH * 0.28
    let a0 = 0
    for (let i = 0; i < NX; i++) a0 = Math.max(a0, s.env[i])
    const scale = amp / Math.max(a0, 1e-9)
    // envelope
    ctx.setLineDash([4 * u, 5 * u])
    ctx.strokeStyle = 'rgba(160,111,214,0.8)'
    ctx.lineWidth = 1.2 * u
    for (const sgn of [1, -1]) {
      ctx.beginPath()
      for (let i = 0; i < NX; i++) {
        const y = mid - sgn * s.env[i] * scale
        if (i) ctx.lineTo(X(s.xs[i]), y)
        else ctx.moveTo(X(s.xs[i]), y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
    // wave
    glowStroke(ctx, COLORS.cyan, 1.8 * u, () => {
      for (let i = 0; i < NX; i++) {
        const y = mid - s.re[i] * scale
        if (i) ctx.lineTo(X(s.xs[i]), y)
        else ctx.moveTo(X(s.xs[i]), y)
      }
    })
    const wrap = (x: number) => ((x % s.L) + s.L) % s.L
    // tracked crest and envelope peak
    const tr = s.tracker
    if (tr.crest !== null) {
      const xc = wrap(tr.crest)
      const i = Math.round((xc / s.L) * NX) % NX
      ctx.fillStyle = COLORS.magenta
      ctx.shadowColor = COLORS.magenta
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(X(xc), mid - s.re[i] * scale, 5 * u, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    const xg = X(wrap(tr.g))
    ctx.fillStyle = COLORS.lime
    ctx.beginPath()
    ctx.moveTo(xg, mid + amp + 4 * u)
    ctx.lineTo(xg - 7 * u, mid + amp + 15 * u)
    ctx.lineTo(xg + 7 * u, mid + amp + 15 * u)
    ctx.closePath()
    ctx.fill()
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('● a crest: moves at v_φ = ω/k', 8 * u, 15 * u)
    ctx.fillStyle = COLORS.lime
    ctx.fillText('▲ envelope peak: moves at v_g = dω/dk', 8 * u, 30 * u)

    // space–time diagram (newest row at the top, so time runs upward)
    const twoLines = c.clientWidth < 560
    const y0 = topH + (twoLines ? 32 : 18) * u
    const hST = H - y0 - 4 * u
    ctx.fillStyle = COLORS.text
    if (twoLines) {
      ctx.fillText('space–time: x across, time upward', 8 * u, topH + 12 * u)
      ctx.fillText('stripes = crests (v_φ), bright band = packet (v_g)', 8 * u, topH + 26 * u)
    } else {
      ctx.fillText('space–time: x across, time upward. Stripes are crests (slope v_φ); the bright band is the packet (slope v_g)', 8 * u, topH + 12 * u)
    }
    if (!img.current) {
      const cv = document.createElement('canvas')
      cv.width = NX / 2
      cv.height = NT
      img.current = { canvas: cv, data: new ImageData(NX / 2, NT) }
    }
    const { canvas: off, data } = img.current
    const px = data.data
    const cols = NX / 2
    const norm = 1 / Math.max(a0, 1e-9)
    for (let r = 0; r < NT; r++) {
      const src = (s.head - r + NT) % NT
      const valid = r < s.filled
      for (let j = 0; j < cols; j++) {
        const v = valid ? s.rows[src * cols + j] * norm : 0
        const k = 4 * (r * cols + j)
        if (v >= 0) {
          px[k] = 20 + 14 * v
          px[k + 1] = 30 + 181 * v
          px[k + 2] = 50 + 188 * v
        } else {
          px[k] = 20 - 120 * v
          px[k + 1] = 30 - 10 * v
          px[k + 2] = 50 - 150 * v
        }
        px[k + 3] = 255
      }
    }
    off.getContext('2d')!.putImageData(data, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, 0, y0, W, hST)
    ctx.strokeStyle = COLORS.grid
    ctx.strokeRect(0.5, y0, W - 1, hST)
  }

  // redraw after resizes and slider changes while paused (the animation loop is not running then)
  useEffect(() => {
    if (!running) draw()
  })

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const s = st.current
      const dt = (0.45 / Math.max(w0, 0.2)) * speed // about 14 frames per wave period at 1×
      s.t += dt
      evalPacket(s.packet, s.xs, s.t, s.re, s.env)
      trackPacket(s.tracker, s.xs, s.re, s.env, dt, k0, s.sigma, s.L)
      s.head = (s.head + 1) % NT
      const cols = NX / 2
      for (let j = 0; j < cols; j++) s.rows[s.head * cols + j] = s.re[2 * j]
      s.filled = Math.min(NT, s.filled + 1)
      if (++frame % 10 === 0) setMeas({ vp: trackedPhaseVelocity(s.tracker), vg: trackedGroupVelocity(s.tracker), t: s.t })
      draw()
    },
    running,
  )

  const [kmin, kmax] = RANGES[model]
  const good = (m: number, th: number) => meas.t > 0 && Math.abs(m - th) <= 0.03 * Math.abs(th) + 0.01
  const unit = model === 'iaw' ? 'c_s' : 'v_th'

  return (
    <SimFrame
      id="wave-packet"
      title="Phase velocity vs group velocity"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint={`A packet is a sum of waves with nearby k, each obeying ω(k). Where their crests line up they add, and the dashed envelope outlines that region. Units: ${PACKET_MODELS[model].units}, so speeds are in ${unit}. Try the cold plasma oscillation: every crest races along, but the envelope never moves, because ω does not depend on k.`}
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {(Object.keys(PACKET_MODELS) as Model[]).map((m) => (
          <button
            key={m}
            className={`btn small ${m === model ? 'primary' : ''}`}
            onClick={() => {
              const k = RANGES[m][2]
              setModel(m)
              setK0(k)
              restart(m, k)
            }}
          >
            {PACKET_MODELS[m].label}
          </button>
        ))}
      </div>
      <canvas ref={canvas} className="sim" aria-label="Wave packet simulation" />
      <div className="readouts">
        <span style={{ color: COLORS.magenta }}>v_φ measured <b className={good(meas.vp, theory.vp) ? 'ok' : ''}>{meas.t ? fix3(meas.vp) : '…'}</b>, theory ω/k = <b>{theory.vp.toFixed(3)}</b></span>
        <span style={{ color: COLORS.lime }}>v_g measured <b className={good(meas.vg, theory.vg) ? 'ok' : ''}>{meas.t ? fix3(meas.vg) : '…'}</b>, theory dω/dk = <b>{fix3(theory.vg)}</b></span>
        <span>v_φ · v_g = <b>{fix3(theory.vp * theory.vg)}</b> {unit}²</span>
      </div>
      <div className="controls">
        <Slider label={`Central wavenumber k₀ (1/λ_D)`} value={k0} min={kmin} max={kmax} step={0.05} onChange={(v) => { setK0(v); restart(model, v) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Speed" value={speed} min={1} max={3} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}

/** Three decimals without a stray minus sign on values that round to zero. */
const fix3 = (x: number) => (Math.abs(x) < 5e-4 ? 0 : x).toFixed(3)
