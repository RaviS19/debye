// B7: beam breakup. A paraxial laser envelope marched along z through a plasma that sits in pressure balance with the
// light. Filamentation mode: a wide uniform beam in a periodic slab (split-step Fourier, 256 transverse points) with a
// small ripple plus noise; the ripple's growth is measured against linear theory. Single-beam mode: a round Gaussian
// beam (Crank–Nicolson in r) that diffracts below the critical power and self-focuses above it.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  createRadial,
  createSlab,
  criticalPowerW,
  filamentationRate,
  gaussianWidthFactor,
  logSlope,
  radialAxis,
  radialHalfWidth,
  radialMaxN,
  slabDensity,
  slabMode,
  stepRadial,
  stepSlab,
  TOWNES_N,
  unitsUm,
  upOverT,
  type Radial,
  type Slab,
} from '../physics/filamentation'
import { ponderomotiveEV } from '../physics/ponderomotive'
import { SimFrame, Slider } from './SimFrame'

const LAM = 0.351 // µm, frequency-tripled Nd:glass as on NIF and OMEGA
const NX = 256
const NZ = 450 // filamentation: march steps = image columns
const BOX = 8 // fastest-growing wavelengths across the slab
const ZEFOLD = 9 // window length in e-folds of the fastest mode
const EPS = 0.003 // ripple: ψ = √s0 (1 + ε cos KX)
const NOISES = [0, 0.001, 0.003, 0.01, 0.03]
// single beam
const WB = 40 // 1/e² intensity radius in c/ω_pe (the numerics stay well resolved for any slider setting)
const NR = 768 // converged: the collapsed core stays ≥ 6 cells wide up to P/P_c = 3
const RMAX = 4.5 * WB
const NZB = 300
const ROWS_B = 220
const XVIEW = 3 * WB

type Mode = 'fil' | 'beam'
type View = 'I' | 'n'

// ---------- colour maps ----------
function lut(stops: [number, [number, number, number]][]) {
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let k = 0
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++
    const [t0, c0] = stops[k]
    const [t1, c1] = stops[k + 1]
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
    for (let j = 0; j < 3; j++) out[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * f
  }
  return out
}
const LUT_I = lut([
  [0, [3, 7, 16]],
  [0.25, [22, 48, 120]],
  [0.5, [34, 150, 210]],
  [0.75, [143, 255, 255]],
  [1, [255, 255, 255]],
])
const LUT_N = lut([
  [0, [0, 0, 0]],
  [0.45, [60, 30, 110]],
  [0.77, [160, 111, 214]],
  [1, [244, 214, 255]],
])
/** intensity I/I0 → colour index, square-root scale up to 6 I0 */
const idxI = (r: number) => Math.min(255, Math.max(0, Math.round(255 * Math.sqrt(Math.max(0, r) / 6))))
/** density n/n0 → colour index, 0 … 1.3 */
const idxN = (r: number) => Math.min(255, Math.max(0, Math.round((255 * r) / 1.3)))

interface FilState {
  s: Slab
  s0: number
  m: number
  col: number
  I: Float32Array // NZ × NX, I/I0
  N: Float32Array // NZ × NX, n/n0
  amp: Float64Array // ripple amplitude per column
  peak: Float64Array // max I/I0 per column
  zs: Float64Array
  dens: Float64Array
}

interface BeamState {
  b: Radial
  s0: number
  col: number
  ZR: number
  Zend: number
  h0: number // initial half-maximum radius
  I: Float32Array // NZB × ROWS_B, I/I0
  N: Float32Array
  hw: Float64Array // half-maximum radius per column (normalized)
  axis: Float64Array // on-axis I/I0
  nonlinear: boolean
}

function makeFil(s0: number, m: number, noise: number): FilState {
  const L = (BOX * 2 * Math.PI) / Math.sqrt(s0)
  const K = (2 * Math.PI * m) / L
  const s = createSlab({ nx: NX, L, dZ: ZEFOLD / s0 / NZ, noise, seed: 4242, profile: (X) => Math.sqrt(s0) * (1 + EPS * Math.cos(K * X)) })
  return {
    s,
    s0,
    m,
    col: 0,
    I: new Float32Array(NZ * NX),
    N: new Float32Array(NZ * NX),
    amp: new Float64Array(NZ),
    peak: new Float64Array(NZ),
    zs: new Float64Array(NZ),
    dens: new Float64Array(NX),
  }
}

function makeBeam(Ppc: number, nonlinear: boolean): BeamState {
  const s0 = (2 * Ppc * TOWNES_N) / (Math.PI * WB * WB)
  const b = createRadial({ N: NR, R: RMAX, nonlinear, profile: (r) => Math.sqrt(s0) * Math.exp(-((r / WB) ** 2)) })
  const ZR = (WB * WB) / 4
  return {
    b,
    s0,
    col: 0,
    ZR,
    Zend: 2 * ZR,
    h0: radialHalfWidth(b),
    I: new Float32Array(NZB * ROWS_B),
    N: new Float32Array(NZB * ROWS_B),
    hw: new Float64Array(NZB),
    axis: new Float64Array(NZB),
    nonlinear,
  }
}

/** |ψ|² at radius r by linear interpolation on the cell-centred grid. */
function sAt(b: Radial, r: number) {
  const x = r / b.dr - 0.5
  if (x <= 0) return b.re[0] ** 2 + b.im[0] ** 2
  const j = Math.floor(x)
  if (j >= b.N - 1) return 0
  const f = x - j
  const s1 = b.re[j] ** 2 + b.im[j] ** 2
  const s2 = b.re[j + 1] ** 2 + b.im[j + 1] ** 2
  return s1 + (s2 - s1) * f
}

export function BeamBreakupSim() {
  const [running, setRunning] = useState(true)
  const [mode, setMode] = useState<Mode>('fil')
  const [view, setView] = useState<View>('I')
  const [I, setI] = useState(1e15) // W/cm²
  const [nn, setNn] = useState(0.1)
  const [Te, setTe] = useState(2)
  const [m, setM] = useState(8)
  const [ni, setNi] = useState(2)
  const [Ppc, setPpc] = useState(2)
  const [nonlinear, setNonlinear] = useState(true)
  const s0 = upOverT(I, LAM, Te)
  const units = unitsUm(LAM, nn)

  const fil = useRef<FilState>(makeFil(s0, m, NOISES[ni]))
  const beam = useRef<BeamState>(makeBeam(Ppc, nonlinear))
  const imgs = useRef<{ fil: { cv: HTMLCanvasElement; data: ImageData }; beam: { cv: HTMLCanvasElement; data: ImageData } } | null>(null)
  const [read, setRead] = useState<{ meas: number | null; z: number; peak: number; hw: number; vac: number; axisMax: number }>({ meas: null, z: 0, peak: 1, hw: 1, vac: 1, axisMax: 1 })
  const frame = useRef(0)

  const restart = (o: Partial<{ mode: Mode; I: number; nn: number; Te: number; m: number; ni: number; Ppc: number; nonlinear: boolean }> = {}) => {
    const md = o.mode ?? mode
    const s = upOverT(o.I ?? I, LAM, o.Te ?? Te)
    if (md === 'fil') fil.current = makeFil(s, o.m ?? m, NOISES[o.ni ?? ni])
    else beam.current = makeBeam(o.Ppc ?? Ppc, o.nonlinear ?? nonlinear)
    if (imgs.current) {
      imgs.current.fil.data.data.fill(0)
      imgs.current.beam.data.data.fill(0)
    }
    setRead({ meas: null, z: 0, peak: 1, hw: 1, vac: 1, axisMax: 1 })
    setRunning(true)
  }

  // theory for the filamentation readouts
  const th = useMemo(() => {
    const L = (BOX * 2 * Math.PI) / Math.sqrt(s0)
    const K = (2 * Math.PI * m) / L
    const kap = filamentationRate(K, s0)
    return {
      L,
      K,
      kap,
      lamPerpUm: ((2 * Math.PI) / K) * units.x,
      kapUm: kap / units.z,
      fastLamUm: ((2 * Math.PI) / Math.sqrt(s0)) * units.x,
      fastKapUm: s0 / units.z,
    }
  }, [s0, m, units.x, units.z])

  const beamPhys = useMemo(() => {
    const Pc = criticalPowerW('ponderomotive', nn, Te)
    const s0b = (2 * Ppc * TOWNES_N) / (Math.PI * WB * WB)
    const IW = (s0b * Te * 1e3) / ponderomotiveEV(1, LAM) // W/cm² that gives U_p/kT_e = s0 on axis
    return { Pc, P: Ppc * Pc, w0um: WB * units.x, zRum: ((WB * WB) / 4) * units.z, I0: IW }
  }, [nn, Te, Ppc, units.x, units.z])
  const modeRef = useRef(mode)
  modeRef.current = mode
  const viewRef = useRef(view)
  viewRef.current = view

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.3 : 0.64, () => draw(), narrow ? 640 : 480)

  const ensureImgs = () => {
    if (imgs.current) return imgs.current
    const mk = (w: number, h: number) => {
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      const data = cv.getContext('2d')!.createImageData(w, h)
      return { cv, data }
    }
    imgs.current = { fil: mk(NZ, NX), beam: mk(NZB, ROWS_B) }
    return imgs.current
  }

  // ---------- physics per frame ----------
  const advance = () => {
    const t0 = performance.now()
    if (mode === 'fil') {
      const f = fil.current
      const first = f.col
      while (f.col < NZ && performance.now() - t0 < 4 && f.col - first < 4) {
        stepSlab(f.s)
        const j = f.col
        const { re, im } = f.s
        slabDensity(f.s, f.dens)
        let pk = 0
        for (let i = 0; i < NX; i++) {
          const r = (re[i] * re[i] + im[i] * im[i]) / f.s0
          f.I[j * NX + i] = r
          f.N[j * NX + i] = f.dens[i]
          if (r > pk) pk = r
        }
        f.peak[j] = pk
        f.amp[j] = slabMode(f.s, f.m)
        f.zs[j] = f.s.Z
        f.col++
      }
      return [first, f.col] as const
    }
    const st = beam.current
    const first = st.col
    while (st.col < NZB && performance.now() - t0 < 5) {
      const target = ((st.col + 1) * st.Zend) / NZB
      while (st.b.Z < target - 1e-9 && performance.now() - t0 < 5) {
        const h = Math.min(target - st.b.Z, st.ZR / 400, 0.08 / Math.max(radialMaxN(st.b), 0.02))
        stepRadial(st.b, h)
      }
      if (st.b.Z < target - 1e-9) break // out of time: finish this column next frame
      const j = st.col
      for (let k = 0; k < ROWS_B; k++) {
        const x = -XVIEW + ((k + 0.5) * 2 * XVIEW) / ROWS_B
        const s = sAt(st.b, Math.abs(x))
        st.I[j * ROWS_B + k] = s / st.s0
        st.N[j * ROWS_B + k] = Math.exp(-s)
      }
      st.hw[j] = radialHalfWidth(st.b)
      st.axis[j] = radialAxis(st.b) / st.s0
      st.col++
    }
    return [first, st.col] as const
  }

  const paint = (from: number, to: number, view = viewRef.current, mode = modeRef.current) => {
    const im = ensureImgs()
    const isFil = mode === 'fil'
    const target = isFil ? im.fil : im.beam
    const rows = isFil ? NX : ROWS_B
    const cols = isFil ? NZ : NZB
    const src = isFil ? (view === 'I' ? fil.current.I : fil.current.N) : view === 'I' ? beam.current.I : beam.current.N
    const L = view === 'I' ? LUT_I : LUT_N
    const d = target.data.data
    for (let j = from; j < to; j++) {
      for (let k = 0; k < rows; k++) {
        const v = src[j * rows + k]
        const q = view === 'I' ? idxI(v) : idxN(v)
        const p = (k * cols + j) * 4
        d[p] = L[q * 3]
        d[p + 1] = L[q * 3 + 1]
        d[p + 2] = L[q * 3 + 2]
        d[p + 3] = 255
      }
    }
    target.cv.getContext('2d')!.putImageData(target.data, 0, 0)
  }
  const repaintAll = (v: View) => {
    paint(0, modeRef.current === 'fil' ? fil.current.col : beam.current.col, v)
    viewRef.current = v
    draw()
  }

  // ---------- drawing ----------
  const draw = () => {
    const c = canvas.current
    if (!c) return
    const mode = modeRef.current
    const view = viewRef.current
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const stacked = c.clientWidth < 560
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = (stacked ? 10.5 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const im = ensureImgs()
    const isFil = mode === 'fil'
    const padL = 44 * u
    const padR = (isFil ? 12 : 26) * u
    const mapTop = 20 * u
    const mapH = H * (stacked ? 0.5 : 0.56)
    const mapW = W - padL - padR
    // --- the map ---
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(isFil ? im.fil.cv : im.beam.cv, padL, mapTop, mapW, mapH)
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = u
    ctx.strokeRect(padL, mapTop, mapW, mapH)
    const zEndUm = isFil ? (ZEFOLD / s0) * units.z : beam.current.Zend * units.z
    const xHalfUm = isFil ? (th.L / 2) * units.x : XVIEW * units.x
    const col = isFil ? fil.current.col : beam.current.col
    const ncols = isFil ? NZ : NZB
    // marching front
    if (col < ncols) {
      const xf = padL + (col / ncols) * mapW
      ctx.strokeStyle = 'rgba(251,191,36,0.8)'
      ctx.setLineDash([4 * u, 4 * u])
      ctx.beginPath()
      ctx.moveTo(xf, mapTop)
      ctx.lineTo(xf, mapTop + mapH)
      ctx.stroke()
      ctx.setLineDash([])
    }
    // axes labels
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'left'
    ctx.fillText(
      isFil
        ? `${view === 'I' ? 'intensity I/I₀' : 'density n/n₀'}: laser enters at left, z →`
        : `${view === 'I' ? 'intensity I/I₀' : 'density n/n₀'}${stacked ? ', slice through the axis, z →' : ': a slice through the axis of the round beam, z →'}`,
      padL,
      mapTop - 6 * u,
    )
    ctx.textAlign = 'right'
    const fmtUm = (v: number) => (v >= 1000 ? `${(v / 1000).toPrecision(2)} mm` : `${v.toPrecision(2)} µm`)
    ctx.fillText(`+${fmtUm(xHalfUm)}`, padL - 4 * u, mapTop + 9 * u)
    ctx.fillText('x = 0', padL - 4 * u, mapTop + mapH / 2 + 4 * u)
    ctx.fillText(`−${fmtUm(xHalfUm)}`, padL - 4 * u, mapTop + mapH - 2 * u)
    // --- the lower graph ---
    const gTop = mapTop + mapH + 30 * u
    const gH = H - gTop - 26 * u
    const X = (j: number) => padL + (j / ncols) * mapW
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, gTop, mapW, gH)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    const inMm = zEndUm >= 1000
    for (let q = 0; q <= 4; q++) {
      const x = padL + (q / 4) * mapW
      const v = (q / 4) * zEndUm
      ctx.textAlign = q === 0 ? 'left' : q === 4 ? 'right' : 'center'
      ctx.fillText(inMm ? (v / 1000).toFixed(2) : v.toFixed(0), x, gTop + gH + 13 * u)
    }
    ctx.textAlign = 'center'
    ctx.fillText(inMm ? 'z (mm)' : 'z (µm)', padL + mapW / 2, gTop + gH + 24 * u)
    if (isFil) {
      const f = fil.current
      // log axis 1e-3 … 10
      const lo = -3
      const hi = 1
      const Y = (v: number) => gTop + gH - ((Math.log10(Math.max(v, 1e-6)) - lo) / (hi - lo)) * gH
      ctx.strokeStyle = COLORS.grid
      ctx.textAlign = 'right'
      for (let p = lo; p <= hi; p++) {
        ctx.beginPath()
        ctx.moveTo(padL, Y(10 ** p))
        ctx.lineTo(padL + mapW, Y(10 ** p))
        ctx.stroke()
        ctx.fillStyle = COLORS.text
        ctx.fillText(p === 0 ? '1' : p === 1 ? '10' : `10${'⁻'}${'⁰¹²³'[-p]}`, padL - 4 * u, Y(10 ** p) + 4 * u)
      }
      // theory ε cosh(κZ)
      ctx.setLineDash([6 * u, 4 * u])
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 1.6 * u
      ctx.beginPath()
      for (let j = 0; j < NZ; j += 3) {
        const Z = ((j + 1) * ZEFOLD) / s0 / NZ
        const v = EPS * Math.cosh(th.kap * Z)
        if (v > 20) break
        if (j) ctx.lineTo(X(j), Y(v))
        else ctx.moveTo(X(j), Y(v))
      }
      ctx.stroke()
      ctx.setLineDash([])
      glowStroke(ctx, COLORS.magenta, 1.4 * u, () => {
        for (let j = 0; j < f.col; j++) (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(j), Y(f.peak[j]))
      })
      glowStroke(ctx, COLORS.cyan, 1.8 * u, () => {
        for (let j = 0; j < f.col; j++) (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(j), Y(f.amp[j]))
      })
      ctx.textAlign = 'left'
      const ly = gTop - 8 * u
      ctx.fillStyle = COLORS.cyan
      ctx.fillText('ripple amplitude', padL, ly)
      ctx.fillStyle = COLORS.amber
      ctx.fillText(stacked ? 'theory' : 'linear theory ε cosh κz', padL + (stacked ? 100 : 110) * u, ly)
      ctx.fillStyle = COLORS.magenta
      ctx.fillText(stacked ? 'peak I/I₀' : 'brightest point I/I₀', padL + (stacked ? 150 : 260) * u, ly)
    } else {
      const st = beam.current
      let ymax = 2.4
      for (let j = 0; j < st.col; j++) ymax = Math.max(ymax, st.hw[j] / st.h0)
      const Y = (v: number) => gTop + gH - (v / (ymax * 1.05)) * gH
      ctx.strokeStyle = COLORS.grid
      ctx.textAlign = 'right'
      for (let v = 0; v <= ymax; v += 1) {
        ctx.beginPath()
        ctx.moveTo(padL, Y(v))
        ctx.lineTo(padL + mapW, Y(v))
        ctx.stroke()
        ctx.fillStyle = COLORS.cyan
        ctx.fillText(String(v), padL - 4 * u, Y(v) + 4 * u)
      }
      // on-axis intensity on a log scale 0.1 … 1000, labelled on the right
      const Yl = (v: number) => gTop + gH - ((Math.log10(Math.max(v, 0.1)) + 1) / 4) * gH
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.magenta
      for (const [v, t] of [[1, '1'], [10, '10'], [100, '100']] as const) ctx.fillText(t, padL + mapW + 3 * u, Yl(v) + 4 * u)
      ctx.setLineDash([6 * u, 4 * u])
      ctx.strokeStyle = COLORS.amber
      ctx.lineWidth = 1.6 * u
      ctx.beginPath()
      for (let j = 0; j <= NZB; j += 3) {
        const Z = (j * st.Zend) / NZB
        const v = gaussianWidthFactor(Z, WB)
        if (j) ctx.lineTo(X(j), Y(v))
        else ctx.moveTo(X(j), Y(v))
      }
      ctx.stroke()
      ctx.setLineDash([])
      glowStroke(ctx, COLORS.cyan, 1.8 * u, () => {
        for (let j = 0; j < st.col; j++) (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(j + 1), Y(st.hw[j] / st.h0))
      })
      glowStroke(ctx, COLORS.magenta, 1.3 * u, () => {
        for (let j = 0; j < st.col; j++) (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(j + 1), Yl(st.axis[j]))
      })
      ctx.textAlign = 'left'
      const ly = gTop - 8 * u
      ctx.fillStyle = COLORS.cyan
      ctx.fillText(stacked ? 'width' : 'half-max width / initial', padL, ly)
      ctx.fillStyle = COLORS.amber
      ctx.fillText(stacked ? 'vacuum' : 'vacuum diffraction', padL + (stacked ? 42 : 140) * u, ly)
      ctx.fillStyle = COLORS.magenta
      ctx.fillText(stacked ? 'axis I/I₀ (log, right)' : 'on-axis I/I₀ (log scale, right)', padL + (stacked ? 92 : 262) * u, ly)
    }
  }

  // ---------- loop ----------
  useAnimation(
    canvas,
    () => {
      const [a, b] = advance()
      if (b > a) paint(a, b)
      draw()
      if (++frame.current % 6 === 0) {
        if (mode === 'fil') {
          const f = fil.current
          const z0 = Math.min(2 / Math.max(th.kap, 1e-12), 0.45 * (ZEFOLD / s0))
          const meas = th.kap > 0 ? logSlope(f.zs.subarray(0, f.col), f.amp.subarray(0, f.col), z0, Infinity, 0, 0.1) : null
          let pk = 1
          for (let j = 0; j < f.col; j++) pk = Math.max(pk, f.peak[j])
          setRead({ meas, z: f.col ? f.zs[f.col - 1] : 0, peak: pk, hw: 1, vac: 1, axisMax: 1 })
        } else {
          const st = beam.current
          const j = st.col - 1
          let ax = 1
          for (let k = 0; k < st.col; k++) ax = Math.max(ax, st.axis[k])
          setRead({
            meas: null,
            z: st.b.Z,
            peak: 1,
            hw: j >= 0 ? st.hw[j] / st.h0 : 1,
            vac: j >= 0 ? gaussianWidthFactor(((j + 1) * st.Zend) / NZB, WB) : 1,
            axisMax: ax,
          })
        }
        const done = mode === 'fil' ? fil.current.col >= NZ : beam.current.col >= NZB
        if (done) setRunning(false)
      }
    },
    running,
  )

  const switchMode = (md: Mode) => {
    setMode(md)
    modeRef.current = md
    restart({ mode: md })
  }
  const switchView = (v: View) => {
    setView(v)
    repaintAll(v)
  }

  const fmtW = (w: number) => (w >= 1e9 ? `${(w / 1e9).toPrecision(3)} GW` : `${(w / 1e6).toPrecision(3)} MW`)
  const fmtLen = (um: number) => (um >= 1000 ? `${(um / 1000).toFixed(2)} mm` : `${um.toFixed(um < 10 ? 1 : 0)} µm`)
  const okMeas = read.meas !== null && th.kap > 0 && Math.abs(read.meas / th.kap - 1) < 0.05
  const fmtI = (v: number) => {
    const ex = Math.floor(Math.log10(v))
    return `${(v / 10 ** ex).toFixed(1)}×10${String(ex).replace(/[0-9]/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d])}`
  }

  return (
    <SimFrame
      id="beam-breakup"
      title="Beam breakup: filamentation and self-focusing"
      running={running}
      setRunning={(on) => {
        const done = mode === 'fil' ? fil.current.col >= NZ : beam.current.col >= NZB
        if (on && done) restart()
        else setRunning(on)
      }}
      onReset={() => restart()}
      hint="0.351 µm light, cold ions, the plasma in pressure balance with the light (n = n₀e^(−U_p/kT_e)). Filamentation: the box holds 8 wavelengths of the fastest-growing ripple and the window is 9 e-folding lengths long, so the picture rescales as you move the sliders; read the µm on the axes and in the readouts. Try a ripple near K/K_max = 1 (fastest), 0.5, and 1.5 (beyond cut-off: it only wobbles). Switch to density to see the plasma pushed out of each filament. Single beam: below P/P_c = 1 the beam spreads, if more slowly than in vacuum; above it the beam pinches to a bright channel. Untick the nonlinearity to check the code against vacuum diffraction."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn small ${mode === 'fil' ? 'primary' : ''}`} onClick={() => switchMode('fil')}>Filamentation (wide beam)</button>
        <button className={`btn small ${mode === 'beam' ? 'primary' : ''}`} onClick={() => switchMode('beam')}>Single beam (round)</button>
        <button className="btn small" onClick={() => switchView(view === 'I' ? 'n' : 'I')}>Show {view === 'I' ? 'density' : 'intensity'}</button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Laser beam breaking into filaments in a plasma" />
      {mode === 'fil' ? (
        <div className="readouts">
          <span>ripple λ⊥ = <b>{fmtLen(th.lamPerpUm)}</b> (K/K_max = {(m / BOX).toFixed(2)})</span>
          <span>linear theory κ = <b>{th.kap > 0 ? `${(th.kapUm * 1e3).toFixed(2)} mm⁻¹` : 'stable (K > √2 K_max)'}</b></span>
          <span>measured κ = <b className={okMeas ? 'ok' : ''}>{read.meas !== null ? `${((read.meas / units.z) * 1e3).toFixed(2)} mm⁻¹` : th.kap > 0 ? '…' : 'n/a'}</b></span>
          <span>fastest: λ⊥ = <b>{fmtLen(th.fastLamUm)}</b>, e-fold in <b>{fmtLen(1 / th.fastKapUm)}</b></span>
          <span>U_p/kT_e = <b>{s0.toPrecision(2)}</b></span>
          <span>brightest point = <b>{read.peak.toFixed(1)} I₀</b></span>
        </div>
      ) : (
        <div className="readouts">
          <span>P/P_c = <b>{Ppc.toFixed(2)}</b>: P = <b>{fmtW(beamPhys.P)}</b>, P_c = <b>{fmtW(beamPhys.Pc)}</b></span>
          <span>w₀ = <b>{fmtLen(beamPhys.w0um)}</b>, z_R = <b>{fmtLen(beamPhys.zRum)}</b>, I₀ = <b>{fmtI(beamPhys.I0)} W/cm²</b></span>
          <span>half-max width: <b className={!nonlinear && Math.abs(read.hw / read.vac - 1) < 0.01 ? 'ok' : ''}>{read.hw.toFixed(3)}×</b> its start; vacuum diffraction: <b>{read.vac.toFixed(3)}×</b></span>
          <span>peak on-axis intensity = <b>{read.axisMax.toFixed(1)} I₀</b></span>
        </div>
      )}
      <div className="controls">
        {mode === 'fil' && (
          <Slider label="Intensity" value={Math.log10(I)} min={14.3} max={16} step={0.05} onChange={(v) => { setI(10 ** v); restart({ I: 10 ** v }) }} fmt={(v) => `${fmtI(10 ** v)} W/cm²`} />
        )}
        <Slider label="Density n/n_c" value={nn} min={0.03} max={0.25} step={0.01} onChange={(v) => { setNn(v); restart({ nn: v }) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Electron temperature" value={Te} min={0.5} max={5} step={0.1} onChange={(v) => { setTe(v); restart({ Te: v }) }} fmt={(v) => `${v.toFixed(1)} keV`} />
        {mode === 'fil' ? (
          <>
            <Slider label="Ripple wavenumber K/K_max" value={m} min={2} max={12} step={1} onChange={(v) => { setM(v); restart({ m: v }) }} fmt={(v) => (v / BOX).toFixed(3)} />
            <Slider label="Random noise" value={ni} min={0} max={NOISES.length - 1} step={1} onChange={(v) => { setNi(v); restart({ ni: v }) }} fmt={(v) => (NOISES[v] ? `${(NOISES[v] * 100).toFixed(1)}%` : 'off')} />
          </>
        ) : (
          <>
            <Slider label="Beam power P/P_c" value={Ppc} min={0.3} max={3} step={0.05} onChange={(v) => { setPpc(v); restart({ Ppc: v }) }} fmt={(v) => v.toFixed(2)} />
            <label className="small dim" style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={nonlinear} onChange={(e) => { setNonlinear(e.target.checked); restart({ nonlinear: e.target.checked }) }} />
              Plasma response (nonlinear refraction) on
            </label>
          </>
        )}
      </div>
    </SimFrame>
  )
}
