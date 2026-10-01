// B2: inverse-bremsstrahlung absorption of laser light in a density ramp, solved as a full wave. The s-polarized
// wave equation E'' + k0²(ε − sin²θ)E = 0 with ε = 1 − (n/n_c)/(1 + iν/ω) and ν = ν_c n/n_c is integrated from
// the evanescent side out to vacuum (Numerov), split there into incident and reflected waves, and the absorbed
// fraction 1 − |r|² is compared with the WKB formula and with the integrated heating rate.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  EXP_CUT,
  absorptionFormula,
  absorptionParams,
  langdonAlpha,
  langdonFactor,
  solveAbsorption,
  type AbsorptionSetup,
} from '../physics/collisionalAbs'
import { columnMinMax, density, type Ramp, type RampKind } from '../physics/lightRamp'
import { SimFrame, Slider } from './SimFrame'

const TWO_PI = 2 * Math.PI
const LAMS = [1.053, 0.527, 0.351]
const LAM_LABEL = ['1053 nm (1ω)', '527 nm (2ω)', '351 nm (3ω)']
const LAM_COLORS = [COLORS.red, COLORS.lime, COLORS.violet]
const DOT_LG = Array.from({ length: 17 }, (_, i) => 12 + i * 0.25) // log10 I for the full-wave dots

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).replace('-', '⁻').replace(/\d/g, (d) => SUP[+d])
function sci(v: number, digits = 2): string {
  if (!isFinite(v) || v === 0) return String(v)
  let ex = Math.floor(Math.log10(Math.abs(v)))
  let ms = (v / 10 ** ex).toFixed(digits - 1)
  if (Math.abs(+ms) >= 10) {
    ex += 1
    ms = (v / 10 ** ex).toFixed(digits - 1)
  }
  return `${ms}×10${sup(ex)}`
}
const niceStep = (span: number, maxTicks: number) => {
  const raw = span / Math.max(1, maxTicks)
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p
  return 10 * p
}

export function AbsorptionRampSim() {
  const [running, setRunning] = useState(true)
  const [kind, setKind] = useState<RampKind>('linear')
  const [view, setView] = useState<'field' | 'intensity'>('field')
  const [langdon, setLangdon] = useState(false)
  const [li, setLi] = useState(0)
  const [Z, setZ] = useState(5)
  const [TkeV, setT] = useState(2)
  const [lgL, setLgL] = useState(2)
  const [theta, setTheta] = useState(0)
  const [lgI, setLgI] = useState(14)
  const Lum = Math.round(10 ** lgL)
  const I = 10 ** lgI
  const lam = LAMS[li]
  const setup: AbsorptionSetup = { lamUm: lam, TeV: TkeV * 1000, Z, Lum, thetaDeg: theta, kind, IWcm2: I, langdon }
  const p = absorptionParams(setup)
  const th = (theta * Math.PI) / 180
  const kx = Math.cos(th)

  const sol = useMemo(() => {
    const s = solveAbsorption(setup, p.k0L > 3000 ? 0.4 : 0.25)
    const n = s.n
    const cum = new Float64Array(n)
    let heatMax = 0
    for (let i = 1; i < n; i++) {
      cum[i] = cum[i - 1] + (0.5 * (s.heat[i] + s.heat[i - 1]) * (s.x[i] - s.x[i - 1])) / kx
      if (s.heat[i] > heatMax) heatMax = s.heat[i]
    }
    // zoom window: from ~14 Airy widths before the turning point to 3 after
    const xa = Math.max(s.x[0], s.xTurn - 14 * s.delta)
    const xb = Math.min(s.x[n - 1], s.xTurn + 3 * s.delta)
    let ia = 0
    while (ia < n - 1 && s.x[ia] < xa) ia++
    let ib = n - 1
    while (ib > 0 && s.x[ib] > xb) ib--
    let eMax = 0
    let hMaxWin = 0
    for (let i = ia; i <= ib; i++) {
      eMax = Math.max(eMax, Math.hypot(s.re[i], s.im[i]))
      hMaxWin = Math.max(hMaxWin, s.heat[i])
    }
    const ramp: Ramp = kind === 'linear' ? { kind, L: p.k0L } : { kind, L: p.k0L, ncut: EXP_CUT }
    return { s, cum, heatMax, xa, xb, ia, ib, eMax, hMaxWin, ramp }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.nucOverOmega, p.k0L, theta, kind])

  // full-wave dots for the absorption-vs-intensity view, filled in progressively: at most one per frame, and
  // after a slow one (long ramps take up to ~10 ms) skip frames so the average stays a few ms per frame
  const dots = useRef<{ key: string; A: (number | null)[]; next: number; wait: number }>({ key: '', A: [], next: 0, wait: 0 })
  const dotKey = `${li}:${Z}:${TkeV}:${Lum}:${theta}:${kind}:${langdon}`
  if (dots.current.key !== dotKey) dots.current = { key: dotKey, A: DOT_LG.map(() => null), next: 0, wait: 0 }
  const stepDots = (all: boolean) => {
    const d = dots.current
    if (!all && d.wait-- > 0) return
    do {
      if (d.next >= DOT_LG.length) return
      const t0 = performance.now()
      const w = solveAbsorption({ ...setup, IWcm2: 10 ** DOT_LG[d.next] }, 0.5, 2)
      d.A[d.next] = 1 - w.R
      d.next++
      d.wait = Math.floor((performance.now() - t0) / 3)
    } while (all)
  }

  const phase = useRef(0)
  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.3 : 0.6, undefined, 560)
  const layer = useRef<{ key: string; cv: HTMLCanvasElement } | null>(null)

  // µm measured from the critical surface
  const xc = kind === 'linear' ? p.k0L : 0
  const toUm = (x: number) => ((x - xc) * lam) / TWO_PI

  const geo = (W: number, H: number, u: number) => {
    const padL = 34 * u
    const padR = 10 * u
    const t1 = 24 * u
    const avail = H - t1 - 26 * u - 34 * u
    const b1 = t1 + avail * 0.4
    const t2 = b1 + 34 * u
    const b2 = H - 26 * u
    const { s, xa, xb } = sol
    const xL = s.x[0]
    const xR = Math.min(s.x[s.n - 1], s.xTurn + 4 * s.delta)
    const X1 = (x: number) => padL + ((x - xL) / (xR - xL)) * (W - padL - padR)
    const X2 = (x: number) => padL + ((x - xa) / (xb - xa)) * (W - padL - padR)
    const Y1 = (v: number) => b1 - (v / 1.15) * (b1 - t1)
    const mid2 = (t2 + b2) / 2
    const eScale = (0.46 * (b2 - t2)) / Math.max(1e-9, sol.eMax)
    const Y2 = (v: number) => mid2 - v * eScale
    return { padL, padR, t1, b1, t2, b2, xL, xR, X1, X2, Y1, Y2, mid2 }
  }

  const xTicks = (ctx: CanvasRenderingContext2D, x0: number, x1: number, X: (x: number) => number, y: number, W: number, padR: number, u: number, label: string) => {
    const a = toUm(x0)
    const b = toUm(x1)
    const st = niceStep(b - a, narrow ? 4 : 8)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    const lw = ctx.measureText(label).width
    for (let t = Math.ceil(a / st) * st; t <= b; t += st) {
      const px = X(x0 + ((t - a) / (b - a)) * (x1 - x0))
      if (px > W - padR - lw - 16 * u) continue
      ctx.fillText(String(+t.toPrecision(6)), px, y)
    }
    ctx.textAlign = 'right'
    ctx.fillText(label, W - padR, y)
  }

  const renderField = (W: number, H: number, u: number) => {
    const cv = layer.current?.cv ?? document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    const g = geo(W, H, u)
    const { padL, padR, t1, b1, t2, b2, xL, xR, X1, X2, Y1, Y2, mid2 } = g
    const { s, cum, heatMax, xa, xb, ia, ib, hMaxWin, ramp } = sol
    const fs = (narrow ? 10.5 : 11.5) * u
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    ctx.font = `${fs}px "PT Sans", sans-serif`
    // ===== top panel: the whole ramp =====
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    for (const v of [0, 0.5, 1]) {
      ctx.beginPath()
      ctx.moveTo(padL, Y1(v))
      ctx.lineTo(W - padR, Y1(v))
      ctx.stroke()
      ctx.fillText(String(v), padL - 4 * u, Y1(v) + 4 * u)
    }
    // density
    ctx.fillStyle = 'rgba(160,111,214,0.16)'
    ctx.strokeStyle = 'rgba(160,111,214,0.8)'
    ctx.beginPath()
    ctx.moveTo(X1(xL), Y1(0))
    for (let k = 0; k <= 300; k++) {
      const x = xL + ((xR - xL) * k) / 300
      ctx.lineTo(X1(x), Y1(Math.min(1.15, density(ramp, x))))
    }
    ctx.lineTo(X1(xR), Y1(0))
    ctx.closePath()
    ctx.fill()
    // heating-rate profile (column maxima: the standing wave makes it oscillate on the λ/2 scale)
    const ncol = Math.max(10, Math.round((W - padL - padR) / (1.5 * u)))
    const mn = new Float64Array(ncol)
    const mx = new Float64Array(ncol)
    const colX = (k: number) => padL + ((k + 0.5) / ncol) * (W - padL - padR)
    columnMinMax(s.x, s.n, (i) => s.heat[i], xL, xR, mn, mx)
    ctx.fillStyle = 'rgba(251,191,36,0.55)'
    ctx.beginPath()
    ctx.moveTo(colX(0), Y1(0))
    for (let k = 0; k < ncol; k++) ctx.lineTo(colX(k), Y1(isFinite(mx[k]) ? (0.95 * mx[k]) / heatMax : 0))
    ctx.lineTo(colX(ncol - 1), Y1(0))
    ctx.closePath()
    ctx.fill()
    // cumulative absorbed fraction
    columnMinMax(s.x, s.n, (i) => cum[i], xL, xR, mn, mx)
    glowStroke(ctx, COLORS.lime, 1.6 * u, () => {
      let pen = false
      for (let k = 0; k < ncol; k++) {
        if (!isFinite(mx[k])) continue
        if (pen) ctx.lineTo(colX(k), Y1(mx[k]))
        else ctx.moveTo(colX(k), Y1(mx[k]))
        pen = true
      }
    })
    // critical surface and turning point
    const vline = (x: number, X: (x: number) => number, y0: number, y1: number, color: string, dash: number[]) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.2 * u
      ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.moveTo(X(x), y0)
      ctx.lineTo(X(x), y1)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (xc <= xR) vline(xc, X1, t1, b1, COLORS.amber, [])
    if (theta > 0) vline(s.xTurn, X1, t1, b1, COLORS.lime, [5 * u, 4 * u])
    // zoom window
    ctx.strokeStyle = 'rgba(232,234,246,0.45)'
    ctx.lineWidth = u
    ctx.setLineDash([3 * u, 3 * u])
    ctx.strokeRect(X1(xa), t1, X1(xb) - X1(xa), b1 - t1)
    ctx.beginPath()
    ctx.moveTo(X1(xa), b1)
    ctx.lineTo(padL, t2)
    ctx.moveTo(X1(xb), b1)
    ctx.lineTo(W - padR, t2)
    ctx.stroke()
    ctx.setLineDash([])
    // legend
    ctx.textAlign = 'left'
    let lx = padL
    for (const [txt, col] of [['n/n_c', COLORS.violet], [narrow ? 'heating' : 'heating rate', COLORS.amber], [narrow ? 'absorbed' : 'absorbed so far', COLORS.lime]] as const) {
      ctx.fillStyle = col
      ctx.fillRect(lx, t1 - 13 * u, 9 * u, 9 * u)
      ctx.fillText(txt, lx + 12 * u, t1 - 5 * u)
      lx += ctx.measureText(txt).width + 26 * u
    }
    // in / out arrows (lengths ∝ power)
    const arrow = (y: number, len: number, right: boolean, col: string, txt: string) => {
      const x0 = padL + 6 * u
      const L = Math.max(4 * u, len)
      ctx.strokeStyle = col
      ctx.fillStyle = col
      ctx.lineWidth = 2 * u
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x0 + L, y)
      ctx.stroke()
      const tip = right ? x0 + L : x0
      const dir = right ? 1 : -1
      ctx.beginPath()
      ctx.moveTo(tip + dir * 5 * u, y)
      ctx.lineTo(tip - dir * 2 * u, y - 4 * u)
      ctx.lineTo(tip - dir * 2 * u, y + 4 * u)
      ctx.fill()
      ctx.textAlign = 'left'
      ctx.fillText(txt, x0 + Math.max(L, 40 * u) + 10 * u, y + 4 * u)
    }
    const aw = (narrow ? 46 : 70) * u
    arrow(Y1(1.02), aw, true, COLORS.white, 'in 1')
    arrow(Y1(0.82), aw * s.R, false, COLORS.magenta, `out |r|² = ${s.R.toFixed(2)}`)
    ctx.fillStyle = COLORS.text
    xTicks(ctx, xL, xR, X1, b1 + 14 * u, W, padR, u, 'µm from n_c')
    // ===== bottom panel: the turning point, zoomed =====
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.beginPath()
    ctx.moveTo(padL, mid2)
    ctx.lineTo(W - padR, mid2)
    ctx.stroke()
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, t2, W - padL - padR, b2 - t2)
    // density as a faint fill (0 to 1.15 over the panel height)
    ctx.fillStyle = 'rgba(160,111,214,0.12)'
    ctx.beginPath()
    ctx.moveTo(X2(xa), b2)
    for (let k = 0; k <= 200; k++) {
      const x = xa + ((xb - xa) * k) / 200
      ctx.lineTo(X2(x), b2 - (Math.min(1.15, density(ramp, x)) / 1.15) * (b2 - t2))
    }
    ctx.lineTo(X2(xb), b2)
    ctx.closePath()
    ctx.fill()
    // heating rate in the window
    ctx.fillStyle = 'rgba(251,191,36,0.4)'
    ctx.beginPath()
    ctx.moveTo(X2(s.x[ia]), b2)
    for (let i = ia; i <= ib; i++) ctx.lineTo(X2(s.x[i]), b2 - (s.heat[i] / Math.max(1e-300, hMaxWin)) * 0.42 * (b2 - t2))
    ctx.lineTo(X2(s.x[ib]), b2)
    ctx.closePath()
    ctx.fill()
    // ±|E| envelope
    ctx.strokeStyle = 'rgba(34,211,238,0.45)'
    ctx.lineWidth = 1.2 * u
    ctx.setLineDash([4 * u, 3 * u])
    for (const sg of [1, -1]) {
      ctx.beginPath()
      for (let i = ia; i <= ib; i++) {
        const y = Y2(sg * Math.hypot(s.re[i], s.im[i]))
        if (i === ia) ctx.moveTo(X2(s.x[i]), y)
        else ctx.lineTo(X2(s.x[i]), y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
    vline(xc, X2, t2, b2, COLORS.amber, [])
    if (theta > 0) vline(s.xTurn, X2, t2, b2, COLORS.lime, [5 * u, 4 * u])
    // labels
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.amber
    if (X2(xc) < W - padR - 30 * u) ctx.fillText('n_c', X2(xc) + 4 * u, t2 + 13 * u)
    if (theta > 0) {
      ctx.fillStyle = COLORS.lime
      ctx.textAlign = 'right'
      ctx.fillText('n_c cos²θ', X2(s.xTurn) - 4 * u, t2 + 13 * u)
    }
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    const e = sol.eMax
    ctx.fillText(e >= 10 ? e.toFixed(0) : e >= 1 ? e.toFixed(1) : e.toPrecision(2), padL - 4 * u, Y2(e) + 4 * u)
    ctx.fillText('0', padL - 4 * u, mid2 + 4 * u)
    ctx.save()
    ctx.translate(11 * u, mid2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('E / E_vac', 0, 0)
    ctx.restore()
    // δ scale bar
    const dpx = X2(xa + s.delta) - X2(xa)
    ctx.strokeStyle = COLORS.white
    ctx.lineWidth = 1.5 * u
    ctx.beginPath()
    ctx.moveTo(padL + 8 * u, b2 - 8 * u)
    ctx.lineTo(padL + 8 * u + dpx, b2 - 8 * u)
    ctx.stroke()
    ctx.fillStyle = COLORS.white
    ctx.textAlign = 'left'
    ctx.fillText(`δ = ${((s.delta * lam) / TWO_PI).toPrecision(2)} µm`, padL + 12 * u + dpx, b2 - 4 * u)
    xTicks(ctx, xa, xb, X2, H - 8 * u, W, padR, u, 'µm from n_c')
    return cv
  }

  const lgToX = (v: number, W: number, padL: number, padR: number) => padL + ((v - 12) / 4) * (W - padL - padR)
  const ivGeo = (W: number, H: number, u: number) => {
    const padL = 34 * u
    const padR = (narrow ? 14 : 70) * u
    const top = 26 * u
    const bot = H - 36 * u
    return { padL, padR, top, bot, Y: (a: number) => bot - a * (bot - top), X: (v: number) => lgToX(v, W, padL, padR) }
  }
  const renderIntensity = (W: number, H: number, u: number) => {
    const cv = layer.current?.cv ?? document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    const { padL, padR, top, bot, X, Y } = ivGeo(W, H, u)
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    ctx.font = `${(narrow ? 10.5 : 11.5) * u}px "PT Sans", sans-serif`
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    for (let a = 0; a <= 1.0001; a += 0.2) {
      ctx.beginPath()
      ctx.moveTo(padL, Y(a))
      ctx.lineTo(W - padR, Y(a))
      ctx.stroke()
      ctx.fillText(a.toFixed(1), padL - 4 * u, Y(a) + 4 * u)
    }
    ctx.textAlign = 'center'
    for (let v = 12; v <= 16; v++) {
      ctx.beginPath()
      ctx.moveTo(X(v), top)
      ctx.lineTo(X(v), bot)
      ctx.stroke()
      ctx.fillText(`10${sup(v)}`, X(v), bot + 15 * u)
    }
    ctx.textAlign = 'right'
    ctx.fillText('I  (W/cm²)', W - padR, H - 4 * u)
    ctx.save()
    ctx.translate(11 * u, (top + bot) / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('absorbed fraction', 0, 0)
    ctx.restore()
    // analytic curves: classical (dashed) and with the Langdon reduction of ν (solid)
    const labels: { y: number; txt: string; col: string }[] = []
    LAMS.forEach((lm, k) => {
      const p0 = absorptionParams({ ...setup, lamUm: lm, langdon: false })
      const flat = p0.formula
      ctx.strokeStyle = LAM_COLORS[k]
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1.3 * u
      ctx.setLineDash([6 * u, 5 * u])
      ctx.beginPath()
      ctx.moveTo(X(12), Y(flat))
      ctx.lineTo(X(16), Y(flat))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      let last = 0
      glowStroke(ctx, LAM_COLORS[k], (k === li ? 2.2 : 1.4) * u, () => {
        for (let j = 0; j <= 160; j++) {
          const v = 12 + (4 * j) / 160
          const a = langdonAlpha(10 ** v, lm, setup.TeV, Z)
          last = absorptionFormula(kind, p0.q * langdonFactor(a), th)
          if (j === 0) ctx.moveTo(X(v), Y(last))
          else ctx.lineTo(X(v), Y(last))
        }
      })
      // α = 1 tick for this wavelength
      const vA = Math.log10(I / langdonAlpha(I, lm, setup.TeV, Z))
      if (vA > 12 && vA < 16) {
        ctx.fillStyle = LAM_COLORS[k]
        ctx.fillRect(X(vA) - u, bot - 7 * u, 2 * u, 7 * u)
      }
      labels.push({ y: Y(last), txt: LAM_LABEL[k].split(' ')[0] + ' nm', col: LAM_COLORS[k] })
    })
    if (!narrow) {
      labels.sort((a, b) => a.y - b.y)
      for (let k = 1; k < labels.length; k++) labels[k].y = Math.max(labels[k].y, labels[k - 1].y + 13 * u)
      ctx.textAlign = 'left'
      for (const l of labels) {
        ctx.fillStyle = l.col
        ctx.fillText(l.txt, W - padR + 6 * u, l.y + 4 * u)
      }
    }
    ctx.textAlign = 'left'
    let lx = padL + 4 * u
    if (narrow) {
      // no room for labels at the curve ends: name the colours in the caption line
      LAMS.forEach((_, k) => {
        const t = LAM_LABEL[k].split(' ')[0] + (k === 2 ? ' nm' : '')
        ctx.fillStyle = LAM_COLORS[k]
        ctx.fillText(t, lx, top - 8 * u)
        lx += ctx.measureText(t).width + 6 * u
      })
      lx += 4 * u
    }
    ctx.fillStyle = COLORS.text
    ctx.fillText(narrow ? 'solid: Langdon, dashed: classical' : 'solid: with the Langdon reduction · dashed: classical ν_ei · ticks: α = 1', lx, top - 8 * u)
    return cv
  }

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    if (view === 'field') {
      const key = `f:${W}x${H}:${p.nucOverOmega}:${p.k0L}:${theta}:${kind}:${li}`
      if (!layer.current || layer.current.key !== key) layer.current = { key, cv: renderField(W, H, u) }
      ctx.drawImage(layer.current.cv, 0, 0)
      const { s, ia, ib } = sol
      const { X2, Y2, t2, b2, padL, padR } = geo(W, H, u)
      const cw = Math.cos(phase.current)
      const sw = Math.sin(phase.current)
      ctx.save()
      ctx.beginPath()
      ctx.rect(padL, t2, W - padL - padR, b2 - t2)
      ctx.clip()
      glowStroke(ctx, COLORS.cyan, 1.5 * u, () => {
        for (let i = ia; i <= ib; i++) {
          // Re[E e^{−iωt}] = Re E cos ωt + Im E sin ωt
          const y = Y2(s.re[i] * cw + s.im[i] * sw)
          if (i === ia) ctx.moveTo(X2(s.x[i]), y)
          else ctx.lineTo(X2(s.x[i]), y)
        }
      })
      ctx.restore()
    } else {
      const key = `i:${W}x${H}:${dotKey}:${lgI}`
      if (!layer.current || layer.current.key !== key) layer.current = { key, cv: renderIntensity(W, H, u) }
      ctx.drawImage(layer.current.cv, 0, 0)
      const { padL, padR, top, bot, Y } = ivGeo(W, H, u)
      // current intensity
      ctx.strokeStyle = COLORS.white
      ctx.globalAlpha = 0.6
      ctx.lineWidth = u
      ctx.setLineDash([3 * u, 3 * u])
      ctx.beginPath()
      ctx.moveTo(lgToX(lgI, W, padL, padR), top)
      ctx.lineTo(lgToX(lgI, W, padL, padR), bot)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      const d = dots.current
      for (let k = 0; k < DOT_LG.length; k++) {
        const a = d.A[k]
        if (a === null) continue
        ctx.fillStyle = COLORS.bg
        ctx.strokeStyle = COLORS.white
        ctx.lineWidth = 1.5 * u
        ctx.beginPath()
        ctx.arc(lgToX(DOT_LG[k], W, padL, padR), Y(a), 3.6 * u, 0, 7)
        ctx.fill()
        ctx.stroke()
      }
      // the present set-up, full wave
      ctx.fillStyle = COLORS.white
      ctx.beginPath()
      ctx.arc(lgToX(lgI, W, padL, padR), Y(1 - sol.s.R), 5 * u, 0, 7)
      ctx.fill()
    }
  }

  useAnimation(
    canvas,
    (dt) => {
      phase.current += 0.05 * (dt / 16.7)
      if (view === 'intensity') stepDots(false)
      draw()
    },
    running,
  )
  useEffect(() => {
    if (!running) {
      if (view === 'intensity') stepDots(true)
      draw()
    }
  })

  const { s } = sol
  const A = 1 - s.R
  const okA = Math.abs(A / p.formula - 1) < 0.03
  const okE = Math.abs(s.heated / A - 1) < 0.01
  const fText = kind === 'linear' ? '1 − exp(−(32/15)(ν_cL/c) cos⁵θ)' : '1 − exp(−(8/3)(ν_cL/c) cos³θ)'
  const p0 = langdon ? absorptionParams({ ...setup, langdon: false }) : p

  return (
    <SimFrame
      id="absorption-ramp"
      title="Absorption in a ramp"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setKind('linear')
        setView('field')
        setLangdon(false)
        setLi(0)
        setZ(5)
        setT(2)
        setLgL(2)
        setTheta(0)
        setLgI(14)
      }}
      hint="Top: the whole ramp, measured in µm from the critical surface, with the density (violet), the local heating rate (amber), which piles up just before the turning point, and the running total of absorbed power (lime). The arrows compare the incident and reflected power. Bottom: a zoom on the turning point, where the field Re[E e^(−iωt)] oscillates inside its envelope, slowed down about 10¹⁵ times. The full-wave absorbed fraction 1 − |r|² should match the formula and the integrated heating rate. Try 1053 → 351 nm, double T_e, tilt the beam, or switch to the absorption-vs-intensity view and turn on the Langdon effect."
    >
      <div className="row" style={{ marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn small ${kind === 'linear' ? 'primary' : ''}`} onClick={() => setKind('linear')}>Linear ramp</button>
        <button className={`btn small ${kind === 'exp' ? 'primary' : ''}`} onClick={() => setKind('exp')}>Exponential</button>
      </div>
      <div className="row" style={{ marginBottom: 10, gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn small ${view === 'field' ? 'primary' : ''}`} onClick={() => setView('field')}>Field</button>
        <button className={`btn small ${view === 'intensity' ? 'primary' : ''}`} onClick={() => setView('intensity')}>A vs intensity</button>
        <button className={`btn small ${langdon ? 'primary' : ''}`} onClick={() => setLangdon(!langdon)}>Langdon {langdon ? 'on' : 'off'}</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Laser light absorbed by inverse bremsstrahlung in a density ramp" />
      <div className="readouts">
        <span>
          absorbed, full wave 1 − |r|² = <b className={okA ? 'ok' : ''}>{A.toFixed(4)}</b>; formula {fText} = <b>{p.formula.toFixed(4)}</b>
        </span>
        <span>
          integrated heating ∫ k0 Im ε |E|² dx / k_x = <b className={okE ? 'ok' : ''}>{s.heated.toFixed(4)}</b> (energy balance)
        </span>
        <span>
          ν_ei at n_c = <b>{sci(p.nuc, 3)}</b> s⁻¹ = <b>{sci(p.nucOverOmega, 2)}</b> ω, lnΛ = <b>{p.lnL.toFixed(2)}</b>
        </span>
        <span>
          ν_cL/c = <b>{p.q.toPrecision(3)}</b>, ωL/c = <b>{p.k0L.toFixed(0)}</b>, n_c = <b>{sci(p.nc * 1e-6, 3)}</b> cm⁻³
        </span>
        <span>
          v_os/v_te = <b>{p.vosOverVte.toPrecision(2)}</b>, α = Zv_os²/v_te² = <b>{p.alpha.toPrecision(2)}</b>, Langdon factor <b>{langdonFactor(p.alpha).toFixed(2)}</b> ({langdon ? 'applied to ν' : 'not applied'})
        </span>
        {view === 'intensity' && (
          <span>
            at {sci(I, 2)} W/cm²: A = <b>{p.formula.toFixed(3)}</b>{langdon ? <> (classical <b>{p0.formula.toFixed(3)}</b>)</> : null}; open dots: full wave at {LAM_LABEL[li].split(' ')[0]} nm
          </span>
        )}
      </div>
      <div className="controls">
        <Slider label="Wavelength" value={li} min={0} max={2} step={1} onChange={setLi} fmt={(v) => LAM_LABEL[v]} />
        <Slider label="Intensity" value={lgI} min={12} max={16} step={0.05} onChange={setLgI} fmt={(v) => `${sci(10 ** v, 2)} W/cm²`} />
        <Slider label="Temperature T_e" value={TkeV} min={0.2} max={5} step={0.1} onChange={setT} fmt={(v) => `${v.toFixed(1)} keV`} />
        <Slider label="Ion charge Z" value={Z} min={1} max={60} step={0.5} onChange={setZ} fmt={(v) => String(v)} />
        <Slider label="Scale length L" value={lgL} min={1} max={Math.log10(500)} step={0.01} onChange={setLgL} fmt={() => `${Lum} µm`} />
        <Slider label="Angle θ (s-pol.)" value={theta} min={0} max={60} step={1} onChange={setTheta} fmt={(v) => `${v}°`} />
      </div>
    </SimFrame>
  )
}
