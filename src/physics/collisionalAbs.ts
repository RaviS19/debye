// B2: collisional (inverse bremsstrahlung) absorption of laser light in a density ramp.
//
// Electrons quiver in the laser field; electron–ion collisions turn that ordered motion into heat. With a
// collision frequency ν the cold-plasma permittivity becomes ε = 1 − ω_pe²/(ω(ω + iν)). The full-wave
// solution solves the B1 wave equation (lightRamp.solveWave, here with a Numerov integrator) with ν ∝ n_e,
// i.e. ν/ω = (ν_c/ω)·(n_e/n_c), where ν_c is the electron–ion collision frequency at the critical density
// (T_e, Z and lnΛ held fixed).
import { c, e, eps0, me } from './constants'
import { coulombLog } from './classicalTransport'
import { airyWidth, criticalDensity, density, quiverOverC, rampEdge, turningX, type RampKind, type WaveOptions, type WaveSolution } from './lightRamp'

/**
 * Electron–ion collision frequency (Spitzer/Braginskii 1/τ_e) in s⁻¹:
 * ν_ei = (4√(2π)/3) n_i Z² e⁴ lnΛ / ((4πε0)² √m_e (kT_e)^{3/2}), with n_i Z² = Z n_e.
 * n_e in m⁻³, T_e in eV. Practical form: 2.91×10⁻⁶ Z n_e[cm⁻³] lnΛ / T_eV^{3/2} s⁻¹.
 */
export function nuEI(ne: number, TeV: number, Z: number, lnL: number): number {
  const kT = TeV * e
  const k = 4 * Math.PI * eps0
  return ((4 * Math.sqrt(2 * Math.PI)) / 3) * ((Z * e ** 4 * ne * lnL) / (k * k * Math.sqrt(me) * kT * Math.sqrt(kT)))
}

/** Electron–ion Coulomb logarithm (NRL formulary, as in A7), floored at 2. n_e in m⁻³, T_e in eV. */
export function lnLambda(ne: number, TeV: number, Z: number): number {
  return Math.max(2, coulombLog(ne, TeV, Z))
}

/** Electron thermal speed √(kT_e/m_e) in m/s (the convention Kruer and the Langdon parameter use). */
export function thermalSpeed(TeV: number): number {
  return Math.sqrt((TeV * e) / me)
}

/** Spatial energy damping rate κ = (ν/c)(n/n_c)/√(1 − n/n_c), in m⁻¹ (ν in s⁻¹, u = n/n_c < 1). */
export function spatialDamping(nu: number, u: number): number {
  return u < 1 ? ((nu / c) * u) / Math.sqrt(1 - u) : NaN
}

/** Absorbed fraction, linear ramp, ν ∝ n, s-polarized at angle θ: 1 − exp(−(32/15)(ν_c L/c) cos⁵θ). */
export function absorptionLinear(q: number, theta = 0): number {
  return 1 - Math.exp((-32 / 15) * q * Math.cos(theta) ** 5)
}

/** Absorbed fraction, exponential ramp n = n_c e^{x/L}, ν ∝ n: 1 − exp(−(8/3)(ν_c L/c) cos³θ). */
export function absorptionExp(q: number, theta = 0): number {
  return 1 - Math.exp((-8 / 3) * q * Math.cos(theta) ** 3)
}

export function absorptionFormula(kind: RampKind, q: number, theta = 0): number {
  return kind === 'linear' ? absorptionLinear(q, theta) : absorptionExp(q, theta)
}

// ---------- the Langdon effect ----------

/** Langdon parameter α = Z v_os²/v_te², v_os = eE0/(m_e ω) (E0 = peak field), v_te = √(kT_e/m_e). */
export function langdonAlpha(IWcm2: number, lamUm: number, TeV: number, Z: number): number {
  const vos = quiverOverC(IWcm2, lamUm) * c
  const vte = thermalSpeed(TeV)
  return (Z * vos * vos) / (vte * vte)
}

/** Matte et al. (1988) fit to the reduction of inverse-bremsstrahlung absorption: 1 − 0.553/(1 + (0.27/α)^0.75). */
export function langdonFactor(alpha: number): number {
  if (alpha <= 0) return 1
  return 1 - 0.553 / (1 + (0.27 / alpha) ** 0.75)
}

/** Matte et al. (1988) super-Gaussian order of the heated distribution f ∝ exp(−(v/v_m)^m): m = 2 + 3/(1 + 1.66 α^−0.724). */
export function matteExponent(alpha: number): number {
  if (alpha <= 0) return 2
  return 2 + 3 / (1 + 1.66 * alpha ** -0.724)
}

/** Lanczos log-gamma (for the super-Gaussian check). */
function lgamma(z: number): number {
  const g = 7
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  z -= 1
  let x = p[0]
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/**
 * f(v = 0) of a super-Gaussian of order m relative to a Maxwellian with the same density and temperature.
 * In the weak-field limit the inverse-bremsstrahlung rate is proportional to f(0), so this is the absorption
 * reduction a distribution of that shape implies: 1 for m = 2, 0.446 for m = 5.
 */
export function superGaussianF0Ratio(m: number): number {
  const g3 = lgamma(3 / m)
  const g5 = lgamma(5 / m)
  return Math.exp(Math.log(m) + 1.5 * Math.log(2 * Math.PI) - Math.log(4 * Math.PI) - g3 + 1.5 * (g5 - Math.log(3) - g3))
}

// ---------- a laser and its plasma, in practical units ----------

export interface AbsorptionSetup {
  lamUm: number // vacuum wavelength, µm
  TeV: number // electron temperature, eV
  Z: number // ion charge (Z_eff = ⟨Z²⟩/⟨Z⟩ for a mixture)
  Lum: number // scale length, µm
  thetaDeg: number // angle of incidence (s-polarized)
  kind: RampKind
  IWcm2: number // vacuum laser intensity, W/cm²
  langdon: boolean // multiply ν by the Langdon factor (α from the vacuum intensity)
}

export interface AbsorptionParams {
  nc: number // m⁻³
  omega: number // rad/s
  lnL: number
  nuc: number // ν_ei at n_c (with the Langdon factor if on), s⁻¹
  nucOverOmega: number
  q: number // ν_c L/c
  k0L: number // ωL/c
  alpha: number
  fL: number
  vosOverVte: number
  formula: number // analytic absorbed fraction
}

export function absorptionParams(s: AbsorptionSetup): AbsorptionParams {
  const nc = criticalDensity(s.lamUm)
  const omega = (2 * Math.PI * c) / (s.lamUm * 1e-6)
  const lnL = lnLambda(nc, s.TeV, s.Z)
  const alpha = langdonAlpha(s.IWcm2, s.lamUm, s.TeV, s.Z)
  const fL = s.langdon ? langdonFactor(alpha) : 1
  const nuc = nuEI(nc, s.TeV, s.Z, lnL) * fL
  const L = s.Lum * 1e-6
  const q = (nuc * L) / c
  const theta = (s.thetaDeg * Math.PI) / 180
  return {
    nc,
    omega,
    lnL,
    nuc,
    nucOverOmega: nuc / omega,
    q,
    k0L: (omega * L) / c,
    alpha,
    fL,
    vosOverVte: (quiverOverC(s.IWcm2, s.lamUm) * c) / thermalSpeed(s.TeV),
    formula: absorptionFormula(s.kind, q, theta),
  }
}

/** Below this density the exponential ramp is tapered to vacuum in the full-wave solution (it carries < 0.3% of the absorption even at 60°). */
export const EXP_CUT = 0.02

/**
 * The same boundary-value problem as lightRamp.solveWave, E'' + (ε − sin²θ)E = 0, integrated with Numerov's
 * method instead of RK4. Numerov is symmetric, so it has no numerical damping of a travelling wave; RK4 loses
 * a fraction ≈ (k h)⁶/144 of the amplitude per step, which is harmless for a standing wave (both halves lose the
 * same) but spoils the heating integral of a one-way, strongly absorbed wave over ~10⁵ steps. It also needs only
 * one evaluation of ε per step. In vacuum the discrete solution is exactly a e^{ik̃x} + b e^{−ik̃x} with
 * cos(k̃h) = (1 − 5h²k_x²/12)/(1 + h²k_x²/12), which splits it into incident and reflected waves.
 */
export function solveWaveNumerov(o: WaveOptions): WaveSolution {
  const r = o.ramp
  const th = o.theta ?? 0
  const s2 = Math.sin(th) ** 2
  const kx = Math.cos(th)
  const nuc = o.nuc ?? 0
  const h = o.h ?? 0.25
  const xT = turningX(r, th)
  const delta = airyWidth(r, th)
  const x0 = xT + (o.depth ?? 10) * delta
  const edge = Math.max(rampEdge(r), xT - 12 * r.L)
  const xEnd = edge - (o.vacuum ?? 2 * Math.PI)
  const n = Math.ceil((x0 - xEnd) / h)
  const hh = (x0 - xEnd) / n // step size (we march toward smaller x)
  const c12 = (hh * hh) / 12
  const stride = Math.max(1, Math.ceil((n + 1) / (o.maxPoints ?? 1e9)))
  const m = Math.floor(n / stride) + 1
  const X = new Float64Array(m)
  const RE = new Float64Array(m)
  const IM = new Float64Array(m)
  const HT = new Float64Array(m)
  // Q = ε − sin²θ at x
  let qr = 0
  let qi = 0
  const q = (x: number) => {
    const u = density(r, x)
    const nu = nuc * u
    const d = 1 + nu * nu
    qr = 1 - u / d - s2
    qi = (u * nu) / d
  }
  // start on the decaying solution E ∝ exp(−∫κ dx), κ = √(−Q), Re κ > 0
  q(x0 - hh / 2)
  const mod = Math.hypot(qr, qi)
  const kr = Math.sqrt(Math.max(0, (mod - qr) / 2))
  const ki = (-qi >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, (mod + qr) / 2))
  // E1 = E0 exp(κ hh) (one step out of the plasma, so the field grows)
  const g = Math.exp(kr * hh)
  let E0r = 1e-6
  let E0i = 0
  let E1r = 1e-6 * g * Math.cos(ki * hh)
  let E1i = 1e-6 * g * Math.sin(ki * hh)
  // w = (1 + h²Q/12) E
  q(x0)
  let Q0r = qr
  let Q0i = qi
  let w0r = E0r + c12 * (Q0r * E0r - Q0i * E0i)
  let w0i = E0i + c12 * (Q0r * E0i + Q0i * E0r)
  q(x0 - hh)
  let Q1r = qr
  let Q1i = qi
  let w1r = E1r + c12 * (Q1r * E1r - Q1i * E1i)
  let w1i = E1i + c12 * (Q1r * E1i + Q1i * E1r)
  let j = m - 1
  X[j] = x0
  RE[j] = E0r
  IM[j] = E0i
  HT[j] = Q0i * (E0r * E0r + E0i * E0i)
  let prevH = HT[j]
  let heat = 0
  const store = (i: number, x: number, er: number, ei: number, hn: number) => {
    if (i % stride === 0 && j > 0) {
      j--
      X[j] = x
      RE[j] = er
      IM[j] = ei
      HT[j] = hn
    }
  }
  {
    const Hn = Q1i * (E1r * E1r + E1i * E1i)
    heat += 0.5 * (prevH + Hn) * hh
    prevH = Hn
    store(1, x0 - hh, E1r, E1i, Hn)
  }
  for (let i = 2; i <= n; i++) {
    // w_{i} = 2 w_{i−1} − w_{i−2} − h² Q_{i−1} E_{i−1}
    const w2r = 2 * w1r - w0r - 12 * c12 * (Q1r * E1r - Q1i * E1i)
    const w2i = 2 * w1i - w0i - 12 * c12 * (Q1r * E1i + Q1i * E1r)
    const x = x0 - i * hh
    q(x)
    // E = w / (1 + h²Q/12)
    const fr = 1 + c12 * qr
    const fi = c12 * qi
    const fd = fr * fr + fi * fi
    const Er = (w2r * fr + w2i * fi) / fd
    const Ei = (w2i * fr - w2r * fi) / fd
    const Hn = qi * (Er * Er + Ei * Ei)
    heat += 0.5 * (prevH + Hn) * hh
    prevH = Hn
    store(i, x, Er, Ei, Hn)
    E0r = E1r
    E0i = E1i
    E1r = Er
    E1i = Ei
    w0r = w1r
    w0i = w1i
    w1r = w2r
    w1i = w2i
    Q1r = qr
    Q1i = qi
    if (E1r * E1r + E1i * E1i > 1e200) {
      // the field grows by e^(optical depth) on the way out: rescale everything so far to avoid overflow
      const f = 1e-100
      for (let k = j; k < m; k++) {
        RE[k] *= f
        IM[k] *= f
        HT[k] *= f * f
      }
      heat *= f * f
      prevH *= f * f
      E0r *= f
      E0i *= f
      E1r *= f
      E1i *= f
      w0r *= f
      w0i *= f
      w1r *= f
      w1i *= f
    }
  }
  // The last two samples (x_N and x_N + h) are in vacuum: E = A + B with A = a e^{ik̃x_N}, B = b e^{−ik̃x_N}.
  const xN = x0 - n * hh
  const cosk = (1 - 5 * c12 * kx * kx) / (1 + c12 * kx * kx)
  const kt = Math.acos(Math.max(-1, Math.min(1, cosk))) / hh
  const sr = Math.cos(kt * hh)
  const si = Math.sin(kt * hh)
  // A = (E_{N−1} − E_N s̄) / (2i sin k̃h)
  const nr = E0r - (E1r * sr + E1i * si)
  const ni = E0i - (E1i * sr - E1r * si)
  const den = 2 * si
  const Ar = ni / den
  const Ai = -nr / den
  const Br = E1r - Ar
  const Bi = E1i - Ai
  // a = A e^{−ik̃x_N}, b = B e^{ik̃x_N}
  const cp = Math.cos(kt * xN)
  const sp = Math.sin(kt * xN)
  const ar = Ar * cp + Ai * sp
  const ai = Ai * cp - Ar * sp
  const br = Br * cp - Bi * sp
  const bi = Bi * cp + Br * sp
  const a2 = ar * ar + ai * ai
  const rRe = (br * ar + bi * ai) / a2
  const rIm = (bi * ar - br * ai) / a2
  const start = j
  const len = m - start
  const xo = X.subarray(start)
  const ro = RE.subarray(start)
  const io = IM.subarray(start)
  const ho = HT.subarray(start)
  for (let k = 0; k < len; k++) {
    const er = ro[k]
    const ei = io[k]
    ro[k] = (er * ar + ei * ai) / a2
    io[k] = (ei * ar - er * ai) / a2
    ho[k] /= a2
  }
  return { x: xo, re: ro, im: io, heat: ho, n: len, R: rRe * rRe + rIm * rIm, rRe, rIm, heated: heat / a2 / kx, xTurn: xT, delta }
}

/** Full-wave solution for a set-up; x is in c/ω, with ν/ω = (ν_c/ω)(n_e/n_c). */
export function solveAbsorption(s: AbsorptionSetup, h = 0.25, maxPoints = 400000): WaveSolution {
  const p = absorptionParams(s)
  return solveWaveNumerov({
    ramp: s.kind === 'linear' ? { kind: 'linear', L: p.k0L } : { kind: 'exp', L: p.k0L, ncut: EXP_CUT },
    theta: (s.thetaDeg * Math.PI) / 180,
    nuc: p.nucOverOmega,
    h,
    maxPoints,
  })
}
