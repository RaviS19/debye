// B6 flagship: growth-rate map of SRS and SBS backscatter over density and electron temperature, for a chosen
// laser intensity and wavelength. Each cell solves the matching conditions exactly (Bohm–Gross plasma wave or ion
// acoustic wave, cached once per plasma), then the growth rate scales with v_os ∝ λ√I, so a frame only rescales.
// Overlays: kλ_De = 0.3 (SRS: Landau damping switches on), γ_weak = kc_s (SBS: strong coupling), and the
// Rosenbluth gain contour G = G* for the chosen gradient scale length. Tap or hover for a full readout, with the
// growth rate checked against an independent Newton root of the full dispersion relation.
import { useMemo, useRef, useState } from 'react'
import { COLORS, useAnimation, useCanvas } from '../components/useCanvas'
import { quiverOverC } from '../physics/lightRamp'
import { groupVelocity, kLambdaDe, normalize, sbsBackscatter, srsBackscatter, srsKappaPrime } from '../physics/parametric'
import {
  cubicGrowingRoot,
  cubicMaxGrowth,
  dampedGrowth,
  epwDamping,
  fullDispersionGrowth,
  iawDampingRatio,
  ionPlasmaFreq2,
  toPerPs,
  umToNorm,
} from '../physics/srsSbs'
import { SimFrame, Slider } from './SimFrame'

type Mode = 'SRS' | 'SBS'
const NX = 96
const NY = 72
const NMIN = 0.01
const NMAX: Record<Mode, number> = { SRS: 0.25, SBS: 0.95 }
const LT0 = -1 // log10 T_e (keV) range
const LT1 = 1
const SPAN = 2 // colour scale: two decades of γ/ω0 below the map's maximum (rounded up to a whole decade)
const MATERIALS = [
  { label: 'CH', Z: 3.5, A: 6.5 },
  { label: 'He', Z: 2, A: 4 },
  { label: 'Au', Z: 50, A: 197 },
]

// a dark-violet-magenta-amber ramp, 256 entries
const LUT = (() => {
  const stops = [
    [8, 14, 32],
    [70, 30, 120],
    [190, 60, 140],
    [245, 140, 60],
    [253, 240, 170],
  ]
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1)
    const j = Math.min(stops.length - 2, Math.floor(t))
    const a = t - j
    for (let c = 0; c < 3; c++) out[3 * i + c] = stops[j][c] * (1 - a) + stops[j + 1][c] * a
  }
  return out
})()

const nnOf = (mode: Mode, i: number) => NMIN + ((i + 0.5) / NX) * (NMAX[mode] - NMIN)
const teOf = (j: number) => 10 ** (LT0 + ((j + 0.5) / NY) * (LT1 - LT0)) // j = 0 at the bottom

interface Cache {
  ok: Uint8Array
  g: Float64Array // SRS: γ0 per unit v_os; SBS: weak-coupling γ per unit v_os
  nu: Float64Array // damping of the plasma or ion wave, ν/ω0 (amplitude rate)
  gain: Float64Array // Rosenbluth G per (v_os² × L in c/ω0)
  klD: Float64Array
  a: Float64Array // SBS: kc_s/ω0
  bq: Float64Array // SBS: k² ω_pi²/8 (the cubic's drive per v_os²)
}

function newCache(): Cache {
  const n = NX * NY
  return { ok: new Uint8Array(n), g: new Float64Array(n), nu: new Float64Array(n), gain: new Float64Array(n), klD: new Float64Array(n), a: new Float64Array(n), bq: new Float64Array(n) }
}

function buildSrs(): Cache {
  const C = newCache()
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i
      const nn = nnOf('SRS', i)
      const N = normalize({ nn, TeKeV: teOf(j), TiKeV: 1, Z: 1, A: 1 })
      const b = srsBackscatter(N)
      if (!b) continue
      C.ok[idx] = 1
      const g = (b.k / 4) * Math.sqrt(nn / (b.w * b.ws))
      C.g[idx] = g
      C.klD[idx] = kLambdaDe(b.k, N)
      C.nu[idx] = epwDamping(C.klD[idx]) * Math.sqrt(nn)
      const kp = srsKappaPrime(N, b, 1)
      C.gain[idx] = (2 * Math.PI * g * g) / Math.abs(kp * groupVelocity('light', b.ks, N) * groupVelocity('epw', b.k, N))
    }
  return C
}

function buildSbs(ratio: number, Z: number, A: number): Cache {
  const C = newCache()
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i
      const nn = nnOf('SBS', i)
      const Te = teOf(j)
      const N = normalize({ nn, TeKeV: Te, TiKeV: (Z * Te) / ratio, Z, A })
      const b = sbsBackscatter(N)
      if (!b) continue
      C.ok[idx] = 1
      const wpi2 = ionPlasmaFreq2(N, Z, A)
      const g = (b.k / 4) * Math.sqrt(wpi2 / (b.w * b.ws))
      C.g[idx] = g
      C.a[idx] = b.w
      C.bq[idx] = (b.k * b.k * wpi2) / 8
      C.nu[idx] = iawDampingRatio(ratio, Z, A) * b.w
      C.gain[idx] = (2 * Math.PI * g * g) / (b.k * N.cs * groupVelocity('light', b.ks, N))
    }
  return C
}

/** Marching squares on a cell-centred grid: strokes the level set f = level (no joining; segments only). */
function contour(ctx: CanvasRenderingContext2D, f: Float64Array, level: number, X: (i: number) => number, Y: (j: number) => number) {
  ctx.beginPath()
  for (let j = 0; j < NY - 1; j++)
    for (let i = 0; i < NX - 1; i++) {
      const v00 = f[j * NX + i]
      const v10 = f[j * NX + i + 1]
      const v01 = f[(j + 1) * NX + i]
      const v11 = f[(j + 1) * NX + i + 1]
      if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11))) continue
      const b0 = v00 > level
      const b1 = v10 > level
      const b2 = v11 > level
      const b3 = v01 > level
      if (b0 === b1 && b1 === b2 && b2 === b3) continue
      // edge crossings in the order bottom (00–10), right (10–11), top (01–11), left (00–01)
      const pts: [number, number][] = []
      const t = (a: number, b: number) => (level - a) / (b - a)
      if (b0 !== b1) pts.push([X(i + t(v00, v10)), Y(j)])
      if (b1 !== b2) pts.push([X(i + 1), Y(j + t(v10, v11))])
      if (b3 !== b2) pts.push([X(i + t(v01, v11)), Y(j + 1)])
      if (b0 !== b3) pts.push([X(i), Y(j + t(v00, v01))])
      for (let p = 0; p + 1 < pts.length; p += 2) {
        ctx.moveTo(pts[p][0], pts[p][1])
        ctx.lineTo(pts[p + 1][0], pts[p + 1][1])
      }
    }
  ctx.stroke()
}

const sci = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(v)))
  if (e >= -2 && e <= 3) return v.toPrecision(d + 1)
  return `${(v / 10 ** e).toFixed(d)}×10${String(e).replace('-', '⁻').replace(/\d/g, (x) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+x])}`
}

export function GrowthMapSim() {
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<Mode>('SRS')
  const [logI, setLogI] = useState(15)
  const [lam, setLam] = useState(0.351)
  const [logL, setLogL] = useState(Math.log10(300))
  const [Gstar, setGstar] = useState(10)
  const [damp, setDamp] = useState(true)
  const [ratio, setRatio] = useState(7)
  const [mat, setMat] = useState(0)
  const [probe, setProbe] = useState<[number, number]>([0.1, 2])
  const dir = useRef(1)
  const { Z, A } = MATERIALS[mat]
  const I = 10 ** logI
  const Lum = 10 ** logL
  const vos = quiverOverC(I, lam)
  const Ln = umToNorm(Lum, lam)

  const srsCache = useMemo(() => buildSrs(), [])
  const sbsCache = useMemo(() => buildSbs(ratio, Z, A), [ratio, Z, A])
  const C = mode === 'SRS' ? srsCache : sbsCache

  // per-frame fields (preallocated)
  const fields = useRef({ lg: new Float64Array(NX * NY), G: new Float64Array(NX * NY), aux: new Float64Array(NX * NY) })
  const off = useRef<HTMLCanvasElement | null>(null)
  const img = useRef<ImageData | null>(null)
  const drawn = useRef('')

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.0 : 0.56, () => (drawn.current = ''), 520)

  const geom = (cv: HTMLCanvasElement) => {
    const u = cv.width / cv.clientWidth
    const x0 = 50 * u
    const x1 = cv.width - 12 * u
    const y0 = 40 * u
    const y1 = cv.height - 34 * u
    return { u, x0, x1, y0, y1 }
  }

  const draw = () => {
    const cv = canvas.current
    if (!cv) return
    const key = [mode, logI, lam, logL, Gstar, damp, ratio, mat, probe[0], probe[1], cv.width, cv.height].join(',')
    if (key === drawn.current) return
    drawn.current = key
    const ctx = cv.getContext('2d')!
    const W = cv.width
    const H = cv.height
    const { u, x0, x1, y0, y1 } = geom(cv)
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)

    // fields for this intensity
    const { lg, G, aux } = fields.current
    for (let idx = 0; idx < NX * NY; idx++) {
      if (!C.ok[idx]) {
        lg[idx] = NaN
        G[idx] = NaN
        aux[idx] = NaN
        continue
      }
      let g: number
      if (mode === 'SRS') {
        g = C.g[idx] * vos
        aux[idx] = C.klD[idx]
      } else {
        const a = C.a[idx]
        g = cubicMaxGrowth(-a, -a * a, a * a * a + C.bq[idx] * vos * vos)
        aux[idx] = (C.g[idx] * vos) / a // γ_weak/kc_s
      }
      if (damp) g = dampedGrowth(g, C.nu[idx])
      lg[idx] = Math.log10(Math.max(g, 1e-12))
      G[idx] = C.gain[idx] * vos * vos * Ln
    }

    let vmax = -Infinity
    for (let idx = 0; idx < NX * NY; idx++) if (lg[idx] > vmax) vmax = lg[idx]
    const G1 = Number.isFinite(vmax) ? Math.ceil(vmax - 1e-9) : -2
    const G0 = G1 - SPAN

    // heat map via a small offscreen image
    if (!off.current) {
      off.current = document.createElement('canvas')
      off.current.width = NX
      off.current.height = NY
      img.current = off.current.getContext('2d')!.createImageData(NX, NY)
    }
    const d = img.current!.data
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const v = lg[j * NX + i]
        const p = 4 * ((NY - 1 - j) * NX + i)
        if (!Number.isFinite(v)) {
          d[p] = 22
          d[p + 1] = 26
          d[p + 2] = 38
          d[p + 3] = 255
          continue
        }
        const t = Math.round(255 * Math.min(1, Math.max(0, (v - G0) / (G1 - G0))))
        d[p] = LUT[3 * t]
        d[p + 1] = LUT[3 * t + 1]
        d[p + 2] = LUT[3 * t + 2]
        d[p + 3] = 255
      }
    off.current.getContext('2d')!.putImageData(img.current!, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off.current, x0, y0, x1 - x0, y1 - y0)

    const nmax = NMAX[mode]
    const PX = (nn: number) => x0 + ((nn - NMIN) / (nmax - NMIN)) * (x1 - x0)
    const PY = (te: number) => y1 - ((Math.log10(te) - LT0) / (LT1 - LT0)) * (y1 - y0)
    const CX = (i: number) => x0 + ((i + 0.5) / NX) * (x1 - x0) // fractional cell index → pixels
    const CY = (j: number) => y1 - ((j + 0.5) / NY) * (y1 - y0)

    // contours
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, x1 - x0, y1 - y0)
    ctx.clip()
    ctx.lineWidth = 2.2 * u
    ctx.strokeStyle = mode === 'SRS' ? COLORS.cyan : COLORS.lime
    contour(ctx, aux, mode === 'SRS' ? 0.3 : 1, CX, CY)
    // the gain contour is made of many short segments, so draw it solid (a dash pattern restarts on each one)
    ctx.lineWidth = 1.6 * u
    ctx.strokeStyle = COLORS.white
    contour(ctx, G, Gstar, CX, CY)
    ctx.restore()

    // axes
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = 1 * u
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
    ctx.fillStyle = COLORS.text
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    ctx.textAlign = 'center'
    const xt = mode === 'SRS' ? [0.05, 0.1, 0.15, 0.2, 0.25] : [0.1, 0.3, 0.5, 0.7, 0.9]
    for (const t of xt) {
      ctx.fillText(String(t), PX(t), y1 + 14 * u)
      ctx.beginPath()
      ctx.moveTo(PX(t), y1)
      ctx.lineTo(PX(t), y1 + 4 * u)
      ctx.stroke()
    }
    ctx.fillText('density n / n_c', (x0 + x1) / 2, y1 + 28 * u)
    ctx.textAlign = 'right'
    for (const t of [0.1, 0.3, 1, 3, 10]) {
      ctx.fillText(String(t), x0 - 6 * u, PY(t) + 4 * u)
      ctx.beginPath()
      ctx.moveTo(x0 - 4 * u, PY(t))
      ctx.lineTo(x0, PY(t))
      ctx.stroke()
    }
    ctx.save()
    ctx.translate(13 * u, (y0 + y1) / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('T_e (keV)', 0, 0)
    ctx.restore()

    // colour bar on top
    const cbx0 = x0
    const cbx1 = Math.min(x1, x0 + 300 * u)
    const cby = 12 * u
    for (let k = 0; k < 128; k++) {
      const t = Math.round((k / 127) * 255)
      ctx.fillStyle = `rgb(${LUT[3 * t]},${LUT[3 * t + 1]},${LUT[3 * t + 2]})`
      ctx.fillRect(cbx0 + (k / 128) * (cbx1 - cbx0), cby, (cbx1 - cbx0) / 128 + 1, 9 * u)
    }
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.font = `${10 * u}px "PT Sans", sans-serif`
    for (let e = Math.ceil(G0); e <= G1; e++) ctx.fillText(`10${e < 0 ? '⁻' : ''}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[Math.abs(e)]}`, cbx0 + ((e - G0) / (G1 - G0)) * (cbx1 - cbx0), cby + 21 * u)
    ctx.textAlign = 'left'
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    if (cbx1 + 150 * u < W) ctx.fillText(damp ? 'γ/ω₀ with damping' : 'γ/ω₀ (undamped)', cbx1 + 10 * u, cby + 9 * u)

    // probe
    const [pn, pt] = probe
    const px = PX(pn)
    const py = PY(pt)
    ctx.strokeStyle = COLORS.white
    ctx.lineWidth = 1.6 * u
    ctx.beginPath()
    ctx.arc(px, py, 6 * u, 0, 2 * Math.PI)
    ctx.moveTo(px - 11 * u, py)
    ctx.lineTo(px - 7 * u, py)
    ctx.moveTo(px + 7 * u, py)
    ctx.lineTo(px + 11 * u, py)
    ctx.moveTo(px, py - 11 * u)
    ctx.lineTo(px, py - 7 * u)
    ctx.moveTo(px, py + 7 * u)
    ctx.lineTo(px, py + 11 * u)
    ctx.stroke()
  }

  useAnimation(
    canvas,
    () => {
      if (running) {
        let v = logI + dir.current * 0.01
        if (v > 16.5 || v < 13.5) {
          dir.current *= -1
          v = Math.max(13.5, Math.min(16.5, v))
        }
        setLogI(Math.round(v * 1000) / 1000)
      }
      draw()
    },
    true,
  )

  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvas.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    const { u, x0, x1, y0, y1 } = geom(cv)
    const x = (e.clientX - r.left) * u
    const y = (e.clientY - r.top) * u
    if (x < x0 || x > x1 || y < y0 || y > y1) return
    const nn = NMIN + ((x - x0) / (x1 - x0)) * (NMAX[mode] - NMIN)
    const te = 10 ** (LT0 + ((y1 - y) / (y1 - y0)) * (LT1 - LT0))
    setProbe([Math.round(nn * 1000) / 1000, Math.round(te * 100) / 100])
  }

  // ---- readout at the probe point, computed exactly (not from the grid) ----
  const [pn, pt] = probe
  const lamNm = Math.round(lam * 1000)
  const ps = (r: number) => toPerPs(r, lam)
  const R = (() => {
    if (mode === 'SRS') {
      const N = normalize({ nn: pn, TeKeV: pt, TiKeV: 1, Z: 1, A: 1 })
      const b = srsBackscatter(N)
      if (!b) return null
      const g0 = ((b.k * vos) / 4) * Math.sqrt(pn / (b.w * b.ws))
      const klD = kLambdaDe(b.k, N)
      const nu = epwDamping(klD) * Math.sqrt(pn)
      const full = fullDispersionGrowth(pn, b.k, b.k0, b.w * b.w, pn, vos, [b.w, g0])
      const kp = srsKappaPrime(N, b, Ln)
      const G = (2 * Math.PI * g0 * g0) / Math.abs(kp * groupVelocity('light', b.ks, N) * groupVelocity('epw', b.k, N))
      return { g0, full, nu, net: dampedGrowth(g0, nu), klD, G, lamS: lamNm / b.ws, extra: null as null | { weak: number; strong: number; kcs: number } }
    }
    const N = normalize({ nn: pn, TeKeV: pt, TiKeV: (Z * pt) / ratio, Z, A })
    const b = sbsBackscatter(N)
    if (!b) return null
    const wpi2 = ionPlasmaFreq2(N, Z, A)
    const a = b.w
    const weak = ((b.k * vos) / 4) * Math.sqrt(wpi2 / (a * b.ws))
    const strong = (Math.sqrt(3) / 4) * Math.cbrt(b.k * b.k * vos * vos * wpi2)
    const root = cubicGrowingRoot(-a, -a * a, a * a * a + (b.k * b.k * vos * vos * wpi2) / 8)
    const g0 = root[1]
    const full = Number.isFinite(root[0]) ? fullDispersionGrowth(pn, b.k, b.k0, a * a, wpi2, vos, root) : NaN
    const nu = iawDampingRatio(ratio, Z, A) * a
    const G = (2 * Math.PI * weak * weak * Ln) / (b.k * N.cs * groupVelocity('light', b.ks, N))
    return { g0, full, nu, net: dampedGrowth(g0, nu), klD: NaN, G, lamS: lamNm / b.ws, extra: { weak, strong, kcs: a } }
  })()
  const fullOk = R && Number.isFinite(R.full) && Math.abs(R.full / R.g0 - 1) < 0.02

  return (
    <SimFrame
      id="growth-map"
      title="Growth-rate map"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setRunning(false)
        setLogI(15)
        setLam(0.351)
        setLogL(Math.log10(300))
        setGstar(10)
        setDamp(true)
        setRatio(7)
        setMat(0)
        setProbe([0.1, 2])
      }}
      hint="Each pixel is the backscatter growth rate at that density and electron temperature, from the exact matching conditions. Tap or hover anywhere for the numbers; the marked point starts at the worked example (0.1 n_c, 2 keV). Play sweeps the intensity. For SRS, the cyan line is kλ_De = 0.3: to its left the plasma wave is Landau damped and, with damping on, growth collapses. The white line is where the Rosenbluth gain reaches G* for your scale length: right of it, noise can grow to a visible reflectivity. Switch to SBS and lower ZT_e/T_i towards 3 to see ion Landau damping act; in a gold plasma ZT_e/T_i is naturally large and there is almost no ion damping to stop SBS."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {(['SRS', 'SBS'] as Mode[]).map((m) => (
          <button
            key={m}
            className={`btn small ${mode === m ? 'primary' : ''}`}
            onClick={() => {
              setMode(m)
              setProbe(m === 'SRS' ? [0.1, 2] : [0.1, 2])
            }}
          >
            {m === 'SRS' ? 'SRS (Raman)' : 'SBS (Brillouin)'}
          </button>
        ))}
        <button className={`btn small ${damp ? 'primary' : ''}`} onClick={() => setDamp(!damp)}>
          Damping {damp ? 'on' : 'off'}
        </button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Map of the backscatter growth rate over density and temperature" onPointerMove={pick} onPointerDown={pick} style={{ touchAction: 'pan-y', cursor: 'crosshair' }} />
      <div className="row small" style={{ gap: 14, marginTop: 6 }}>
        {mode === 'SRS' ? <span style={{ color: COLORS.cyan }}>━ kλ_De = 0.3</span> : <span style={{ color: COLORS.lime }}>━ γ_weak = kc_s (strong coupling where γ is larger)</span>}
        <span style={{ color: COLORS.white }}>━ Rosenbluth gain G = G*</span>
        {mode === 'SRS' && <span className="dim">grey: no backscatter match (n ≳ n_c/4)</span>}
      </div>
      <div className="readouts">
        <span>
          at n/n_c = <b>{pn.toFixed(3)}</b>, T_e = <b>{pt.toFixed(2)} keV</b>
          {mode === 'SBS' && <> , T_i = <b>{((Z * pt) / ratio).toPrecision(2)} keV</b></>}; v_os/c = <b>{vos.toFixed(4)}</b>
        </span>
        {R ? (
          <>
            <span>
              {mode === 'SRS' ? 'γ₀ (weak-coupling formula)' : 'γ (resonant cubic, both regimes)'} = <b>{ps(R.g0).toPrecision(3)} ps⁻¹</b> ({sci(R.g0)} ω₀)
            </span>
            <span>
              Newton root of the full dispersion relation: <b className={fullOk ? 'ok' : ''}>{Number.isFinite(R.full) ? `${sci(R.full)} ω₀` : 'not converged'}</b>
            </span>
            {R.extra && (
              <span>
                weak-coupling formula <b>{sci(R.extra.weak)}</b>, strong <b>{sci(R.extra.strong)}</b>, kc_s = <b>{sci(R.extra.kcs)}</b> ω₀: γ_weak/kc_s = <b>{(R.extra.weak / R.extra.kcs).toFixed(2)}</b> ({R.extra.weak > R.extra.kcs ? 'strongly coupled' : 'weak coupling'})
              </span>
            )}
            <span>
              {mode === 'SRS' ? (
                <>
                  kλ_De = <b style={R.klD > 0.3 ? { color: 'var(--amber)' } : undefined}>{R.klD.toFixed(3)}</b>, Landau damping ν = <b>{sci(R.nu)}</b> ω₀ (<b>{ps(R.nu).toPrecision(3)} ps⁻¹</b>)
                </>
              ) : (
                <>
                  ion Landau damping ν/(kc_s) = <b>{(R.nu / R.extra!.kcs).toFixed(3)}</b> at ZT_e/T_i = {ratio.toFixed(1)}: ν = <b>{ps(R.nu).toPrecision(3)} ps⁻¹</b>
                </>
              )}
            </span>
            <span>
              with damping, −ν/2 + √(ν²/4 + γ²) = <b>{ps(R.net).toPrecision(3)} ps⁻¹</b>
            </span>
            <span>
              Rosenbluth gain over {mode === 'SRS' ? 'density' : 'flow'} scale length {Math.round(Lum)} µm: G = <b className={R.G >= Gstar ? 'ok' : ''}>{R.G.toPrecision(3)}</b>; G = G* needs about <b>{sci((I * Gstar) / R.G, 1)} W/cm²</b>
            </span>
            <span>
              backscattered light at <b>{mode === 'SRS' ? R.lamS.toFixed(0) : R.lamS.toFixed(2)} nm</b>
              {mode === 'SBS' && <> (red shift {(R.lamS - lamNm).toFixed(2)} nm)</>}
            </span>
          </>
        ) : (
          <span>
            <b style={{ color: 'var(--red)' }}>No backscatter match here</b>: above about n_c/4 the light and the plasma wave cannot share ω₀.
          </span>
        )}
      </div>
      <div className="controls">
        <Slider label="Laser intensity I" value={logI} min={13} max={17} step={0.01} onChange={(v) => { setRunning(false); setLogI(v) }} fmt={(v) => `${sci(10 ** v, 1)} W/cm²`} />
        <Slider label={mode === 'SRS' ? 'Density scale length L' : 'Flow scale length L_u'} value={logL} min={1.5} max={3.5} step={0.01} onChange={setLogL} fmt={(v) => `${Math.round(10 ** v)} µm`} />
        <Slider label="Gain contour G*" value={Gstar} min={1} max={30} step={0.5} onChange={setGstar} fmt={(v) => v.toFixed(1)} />
        {mode === 'SBS' && <Slider label="ZT_e / T_i" value={ratio} min={3} max={40} step={0.5} onChange={setRatio} fmt={(v) => v.toFixed(1)} />}
      </div>
      <div className="row" style={{ marginTop: 10, gap: 6 }}>
        <span className="small dim">Laser:</span>
        {[0.351, 0.527, 1.053].map((l) => (
          <button key={l} className={`btn small ${lam === l ? 'primary' : ''}`} onClick={() => setLam(l)}>
            {Math.round(l * 1000)} nm
          </button>
        ))}
        {mode === 'SBS' && (
          <>
            <span className="small dim">Plasma:</span>
            {MATERIALS.map((m, i) => (
              <button key={m.label} className={`btn small ${mat === i ? 'primary' : ''}`} onClick={() => setMat(i)}>
                {m.label}
              </button>
            ))}
          </>
        )}
      </div>
    </SimFrame>
  )
}
