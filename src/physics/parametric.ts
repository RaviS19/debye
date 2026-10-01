// B5: parametric instabilities. Three tools:
//   - the matching conditions ω0 = ω1 + ω2, k0 = k1 + k2 solved exactly with fluid dispersion relations for
//     light, electron plasma (Bohm–Gross) and ion acoustic waves, in any direction (the "triangle builder");
//   - two oscillators coupled through a pump (Kruer's model of a parametric instability), integrated with RK4,
//     with the analytic growth rates of the decay instability and of the purely growing (OTSI-like) mode;
//   - the Rosenbluth gain of an instability in an inhomogeneous plasma.
//
// Normalized units for the wave-matching part: the pump (laser) frequency ω0 = 1 and c = 1, so wavenumbers are
// in ω0/c (the vacuum laser wavenumber is 1) and lengths in c/ω0 = λ0/2π. The plasma is described by
// nn = n_e/n_c (so ω_pe² = nn), v_te² = kT_e/m_e (A5's convention), and the ion sound speed
// c_s² = (Z kT_e + 3 kT_i)/M with M = A·amu.
import { c, e, me } from './constants'

export const AMU = 1.6605390666e-27 // atomic mass unit, kg
export const MEC2_KEV = (me * c * c) / e / 1e3 // electron rest energy, 511.0 keV

export type WaveKind = 'light' | 'epw' | 'iaw'
export type Process = 'SRS' | 'SBS' | 'TPD' | 'IAD'
/** The two daughters of each three-wave process. Daughter 1 is the one whose direction the user picks. */
export const PROCESS_WAVES: Record<Process, [WaveKind, WaveKind]> = {
  SRS: ['light', 'epw'],
  SBS: ['light', 'iaw'],
  TPD: ['epw', 'epw'],
  IAD: ['epw', 'iaw'],
}

export interface Plasma {
  nn: number // n_e / n_c
  TeKeV: number
  TiKeV: number
  Z: number
  A: number
}

/** Plasma in normalized units (ω0 = c = 1). */
export interface Norm {
  nn: number // ω_pe² / ω0²
  vte2: number // v_te² / c² = kT_e / m_e c²
  cs: number // c_s / c
}

export function normalize(p: Plasma): Norm {
  return {
    nn: p.nn,
    vte2: p.TeKeV / MEC2_KEV,
    cs: Math.sqrt(((p.Z * p.TeKeV + 3 * p.TiKeV) * 1e3 * e) / (p.A * AMU)) / c,
  }
}

/** Frequency of a wave of kind `kind` and wavenumber magnitude k (ω0 = c = 1). */
export function omegaOf(kind: WaveKind, k: number, N: Norm): number {
  if (kind === 'light') return Math.sqrt(N.nn + k * k)
  if (kind === 'epw') return Math.sqrt(N.nn + 3 * k * k * N.vte2)
  return k * N.cs
}

/** Group velocity dω/dk (in units of c). */
export function groupVelocity(kind: WaveKind, k: number, N: Norm): number {
  if (kind === 'light') return k / Math.sqrt(N.nn + k * k)
  if (kind === 'epw') return (3 * k * N.vte2) / Math.sqrt(N.nn + 3 * k * k * N.vte2)
  return N.cs
}

/** kλ_De for a wavenumber k in ω0/c: λ_De = v_te/ω_pe. */
export const kLambdaDe = (k: number, N: Norm) => (k * Math.sqrt(N.vte2)) / Math.sqrt(N.nn)

/** Pump (laser) wavenumber in the plasma, √(1 − n/n_c). */
export const pumpK = (N: Norm) => Math.sqrt(Math.max(0, 1 - N.nn))

export interface Match {
  kinds: [WaveKind, WaveKind]
  k0: number
  k1: [number, number] // daughter 1 wavevector (x along the pump)
  k2: [number, number] // daughter 2 = k0 − k1
  w1: number
  w2: number
  /** every root found along the chosen direction (|k1| values); the largest is used */
  roots: number[]
}

/**
 * Solve the matching conditions for daughter 1 travelling at angle θ (radians) to the pump:
 * find |k1| with 1 − ω1(|k1|) − ω2(|k0 − k1|) = 0. Scans |k1| ∈ (0, k_max], where ω1(k_max) = 1, for sign
 * changes and refines each by bisection to machine precision. Returns the root with the largest |k1|
 * (for SRS, SBS and ion-acoustic decay there is only one), or null if the process cannot be matched.
 */
export function solveMatching(proc: Process, N: Norm, theta: number, scan = 600): Match | null {
  if (!(N.nn > 0 && N.nn < 1)) return null
  const kinds = PROCESS_WAVES[proc]
  const k0 = pumpK(N)
  const ux = Math.cos(theta)
  const uy = Math.sin(theta)
  const f = (k: number) => 1 - omegaOf(kinds[0], k, N) - omegaOf(kinds[1], Math.hypot(k0 - k * ux, -k * uy), N)
  const kmax = kinds[0] === 'light' ? k0 : Math.sqrt((1 - N.nn) / (3 * N.vte2))
  const roots: number[] = []
  let ka = 0
  let fa = f(0)
  for (let i = 1; i <= scan; i++) {
    const kb = (kmax * i) / scan
    const fb = f(kb)
    if ((fa > 0 && fb <= 0) || (fa < 0 && fb >= 0)) {
      let a = ka
      let b = kb
      let fl = fa
      for (let it = 0; it < 200 && b - a > 1e-15 * kmax; it++) {
        const m = 0.5 * (a + b)
        const fm = f(m)
        if (fm > 0 === fl > 0) {
          a = m
          fl = fm
        } else b = m
      }
      roots.push(0.5 * (a + b))
    }
    ka = kb
    fa = fb
  }
  if (!roots.length) return null
  const k1 = Math.max(...roots)
  const K1: [number, number] = [k1 * ux, k1 * uy]
  const K2: [number, number] = [k0 - K1[0], -K1[1]]
  const k2 = Math.hypot(K2[0], K2[1])
  if (k2 < 1e-7 * k0) return null // degenerate: exactly forward SBS has no ion wave
  return { kinds, k0, k1: K1, k2: K2, w1: omegaOf(kinds[0], k1, N), w2: omegaOf(kinds[1], k2, N), roots }
}

/** Magnitude of a 2-vector. */
export const mag = (v: [number, number]) => Math.hypot(v[0], v[1])

// ---------- fast 1D backscatter solvers (used by plots and growth-rate maps) ----------

export interface Backscatter {
  k0: number // pump wavenumber
  ks: number // |k| of the backscattered light (travelling in −x)
  ws: number // its frequency
  k: number // wavenumber of the driven plasma or ion wave, k = k0 + ks
  w: number // its frequency
}

function backscatter(N: Norm, kind: 'epw' | 'iaw'): Backscatter | null {
  if (!(N.nn > 0 && N.nn < 1)) return null
  const k0 = pumpK(N)
  // h(k) = 1 − ω_wave(k) − ω_light(k − k0) for k ∈ [k0, 2k0]; decreasing in k
  const h = (k: number) => 1 - omegaOf(kind, k, N) - Math.sqrt(N.nn + (k - k0) * (k - k0))
  let a = k0
  let b = 2 * k0
  if (!(h(a) > 0)) return null
  for (let it = 0; it < 100 && b - a > 1e-16 * k0; it++) {
    const m = 0.5 * (a + b)
    if (h(m) > 0) a = m
    else b = m
  }
  const k = 0.5 * (a + b)
  const w = omegaOf(kind, k, N)
  return { k0, ks: k - k0, ws: 1 - w, k, w }
}

/** SRS backscatter: light → backscattered light + electron plasma wave. Null at or above about n_c/4. */
export const srsBackscatter = (N: Norm) => backscatter(N, 'epw')
/** SBS backscatter: light → backscattered light + ion acoustic wave. */
export const sbsBackscatter = (N: Norm) => backscatter(N, 'iaw')

/** Wavelength (same units as lam0) of light at frequency w (in units of ω0). */
export const wavelengthOf = (lam0: number, w: number) => lam0 / w

// ---------- coupled oscillators driven by a pump ----------
//   x1'' + 2Γ1 x1' + ω1² x1 = c1 E(t) x2
//   x2'' + 2Γ2 x2' + ω2² x2 = c2 E(t) x1,   E(t) = 2E0 cos ω0 t
// Γ1, Γ2 are amplitude damping rates: a free oscillator decays as e^(−Γt).

export interface OscParams {
  w1: number
  w2: number
  w0: number
  c1: number
  c2: number
  E0: number
  G1: number
  G2: number
}

export interface OscState {
  t: number
  y: Float64Array // x1, v1, x2, v2
}

const K1 = new Float64Array(4)
const K2 = new Float64Array(4)
const K3 = new Float64Array(4)
const K4 = new Float64Array(4)
const YT = new Float64Array(4)

function oscRhs(p: OscParams, t: number, y: Float64Array, out: Float64Array) {
  const E = 2 * p.E0 * Math.cos(p.w0 * t)
  out[0] = y[1]
  out[1] = -2 * p.G1 * y[1] - p.w1 * p.w1 * y[0] + p.c1 * E * y[2]
  out[2] = y[3]
  out[3] = -2 * p.G2 * y[3] - p.w2 * p.w2 * y[2] + p.c2 * E * y[0]
}

/** One classical RK4 step of the pumped oscillators. */
export function stepOsc(p: OscParams, s: OscState, dt: number): void {
  const y = s.y
  const t = s.t
  oscRhs(p, t, y, K1)
  for (let i = 0; i < 4; i++) YT[i] = y[i] + 0.5 * dt * K1[i]
  oscRhs(p, t + 0.5 * dt, YT, K2)
  for (let i = 0; i < 4; i++) YT[i] = y[i] + 0.5 * dt * K2[i]
  oscRhs(p, t + 0.5 * dt, YT, K3)
  for (let i = 0; i < 4; i++) YT[i] = y[i] + dt * K3[i]
  oscRhs(p, t + dt, YT, K4)
  for (let i = 0; i < 4; i++) y[i] += (dt / 6) * (K1[i] + 2 * K2[i] + 2 * K3[i] + K4[i])
  s.t = t + dt
}

/** Oscillation amplitude √(x² + (v/ω)²) of oscillator j (0 or 1); for ω → 0 it falls back to |x|, |v|. */
export function oscAmplitude(y: Float64Array, j: 0 | 1, w: number): number {
  const x = y[2 * j]
  const v = y[2 * j + 1]
  return Math.sqrt(x * x + (v * v) / Math.max(w * w, 1e-6))
}

/** Undamped, exactly matched growth rate of the decay instability: γ0² = c1c2E0²/(4ω1ω2). */
export function gamma0Of(p: OscParams): number {
  const q = (p.c1 * p.c2 * p.E0 * p.E0) / (4 * p.w1 * p.w2)
  return q > 0 ? Math.sqrt(q) : 0
}

/** Frequency mismatch Δ = ω0 − ω1 − ω2. */
export const mismatchOf = (p: OscParams) => p.w0 - p.w1 - p.w2

/** Complex square root of (re, im), principal branch. */
function csqrt(re: number, im: number): [number, number] {
  const r = Math.hypot(re, im)
  const a = Math.sqrt(Math.max(0, (r + re) / 2))
  const b = Math.sqrt(Math.max(0, (r - re) / 2))
  return [a, im < 0 ? -b : b]
}

/**
 * Growth rate of the decay instability near ω0 ≈ ω1 + ω2 (resonant, two-wave truncation): the largest
 * imaginary part of δ solving (δ + iΓ1)(δ − Δ + iΓ2) = −γ0². Undamped: √(γ0² − Δ²/4); matched:
 * −(Γ1+Γ2)/2 + √((Γ1−Γ2)²/4 + γ0²), whose threshold is γ0² = Γ1Γ2. Negative means damped.
 */
export function decayGrowth(g0: number, D: number, G1: number, G2: number): number {
  // δ² + bδ + c = 0 with b = −Δ + i(Γ1+Γ2), c = γ0² − Γ1Γ2 − iΓ1Δ
  const br = -D
  const bi = G1 + G2
  const cr = g0 * g0 - G1 * G2
  const ci = -G1 * D
  const dr = br * br - bi * bi - 4 * cr
  const di = 2 * br * bi - 4 * ci
  const si = csqrt(dr, di)[1]
  return Math.max((-bi + si) / 2, (-bi - si) / 2)
}

/**
 * Purely growing mode (oscillating two-stream type): the low-frequency oscillator 2 at ω = iγ couples to
 * both sidebands of oscillator 1 at ±ω0. Exact for that three-mode truncation:
 *   γ² + 2Γ2γ + ω2² = 2c1c2E0² P / (P² + 4ω0²(γ + Γ1)²),   P = ω1² − ω0² + γ² + 2Γ1γ.
 * Returns the largest root γ > 0, or 0 if there is none.
 */
export function purelyGrowing(p: OscParams): number {
  const C2 = 2 * p.c1 * p.c2 * p.E0 * p.E0
  const f = (g: number) => {
    const P = p.w1 * p.w1 - p.w0 * p.w0 + g * g + 2 * p.G1 * g
    return g * g + 2 * p.G2 * g + p.w2 * p.w2 - (C2 * P) / (P * P + 4 * p.w0 * p.w0 * (g + p.G1) ** 2)
  }
  // scan from large γ down for the first sign change
  const gMax = 2 * (Math.abs(p.c1 * p.c2) * p.E0 * p.E0 + p.w1 + p.w0)
  const n = 4000
  let gb = gMax
  let fb = f(gb)
  for (let i = n - 1; i >= 0; i--) {
    const ga = (gMax * i) / n
    const fa = f(ga)
    if (fa <= 0 && fb > 0) {
      let a = ga
      let b = gb
      for (let it = 0; it < 100; it++) {
        const m = 0.5 * (a + b)
        if (f(m) > 0) b = m
        else a = m
      }
      return 0.5 * (a + b)
    }
    gb = ga
    fb = fa
  }
  return 0
}

/** Least-squares slope of y against t over samples with t0 ≤ t ≤ t1. */
export function fitSlope(ts: ArrayLike<number>, ys: ArrayLike<number>, t0: number, t1: number): number | null {
  let n = 0
  let st = 0
  let sy = 0
  let stt = 0
  let sty = 0
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    if (t < t0 || t > t1 || !isFinite(ys[i])) continue
    n++
    st += t
    sy += ys[i]
    stt += t * t
    sty += t * ys[i]
  }
  if (n < 8) return null
  const d = n * stt - st * st
  return d > 0 ? (n * sty - st * sy) / d : null
}

/** Integrate the pumped oscillators to time T from a small seed in x1 and fit the growth rate of oscillator 1's
 *  amplitude over the second half of the run. */
export function measureOscGrowth(p: OscParams, T: number, dt = 0.04, seed = 1e-6): { gamma: number; ts: number[]; lnA: number[] } {
  const s: OscState = { t: 0, y: new Float64Array([seed, 0, 0, 0]) }
  const ts: number[] = []
  const lnA: number[] = []
  const every = Math.max(1, Math.round(0.25 / dt))
  let i = 0
  while (s.t < T - 1e-9) {
    stepOsc(p, s, dt)
    if (++i % every === 0) {
      ts.push(s.t)
      lnA.push(Math.log(oscAmplitude(s.y, 0, p.w1)))
    }
  }
  return { gamma: fitSlope(ts, lnA, T / 2, T) ?? NaN, ts, lnA }
}

// ---------- Manley–Rowe and the Rosenbluth gain ----------

/** Energy shares of the two daughters: each pump quantum ħω0 splits into ħω1 + ħω2. */
export const manleyRoweShares = (w1: number, w2: number) => [w1 / (w1 + w2), w2 / (w1 + w2)] as const

/**
 * Rosenbluth intensity gain exponent for a linear wavenumber mismatch κ(x) = κ′x, κ = k0 − k1 − k2 (signed
 * components along the gradient, each at its fixed frequency): G = 2πγ0²/|κ′ v1 v2|, with v1, v2 the daughters'
 * group velocities. Any consistent units (e.g. γ0 in ω0, κ′ in (ω0/c)², v in c).
 */
export const rosenbluthGain = (g0: number, kappaPrime: number, v1: number, v2: number) =>
  (2 * Math.PI * g0 * g0) / Math.abs(kappaPrime * v1 * v2)

/**
 * κ′ for SRS backscatter in a density gradient with scale length L (n/(dn/dx), in c/ω0), from the local
 * dispersion relations at fixed frequencies: dk/dx = −(n/L)/(2k) for light and −(n/L)/(6k v_te²) for the
 * plasma wave. The scattered light travels in −x, so κ′ = dk0/dx + dks/dx − dk/dx.
 */
export function srsKappaPrime(N: Norm, b: Backscatter, L: number): number {
  return -(N.nn / (2 * L)) * (1 / b.k0 + 1 / b.ks) + N.nn / (6 * b.k * N.vte2 * L)
}
