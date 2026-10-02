// B8: hot-tail distribution builder. A bi-Maxwellian electron distribution of your choosing, drawn on a log scale
// (each Maxwellian is a straight line), the energy carried by the hot group and by electrons above a "preheat" energy,
// and a hard x-ray detector that collects thin-target bremsstrahlung photon by photon. The slope of the collected
// spectrum, fitted over a window where the hot electrons dominate, returns T_hot.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  biMaxwellAbove,
  bremsChannels,
  bremsShares,
  bremsThin,
  crossoverEnergy,
  hotEnergyFraction,
  poisson,
  rng,
  slopeTemperature,
  slopeWindow,
} from '../physics/hotElectrons'
import { SimFrame, Slider } from './SimFrame'

const NCH = 72
const HV_LO = 4
const HV_HI = 400
const RATE = 6000 // photons per frame
const CAP = 4e6 // stop collecting here
const SUP = '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'
const supExp = (p: number) => String(p).replace(/[-0-9]/g, (d) => SUP['-0123456789'.indexOf(d)])
const fmtPct = (x: number) => (x >= 0.1 ? `${(100 * x).toFixed(1)}%` : x >= 1e-3 ? `${(100 * x).toFixed(2)}%` : `${(100 * x).toExponential(1)}%`)

interface Det {
  N: Float64Array // photons per channel
  total: number
}

export function HotTailSim() {
  const [running, setRunning] = useState(true)
  const [Tc, setTc] = useState(2)
  const [la, setLa] = useState(-2) // log10 of the hot fraction
  const [Th, setTh] = useState(50)
  const [Ep, setEp] = useState(100)
  const alpha = 10 ** la
  const hv = useMemo(() => bremsChannels(HV_LO, HV_HI, NCH), [])
  const share = useMemo(() => bremsShares(hv, alpha, Tc, Th, new Float64Array(NCH)), [hv, alpha, Tc, Th])
  const det = useRef<Det>({ N: new Float64Array(NCH), total: 0 })
  const rand = useRef(rng(2024))
  const [read, setRead] = useState<{ total: number; fit: { T: number; dT: number } | null }>({ total: 0, fit: null })
  const frame = useRef(0)

  const win = useMemo(() => slopeWindow(alpha, Tc, Th, HV_HI), [alpha, Tc, Th])
  const xMax = Math.min(HV_HI, Math.max(80, win.lo + 4 * Th))
  const winHi = Math.min(win.hi, xMax)
  const cross = crossoverEnergy(alpha, Tc, Th, 1.5)
  const eFrac = hotEnergyFraction(alpha, Tc, Th)
  const above = biMaxwellAbove(Ep, alpha, Tc, Th)

  const restart = () => {
    det.current = { N: new Float64Array(NCH), total: 0 }
    setRead({ total: 0, fit: null })
    setRunning(true)
  }
  const fitNow = () => {
    const d = det.current
    const sig = new Float64Array(NCH)
    for (let i = 0; i < NCH; i++) sig[i] = d.N[i] * hv[i]
    return win.lo < winHi ? slopeTemperature(hv, sig, win.lo, winHi, d.N) : null
  }

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.25 : 0.62, () => draw(), narrow ? 600 : 470)

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
    const padL = 42 * u
    const padR = 10 * u
    const pw = W - padL - padR
    const top1 = 22 * u
    const h1 = (H - 22 * u - 34 * u - 30 * u) * 0.5
    const top2 = top1 + h1 + 34 * u
    const h2 = h1
    const X = (E: number) => padL + (E / xMax) * pw
    const xTicks = () => {
      const step = xMax > 300 ? 100 : xMax > 150 ? 50 : xMax > 60 ? 20 : 10
      const out: number[] = []
      for (let v = 0; v <= xMax + 1e-9; v += step) out.push(v)
      return out
    }
    // ---------- panel 1: f(E) ----------
    const lo1 = -10
    const hi1 = 0
    const Y1 = (f: number) => top1 + ((hi1 - Math.log10(Math.max(f, 1e-30))) / (hi1 - lo1)) * h1
    const cold = (E: number) => (1 - alpha) * Math.exp(-E / Tc)
    const hot = (E: number) => alpha * (Tc / Th) ** 1.5 * Math.exp(-E / Th)
    // shade above E_p
    if (Ep < xMax) {
      ctx.fillStyle = 'rgba(251,95,95,0.10)'
      ctx.fillRect(X(Ep), top1, X(xMax) - X(Ep), h1)
    }
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    for (let p = lo1; p <= hi1; p += 2) {
      ctx.beginPath()
      ctx.moveTo(padL, Y1(10 ** p))
      ctx.lineTo(padL + pw, Y1(10 ** p))
      ctx.stroke()
      ctx.fillText(p === 0 ? '1' : `10${supExp(p)}`, padL - 4 * u, Y1(10 ** p) + 4 * u)
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, top1, pw, h1)
    ctx.clip()
    const curve = (fn: (E: number) => number) => {
      for (let k = 0; k <= 160; k++) {
        const E = (k / 160) * xMax
        if (k) ctx.lineTo(X(E), Y1(fn(E)))
        else ctx.moveTo(X(E), Y1(fn(E)))
      }
    }
    ctx.setLineDash([6 * u, 4 * u])
    ctx.lineWidth = 1.5 * u
    ctx.strokeStyle = COLORS.violet
    ctx.beginPath()
    curve(cold)
    ctx.stroke()
    ctx.strokeStyle = COLORS.magenta
    ctx.beginPath()
    curve(hot)
    ctx.stroke()
    ctx.setLineDash([])
    glowStroke(ctx, COLORS.cyan, 2 * u, () => curve((E) => cold(E) + hot(E)))
    if (cross > 0 && cross < xMax) {
      ctx.strokeStyle = 'rgba(251,191,36,0.8)'
      ctx.setLineDash([3 * u, 3 * u])
      ctx.beginPath()
      ctx.moveTo(X(cross), top1)
      ctx.lineTo(X(cross), top1 + h1)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (Ep < xMax) {
      ctx.strokeStyle = COLORS.red
      ctx.beginPath()
      ctx.moveTo(X(Ep), top1)
      ctx.lineTo(X(Ep), top1 + h1)
      ctx.stroke()
    }
    ctx.restore()
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, top1, pw, h1)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    for (const v of xTicks()) ctx.fillText(String(v), X(v), top1 + h1 + 13 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.cyan
    ctx.fillText(narrow ? 'electrons f(E)' : 'electrons: f(E) per unit velocity-space volume', padL, top1 - 7 * u)
    ctx.fillStyle = COLORS.violet
    ctx.fillText('cold', padL + (narrow ? 92 : 262) * u, top1 - 7 * u)
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('hot', padL + (narrow ? 124 : 296) * u, top1 - 7 * u)
    ctx.fillStyle = COLORS.red
    ctx.textAlign = 'right'
    if (Ep < xMax) ctx.fillText(narrow ? `> ${Ep} keV` : `above E_p = ${Ep} keV`, padL + pw - 4 * u, top1 + 14 * u)
    ctx.fillStyle = COLORS.amber
    if (cross > 0 && cross < xMax) {
      ctx.textAlign = X(cross) > padL + pw * 0.6 ? 'right' : 'left'
      ctx.fillText('crossover', X(cross) + (ctx.textAlign === 'left' ? 4 : -4) * u, top1 + h1 - 6 * u)
    }

    // ---------- panel 2: x-ray spectrum ----------
    const d = det.current
    // normalize to the expected signal in the first channel
    let s0 = 0
    for (let i = 0; i < NCH; i++) s0 = Math.max(s0, share[i])
    const lo2 = -8
    const hi2 = 0.3
    const Y2 = (f: number) => top2 + ((hi2 - Math.log10(Math.max(f, 1e-30))) / (hi2 - lo2)) * h2
    ctx.fillStyle = 'rgba(251,191,36,0.08)'
    if (win.lo < winHi) ctx.fillRect(X(win.lo), top2, X(winHi) - X(win.lo), h2)
    ctx.strokeStyle = COLORS.grid
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.text
    for (let p = lo2; p <= 0; p += 2) {
      ctx.beginPath()
      ctx.moveTo(padL, Y2(10 ** p))
      ctx.lineTo(padL + pw, Y2(10 ** p))
      ctx.stroke()
      ctx.fillText(p === 0 ? '1' : `10${supExp(p)}`, padL - 4 * u, Y2(10 ** p) + 4 * u)
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, top2, pw, h2)
    ctx.clip()
    // theory (thin target), normalized to the largest channel share
    ctx.setLineDash([6 * u, 4 * u])
    ctx.strokeStyle = 'rgba(232,234,246,0.5)'
    ctx.lineWidth = 1.3 * u
    ctx.beginPath()
    const b0 = bremsThin(hv[0], alpha, Tc, Th)
    for (let k = 0; k <= 160; k++) {
      const E = HV_LO + (k / 160) * (xMax - HV_LO)
      const y = Y2(bremsThin(E, alpha, Tc, Th) / b0)
      if (k) ctx.lineTo(X(E), y)
      else ctx.moveTo(X(E), y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    // measured: signal per channel N·hν, normalized the same way
    if (d.total > 0) {
      const norm = d.N[0] * hv[0] > 0 ? d.N[0] * hv[0] : 1
      ctx.fillStyle = COLORS.cyan
      for (let i = 0; i < NCH; i++) {
        if (hv[i] > xMax || d.N[i] <= 0) continue
        const y = Y2((d.N[i] * hv[i]) / norm)
        ctx.beginPath()
        ctx.arc(X(hv[i]), y, 2.2 * u, 0, 7)
        ctx.fill()
      }
      const f = read.fit
      if (f) {
        // fitted line through the data inside the window: anchor at the window's first populated channel
        let a = -1
        for (let i = 0; i < NCH; i++) if (hv[i] >= win.lo && d.N[i] > 0) { a = i; break }
        if (a >= 0) {
          const y0 = (d.N[a] * hv[a]) / norm
          glowStroke(ctx, COLORS.amber, 1.6 * u, () => {
            ctx.moveTo(X(hv[a]), Y2(y0))
            const E1 = winHi
            ctx.lineTo(X(E1), Y2(y0 * Math.exp(-(E1 - hv[a]) / f.T)))
          })
        }
      }
    }
    ctx.restore()
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, top2, pw, h2)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    for (const v of xTicks()) ctx.fillText(String(v), X(v), top2 + h2 + 13 * u)
    ctx.fillText('electron energy E, photon energy hν (keV)', padL + pw / 2, top2 + h2 + 25 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.cyan
    ctx.fillText(narrow ? 'x-ray signal' : 'x-ray detector: energy per channel', padL, top2 - 7 * u)
    ctx.fillStyle = 'rgba(232,234,246,0.7)'
    ctx.fillText('theory', padL + (narrow ? 72 : 196) * u, top2 - 7 * u)
    ctx.fillStyle = COLORS.amber
    ctx.fillText(narrow ? 'slope fit' : 'slope fit (shaded window)', padL + (narrow ? 116 : 246) * u, top2 - 7 * u)
  }

  useAnimation(
    canvas,
    () => {
      const d = det.current
      if (d.total < CAP) {
        const r = rand.current
        // photons arrive in proportion to the energy spectrum divided by hν
        let wsum = 0
        for (let i = 0; i < NCH; i++) wsum += share[i] / hv[i]
        for (let i = 0; i < NCH; i++) {
          const k = poisson((RATE * share[i]) / hv[i] / wsum, r)
          d.N[i] += k
          d.total += k
        }
      }
      if (++frame.current % 4 === 0) {
        setRead({ total: d.total, fit: fitNow() })
        if (d.total >= CAP) setRunning(false)
      }
      draw()
    },
    running,
  )

  const fit = read.fit
  const ok = fit && Math.abs(fit.T / Th - 1) < 0.03
  const change = (fn: () => void) => {
    fn()
    restart()
  }
  return (
    <SimFrame
      id="hot-tail"
      title="Hot-tail distribution builder"
      running={running}
      setRunning={(on) => (on && det.current.total >= CAP ? restart() : setRunning(on))}
      onReset={restart}
      hint="Energies in keV. Top: the electrons, cold (violet) and hot (magenta) Maxwellians and their sum; on a log scale each is a straight line of slope −1/T, so a hot fraction of 1% takes over beyond the amber crossover. Bottom: thin-target bremsstrahlung arriving photon by photon at a detector; the amber line is the slope fitted inside the shaded window, and its temperature should approach T_hot as photons accumulate. Try a hot fraction of 10⁻⁴: the hot electrons are invisible in the bulk, but they still own the high-energy x-rays and a good share of the energy above E_p."
    >
      <canvas ref={canvas} className="sim" aria-label="Two-temperature electron distribution and its bremsstrahlung spectrum" />
      <div className="readouts">
        <span>hot electrons: <b>{fmtPct(alpha)}</b> of the electrons carry <b>{fmtPct(eFrac)}</b> of the energy</span>
        <span>above E_p = {Ep} keV: <b>{fmtPct(above.number)}</b> of electrons, <b>{fmtPct(above.energy)}</b> of the energy</span>
        <span>crossover in f(E): <b>{cross > 0 ? `${cross.toFixed(1)} keV` : 'none (hot dominates)'}</b></span>
        <span>
          x-ray slope: measured T = <b className={ok ? 'ok' : ''}>{fit ? `${fit.T.toFixed(1)} ± ${fit.dT.toFixed(1)} keV` : read.total >= CAP ? 'too few photons in the window' : '…'}</b>, true T_hot = <b>{Th} keV</b>
        </span>
        <span>photons: <b>{read.total.toExponential(1).replace(/e\+?(-?\d+)/, (_, p) => `×10${supExp(+p)}`)}</b>, window {win.lo.toFixed(0)}–{winHi.toFixed(0)} keV</span>
      </div>
      <div className="controls">
        <Slider label="Cold temperature T_c" value={Tc} min={0.5} max={5} step={0.1} onChange={(v) => change(() => setTc(v))} fmt={(v) => `${v.toFixed(1)} keV`} />
        <Slider label="Hot fraction α (by number)" value={la} min={-4} max={-0.6} step={0.1} onChange={(v) => change(() => setLa(v))} fmt={(v) => fmtPct(10 ** v)} />
        <Slider label="Hot temperature T_hot" value={Th} min={10} max={200} step={1} onChange={(v) => change(() => setTh(v))} fmt={(v) => `${v} keV`} />
        <Slider label="Preheat energy E_p" value={Ep} min={10} max={300} step={5} onChange={setEp} fmt={(v) => `${v} keV`} />
      </div>
    </SimFrame>
  )
}
