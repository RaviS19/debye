// The plasma dispersion function and the kinetic (Vlasov) dispersion relations of lesson A9.
//
// Z(ζ) = i√π w(ζ), where w is the Faddeeva function, w(z) = e^{−z²} erfc(−iz).
// w is computed with Weideman's rational expansion (SIAM J. Numer. Anal. 31, 1497, 1994) with N = 32
// terms, accurate to about 1e−12 in the upper half plane; the lower half plane uses
// w(z) = 2e^{−z²} − w(−z). Z is the analytic continuation Landau's prescription asks for.
//
// Units throughout: ω in ω_pe, k in 1/λ_De, velocities in v_th = √(kT_e/m_e) (so λ_De = v_th/ω_pe).

export type C = [number, number] // complex number [re, im]

const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]]
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const cdiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1]
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
}
const cexp = (a: C): C => {
  const m = Math.exp(a[0])
  return [m * Math.cos(a[1]), m * Math.sin(a[1])]
}

// ---- Weideman coefficients (computed once) ----
const WN = 32
const WL = Math.sqrt(WN / Math.SQRT2)
const WA: number[] = (() => {
  const M = 2 * WN
  const M2 = 2 * M
  // f at t_k = L tan(θ_k/2), θ_k = kπ/M, k = −M+1..M−1, with f(−M) = 0 prepended (MATLAB order)
  const f = new Array<number>(M2).fill(0)
  for (let k = -M + 1; k <= M - 1; k++) {
    const t = WL * Math.tan((k * Math.PI) / M / 2)
    f[k + M] = Math.exp(-t * t) * (WL * WL + t * t)
  }
  // fftshift then real part of the DFT, divided by M2
  const g = new Array<number>(M2)
  for (let i = 0; i < M2; i++) g[i] = f[(i + M) % M2]
  const a = new Array<number>(WN)
  for (let m = 1; m <= WN; m++) {
    let s = 0
    for (let i = 0; i < M2; i++) s += g[i] * Math.cos((2 * Math.PI * m * i) / M2)
    a[m - 1] = s / M2
  }
  return a.reverse() // highest power first, for Horner
})()

/** Faddeeva function w(z) for Im z ≥ 0. */
function wUpper(z: C): C {
  const lmiz: C = [WL + z[1], -z[0]] // L − iz
  const lpiz: C = [WL - z[1], z[0]] // L + iz
  const Z = cdiv(lpiz, lmiz)
  let p: C = [WA[0], 0]
  for (let i = 1; i < WN; i++) p = cadd(cmul(p, Z), [WA[i], 0])
  const l2 = cmul(lmiz, lmiz)
  const t1 = cdiv([2 * p[0], 2 * p[1]], l2)
  const t2 = cdiv([1 / Math.sqrt(Math.PI), 0], lmiz)
  return cadd(t1, t2)
}

/** Faddeeva function w(z) = e^{−z²} erfc(−iz), for any complex z. */
export function faddeeva(z: C): C {
  if (z[1] >= 0) return wUpper(z)
  const wm = wUpper([-z[0], -z[1]])
  const e = cexp([-(z[0] * z[0] - z[1] * z[1]), -2 * z[0] * z[1]])
  return [2 * e[0] - wm[0], 2 * e[1] - wm[1]]
}

/** Plasma dispersion function Z(ζ) = i√π w(ζ). */
export function plasmaZ(z: C): C {
  const w = faddeeva(z)
  const s = Math.sqrt(Math.PI)
  return [-s * w[1], s * w[0]]
}

/** Susceptibility of one Maxwellian species: χ = (n/(k² v_t²)) [1 + ζ Z(ζ)], ζ = (ω − k u)/(√2 k v_t).
 *  n is the species density as a fraction of the reference (so ω_ps² = n ω_pe² for electrons). */
export function chiMaxwellian(w: C, k: number, n: number, u: number, vt: number): C {
  const s = Math.SQRT2 * k * vt
  const zeta: C = [(w[0] - k * u) / s, w[1] / s]
  const zz = cmul(zeta, plasmaZ(zeta))
  const f = n / (k * k * vt * vt)
  return [f * (1 + zz[0]), f * zz[1]]
}

export interface Species {
  n: number // density (electrons: fraction of n0; the sum over electron species is 1)
  u: number // drift velocity (units of v_th)
  vt: number // thermal speed √(kT/m) (units of v_th)
}

/** Dielectric function ε(ω, k) = 1 + Σ χ_s for drifting Maxwellian electron populations. */
export function epsilon(w: C, k: number, sp: Species[]): C {
  let e: C = [1, 0]
  for (const s of sp) e = cadd(e, chiMaxwellian(w, k, s.n, s.u, s.vt))
  return e
}

/** Newton iteration on f(ω) = 0 from a starting guess, with a numerical complex derivative. */
export function complexRoot(f: (w: C) => C, guess: C, maxStep = 0.3): C | null {
  let w: C = [guess[0], guess[1]]
  for (let it = 0; it < 100; it++) {
    const fw = f(w)
    const h = 1e-6
    const fp = f([w[0] + h, w[1]])
    const d: C = [(fp[0] - fw[0]) / h, (fp[1] - fw[1]) / h] // analytic: df/dω = ∂f/∂ω_r
    let dw = cdiv(fw, d)
    const m = Math.hypot(dw[0], dw[1])
    if (!isFinite(m)) return null
    if (m > maxStep) dw = [(dw[0] * maxStep) / m, (dw[1] * maxStep) / m]
    w = [w[0] - dw[0], w[1] - dw[1]]
    if (m < 1e-12) {
      const r = f(w)
      return Math.hypot(r[0], r[1]) < 1e-8 ? w : null
    }
  }
  const r = f(w)
  return Math.hypot(r[0], r[1]) < 1e-8 ? w : null
}

const MAXWELLIAN: Species[] = [{ n: 1, u: 0, vt: 1 }]

/** Least-damped Langmuir-wave root ω = ω_r + iγ of a Maxwellian plasma at kλ_D = k. */
export function landauRoot(k: number, guess?: C): C | null {
  return complexRoot((w) => epsilon(w, k, MAXWELLIAN), guess ?? [Math.sqrt(1 + 3 * k * k), -landauApprox(k)])
}

/** Small-kλ_D estimate of the damping rate, as a positive number: √(π/8) (kλ_D)^−3 exp(−1/(2k²λ_D²) − 3/2). */
export function landauApprox(k: number): number {
  return (Math.sqrt(Math.PI / 8) / (k * k * k)) * Math.exp(-1 / (2 * k * k) - 1.5)
}

// Table of exact roots from continuation in k (k from 0.14 to 2), built on first use. Below kλ_D ≈ 0.14
// the damping rate (≲ 1e−9 ω_p) is smaller than the absolute accuracy of Z along the real axis.
let TABLE: { k: number[]; wr: number[]; wi: number[] } | null = null
function landauTable() {
  if (TABLE) return TABLE
  const k: number[] = []
  const wr: number[] = []
  const wi: number[] = []
  let g: C = [Math.sqrt(1 + 3 * 0.14 * 0.14), -landauApprox(0.14)]
  for (let kk = 0.14; kk <= 2.0001; kk += 0.005) {
    const r = landauRoot(kk, g)
    if (!r) break
    k.push(kk)
    wr.push(r[0])
    wi.push(r[1])
    g = r
  }
  TABLE = { k, wr, wi }
  return TABLE
}

/** Exact root interpolated from the continuation table (then polished by Newton). NaN outside 0.14–2. */
export function landauExact(k: number): C {
  const T = landauTable()
  if (!(k >= T.k[0] && k <= T.k[T.k.length - 1])) return [NaN, NaN]
  const f = (k - T.k[0]) / (T.k[1] - T.k[0])
  const i = Math.min(T.k.length - 2, Math.floor(f))
  const a = f - i
  const guess: C = [T.wr[i] * (1 - a) + T.wr[i + 1] * a, T.wi[i] * (1 - a) + T.wi[i + 1] * a]
  return landauRoot(k, guess) ?? guess
}

// ---------- ion acoustic waves ----------
export const ME_OVER_MP = 9.1093837015e-31 / 1.67262192369e-27

/**
 * Ion acoustic root for Maxwellian electrons and ions (both kinetic), hydrogen by default.
 * Units: ω in ω_pi, k in 1/λ_De. tau = T_e/T_i. Returns Ω = ω/ω_pi.
 */
export function ionAcousticRoot(K: number, tau: number, guess: C, massRatio = ME_OVER_MP): C | null {
  const f = (W: C): C => {
    // electrons: ω/(k v_te) = (Ω/K)√(m/M); ions: ω/(k v_ti) = (Ω/K)√(T_e/T_i)
    const ze: C = [(W[0] / K) * Math.sqrt(massRatio / 2), (W[1] / K) * Math.sqrt(massRatio / 2)]
    const zi: C = [(W[0] / K) * Math.sqrt(tau / 2), (W[1] / K) * Math.sqrt(tau / 2)]
    const ee = cmul(ze, plasmaZ(ze))
    const ii = cmul(zi, plasmaZ(zi))
    return [1 + (1 + ee[0]) / (K * K) + (tau * (1 + ii[0])) / (K * K), ee[1] / (K * K) + (tau * ii[1]) / (K * K)]
  }
  return complexRoot(f, guess, 0.05 * K)
}

let IA_TABLE: { lt: number[]; ratio: number[]; vphi: number[] } | null = null
/** −γ/ω_r of the ion acoustic wave vs T_e/T_i (continuation from T_e/T_i = 100 down to 0.3), kλ_De = 0.1. */
export function ionAcousticDamping(tau: number): number {
  if (!IA_TABLE) {
    const K = 0.1
    const lt: number[] = []
    const ratio: number[] = []
    const vphi: number[] = []
    let g: C = [K * Math.sqrt(1 / (1 + K * K) + 3 / 100), 0]
    for (let l = Math.log(100); l >= Math.log(0.3) - 1e-9; l -= 0.02) {
      const r = ionAcousticRoot(K, Math.exp(l), g)
      if (!r) break
      lt.push(l)
      ratio.push(-r[1] / r[0])
      vphi.push(r[0] / K)
      g = r
    }
    IA_TABLE = { lt: lt.reverse(), ratio: ratio.reverse(), vphi: vphi.reverse() }
  }
  const T = IA_TABLE
  const l = Math.log(tau)
  if (!(l >= T.lt[0] && l <= T.lt[T.lt.length - 1])) return NaN
  const f = (l - T.lt[0]) / (T.lt[1] - T.lt[0])
  const i = Math.min(T.lt.length - 2, Math.floor(f))
  const a = f - i
  return T.ratio[i] * (1 - a) + T.ratio[i + 1] * a
}

/** Small-kλ_D estimate of ion acoustic damping, −γ/ω_r ≈ √(π/8)[√(m/M) + (T_e/T_i)^{3/2} exp(−T_e/2T_i − 3/2)]. */
export function ionAcousticDampingApprox(tau: number, massRatio = ME_OVER_MP): number {
  return Math.sqrt(Math.PI / 8) * (Math.sqrt(massRatio) + tau ** 1.5 * Math.exp(-tau / 2 - 1.5))
}

// ---------- bump-on-tail ----------
export const BUMP: Species[] = [
  { n: 0.9, u: 0, vt: 1 },
  { n: 0.1, u: 4.5, vt: 0.5 },
]

/** Fastest-growing root of the bump-on-tail distribution at wavenumber k (null if none found). */
export function bumpRoot(k: number, sp: Species[] = BUMP): C | null {
  let best: C | null = null
  for (let wr = 0.8; wr <= 2.5; wr += 0.1) {
    for (const wi of [0.05, 0.2, -0.1]) {
      const r = complexRoot((w) => epsilon(w, k, sp), [wr, wi], 0.2)
      if (r && (!best || r[1] > best[1])) best = r
    }
  }
  return best
}

/** Weak-growth (resonant particle) formula γ = (π/2)(ω_p³/k²) g′(ω/k), with g the normalized f₀. */
export function resonantRate(k: number, wr: number, sp: Species[]): number {
  const v = wr / k
  let gp = 0
  for (const s of sp) {
    const x = (v - s.u) / s.vt
    gp += (s.n * -x * Math.exp(-0.5 * x * x)) / (Math.sqrt(2 * Math.PI) * s.vt * s.vt)
  }
  return ((Math.PI / 2) / (k * k)) * gp
}
