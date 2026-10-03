// L2: a pulse train as a sum of longitudinal modes.
//   E(t) = Σ_n a_n exp(i (2π n t / T_R + φ_n)),   n = −M … M
// With all φ_n equal the modes add in phase once per round trip T_R: a pulse. With random phases the
// output is noise with the same average power. For a Gaussian spectrum whose intensity FWHM spans Δn modes,
// the locked pulse has intensity FWHM 0.441 T_R / Δn (the Gaussian time–bandwidth product).

/** Seeded RNG (mulberry32) so the "random phases" are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mode amplitudes for a Gaussian gain spectrum: intensity FWHM = fwhmModes mode spacings. */
export function gaussianAmplitudes(M: number, fwhmModes: number): Float64Array {
  const a = new Float64Array(2 * M + 1)
  for (let i = 0; i < a.length; i++) {
    const n = i - M
    a[i] = Math.exp((-2 * Math.LN2 * n * n) / (fwhmModes * fwhmModes)) // amplitude = √intensity
  }
  return a
}

/** Random phases scaled by (1 − lock): lock = 1 gives a perfectly locked comb. */
export function phases(count: number, lock: number, seed = 7): Float64Array {
  const r = rng(seed)
  const p = new Float64Array(count)
  for (let i = 0; i < count; i++) p[i] = (1 - lock) * 2 * Math.PI * (r() - 0.5) * 2
  return p
}

/** Intensity |E|² sampled at `samples` points across `trips` round trips (time in units of T_R). */
export function modeSumIntensity(amp: Float64Array, ph: Float64Array, samples: number, trips = 1, out?: Float64Array): Float64Array {
  const I = out ?? new Float64Array(samples)
  const M = (amp.length - 1) / 2
  for (let k = 0; k < samples; k++) {
    const t = ((k / samples) * trips) - trips / 2
    let re = 0
    let im = 0
    for (let i = 0; i < amp.length; i++) {
      const arg = 2 * Math.PI * (i - M) * t + ph[i]
      re += amp[i] * Math.cos(arg)
      im += amp[i] * Math.sin(arg)
    }
    I[k] = re * re + im * im
  }
  return I
}

/** Full width at half maximum of the highest peak, by linear interpolation (in sample units). */
export function fwhm(I: Float64Array): number {
  let k0 = 0
  for (let k = 1; k < I.length; k++) if (I[k] > I[k0]) k0 = k
  const half = I[k0] / 2
  let l = k0
  while (l > 0 && I[l] > half) l--
  let r = k0
  while (r < I.length - 1 && I[r] > half) r++
  const xl = l + (half - I[l]) / (I[l + 1] - I[l])
  const xr = r - 1 + (I[r - 1] - half) / (I[r - 1] - I[r])
  return xr - xl
}

export const mean = (I: Float64Array) => I.reduce((s, v) => s + v, 0) / I.length
export const max = (I: Float64Array) => I.reduce((m, v) => (v > m ? v : m), 0)

/** Theory: locked Gaussian comb, pulse FWHM in units of T_R. */
export const lockedPulseWidth = (fwhmModes: number) => (2 * Math.LN2) / (Math.PI * fwhmModes)
