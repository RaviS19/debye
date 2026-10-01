// A7: classical transport formulas in SI units (temperatures in eV).
import { e, me } from './constants'

/** Coulomb logarithm for electron–ion collisions (NRL formulary). n in m⁻³, T_e in eV. */
export function coulombLog(n: number, TeV: number, Z = 1): number {
  const ncm = n * 1e-6
  return TeV < 10 * Z * Z ? 23 - Math.log(Math.sqrt(ncm) * Z * TeV ** -1.5) : 24 - Math.log(Math.sqrt(ncm) / TeV)
}

/**
 * Braginskii electron collision time τ_e = 3.44×10¹¹ T_eV^{3/2} / (n lnΛ) s (n in m⁻³, Z = 1).
 * Equivalent to 6√2 π^{3/2} ε0² √m_e (kT_e)^{3/2} / (lnΛ e⁴ n).
 */
export function tauE(n: number, TeV: number, lnL: number): number {
  return (3.44e11 * TeV ** 1.5) / (n * lnL)
}

/**
 * Spitzer parallel resistivity, the textbook form η∥ ≈ 5.2×10⁻⁵ Z lnΛ / T_eV^{3/2} Ω·m.
 * (0.51 m_e/(n e² τ_e) for Z = 1; the linear Z scaling is only approximate.)
 */
export function spitzerPar(TeV: number, lnL: number, Z = 1): number {
  return (5.2e-5 * Z * lnL) / TeV ** 1.5
}

/** Perpendicular resistivity η⊥ = m_e/(n e² τ_e) ≈ 1.96 η∥ for Z = 1. */
export function spitzerPerp(TeV: number, lnL: number): number {
  return (me * lnL) / (e * e * 3.44e11 * TeV ** 1.5)
}

/** Classical diffusion across B in a fully ionized plasma: D⊥ = η⊥ n k(T_e + T_i) / B². */
export function classicalDperp(n: number, TeV: number, TiV: number, B: number, lnL: number): number {
  return (spitzerPerp(TeV, lnL) * n * (TeV + TiV) * e) / (B * B)
}

/** Bohm diffusion D_B = kT_e / (16 e B), in m²/s with T_e in eV. */
export function bohmD(TeV: number, B: number): number {
  return TeV / (16 * B)
}

/** Free diffusion coefficient D = kT/(mν), in m²/s (T in eV, ν in s⁻¹). */
export function freeD(TeV: number, m: number, nu: number): number {
  return (TeV * e) / (m * nu)
}

/** Lowest-mode decay time of a slab of width L (walls at ±L/2, n = 0 there): τ = (L/π)²/D. */
export function slabDecayTime(L: number, D: number): number {
  return (L / Math.PI) ** 2 / D
}

/** Density in a slab after an initially flat profile has diffused for time t (x in units of L, t in τ₁). */
export function slabProfile(x: number, tOverTau1: number, terms = 200): number {
  if (Math.abs(x) >= 0.5) return 0
  let s = 0
  for (let j = 0; j < terms; j++) {
    const m = 2 * j + 1
    const a = Math.exp(-m * m * tOverTau1)
    if (a < 1e-12) break
    s += ((4 / (m * Math.PI)) * (j % 2 ? -1 : 1)) * Math.cos(m * Math.PI * x) * a
  }
  return s
}
