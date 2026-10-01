// A10: "Why ions must enter fast". Integrate Poisson's equation through the sheath with Boltzmann electrons
// and cold ions that enter at Mach number M. For M ≥ 1 the potential falls monotonically to the wall; for
// M < 1 it bends back and oscillates, so no sheath can form. Ions are drawn rolling down the potential hill.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { mp } from '../physics/constants'
import {
  electronDensity,
  floatingPotential,
  integrateSheath,
  ionDensity,
  isMonotonic,
  linearRate,
  mAr,
  mD,
  measuredGrowth,
  measuredWavelength,
  sheathDrop,
} from '../physics/sheath'
import { SimFrame, Slider } from './SimFrame'

const XMAX = 30 // λ_D shown after the sheath edge
const PRE = 7 // width of the (not-to-scale) presheath strip, in the same display units
const CHI0 = 0.05 // small potential drop at the sheath edge where every profile starts
const H = 0.02 // integration step, λ_D
const NION = 90

const SPECIES = {
  H: { label: 'H⁺', m: mp },
  D: { label: 'D⁺', m: mD },
  Ar: { label: 'Ar⁺', m: mAr },
} as const
type Sp = keyof typeof SPECIES

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function niceStep(span: number, n: number) {
  const s0 = span / n
  const mag = 10 ** Math.floor(Math.log10(s0))
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? mag * 10
}

export function SheathSim() {
  const [running, setRunning] = useState(true)
  const [M, setM] = useState(1.2)
  const [sp, setSp] = useState<Sp>('H')
  const ions = useRef<{ x: number; j: number }[]>([])
  const spawn = useRef(0)

  const sim = useMemo(() => {
    const Mi = SPECIES[sp].m
    const chiWall = sheathDrop(Mi, M)
    const prof = integrateSheath(M, { chi0: CHI0, xMax: XMAX, h: H, chiWall })
    const mono = isMonotonic(prof)
    // small-amplitude run for the linear-theory check
    const lin = integrateSheath(M, { chi0: 1e-4, xMax: 160, h: 0.04 })
    const measured = M > 1 ? measuredGrowth(lin) : measuredWavelength(lin)
    const theory = M > 1 ? linearRate(M) : (2 * Math.PI) / linearRate(M)
    return { Mi, chiWall, prof, mono, measured, theory, pre: (M * M) / 2 }
  }, [M, sp])

  const reset = () => {
    ions.current = []
    spawn.current = 0
  }

  const narrowInit = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrowInit ? 1.55 : 0.6, undefined, narrowInit ? 640 : 480)

  const chiAt = (x: number) => {
    const p = sim.prof
    const i = Math.min(p.n - 1, Math.max(0, x / H))
    const i0 = Math.floor(i)
    const i1 = Math.min(p.n - 1, i0 + 1)
    const f = i - i0
    return p.chi[i0] * (1 - f) + p.chi[i1] * f
  }
  const xEnd = () => sim.prof.x[sim.prof.n - 1]

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const Hh = c.height
    const u = W / c.clientWidth
    const narrow = c.clientWidth < 560
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, Hh)
    const fs = (narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const padL = 40 * u
    const padB = 34 * u
    let rP: Rect
    let rN: Rect
    let rW: Rect
    if (narrow) {
      const w = W - padL - 8 * u
      rP = { x: padL, y: 16 * u, w, h: Hh * 0.35 }
      rN = { x: padL, y: rP.y + rP.h + 6 * u, w, h: Hh * 0.15 }
      const wy = rN.y + rN.h + padB + 18 * u
      rW = { x: padL, y: wy, w, h: Hh - wy - 30 * u }
    } else {
      const lw = W * 0.63
      rP = { x: padL, y: 18 * u, w: lw - padL, h: Hh * 0.6 - 24 * u }
      rN = { x: padL, y: Hh * 0.6, w: lw - padL, h: Hh * 0.4 - padB }
      rW = { x: lw + padL + 4 * u, y: 36 * u, w: W - lw - padL - 14 * u, h: Hh - 36 * u - padB }
    }
    const p = sim.prof
    const pre = sim.pre
    const xe = xEnd()
    const preEnd = pre + p.chi[0] // schematic presheath ends where the integrated profile starts (no step at x = 0)

    // ---------- potential panel ----------
    let lo = 0
    let hi = 0
    for (let i = 0; i < p.n; i++) {
      const v = -pre - p.chi[i]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    const span = hi - lo || 1
    const yMin = lo - 0.12 * span
    const yMax = hi + 0.1 * span
    const X = (x: number) => rP.x + ((x + PRE) / (XMAX + PRE)) * rP.w
    const Y = (v: number) => rP.y + ((yMax - v) / (yMax - yMin)) * rP.h
    // presheath strip
    ctx.fillStyle = 'rgba(160,111,214,0.08)'
    ctx.fillRect(X(-PRE), rP.y, X(0) - X(-PRE), rP.h)
    // grid + y ticks
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    const st = niceStep(yMax - yMin, narrow ? 4 : 5)
    for (let t = Math.ceil(yMin / st) * st; t <= yMax + 1e-9; t += st) {
      ctx.beginPath()
      ctx.moveTo(rP.x, Y(t))
      ctx.lineTo(rP.x + rP.w, Y(t))
      ctx.stroke()
      ctx.fillText(Math.abs(t) < st * 1e-6 ? '0' : +t.toPrecision(3) + '', rP.x - 5 * u, Y(t) + 4 * u)
    }
    ctx.textAlign = 'center'
    for (let t = 0; t <= XMAX; t += narrow ? 10 : 5) {
      ctx.beginPath()
      ctx.moveTo(X(t), rP.y)
      ctx.lineTo(X(t), rP.y + rP.h)
      ctx.stroke()
      ctx.fillText(String(t), X(t), rN.y + rN.h + 13 * u)
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(rP.x, rP.y, rP.w, rP.h)
    // sheath edge
    ctx.setLineDash([4 * u, 4 * u])
    ctx.strokeStyle = COLORS.violet
    ctx.beginPath()
    ctx.moveTo(X(0), rP.y)
    ctx.lineTo(X(0), rN.y + rN.h)
    ctx.stroke()
    ctx.setLineDash([])
    // wall
    if (p.reachedWall) {
      ctx.fillStyle = 'rgba(251,191,36,0.22)'
      ctx.fillRect(X(xe), rP.y, rP.x + rP.w - X(xe), rP.h)
      ctx.fillRect(X(xe), rN.y, rN.x + rN.w - X(xe), rN.h)
      ctx.fillStyle = COLORS.amber
      ctx.fillRect(X(xe) - 1.5 * u, rP.y, 3 * u, rP.h)
      ctx.fillRect(X(xe) - 1.5 * u, rN.y, 3 * u, rN.h)
    }
    // potential curve: presheath (schematic) then the integrated sheath
    glowStroke(ctx, COLORS.cyan, 2.2 * u, () => {
      for (let k = 0; k <= 40; k++) {
        const s = k / 40
        const v = -preEnd * s * s
        if (k) ctx.lineTo(X(-PRE + s * PRE), Y(v))
        else ctx.moveTo(X(-PRE), Y(v))
      }
      for (let i = 0; i < p.n; i += 2) ctx.lineTo(X(p.x[i]), Y(-pre - p.chi[i]))
      ctx.lineTo(X(xe), Y(-pre - p.chi[p.n - 1]))
    })
    // ions rolling down the hill
    ctx.fillStyle = COLORS.magenta
    ctx.shadowColor = COLORS.magenta
    ctx.shadowBlur = 6 * u
    for (const ion of ions.current) {
      let v: number
      if (ion.x < 0) {
        const s = (ion.x + PRE) / PRE
        v = -preEnd * s * s
      } else v = -pre - chiAt(ion.x)
      ctx.beginPath()
      ctx.arc(X(ion.x), Y(v) - (3 + ion.j * 4) * u, 2.4 * u, 0, 7)
      ctx.fill()
    }
    ctx.shadowBlur = 0
    // labels
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    ctx.fillText('potential eφ/kT_e', rP.x, rP.y - 6 * u)
    ctx.fillStyle = COLORS.violet
    ctx.fillText(narrow ? 'presheath' : 'presheath (≫ λ_D, not to scale)', X(-PRE) + 3 * u, rP.y + rP.h - 6 * u)
    if (p.reachedWall) {
      ctx.fillStyle = COLORS.amber
      ctx.textAlign = 'right'
      ctx.fillText('wall', rP.x + rP.w - 4 * u, rP.y + 14 * u)
    } else if (!sim.mono) {
      ctx.fillStyle = COLORS.red
      ctx.textAlign = 'right'
      ctx.fillText('bends back: no sheath (𝓜 < 1)', rP.x + rP.w - 6 * u, rP.y + 14 * u)
    }
    ctx.save()
    ctx.translate(12 * u, rP.y + rP.h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    ctx.fillText('eφ / kT_e', 0, 0)
    ctx.restore()

    // ---------- densities along x ----------
    let nlo = 1
    let nhi = 1
    for (let i = 0; i < p.n; i++) {
      const a = ionDensity(p.chi[i], M)
      const b = electronDensity(p.chi[i])
      nlo = Math.min(nlo, a, b)
      nhi = Math.max(nhi, a, b)
    }
    const nsp = Math.max(nhi - nlo, 0.02)
    const n0 = Math.max(0, nlo - 0.1 * nsp)
    const n1 = nhi + 0.12 * nsp
    const YN = (v: number) => rN.y + ((n1 - v) / (n1 - n0)) * rN.h
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(rN.x, rN.y, rN.w, rN.h)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    const nst = niceStep(n1 - n0, 2)
    for (let t = Math.ceil(n0 / nst) * nst; t <= n1 + 1e-9; t += nst) ctx.fillText(+t.toPrecision(3) + '', rN.x - 5 * u, YN(t) + 4 * u)
    // net charge shading
    for (let i = 0; i + 2 < p.n; i += 2) {
      const a = ionDensity(p.chi[i], M)
      const b = electronDensity(p.chi[i])
      ctx.fillStyle = a >= b ? 'rgba(74,222,128,0.28)' : 'rgba(251,95,95,0.35)'
      const x0 = X(p.x[i])
      ctx.fillRect(x0, Math.min(YN(a), YN(b)), X(p.x[i + 2]) - x0 + u, Math.abs(YN(a) - YN(b)))
    }
    for (const [col, f] of [[COLORS.magenta, (ch: number) => ionDensity(ch, M)], [COLORS.cyan, electronDensity]] as const) {
      glowStroke(ctx, col, 1.6 * u, () => {
        for (let i = 0; i < p.n; i += 2) {
          if (i) ctx.lineTo(X(p.x[i]), YN(f(p.chi[i])))
          else ctx.moveTo(X(p.x[i]), YN(f(p.chi[i])))
        }
      })
    }
    ctx.textAlign = 'left'
    if (!narrow) {
      ctx.fillStyle = COLORS.violet
      ctx.fillText(`n_s ≈ ${Math.exp(-pre).toFixed(2)} n₀`, X(-PRE) + 3 * u, rN.y + 14 * u)
    }
    // labels in the empty presheath strip of this panel, clear of the curves
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('n_i', X(-PRE) + 3 * u, rN.y + rN.h - 6 * u)
    ctx.fillStyle = COLORS.cyan
    ctx.fillText('n_e', X(-PRE) + 22 * u, rN.y + rN.h - 6 * u)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.fillText('x / λ_D from the sheath edge', (X(0) + rN.x + rN.w) / 2, rN.y + rN.h + 27 * u)

    // ---------- why panel: n_i and n_e vs potential ----------
    const CH = 4
    const XW = (ch: number) => rW.x + (ch / CH) * rW.w
    const YW = (n: number) => rW.y + (1 - n / 1.05) * rW.h
    ctx.strokeStyle = COLORS.grid
    for (let t = 1; t < CH; t++) {
      ctx.beginPath()
      ctx.moveTo(XW(t), rW.y)
      ctx.lineTo(XW(t), rW.y + rW.h)
      ctx.stroke()
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(rW.x, rW.y, rW.w, rW.h)
    const NS = 120
    for (let k = 0; k < NS; k++) {
      const ch = (k / NS) * CH
      const a = ionDensity(ch, M)
      const b = electronDensity(ch)
      ctx.fillStyle = a >= b ? 'rgba(74,222,128,0.28)' : 'rgba(251,95,95,0.4)'
      ctx.fillRect(XW(ch), Math.min(YW(a), YW(b)), rW.w / NS + 1.5 * u, Math.abs(YW(a) - YW(b)))
    }
    glowStroke(ctx, COLORS.cyan, 1.8 * u, () => {
      for (let k = 0; k <= NS; k++) {
        const ch = (k / NS) * CH
        if (k) ctx.lineTo(XW(ch), YW(electronDensity(ch)))
        else ctx.moveTo(XW(ch), YW(electronDensity(ch)))
      }
    })
    glowStroke(ctx, COLORS.magenta, 1.8 * u, () => {
      for (let k = 0; k <= NS; k++) {
        const ch = (k / NS) * CH
        if (k) ctx.lineTo(XW(ch), YW(ionDensity(ch, M)))
        else ctx.moveTo(XW(ch), YW(ionDensity(ch, M)))
      }
    })
    // for 𝓜 < 1: mark the range of small drops where electrons outnumber ions
    if (M < 1) {
      let chc = 0
      for (let k = 1; k <= 4000; k++) {
        const ch = (k / 4000) * CH
        if (ionDensity(ch, M) >= electronDensity(ch)) {
          chc = ch
          break
        }
      }
      ctx.fillStyle = COLORS.red
      ctx.fillRect(XW(0), rW.y + rW.h - 4 * u, XW(chc) - XW(0), 4 * u)
      ctx.textAlign = 'left'
      ctx.fillText(`red bar: n_i < n_e for χ < ${chc.toFixed(2)}`, rW.x + rW.w * 0.36, YW(0.93) + fs * 2.6)
    }
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    for (let t = 0; t <= CH; t++) ctx.fillText(String(t), XW(t), rW.y + rW.h + 14 * u)
    ctx.fillText('potential drop χ = −eφ/kT_e', rW.x + rW.w / 2, rW.y + rW.h + 27 * u)
    ctx.textAlign = 'right'
    ctx.fillText('1', rW.x - 5 * u, YW(1) + 4 * u)
    ctx.fillText('0', rW.x - 5 * u, YW(0) + 4 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    ctx.fillText('Why: density vs potential drop', rW.x, rW.y - 8 * u)
    ctx.fillStyle = COLORS.magenta
    ctx.fillText(`ions (1 + 2χ/𝓜²)^−½`, rW.x + rW.w * 0.36, YW(0.93))
    ctx.fillStyle = COLORS.cyan
    ctx.fillText('electrons e^−χ', rW.x + rW.w * 0.36, YW(0.93) + fs * 1.3)
    ctx.fillStyle = COLORS.lime
    ctx.fillText('n_i > n_e: φ keeps falling', rW.x + 4 * u, rW.y + rW.h - 8 * u - fs * 1.3)
    ctx.fillStyle = COLORS.red
    ctx.fillText('n_i < n_e: φ bends back', rW.x + 4 * u, rW.y + rW.h - 8 * u)
  }

  useAnimation(
    canvas,
    (dtMs) => {
      const dt = (dtMs / 1000) * 6 // 6 ion transit units (λ_D/c_s = 1/ω_pi) per second
      const xe = xEnd()
      spawn.current += dt
      if (spawn.current > 0.45 && ions.current.length < NION) {
        spawn.current = 0
        ions.current.push({ x: -PRE, j: Math.random() })
      }
      for (const ion of ions.current) {
        if (ion.x < 0) {
          const s = (ion.x + PRE) / PRE
          ion.x += Math.max(0.35, M * s) * dt * 1.4
        } else {
          const ch = chiAt(ion.x)
          ion.x += Math.sqrt(Math.max(0.05, M * M + 2 * ch)) * dt
        }
      }
      ions.current = ions.current.filter((i) => i.x < Math.min(xe, XMAX))
      draw()
    },
    running,
  )

  const predicted = M >= 1
  const lin = M > 1 ? 'growth rate κλ_D' : 'wavelength / λ_D'
  const marginal = Math.abs(M - 1) < 0.04
  const linOk = !marginal && Math.abs(sim.measured / sim.theory - 1) < 0.03
  const wallTotal = sim.pre + sim.chiWall
  return (
    <SimFrame
      id="sheath-bohm"
      title="Why ions must enter fast"
      running={running}
      setRunning={setRunning}
      onReset={reset}
      hint="Units: x in Debye lengths, potential in kT_e/e. Every profile starts with the same tiny drop (0.05 kT_e/e) at the sheath edge; Poisson’s equation decides the rest. Slide the entry Mach number 𝓜 below 1 and the potential bends back and oscillates (the vertical scale zooms in to show it): no sheath. In the right panel, see why: for 𝓜 < 1 the ions thin out faster than the electrons as the potential falls, leaving negative charge that pushes the potential back up."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {(Object.keys(SPECIES) as Sp[]).map((k) => (
          <button key={k} className={`btn small ${sp === k ? 'primary' : ''}`} onClick={() => { setSp(k); reset() }}>
            {SPECIES[k].label}
          </button>
        ))}
      </div>
      <canvas ref={canvas} className="sim" aria-label="Sheath potential simulation" />
      <div className="readouts">
        <span>Bohm (𝓜 ≥ 1): <b>{predicted ? 'sheath forms' : 'no sheath'}</b></span>
        <span>
          integrated: <b className={sim.mono === predicted ? 'ok' : ''}>{sim.mono ? (sim.prof.reachedWall ? `monotonic, wall at ${xEnd().toFixed(1)} λ_D` : 'monotonic') : 'bends back, oscillates'}</b>
        </span>
        <span>
          edge {lin}: <b className={linOk ? 'ok' : ''}>{isFinite(sim.measured) ? sim.measured.toFixed(3) : '…'}</b> vs theory <b>{marginal ? 'marginal (𝓜 ≈ 1)' : sim.theory.toFixed(3)}</b>
        </span>
        {M >= 1 && (
          <span>
            wall at this 𝓜 (flux balance): <b>{(-wallTotal).toFixed(2)} kT_e/e</b>
          </span>
        )}
      </div>
      <div className="readouts">
        <span>floating wall ½ln(2πm_e/M) − ½:</span>
        {(Object.keys(SPECIES) as Sp[]).map((k) => (
          <span key={k}>
            {SPECIES[k].label} <b className={k === sp ? 'ok' : ''}>{floatingPotential(SPECIES[k].m).toFixed(2)}</b>
          </span>
        ))}
      </div>
      <div className="controls">
        <Slider label="Ion entry Mach number 𝓜 = u₀ / c_s" value={M} min={0.5} max={2} step={0.01} onChange={(v) => { setM(v); reset() }} fmt={(v) => v.toFixed(2)} />
      </div>
    </SimFrame>
  )
}
