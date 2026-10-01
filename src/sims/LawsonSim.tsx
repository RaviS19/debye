// A11: Lawson explorer. The n τ_E vs T plane for a 50:50 D–T plasma with the ignition, Q = 10, Q = 1 and
// Q = 0.1 contours computed from the Bosch–Hale reactivity. Drag the operating point (or use the sliders)
// and read off Q and the power balance per cubic metre.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { sci } from '../physics/constants'
import { bremsstrahlung, E_ALPHA, E_FUS, fusionPower, keV, nTauForQ, nTauForQBrems, qAt, qAtBrems, tripleIgnition } from '../physics/fusion'
import { SimFrame, Slider } from './SimFrame'

const T0 = 1
const T1 = 100
const Y0 = 1e18
const Y1 = 1e23
const L10 = Math.log10

const CONTOURS: { Q: number; label: string; color: string; dash?: boolean; width: number }[] = [
  { Q: Infinity, label: 'ignition (Q = ∞)', color: COLORS.cyan, width: 2.4 },
  { Q: 10, label: 'Q = 10', color: COLORS.violet, dash: true, width: 1.6 },
  { Q: 1, label: 'Q = 1 (breakeven)', color: COLORS.magenta, width: 2 },
  { Q: 0.1, label: 'Q = 0.1', color: COLORS.text, dash: true, width: 1.2 },
]

function fmtQ(q: number) {
  if (!isFinite(q)) return '∞ (ignited)'
  if (q < 0.01) return q.toExponential(1)
  return q < 10 ? q.toFixed(2) : q.toFixed(1)
}

export function LawsonSim() {
  const [running, setRunning] = useState(true)
  const [T, setT] = useState(15)
  const [nTau, setNTau] = useState(1e20)
  const [n, setN] = useState(1e20)
  const [brems, setBrems] = useState(false)
  const drag = useRef(false)
  const pulse = useRef(0)

  const narrowInit = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrowInit ? 0.95 : 0.56, undefined, 480)

  const geom = (c: HTMLCanvasElement) => {
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const narrow = c.clientWidth < 560
    const padL = (narrow ? 44 : 56) * u
    const padB = 34 * u
    const padT = 10 * u
    const padR = 10 * u
    return { W, H, u, narrow, x0: padL, y0: padT, w: W - padL - padR, h: H - padT - padB }
  }

  const contour = (Tk: number, Q: number) => (brems ? nTauForQBrems(Tk, Q) : nTauForQ(Tk, Q))
  const Qnow = brems ? qAtBrems(T, nTau) : qAt(T, nTau)

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const g = geom(c)
    const { u } = g
    const X = (t: number) => g.x0 + ((L10(t) - L10(T0)) / (L10(T1) - L10(T0))) * g.w
    const Y = (v: number) => g.y0 + (1 - (L10(v) - L10(Y0)) / (L10(Y1) - L10(Y0))) * g.h
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, g.W, g.H)
    const fs = (g.narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    // grid
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    for (const t of [1, 2, 5, 10, 20, 50, 100]) {
      ctx.beginPath()
      ctx.moveTo(X(t), g.y0)
      ctx.lineTo(X(t), g.y0 + g.h)
      ctx.stroke()
      ctx.fillText(String(t), X(t), g.y0 + g.h + 13 * u)
    }
    ctx.fillText('temperature T (keV)', g.x0 + g.w / 2, g.y0 + g.h + 27 * u)
    ctx.textAlign = 'right'
    for (let e = 18; e <= 23; e++) {
      ctx.beginPath()
      ctx.moveTo(g.x0, Y(10 ** e))
      ctx.lineTo(g.x0 + g.w, Y(10 ** e))
      ctx.stroke()
      ctx.fillText('10' + String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]), g.x0 - 5 * u, Y(10 ** e) + 4 * u)
    }
    ctx.save()
    ctx.translate(12 * u, g.y0 + g.h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('n τ_E (s/m³)', 0, 0)
    ctx.restore()
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(g.x0, g.y0, g.w, g.h)

    ctx.save()
    ctx.beginPath()
    ctx.rect(g.x0, g.y0, g.w, g.h)
    ctx.clip()
    // ignited region
    const NS = 160
    ctx.fillStyle = 'rgba(74,222,128,0.07)'
    ctx.beginPath()
    let started = false
    for (let k = 0; k <= NS; k++) {
      const t = 10 ** (L10(T0) + ((L10(T1) - L10(T0)) * k) / NS)
      const v = contour(t, Infinity)
      if (!isFinite(v)) continue
      const yy = Math.max(g.y0 - 10, Y(Math.min(v, Y1 * 10)))
      if (!started) {
        ctx.moveTo(X(t), g.y0)
        started = true
      }
      ctx.lineTo(X(t), yy)
    }
    ctx.lineTo(X(T1), g.y0)
    ctx.closePath()
    ctx.fill()
    // contours
    for (const cv of CONTOURS) {
      if (cv.dash) ctx.setLineDash([6 * u, 5 * u])
      glowStroke(ctx, cv.color, cv.width * u, () => {
        let pen = false
        for (let k = 0; k <= NS; k++) {
          const t = 10 ** (L10(T0) + ((L10(T1) - L10(T0)) * k) / NS)
          const v = contour(t, cv.Q)
          if (!isFinite(v) || v > Y1 * 50) {
            pen = false
            continue
          }
          if (pen) ctx.lineTo(X(t), Y(v))
          else ctx.moveTo(X(t), Y(v))
          pen = true
        }
      })
      ctx.setLineDash([])
    }
    // contour labels at the right edge
    ctx.textAlign = 'right'
    for (const cv of CONTOURS) {
      const v = contour(T1, cv.Q)
      if (!isFinite(v)) continue
      ctx.fillStyle = cv.color
      const dy = cv.Q === 10 ? 15 * u : -7 * u // Q = 10 runs close under ignition: label it from below
      ctx.fillText(g.narrow ? cv.label.replace(' (breakeven)', '').replace('ignition (Q = ∞)', 'Q = ∞') : cv.label, g.x0 + g.w - 4 * u, Y(v) + dy)
    }
    // minimum of the ignition triple product
    if (!brems) {
      const Tm = 13.54
      ctx.fillStyle = COLORS.lime
      ctx.beginPath()
      ctx.arc(X(Tm), Y(contour(Tm, Infinity)), 3 * u, 0, 7)
      ctx.fill()
      ctx.textAlign = 'left'
      ctx.textAlign = 'right'
      if (!g.narrow) ctx.fillText('min n T τ_E', X(Tm) - 6 * u, Y(contour(Tm, Infinity)) - 6 * u)
    }
    // operating point
    const px = X(T)
    const py = Y(nTau)
    ctx.strokeStyle = 'rgba(251,191,36,0.45)'
    ctx.setLineDash([3 * u, 4 * u])
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px, g.y0 + g.h)
    ctx.moveTo(px, py)
    ctx.lineTo(g.x0, py)
    ctx.stroke()
    ctx.setLineDash([])
    const r = (7 + 1.5 * Math.sin(pulse.current)) * u
    ctx.fillStyle = COLORS.amber
    ctx.shadowColor = COLORS.amber
    ctx.shadowBlur = 16 * u
    ctx.beginPath()
    ctx.arc(px, py, r, 0, 7)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(px, py, 2.5 * u, 0, 7)
    ctx.fill()
    ctx.font = `bold ${fs * 1.1}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.amber
    ctx.textAlign = px > g.x0 + g.w * 0.7 ? 'right' : 'left'
    const lx = px + (ctx.textAlign === 'right' ? -12 : 12) * u
    ctx.fillText(`Q = ${fmtQ(Qnow)}`, lx, py - 10 * u)
    ctx.restore()
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'left'
    ctx.fillText(g.narrow ? 'drag the point' : 'drag the amber point', g.x0 + 6 * u, g.y0 + 14 * u)
  }

  const setFromPointer = (e: React.PointerEvent) => {
    const c = canvas.current
    if (!c) return
    const g = geom(c)
    const r = c.getBoundingClientRect()
    const fx = ((e.clientX - r.left) * g.u - g.x0) / g.w
    const fy = ((e.clientY - r.top) * g.u - g.y0) / g.h
    const t = 10 ** (L10(T0) + Math.min(1, Math.max(0, fx)) * (L10(T1) - L10(T0)))
    const v = 10 ** (L10(Y1) - Math.min(1, Math.max(0, fy)) * (L10(Y1) - L10(Y0)))
    setT(+t.toPrecision(3))
    setNTau(+v.toPrecision(3))
  }

  useAnimation(
    canvas,
    (dt) => {
      pulse.current += dt * 0.004
      draw()
    },
    running,
  )

  const Pf = fusionPower(n, T)
  const Pa = (Pf * E_ALPHA) / E_FUS
  const Wth = 3 * n * T * keV
  const tauE = nTau / n
  const Pcond = Wth / tauE
  const Pbr = brems ? bremsstrahlung(n, T) : 0
  const Pext = Pcond + Pbr - Pa
  const MW = (x: number) => (Math.abs(x) >= 100e6 ? (x / 1e6).toFixed(0) : Math.abs(x) >= 1e6 ? (x / 1e6).toFixed(2) : (x / 1e6).toPrecision(2))
  const ign = contour(T, Infinity)
  return (
    <SimFrame
      id="lawson"
      title="Lawson explorer"
      running={running}
      setRunning={setRunning}
      onReset={() => { setT(15); setNTau(1e20); setN(1e20); setBrems(false) }}
      hint="Each curve is computed from the Bosch–Hale D–T reactivity and steady-state power balance (thermal energy 3nkT, T_e = T_i). Drag the amber point: Q is fusion power divided by the heating you must supply. Above the cyan curve the alphas alone keep the plasma hot. Switch on bremsstrahlung and watch ignition become impossible below about 4.3 keV. The density slider only sets the power per cubic metre; Q depends on n and τ_E only through their product."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <button className="btn small" onClick={() => setNTau(+nTauForQ(T, 1).toPrecision(3))}>Put on Q = 1</button>
        <button className="btn small" onClick={() => setNTau(+(ign * 1.0001).toPrecision(4))} disabled={!isFinite(ign)}>Put on ignition</button>
        <button className={`btn small ${brems ? 'primary' : ''}`} onClick={() => setBrems(!brems)}>Bremsstrahlung {brems ? 'on' : 'off'}</button>
      </div>
      <canvas
        ref={canvas}
        className="sim"
        style={{ cursor: 'crosshair' }}
        aria-label="Lawson diagram: n tau_E versus temperature"
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          drag.current = true
          setFromPointer(e)
        }}
        onPointerMove={(e) => drag.current && setFromPointer(e)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
      />
      <div className="readouts">
        <span>Q = <b className={Qnow >= 1 ? 'ok' : ''}>{fmtQ(Qnow)}</b></span>
        <span>n T τ_E = <b>{sci(nTau * T)}</b> keV·s/m³</span>
        <span>ignition needs <b>{isFinite(ign) ? sci(ign * T) : 'impossible'}</b> here; minimum <b>{sci(tripleIgnition(13.54))}</b> at 13.5 keV (no radiation)</span>
      </div>
      <div className="readouts">
        <span>per m³, in MW:</span>
        <span>fusion <b>{MW(Pf)}</b></span>
        <span>alpha heating <b>{MW(Pa)}</b></span>
        <span>transport loss 3nkT/τ_E <b>{MW(Pcond)}</b></span>
        {brems && <span>radiation <b>{MW(Pbr)}</b></span>}
        <span>heating needed <b className={Pext <= 0 ? 'ok' : ''}>{Pext <= 0 ? 'none' : MW(Pext)}</b></span>
        <span>τ_E = <b>{sci(tauE)}</b> s</span>
      </div>
      <div className="controls">
        <Slider label="Temperature T (keV)" value={L10(T)} min={0} max={2} step={0.005} onChange={(v) => setT(+(10 ** v).toPrecision(3))} fmt={() => T.toPrecision(3)} />
        <Slider label="Confinement n τ_E (s/m³)" value={L10(nTau)} min={18} max={23} step={0.01} onChange={(v) => setNTau(+(10 ** v).toPrecision(3))} fmt={() => sci(nTau)} />
        <Slider label="Density n (m⁻³)" value={L10(n)} min={19} max={21} step={0.01} onChange={(v) => setN(+(10 ** v).toPrecision(3))} fmt={() => sci(n)} />
      </div>
    </SimFrame>
  )
}
