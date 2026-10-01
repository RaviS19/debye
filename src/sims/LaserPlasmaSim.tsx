// A6: a laser (or radio wave) launched into a plasma. 1D FDTD with a cold-electron fluid current.
// Below the peak plasma frequency the wave turns around at the critical layer n = n_c and leaves an
// evanescent tail; above it, the wave is transmitted with a longer wavelength.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  amplitudeAt,
  createLaser,
  criticalX,
  decayLength,
  fresnelR,
  LASER,
  laserProfile,
  plasmaK,
  reflectance,
  settleTime,
  skinDepth,
  stepEM,
  turningPoint,
  wavenumber,
  type EMGrid,
  type Profile,
} from '../physics/emwave'
import { SimFrame, Slider } from './SimFrame'

const VIEW = LASER.view // c/ω_p shown; the absorbing layer beyond it is hidden
const EMAX = 3.6 // field scale (incident amplitude = 1)
// slider stops for ω/ω_p. 0.95–1.05 are skipped: within 5% of the plateau cutoff the group velocity is so
// small that the steady state takes many hundreds of periods to form, and the readouts would never settle.
const FREQS = Array.from({ length: 33 }, (_, i) => +(0.4 + 0.05 * i).toFixed(2)).filter((w) => Math.abs(w - 1) > 0.06)

interface Meas {
  R: number
  xTurn: number
  decay: number
  lam: number
  ready: boolean
}

export function LaserPlasmaSim() {
  const [running, setRunning] = useState(true)
  const [omega, setOmega] = useState(0.7)
  const [profile, setProfile] = useState<Profile>('ramp')
  const [speed, setSpeed] = useState(3)
  const grid = useRef<EMGrid>(null!)
  if (!grid.current) grid.current = createLaser(0.7, 'ramp')
  const [meas, setMeas] = useState<Meas>({ R: NaN, xTurn: NaN, decay: NaN, lam: NaN, ready: false })
  const lastPeriod = useRef(0)
  const frame = useRef(0)
  const [t, setT] = useState(0)

  const restart = (w = omega, p = profile) => {
    grid.current = createLaser(w, p)
    lastPeriod.current = 0
    setMeas({ R: NaN, xTurn: NaN, decay: NaN, lam: NaN, ready: false })
    setT(0)
  }

  const prof = laserProfile(profile)
  const xc = criticalX(omega, profile)
  const over = omega < 1

  const canvas = useCanvas(typeof innerWidth !== 'undefined' && innerWidth < 560 ? 0.95 : 0.5)
  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const g = grid.current
    const narrow = c.clientWidth < 560
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const padL = 8 * u
    const padR = 8 * u
    const top = 24 * u
    const bot = H - 22 * u
    const X = (x: number) => padL + (x / VIEW) * (W - padL - padR)
    const mid = (top + bot) / 2
    const half = (bot - top) / 2
    const Yf = (e: number) => mid - (e / EMAX) * half
    const Yn = (n: number) => bot - n * (bot - top) * 0.82 // n / n_max

    // plasma density (fraction of the plateau density), shaded
    ctx.fillStyle = 'rgba(160,111,214,0.16)'
    ctx.beginPath()
    ctx.moveTo(X(0), bot)
    for (let k = 0; k <= 400; k++) {
      const x = (k / 400) * VIEW
      ctx.lineTo(X(x), Yn(prof(x)))
    }
    ctx.lineTo(X(VIEW), bot)
    ctx.closePath()
    ctx.fill()
    glowStroke(ctx, COLORS.violet, 1.5 * u, () => {
      for (let k = 0; k <= 400; k++) {
        const x = (k / 400) * VIEW
        if (k) ctx.lineTo(X(x), Yn(prof(x)))
        else ctx.moveTo(X(x), Yn(prof(x)))
      }
    })
    // critical density level n_c / n_max = ω²
    const ncLevel = omega * omega
    ctx.setLineDash([6 * u, 6 * u])
    ctx.strokeStyle = 'rgba(251,191,36,0.75)'
    ctx.lineWidth = 1.2 * u
    if (ncLevel < 1.2) {
      ctx.beginPath()
      ctx.moveTo(X(LASER.X0 - 2), Yn(ncLevel))
      ctx.lineTo(X(VIEW), Yn(ncLevel))
      ctx.stroke()
    }
    if (over) {
      ctx.beginPath()
      ctx.moveTo(X(xc), top)
      ctx.lineTo(X(xc), bot)
      ctx.stroke()
    }
    ctx.setLineDash([])
    // axis for E
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(X(0), mid)
    ctx.lineTo(X(VIEW), mid)
    ctx.stroke()

    // Left of the source plane the grid holds only the reflected wave (that is where R is
    // measured), so draw the fields from the source plane on.
    const iMax = Math.round(VIEW / g.dx)
    const stride = Math.max(1, Math.floor(iMax / (c.width / 1.5)))
    // steady-state envelope ±|a(x)| from the lock-in
    if (g.periods > 0) {
      for (const s of [1, -1]) {
        ctx.strokeStyle = 'rgba(244,114,182,0.7)'
        ctx.lineWidth = 1.2 * u
        ctx.beginPath()
        for (let i = g.src; i <= iMax; i += stride) {
          const y = Yf(s * Math.min(EMAX * 1.05, amplitudeAt(g, i)))
          if (i > g.src) ctx.lineTo(X(i * g.dx), y)
          else ctx.moveTo(X(i * g.dx), y)
        }
        ctx.stroke()
      }
    }
    // live field E_y(x, t)
    glowStroke(ctx, COLORS.cyan, 2 * u, () => {
      for (let i = g.src; i <= iMax; i += stride) {
        const y = Yf(Math.max(-EMAX * 1.05, Math.min(EMAX * 1.05, g.E[i])))
        if (i > g.src) ctx.lineTo(X(i * g.dx), y)
        else ctx.moveTo(X(i * g.dx), y)
      }
    })
    // source plane
    ctx.strokeStyle = 'rgba(143,255,255,0.35)'
    ctx.beginPath()
    ctx.moveTo(X(LASER.srcX), top)
    ctx.lineTo(X(LASER.srcX), bot)
    ctx.stroke()
    // measured turning point
    if (meas.ready && over && profile === 'ramp' && isFinite(meas.xTurn)) {
      ctx.fillStyle = COLORS.lime
      ctx.beginPath()
      ctx.moveTo(X(meas.xTurn), bot + 2 * u)
      ctx.lineTo(X(meas.xTurn) - 6 * u, bot + 12 * u)
      ctx.lineTo(X(meas.xTurn) + 6 * u, bot + 12 * u)
      ctx.closePath()
      ctx.fill()
    }
    // labels
    const fs = (narrow ? 10.5 : 11.5) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.glow
    ctx.textAlign = 'left'
    ctx.fillText(narrow ? 'laser →' : 'laser in →', X(LASER.srcX) + 4 * u, top - 8 * u)
    ctx.fillStyle = COLORS.violet
    ctx.textAlign = 'right'
    ctx.fillText(narrow ? 'n(x)' : 'plasma density n(x)', X(VIEW) - 4 * u, Yn(1) - 6 * u)
    ctx.fillStyle = COLORS.amber
    if (ncLevel < 1.2) {
      ctx.textAlign = 'left'
      const ly = Yn(ncLevel) - 5 * u
      ctx.fillText('n = n_c', X(LASER.X0 - 2), ly < top + 10 * u ? Yn(ncLevel) + 14 * u : ly)
    } else {
      ctx.textAlign = 'right'
      ctx.fillText(narrow ? 'n_c > n_max' : 'n_c above the plateau: transparent', X(VIEW) - 4 * u, top - 8 * u)
    }
    if (over) {
      ctx.textAlign = 'center'
      ctx.fillText('x_c', X(xc), top - 8 * u)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    for (let x = 0; x <= VIEW; x += narrow ? 20 : 10) {
      ctx.fillText(String(x), X(x) + (x === 0 ? 2 * u : -6 * u), H - 6 * u)
    }
    ctx.textAlign = 'right'
    ctx.fillText('x (c/ω_p)', X(VIEW) - 2 * u, H - 6 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.cyan
    ctx.fillText('E(x,t)', X(0) + 2 * u, top + 12 * u)
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('envelope', X(0) + 2 * u, top + 12 * u + fs * 1.3)
  }

  useAnimation(
    canvas,
    () => {
      const g = grid.current
      const n = 6 * speed
      for (let s = 0; s < n; s++) stepEM(g)
      if (g.periods !== lastPeriod.current) {
        lastPeriod.current = g.periods
        const ready = g.t > settleTime(omega, profile)
        const k = omega > 1 ? wavenumber(g, 40, 54) : NaN
        setMeas({
          R: reflectance(g),
          xTurn: over && profile === 'ramp' ? turningPoint(g, LASER.X0) : NaN,
          decay: over && profile === 'edge' ? decayLength(g, LASER.X0 + 0.5, LASER.X0 + Math.min(3, 3 * skinDepth(omega))) : NaN,
          lam: (2 * Math.PI) / k,
          ready,
        })
      }
      if (++frame.current % 6 === 0) setT(g.t)
      draw()
    },
    running,
  )

  // theory for the readouts
  const Rth = profile === 'edge' ? fresnelR(omega) : over ? 1 : 0
  const lamTh = (2 * Math.PI) / plasmaK(omega)
  const dTh = skinDepth(omega)
  const pct = (v: number) => (isFinite(v) ? `${(Math.min(v, 9.99) * 100).toFixed(1)}%` : '…')
  const okR = meas.ready && Math.abs(meas.R - Rth) < 0.03
  const show = (v: number, d = 2) => (meas.ready && isFinite(v) ? v.toFixed(d) : '…')

  return (
    <SimFrame
      id="laser-plasma"
      title="Light meets a plasma (1D FDTD)"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint="A real Maxwell solver: the cyan line is E(x,t), the pink line is its steady-state envelope, the violet area is the plasma density. Units: ω_p is the plateau plasma frequency, lengths in c/ω_p. Lower the laser frequency below ω_p and watch the wave stop where n = n_c and reflect, with a short evanescent tail. The field swells just before the turning point, where the wave slows down. The exact field in a linear ramp is an Airy function, which has fallen to 0.66 of its last peak exactly at n = n_c; the lime marker is where the simulated field does that. Switch to a sharp edge to measure the skin depth. The readouts appear once the steady state has formed, which takes longer the closer ω is to ω_p (the wave slows down there)."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className={`btn small ${profile === 'ramp' ? 'primary' : ''}`} onClick={() => { setProfile('ramp'); restart(omega, 'ramp') }}>Density ramp</button>
        <button className={`btn small ${profile === 'edge' ? 'primary' : ''}`} onClick={() => { setProfile('edge'); restart(omega, 'edge') }}>Sharp edge</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Electromagnetic wave entering a plasma" />
      <div className="readouts">
        <span>ω/ω_p = <b>{omega.toFixed(2)}</b>, so n_c = <b>{(omega * omega).toFixed(2)} n_max</b></span>
        <span>
          reflected: <b className={okR ? 'ok' : ''}>{meas.ready ? pct(meas.R) : '…'}</b> (theory {pct(Rth)}{profile === 'edge' && !over ? ', Fresnel' : ''})
        </span>
        {over && profile === 'ramp' && (
          <span>
            turning point: <b className={meas.ready && Math.abs(meas.xTurn - xc) < 0.3 ? 'ok' : ''}>{show(meas.xTurn, 2)}</b> vs n = n_c at <b>{xc.toFixed(2)}</b> c/ω_p
          </span>
        )}
        {over && profile === 'edge' && (
          <span>
            decay length: <b className={meas.ready && Math.abs(meas.decay / dTh - 1) < 0.04 ? 'ok' : ''}>{show(meas.decay, 3)}</b> vs c/√(ω_p²−ω²) = <b>{dTh.toFixed(3)}</b> c/ω_p
          </span>
        )}
        {!over && (
          <span>
            wavelength in plasma: <b className={meas.ready && Math.abs(meas.lam / lamTh - 1) < 0.02 ? 'ok' : ''}>{show(meas.lam, 2)}</b> vs 2πc/√(ω²−ω_p²) = <b>{lamTh.toFixed(2)}</b>
          </span>
        )}
        <span>t = <b>{t.toFixed(0)}</b> /ω_p</span>
      </div>
      <div className="controls">
        <Slider
          label="Laser frequency ω / ω_p(plateau)"
          value={FREQS.indexOf(omega)}
          min={0}
          max={FREQS.length - 1}
          step={1}
          onChange={(i) => { setOmega(FREQS[i]); restart(FREQS[i]) }}
          fmt={(i) => FREQS[i].toFixed(2)}
        />
        <Slider label="Speed" value={speed} min={1} max={5} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
