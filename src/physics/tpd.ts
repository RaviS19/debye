// B7: two-plasmon decay (Kruer's 2ω_pe instability). A light wave (ω0, k0) decays into two electron plasma waves
// (ω1, k1) and (ω2, k2 = k0 − k1) with ω0 = ω1 + ω2, possible only near n_c/4 where ω_pe ≈ ω0/2.
//
// Homogeneous growth rate (cold coupling, both plasmons near ω_pe; derived in the lesson):
//     γ = (v_os/4) |k1·ê| |k2² − k1²| / (|k1| |k2|),     k2 = k1 − k0 (up to sign),
// with ê the laser polarization (⊥ k0) and v_os = eE0/(m ω0). In the plane of polarization, with k∥ along k0 and k⊥
// along ê, it is largest, γ = k0 v_os/4, everywhere on the hyperbola k⊥² = k∥(k∥ − k0) (k∥ > k0 or k∥ < 0).
//
// Matching (normalized ω0 = 1, c = 1, densities in n_c): ω_j² = n + 3 β² k_j² (Bohm–Gross, β = v_te/c, v_te = √(T/m)),
// k0 = √(1 − n). For a decay specified by k1 in units of k0, the density at which it is resonant solves
//     √(n + 3β²(1 − n)|κ1|²) + √(n + 3β²(1 − n)|κ1 − ẑ|²) = 1,
// which has a unique root in (0, 1/4] when one exists (the left side increases with n); tpdMatchDensity solves it in
// closed form.
//
// Inhomogeneous plasma: the TPD pair's wavenumber mismatch gradient and group velocities along a density gradient of
// scale length L give |κ′ v1 v2| = (3/2) k0 v_te²/L, independent of k⊥, so the Rosenbluth parameter is
// γ0²/|κ′v1v2| = (2/3) Λ with Λ = γ0² L/(k0 v_te²) = (1/16)(v_os/v_te)² k0 L. The absolute threshold usually quoted
// from Simon et al. (1983), η = I14 L_µm λ_µm/(82 T_keV) = 1 (I at n_c/4), is Λ = 1.04 in these variables.
import { c, e, eps0, me } from './constants'

export const MEC2_KEV = (me * c * c) / e / 1e3

/** Growth rate in units of v_os for plasmon k1 = (kpar, kperp) in the polarization plane, pump k0 along z. */
export function tpdGrowth(kpar: number, kperp: number, k0 = 1) {
  const k = Math.hypot(kpar, kperp)
  const kb = Math.hypot(kpar - k0, kperp)
  if (k === 0 || kb === 0) return 0
  return (Math.abs(kperp) * Math.abs(kb * kb - k * k)) / (4 * k * kb)
}

/** Maximum homogeneous growth rate k0 v_os/4. */
export const tpdMaxGrowth = (k0: number, vos: number) => (k0 * vos) / 4

/** k⊥ on the hyperbola of maximum growth, k⊥² = k∥(k∥ − k0); NaN between 0 and k0. */
export const hyperbolaKperp = (kpar: number, k0 = 1) => {
  const q = kpar * (kpar - k0)
  return q >= 0 ? Math.sqrt(q) : NaN
}

export interface TpdMatch {
  n: number // n/n_c where the decay is resonant
  k0: number // laser wavenumber there, units ω0/c
  k1: number // |k1|, |k2| in ω0/c
  k2: number
  w1: number // plasmon frequencies in ω0
  w2: number
  k1lD: number // kλ_De of each plasmon
  k2lD: number
}

/**
 * The matching density in closed form. With A = 3β²|κ1|², C = 3β²|κ1 − ẑ|² and m = 1 − n, the condition
 * √(1 − m(1 − A)) + √(1 − m(1 − C)) = 1 squares (twice) to D²m² + Bm − 3 = 0 with D = C − A and B = 4 − 2(A + C),
 * whose positive root is m = 6/(B + √(B² + 12D²)). The squaring is undone only if 2√(1 − m(1 − C)) = 1 + mD and
 * 2√(1 − m(1 − A)) = 1 − mD are both non-negative, i.e. |mD| ≤ 1. Returns NaN when there is no root in (0, 1/4].
 */
export function tpdMatchDensity(a2: number, c2: number, b2: number) {
  const A = 3 * b2 * a2
  const C = 3 * b2 * c2
  const D = C - A
  const B = 4 - 2 * (A + C)
  const den = B + Math.sqrt(B * B + 12 * D * D)
  if (!(den > 0)) return NaN
  const m = 6 / den
  const n = 1 - m
  if (!(n > 0) || n > 0.25 + 1e-12 || Math.abs(m * D) > 1) return NaN
  return Math.min(n, 0.25)
}

/** Density (and plasmon properties) at which a decay with k1 = k0·(kappaPar, kappaPerp) is resonant, or null. */
export function tpdMatch(kappaPar: number, kappaPerp: number, TkeV: number): TpdMatch | null {
  const b2 = TkeV / MEC2_KEV
  const a2 = kappaPar * kappaPar + kappaPerp * kappaPerp
  const c2 = (kappaPar - 1) ** 2 + kappaPerp * kappaPerp
  const n = tpdMatchDensity(a2, c2, b2)
  if (Number.isNaN(n)) return null
  const k0 = Math.sqrt(1 - n)
  const k1 = k0 * Math.sqrt(a2)
  const k2 = k0 * Math.sqrt(c2)
  const lD = Math.sqrt(b2 / n) // λ_De in c/ω0
  return { n, k0, k1, k2, w1: Math.sqrt(n + 3 * b2 * k1 * k1), w2: Math.sqrt(n + 3 * b2 * k2 * k2), k1lD: k1 * lD, k2lD: k2 * lD }
}

/** Plasmon k_z at fixed frequency ω (units ω0) and k⊥, in a plasma of density n (units n_c), temperature β² = T/mc². */
export function plasmonKz(w: number, kperp: number, n: number, b2: number) {
  const q = (w * w - n) / (3 * b2) - kperp * kperp
  return q > 0 ? Math.sqrt(q) : NaN
}

/** Λ = γ0² L/(k0 v_te²) for I (W/cm²), L (µm), λ (µm), T (keV); evaluated at n_c/4 with linear polarization. */
export function tpdLambda(IWcm2: number, Lum: number, lamUm: number, TkeV: number) {
  const w0 = (2 * Math.PI * c) / (lamUm * 1e-6)
  const vos = (e * Math.sqrt((2 * IWcm2 * 1e4) / (eps0 * c))) / (me * w0)
  const k0 = (w0 / c) * Math.sqrt(0.75)
  const ve2 = (TkeV * 1e3 * e) / me
  const g0 = (k0 * vos) / 4
  return (g0 * g0 * Lum * 1e-6) / (k0 * ve2)
}

/** The constant in the practical threshold η = I14 L_µm λ_µm/(C T_keV). */
export const TPD_ETA_CONST = 82
/** Threshold parameter η (absolute TPD for η ≳ 1), I in W/cm². */
export const tpdEta = (IWcm2: number, Lum: number, lamUm: number, TkeV: number) => ((IWcm2 / 1e14) * Lum * lamUm) / (TPD_ETA_CONST * TkeV)
/** Threshold intensity (W/cm²) for η = 1. */
export const tpdThresholdIntensity = (Lum: number, lamUm: number, TkeV: number) => (1e14 * TPD_ETA_CONST * TkeV) / (Lum * lamUm)

/** Maximum homogeneous growth rate in s⁻¹ at n_c/4 for I (W/cm², linear polarization) and λ (µm). */
export function tpdGammaMax(IWcm2: number, lamUm: number) {
  const w0 = (2 * Math.PI * c) / (lamUm * 1e-6)
  const vos = (e * Math.sqrt((2 * IWcm2 * 1e4) / (eps0 * c))) / (me * w0)
  return tpdMaxGrowth((w0 / c) * Math.sqrt(0.75), vos)
}
