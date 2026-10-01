// Two-stream instability: two equal, cold, counter-streaming electron beams (±v0) on a fixed ion
// background, run with the lesson-A1 particle-in-cell code. Units: ω_pe = 1 for the total electron
// density, so each beam has ω_b = ω_pe/√2.
//
// Cold-beam theory: 1 = ω_b²/(ω − kv0)² + ω_b²/(ω + kv0)². With x = ω/ω_b and K = kv0/ω_b this is
// (x² − K²)² = 2(x² + K²), so x² = K² + 1 ± √(1 + 4K²). The minus root is negative (purely growing
// mode) when K < √2, with γ/ω_b = √(√(1 + 4K²) − K² − 1). Its maximum, γ = ω_b/2, sits at K = √3/2.
import { createPic, fieldEnergy, solveField, stepPic, type Pic1D } from './pic1d'

export const OMEGA_B = Math.SQRT1_2 // each beam's plasma frequency, in units of ω_pe

/** Growth rate γ/ω_b of symmetric cold beams at K = k v0 / ω_b (0 when stable). */
export function twoStreamGamma(K: number): number {
  const y = Math.sqrt(1 + 4 * K * K) - K * K - 1
  return y > 0 ? Math.sqrt(y) : 0
}

/** Real frequency ω/ω_b of the slower stable branch for K > √2 (NaN while unstable). */
export function twoStreamStableOmega(K: number): number {
  const y = K * K + 1 - Math.sqrt(1 + 4 * K * K)
  return y >= 0 ? Math.sqrt(y) : NaN
}

export const K_MAX_GROWTH = Math.sqrt(3) / 2
export const K_CUTOFF = Math.SQRT2

export interface TwoStreamRun {
  pic: Pic1D
  K: number // k v0 / ω_b for the box's fundamental mode
  v0: number
  times: number[]
  amps: number[] // |E| of the fundamental Fourier mode
  energy: number[] // total electrostatic field energy
  cosT: Float64Array
  sinT: Float64Array
}

export const TS_L = 2 * Math.PI // box length: fundamental k = 1 (in ω_pe / v units)

/**
 * Create a two-stream run. While the beams are unstable the seed is the growing eigenmode itself
 * (matching displacements and velocity perturbations of both beams, field amplitude `amplitude`), so the
 * field grows as a clean exponential from the start. Stable beams get a plain displacement seed.
 */
export function createTwoStream(K: number, o: { n?: number; ng?: number; dt?: number; amplitude?: number; vth?: number; seed?: number } = {}): TwoStreamRun {
  const k = (2 * Math.PI) / TS_L
  const v0 = (K * OMEGA_B) / k
  const ng = o.ng ?? 64
  const n = o.n ?? 16000
  const g = twoStreamGamma(K) * OMEGA_B
  // Near the cut-off γ is small and the wave traps particles at a tiny amplitude (|E| ~ γ²/k), so the
  // seed is kept at most 1/1000 of that level to leave room for several e-folds of clean linear growth.
  const e0 = o.amplitude ?? (g > 0 ? Math.min(1e-4, (1e-3 * g * g) / k) : 1e-4)
  const pic = createPic({ n, ng, L: TS_L, dt: o.dt ?? 0.05, amplitude: g > 0 ? 0 : e0, mode: 1, vth: o.vth ?? 0, beams: v0, seed: o.seed })
  if (g > 0) {
    // Beam s (velocity u = ±v0) obeys (γ + iku)² ξ_s = −E and E = (ξ₊ + ξ₋)/2, so ξ₊ = −E/D with
    // D = (γ + ikv0)², ξ₋ = conj(ξ₊). Particle velocity perturbation: (γ + iku) ξ_s.
    const Dr = g * g - k * k * v0 * v0
    const Di = 2 * g * k * v0
    const dd = Dr * Dr + Di * Di
    const xr = (-e0 * Dr) / dd // ξ₊ = −e0 conj(D)/|D|²
    const xi = (e0 * Di) / dd
    for (let i = 0; i < n; i++) {
      const x0 = ((i + 0.5) * TS_L) / n
      const s = i % 2 ? 1 : -1 // same beam assignment as createPic
      const c = Math.cos(k * x0)
      const sn = Math.sin(k * x0)
      const ai = s * xi // ξ₋ = conj(ξ₊)
      const dx = xr * c - ai * sn
      const fr = g // (γ + iksv0)·ξ
      const fi = s * k * v0
      const dvr = fr * xr - fi * ai
      const dvi = fr * ai + fi * xr
      const dv = dvr * c - dvi * sn
      let x = (x0 + dx) % TS_L
      if (x < 0) x += TS_L
      pic.x[i] = x
      pic.v[i] += dv
    }
    solveField(pic)
    // re-stagger v back half a step for leapfrog (electrons: dv/dt = −E)
    const dxg = TS_L / ng
    for (let i = 0; i < n; i++) {
      const sg = pic.x[i] / dxg - 1
      const j = Math.floor(sg)
      const f = sg - j
      const E = pic.E[(j + ng) % ng] * (1 - f) + pic.E[(j + 1 + ng) % ng] * f
      pic.v[i] += 0.5 * pic.dt * E
    }
  }
  const cosT = new Float64Array(ng)
  const sinT = new Float64Array(ng)
  for (let j = 0; j < ng; j++) {
    cosT[j] = Math.cos((2 * Math.PI * j) / ng)
    sinT[j] = Math.sin((2 * Math.PI * j) / ng)
  }
  const run: TwoStreamRun = { pic, K, v0, times: [], amps: [], energy: [], cosT, sinT }
  recordTS(run)
  return run
}

export function fundamentalE(run: TwoStreamRun): number {
  const { E, ng } = run.pic
  let cr = 0
  let ci = 0
  for (let j = 0; j < ng; j++) {
    cr += E[j] * run.cosT[j]
    ci += E[j] * run.sinT[j]
  }
  return (2 / ng) * Math.hypot(cr, ci)
}

function recordTS(run: TwoStreamRun) {
  run.times.push(run.pic.t)
  run.amps.push(fundamentalE(run))
  run.energy.push(fieldEnergy(run.pic))
}

export function stepTwoStream(run: TwoStreamRun, steps = 1): void {
  for (let s = 0; s < steps; s++) {
    stepPic(run.pic)
    recordTS(run)
  }
}

/**
 * Growth rate of the fundamental mode from the simulation: the least-squares slope of ln|E₁|, which is
 * half the slope of ln(field energy in that mode). The fit starts after t = 1/γ and stops before the
 * beams trap particles (|E₁| above a tenth of the trapping level γ²/k).
 */
export function measuredTwoStream(run: TwoStreamRun): { gamma: number; done: boolean } | null {
  const g = twoStreamGamma(run.K) * OMEGA_B
  if (g <= 0) return null
  const k = (2 * Math.PI) / TS_L
  const eStop = (0.1 * g * g) / k
  const t0 = 1 / g
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0
  let done = false
  for (let i = 0; i < run.times.length; i++) {
    if (run.amps[i] > eStop) {
      done = true
      break
    }
    const t = run.times[i]
    if (t < t0 || run.amps[i] <= 0) continue
    const y = Math.log(run.amps[i])
    sx += t
    sy += y
    sxx += t * t
    sxy += t * y
    n++
  }
  if (n < 10) return null
  const den = n * sxx - sx * sx
  if (den <= 0 || (Math.sqrt(den) / n) * g < 0.3) return null
  return { gamma: (n * sxy - sx * sy) / den, done }
}
