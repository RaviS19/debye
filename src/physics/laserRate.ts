// L1: four-level laser rate equations in normalized form.
//   dN/dt = R − N/τ − N φ            (inversion; stimulated emission depletes it)
//   dφ/dt = N φ − φ/τc + β N/τ        (photons; gain N, cavity loss 1/τc, a little spontaneous seed)
// Units: time in upper-state lifetimes (τ = 1); N and φ are scaled so the stimulated-emission rate is N·φ.
// Threshold inversion N_th = 1/τc; threshold pump R_th = N_th/τ. Above threshold N clamps at N_th and
// φ_ss = τc (R − R_th). Relaxation oscillations ring at ω_R ≈ √((r − 1)/(τ τc)) with r = R/R_th, decaying at r/2τ.

export interface LaserState {
  t: number
  N: number
  phi: number
}

export interface LaserParams {
  R: number // pump rate
  tauC: number // photon lifetime in units of τ
  beta?: number // spontaneous-emission fraction into the lasing mode
}

export const thresholdInversion = (p: LaserParams) => 1 / p.tauC
export const thresholdPump = (p: LaserParams) => thresholdInversion(p) // τ = 1
export const steadyPhotons = (p: LaserParams) => Math.max(0, p.tauC * (p.R - thresholdPump(p)))
export const steadyInversion = (p: LaserParams) => Math.min(p.R, thresholdInversion(p))
/** Relaxation-oscillation angular frequency (in 1/τ), valid for τc ≪ τ and r > 1. */
export const relaxationOmega = (p: LaserParams) => {
  const r = p.R / thresholdPump(p)
  return r > 1 ? Math.sqrt((r - 1) / p.tauC - (r * r) / 4) : 0
}

function deriv(N: number, phi: number, p: LaserParams): [number, number] {
  const beta = p.beta ?? 1e-6
  return [p.R - N - N * phi, N * phi - phi / p.tauC + beta * N]
}

/** Advance by dt with classic RK4 (dt small compared with τc). */
export function stepLaser(s: LaserState, p: LaserParams, dt: number): void {
  const [a1, b1] = deriv(s.N, s.phi, p)
  const [a2, b2] = deriv(s.N + (dt / 2) * a1, s.phi + (dt / 2) * b1, p)
  const [a3, b3] = deriv(s.N + (dt / 2) * a2, s.phi + (dt / 2) * b2, p)
  const [a4, b4] = deriv(s.N + dt * a3, s.phi + dt * b3, p)
  s.N += (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4)
  s.phi += (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4)
  if (s.phi < 0) s.phi = 0
  s.t += dt
}

export const newLaser = (): LaserState => ({ t: 0, N: 0, phi: 0 })

/** Population ratio N2/N1 = exp(−ΔE/kT) for equal degeneracies; λ in m, T in K. */
export function boltzmannRatio(lambda: number, T: number): number {
  const h = 6.62607015e-34
  const c = 2.99792458e8
  const kB = 1.380649e-23
  return Math.exp(-(h * c) / (lambda * kB * T))
}
