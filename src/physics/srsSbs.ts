// B6: stimulated Raman (SRS) and Brillouin (SBS) scattering.
//
//   - homogeneous backscatter growth rates in weak coupling, and the SBS cubic that contains both the weak and
//     the strongly coupled regimes;
//   - the damping of the daughter waves: kinetic Landau damping of the plasma wave (the exact roots of A9,
//     tabulated) and the small-kλ_De formula for ion acoustic waves generalized to charge Z;
//   - Rosenbluth gains in a density gradient (SRS) and a flow-velocity gradient (SBS);
//   - a 1D space–time solver for the three-wave envelope equations of backscatter, with Tang's steady state.
//
// Normalized units as in parametric.ts: ω0 = c = 1 (wavenumbers in ω0/c, lengths in c/ω0 = λ0/2π).
// v_os = eE0/(m_e ω0) is the peak quiver speed in a linearly polarized pump with I = ½ε0 c E0² (B1). All the
// growth rates below were derived from the coupled fluid equations in SI and checked against the full
// dispersion relation (both Stokes and anti-Stokes sidebands).
import { c, me } from './constants'
import { landauApprox, landauExact } from './plasmaZ'
import { mulberry32 } from './randomwalk'
import { AMU, groupVelocity, kLambdaDe, sbsBackscatter, srsBackscatter, srsKappaPrime, type Backscatter, type Norm } from './parametric'

/** Laser angular frequency ω0 (rad/s) for a vacuum wavelength in µm. */
export const omega0Of = (lamUm: number) => (2 * Math.PI * c) / (lamUm * 1e-6)

/** Convert a rate in units of ω0 to ps⁻¹. */
export const toPerPs = (rate: number, lamUm: number) => (rate * omega0Of(lamUm)) / 1e12

/** Convert a length in µm to units of c/ω0. */
export const umToNorm = (um: number, lamUm: number) => (2 * Math.PI * um) / lamUm

// ---------- SRS ----------

export interface SrsInfo extends Backscatter {
  gamma0: number // growth rate / ω0
  klD: number // kλ_De of the plasma wave
}

/**
 * SRS backscatter, weak coupling: γ0 = (k v_os/4) [ω_pe²/(ω_ek(ω0 − ω_ek))]^{1/2}, with k the plasma-wave
 * wavenumber (≈ k0 + k_s). vos in units of c. Null where SRS backscatter cannot be matched (n ≳ n_c/4).
 */
export function srsGrowth(N: Norm, vos: number): SrsInfo | null {
  const b = srsBackscatter(N)
  if (!b) return null
  return { ...b, gamma0: ((b.k * vos) / 4) * Math.sqrt(N.nn / (b.w * b.ws)), klD: kLambdaDe(b.k, N) }
}

/** The same weak-coupling formula for a plasma wave of wavenumber k and frequency w (any scattering angle,
 *  scattered light polarized along the pump field). */
export const srsGammaFormula = (N: Norm, vos: number, k: number, w: number) => ((k * vos) / 4) * Math.sqrt(N.nn / (w * (1 - w)))

// Kinetic Landau damping of Langmuir waves, from the exact roots of A9 (tabulated once, then interpolated).
let LANDAU: Float64Array | null = null
const LK0 = 0.14
const LK1 = 1.2
const LDK = 0.005
/** Landau damping rate of an electron plasma wave, ν/ω_pe (positive), at kλ_De = k (Maxwellian electrons). */
export function epwDamping(klD: number): number {
  if (!(klD > 0)) return 0
  if (klD < LK0) return landauApprox(klD)
  if (!LANDAU) {
    const n = Math.round((LK1 - LK0) / LDK) + 1
    LANDAU = new Float64Array(n)
    for (let i = 0; i < n; i++) LANDAU[i] = -landauExact(LK0 + i * LDK)[1]
  }
  const f = (Math.min(klD, LK1) - LK0) / LDK
  const i = Math.min(LANDAU.length - 2, Math.floor(f))
  const a = f - i
  return LANDAU[i] * (1 - a) + LANDAU[i + 1] * a
}

// ---------- SBS ----------

/** ω_pi²/ω0² = (n/n_c) Z m_e/M for ions of charge Z and mass number A. */
export const ionPlasmaFreq2 = (N: Norm, Z: number, A: number) => (N.nn * Z * me) / (A * AMU)

export interface SbsInfo extends Backscatter {
  weak: number // weak-coupling γ/ω0
  strong: number // strongly coupled γ/ω0
  cubic: number // max growth of the resonant cubic (both regimes)
  kcs: number // ion acoustic frequency k c_s / ω0
}

/**
 * Largest imaginary part of the roots of ω³ + bω² + cω + d (real coefficients), by Cardano.
 * Zero when all three roots are real.
 */
export function cubicMaxGrowth(b: number, cc: number, d: number): number {
  const p = cc - (b * b) / 3
  const q = (2 * b * b * b) / 27 - (b * cc) / 3 + d
  const disc = (q * q) / 4 + (p * p * p) / 27
  if (disc <= 0) return 0
  const s = Math.sqrt(disc)
  const u = Math.cbrt(-q / 2 + s)
  const v = Math.cbrt(-q / 2 - s)
  return (Math.sqrt(3) / 2) * Math.abs(u - v)
}

/** The growing root (re, im) of ω³ + bω² + cω + d, by Cardano; [NaN, 0] when all three roots are real. */
export function cubicGrowingRoot(b: number, cc: number, d: number): [number, number] {
  const p = cc - (b * b) / 3
  const q = (2 * b * b * b) / 27 - (b * cc) / 3 + d
  const disc = (q * q) / 4 + (p * p * p) / 27
  if (disc <= 0) return [NaN, 0]
  const s = Math.sqrt(disc)
  const u = Math.cbrt(-q / 2 + s)
  const v = Math.cbrt(-q / 2 - s)
  return [-(u + v) / 2 - b / 3, (Math.sqrt(3) / 2) * Math.abs(u - v)]
}

/**
 * Growing root of the full backscatter dispersion relation with both light sidebands (Stokes and anti-Stokes),
 *   ω² − ω_k² = (k² v_os² ω_c²/4) [1/D(ω − 1, k − k0) + 1/D(ω + 1, k + k0)],  D(ω, k) = ω² − k² − n/n_c,
 * by Newton's method from a guess (re, im). For SRS ω_k² = ω_ek² and ω_c² = ω_pe²; for SBS ω_k² = k²c_s² and
 * ω_c² = ω_pi². Units of ω0 and ω0/c. Returns Im ω, or NaN if Newton does not converge.
 */
export function fullDispersionGrowth(nn: number, k: number, k0: number, wk2: number, wc2: number, vos: number, guess: [number, number]): number {
  const C = (k * k * vos * vos * wc2) / 4
  let fr = 0
  let fi = 0
  const F = (wr: number, wi: number) => {
    // 1/D for the two sidebands
    const ar = (wr - 1) * (wr - 1) - wi * wi - (k - k0) * (k - k0) - nn
    const ai = 2 * (wr - 1) * wi
    const br = (wr + 1) * (wr + 1) - wi * wi - (k + k0) * (k + k0) - nn
    const bi = 2 * (wr + 1) * wi
    const da = ar * ar + ai * ai
    const db = br * br + bi * bi
    fr = wr * wr - wi * wi - wk2 - C * (ar / da + br / db)
    fi = 2 * wr * wi - C * (-ai / da - bi / db)
  }
  let [wr, wi] = guess
  for (let it = 0; it < 80; it++) {
    const h = 1e-7 * Math.hypot(wr, wi)
    F(wr, wi)
    const f0r = fr
    const f0i = fi
    F(wr + h, wi) // F is analytic in ω, so F′ ≈ (F(ω + h) − F(ω))/h
    const dr = (fr - f0r) / h
    const di = (fi - f0i) / h
    const d = dr * dr + di * di
    const sr = (f0r * dr + f0i * di) / d
    const si = (f0i * dr - f0r * di) / d
    wr -= sr
    wi -= si
    if (!Number.isFinite(wr) || !Number.isFinite(wi)) return NaN
    if (Math.hypot(sr, si) < 1e-13 * Math.hypot(wr, wi)) return wi
  }
  return NaN
}

/**
 * SBS backscatter growth rates (units of ω0; vos in c). With k the ion-wave wavenumber (≈ 2k0):
 *   weak coupling (γ ≪ kc_s):   γ = (k v_os/4) ω_pi / √(k c_s ω_s)   [= (1/2√2) k0 v_os ω_pi/√(ω0 k0 c_s) for k = 2k0]
 *   strong coupling (γ ≫ kc_s): γ = (√3/4) (k² v_os² ω_pi²/ω0)^{1/3}  [= (√3/2^{4/3})(k0² v_os² ω_pi²/ω0)^{1/3}]
 *   both: the largest root of (ω² − k²c_s²)(ω − kc_s) = −k² v_os² ω_pi²/(8ω0).
 */
export function sbsGrowth(N: Norm, vos: number, Z: number, A: number): SbsInfo | null {
  const b = sbsBackscatter(N)
  if (!b) return null
  const wpi2 = ionPlasmaFreq2(N, Z, A)
  const a = b.w
  const B = (b.k * b.k * vos * vos * wpi2) / 8
  return {
    ...b,
    weak: ((b.k * vos) / 4) * Math.sqrt(wpi2 / (a * b.ws)),
    strong: (Math.sqrt(3) / 4) * Math.cbrt(b.k * b.k * vos * vos * wpi2),
    cubic: cubicMaxGrowth(-a, -a * a, a * a * a + B),
    kcs: a,
  }
}

/**
 * Ion acoustic damping per radian, −γ/ω_r, small-kλ_De formula for Maxwellian ions of charge Z and mass number
 * A (A9's formula with T_e → ZT_e and m/M → Zm_e/M): √(π/8)[√(Zm_e/M) + (ZT_e/T_i)^{3/2} e^{−ZT_e/2T_i − 3/2}].
 */
export function iawDampingRatio(ZTeOverTi: number, Z: number, A: number): number {
  const x = ZTeOverTi
  return Math.sqrt(Math.PI / 8) * (Math.sqrt((Z * me) / (A * AMU)) + x ** 1.5 * Math.exp(-x / 2 - 1.5))
}

/** Net temporal growth with one damped daughter (amplitude rate ν) and an undamped one: −ν/2 + √(ν²/4 + γ0²). */
export const dampedGrowth = (g0: number, nu: number) => -nu / 2 + Math.sqrt((nu * nu) / 4 + g0 * g0)

// ---------- gains ----------

/** Rosenbluth gain of SRS backscatter in a linear density gradient of scale length L (in c/ω0). */
export function srsGain(N: Norm, vos: number, L: number): number {
  const s = srsGrowth(N, vos)
  if (!s) return NaN
  const kp = srsKappaPrime(N, s, L)
  const vs = groupVelocity('light', s.ks, N)
  const ve = groupVelocity('epw', s.k, N)
  return (2 * Math.PI * s.gamma0 * s.gamma0) / Math.abs(kp * vs * ve)
}

/**
 * Rosenbluth gain of SBS backscatter in a flow gradient du/dx = c_s/L_u (L_u in c/ω0): the ion wave's
 * wavenumber at fixed lab frequency changes as dk/dx = −k u′/(c_s + u), so κ′v_ia = k u′ and
 * G = 2πγ0²/(k u′ v_s). Weak-coupling γ0.
 */
export function sbsGain(N: Norm, vos: number, Z: number, A: number, Lu: number): number {
  const s = sbsGrowth(N, vos, Z, A)
  if (!s) return NaN
  const up = N.cs / Lu
  const vs = groupVelocity('light', s.ks, N)
  return (2 * Math.PI * s.weak * s.weak) / (s.k * up * vs)
}

/** Steady-state spatial gain exponent (intensity) of a homogeneous slab of length L with the plasma wave damped
 *  at ν and the scattered light at group velocity v: G = 2γ0²L/(ν v). */
export const homogeneousGain = (g0: number, nu: number, L: number, v: number) => (2 * g0 * g0 * L) / (nu * v)

/**
 * Tang's steady state with pump depletion (strongly damped daughter, action units): the backscattered
 * fraction r of the incident pump action flux solves r(1 − r + ε) = ε e^{G(1 − r)}, where ε is the seed
 * entering at the far side and G the small-signal gain. Returns the root below 1 (r → ε e^G for small r).
 */
export function tangReflectivity(G: number, eps: number): number {
  const f = (r: number) => Math.log(r) + Math.log(1 - r + eps) - Math.log(eps) - G * (1 - r)
  // f(0+) = −∞ and f(1) = 0 (the trivial root); for ε(1 + G) < 1, f > 0 just below 1, so the physical root
  // lies in between
  let a = 1e-300
  let b = 1 - 1e-15
  if (f(b) < 0) return 1
  for (let it = 0; it < 200; it++) {
    const m = 0.5 * (a + b)
    if (f(m) > 0) b = m
    else a = m
  }
  return 0.5 * (a + b)
}

// ---------- the three-wave envelope solver ----------
//   ∂t a0 + ∂x a0 = −K a1 a2          pump, moving right at speed 1
//   ∂t a1 − ∂x a1 = +K a0 a2*         backscattered light, moving left at speed 1
//   ∂t a2 + ν a2  = +K a0 a1*         plasma (or ion) wave: group velocity ≈ 0, damped at ν
// |a_j|² are action densities (energy/ω), so the coupling is the same K for all three (Manley–Rowe): each
// pump quantum destroyed makes one quantum of each daughter. With the pump amplitude 1, γ0 = K.
// Each step shifts the light waves one cell (dt = dx, so advection is exact) and then advances the local
// coupling with RK4.

export type EnvMode = 'periodic' | 'slab'

export interface ThreeWave {
  n: number
  L: number
  dx: number
  dt: number
  t: number
  K: number
  nu: number
  mode: EnvMode
  seed: number // seed intensity |a1|² relative to the pump (slab: entering at x = L; periodic: initial, uniform)
  noise: boolean
  a0r: Float64Array
  a0i: Float64Array
  a1r: Float64Array
  a1i: Float64Array
  a2r: Float64Array
  a2i: Float64Array
  /** action that entered/left through the boundaries (slab), for the Manley–Rowe balance */
  pumpIn: number
  pumpOut: number
  scatIn: number
  scatOut: number
  rand: () => number
  zr: number // current (noisy) seed amplitude
  zi: number
}

export interface ThreeWaveOptions {
  n?: number
  L: number
  K: number
  nu: number
  mode: EnvMode
  seed: number
  noise?: boolean
  prefill?: boolean // slab: start with the pump already filling the slab
  randSeed?: number
}

export function createThreeWave(o: ThreeWaveOptions): ThreeWave {
  const n = o.n ?? 400
  const dx = o.L / n
  const s: ThreeWave = {
    n,
    L: o.L,
    dx,
    dt: dx,
    t: 0,
    K: o.K,
    nu: o.nu,
    mode: o.mode,
    seed: o.seed,
    noise: !!o.noise,
    a0r: new Float64Array(n),
    a0i: new Float64Array(n),
    a1r: new Float64Array(n),
    a1i: new Float64Array(n),
    a2r: new Float64Array(n),
    a2i: new Float64Array(n),
    pumpIn: 0,
    pumpOut: 0,
    scatIn: 0,
    scatOut: 0,
    rand: mulberry32(o.randSeed ?? 7),
    zr: Math.sqrt(o.seed),
    zi: 0,
  }
  if (o.mode === 'periodic' || o.prefill) s.a0r.fill(1)
  if (o.mode === 'periodic') s.a1r.fill(Math.sqrt(o.seed))
  return s
}

const NOISE_TAU = 4 // correlation time of the noisy seed (same time unit as 1/K; longer than 1/ν so it sits inside the gain bandwidth)

function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-300)) * Math.cos(2 * Math.PI * rand())
}

/** Advance the local three-wave coupling in every cell by one dt (RK4). */
function react(s: ThreeWave, dt: number): void {
  const K = s.K
  const nu = s.nu
  const { a0r, a0i, a1r, a1i, a2r, a2i } = s
  for (let i = 0; i < s.n; i++) {
    const p0r = a0r[i]
    const p0i = a0i[i]
    const p1r = a1r[i]
    const p1i = a1i[i]
    const p2r = a2r[i]
    const p2i = a2i[i]
    // f(a0, a1, a2) = (−K a1 a2, K a0 conj(a2), K a0 conj(a1) − ν a2)
    let x0r = p0r
    let x0i = p0i
    let x1r = p1r
    let x1i = p1i
    let x2r = p2r
    let x2i = p2i
    let s0r = 0
    let s0i = 0
    let s1r = 0
    let s1i = 0
    let s2r = 0
    let s2i = 0
    for (let st = 0; st < 4; st++) {
      const d0r = -K * (x1r * x2r - x1i * x2i)
      const d0i = -K * (x1r * x2i + x1i * x2r)
      const d1r = K * (x0r * x2r + x0i * x2i)
      const d1i = K * (x0i * x2r - x0r * x2i)
      const d2r = K * (x0r * x1r + x0i * x1i) - nu * x2r
      const d2i = K * (x0i * x1r - x0r * x1i) - nu * x2i
      const w = st === 0 || st === 3 ? 1 : 2
      s0r += w * d0r
      s0i += w * d0i
      s1r += w * d1r
      s1i += w * d1i
      s2r += w * d2r
      s2i += w * d2i
      if (st < 3) {
        const h = st < 2 ? 0.5 * dt : dt
        x0r = p0r + h * d0r
        x0i = p0i + h * d0i
        x1r = p1r + h * d1r
        x1i = p1i + h * d1i
        x2r = p2r + h * d2r
        x2i = p2i + h * d2i
      }
    }
    a0r[i] = p0r + (dt / 6) * s0r
    a0i[i] = p0i + (dt / 6) * s0i
    a1r[i] = p1r + (dt / 6) * s1r
    a1i[i] = p1i + (dt / 6) * s1i
    a2r[i] = p2r + (dt / 6) * s2r
    a2i[i] = p2i + (dt / 6) * s2i
  }
}

/** Shift the pump one cell right and the scattered light one cell left (dt = dx). */
function advect(s: ThreeWave): void {
  const { n, a0r, a0i, a1r, a1i, dx } = s
  if (s.mode === 'periodic') {
    const r0 = a0r[n - 1]
    const i0 = a0i[n - 1]
    a0r.copyWithin(1, 0, n - 1)
    a0i.copyWithin(1, 0, n - 1)
    a0r[0] = r0
    a0i[0] = i0
    const r1 = a1r[0]
    const i1 = a1i[0]
    a1r.copyWithin(0, 1)
    a1i.copyWithin(0, 1)
    a1r[n - 1] = r1
    a1i[n - 1] = i1
    return
  }
  s.pumpOut += (a0r[n - 1] ** 2 + a0i[n - 1] ** 2) * dx
  s.scatOut += (a1r[0] ** 2 + a1i[0] ** 2) * dx
  a0r.copyWithin(1, 0, n - 1)
  a0i.copyWithin(1, 0, n - 1)
  a0r[0] = 1
  a0i[0] = 0
  s.pumpIn += dx
  a1r.copyWithin(0, 1)
  a1i.copyWithin(0, 1)
  if (s.noise) {
    // complex Ornstein–Uhlenbeck seed with mean intensity `seed` and correlation time NOISE_TAU
    const rho = Math.exp(-s.dt / NOISE_TAU)
    const q = Math.sqrt((1 - rho * rho) * s.seed * 0.5)
    s.zr = rho * s.zr + q * gauss(s.rand)
    s.zi = rho * s.zi + q * gauss(s.rand)
  }
  a1r[n - 1] = s.zr
  a1i[n - 1] = s.zi
  s.scatIn += (s.zr * s.zr + s.zi * s.zi) * dx
}

export function stepThreeWave(s: ThreeWave, steps = 1): void {
  for (let k = 0; k < steps; k++) {
    advect(s)
    react(s, s.dt)
    s.t += s.dt
  }
}

/** Total action of each wave in the box, Σ|a|² dx. */
export function actions(s: ThreeWave): [number, number, number] {
  let n0 = 0
  let n1 = 0
  let n2 = 0
  for (let i = 0; i < s.n; i++) {
    n0 += s.a0r[i] ** 2 + s.a0i[i] ** 2
    n1 += s.a1r[i] ** 2 + s.a1i[i] ** 2
    n2 += s.a2r[i] ** 2 + s.a2i[i] ** 2
  }
  return [n0 * s.dx, n1 * s.dx, n2 * s.dx]
}

/**
 * Manley–Rowe bookkeeping (slab): pump quanta destroyed (in − out − still inside) and scattered quanta
 * created (out + inside − in). Their ratio is 1 if each destroyed pump quantum made one scattered quantum.
 */
export function manleyRoweBalance(s: ThreeWave): { pumpLost: number; scatMade: number } {
  const [n0, n1] = actions(s)
  return { pumpLost: s.pumpIn - s.pumpOut - n0, scatMade: s.scatOut + n1 - s.scatIn }
}

/** |a1|² at the left edge (x = 0): the backscattered action flux relative to the incident pump. */
export const backscatterAt0 = (s: ThreeWave) => s.a1r[0] ** 2 + s.a1i[0] ** 2

/** Uniform-medium temporal growth with damping ν on the plasma wave only. */
export const envelopeTemporalTheory = (K: number, nu: number) => dampedGrowth(K, nu)
