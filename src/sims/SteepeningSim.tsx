// B4: ponderomotive profile steepening. Light at normal incidence on a linear density ramp; the plasma settles
// into pressure balance with the light, n = n0 exp(−U_p/kT), while the light is solved in that same profile.
// The light pressure carves out the density below n_c and piles it up above: a step forms where the light turns.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { criticalPressure, lightPressure, linearCheck, steepDiagnostics, steepen, U_MAX } from '../physics/ponderomotive'
import { SimFrame, Slider } from './SimFrame'

const L_STOPS = [5, 8, 10, 15, 20] // L/λ
const P_MAX = 0.4
const TWO_PI = 2 * Math.PI
// P = (I/c)/(n_c kT) → I in W/cm² for λ = 1.053 µm and kT = 1 keV
const I_PER_P = criticalPressure(1.053, 1000) / lightPressure(1)

const sup = (d: number) => String(d).replace(/[-0-9]/g, (ch) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)])
const fmtSci = (v: number) => {
  const ex = Math.floor(Math.log10(v))
  return `${(v / 10 ** ex).toFixed(1)}×10${sup(ex)}`
}

export function SteepeningSim() {
  const [running, setRunning] = useState(true)
  const [li, setLi] = useState(2)
  const [P, setP] = useState(0.1)
  const [ramping, setRamping] = useState<number | null>(null) // target P while the light is being turned up
  const L = TWO_PI * L_STOPS[li]
  const guess = useRef<number | undefined>(undefined)
  const lastL = useRef(L)
  const phase = useRef(0)
  const rampFrame = useRef(0)

  const sol = useMemo(() => {
    if (lastL.current !== L) guess.current = undefined
    lastL.current = L
    const Pe = Math.max(P, 1e-9)
    const s = steepen(L, Pe, guess.current)
    if (s.ok) guess.current = s.logEps
    return { s, d: steepDiagnostics(s, L, Pe), lin: s.ok ? linearCheck(s, L, Pe) : NaN, P: Pe }
  }, [L, P])

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.3 : 0.62, () => drawRef.current(), narrow ? 600 : 470)
  const drawRef = useRef<() => void>(() => {})

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
    ctx.font = `${(stacked ? 10.5 : 11) * u}px "PT Sans", sans-serif`
    const { s, d } = sol
    const Pe = sol.P
    const n = s.x.length
    const gap = 12 * u
    const hA = (H - gap) * 0.56
    const A: [number, number, number, number] = [0, 0, W, hA]
    const B: [number, number, number, number] = [0, hA + gap, W, H - hA - gap]
    let emax = 0
    for (let i = 0; i < n; i++) emax = Math.max(emax, Math.abs(s.E[i]))
    const cph = Math.cos(phase.current)

    // ---------- whole ramp ----------
    {
      const [x0, y0, w, h] = A
      const padL = 30 * u
      const padR = 30 * u
      const top = y0 + 30 * u
      const bot = y0 + h - 18 * u
      const xa = -Math.PI
      const xb = 2.2 * L
      const X = (x: number) => x0 + padL + ((x - xa) / (xb - xa)) * (w - padL - padR)
      const Yn = (v: number) => bot - (v / 2.4) * (bot - top)
      const ys = Math.max(2.2, emax * 1.08)
      const mid = (top + bot) / 2
      const Ye = (v: number) => mid - (v / ys) * ((bot - top) / 2)
      // density: original ramp (dashed) and steepened profile (filled)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      for (const v of [0, 1, 2]) {
        ctx.beginPath()
        ctx.moveTo(X(xa), Yn(v))
        ctx.lineTo(X(xb), Yn(v))
        ctx.stroke()
      }
      const step = Math.max(1, Math.floor(n / 1500))
      ctx.fillStyle = 'rgba(160,111,214,0.16)'
      ctx.beginPath()
      ctx.moveTo(X(xa), bot)
      for (let i = 0; i < n; i += step) if (s.x[i] <= xb) ctx.lineTo(X(s.x[i]), Yn(s.u[i]))
      ctx.lineTo(X(xb), Yn(Math.min(2.2, xb / L)))
      ctx.lineTo(X(xb), bot)
      ctx.closePath()
      ctx.fill()
      glowStroke(ctx, COLORS.violet, 1.8 * u, () => {
        ctx.moveTo(X(xa), Yn(0))
        for (let i = 0; i < n; i += step) if (s.x[i] <= xb) ctx.lineTo(X(s.x[i]), Yn(s.u[i]))
        ctx.lineTo(X(xb), Yn(xb / L))
      })
      ctx.setLineDash([5 * u, 4 * u])
      ctx.strokeStyle = 'rgba(160,111,214,0.75)'
      ctx.lineWidth = 1.2 * u
      ctx.beginPath()
      ctx.moveTo(X(xa), Yn(0))
      ctx.lineTo(X(0), Yn(0))
      ctx.lineTo(X(xb), Yn(xb / L))
      ctx.stroke()
      ctx.strokeStyle = 'rgba(251,95,95,0.7)'
      ctx.beginPath()
      ctx.moveTo(X(xa), Yn(1))
      ctx.lineTo(X(xb), Yn(1))
      ctx.stroke()
      ctx.setLineDash([])
      // the standing wave: envelope and the field at this instant
      ctx.strokeStyle = 'rgba(34,211,238,0.3)'
      ctx.lineWidth = u
      for (const sg of [1, -1]) {
        ctx.beginPath()
        for (let i = 0; i < n; i++) if (s.x[i] <= xb) (i ? ctx.lineTo(X(s.x[i]), Ye(sg * Math.abs(s.E[i]))) : ctx.moveTo(X(s.x[i]), Ye(sg * Math.abs(s.E[i]))))
        ctx.stroke()
      }
      glowStroke(ctx, COLORS.cyan, 1.5 * u, () => {
        for (let i = 0; i < n; i++) if (s.x[i] <= xb) (i ? ctx.lineTo(X(s.x[i]), Ye(s.E[i] * cph)) : ctx.moveTo(X(s.x[i]), Ye(s.E[i] * cph)))
      })
      // axes labels
      ctx.fillStyle = COLORS.violet
      ctx.textAlign = 'right'
      for (const v of [0, 1, 2]) ctx.fillText(String(v), X(xa) - 5 * u, Yn(v) + 4 * u)
      ctx.fillStyle = COLORS.cyan
      ctx.textAlign = 'left'
      const eTick = ys > 4 ? 4 : 2
      for (const v of [-eTick, 0, eTick]) ctx.fillText(String(v), X(xb) + 5 * u, Ye(v) + 4 * u)
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.white
      ctx.fillText(stacked ? 'density and light' : 'density n/n_c (left) and the standing wave E/E₀ (right)', x0 + padL, y0 + 12 * u)
      let lx = x0 + padL
      const ly = y0 + 25 * u
      const leg = (col: string, txt: string) => {
        ctx.fillStyle = col
        ctx.fillText(txt, lx, ly)
        lx += ctx.measureText(txt).width + 12 * u
      }
      leg(COLORS.violet, stacked ? 'n (dashed: no light)' : 'n with the light (dashed: without)')
      leg(COLORS.cyan, 'E(x) cos ωt')
      ctx.fillStyle = COLORS.red
      ctx.textAlign = 'right'
      ctx.fillText('n_c', X(xb) - 4 * u, Yn(1) + 14 * u)
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      const nl = L_STOPS[li]
      const ticks = [0, nl, 2 * nl]
      for (const t of ticks) ctx.fillText(`${t} λ`, X(t * TWO_PI), y0 + h - 4 * u)
      // zoom window
      const za = d.xPeak - 3 * TWO_PI
      const zb = d.xPeak + 1.5 * TWO_PI
      ctx.strokeStyle = 'rgba(232,234,246,0.35)'
      ctx.setLineDash([3 * u, 3 * u])
      ctx.strokeRect(X(za), top - 4 * u, X(zb) - X(za), bot - top + 8 * u)
      ctx.setLineDash([])
    }

    // ---------- zoom: pressure balance across the step ----------
    {
      const [x0, y0, w, h] = B
      const padL = 30 * u
      const padR = 30 * u
      const top = y0 + (stacked ? 44 : 30) * u
      const bot = y0 + h - 18 * u
      const za = d.xPeak - 3 * TWO_PI
      const zb = d.xPeak + 1.5 * TWO_PI
      const X = (x: number) => x0 + padL + ((x - za) / (zb - za)) * (w - padL - padR)
      // support of the ramp: the force per area that holds n0 up, accumulated from the vacuum
      const hold = new Float64Array(n)
      for (let i = 1; i < n; i++) {
        const hd = (k: number) => (s.x[k] > 0 && s.x[k] < L * U_MAX ? s.u[k] / s.x[k] : 0)
        hold[i] = hold[i - 1] + 0.5 * (hd(i) + hd(i - 1)) * (s.x[i] - s.x[i - 1])
      }
      const em = (i: number) => 0.5 * Pe * (s.E[i] * s.E[i] + s.dE[i] * s.dE[i])
      let pmax = 0
      for (let i = 0; i < n; i++) if (s.x[i] >= za && s.x[i] <= zb) pmax = Math.max(pmax, s.u[i] + em(i), 2 * Pe + hold[i])
      const ymax = Math.max(0.5, pmax * 1.12)
      const Y = (v: number) => bot - (v / ymax) * (bot - top)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = u
      const tick = ymax > 2.5 ? 1 : 0.5
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'right'
      for (let v = 0; v <= ymax; v += tick) {
        ctx.beginPath()
        ctx.moveTo(X(za), Y(v))
        ctx.lineTo(X(zb), Y(v))
        ctx.stroke()
        ctx.fillText(v.toFixed(1), X(za) - 5 * u, Y(v) + 4 * u)
      }
      const path = (f: (i: number) => number) => () => {
        let first = true
        for (let i = 0; i < n; i++) {
          if (s.x[i] < za || s.x[i] > zb) continue
          if (first) ctx.moveTo(X(s.x[i]), Y(f(i)))
          else ctx.lineTo(X(s.x[i]), Y(f(i)))
          first = false
        }
      }
      // the field intensity, faint, to show where the antinodes are
      ctx.fillStyle = 'rgba(34,211,238,0.10)'
      ctx.beginPath()
      ctx.moveTo(X(za), bot)
      path((i) => 0.5 * Pe * s.E[i] * s.E[i])()
      ctx.lineTo(X(zb), bot)
      ctx.closePath()
      ctx.fill()
      glowStroke(ctx, COLORS.violet, 1.8 * u, path((i) => s.u[i]))
      glowStroke(ctx, COLORS.cyan, 1.6 * u, path(em))
      ctx.setLineDash([6 * u, 4 * u])
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 2.2 * u
      ctx.beginPath()
      path((i) => 2 * Pe + hold[i])()
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 1.3 * u
      ctx.beginPath()
      path((i) => s.u[i] + em(i))()
      ctx.stroke()
      // n_c crossing marker
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.text
      for (let k = -3; k <= 1; k++) {
        const xx = d.xPeak + k * TWO_PI
        ctx.fillText(k === 0 ? 'last antinode' : `${k > 0 ? '+' : ''}${k} λ`, X(xx), y0 + h - 4 * u)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.white
      ctx.fillText(stacked ? 'zoom: pressures ÷ n_c kT' : 'zoom on the step: pressures in units of n_c kT', x0 + padL, y0 + 12 * u)
      let lx = x0 + padL
      let ly = y0 + 25 * u
      const leg = (col: string, txt: string) => {
        const wt = ctx.measureText(txt).width
        if (lx + wt > x0 + w - 4 * u) {
          lx = x0 + padL
          ly += 13 * u
        }
        ctx.fillStyle = col
        ctx.fillText(txt, lx, ly)
        lx += wt + 12 * u
      }
      leg(COLORS.violet, 'plasma n kT')
      leg(COLORS.cyan, 'light (EM momentum flux)')
      leg(COLORS.white, 'sum')
      leg(COLORS.amber, '2I/c + ramp support')
    }
  }

  drawRef.current = draw
  useAnimation(
    canvas,
    (dt) => {
      phase.current = (phase.current + (dt / 1400) * TWO_PI) % TWO_PI
      draw()
    },
    running,
  )
  useEffect(() => {
    if (!running) draw()
  })

  // turning up the light: P rises in small steps, each solved starting from the last
  const pRef = useRef(P)
  pRef.current = P
  useEffect(() => {
    if (ramping === null) return
    let raf = 0
    const tick = () => {
      rampFrame.current++
      if (rampFrame.current % 2 === 0) {
        const p1 = Math.round(Math.min(ramping, pRef.current + 0.004) * 1000) / 1000
        setP(p1)
        if (p1 >= ramping) {
          setRamping(null)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ramping])

  const { d, s } = sol
  const dU = d.uHigh - d.uLow
  const okStep = Math.abs(dU - (d.peakPressure - d.shelfPressure + d.support)) < 5e-3
  const okPush = Math.abs(d.totalPush / (2 * sol.P) - 1) < 0.005
  const I = P * I_PER_P
  const xc = (d.xPeak / TWO_PI).toFixed(1)

  return (
    <SimFrame
      id="ponderomotive-steepening"
      title="Profile steepening by the light"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setRamping(null)
        setLi(2)
        setP(0.1)
      }}
      hint="Light at normal incidence on a density ramp that rises linearly through n_c (the dashed line). The plasma is allowed to settle into pressure balance with the light: at each point n = n₀ exp(−U_p/kT), and the light is solved in the profile it creates. Press “Turn up the light” and watch the light dig the density out from below n_c and pile it up above, until the profile at the reflection point is a step a fraction of a wavelength wide. In the zoom, the plasma pressure (violet) and the light pressure (cyan) trade places across the step while their sum (white) follows the amber line, set by the light’s total push 2I/c. A longer ramp hardly changes the step: it is set by P alone."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button
          className="btn small primary"
          onClick={() => {
            const target = P > 0.02 ? P : 0.1
            guess.current = undefined
            setP(0)
            rampFrame.current = 0
            setRamping(target)
          }}
          disabled={ramping !== null}
        >
          {ramping !== null ? 'turning up…' : 'Turn up the light (0 → P)'}
        </button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Density profile steepened by the light pressure, with the standing wave and the pressure balance across the step" />
      <div className="readouts">
        <span>
          P = (I/c)/(n_c kT) = <b>{P.toFixed(3)}</b>: at 1.053 µm with k(T_e + T_i/Z) = 1 keV, I ≈ <b>{P > 0 ? `${fmtSci(I)} W/cm²` : '0'}</b>
        </span>
        {s.ok ? (
          <>
            <span>
              density jumps from <b>{d.uLow.toFixed(2)} n_c</b> to <b>{d.uHigh.toFixed(2)} n_c</b> at x = <b>{xc} λ</b> (n_c was at {L_STOPS[li]} λ)
            </span>
            <span>
              scale length at n_c: <b>{L_STOPS[li]} λ → {Number.isFinite(d.scaleAtNc) ? (d.scaleAtNc / TWO_PI).toFixed(2) : '…'} λ</b>
            </span>
            <span>
              jump in plasma pressure across the step <b className={okStep ? 'ok' : ''}>{dU.toFixed(3)}</b> n_c kT = light pressure at the last antinode{' '}
              <b>{d.peakPressure.toFixed(3)}</b> − light left beyond the step <b>{d.shelfPressure.toFixed(3)}</b> + ramp support <b>{d.support.toFixed(3)}</b>
            </span>
            <span>
              total push on the plasma <b className={okPush ? 'ok' : ''}>{d.totalPush.toFixed(4)}</b> vs 2I/c = <b>{(2 * sol.P).toFixed(4)}</b> n_c kT
            </span>
            <span>
              pressure balance holds to <b className={d.balanceError < 2e-3 ? 'ok' : ''}>{d.balanceError.toExponential(1)}</b> n_c kT; light re-solved in the final profile differs by{' '}
              <b className={sol.lin < 0.02 ? 'ok' : ''}>{(sol.lin * 100).toFixed(2)}%</b>
            </span>
          </>
        ) : (
          <span>No static profile reflects this light: the light pressure pushes through the ramp (the start of hole boring).</span>
        )}
      </div>
      <div className="controls">
        <Slider label="Light pressure P = (I/c)/(n_c kT)" value={P} min={0} max={P_MAX} step={0.005} onChange={(v) => setP(v)} fmt={(v) => v.toFixed(3)} />
        <Slider
          label="Original ramp length L (edge to n_c)"
          value={li}
          min={0}
          max={L_STOPS.length - 1}
          step={1}
          onChange={setLi}
          fmt={(i) => `${L_STOPS[i]} λ (k₀L = ${(TWO_PI * L_STOPS[i]).toFixed(0)})`}
        />
      </div>
    </SimFrame>
  )
}
