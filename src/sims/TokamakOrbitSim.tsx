// A11: an ion in a circular tokamak, pushed with the Boris scheme (no guiding-centre approximation).
// With the plasma current on, the field lines twist and the ion either circulates (passing) or bounces
// off the strong field on the inboard side and traces a banana. Switch the current off and the same ion
// simply drifts vertically out of the machine: the ∇B + curvature drift of A2.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { bananaWidthExact, borisTokamak, isTrappedExact, launchIon, OrbitTracker, trappingRatio, verticalDrift, type TokamakField } from '../physics/tokamakOrbit'
import { SimFrame, Slider } from './SimFrame'

const V = 0.008 // ion speed in R₀ω_c0: Larmor radius ≈ 0.008 R₀ (exaggerated so orbits are visible)
const Q = 2 // safety factor
const A = 0.4 // minor radius of the plasma edge, in R₀
const DT = 0.15 // time step, 1/ω_c0 (about 42 steps per gyration)
const NG = 6000 // guiding-centre trail points
const NP = 9000 // particle trail points
const NV = 400 // v∥ history samples

interface Ring {
  a: Float32Array
  b: Float32Array
  n: number
  i: number
}
const ring = (n: number): Ring => ({ a: new Float32Array(n), b: new Float32Array(n), n: 0, i: 0 })
function push(r: Ring, x: number, y: number) {
  r.a[r.i] = x
  r.b[r.i] = y
  r.i = (r.i + 1) % r.a.length
  r.n = Math.min(r.n + 1, r.a.length)
}
function each(r: Ring, f: (x: number, y: number, k: number) => void) {
  const L = r.a.length
  const start = (r.i - r.n + L) % L
  for (let k = 0; k < r.n; k++) {
    const j = (start + k) % L
    f(r.a[j], r.b[j], k)
  }
}

interface Ro {
  kind: string
  width: number
  vd: number
  lost: number
  turns: number
  bounces: number
}

export function TokamakOrbitSim() {
  const [running, setRunning] = useState(true)
  const [eps, setEps] = useState(0.2)
  const [ratio, setRatio] = useState(0.4)
  const [current, setCurrent] = useState(true)
  const [speed, setSpeed] = useState(3)
  const field = useRef<TokamakField>({ q: Q, current: true })
  const st = useRef<ReturnType<typeof init> | null>(null)
  if (!st.current) st.current = init(0.2, 0.4, true)
  const frameN = useRef(0)
  const [ro, setRo] = useState<Ro>({ kind: 'undecided', width: NaN, vd: NaN, lost: NaN, turns: 0, bounces: 0 })

  function init(e: number, rt: number, cur: boolean) {
    const f: TokamakField = { q: Q, current: cur }
    const p = launchIon(e, V, rt, f)
    const tr = new OrbitTracker(p, f)
    return { p, tr, t: 0, step: 0, z0: tr.gc[1], gc: ring(NG), part: ring(NP), top: ring(NG), vpar: new Float32Array(NV), nv: 0, lost: NaN }
  }
  const restart = (e = eps, rt = ratio, cur = current) => {
    field.current = { q: Q, current: cur }
    st.current = init(e, rt, cur)
    frameN.current = 0
    setRo({ kind: 'undecided', width: NaN, vd: NaN, lost: NaN, turns: 0, bounces: 0 })
  }

  const narrowInit = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrowInit ? 1.42 : 0.6, undefined, narrowInit ? 560 : 520)

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
    const fs = (narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const s = st.current!
    // layout
    let pol: { x: number; y: number; s: number }
    let top: { x: number; y: number; s: number }
    let tr: { x: number; y: number; w: number; h: number }
    if (narrow) {
      const S = W
      pol = { x: 0, y: 0, s: S }
      const rowY = S + 8 * u
      const ts = Math.min(H - rowY - 4 * u, W * 0.4)
      top = { x: 0, y: rowY, s: ts }
      tr = { x: ts + 34 * u, y: rowY + 18 * u, w: W - ts - 40 * u, h: ts - 40 * u }
    } else {
      pol = { x: 0, y: 0, s: H }
      const rx = H + 12 * u
      const ts = Math.min(W - rx, H * 0.52)
      top = { x: rx + (W - rx - ts) / 2, y: 0, s: ts }
      tr = { x: rx + 34 * u, y: ts + 26 * u, w: W - rx - 40 * u, h: H - ts - 26 * u - 30 * u }
    }

    // ---------- poloidal cross-section ----------
    const span = A * 1.18
    const k = pol.s / (2 * span)
    const cx = pol.x + pol.s / 2
    const cy = pol.y + pol.s / 2
    const PX = (R: number) => cx + (R - 1) * k
    const PY = (Z: number) => cy - Z * k
    // field-strength shading: B ∝ 1/R, stronger inboard
    const grad = ctx.createLinearGradient(PX(1 - span), 0, PX(1 + span), 0)
    grad.addColorStop(0, 'rgba(34,211,238,0.16)')
    grad.addColorStop(1, 'rgba(34,211,238,0.02)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, A * k, 0, 7)
    ctx.fill()
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.setLineDash([3 * u, 5 * u])
    for (const r of [0.1, 0.2, 0.3]) {
      ctx.beginPath()
      ctx.arc(cx, cy, r * k, 0, 7)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = 2 * u
    ctx.beginPath()
    ctx.arc(cx, cy, A * k, 0, 7)
    ctx.stroke()
    ctx.lineWidth = u
    // axis marker
    ctx.strokeStyle = COLORS.text
    ctx.beginPath()
    ctx.moveTo(cx - 4 * u, cy)
    ctx.lineTo(cx + 4 * u, cy)
    ctx.moveTo(cx, cy - 4 * u)
    ctx.lineTo(cx, cy + 4 * u)
    ctx.stroke()
    // particle trail (faint, shows the gyration) and guiding centre (bright)
    ctx.strokeStyle = 'rgba(244,114,182,0.28)'
    ctx.beginPath()
    each(s.part, (R, Z, i) => (i ? ctx.lineTo(PX(R), PY(Z)) : ctx.moveTo(PX(R), PY(Z))))
    ctx.stroke()
    glowStroke(ctx, COLORS.magenta, 1.6 * u, () => {
      each(s.gc, (R, Z, i) => (i ? ctx.lineTo(PX(R), PY(Z)) : ctx.moveTo(PX(R), PY(Z))))
    })
    // launch point
    ctx.strokeStyle = COLORS.amber
    ctx.beginPath()
    ctx.arc(PX(1 + eps), PY(0), 5 * u, 0, 7)
    ctx.stroke()
    // ion
    const Rp = Math.hypot(s.p[0], s.p[1])
    ctx.fillStyle = '#fff'
    ctx.shadowColor = COLORS.magenta
    ctx.shadowBlur = 14 * u
    ctx.beginPath()
    ctx.arc(PX(Rp), PY(s.p[2]), 4 * u, 0, 7)
    ctx.fill()
    ctx.shadowBlur = 0
    // labels
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'left'
    ctx.fillText('poloidal cross-section', pol.x + 8 * u, pol.y + 16 * u)
    ctx.fillText('← to the torus axis', pol.x + 8 * u, cy + (A * k) + 18 * u > pol.y + pol.s - 6 * u ? pol.y + pol.s - 8 * u : cy + A * k + 18 * u)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.cyan
    ctx.fillText('inboard', PX(1 - A * 0.62), PY(-A * 0.5) - 6 * u)
    ctx.fillText('strong B', PX(1 - A * 0.62), PY(-A * 0.5) + 8 * u)
    ctx.fillStyle = COLORS.text
    ctx.fillText('outboard', PX(1 + A * 0.7), PY(A * 0.55))
    ctx.fillText('weak B', PX(1 + A * 0.7), PY(A * 0.55) + 14 * u)
    ctx.textAlign = 'right'
    ctx.fillStyle = current ? COLORS.lime : COLORS.red
    ctx.fillText(current ? `plasma current on, q = ${Q}` : 'plasma current OFF', pol.x + pol.s - 8 * u, pol.y + 16 * u)
    if (!current) {
      // charge separation schematic (collective effect, not simulated)
      const bx = PX(1 - A * 0.05)
      ctx.font = `bold ${fs * 1.2}px "PT Sans", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.magenta
      for (const dx of [-0.16, 0, 0.16]) ctx.fillText('+', PX(1 + dx), PY(A * 0.8))
      ctx.fillStyle = COLORS.cyan
      for (const dx of [-0.16, 0, 0.16]) ctx.fillText('−', PX(1 + dx), PY(-A * 0.8) + 4 * u)
      ctx.font = `${fs}px "PT Sans", sans-serif`
      const arrow = (x0: number, y0: number, x1: number, y1: number, col: string) => {
        ctx.strokeStyle = col
        ctx.fillStyle = col
        ctx.lineWidth = 2 * u
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        const a = Math.atan2(y1 - y0, x1 - x0)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x1 - 8 * u * Math.cos(a - 0.4), y1 - 8 * u * Math.sin(a - 0.4))
        ctx.lineTo(x1 - 8 * u * Math.cos(a + 0.4), y1 - 8 * u * Math.sin(a + 0.4))
        ctx.fill()
        ctx.lineWidth = u
      }
      arrow(bx - 0.14 * k, PY(A * 0.3), bx - 0.14 * k, PY(-A * 0.3), COLORS.amber)
      ctx.fillStyle = COLORS.amber
      ctx.textAlign = 'right'
      ctx.fillText('E', bx - 0.14 * k - 6 * u, cy + 4 * u)
      arrow(bx + 0.05 * k, cy, bx + 0.22 * k, cy, COLORS.lime)
      ctx.fillStyle = COLORS.lime
      ctx.textAlign = 'left'
      ctx.fillText('E×B', bx + 0.05 * k, cy - 8 * u)
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      ctx.fillText('ions drift up, electrons down', cx, pol.y + pol.s - 8 * u)
    }

    // ---------- top view ----------
    {
      const kk = top.s / (2 * (1 + A) * 1.08)
      const tx = top.x + top.s / 2
      const ty = top.y + top.s / 2
      ctx.strokeStyle = COLORS.axis
      ctx.beginPath()
      ctx.arc(tx, ty, (1 + A) * kk, 0, 7)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(tx, ty, (1 - A) * kk, 0, 7)
      ctx.stroke()
      ctx.strokeStyle = COLORS.grid
      ctx.setLineDash([3 * u, 4 * u])
      ctx.beginPath()
      ctx.arc(tx, ty, kk, 0, 7)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(244,114,182,0.7)'
      ctx.lineWidth = 1.2 * u
      ctx.beginPath()
      each(s.top, (x, y, i) => (i ? ctx.lineTo(tx + x * kk, ty - y * kk) : ctx.moveTo(tx + x * kk, ty - y * kk)))
      ctx.stroke()
      ctx.lineWidth = u
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(tx + s.p[0] * kk, ty - s.p[1] * kk, 3 * u, 0, 7)
      ctx.fill()
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText('top view', top.x + 4 * u, top.y + 14 * u)
    }

    // ---------- v∥ history ----------
    {
      ctx.strokeStyle = COLORS.axis
      ctx.strokeRect(tr.x, tr.y, tr.w, tr.h)
      const Yv = (v: number) => tr.y + tr.h / 2 - (v / V) * (tr.h / 2) * 0.95
      ctx.strokeStyle = COLORS.grid
      ctx.beginPath()
      ctx.moveTo(tr.x, Yv(0))
      ctx.lineTo(tr.x + tr.w, Yv(0))
      ctx.stroke()
      glowStroke(ctx, COLORS.cyan, 1.4 * u, () => {
        const n = Math.min(s.nv, NV)
        for (let i = 0; i < n; i++) {
          const j = s.nv > NV ? (s.nv + i) % NV : i
          const x = tr.x + (i / (NV - 1)) * tr.w
          if (i) ctx.lineTo(x, Yv(s.vpar[j]))
          else ctx.moveTo(x, Yv(s.vpar[j]))
        }
      })
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      ctx.fillText('+v', tr.x - 4 * u, Yv(V) + 8 * u)
      ctx.fillText('0', tr.x - 4 * u, Yv(0) + 4 * u)
      ctx.fillText('−v', tr.x - 4 * u, Yv(-V))
      ctx.textAlign = 'left'
      ctx.fillText('v∥ vs time', tr.x, tr.y - 6 * u)
      ctx.textAlign = 'center'
      ctx.fillText('time →', tr.x + tr.w / 2, tr.y + tr.h + 14 * u)
    }
  }

  useAnimation(
    canvas,
    () => {
      const s = st.current!
      const f = field.current
      if (isNaN(s.lost)) {
        const n = 350 * speed
        for (let i = 0; i < n; i++) {
          borisTokamak(s.p, f, DT)
          s.t += DT
          s.tr.update(s.p, f)
          const cnt = ++s.step
          if (cnt % 3 === 0) push(s.part, Math.hypot(s.p[0], s.p[1]), s.p[2])
          if (cnt % 8 === 0) {
            push(s.gc, s.tr.gc[0], s.tr.gc[1])
            push(s.top, s.p[0], s.p[1])
          }
          if (cnt % 60 === 0) {
            s.vpar[s.nv % NV] = s.tr.gc[2]
            s.nv++
          }
          if (Math.hypot(s.tr.gc[0] - 1, s.tr.gc[1]) > A) {
            s.lost = s.t
            break
          }
        }
      }
      if (++frameN.current % 8 === 0) {
        const cr = s.tr.crossings
        setRo({
          kind: s.tr.kind,
          width: s.tr.kind === 'trapped' && cr.length >= 2 ? Math.abs(cr[1] - cr[0]) : NaN,
          vd: s.t > 300 ? (s.tr.gc[1] - s.z0) / s.t : NaN,
          lost: s.lost,
          turns: Math.floor(Math.abs(s.tr.theta) / (2 * Math.PI)),
          bounces: s.tr.reversals,
        })
      }
      draw()
    },
    running,
  )

  const crit = trappingRatio(eps)
  const thin = ratio < crit ? 'trapped' : 'passing'
  // exact guiding-centre invariants (E, μ, p_φ): includes the finite orbit width, which shifts the boundary
  const predicted = useMemo(() => (isTrappedExact(eps, V, ratio, Q) ? 'trapped' : 'passing'), [eps, ratio])
  const vperp = V / Math.sqrt(1 + ratio * ratio)
  const vdTheory = verticalDrift(ratio * vperp, vperp)
  const wTheory = bananaWidthExact(eps, V, ratio, Q)
  return (
    <SimFrame
      id="tokamak-orbits"
      title="Ion orbits in a tokamak"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint="Normalized units: R₀ = 1, field on axis B₀ = 1, ion q/m = 1 (times in 1/ω_c); the Larmor radius is about 0.008 R₀, 10–20 times that of a thermal ion in a reactor-sized tokamak and close to that of a 3.5 MeV alpha, so the orbit widths are visible. The faint line is the actual ion; the bright line its guiding centre. Lower the pitch v∥/v⊥ below the critical value and the ion bounces off the strong field on the inboard side: a banana orbit. Because these orbits are fat, the drift carries the ion to other radii and the real boundary sits somewhat above the thin-orbit value; the readout also gives the exact prediction from the conserved energy, μ and p_φ. Then switch the plasma current off and watch it drift straight out of the machine."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className="btn small" onClick={() => { setRatio(0.4); setEps(0.2); setCurrent(true); restart(0.2, 0.4, true) }}>Banana example</button>
        <button className="btn small" onClick={() => { setRatio(1.2); setEps(0.2); setCurrent(true); restart(0.2, 1.2, true) }}>Passing example</button>
        <button className={`btn small ${current ? '' : 'primary'}`} onClick={() => { setCurrent(!current); restart(eps, ratio, !current) }}>
          Plasma current: {current ? 'on' : 'off'}
        </button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Tokamak ion orbit simulation" />
      {current ? (
        <div className="readouts">
          <span>thin-orbit rule: trapped if v∥/v⊥ &lt; √(2ε/(1−ε)) = <b>{crit.toFixed(3)}</b> → <b>{thin}</b></span>
          <span>with this orbit’s finite width (E, μ, p_φ conserved): <b>{predicted}</b></span>
          <span>
            observed: <b className={ro.kind === predicted ? 'ok' : ''}>{ro.kind === 'undecided' ? (isNaN(ro.lost) ? '…' : 'lost') : ro.kind === 'trapped' ? 'trapped (v∥ reversed)' : 'passing (full poloidal turn)'}</b>
          </span>
          {ro.kind === 'trapped' && (
            <span>
              banana width: <b className={Math.abs(ro.width / wTheory - 1) < 0.05 ? 'ok' : ''}>{isFinite(ro.width) ? ro.width.toFixed(3) : '…'}</b> vs p_φ theory <b>{wTheory.toFixed(3)}</b> R₀
            </span>
          )}
          {!isNaN(ro.lost) && <span style={{ color: 'var(--red)' }}>hit the wall at t = {ro.lost.toFixed(0)}</span>}
        </div>
      ) : (
        <div className="readouts">
          <span>
            vertical drift v_d/v: <b className={Math.abs(ro.vd / vdTheory - 1) < 0.05 ? 'ok' : ''}>{isFinite(ro.vd) ? (ro.vd / V).toFixed(4) : '…'}</b> vs theory (v∥² + ½v⊥²)/(ω_c R v) = <b>{(vdTheory / V).toFixed(4)}</b>
          </span>
          <span>{!isNaN(ro.lost) ? <b style={{ color: 'var(--red)' }}>lost to the wall at t = {ro.lost.toFixed(0)} / ω_c</b> : 'drifting out…'}</span>
        </div>
      )}
      <div className="controls">
        <Slider label="Pitch at launch v∥/v⊥" value={ratio} min={0} max={2} step={0.02} onChange={(v) => { setRatio(v); restart(eps, v) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Launch radius ε = r/R₀" value={eps} min={0.05} max={0.3} step={0.01} onChange={(v) => { setEps(v); restart(v, ratio) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Speed" value={speed} min={1} max={6} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
