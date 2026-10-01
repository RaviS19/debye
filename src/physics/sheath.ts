// A10: the planar sheath, the Bohm criterion, the floating wall potential, Child–Langmuir,
// the Sagdeev potential of an ion acoustic soliton and the ponderomotive potential.
//
// Sheath units: x in Debye lengths λ_D (at the sheath edge), χ = −eφ/kT_e measured from the sheath
// edge (so χ grows toward a negative wall), densities in units of the sheath-edge density n_s.
// Cold ions enter at speed u₀ = M c_s with c_s = √(kT_e/M_i); electrons are Boltzmann.
import { e, eps0, me, mp } from './constants'

export const amu = 1.6605390666e-27 // kg
export const mD = 3.3435837724e-27 // deuteron, kg
export const mAr = 39.948 * amu - me // Ar⁺, kg

/** Ion density from energy and flux conservation: n_i/n_s = (1 + 2χ/M²)^(−1/2). NaN once ions are reflected. */
export function ionDensity(chi: number, M: number): number {
  const s = 1 + (2 * chi) / (M * M)
  return s > 0 ? 1 / Math.sqrt(s) : NaN
}

/** Boltzmann electrons, n_e/n_s = e^(−χ). */
export function electronDensity(chi: number): number {
  return Math.exp(-chi)
}

/** Poisson in sheath units: χ'' = n_i − n_e. */
export function sheathRhs(chi: number, M: number): number {
  return ionDensity(chi, M) - electronDensity(chi)
}

/** First integral (Sagdeev form): ½χ'² − S(χ) is constant along a solution, with S = M²[(1+2χ/M²)^½ − 1] + e^(−χ) − 1. */
export function sheathSagdeev(chi: number, M: number): number {
  return M * M * (Math.sqrt(1 + (2 * chi) / (M * M)) - 1) + Math.exp(-chi) - 1
}

export interface SheathProfile {
  x: Float64Array
  chi: Float64Array
  dchi: Float64Array
  n: number // number of valid points
  reflected: boolean // ions turned back (1 + 2χ/M² reached 0)
  reachedWall: boolean // χ reached chiWall
}

/**
 * Integrate the sheath equation from the sheath edge x = 0 with χ(0) = chi0, χ'(0) = 0 (classical RK4).
 * Stops at xMax, when χ reaches chiWall, or if ions are reflected.
 */
export function integrateSheath(M: number, opts: { chi0?: number; xMax?: number; h?: number; chiWall?: number } = {}): SheathProfile {
  const chi0 = opts.chi0 ?? 0.02
  const xMax = opts.xMax ?? 40
  const h = opts.h ?? 0.02
  const chiWall = opts.chiWall ?? Infinity
  const nMax = Math.ceil(xMax / h) + 1
  const x = new Float64Array(nMax)
  const chi = new Float64Array(nMax)
  const dchi = new Float64Array(nMax)
  let y = chi0
  let p = 0
  x[0] = 0
  chi[0] = y
  dchi[0] = p
  let n = 1
  let reflected = false
  let reachedWall = false
  const bad = (c: number) => 1 + (2 * c) / (M * M) <= 0
  for (let i = 1; i < nMax; i++) {
    const k1y = p
    const k1p = sheathRhs(y, M)
    const y2 = y + 0.5 * h * k1y
    if (bad(y2)) { reflected = true; break }
    const k2y = p + 0.5 * h * k1p
    const k2p = sheathRhs(y2, M)
    const y3 = y + 0.5 * h * k2y
    if (bad(y3)) { reflected = true; break }
    const k3y = p + 0.5 * h * k2p
    const k3p = sheathRhs(y3, M)
    const y4 = y + h * k3y
    if (bad(y4)) { reflected = true; break }
    const k4y = p + h * k3p
    const k4p = sheathRhs(y4, M)
    const yn = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y)
    const pn = p + (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p)
    if (bad(yn)) { reflected = true; break }
    y = yn
    p = pn
    x[i] = i * h
    chi[i] = y
    dchi[i] = p
    n = i + 1
    if (y >= chiWall) { reachedWall = true; break }
  }
  return { x, chi, dchi, n, reflected, reachedWall }
}

/** True if χ never decreases along the profile (a physical, monotonic sheath). */
export function isMonotonic(p: SheathProfile): boolean {
  for (let i = 1; i < p.n; i++) if (p.chi[i] < p.chi[i - 1] - 1e-12) return false
  return true
}

/** Linear theory near the edge: χ ∝ cosh(κx) with κ = √(1 − 1/M²) for M > 1; oscillation with k = √(1/M² − 1) for M < 1. */
export function linearRate(M: number): number {
  return Math.sqrt(Math.abs(1 - 1 / (M * M)))
}

/** Measured growth rate κ from the early profile: χ/χ₀ = cosh(κx), using the point where χ first reaches 4χ₀. */
export function measuredGrowth(p: SheathProfile): number {
  const c0 = p.chi[0]
  for (let i = 1; i < p.n; i++) if (p.chi[i] >= 4 * c0) return Math.acosh(p.chi[i] / c0) / p.x[i]
  return NaN
}

/** Measured oscillation wavelength from successive downward zero crossings of χ (in λ_D). */
export function measuredWavelength(p: SheathProfile): number {
  const z: number[] = []
  for (let i = 1; i < p.n; i++) {
    if (p.chi[i - 1] > 0 && p.chi[i] <= 0) {
      const f = p.chi[i - 1] / (p.chi[i - 1] - p.chi[i])
      z.push(p.x[i - 1] + f * (p.x[i] - p.x[i - 1]))
    }
  }
  return z.length >= 2 ? (z[z.length - 1] - z[0]) / (z.length - 1) : NaN
}

/**
 * Sheath drop χ_s (from sheath edge to a floating wall) for ions entering at Mach M:
 * ion flux n_s M c_s = electron flux ¼ n_s v̄_e e^(−χ_s), v̄_e = √(8kT_e/πm_e) ⇒ χ_s = ½ ln(M_i/2πm_e) − ln M.
 */
export function sheathDrop(Mi: number, M = 1): number {
  return 0.5 * Math.log(Mi / (2 * Math.PI * me)) - Math.log(M)
}

/** Floating wall potential relative to the bulk plasma, including the ½kT_e/e presheath drop: eφ_w/kT_e = ½ ln(2πm_e/M_i) − ½. */
export function floatingPotential(Mi: number): number {
  return 0.5 * Math.log((2 * Math.PI * me) / Mi) - 0.5
}

/** Ion sound (Bohm) speed √(kT_e/M_i), T_e in eV. */
export function bohmSpeed(TeV: number, Mi: number): number {
  return Math.sqrt((TeV * e) / Mi)
}

/** Child–Langmuir space-charge-limited ion current density, A/m²: J = (4/9)ε₀√(2e/M) V^{3/2}/d². */
export function childLangmuirJ(V: number, d: number, Mi = mp): number {
  return (4 / 9) * eps0 * Math.sqrt((2 * e) / Mi) * V ** 1.5 / (d * d)
}

/** Sheath thickness from Child–Langmuir with the Bohm flux: d/λ_D = (√2/3)(2χ)^{3/4}, χ = e|V|/kT_e. */
export function childLangmuirThickness(chi: number): number {
  return (Math.SQRT2 / 3) * (2 * chi) ** 0.75
}

/**
 * Sagdeev potential for an ion acoustic solitary wave moving at Mach M (χ = eφ/kT_e > 0 at the hump):
 * ½χ'² + V(χ) = 0 with V(χ) = 1 − e^χ + M²[1 − (1 − 2χ/M²)^½]. A soliton needs V < 0 between 0 and its peak.
 */
export function sagdeevV(chi: number, M: number): number {
  const s = 1 - (2 * chi) / (M * M)
  if (s < 0) return NaN
  return 1 - Math.exp(chi) + M * M * (1 - Math.sqrt(s))
}

/** Peak of the ion acoustic soliton: the first root of V(χ) > 0, or NaN if none exists (M ≤ 1 or M > 1.585). */
export function solitonAmplitude(M: number): number {
  if (M <= 1) return NaN
  const top = (M * M) / 2
  if (sagdeevV(top, M) < 0) return NaN
  let a = 1e-6
  let b = top
  // V < 0 just above 0 for M > 1; find where it returns to 0
  for (let i = 0; i < 200; i++) {
    const m = 0.5 * (a + b)
    if (sagdeevV(m, M) < 0) a = m
    else b = m
  }
  return 0.5 * (a + b)
}

/** Critical Mach number above which ions are reflected and no soliton exists: e^{M²/2} − 1 = M². */
export function criticalMach(): number {
  let a = 1.1
  let b = 2
  const f = (M: number) => Math.exp((M * M) / 2) - 1 - M * M
  for (let i = 0; i < 200; i++) {
    const m = 0.5 * (a + b)
    if (f(m) < 0) a = m
    else b = m
  }
  return 0.5 * (a + b)
}

/**
 * Ponderomotive potential of an electron in a laser field, in eV:
 * U_p = e²⟨E²⟩/(2m_eω²) = e² I/(2 m_e ε₀ c ω²) ≈ 9.34×10⁻¹⁴ I[W/cm²] λ²[µm].
 */
export function ponderomotiveEV(IWcm2: number, lambdaUm: number): number {
  const c = 2.99792458e8
  const w = (2 * Math.PI * c) / (lambdaUm * 1e-6)
  return ((e * e * IWcm2 * 1e4) / (2 * me * eps0 * c * w * w)) / e
}
