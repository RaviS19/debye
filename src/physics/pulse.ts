// L3: an ultrashort pulse as a spectrum with a spectral phase.
//   Ẽ(Ω) = A(Ω) exp(i φ(Ω)),  φ(Ω) = ½ GDD Ω² + ⅙ TOD Ω³,  Ω = ω − ω₀
// E(t) is the inverse Fourier transform. Units: time in fs, angular frequency in rad/fs, GDD in fs², TOD in fs³.
// Gaussian results used as benchmarks:
//   transform limit  Δν·τ = 2 ln2/π ≈ 0.441 (intensity FWHMs)
//   GDD broadening   τ = τ₀ √(1 + (4 ln2 · GDD / τ₀²)²)
import { fft } from './kdv'

export const C_UM_PER_FS = 0.299792458 // speed of light in µm/fs

export interface PulseGrid {
  n: number
  dt: number // fs
  t: Float64Array // fs, centred on 0
  dw: number // rad/fs
  w: Float64Array // Ω in rad/fs, in FFT order
}

export function makeGrid(n: number, window: number): PulseGrid {
  const dt = window / n
  const t = new Float64Array(n)
  for (let k = 0; k < n; k++) t[k] = (k - n / 2) * dt
  const dw = (2 * Math.PI) / (n * dt)
  const w = new Float64Array(n)
  for (let k = 0; k < n; k++) w[k] = (k < n / 2 ? k : k - n) * dw
  return { n, dt, t, dw, w }
}

/** Transform-limited Gaussian intensity FWHM (fs) for a bandwidth Δλ (nm) at λ₀ (nm). */
export function transformLimit(lambda0nm: number, dLambdaNm: number): number {
  const dnu = (C_UM_PER_FS * 1e3 * dLambdaNm) / (lambda0nm * lambda0nm) // 1/fs
  return (2 * Math.LN2) / Math.PI / dnu
}

/** Gaussian pulse FWHM after a GDD (both in fs / fs²). */
export const gddBroadened = (tau0: number, gdd: number) => tau0 * Math.sqrt(1 + ((4 * Math.LN2 * gdd) / (tau0 * tau0)) ** 2)

export interface PulseOut {
  I: Float64Array // |E(t)|², time-ordered on grid.t, peak of the transform limit = 1
  instFreq: Float64Array // instantaneous Ω(t) in rad/fs
  spec: Float64Array // spectral intensity on grid.w (FFT order), peak 1
  phase: Float64Array // applied spectral phase, rad
}

/**
 * Field of a Gaussian spectrum with intensity FWHM dw (rad/fs) and spectral phase GDD/TOD.
 * Uses the convention E(t) = ∫ Ẽ(Ω) e^{−iΩt} dΩ, so positive GDD gives an up-chirp (red at the front).
 */
export function shapePulse(g: PulseGrid, dwFwhm: number, gdd: number, tod: number): PulseOut {
  const { n, w } = g
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const spec = new Float64Array(n)
  const phase = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    const W = w[k]
    const a = Math.exp((-2 * Math.LN2 * W * W) / (dwFwhm * dwFwhm))
    const ph = 0.5 * gdd * W * W + (tod / 6) * W * W * W
    spec[k] = a * a
    phase[k] = ph
    re[k] = a * Math.cos(ph)
    im[k] = a * Math.sin(ph)
  }
  // e^{−iΩt}: the forward FFT kernel. Output index k is time (k)·dt; shift so t = 0 sits at n/2.
  fft(re, im, false)
  let norm = 0
  for (let k = 0; k < n; k++) {
    norm += Math.exp((-2 * Math.LN2 * w[k] * w[k]) / (dwFwhm * dwFwhm)) // Σ amplitudes: the transform-limited peak field
  }
  const I = new Float64Array(n)
  const er = new Float64Array(n)
  const ei = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    const src = (k + n / 2) % n
    er[k] = re[src] / norm
    ei[k] = im[src] / norm
    I[k] = er[k] * er[k] + ei[k] * ei[k]
  }
  // Instantaneous frequency: with E ∝ e^{−iΩt} the carrier offset is −dψ/dt.
  const instFreq = new Float64Array(n)
  for (let k = 1; k < n - 1; k++) {
    const dre = (er[k + 1] - er[k - 1]) / (2 * g.dt)
    const dim = (ei[k + 1] - ei[k - 1]) / (2 * g.dt)
    const m2 = I[k] || 1e-300
    instFreq[k] = -(er[k] * dim - ei[k] * dre) / m2
  }
  return { I, instFreq, spec, phase }
}

/** FWHM of the tallest peak, in the units of `dx` (linear interpolation). */
export function widthAtHalf(I: Float64Array, dx: number): number {
  let k0 = 0
  for (let k = 1; k < I.length; k++) if (I[k] > I[k0]) k0 = k
  const half = I[k0] / 2
  let l = k0
  while (l > 0 && I[l] > half) l--
  let r = k0
  while (r < I.length - 1 && I[r] > half) r++
  const xl = l + (half - I[l]) / (I[l + 1] - I[l])
  const xr = r - 1 + (I[r - 1] - half) / (I[r - 1] - I[r])
  return (xr - xl) * dx
}

// ---- material dispersion (Sellmeier, λ in µm) ----
export interface Glass {
  name: string
  B: [number, number, number]
  C: [number, number, number] // µm²
}
export const GLASSES: Glass[] = [
  { name: 'Fused silica', B: [0.6961663, 0.4079426, 0.8974794], C: [0.0684043 ** 2, 0.1162414 ** 2, 9.896161 ** 2] },
  { name: 'BK7', B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] },
]

export function refractiveIndex(g: Glass, lambdaUm: number): number {
  const l2 = lambdaUm * lambdaUm
  let s = 1
  for (let i = 0; i < 3; i++) s += (g.B[i] * l2) / (l2 - g.C[i])
  return Math.sqrt(s)
}

/** Group-velocity dispersion β₂ = d²k/dω² in fs²/mm at λ (µm), by finite differences in ω. */
export function gvd(g: Glass, lambdaUm: number): number {
  const w0 = (2 * Math.PI * C_UM_PER_FS) / lambdaUm // rad/fs
  const k = (w: number) => (w * refractiveIndex(g, (2 * Math.PI * C_UM_PER_FS) / w)) / C_UM_PER_FS // rad/µm
  const h = w0 * 1e-3
  const d2 = (k(w0 + h) - 2 * k(w0) + k(w0 - h)) / (h * h) // fs²/µm
  return d2 * 1e3
}
