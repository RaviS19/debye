// A9: Vlasov–Poisson simulation of Landau damping. The distribution f(x, v) lives on a grid; the
// heat map shows it (or its departure from the initial Maxwellian), the dashed lines mark the
// resonant velocity v = ω/k, and the lower panel tracks log|E₁| against kinetic theory.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { averageF, createVlasov, f0Of, peakFit, recurrenceTime, slopeFit, stepVlasov, type Profile, type Vlasov } from '../physics/vlasov'
import { bumpRoot, landauApprox, landauExact } from '../physics/plasmaZ'
import { SimFrame, Slider } from './SimFrame'

type Preset = 'landau' | 'trap' | 'bump'
const PRESETS: Record<Preset, { label: string; k: number; la: number; profile: Profile; view: 'df' | 'f' }> = {
  landau: { label: 'Linear Landau damping', k: 0.5, la: -2, profile: 'maxwell', view: 'df' },
  trap: { label: 'Trapping (large amplitude)', k: 0.5, la: Math.log10(0.5), profile: 'maxwell', view: 'f' },
  bump: { label: 'Bump on tail', k: 0.3, la: Math.log10(0.002), profile: 'bump', view: 'f' },
}
const T_END = 80

export function VlasovSim() {
  const [running, setRunning] = useState(true)
  const [preset, setPreset] = useState<Preset>('landau')
  const [k, setK] = useState(0.5)
  const [la, setLa] = useState(-2)
  const [profile, setProfile] = useState<Profile>('maxwell')
  const [view, setView] = useState<'df' | 'f'>('df')
  const [speed, setSpeed] = useState(1)
  const alpha = 10 ** la
  const sim = useRef<Vlasov>(createVlasov({ k, alpha, profile }))
  const img = useRef<{ canvas: HTMLCanvasElement; data: ImageData } | null>(null)
  const avg = useRef(new Float64Array(sim.current.nv))
  const scale = useRef(0)
  const [meas, setMeas] = useState<{ gamma: number; omega?: number } | null>(null)
  const [time, setTime] = useState(0)

  const restart = (kk = k, a = alpha, pr = profile) => {
    sim.current = createVlasov({ k: kk, alpha: a, profile: pr })
    scale.current = 0
    setMeas(null)
    setTime(0)
    setRunning(true)
  }
  const choose = (p: Preset) => {
    const q = PRESETS[p]
    setPreset(p)
    setK(q.k)
    setLa(q.la)
    setProfile(q.profile)
    setView(q.view)
    restart(q.k, 10 ** q.la, q.profile)
  }

  // theory: exact kinetic root (and the small-kλ_D formula for a Maxwellian)
  const theory = useMemo(() => {
    if (profile === 'bump') {
      const r = bumpRoot(k)
      return r ? { wr: r[0], gamma: r[1], approx: NaN } : { wr: NaN, gamma: NaN, approx: NaN }
    }
    const [wr, wi] = landauExact(k)
    return { wr, gamma: wi, approx: -landauApprox(k) }
  }, [k, profile])
  const E0 = alpha / k
  const omegaB = Math.sqrt(k * E0)
  const vphi = theory.wr / k

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.3 : 0.62)

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
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    // --- heat map of f or δf ---
    const [vlo, vhi] = profile === 'bump' ? [-5, 8] : [-6, 6]
    const j0 = Math.max(0, Math.floor((vlo + s.vmax) / s.dv))
    const j1 = Math.min(s.nv, Math.ceil((vhi + s.vmax) / s.dv))
    const rows = j1 - j0
    if (!img.current || img.current.data.height !== rows || img.current.data.width !== s.nx) {
      const cv = document.createElement('canvas')
      cv.width = s.nx
      cv.height = rows
      img.current = { canvas: cv, data: new ImageData(s.nx, rows) }
    }
    const { canvas: off, data } = img.current
    const px = data.data
    let fmax = 0
    for (let j = 0; j < s.nv; j++) fmax = Math.max(fmax, s.f0[j])
    let dmax = 1e-30
    if (view === 'df') {
      for (let i = 0; i < s.nx; i++) for (let j = j0; j < j1; j++) dmax = Math.max(dmax, Math.abs(s.f[i * s.nv + j] - s.f0[j]))
      scale.current = scale.current ? Math.max(dmax, scale.current * 0.97) : dmax // autoscale, easing down
    }
    for (let jj = 0; jj < rows; jj++) {
      const j = j1 - 1 - jj // top row = highest v
      for (let i = 0; i < s.nx; i++) {
        const q = 4 * (jj * s.nx + i)
        const val = s.f[i * s.nv + j]
        if (view === 'df') {
          const d = (val - s.f0[j]) / scale.current
          const a = Math.min(1, Math.abs(d))
          if (d >= 0) {
            px[q] = 6 + 28 * a
            px[q + 1] = 12 + 199 * a
            px[q + 2] = 24 + 214 * a
          } else {
            px[q] = 6 + 238 * a
            px[q + 1] = 12 + 102 * a
            px[q + 2] = 24 + 158 * a
          }
        } else {
          const a = Math.sqrt(Math.max(0, val) / fmax)
          px[q] = 6 + 40 * a + 180 * a ** 4
          px[q + 1] = 12 + 180 * a + 60 * a ** 4
          px[q + 2] = 30 + 200 * a + 20 * a ** 4
        }
        px[q + 3] = 255
      }
    }
    off.getContext('2d')!.putImageData(data, 0, 0)
    const topH = H * (narrow ? 0.56 : 0.62)
    const mapW = W * 0.76
    const hy0 = 4 * u
    const hy1 = topH
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, 0, hy0, mapW, hy1 - hy0)
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = u
    ctx.strokeRect(0.5, hy0, mapW - 1, hy1 - hy0)
    const V = (v: number) => hy1 - ((v - vlo) / (vhi - vlo)) * (hy1 - hy0)
    // v = 0 axis and resonant velocities
    ctx.strokeStyle = 'rgba(154,160,201,0.35)'
    ctx.beginPath()
    ctx.moveTo(0, V(0))
    ctx.lineTo(mapW, V(0))
    ctx.stroke()
    const res = profile === 'bump' ? [vphi] : [vphi, -vphi]
    ctx.setLineDash([6 * u, 5 * u])
    ctx.strokeStyle = COLORS.amber
    ctx.lineWidth = 1.4 * u
    for (const v of res) {
      if (!isFinite(v) || v < vlo || v > vhi) continue
      ctx.beginPath()
      ctx.moveTo(0, V(v))
      ctx.lineTo(W, V(v))
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.amber
    if (isFinite(vphi) && vphi < vhi) ctx.fillText('v = ω/k', 6 * u, V(vphi) - 5 * u)
    ctx.fillStyle = COLORS.white
    ctx.fillText(view === 'df' ? 'δf = f − f₀ (autoscaled): x across, v up' : 'f(x, v): x across, v up', 6 * u, hy0 + fs + 2 * u)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    ctx.fillText(`v = ${vhi}`, mapW - 4 * u, hy0 + fs + 2 * u)
    ctx.fillText(`${vlo}`, mapW - 4 * u, hy1 - 4 * u)
    ctx.textAlign = 'left'

    // --- side strip: spatially averaged f(v) vs the initial f₀(v) ---
    const sx0 = mapW + 6 * u
    const sx1 = W - 4 * u
    averageF(s, avg.current)
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(sx0, hy0, sx1 - sx0, hy1 - hy0)
    const F = (f: number) => sx0 + (f / (fmax * 1.1)) * (sx1 - sx0)
    ctx.setLineDash([4 * u, 4 * u])
    ctx.strokeStyle = COLORS.violet
    ctx.lineWidth = 1.2 * u
    ctx.beginPath()
    for (let n = 0; n <= 120; n++) {
      const v = vlo + ((vhi - vlo) * n) / 120
      const x = F(f0Of(profile, v))
      if (n) ctx.lineTo(x, V(v))
      else ctx.moveTo(x, V(v))
    }
    ctx.stroke()
    ctx.setLineDash([])
    glowStroke(ctx, COLORS.cyan, 1.6 * u, () => {
      for (let j = j0; j < j1; j++) {
        const x = F(avg.current[j])
        if (j > j0) ctx.lineTo(x, V(s.v[j]))
        else ctx.moveTo(x, V(s.v[j]))
      }
    })
    ctx.fillStyle = COLORS.text
    ctx.fillText('⟨f⟩(v)', sx0 + 4 * u, hy0 + fs + 2 * u)

    // --- log|E₁| vs time ---
    const gx0 = 40 * u
    const gx1 = W - 8 * u
    const gy0 = topH + 26 * u
    const gy1 = H - 20 * u
    const tMax = Math.max(40, Math.min(T_END, Math.ceil(s.t / 20) * 20))
    const l0 = Math.log10(s.e1[0])
    const growing = profile === 'bump' && theory.gamma > 0
    const [yMin, yMax] = growing ? [l0 - 1, l0 + 3] : alpha > 0.1 ? [l0 - 3, l0 + 0.5] : [l0 - 7, l0 + 0.5]
    const X = (t: number) => gx0 + (t / tMax) * (gx1 - gx0)
    const Y = (y: number) => gy1 - ((y - yMin) / (yMax - yMin)) * (gy1 - gy0)
    ctx.strokeStyle = COLORS.grid
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    for (let y = Math.ceil(yMin); y <= yMax; y++) {
      if ((y - Math.ceil(yMin)) % (yMax - yMin > 5 ? 2 : 1)) continue
      ctx.beginPath()
      ctx.moveTo(gx0, Y(y))
      ctx.lineTo(gx1, Y(y))
      ctx.stroke()
      ctx.fillText(y === 0 ? '1' : `1e${y}`, gx0 - 4 * u, Y(y) + 4 * u)
    }
    ctx.textAlign = 'center'
    for (let t = 0; t <= tMax; t += 20) ctx.fillText(String(t), X(t), gy1 + 13 * u)
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    ctx.fillText(narrow ? '|E₁| vs ω_pe t' : '|E₁| (log scale) vs time ω_pe t', gx0, topH + 17 * u)
    ctx.save()
    ctx.beginPath()
    ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.clip()
    // theory lines anchored at the first peak (damping) or at the fit start (growth)
    const line = (slope: number, t1: number, y1: number, col: string) => {
      ctx.setLineDash([6 * u, 5 * u])
      ctx.strokeStyle = col
      ctx.lineWidth = 1.5 * u
      ctx.beginPath()
      ctx.moveTo(X(0), Y(y1 - (slope * t1) / Math.LN10))
      ctx.lineTo(X(tMax), Y(y1 + (slope * (tMax - t1)) / Math.LN10))
      ctx.stroke()
      ctx.setLineDash([])
    }
    const e1 = s.e1
    if (profile === 'bump') {
      const t0 = Math.min(3 / theory.gamma, 12) // after the start-up transient (see the fit below)
      const i = s.times.findIndex((t) => t >= t0)
      if (i > 0 && isFinite(theory.gamma)) line(theory.gamma, s.times[i], Math.log10(e1[i]), COLORS.amber)
    } else {
      let ip = -1
      for (let i = 1; i < e1.length - 1; i++) if (e1[i] > e1[i - 1] && e1[i] >= e1[i + 1]) { ip = i; break }
      if (ip < 0) ip = 0
      // the small-kλ_D formula first, so the exact kinetic line stays visible where the two nearly coincide
      if (isFinite(theory.approx)) line(theory.approx, s.times[ip], Math.log10(e1[ip]), COLORS.violet)
      line(theory.gamma, s.times[ip], Math.log10(e1[ip]), COLORS.amber)
    }
    glowStroke(ctx, COLORS.lime, 1.6 * u, () => {
      for (let i = 0; i < e1.length; i++) {
        const y = Math.log10(Math.max(e1[i], 1e-30))
        if (i) ctx.lineTo(X(s.times[i]), Y(y))
        else ctx.moveTo(X(s.times[i]), Y(y))
      }
    })
    ctx.restore()
    // legend on the title line, right-aligned, so it never covers the curve
    ctx.textAlign = 'right'
    let lx = gx1
    const ly = topH + 17 * u
    const leg = (col: string, txt: string) => {
      ctx.fillStyle = col
      ctx.fillText(txt, lx, ly)
      lx -= ctx.measureText(txt).width + 12 * u
    }
    if (profile !== 'bump' && !narrow) leg(COLORS.violet, 'small-kλ_D formula')
    if (profile !== 'bump' || growing) leg(COLORS.amber, 'kinetic theory')
    leg(COLORS.lime, 'Vlasov')
    ctx.textAlign = 'left'
  }

  let frame = 0
  useAnimation(
    canvas,
    () => {
      const s = sim.current
      if (s.t < T_END) {
        stepVlasov(s, speed)
        if (++frame % 6 === 0) {
          setTime(s.t)
          if (profile === 'bump') {
            const g = theory.gamma
            // start after the transient (3/γ, but no later than t = 12, or slow modes would reach the
            // trapping level γ²/k before the window opens); stop before trapping
            setMeas(isFinite(g) && g > 0 ? slopeFit(s.times, s.e1, Math.min(3 / g, 12), (g * g) / k) : null)
          } else {
            // fit before recurrence effects (a third of the recurrence time) and before the first bounce
            const tMax = Math.min(0.35 * recurrenceTime(s), (0.8 * 2 * Math.PI) / omegaB, s.t)
            setMeas(peakFit(s.times, s.e1, tMax, 1e-9 * s.e1[0]))
          }
        }
      } else if (running) setRunning(false)
      draw()
    },
    running,
  )

  const okG = meas && isFinite(theory.gamma) && Math.abs(meas.gamma / theory.gamma - 1) < 0.05
  const trapped = profile !== 'bump' && omegaB > Math.abs(theory.gamma)
  const okW = meas?.omega && Math.abs(meas.omega / theory.wr - 1) < 0.05
  return (
    <SimFrame
      id="vlasov"
      title="Landau damping (1D Vlasov–Poisson)"
      running={running}
      setRunning={(on) => (on && sim.current.t >= T_END ? restart() : setRunning(on))}
      onReset={() => restart()}
      hint="Units: ω_pe = 1, λ_D = 1, v_th = √(kT_e/m) = 1; the box is one wavelength long. No collisions anywhere, yet the wave dies. In the δf view, watch the perturbation shear into ever finer stripes (phase mixing); the resonant electrons near the dashed lines v = ±ω/k are the ones that take the wave’s energy. Raise the amplitude until the bounce frequency beats the damping rate, and trapped electrons make vortices that stop the decay. The bump-on-tail preset puts a positive slope at v = ω/k, and the wave grows instead."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {(Object.keys(PRESETS) as Preset[]).map((p) => (
          <button key={p} className={`btn small ${preset === p ? 'primary' : ''}`} onClick={() => choose(p)}>
            {PRESETS[p].label}
          </button>
        ))}
        <button className="btn small" onClick={() => setView(view === 'df' ? 'f' : 'df')}>
          Show {view === 'df' ? 'f' : 'δf'}
        </button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Vlasov simulation of Landau damping" />
      <div className="readouts">
        {profile === 'bump' ? (
          theory.gamma > 0 ? (
            <>
              <span>measured growth γ = <b className={meas && Math.abs(meas.gamma / theory.gamma - 1) < 0.05 ? 'ok' : ''}>{meas ? meas.gamma.toFixed(3) : '…'}</b></span>
              <span>kinetic theory γ = <b>{theory.gamma.toFixed(3)}</b>, ω = <b>{theory.wr.toFixed(3)}</b></span>
            </>
          ) : (
            <span>no growing mode at this k: ω/k falls outside the positive-slope window (about 3.1 to 4.5 v_th), so the wave is Landau damped</span>
          )
        ) : (
          <>
            <span>{trapped ? 'early decay rate' : 'measured γ'} = <b className={okG && !trapped ? 'ok' : ''}>{meas ? meas.gamma.toFixed(4) : '…'}</b>, ω = <b className={okW && !trapped ? 'ok' : ''}>{meas?.omega ? meas.omega.toFixed(3) : '…'}</b></span>
            <span>{trapped ? 'linear theory (does not apply)' : 'kinetic theory'} γ = <b>{theory.gamma.toFixed(4)}</b>, ω = <b>{theory.wr.toFixed(3)}</b></span>
            <span>small-kλ_D formula γ = <b>{theory.approx.toFixed(4)}</b></span>
          </>
        )}
        {isFinite(theory.gamma) && (
          <span>ω_B/|γ| = <b>{(omegaB / Math.abs(theory.gamma)).toFixed(2)}</b>{omegaB > Math.abs(theory.gamma) ? ' (trapping matters)' : ' (linear)'}</span>
        )}
        <span>t = <b>{time.toFixed(0)}</b></span>
      </div>
      <div className="controls">
        <Slider label="Wavenumber kλ_D" value={k} min={0.25} max={0.8} step={0.05} onChange={(v) => { setK(v); restart(v) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Amplitude α (δn/n)" value={la} min={-3} max={Math.log10(0.5)} step={0.1} onChange={(v) => { setLa(v); restart(k, 10 ** v) }} fmt={(v) => (10 ** v).toPrecision(2)} />
        <Slider label="Speed" value={speed} min={1} max={4} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
