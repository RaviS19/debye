// A7: random walk across B. Two identical clouds start at a point; one feels a magnetic field
// (out of the screen). Collisions re-randomize each velocity; between collisions particles gyrate.
// The spread ⟨Δx²⟩ grows as 2D⊥t, with D⊥ = (kT/mν)/(1 + ω_c²/ν²).
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { advanceRange, advanceWalkers, createWalkers, dPerp, msd, theoryMSD, type Walkers } from '../physics/randomwalk'
import { SimFrame, Slider } from './SimFrame'

const N = 1500
const TMAX = 50
const VIEWR = 22 // half-width of the cloud view, in mean free paths v_th/ν
const TRAIL = 900
const SUB = 10 // sub-steps per frame for the tracked particle's path

interface Readout {
  t: number
  dB: number
  d0: number
}

export function RandomWalkSim() {
  const [running, setRunning] = useState(true)
  const [w, setW] = useState(2)
  const [speed, setSpeed] = useState(2)
  const mag = useRef<Walkers>(null!)
  const free = useRef<Walkers>(null!)
  if (!mag.current) {
    mag.current = createWalkers(N, 2, 7)
    free.current = createWalkers(N, 0, 7)
  }
  const hist = useRef<{ t: number; b: number; f: number }[]>([])
  const trail = useRef<number[]>([])
  const kicks = useRef<number[]>([])
  const zoom = useRef(2)
  const samples = useRef(0)
  const frame = useRef(0)
  const [ro, setRo] = useState<Readout>({ t: 0, dB: NaN, d0: NaN })

  const restart = (wc = w) => {
    mag.current = createWalkers(N, wc, 7)
    free.current = createWalkers(N, 0, 7)
    hist.current = []
    trail.current = [0, 0]
    kicks.current = []
    samples.current = 0
    zoom.current = 2
    setRo({ t: 0, dB: NaN, d0: NaN })
  }
  if (!trail.current.length) trail.current = [0, 0]

  const narrowInit = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrowInit ? 1.5 : 0.5, undefined, narrowInit ? 640 : 460)

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const narrow = c.clientWidth < 560
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const gap = 8 * u
    // panel geometry
    let cloud: [number, number, number]
    let graph: [number, number, number, number]
    let path: [number, number, number]
    if (narrow) {
      const S = Math.min(W, H * 0.64)
      cloud = [(W - S) / 2, 0, S]
      const rowY = S + gap
      const ph = H - rowY
      const ps = Math.min(ph, W * 0.44)
      path = [0, rowY, ps]
      graph = [ps + gap, rowY, W - ps - gap, ph]
    } else {
      cloud = [0, 0, H]
      const rx = H + gap
      const gh = H * 0.56
      graph = [rx, 0, W - rx, gh]
      const ps = H - gh - gap
      path = [rx, gh + gap, ps]
    }
    const fs = (narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`

    // ---- cloud panel ----
    {
      const [x0, y0, S] = cloud
      const k = S / (2 * VIEWR)
      const cx = x0 + S / 2
      const cy = y0 + S / 2
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, y0, S, S)
      ctx.clip()
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      for (let g = -20; g <= 20; g += 10) {
        ctx.beginPath()
        ctx.moveTo(cx + g * k, y0)
        ctx.lineTo(cx + g * k, y0 + S)
        ctx.moveTo(x0, cy + g * k)
        ctx.lineTo(x0 + S, cy + g * k)
        ctx.stroke()
      }
      const f = free.current
      const m = mag.current
      ctx.fillStyle = 'rgba(160,111,214,0.55)'
      const r = 1.3 * u
      for (let i = 0; i < f.n; i++) ctx.fillRect(cx + f.x[i] * k - r, cy - f.y[i] * k - r, 2 * r, 2 * r)
      ctx.fillStyle = 'rgba(34,211,238,0.8)'
      for (let i = 1; i < m.n; i++) ctx.fillRect(cx + m.x[i] * k - r, cy - m.y[i] * k - r, 2 * r, 2 * r)
      // rms radius circles, √(⟨Δx²⟩ + ⟨Δy²⟩)
      ctx.setLineDash([5 * u, 5 * u])
      ctx.lineWidth = 1.4 * u
      for (const [ws, col] of [[f, COLORS.violet], [m, COLORS.glow]] as const) {
        const rr = Math.sqrt(2 * msd(ws)) * k
        ctx.strokeStyle = col
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, 7)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.fillStyle = '#fff'
      ctx.shadowColor = COLORS.amber
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(cx + m.x[0] * k, cy - m.y[0] * k, 3.2 * u, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()
      ctx.strokeStyle = COLORS.axis
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, S - 1, S - 1)
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.violet
      ctx.fillText('● B = 0', x0 + 8 * u, y0 + 16 * u)
      ctx.fillStyle = COLORS.cyan
      ctx.fillText(`● B on, ω_c/ν = ${w}`, x0 + 8 * u, y0 + 16 * u + fs * 1.35)
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      ctx.fillText('⊙ B out of screen', x0 + S - 8 * u, y0 + 16 * u)
      // scale bar: 10 mean free paths
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 1.5 * u
      ctx.beginPath()
      ctx.moveTo(x0 + S - 8 * u - 10 * k, y0 + S - 12 * u)
      ctx.lineTo(x0 + S - 8 * u, y0 + S - 12 * u)
      ctx.stroke()
      ctx.fillStyle = COLORS.white
      ctx.fillText('10 v_th/ν', x0 + S - 8 * u, y0 + S - 17 * u)
    }

    // ---- ⟨Δx²⟩ vs t ----
    {
      const [x0, y0, gw, gh] = graph
      const pl = x0 + (narrow ? 26 : 34) * u
      const pr = x0 + gw - 6 * u
      const pt = y0 + 20 * u
      const pb = y0 + gh - 18 * u
      const ymax = theoryMSD(TMAX, 0) * 1.08
      const X = (t: number) => pl + (t / TMAX) * (pr - pl)
      const Y = (v: number) => pb - (v / ymax) * (pb - pt)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      for (let t = 0; t <= TMAX; t += 10) {
        ctx.beginPath()
        ctx.moveTo(X(t), pt)
        ctx.lineTo(X(t), pb)
        ctx.stroke()
        if (!narrow || t % 20 === 0) ctx.fillText(String(t), X(t), pb + 13 * u)
      }
      ctx.textAlign = 'right'
      for (let v = 0; v <= ymax; v += 25) {
        ctx.beginPath()
        ctx.moveTo(pl, Y(v))
        ctx.lineTo(pr, Y(v))
        ctx.stroke()
        ctx.fillText(String(v), pl - 4 * u, Y(v) + 4 * u)
      }
      ctx.strokeStyle = COLORS.axis
      ctx.strokeRect(pl, pt, pr - pl, pb - pt)
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.white
      ctx.fillText(narrow ? '⟨Δx²⟩ vs tν' : '⟨Δx²⟩ vs time tν   (dashed: theory)', pl, y0 + 12 * u)
      for (const [wc, col] of [[0, COLORS.violet], [w, COLORS.cyan]] as const) {
        ctx.setLineDash([5 * u, 5 * u])
        ctx.strokeStyle = col
        ctx.lineWidth = 1.3 * u
        ctx.beginPath()
        for (let k = 0; k <= 100; k++) {
          const t = (k / 100) * TMAX
          if (k) ctx.lineTo(X(t), Y(theoryMSD(t, wc)))
          else ctx.moveTo(X(t), Y(theoryMSD(t, wc)))
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      const h = hist.current
      for (const [key, col] of [['f', COLORS.violet], ['b', COLORS.cyan]] as const) {
        glowStroke(ctx, col, 1.8 * u, () => {
          ctx.moveTo(X(0), Y(0))
          for (const p of h) ctx.lineTo(X(p.t), Y(p[key]))
        })
      }
    }

    // ---- one particle, zoomed ----
    {
      const [x0, y0, S] = path
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = u
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, S - 1, S - 1)
      const tr = trail.current
      let minx = Infinity
      let maxx = -Infinity
      let miny = Infinity
      let maxy = -Infinity
      for (let i = 0; i < tr.length; i += 2) {
        minx = Math.min(minx, tr[i])
        maxx = Math.max(maxx, tr[i])
        miny = Math.min(miny, tr[i + 1])
        maxy = Math.max(maxy, tr[i + 1])
      }
      const span = Math.max(maxx - minx, maxy - miny, 1)
      zoom.current += (span * 1.15 - zoom.current) * 0.08
      const k = S / Math.max(zoom.current, span * 1.05)
      const mx = (minx + maxx) / 2
      const my = (miny + maxy) / 2
      const PX = (x: number) => x0 + S / 2 + (x - mx) * k
      const PY = (y: number) => y0 + S / 2 - (y - my) * k
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, y0, S, S)
      ctx.clip()
      glowStroke(ctx, COLORS.cyan, 1.3 * u, () => {
        for (let i = 0; i < tr.length; i += 2) {
          if (i) ctx.lineTo(PX(tr[i]), PY(tr[i + 1]))
          else ctx.moveTo(PX(tr[i]), PY(tr[i + 1]))
        }
      })
      ctx.fillStyle = COLORS.amber
      const kk = kicks.current
      for (let i = 0; i < kk.length; i += 3) {
        ctx.beginPath()
        ctx.arc(PX(kk[i]), PY(kk[i + 1]), 2.4 * u, 0, 7)
        ctx.fill()
      }
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(PX(tr[tr.length - 2]), PY(tr[tr.length - 1]), 3 * u, 0, 7)
      ctx.fill()
      ctx.restore()
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.white
      ctx.fillText(narrow ? 'one particle' : 'one particle, zoomed', x0 + 6 * u, y0 + 14 * u)
      ctx.fillStyle = COLORS.amber
      ctx.fillText('● collisions', x0 + 6 * u, y0 + S - 7 * u)
      if (!narrow) {
        const tx = x0 + S + 10 * u
        const lines =
          w > 0
            ? ['Between collisions it circles', `a field line (r_L ≈ v_th/ω_c ≈ ${(1 / w).toFixed(2)}`, 'mean free paths). Each collision', 'restarts it on a new circle', 'about one r_L away: a random', 'walk with step r_L, not λ_mfp.']
            : ['No field: straight flights of', 'about one mean free path', 'λ_mfp = v_th/ν between', 'collisions. The step of the', 'random walk is λ_mfp.']
        ctx.fillStyle = COLORS.text
        lines.forEach((s, i) => ctx.fillText(s, tx, y0 + 14 * u + i * fs * 1.45))
      }
    }
  }

  useAnimation(
    canvas,
    () => {
      const m = mag.current
      const f = free.current
      if (m.t < TMAX - 1e-9) {
        const dt = 0.05 * speed
        advanceWalkers(f, dt)
        advanceRange(m, 1, m.n, m.t, dt)
        const h = dt / SUB
        for (let s = 0; s < SUB; s++) {
          const hits = advanceRange(m, 0, 1, m.t + s * h, h)
          samples.current++
          if (hits) kicks.current.push(m.x[0], m.y[0], samples.current)
          trail.current.push(m.x[0], m.y[0])
        }
        m.t += dt
        if (trail.current.length > 2 * TRAIL) trail.current.splice(0, trail.current.length - 2 * TRAIL)
        // drop collision markers that have scrolled off the start of the trail
        const first = samples.current - trail.current.length / 2
        while (kicks.current.length && kicks.current[2] <= first) kicks.current.splice(0, 3)
        hist.current.push({ t: m.t, b: msd(m), f: msd(f) })
        if (++frame.current % 5 === 0 || m.t >= TMAX - 1e-9) setRo({ t: m.t, dB: msd(m) / (2 * m.t), d0: msd(f) / (2 * f.t) })
      }
      draw()
    },
    running,
  )

  const th = dPerp(w)
  // Exact expectation of ⟨Δx²⟩/2t at the current time: it starts ballistic and approaches D only as 1/t
  // (for B = 0, ⟨Δx²⟩/2t = 1 − (1 − e^{−t})/t), so compare against it rather than against the t → ∞ limit.
  const thB = ro.t > 0 ? theoryMSD(ro.t, w) / (2 * ro.t) : NaN
  const th0 = ro.t > 0 ? theoryMSD(ro.t, 0) / (2 * ro.t) : NaN
  const settled = ro.t > 5
  const done = ro.t >= TMAX - 1e-9
  // tolerance ≈ 3σ of the sampling noise of ⟨Δx²⟩ for N = 1500 particles (σ ≈ 1/√N ≈ 2.6%)
  const okB = settled && Math.abs(ro.dB / thB - 1) < 0.08
  const ok0 = settled && Math.abs(ro.d0 / th0 - 1) < 0.08
  const okRatio = settled && Math.abs(ro.dB / ro.d0 / (thB / th0) - 1) < 0.11
  const f3 = (v: number) => (isFinite(v) ? v.toFixed(3) : '…')

  return (
    <SimFrame
      id="random-walk-b"
      title="Random walk across B"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint="Units: collision rate ν = 1, kT/m = 1, lengths in mean free paths v_th/ν. Both clouds start at the centre with the same thermal speeds; each collision (a Poisson process at rate ν) redraws the velocity from a Maxwellian. The dashed circles are the rms spread. With B on, particles only move across the field by hopping from one gyro-circle to the next, so the cyan cloud grows far more slowly. The readouts compare ⟨Δx²⟩/2t with the exact theory at the same time; it creeps up to D only slowly, as 1/t, because the first collision time or so is ballistic."
    >
      <canvas ref={canvas} className="sim" aria-label="Random walk of particles across a magnetic field" />
      <div className="readouts">
        <span>t = <b>{ro.t.toFixed(1)}</b> /ν{done && ' (done, press Reset)'}</span>
        <span>
          with B: ⟨Δx²⟩/2t = <b className={okB ? 'ok' : ''}>{f3(ro.dB)}</b> vs theory <b>{f3(thB)}</b> (→ D⊥ = {th.toFixed(3)})
        </span>
        <span>
          B = 0: <b className={ok0 ? 'ok' : ''}>{f3(ro.d0)}</b> vs theory <b>{f3(th0)}</b> (→ kT/mν = 1)
        </span>
        <span>
          ratio: <b className={okRatio ? 'ok' : ''}>{isFinite(ro.dB / ro.d0) ? (ro.dB / ro.d0).toFixed(3) : '…'}</b> vs <b>{f3(thB / th0)}</b> (→ 1/(1 + ω_c²/ν²) = {th.toFixed(3)})
        </span>
      </div>
      <div className="controls">
        <Slider label="Magnetic field, ω_c / ν" value={w} min={0} max={5} step={0.25} onChange={(v) => { setW(v); restart(v) }} />
        <Slider label="Speed" value={speed} min={1} max={4} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
