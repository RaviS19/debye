// Electrostatic waves: fluid dispersion relations, a PIC "measure the frequency" run, and a
// wave-packet builder for phase vs group velocity.
//
// Normalized units for the dispersion functions: frequencies in ω_pe, wavenumbers in 1/λ_De, with
// λ_De = √(ε0 kTe / n e²) and the electron thermal speed v_th = √(kTe/m_e) = ω_pe λ_De.
// mu = m_e/M (ion to electron mass ratio inverted), tau = T_i/T_e, wc = ω_ce/ω_pe.
import { createPic, stepPic, type Pic1D } from './pic1d'
import { e, me, mp, eps0 } from './constants'

/** Bohm–Gross: ω² = ω_pe² + γ_e k² v_th² (γ_e = 3 for 1D adiabatic electrons). Returns ω/ω_pe. */
export function bohmGross(K: number, gammaE = 3): number {
  return Math.sqrt(1 + gammaE * K * K)
}

/** Ion acoustic wave with the Debye correction on the electron term: ω² = k²[kTe/(M(1+k²λ_D²)) + γ_i kT_i/M]. */
export function ionAcoustic(K: number, mu: number, tau: number, gammaI = 3): number {
  return Math.sqrt(mu * K * K * (1 / (1 + K * K) + gammaI * tau))
}

/** Warm-fluid upper hybrid wave for k ⊥ B: ω² = ω_pe² + ω_ce² + 3k²v_th². At k → 0 this is ω_h. */
export function upperHybrid(K: number, wc: number): number {
  return Math.sqrt(1 + wc * wc + 3 * K * K)
}

/** Electrostatic ion cyclotron wave: ω² = Ω_ci² + (ion acoustic ω)². */
export function ionCyclotronWave(K: number, mu: number, tau: number, wc: number, gammaI = 3): number {
  const Wci = mu * wc
  const ia = ionAcoustic(K, mu, tau, gammaI)
  return Math.sqrt(Wci * Wci + ia * ia)
}

/** Lower hybrid frequency (cold, k exactly ⊥ B): 1/ω_LH² = 1/(ω_ce Ω_ci) + 1/(ω_pi² + Ω_ci²). */
export function lowerHybrid(mu: number, wc: number): number {
  const Wci = mu * wc
  return 1 / Math.sqrt(1 / (wc * Wci) + 1 / (mu + Wci * Wci))
}

/** Group velocity dω/dk of the Bohm–Gross branch, in units of v_th. */
export function bohmGrossGroup(K: number): number {
  return (3 * K) / bohmGross(K)
}

/** Group velocity of the (T_i = 0 part plus ion pressure) ion acoustic branch, in units of v_th (numerical derivative). */
export function ionAcousticGroup(K: number, mu: number, tau: number): number {
  const h = 1e-5 * Math.max(K, 1e-3)
  return (ionAcoustic(K + h, mu, tau) - ionAcoustic(K - h, mu, tau)) / (2 * h)
}

// ---------- SI helpers ----------

/** Ion sound speed c_s = √((kTe + γ_i kTi)/M), temperatures in eV. */
export function soundSpeed(TeV: number, TiV: number, M = mp, gammaI = 3): number {
  return Math.sqrt(((TeV + gammaI * TiV) * e) / M)
}

/** Ion acoustic ω (rad/s) for k in 1/m, with the Debye correction; n in m⁻³, temperatures in eV. */
export function ionAcousticSI(k: number, n: number, TeV: number, TiV: number, M = mp, gammaI = 3): number {
  const lD2 = (eps0 * TeV * e) / (n * e * e)
  return k * Math.sqrt(((TeV * e) / M) / (1 + k * k * lD2) + (gammaI * TiV * e) / M)
}

/** Bohm–Gross ω (rad/s) in SI, with v_th² = kTe/m_e. */
export function bohmGrossSI(k: number, n: number, TeV: number): number {
  const wpe2 = (n * e * e) / (eps0 * me)
  return Math.sqrt(wpe2 + (3 * k * k * TeV * e) / me)
}

/** Upper hybrid frequency ω_h (rad/s), cold. */
export function upperHybridSI(n: number, B: number): number {
  const wpe2 = (n * e * e) / (eps0 * me)
  const wce = (e * B) / me
  return Math.sqrt(wpe2 + wce * wce)
}

/** Lower hybrid frequency ω_LH (rad/s) for ions of mass M. */
export function lowerHybridSI(n: number, B: number, M = mp): number {
  const wpi2 = (n * e * e) / (eps0 * M)
  const Wci = (e * B) / M
  const wce = (e * B) / me
  return 1 / Math.sqrt(1 / (wce * Wci) + 1 / (wpi2 + Wci * Wci))
}

// ---------- PIC measurement of the electron plasma wave ----------

export interface EpwRun {
  pic: Pic1D
  K: number // k λ_D of the excited mode
  k: number
  sinT: Float64Array // sin(k x_j) on the field grid, for projecting E onto the mode
  trace: number[] // mode amplitude a(t)
  times: number[]
  zeros: number[] // interpolated zero-crossing times of a(t)
  peak: number // largest |a| so far (for a noise threshold)
  faded: boolean // the wave has damped into the thermal noise; stop timing it
}

/**
 * Warm electrons (v_th = 1, so λ_D = 1 and ω_pe = 1) in a periodic box holding exactly one wavelength of the
 * chosen kλ_D. Electrons start displaced by δx = A sin(kx) with kA = 0.1, i.e. a 10% density ripple.
 */
export function createEpwRun(K: number, n = 20000, seed = 11): EpwRun {
  const L = (2 * Math.PI) / K
  const ng = Math.max(32, Math.round(L / 0.4))
  const pic = createPic({ n, ng, L, dt: 0.05, amplitude: 0.1 / K, mode: 1, vth: 1, seed })
  const dx = L / ng
  const sinT = new Float64Array(ng)
  for (let j = 0; j < ng; j++) sinT[j] = Math.sin(K * (j + 1) * dx) // E[j] sits on the right face of cell j
  const run: EpwRun = { pic, K, k: K, sinT, trace: [], times: [], zeros: [], peak: 0, faded: false }
  run.trace.push(modeAmplitude(run))
  run.times.push(0)
  run.peak = Math.abs(run.trace[0])
  return run
}

export function modeAmplitude(run: EpwRun): number {
  const E = run.pic.E
  let s = 0
  for (let j = 0; j < E.length; j++) s += E[j] * run.sinT[j]
  return (2 * s) / E.length
}

/** Advance the PIC run and record zero crossings of the mode amplitude while it is well above the noise. */
export function stepEpwRun(run: EpwRun, steps: number): void {
  for (let s = 0; s < steps; s++) {
    stepPic(run.pic)
    const a = modeAmplitude(run)
    const t = run.pic.t
    const aPrev = run.trace[run.trace.length - 1]
    const tPrev = run.times[run.times.length - 1]
    run.trace.push(a)
    run.times.push(t)
    run.peak = Math.max(run.peak, Math.abs(a))
    // stop timing for good once the wave has damped into the thermal noise (Landau damping, lesson A9)
    if (!run.faded && t > 2 * Math.PI && recentPeak(run) < 0.25 * run.peak) run.faded = true
    if (!run.faded && aPrev * a < 0) run.zeros.push(tPrev + ((t - tPrev) * aPrev) / (aPrev - a))
  }
}

function recentPeak(run: EpwRun): number {
  let m = 0
  const n = run.trace.length
  const span = Math.min(n, Math.round((2 * Math.PI) / run.pic.dt)) // about one period
  for (let i = n - span; i < n; i++) m = Math.max(m, Math.abs(run.trace[i]))
  return m
}

/** ω/ω_pe from a least-squares fit of zero-crossing times (successive crossings are half a period apart). */
export function epwFrequency(run: EpwRun): number | null {
  const z = run.zeros
  if (z.length < 4) return null
  const n = z.length
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sx += i
    sy += z[i]
    sxx += i * i
    sxy += i * z[i]
  }
  const halfPeriod = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  return Math.PI / halfPeriod
}

// ---------- wave packets: phase vs group velocity ----------

export type Dispersion = (k: number) => number

/** Standard example relations in normalized units (see the wave-packet simulation). */
export const PACKET_MODELS: Record<string, { label: string; w: Dispersion; units: string }> = {
  epw: { label: 'Electron plasma wave', w: (k) => Math.sqrt(1 + 3 * k * k), units: 'x in λ_D, t in 1/ω_pe' },
  iaw: { label: 'Ion acoustic wave', w: (k) => k / Math.sqrt(1 + k * k), units: 'x in λ_D, t in 1/ω_pi' },
  cold: { label: 'Cold plasma oscillation', w: () => 1, units: 'x in λ_D, t in 1/ω_pe' },
}

export interface Packet {
  L: number // periodic domain length
  ks: Float64Array
  amps: Float64Array
  ws: Float64Array
  x0: number
}

/** A Gaussian packet of width sigma centred on k0, built from the discrete modes k_j = 2πj/L so it is periodic in L. */
export function createPacket(w: Dispersion, k0: number, sigma: number, L: number, x0: number): Packet {
  const dk = (2 * Math.PI) / L
  const sk = 1 / sigma
  const jmin = Math.max(1, Math.floor((k0 - 4 * sk) / dk))
  const jmax = Math.ceil((k0 + 4 * sk) / dk)
  const n = jmax - jmin + 1
  const ks = new Float64Array(n)
  const amps = new Float64Array(n)
  const ws = new Float64Array(n)
  let norm = 0
  for (let i = 0; i < n; i++) {
    const k = (jmin + i) * dk
    ks[i] = k
    amps[i] = Math.exp(-((k - k0) ** 2) / (2 * sk * sk))
    ws[i] = w(k)
    norm += amps[i]
  }
  for (let i = 0; i < n; i++) amps[i] /= norm
  return { L, ks, amps, ws, x0 }
}

/** Real field and envelope at the points xs, time t. Writes into re and env. */
export function evalPacket(p: Packet, xs: Float64Array, t: number, re: Float64Array, env: Float64Array): void {
  for (let m = 0; m < xs.length; m++) {
    let c = 0
    let s = 0
    const xr = xs[m] - p.x0
    for (let i = 0; i < p.ks.length; i++) {
      const ph = p.ks[i] * xr - p.ws[i] * t
      c += p.amps[i] * Math.cos(ph)
      s += p.amps[i] * Math.sin(ph)
    }
    re[m] = c
    env[m] = Math.hypot(c, s)
  }
}

/** Position of the envelope peak (parabolic refinement on a uniform grid), unwrapped near `guess`. */
export function envelopePeak(xs: Float64Array, env: Float64Array): number {
  let im = 0
  for (let i = 1; i < env.length; i++) if (env[i] > env[im]) im = i
  const n = env.length
  const a = env[(im - 1 + n) % n]
  const b = env[im]
  const c = env[(im + 1) % n]
  const den = a - 2 * b + c
  const off = den !== 0 ? (0.5 * (a - c)) / den : 0
  const dx = xs[1] - xs[0]
  return xs[im] + off * dx
}

/** Theory phase and group velocity at k0 for a dispersion relation (central difference for dω/dk). */
export function phaseGroup(w: Dispersion, k0: number): { vp: number; vg: number } {
  const h = 1e-5
  return { vp: w(k0) / k0, vg: (w(k0 + h) - w(k0 - h)) / (2 * h) }
}

/**
 * Follow one crest: the local maximum of `re` closest to xPrev among those in [xPrev − back, xPrev + ahead],
 * on a periodic grid of length L. Returns the new unwrapped position, or null if there is none.
 */
export function nextCrest(xs: Float64Array, re: Float64Array, xPrev: number, back: number, ahead: number, L: number): number | null {
  const n = xs.length
  const dx = xs[1] - xs[0]
  let best: number | null = null
  for (let i = 0; i < n; i++) {
    const a = re[(i - 1 + n) % n]
    const b = re[i]
    const c = re[(i + 1) % n]
    if (!(b >= a && b > c)) continue
    const den = a - 2 * b + c
    const x = xs[i] + (den !== 0 ? (0.5 * (a - c)) / den : 0) * dx
    let d = (x - xPrev) % L
    if (d > L / 2) d -= L
    if (d < -L / 2) d += L
    if (d < -back || d > ahead) continue
    if (best === null || Math.abs(d) < Math.abs(best)) best = d
  }
  return best === null ? null : xPrev + best
}

/**
 * Measures phase and group velocity the way you would by eye: follow one crest while it is near the middle
 * of the packet (re-seeding on a central crest when it drifts out), and follow the envelope peak.
 * For a Gaussian packet the crest speed is biased toward v_g by a fraction ≈ 1/(kσ)², so use kσ ≳ 10.
 */
export interface PacketTracker {
  crest: number | null
  g: number
  crestDist: number
  crestTime: number
  envDist: number
  time: number
}

export function createTracker(xs: Float64Array, env: Float64Array): PacketTracker {
  return { crest: null, g: envelopePeak(xs, env), crestDist: 0, crestTime: 0, envDist: 0, time: 0 }
}

export function trackPacket(tr: PacketTracker, xs: Float64Array, re: Float64Array, env: Float64Array, dt: number, k0: number, sigma: number, L: number): void {
  const lam = (2 * Math.PI) / k0
  const g = envelopePeak(xs, env)
  let dg = (g - tr.g) % L
  if (dg > L / 2) dg -= L
  if (dg < -L / 2) dg += L
  tr.g += dg
  tr.envDist += dg
  tr.time += dt
  if (tr.crest !== null) {
    const next = nextCrest(xs, re, tr.crest, 0.05 * lam, 0.45 * lam, L)
    let off = next === null ? Infinity : (next - tr.g) % L
    if (off > L / 2) off -= L
    if (off < -L / 2) off += L
    if (next !== null && Math.abs(off) < 0.6 * sigma) {
      tr.crestDist += next - tr.crest
      tr.crestTime += dt
      tr.crest = next
      return
    }
  }
  tr.crest = nextCrest(xs, re, tr.g, 0.5 * lam, 0.5 * lam, L) // re-seed on the crest nearest the envelope peak
}

export const trackedPhaseVelocity = (tr: PacketTracker) => (tr.crestTime > 0 ? tr.crestDist / tr.crestTime : 0)
export const trackedGroupVelocity = (tr: PacketTracker) => (tr.time > 0 ? tr.envDist / tr.time : 0)
