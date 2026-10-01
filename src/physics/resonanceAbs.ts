// B3: resonance absorption of obliquely incident light in a linear density ramp.
//
// Normalized units: the laser frequency ω = 1 and c = 1, so k0 = ω/c = 1, lengths are in c/ω = λ/2π and
// times in 1/ω. The ramp is u(x) = n_e/n_c = x/L for x > 0 (vacuum for x < 0), so the critical surface sits at
// x = L and the parameter k0L is simply L. Light comes from x < 0 with wavevector (k0 cos θ, k0 sin θ, 0):
// the plane of incidence is x–y and k_y = k0 sin θ is conserved.
//
// Collisions enter through the cold-plasma permittivity ε = 1 − u/(1 + iν/ω), with ν ∝ n_e as in lesson B2:
// ν/ω = (ν_c/ω)·u, where ν_c is the collision frequency at the critical density.
//
//   s-polarized (E along z):  E'' + k0²(ε − sin²θ) E = 0
//   p-polarized (H along z):  d/dx[(1/ε) dH/dx] + k0²(1 − sin²θ/ε) H = 0
//                             (equivalently H'' − (ε'/ε)H' + k0²(ε − sin²θ)H = 0)
// With Ĥ = Z0·H_z (so |Ĥ| = |E| for a plane wave in vacuum), Ampère's law gives the electric field of the
// p-polarized wave:  E_x = −sin θ · Ĥ/ε  and  E_y = −i Ĥ'/(k0 ε).  D_x = ε0 ε E_x is smooth, so where ε → 0
// E_x is enormous: that is the resonance.
//
// Both equations are integrated with RK4 from deep in the evanescent (overdense) region toward the vacuum,
// on a non-uniform grid that shrinks the step near the resonance (h ∝ |ε|) and in short-wavelength regions,
// then split into incident and reflected waves at x = 0. For ν → 0 the integration passes the pole of 1/ε
// on a small semicircle in the lower half of the complex x plane, which is exactly the ν → 0+ limit
// (with ν > 0 the zero of ε sits at x = L(1 + iν_c/ω), above the real axis).

export type Pol = 's' | 'p'

/** τ = (k0 L)^{1/3} sin θ, the single parameter of resonance absorption in a linear ramp. */
export function tauOf(k0L: number, theta: number): number {
  return Math.cbrt(k0L) * Math.sin(theta)
}

/** Angle (rad) that gives a chosen τ in a ramp k0L; NaN if τ > (k0L)^{1/3}. */
export function thetaOfTau(k0L: number, tau: number): number {
  const s = tau / Math.cbrt(k0L)
  return s <= 1 ? Math.asin(s) : NaN
}

/** Ginzburg's approximation to the Denisov function: φ(τ) ≈ 2.3 τ exp(−2τ³/3). */
export function denisovPhi(tau: number): number {
  return 2.3 * tau * Math.exp((-2 * tau * tau * tau) / 3)
}

/** Approximate resonance absorption f_A ≈ φ²(τ)/2 (Ginzburg/Kruer). Peaks at τ = 2^{-1/3} = 0.794 with 0.855. */
export function denisovAbs(tau: number): number {
  const p = denisovPhi(tau)
  return (p * p) / 2
}

/** The small-τ constant: 2√π·|Ai′(0)|·√(2π) = 2.300, where φ ≈ 2.3τ becomes exact. */
export const DENISOV_SMALL_TAU = 2 * Math.sqrt(Math.PI) * 0.258819403792806798 * Math.sqrt(2 * Math.PI)

/**
 * Exact resonance absorption of the linear ramp in the limit ν → 0 and k0L → ∞ (where it depends on τ only),
 * tabulated at τ = 0, 0.05, …, 2.5 from the full-wave equation (computed at k0L = 2000 with the complex
 * contour; the Vitest suite re-derives it with this module's solver).
 */
export const EXACT_ABS_TABLE = [
  0, 0.00658, 0.02598, 0.05717, 0.09851, 0.14779, 0.20238, 0.25933, 0.31555, 0.36802, 0.41394, 0.45094, 0.47714,
  0.49125, 0.49282, 0.48228, 0.46066, 0.42945, 0.39082, 0.34729, 0.3011, 0.25469, 0.21013, 0.1689, 0.1323, 0.10084,
  0.0748, 0.05391, 0.03776, 0.02566, 0.01692, 0.0108, 0.00668, 0.004, 0.00231, 0.00129, 0.00069, 0.00036, 0.00018,
  0.00009, 0.00004, 0.00002, 0.00001, 0, 0, 0, 0, 0, 0, 0, 0,
]
export const EXACT_TAU_STEP = 0.05
/** Peak of the exact curve: f_A = 0.494 at τ = 0.681 (Ginzburg's formula puts it at 0.855, τ = 0.794). */
export const TAU_OPT = 0.681
export const F_MAX = 0.4937

/** Exact (ν → 0, large k0L) absorbed fraction at τ, by cubic (Catmull–Rom) interpolation of the table. */
export function exactAbs(tau: number): number {
  if (!(tau >= 0)) return NaN
  const t = tau / EXACT_TAU_STEP
  const n = EXACT_ABS_TABLE.length
  if (t >= n - 1) return 0
  const i = Math.floor(t)
  const f = t - i
  const p = (k: number) => EXACT_ABS_TABLE[Math.max(0, Math.min(n - 1, k))]
  const p0 = i === 0 ? -p(1) : p(i - 1) // f_A is even in τ: f(−0.05) = f(0.05)
  const p1 = p(i)
  const p2 = p(i + 1)
  const p3 = p(i + 2)
  const v = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)))
  return Math.max(0, v)
}

/** Optimum angle (rad) for resonance absorption in a linear ramp k0L, from the exact τ_opt (or another τ). */
export function optimumAngle(k0L: number, tau = TAU_OPT): number {
  return thetaOfTau(k0L, tau)
}

/** B2's WKB result for collisional absorption in a linear ramp with ν ∝ n: 1 − exp(−(32/15)(ν_c/ω) k0L cos⁵θ). */
export function collisionalAbsLinear(nuc: number, k0L: number, theta = 0): number {
  return 1 - Math.exp((-32 / 15) * nuc * k0L * Math.cos(theta) ** 5)
}

// ---------- the full-wave solver ----------

export interface WaveSetup {
  k0L: number // ramp length L in c/ω (the critical surface is at x = L)
  theta: number // angle of incidence, rad
  nuc: number // ν_c/ω at the critical density (ν ∝ n). 0 → exact ν → 0+ limit via the complex contour (p only)
  pol: Pol
}

export interface WaveSolution {
  fA: number // absorbed fraction 1 − |r|²
  rRe: number
  rIm: number
  /** Power dissipated by collisions, ∫ (k0/cos θ) Im ε |E|² dx, as a fraction of the incident power (0 if ν = 0). */
  fDiss: number
  /** sample positions (c/ω), increasing; only real-axis points are stored */
  x: number[]
  /** p: Ĥ = Z0 H_z (= |E| in vacuum);  s: E_z. Normalized so the incident wave has amplitude 1. */
  fRe: number[]
  fIm: number[]
  /** p only: |E_x| and |E_y| (incident amplitude 1); for s these are |E_z| and 0 */
  ex: number[]
  ey: number[]
  /** |D_x/ε0| = sin θ |Ĥ| at x = L (p), the field that drives the resonance */
  driver: number
  steps: number
}

interface C {
  re: number
  im: number
}

/** ε = 1 − u/(1 + iν_c u) at complex position x (ramp u = x/L for Re x > 0). */
function epsAt(xr: number, xi: number, L: number, nuc: number, out: C) {
  if (xr <= 0 && xi === 0) {
    out.re = 1
    out.im = 0
    return
  }
  const ur = xr / L
  const ui = xi / L
  // d = 1 + i ν_c u
  const dr = 1 - nuc * ui
  const di = nuc * ur
  const dd = dr * dr + di * di
  // u/d
  const qr = (ur * dr + ui * di) / dd
  const qi = (ui * dr - ur * di) / dd
  out.re = 1 - qr
  out.im = -qi
}

const eTmp: C = { re: 0, im: 0 }

/**
 * Right-hand side at complex x. y = [a_re, a_im, b_re, b_im].
 *   p: a = H, b = G = H'/ε:   H' = ε G,  G' = −(1 − s²/ε) H
 *   s: a = E, b = E':        E' = b,    b' = −(ε − s²) E
 * Writes dy/dx into dy.
 */
function rhs(pol: Pol, xr: number, xi: number, L: number, nuc: number, s2: number, y: Float64Array, dy: Float64Array) {
  epsAt(xr, xi, L, nuc, eTmp)
  const er = eTmp.re
  const ei = eTmp.im
  const ar = y[0]
  const ai = y[1]
  const br = y[2]
  const bi = y[3]
  if (pol === 'p') {
    dy[0] = er * br - ei * bi
    dy[1] = er * bi + ei * br
    // 1 − s²/ε
    const ee = er * er + ei * ei
    const cr = 1 - (s2 * er) / ee
    const ci = (s2 * ei) / ee
    dy[2] = -(cr * ar - ci * ai)
    dy[3] = -(cr * ai + ci * ar)
  } else {
    dy[0] = br
    dy[1] = bi
    const cr = er - s2
    const ci = ei
    dy[2] = -(cr * ar - ci * ai)
    dy[3] = -(cr * ai + ci * ar)
  }
}

const k1 = new Float64Array(4)
const k2 = new Float64Array(4)
const k3 = new Float64Array(4)
const k4 = new Float64Array(4)
const yt = new Float64Array(4)

/** One RK4 step along a straight segment in the complex x plane: x → x + (hr + i hi). */
function rk4(pol: Pol, xr: number, xi: number, hr: number, hi: number, L: number, nuc: number, s2: number, y: Float64Array) {
  // dy/dt = h f(x + t h), t ∈ [0, 1], with complex h: multiply each derivative by h
  const mul = (k: Float64Array) => {
    const a = k[0] * hr - k[1] * hi
    const b = k[0] * hi + k[1] * hr
    const c = k[2] * hr - k[3] * hi
    const d = k[2] * hi + k[3] * hr
    k[0] = a
    k[1] = b
    k[2] = c
    k[3] = d
  }
  rhs(pol, xr, xi, L, nuc, s2, y, k1)
  mul(k1)
  for (let j = 0; j < 4; j++) yt[j] = y[j] + 0.5 * k1[j]
  rhs(pol, xr + 0.5 * hr, xi + 0.5 * hi, L, nuc, s2, yt, k2)
  mul(k2)
  for (let j = 0; j < 4; j++) yt[j] = y[j] + 0.5 * k2[j]
  rhs(pol, xr + 0.5 * hr, xi + 0.5 * hi, L, nuc, s2, yt, k3)
  mul(k3)
  for (let j = 0; j < 4; j++) yt[j] = y[j] + k3[j]
  rhs(pol, xr + hr, xi + hi, L, nuc, s2, yt, k4)
  mul(k4)
  for (let j = 0; j < 4; j++) y[j] += (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6
}

/** Airy width of the ramp, δ = (L/k0²)^{1/3}. */
export const airyWidth = (k0L: number) => Math.cbrt(k0L)

/**
 * Full-wave solution for one angle. Set store = false for a fast absorption-only solve (used for sweeps).
 * Accuracy: |f_A error| < 1e-3 for 6 ≤ k0L ≤ 2000 and ν_c/ω ≥ 1e-7 (checked against SciPy's DOP853 at
 * rtol 1e-10 and an independent finite-difference solve).
 */
export function solveWave(w: WaveSetup, store = true): WaveSolution {
  const L = w.k0L
  const s = Math.sin(w.theta)
  const s2 = s * s
  const kx = Math.cos(w.theta)
  const nuc = w.nuc
  const pol = w.pol
  const delta = airyWidth(L)
  const xTurn = L * kx * kx
  const contour = pol === 'p' && nuc === 0
  const rC = Math.min(0.5 * delta, 0.4 * L) // contour radius around the pole (ν = 0)
  // start deep enough that the evanescent field has fallen by ~e^-28 from the turning point, and past n_c
  let x = Math.max(L + 4 * delta, xTurn + 12 * delta)
  // decaying solution there (local WKB): a = 1, a' = −κ a, κ = √(s² − ε)
  epsAt(x, 0, L, nuc, eTmp)
  let kr: number
  let ki: number
  {
    const zr = s2 - eTmp.re
    const zi = -eTmp.im
    const m = Math.hypot(zr, zi)
    kr = Math.sqrt((m + zr) / 2)
    ki = (zi >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, (m - zr) / 2))
  }
  const y = new Float64Array(4)
  y[0] = 1
  y[1] = 0
  if (pol === 'p') {
    // G = H'/ε = −κ/ε
    const er = eTmp.re
    const ei = eTmp.im
    const ee = er * er + ei * ei
    y[2] = -(kr * er + ki * ei) / ee
    y[3] = -(ki * er - kr * ei) / ee
  } else {
    y[2] = -kr
    y[3] = -ki
  }

  const xs: number[] = []
  const aR: number[] = []
  const aI: number[] = []
  const bR: number[] = []
  const bI: number[] = []
  const scaleIdx: number[] = []
  let rescales = 0
  const record = () => {
    if (!store) return
    xs.push(x)
    aR.push(y[0])
    aI.push(y[1])
    bR.push(y[2])
    bI.push(y[3])
    scaleIdx.push(rescales)
  }
  const renorm = () => {
    const m = Math.abs(y[0]) + Math.abs(y[1]) + Math.abs(y[2]) + Math.abs(y[3])
    if (m > 1e100) {
      for (let j = 0; j < 4; j++) y[j] *= 1e-100
      rescales++
    }
  }
  record()

  const hMax = Math.min(0.25, delta / 8)
  const cw = 0.15 // step × local wavenumber
  const cr = 0.04 // step / distance to the pole, near the resonance
  let steps = 0
  // step size at real x
  const stepAt = (xx: number) => {
    epsAt(xx, 0, L, nuc, eTmp)
    const kl = Math.sqrt(Math.hypot(eTmp.re - s2, eTmp.im))
    let h = Math.min(hMax, cw / Math.max(kl, 1e-9))
    if (pol === 'p') {
      const dist = L * Math.hypot(eTmp.re, eTmp.im) // ≈ distance to the zero of ε
      h = Math.min(h, Math.max(cr * dist, 1e-9))
    }
    return h
  }
  const march = (xEnd: number) => {
    while (x > xEnd + 1e-12) {
      let h = stepAt(x)
      // keep the step from overshooting where the step size must shrink (look ahead once)
      h = Math.min(h, stepAt(Math.max(xEnd, x - h)) * 1.5)
      if (x - h < xEnd) h = x - xEnd
      rk4(pol, x, 0, -h, 0, L, nuc, s2, y)
      x -= h
      steps++
      renorm()
      record()
    }
  }

  if (contour) {
    march(L + rC)
    // semicircle below the pole: x = L + rC e^{iφ}, φ from 0 to −π
    const nArc = 96
    for (let k = 0; k < nArc; k++) {
      const p0 = (-Math.PI * k) / nArc
      const p1 = (-Math.PI * (k + 1)) / nArc
      const x0r = L + rC * Math.cos(p0)
      const x0i = rC * Math.sin(p0)
      const x1r = L + rC * Math.cos(p1)
      const x1i = rC * Math.sin(p1)
      rk4(pol, x0r, x0i, x1r - x0r, x1i - x0i, L, nuc, s2, y)
      steps++
    }
    x = L - rC
    renorm()
    record()
  }
  march(0)

  // at x = 0 (vacuum side): a = A + B, a' = i kx (A − B)  (a' = ε b = b for p, b for s)
  const ar = y[0]
  const ai = y[1]
  const dr = y[2]
  const di = y[3]
  // a'/(i kx) = (dr + i di)/(i kx) = (di − i dr)/kx
  const qr = di / kx
  const qi = -dr / kx
  const Ar = 0.5 * (ar + qr)
  const Ai = 0.5 * (ai + qi)
  const Br = 0.5 * (ar - qr)
  const Bi = 0.5 * (ai - qi)
  const AA = Ar * Ar + Ai * Ai
  const rRe = (Br * Ar + Bi * Ai) / AA
  const rIm = (Bi * Ar - Br * Ai) / AA
  const fA = 1 - (rRe * rRe + rIm * rIm)

  const sol: WaveSolution = { fA, rRe, rIm, fDiss: 0, x: [], fRe: [], fIm: [], ex: [], ey: [], driver: NaN, steps }
  if (!store) return sol

  // normalize by the incident amplitude A, undo the rescalings, reverse to increasing x
  const n = xs.length
  const out = sol
  let diss = 0
  let prevX = NaN
  let prevD = 0
  let driver = NaN
  let bestDist = Infinity
  for (let k = n - 1; k >= 0; k--) {
    const sc = 10 ** (-100 * (rescales - scaleIdx[k]))
    // (a, b)/A
    const fr = ((aR[k] * Ar + aI[k] * Ai) / AA) * sc
    const fi = ((aI[k] * Ar - aR[k] * Ai) / AA) * sc
    const gr = ((bR[k] * Ar + bI[k] * Ai) / AA) * sc
    const gi = ((bI[k] * Ar - bR[k] * Ai) / AA) * sc
    const xx = xs[k]
    epsAt(xx, 0, L, nuc, eTmp)
    const er = eTmp.re
    const ei = eTmp.im
    let ex2: number
    let ey2: number
    if (pol === 'p') {
      const ee = er * er + ei * ei
      // E_x = −s H/ε, E_y = −i G
      ex2 = (s2 * (fr * fr + fi * fi)) / ee
      ey2 = gr * gr + gi * gi
      const d = Math.abs(xx - L)
      if (d < bestDist) {
        bestDist = d
        driver = s * Math.hypot(fr, fi)
      }
    } else {
      ex2 = fr * fr + fi * fi
      ey2 = 0
    }
    out.x.push(xx)
    out.fRe.push(fr)
    out.fIm.push(fi)
    out.ex.push(Math.sqrt(ex2))
    out.ey.push(Math.sqrt(ey2))
    // dissipation density Im ε |E|² (Im ε > 0 for absorption)
    const dens = ei * (ex2 + ey2)
    if (prevX === prevX) diss += 0.5 * (dens + prevD) * (xx - prevX)
    prevX = xx
    prevD = dens
  }
  out.fDiss = (diss * 1) / kx // k0 = 1
  out.driver = driver
  return out
}

/** Absorbed fraction only (fast). nuc = 0 with p gives the pure resonance part (ν → 0+). */
export function absorption(k0L: number, theta: number, nuc: number, pol: Pol): number {
  return solveWave({ k0L, theta, nuc, pol }, false).fA
}

/** Collisional absorption of a p-polarized wave minus the resonance part is not additive; this returns
 *  the resonance absorption alone in the exact ν → 0 limit. */
export function resonanceOnly(k0L: number, theta: number): number {
  return absorption(k0L, theta, 0, 'p')
}
