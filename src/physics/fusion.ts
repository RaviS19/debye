// A11: fusion reactivities (Bosch & Hale, Nucl. Fusion 32, 611 (1992)) and the power balance behind the
// Lawson criterion, ignition and Q. Temperatures in keV; reactivities returned in m³/s.
import { e } from './constants'

interface BHParams {
  BG: number // Gamow constant, keV^½
  mrc2: number // reduced mass × c², keV
  C: [number, number, number, number, number, number, number]
}

/** Bosch–Hale Table VII coefficients (valid 0.2–100 keV for D–T and D–D). */
export const BOSCH_HALE: Record<'DT' | 'DDn' | 'DDp', BHParams> = {
  // T(d,n)⁴He
  DT: { BG: 34.3827, mrc2: 1124656, C: [1.17302e-9, 1.51361e-2, 7.51886e-2, 4.60643e-3, 1.35e-2, -1.0675e-4, 1.366e-5] },
  // D(d,n)³He
  DDn: { BG: 31.397, mrc2: 937814, C: [5.4336e-12, 5.85778e-3, 7.68222e-3, 0, -2.964e-6, 0, 0] },
  // D(d,p)T
  DDp: { BG: 31.397, mrc2: 937814, C: [5.65718e-12, 3.41267e-3, 1.99167e-3, 0, 1.0506e-5, 0, 0] },
}

/** ⟨σv⟩ in m³/s for a Maxwellian at ion temperature T (keV). */
export function reactivity(reaction: keyof typeof BOSCH_HALE, T: number): number {
  const { BG, mrc2, C } = BOSCH_HALE[reaction]
  const theta = T / (1 - (T * (C[1] + T * (C[3] + T * C[5]))) / (1 + T * (C[2] + T * (C[4] + T * C[6]))))
  const xi = Math.cbrt((BG * BG) / (4 * theta))
  return C[0] * theta * Math.sqrt(xi / (mrc2 * T * T * T)) * Math.exp(-3 * xi) * 1e-6
}

export const svDT = (T: number) => reactivity('DT', T)
/** Both D–D branches together. */
export const svDD = (T: number) => reactivity('DDn', T) + reactivity('DDp', T)

export const MeV = 1e6 * e
export const E_FUS = 17.59 * MeV // D + T → ⁴He + n
export const E_ALPHA = 3.52 * MeV // the alpha's share, kept in the plasma
export const E_NEUTRON = E_FUS - E_ALPHA
export const keV = 1e3 * e

/** Fusion power density (W/m³) of a 50:50 D–T plasma with electron density n: P = (n/2)² ⟨σv⟩ E_fus. */
export function fusionPower(n: number, T: number): number {
  return 0.25 * n * n * svDT(T) * E_FUS
}

/** Bremsstrahlung power density, W/m³ (Z = 1, T in keV): 5.35×10⁻³⁷ n² √T. */
export function bremsstrahlung(n: number, T: number): number {
  return 5.35e-37 * n * n * Math.sqrt(T)
}

/**
 * Required n τ_E (s/m³) for a given Q = P_fus/P_heat in steady state, with thermal energy 3nkT:
 *   3nkT/τ_E = P_heat + P_α  ⇒  n τ_E = 12 kT / [⟨σv⟩ E_fus (1/Q + E_α/E_fus)].
 * Q = Infinity gives ignition, n τ_E = 12 kT/(⟨σv⟩ E_α).
 */
export function nTauForQ(T: number, Q: number): number {
  const inv = (Q === Infinity ? 0 : 1 / Q) + E_ALPHA / E_FUS
  return (12 * T * keV) / (svDT(T) * E_FUS * inv)
}

/** Ignition n τ_E including bremsstrahlung: 3kT / (¼⟨σv⟩E_α − C_B√T); NaN below the ideal ignition temperature. */
export function nTauIgnitionBrems(T: number): number {
  const net = 0.25 * svDT(T) * E_ALPHA - 5.35e-37 * Math.sqrt(T)
  return net > 0 ? (3 * T * keV) / net : NaN
}

/** Same as nTauForQ but with bremsstrahlung (Z = 1) added to the losses; NaN where no n τ_E is enough. */
export function nTauForQBrems(T: number, Q: number): number {
  const inv = (Q === Infinity ? 0 : 1 / Q) + E_ALPHA / E_FUS
  const net = 0.25 * svDT(T) * E_FUS * inv - 5.35e-37 * Math.sqrt(T)
  return net > 0 ? (3 * T * keV) / net : NaN
}

/** Q at (T, nτ_E) including bremsstrahlung losses; Infinity when ignited. Independent of n, since every term scales as n². */
export function qAtBrems(T: number, nTau: number): number {
  const pf = 0.25 * svDT(T) * E_FUS // fusion power per n²
  const heat = (3 * T * keV) / nTau + 5.35e-37 * Math.sqrt(T) - 0.25 * svDT(T) * E_ALPHA // external heating per n²
  return heat <= 0 ? Infinity : pf / heat
}

/** Ignition triple product n T τ_E in keV·s/m³ (no radiation). */
export function tripleIgnition(T: number): number {
  return T * nTauForQ(T, Infinity)
}

/** Q at an operating point (T keV, nτ_E s/m³); Infinity when ignited. */
export function qAt(T: number, nTau: number): number {
  const inv = (12 * T * keV) / (nTau * svDT(T) * E_FUS) - E_ALPHA / E_FUS
  return inv <= 0 ? Infinity : 1 / inv
}

/** Golden-section minimum of f on [a, b]. */
export function argmin(f: (x: number) => number, a: number, b: number, iters = 100): number {
  const g = (Math.sqrt(5) - 1) / 2
  let c = b - g * (b - a)
  let d = a + g * (b - a)
  for (let i = 0; i < iters; i++) {
    if (f(c) < f(d)) b = d
    else a = c
    c = b - g * (b - a)
    d = a + g * (b - a)
  }
  return 0.5 * (a + b)
}
