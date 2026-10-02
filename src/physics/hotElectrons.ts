// B8: hot electrons. Test electrons in a prescribed electron plasma wave, two-temperature distributions and their
// bremsstrahlung, and the wave-breaking and phase-velocity numbers that set how energetic the electrons get.
//
// 1. Electrons surfing a wave. The wave potential is φ = φ0 cos(kx − ωt). An electron (charge −e) has potential
//    energy −eφ, so in the frame moving at v_ph = ω/k, with ξ = k(x − v_ph t) and u = v − v_ph, it moves in a static
//    row of wells:
//        H = ½ m u² − eφ0 cos ξ   (conserved).
//    Normalized units: v_te = √(T_e/m) = 1, k = 1, time in 1/(k v_te), and Φ = eφ0/T_e, so H = u²/2 − Φ cos ξ.
//    Wells (minima of H) are at ξ = 0, where φ is largest. The separatrix H = Φ has u = ±2√Φ |cos(ξ/2)|, so
//      • trapping half-width 2√(eφ0/m): trapped electrons never exceed v_ph + 2√(eφ0/m);
//      • bounce frequency of deeply trapped electrons ω_b = k√(eφ0/m) (A9's √(ekE/m) with E = kφ0).
//    The pusher is the fourth-order symplectic (Yoshida/Forest–Ruth) composition of drift–kick–drift leapfrog steps,
//    so H is conserved to O((ω dt)⁴) with no secular drift.
//    The electrons are loaded uniformly in v (stratified) and carry weights f_M(v)/g(v) (importance sampling), so
//    the far tail of the Maxwellian, where the action is, is as well resolved as the bulk. Their phases follow a jittered
//    golden-ratio sequence, which keeps weighted counts (such as the trapped fraction) within a few percent.
//
// 2. Two-temperature (bi-Maxwellian) electrons. For a 3D Maxwellian of temperature T the number per unit energy is
//    dN/dE = (2/√π) √E T^(−3/2) e^(−E/T): a Gamma distribution with shape 3/2 (shape 1/2 for one velocity component).
//    The fractions above E_p = xT are Γ(3/2, x)/Γ(3/2) for number and Γ(5/2, x)/Γ(5/2) for energy.
//    A mixture of two such Gamma laws is fitted by expectation–maximization (maximum likelihood).
//
// 3. Thin-target bremsstrahlung (Kramers cross-section dσ/dhν ∝ Z²/(v² hν)) from a Maxwellian: the emitted energy per
//    unit photon energy is ∝ n_e n_i Z² T^(−1/2) e^(−hν/T). Its logarithmic slope is −1/T, which is how T_hot is read
//    off a hard x-ray spectrum.
import { c, e, eps0, me } from './constants'

export const MEC2_KEV = (me * c * c) / e / 1e3

// ---------- small numerical helpers ----------

/** Mulberry32 seeded RNG. */
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

/** Standard normal deviate (Box–Muller) from a uniform RNG. */
export function gauss(r: () => number) {
  const u = Math.max(r(), 1e-300)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

/** Complementary error function, |relative error| < 1e-15 for x ≥ 0 via the continued fraction / series split. */
export function erfc(x: number): number {
  if (x < 0) return 2 - erfc(-x)
  if (x < 2) {
    // series for erf: erf x = (2/√π) Σ (−1)^n x^(2n+1)/(n!(2n+1))
    let sum = x
    let term = x
    for (let n = 1; n < 80; n++) {
      term *= (-x * x) / n
      const t = term / (2 * n + 1)
      sum += t
      if (Math.abs(t) < 1e-17 * Math.abs(sum)) break
    }
    return 1 - (2 / Math.sqrt(Math.PI)) * sum
  }
  // continued fraction (Lentz) for erfc x = e^(−x²)/√π · 1/(x + ½/(x + 1/(x + 3/2/(x + …))))
  let f = x
  let C = x
  let D = 0
  for (let n = 1; n < 300; n++) {
    const a = n / 2
    D = x + a * D
    D = D === 0 ? 1e-300 : 1 / D
    C = x + a / C
    if (C === 0) C = 1e-300
    const delta = C * D
    f *= delta
    if (Math.abs(delta - 1) < 1e-16) break
  }
  return Math.exp(-x * x) / (Math.sqrt(Math.PI) * f)
}

// ---------- 1. electrons surfing a wave ----------

export const trapHalfWidth = (Phi: number) => 2 * Math.sqrt(Phi)
export const bounceFrequency = (Phi: number) => Math.sqrt(Phi)
/** Upper branch of the separatrix u(ξ) = 2√Φ |cos(ξ/2)|. */
export const separatrixU = (xi: number, Phi: number) => 2 * Math.sqrt(Phi) * Math.abs(Math.cos(xi / 2))
export const hamiltonian = (xi: number, u: number, Phi: number) => 0.5 * u * u - Phi * Math.cos(xi)
/** The fastest any trapped electron gets in the lab: v_ph + 2√(eφ0/m), in units of v_te. */
export const maxTrappedVelocity = (vph: number, Phi: number) => vph + trapHalfWidth(Phi)

/**
 * Fraction of a Maxwellian (v_te = 1) that starts inside the separatrix of the wave, and so stays trapped forever in a
 * prescribed wave: (1/2π) ∫ dξ [N(v_ph + w(ξ)) − N(v_ph − w(ξ))], w = 2√Φ|cos(ξ/2)|, N the unit normal CDF.
 */
export function trappedFraction(vph: number, Phi: number, nq = 400) {
  const N = (x: number) => (x >= 0 ? 1 - 0.5 * erfc(x / Math.SQRT2) : 0.5 * erfc(-x / Math.SQRT2))
  let s = 0
  for (let k = 0; k < nq; k++) {
    const xi = -Math.PI + ((k + 0.5) / nq) * 2 * Math.PI // midpoint rule, spectrally accurate for a periodic integrand
    const w = separatrixU(xi, Phi)
    s += N(vph + w) - N(vph - w)
  }
  return s / nq
}

export interface Surf {
  n: number
  xi: Float64Array // wave phase, wrapped into [−π, π)
  u: Float64Array // velocity in the wave frame
  w: Float64Array // statistical weight (∫ f dv normalized so Σw/n ≈ 1)
  v0: Float64Array // initial lab velocity (for colouring)
  H0: Float64Array // initial wave-frame energy
  vph: number
  Phi: number
  t: number
}

export interface SurfInit {
  n: number
  vph: number
  Phi: number
  seed?: number
  vlo?: number
  vhi?: number
}

/** Velocity window for loading: the Maxwellian bulk plus everything the wave can reach. */
export function loadWindow(vph: number, Phi: number) {
  return { vlo: -5, vhi: Math.max(5, vph + 2 * Math.sqrt(Phi) + 3) }
}

export function createSurf(o: SurfInit): Surf {
  const r = rng(o.seed ?? 7)
  const win = loadWindow(o.vph, o.Phi)
  const vlo = o.vlo ?? win.vlo
  const vhi = o.vhi ?? win.vhi
  const n = o.n
  const xi = new Float64Array(n)
  const u = new Float64Array(n)
  const w = new Float64Array(n)
  const v0 = new Float64Array(n)
  const H0 = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const v = vlo + ((i + r()) / n) * (vhi - vlo) // stratified uniform in v
    // phase from a golden-ratio (Kronecker) sequence, jittered by less than one lattice cell: together with the stratified
    // v this fills phase space far more evenly than independent random draws, so weighted counts are much less noisy
    const q = i * 0.6180339887498949 + r() / Math.sqrt(n)
    xi[i] = -Math.PI + 2 * Math.PI * (q - Math.floor(q))
    u[i] = v - o.vph
    w[i] = (Math.exp(-0.5 * v * v) / Math.sqrt(2 * Math.PI)) * (vhi - vlo) // f_M(v)/g(v)
    v0[i] = v
    H0[i] = hamiltonian(xi[i], u[i], o.Phi)
  }
  return { n, xi, u, w, v0, H0, vph: o.vph, Phi: o.Phi, t: 0 }
}

// Yoshida's fourth-order composition of second-order leapfrog steps
const Y1 = 1 / (2 - Math.cbrt(2))
const Y0 = 1 - 2 * Y1
const YS = [Y1, Y0, Y1]

/** Advance every electron by `steps` steps of dt (wave frame, exact Hamiltonian flow up to O(dt⁴)). */
export function stepSurf(s: Surf, dt: number, steps = 1) {
  const { n, xi, u, Phi } = s
  const TWO_PI = 2 * Math.PI
  for (let k = 0; k < steps; k++) {
    for (const y of YS) {
      const h = y * dt
      for (let i = 0; i < n; i++) {
        let x = xi[i] + 0.5 * h * u[i]
        const ui = u[i] - h * Phi * Math.sin(x)
        x += 0.5 * h * ui
        u[i] = ui
        xi[i] = x
      }
    }
    for (let i = 0; i < n; i++) {
      const x = xi[i]
      if (x >= Math.PI || x < -Math.PI) xi[i] = x - TWO_PI * Math.floor((x + Math.PI) / TWO_PI)
    }
    s.t += dt
  }
}

/** One orbit (ξ, u) advanced in place by the same integrator. */
export function stepOrbit(p: { xi: number; u: number }, Phi: number, dt: number) {
  for (const y of YS) {
    const h = y * dt
    p.xi += 0.5 * h * p.u
    p.u -= h * Phi * Math.sin(p.xi)
    p.xi += 0.5 * h * p.u
  }
}

/** Measured period of an orbit started at rest at phase ξ0 (wave frame), from successive upward zero crossings of u. */
export function measureBouncePeriod(Phi: number, xi0: number, dt: number, periods = 5) {
  const p = { xi: xi0, u: 0 }
  let t = 0
  let prev = p.u
  const cross: number[] = []
  const tMax = (periods + 2) * (2 * Math.PI) / Math.sqrt(Phi) * 3
  while (cross.length < periods + 1 && t < tMax) {
    stepOrbit(p, Phi, dt)
    t += dt
    if (prev < 0 && p.u >= 0) cross.push(t - (p.u / (p.u - prev)) * dt)
    prev = p.u
  }
  if (cross.length < 2) return NaN
  return (cross[cross.length - 1] - cross[0]) / (cross.length - 1)
}

/** Largest relative change of the wave-frame energy over all electrons, |H − H0|/max(Φ, 1). */
export function maxEnergyError(s: Surf) {
  let m = 0
  for (let i = 0; i < s.n; i++) m = Math.max(m, Math.abs(hamiltonian(s.xi[i], s.u[i], s.Phi) - s.H0[i]))
  return m / Math.max(s.Phi, 1)
}

/** Weighted histogram of f(v) (per unit v, normalized to ∫f dv = 1) on [vmin, vmax). */
/** Weighted fraction of the loaded electrons that are inside the separatrix now (H < Φ). */
export function measuredTrappedFraction(s: Surf) {
  let tr = 0
  let all = 0
  for (let i = 0; i < s.n; i++) {
    all += s.w[i]
    if (hamiltonian(s.xi[i], s.u[i], s.Phi) < s.Phi) tr += s.w[i]
  }
  return tr / all
}

export function velocityHistogram(s: Surf, vmin: number, vmax: number, out: Float64Array) {
  const nb = out.length
  out.fill(0)
  const dv = (vmax - vmin) / nb
  let W = 0
  for (let i = 0; i < s.n; i++) {
    W += s.w[i]
    const v = s.u[i] + s.vph
    const b = Math.floor((v - vmin) / dv)
    if (b >= 0 && b < nb) out[b] += s.w[i]
  }
  for (let b = 0; b < nb; b++) out[b] /= W * dv
}

// ---------- 2. two-temperature distributions ----------

export interface TwoTFit {
  alpha: number // hot fraction (by number)
  Tc: number
  Th: number
  iterations: number
}

/**
 * Maximum-likelihood fit of a two-temperature mixture to energies E_i (weights w_i, or 1), each component a Gamma law
 * of the given shape (1/2 for one velocity component, 3/2 for three) with scale T. Expectation–maximization: the
 * E-step gives each electron's probability r_i of belonging to the hot group; the M-step sets
 * α = Σw r/Σw and T = Σw r E/(shape Σw r) for each group. With `fixTc` the cold temperature is held at a known
 * value (the bulk temperature, measured some other way) and only α and T_h are fitted.
 */
export function fitTwoTemperature(
  E: ArrayLike<number>,
  w: ArrayLike<number> | null,
  shape: number,
  init?: { alpha: number; Tc: number; Th: number },
  iterations = 300,
  tol = 1e-10,
  fixTc?: number,
): TwoTFit {
  const n = E.length
  let W = 0
  let WE = 0
  for (let i = 0; i < n; i++) {
    const wi = w ? w[i] : 1
    W += wi
    WE += wi * E[i]
  }
  const Tmean = WE / (W * shape)
  let alpha = init?.alpha ?? 0.05
  let Tc = fixTc ?? init?.Tc ?? 0.8 * Tmean
  let Th = init?.Th ?? 5 * Tmean
  let it = 0
  for (; it < iterations; it++) {
    let sr = 0
    let srE = 0
    let sc = 0
    let scE = 0
    const la = Math.log(alpha) - shape * Math.log(Th)
    const lc = Math.log(1 - alpha) - shape * Math.log(Tc)
    for (let i = 0; i < n; i++) {
      const wi = w ? w[i] : 1
      if (wi === 0) continue
      const Ei = E[i]
      // r = hot/(hot + cold), computed stably
      const d = lc - Ei / Tc - (la - Ei / Th)
      const r = d > 40 ? 0 : 1 / (1 + Math.exp(d))
      sr += wi * r
      srE += wi * r * Ei
      sc += wi * (1 - r)
      scE += wi * (1 - r) * Ei
    }
    const a2 = sr / W
    const Th2 = sr > 0 ? srE / (shape * sr) : Th
    const Tc2 = fixTc ?? (sc > 0 ? scE / (shape * sc) : Tc)
    const change = Math.abs(a2 - alpha) / Math.max(alpha, 1e-12) + Math.abs(Th2 / Th - 1) + Math.abs(Tc2 / Tc - 1)
    alpha = Math.min(Math.max(a2, 1e-9), 1 - 1e-9)
    Th = Th2
    Tc = Tc2
    if (change < tol) break
  }
  if (Tc > Th) return { alpha: 1 - alpha, Tc: Th, Th: Tc, iterations: it }
  return { alpha, Tc, Th, iterations: it }
}

/** Number fraction of a 3D Maxwellian above E = xT: Γ(3/2, x)/Γ(3/2). */
export const fractionAbove = (x: number) => erfc(Math.sqrt(x)) + (2 / Math.sqrt(Math.PI)) * Math.sqrt(x) * Math.exp(-x)
/** Energy fraction of a 3D Maxwellian carried by electrons above E = xT: Γ(5/2, x)/Γ(5/2). */
export const energyFractionAbove = (x: number) =>
  erfc(Math.sqrt(x)) + (2 / Math.sqrt(Math.PI)) * Math.sqrt(x) * Math.exp(-x) * (1 + (2 * x) / 3)

/** dN/dE of a 3D Maxwellian (normalized to 1). */
export const maxwellPdf3 = (E: number, T: number) => (2 / Math.sqrt(Math.PI)) * Math.sqrt(E / T) * Math.exp(-E / T) / T

/** Fraction of the total electron energy carried by the hot group: αT_h/((1 − α)T_c + αT_h). */
export const hotEnergyFraction = (alpha: number, Tc: number, Th: number) => (alpha * Th) / ((1 - alpha) * Tc + alpha * Th)

/** Number and energy fractions of a bi-Maxwellian above the energy Ep. */
export function biMaxwellAbove(Ep: number, alpha: number, Tc: number, Th: number) {
  const number = (1 - alpha) * fractionAbove(Ep / Tc) + alpha * fractionAbove(Ep / Th)
  const Etot = (1 - alpha) * Tc + alpha * Th
  const energy = ((1 - alpha) * Tc * energyFractionAbove(Ep / Tc) + alpha * Th * energyFractionAbove(Ep / Th)) / Etot
  return { number, energy }
}

/**
 * Energy where the hot term overtakes the cold one in a sum (1 − α)T_c^(−p)e^(−E/T_c) + αT_h^(−p)e^(−E/T_h):
 * p = 3/2 for f per unit velocity-space volume, p = 1/2 for the bremsstrahlung emissivity.
 */
export function crossoverEnergy(alpha: number, Tc: number, Th: number, p: number) {
  const L = Math.log(((1 - alpha) / alpha) * (Th / Tc) ** p)
  return L > 0 ? L / (1 / Tc - 1 / Th) : 0
}

/** Bi-Maxwellian f per unit velocity-space volume, as a function of energy (cold density normalized). */
export const biMaxwellF = (E: number, alpha: number, Tc: number, Th: number) =>
  (1 - alpha) * Tc ** -1.5 * Math.exp(-E / Tc) + alpha * Th ** -1.5 * Math.exp(-E / Th)

// ---------- 3. bremsstrahlung ----------

/** Thin-target bremsstrahlung energy spectrum (arbitrary units) of a bi-Maxwellian. */
export const bremsThin = (hv: number, alpha: number, Tc: number, Th: number) =>
  (1 - alpha) * Tc ** -0.5 * Math.exp(-hv / Tc) + alpha * Th ** -0.5 * Math.exp(-hv / Th)

/** Local slope temperature −1/(d ln j/d hν) of the thin-target spectrum. */
export function bremsSlopeT(hv: number, alpha: number, Tc: number, Th: number) {
  const a = (1 - alpha) * Tc ** -0.5 * Math.exp(-hv / Tc)
  const b = alpha * Th ** -0.5 * Math.exp(-hv / Th)
  return (a + b) / (a / Tc + b / Th)
}

/**
 * Least-squares slope temperature of ln(signal) vs hν over channels with signal > 0. The weights default to the
 * signal itself (Poisson counts: var(ln N) ≈ 1/N); pass the photon counts when the signal is an energy, N·hν.
 */
export function slopeTemperature(hv: ArrayLike<number>, counts: ArrayLike<number>, lo: number, hi: number, weights?: ArrayLike<number>) {
  let S = 0
  let Sx = 0
  let Sy = 0
  let Sxx = 0
  let Sxy = 0
  let used = 0
  for (let i = 0; i < hv.length; i++) {
    const x = hv[i]
    const nC = counts[i]
    if (x < lo || x > hi || nC <= 0) continue
    const y = Math.log(nC)
    const wgt = weights ? weights[i] : nC // Poisson: var(ln N) ≈ 1/N
    if (!(wgt > 0)) continue
    S += wgt
    Sx += wgt * x
    Sy += wgt * y
    Sxx += wgt * x * x
    Sxy += wgt * x * y
    used++
  }
  if (used < 3) return null
  const d = S * Sxx - Sx * Sx
  if (d <= 0) return null
  const slope = (S * Sxy - Sx * Sy) / d
  const err = Math.sqrt(S / d) // standard error of the slope
  if (slope >= 0) return null
  return { T: -1 / slope, dT: err / (slope * slope), used }
}

/** Poisson deviate with mean m (Knuth for small m, normal approximation for large m). */
export function poisson(m: number, r: () => number) {
  if (m <= 0) return 0
  if (m < 30) {
    const L = Math.exp(-m)
    let k = 0
    let p = 1
    do {
      k++
      p *= r()
    } while (p > L)
    return k - 1
  }
  return Math.max(0, Math.round(m + Math.sqrt(m) * gauss(r)))
}

/**
 * A hard x-ray detector looking at thin-target bremsstrahlung from a bi-Maxwellian: `n` channels of equal width from
 * `lo` to `hi` (keV) and the expected share of the photon energy in each (normalized to 1 over the channels).
 */
export function bremsChannels(lo: number, hi: number, n: number) {
  const hv = new Float64Array(n)
  for (let i = 0; i < n; i++) hv[i] = lo + ((i + 0.5) * (hi - lo)) / n
  return hv
}
export function bremsShares(hv: ArrayLike<number>, alpha: number, Tc: number, Th: number, out: Float64Array) {
  let s = 0
  for (let i = 0; i < hv.length; i++) {
    out[i] = bremsThin(hv[i], alpha, Tc, Th)
    s += out[i]
  }
  for (let i = 0; i < hv.length; i++) out[i] /= s
  return out
}
/**
 * Photon energies over which the spectrum is a clean single exponential of slope −1/T_h: from well above the
 * crossover of the two thin-target terms (where the cold term has fallen to under 1% of the hot one) to ~8 T_h.
 */
export function slopeWindow(alpha: number, Tc: number, Th: number, cap = Infinity) {
  const x = crossoverEnergy(alpha, Tc, Th, 0.5)
  // the cold/hot ratio falls by e every 1/(1/Tc − 1/Th) beyond the crossover: ln 100 more
  const lo = Math.max(x + Math.log(100) / (1 / Tc - 1 / Th), 5 * Tc)
  return { lo, hi: Math.min(Math.max(lo + 2 * Th, 8 * Th), cap) }
}

// ---------- 4. how fast can the wave throw electrons? ----------

/** Cold (Dawson) wave-breaking field m ω_pe v_ph/e, in V/m, for n in m⁻³ and v_ph in m/s. */
export function coldWavebreakingField(n: number, vph: number) {
  const wpe = Math.sqrt((n * e * e) / (eps0 * me))
  return (me * wpe * vph) / e
}

/**
 * Electron plasma wave of backscattered SRS at density nn = n/n_c and temperature T (keV), with Bohm–Gross plasma
 * waves and exact matching: ω0 = ω_s + ω_ek, k = k0 + k_s. Normalized ω0 = 1, c = 1. Null if there is no solution
 * (just below n_c/4 when T > 0, where the scattered light would be born at its cut-off).
 */
export function srsPlasmaWave(nn: number, TkeV: number) {
  const b2 = TkeV / MEC2_KEV
  const k0 = Math.sqrt(1 - nn)
  const f = (ks: number) => 1 - Math.sqrt(nn + ks * ks) - Math.sqrt(nn + 3 * b2 * (k0 + ks) ** 2)
  if (f(0) < 0) return null
  let lo = 0
  let hi = k0
  for (let i = 0; i < 100; i++) {
    const m = 0.5 * (lo + hi)
    if (f(m) > 0) lo = m
    else hi = m
  }
  const ks = 0.5 * (lo + hi)
  const k = k0 + ks
  const w = Math.sqrt(nn + 3 * b2 * k * k)
  return { k, w, vph: w / k, klD: (k * Math.sqrt(b2)) / Math.sqrt(nn) }
}

/** Kinetic energy (keV) of an electron reflected from rest by a wave of phase velocity βc: 2β²γ²mc² (relativistic). */
export const reflectedEnergyKeV = (beta: number) => (2 * beta * beta * MEC2_KEV) / (1 - beta * beta)
/** The same, non-relativistically: ½m(2v_ph)² = 2β²mc². */
export const reflectedEnergyNonRelKeV = (beta: number) => 2 * beta * beta * MEC2_KEV
