// B1: light in an inhomogeneous (unmagnetized, cold) plasma.
//
// Normalized units throughout: the laser frequency ω = 1 and c = 1, so lengths are in c/ω = λ/2π
// (k0 = 1) and times in 1/ω. A density profile is described by u(x) = n_e(x)/n_c, where n_c is the
// critical density of the laser. Two ramps:
//   linear:      u = x/L for x > 0, vacuum for x < 0 (plasma edge at 0, critical surface at x = L)
//   exponential: u = exp(x/L) (critical surface at x = 0), optionally tapered to vacuum below u = ncut
//
// Three tools:
//   - the Airy function Ai(x), for the exact field near a turning point in a linear ramp;
//   - a ray tracer: Hamilton's equations dx/dt = ∂ω/∂k, dk/dt = −∂ω/∂x for ω² = ω_pe²(x) + c²k²,
//     integrated with classical RK4;
//   - a full-wave solver for the s-polarized (or normally incident) field,
//     E'' + k0²(ε(x) − sin²θ) E = 0, integrated with RK4 from the evanescent side out to vacuum, where it
//     is split into incident and reflected waves. ε may be complex (collisions, lesson B2).
import { c, e, eps0, me } from './constants'

// ---------- critical density and the refractive index ----------

/** Critical density n_c = ε0 m_e ω²/e² in m⁻³ for vacuum wavelength λ in µm. */
export function criticalDensity(lamUm: number): number {
  const w = (2 * Math.PI * c) / (lamUm * 1e-6)
  return (eps0 * me * w * w) / (e * e)
}

/** n_c λ² in cm⁻³ µm²: n_c ≈ 1.115×10²¹ / λ_µm² cm⁻³. */
export const NC_CM3_UM2 = criticalDensity(1) * 1e-6

/** Refractive index η = √(1 − n_e/n_c); NaN beyond the critical density. Equals v_g/c. */
export function refractiveIndex(u: number): number {
  return u <= 1 ? Math.sqrt(1 - u) : NaN
}

// ---------- the Airy function ----------

const AI0 = 0.355028053887817239 // Ai(0)
const AIP0 = 0.258819403792806798 // −Ai'(0)
/** Coefficients u_k of the Airy asymptotic expansions (DLMF 9.7.2). */
const UK: number[] = [1]
for (let k = 1; k < 24; k++) UK.push((UK[k - 1] * (6 * k - 5) * (6 * k - 3) * (6 * k - 1)) / ((2 * k - 1) * 216 * k))

/**
 * Airy function Ai(x). Maclaurin series for −7 < x ≤ 5, asymptotic expansions outside
 * (DLMF 9.7.5 and 9.7.9). Absolute error below 1e-11 for x ≤ 5, relative error below 1e-7 above.
 */
export function airyAi(x: number): number {
  if (x <= -7) {
    const z = -x
    const zeta = (2 / 3) * z * Math.sqrt(z)
    let P = 0
    let Q = 0
    let zp = 1
    for (let k = 0; k < 6; k++) {
      const sgn = k % 2 ? -1 : 1
      P += (sgn * UK[2 * k]) / zp
      zp *= zeta
      Q += (sgn * UK[2 * k + 1]) / zp
      zp *= zeta
    }
    const ph = zeta - Math.PI / 4
    return (Math.cos(ph) * P + Math.sin(ph) * Q) / (Math.sqrt(Math.PI) * Math.sqrt(Math.sqrt(z)))
  }
  if (x > 5) {
    const zeta = (2 / 3) * x * Math.sqrt(x)
    let S = 0
    let zp = 1
    for (let k = 0; k < 10; k++) {
      S += ((k % 2 ? -1 : 1) * UK[k]) / zp
      zp *= zeta
    }
    return (Math.exp(-zeta) * S) / (2 * Math.sqrt(Math.PI) * Math.sqrt(Math.sqrt(x)))
  }
  const x3 = x * x * x
  let f = 1
  let g = x
  let t = 1
  let s = x
  for (let k = 1; k < 120; k++) {
    t *= x3 / ((3 * k - 1) * (3 * k))
    s *= x3 / ((3 * k) * (3 * k + 1))
    f += t
    g += s
    if (Math.abs(t) < 1e-17 * Math.abs(f) && Math.abs(s) < 1e-17 * (Math.abs(g) + 1e-300)) break
  }
  return AI0 * f - AIP0 * g
}

/** Position and value of the largest maximum of Ai on the real line. */
export const AIRY_ZMAX = -1.0187929716474710
export const AIRY_MAX = 0.53565665601569
/** 4π·max(Ai)² ≈ 3.606: the coefficient of the swelling law |E_max|²/|E_vac|² = 3.6 (ωL/c)^{1/3}. */
export const SWELL_COEF = 4 * Math.PI * AIRY_MAX * AIRY_MAX

/**
 * Peak |E|²/|E_vac|² in a linear ramp of scale length L (k0L = ωL/c), s-polarized at vacuum angle θ:
 * 4π max(Ai)² (k0L)^{1/3} cos θ (leading order in 1/k0L).
 */
export function swellingPeak(k0L: number, theta = 0): number {
  return SWELL_COEF * Math.cbrt(k0L) * Math.cos(theta)
}

/** Airy (leading-order) intensity |E|²/|E_vac|² at x in a linear ramp u = x/L, s-polarized, k0 = 1. */
export function airyIntensity(x: number, L: number, theta = 0): number {
  const ct = Math.cos(theta)
  const d = Math.cbrt(L)
  const ai = airyAi((x - L * ct * ct) / d)
  return 4 * Math.PI * ct * d * ai * ai
}

/** WKB upper envelope 4 cos θ / √(cos²θ − x/L) of the standing wave in a linear ramp (vacuum: 4). */
export function wkbEnvelope(x: number, L: number, theta = 0): number {
  const ct = Math.cos(theta)
  const q2 = ct * ct - Math.max(0, x) / L
  return q2 > 0 ? (4 * ct) / Math.sqrt(q2) : NaN
}

/** Phase of the reflected wave at the plasma edge, linear ramp: (4/3) k0L cos³θ − π/2. */
export function reflectionPhase(k0L: number, theta = 0): number {
  return (4 / 3) * k0L * Math.cos(theta) ** 3 - Math.PI / 2
}

// ---------- density ramps ----------

export type RampKind = 'linear' | 'exp'

export interface Ramp {
  kind: RampKind
  L: number // scale length in c/ω
  ncut?: number // exponential only: below u = ncut, taper linearly to vacuum over one L (0 = never)
}

/**
 * u = n_e/n_c at x. An exponential ramp with a cut follows e^{x/L} down to u = ncut and then falls linearly, with
 * the same slope, to zero one L further out. An abrupt step to vacuum would reflect like a Fresnel interface
 * (|r| ≈ ncut/4cos²θ), enough to spoil the reflectivity of a weakly absorbing ramp; a slope-continuous taper reflects
 * nothing measurable.
 */
export function density(r: Ramp, x: number): number {
  if (r.kind === 'linear') return x > 0 ? x / r.L : 0
  const u = Math.exp(x / r.L)
  if (!r.ncut || u >= r.ncut) return u
  return Math.max(0, r.ncut * (1 + (x - r.L * Math.log(r.ncut)) / r.L))
}

/** Where the plasma ends (vacuum below it), or −∞ for an uncut exponential. */
export function rampEdge(r: Ramp): number {
  if (r.kind === 'linear') return 0
  return r.ncut ? r.L * Math.log(r.ncut) - r.L : -Infinity
}

/** du/dx (the ray tracer uses the exponential without a cut). */
function densityGrad(r: Ramp, x: number): number {
  if (r.kind === 'linear') return x >= 0 ? 1 / r.L : 0
  return Math.exp(x / r.L) / r.L
}

/** Where a ray (or s-polarized wave) with vacuum angle θ turns: u = cos²θ. */
export function turningX(r: Ramp, theta: number): number {
  const c2 = Math.cos(theta) ** 2
  return r.kind === 'linear' ? r.L * c2 : r.L * Math.log(c2)
}

/** Width δ of the Airy layer around the turning point, (L_eff/k0²)^{1/3} with L_eff = 1/|du/dx| there. */
export function airyWidth(r: Ramp, theta: number): number {
  const c2 = Math.cos(theta) ** 2
  return r.kind === 'linear' ? Math.cbrt(r.L) : Math.cbrt(r.L / c2)
}

// ---------- ray tracing ----------

export interface RayState {
  x: number
  y: number
  kx: number
  ky: number
}

export interface Ray {
  /** samples at uniform time steps dt */
  xs: Float64Array
  ys: Float64Array
  n: number
  dt: number
  theta: number
  /** turning point (where k_x changes sign), interpolated within the step */
  turn: { x: number; y: number; u: number; t: number } | null
}

function rhs(r: Ramp, s: RayState, out: number[]) {
  out[0] = s.kx
  out[1] = s.ky
  out[2] = -0.5 * densityGrad(r, s.x)
  out[3] = 0
}

const K1 = [0, 0, 0, 0]
const K2 = [0, 0, 0, 0]
const K3 = [0, 0, 0, 0]
const K4 = [0, 0, 0, 0]
const TMP: RayState = { x: 0, y: 0, kx: 0, ky: 0 }

/** One classical RK4 step of the ray equations (dx/dt = k, dk/dt = −½∇u) in place. */
export function rayStepRK4(r: Ramp, s: RayState, h: number): void {
  const t = TMP
  rhs(r, s, K1)
  t.x = s.x + 0.5 * h * K1[0]
  t.y = s.y + 0.5 * h * K1[1]
  t.kx = s.kx + 0.5 * h * K1[2]
  t.ky = s.ky
  rhs(r, t, K2)
  t.x = s.x + 0.5 * h * K2[0]
  t.y = s.y + 0.5 * h * K2[1]
  t.kx = s.kx + 0.5 * h * K2[2]
  rhs(r, t, K3)
  t.x = s.x + h * K3[0]
  t.y = s.y + h * K3[1]
  t.kx = s.kx + h * K3[2]
  rhs(r, t, K4)
  s.x += (h / 6) * (K1[0] + 2 * K2[0] + 2 * K3[0] + K4[0])
  s.y += (h / 6) * (K1[1] + 2 * K2[1] + 2 * K3[1] + K4[1])
  s.kx += (h / 6) * (K1[2] + 2 * K2[2] + 2 * K3[2] + K4[2])
}

/**
 * Advance a ray by h. The linear ramp has a kink in du/dx at the plasma edge x = 0; a step that
 * crosses it is split there exactly (straight line in vacuum, parabola in the ramp), so RK4 never
 * straddles the kink.
 */
function advance(r: Ramp, s: RayState, h: number): void {
  if (r.kind !== 'linear') return rayStepRK4(r, s, h)
  if (s.x <= 0) {
    // vacuum: straight line until the edge
    const sEdge = s.kx > 0 ? -s.x / s.kx : Infinity
    if (sEdge >= h) {
      s.x += s.kx * h
      s.y += s.ky * h
      return
    }
    s.x = 0
    s.y += s.ky * sEdge
    rayStepRK4(r, s, h - sEdge)
    return
  }
  // in the ramp: x(τ) = x + k_x τ − τ²/(4L) exactly; find when (if) it reaches the edge
  const disc = s.kx * s.kx + s.x / r.L
  const sEdge = 2 * r.L * (s.kx + Math.sqrt(disc))
  if (sEdge >= h) return rayStepRK4(r, s, h)
  rayStepRK4(r, s, sEdge)
  s.x = 0
  s.x += s.kx * (h - sEdge)
  s.y += s.ky * (h - sEdge)
}

/**
 * Trace one ray launched from (x0, y0) with vacuum angle θ to the density gradient (Snell's invariant
 * k_y = sin θ; k_x from the local dispersion relation). Stops after tMax or once the ray has turned and
 * come back out to x < xStop.
 */
export function traceRay(r: Ramp, x0: number, y0: number, theta: number, dt: number, tMax: number, xStop = -Infinity): Ray {
  const ky = Math.sin(theta)
  const kx = Math.sqrt(Math.max(0, 1 - density(r, x0) - ky * ky))
  const s: RayState = { x: x0, y: y0, kx, ky }
  const nMax = Math.ceil(tMax / dt) + 1
  const xs = new Float64Array(nMax)
  const ys = new Float64Array(nMax)
  xs[0] = s.x
  ys[0] = s.y
  let n = 1
  let turn: Ray['turn'] = null
  while (n < nMax) {
    const xa = s.x
    const ya = s.y
    const ka = s.kx
    advance(r, s, dt)
    xs[n] = s.x
    ys[n] = s.y
    n++
    if (!turn && ka > 0 && s.kx <= 0) {
      // k_x(t) is linear in t over the step (exact for the linear ramp); x is then quadratic
      const a = (s.kx - ka) / dt
      const tau = -ka / a
      const xt = xa + ka * tau + 0.5 * a * tau * tau
      turn = { x: xt, y: ya + ky * tau, u: density(r, xt), t: (n - 2) * dt + tau }
    }
    if (turn && s.x < xStop) break
  }
  return { xs: xs.subarray(0, n), ys: ys.subarray(0, n), n, dt, theta, turn }
}

/** Analytic ray in a linear ramp, entering at the edge (0, 0): x = y cot θ − y²/(4L sin²θ) for 0 ≤ y ≤ 2L sin 2θ. */
export function linearRayX(y: number, L: number, theta: number): number {
  const s = Math.sin(theta)
  return (y * Math.cos(theta)) / s - (y * y) / (4 * L * s * s)
}

/**
 * Analytic ray in an exponential ramp u = e^{x/L} (inbound branch), measured from its turning point:
 * y_t − y = 2L tan θ · artanh(√(1 − e^{x/L}/cos²θ)).
 */
export function expRayDy(x: number, L: number, theta: number): number {
  const c2 = Math.cos(theta) ** 2
  const w = Math.sqrt(Math.max(0, 1 - Math.exp(x / L) / c2))
  return 2 * L * Math.tan(theta) * Math.atanh(Math.min(w, 1 - 1e-16))
}

// ---------- full-wave solution ----------

export interface WaveOptions {
  ramp: Ramp
  theta?: number // vacuum angle of incidence (s-polarized); 0 = normal incidence
  /** ν/ω at the critical density; the collision frequency is taken ∝ n_e, so ν/ω = nuc·u. */
  nuc?: number
  h?: number // RK4 step in c/ω
  /** how far past the turning point to start, in Airy widths */
  depth?: number
  /** vacuum to include in front of the plasma, in c/ω */
  vacuum?: number
  /** keep at most this many samples for display (the integrals use every step) */
  maxPoints?: number
}

export interface WaveSolution {
  x: Float64Array // ascending
  re: Float64Array // E(x)/E_inc (incident amplitude 1, phase 0 at x = 0)
  im: Float64Array
  heat: Float64Array // local heating rate k0² Im ε |E|² (same units as the absorbed fraction per c/ω, divided by cos θ)
  n: number
  /** reflected power fraction |r|² */
  R: number
  /** reflected amplitude r = E_ref/E_inc at x = 0 */
  rRe: number
  rIm: number
  /** absorbed fraction from the heating integral, ∫ k0² Im ε |E|² dx / (k_x |E_inc|²) */
  heated: number
  xTurn: number
  delta: number
}

/** ε = 1 − u/(1 + iν/ω), with ν/ω = nuc·u. Returns [Re, Im]. */
export function permittivity(u: number, nuc: number): [number, number] {
  const nu = nuc * u
  const d = 1 + nu * nu
  return [1 - u / d, (u * nu) / d]
}

/**
 * Solve E'' + (ε(x) − sin²θ)E = 0 (k0 = 1) for the s-polarized field of a plane wave incident from vacuum.
 * Integration runs backwards from deep in the evanescent region, starting on the decaying WKB solution,
 * out to vacuum, where E = a e^{ik_x x} + b e^{−ik_x x} gives the incident (a) and reflected (b) waves.
 */
export function solveWave(o: WaveOptions): WaveSolution {
  const r = o.ramp
  const th = o.theta ?? 0
  const s2 = Math.sin(th) ** 2
  const kx = Math.cos(th)
  const nuc = o.nuc ?? 0
  const h = o.h ?? 0.05
  const xT = turningX(r, th)
  const delta = airyWidth(r, th)
  const x0 = xT + (o.depth ?? 10) * delta
  const edge = Math.max(rampEdge(r), xT - 12 * r.L)
  const xEnd = edge - (o.vacuum ?? 2 * Math.PI)
  const n = Math.ceil((x0 - xEnd) / h)
  const hh = -(x0 - xEnd) / n // negative: integrate toward vacuum
  const stride = Math.max(1, Math.ceil((n + 1) / (o.maxPoints ?? 1e9)))
  const m = Math.floor(n / stride) + 1
  const X = new Float64Array(m)
  const RE = new Float64Array(m)
  const IM = new Float64Array(m)
  const HT = new Float64Array(m)

  const q = (x: number, out: number[]) => {
    const u = density(r, x)
    const nu = nuc * u
    const d = 1 + nu * nu
    out[0] = 1 - u / d - s2
    out[1] = (u * nu) / d
  }
  const qa = [0, 0]
  const qm = [0, 0]
  const qb = [0, 0]
  // start on the decaying solution E' = −κE, κ = √(sin²θ − ε) with Re κ > 0
  q(x0, qa)
  let kr: number
  let ki: number
  {
    const ar = -qa[0]
    const ai = -qa[1]
    const mod = Math.hypot(ar, ai)
    kr = Math.sqrt((mod + ar) / 2)
    ki = (ai >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, (mod - ar) / 2))
  }
  let Er = 1e-6
  let Ei = 0
  let Dr = -kr * Er
  let Di = -ki * Er
  let x = x0
  let heat = 0
  let prevH = qa[1] * (Er * Er + Ei * Ei)
  let j = m - 1
  X[j] = x
  RE[j] = Er
  IM[j] = Ei
  HT[j] = prevH
  for (let i = 1; i <= n; i++) {
    q(x + hh / 2, qm)
    q(x + hh, qb)
    // y1 = E, y2 = E'; y1' = y2, y2' = −q y1 (complex)
    const k1r = Dr
    const k1i = Di
    const l1r = -(qa[0] * Er - qa[1] * Ei)
    const l1i = -(qa[0] * Ei + qa[1] * Er)
    const e2r = Er + 0.5 * hh * k1r
    const e2i = Ei + 0.5 * hh * k1i
    const k2r = Dr + 0.5 * hh * l1r
    const k2i = Di + 0.5 * hh * l1i
    const l2r = -(qm[0] * e2r - qm[1] * e2i)
    const l2i = -(qm[0] * e2i + qm[1] * e2r)
    const e3r = Er + 0.5 * hh * k2r
    const e3i = Ei + 0.5 * hh * k2i
    const k3r = Dr + 0.5 * hh * l2r
    const k3i = Di + 0.5 * hh * l2i
    const l3r = -(qm[0] * e3r - qm[1] * e3i)
    const l3i = -(qm[0] * e3i + qm[1] * e3r)
    const e4r = Er + hh * k3r
    const e4i = Ei + hh * k3i
    const k4r = Dr + hh * l3r
    const k4i = Di + hh * l3i
    const l4r = -(qb[0] * e4r - qb[1] * e4i)
    const l4i = -(qb[0] * e4i + qb[1] * e4r)
    Er += (hh / 6) * (k1r + 2 * k2r + 2 * k3r + k4r)
    Ei += (hh / 6) * (k1i + 2 * k2i + 2 * k3i + k4i)
    Dr += (hh / 6) * (l1r + 2 * l2r + 2 * l3r + l4r)
    Di += (hh / 6) * (l1i + 2 * l2i + 2 * l3i + l4i)
    x = x0 + i * hh
    qa[0] = qb[0]
    qa[1] = qb[1]
    const Hn = qb[1] * (Er * Er + Ei * Ei)
    heat += 0.5 * (prevH + Hn) * -hh
    prevH = Hn
    if (i % stride === 0 && j > 0) {
      j--
      X[j] = x
      RE[j] = Er
      IM[j] = Ei
      HT[j] = Hn
    }
  }
  // split into incident and reflected waves in vacuum at x
  // E'/(i k_x) = (Dr + i Di)/(i kx) = (Di − i Dr)/kx
  const pr = Di / kx
  const pi = -Dr / kx
  const ar0 = 0.5 * (Er + pr)
  const ai0 = 0.5 * (Ei + pi)
  const br0 = 0.5 * (Er - pr)
  const bi0 = 0.5 * (Ei - pi)
  // a = a0 e^{−i kx x}, b = b0 e^{+i kx x}
  const ca = Math.cos(kx * x)
  const sa = Math.sin(kx * x)
  const ar = ar0 * ca + ai0 * sa
  const ai = ai0 * ca - ar0 * sa
  const br = br0 * ca - bi0 * sa
  const bi = bi0 * ca + br0 * sa
  const a2 = ar * ar + ai * ai
  const rRe = (br * ar + bi * ai) / a2
  const rIm = (bi * ar - br * ai) / a2
  // normalize E by a: (E)(a*)/|a|²
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
  return {
    x: xo,
    re: ro,
    im: io,
    heat: ho,
    n: len,
    R: rRe * rRe + rIm * rIm,
    rRe,
    rIm,
    heated: heat / a2 / kx,
    xTurn: xT,
    delta,
  }
}

/** Peak of |E|² in a solution, with its position refined by a parabola through the three highest samples. */
export function peakIntensity(s: WaveSolution): { value: number; x: number } {
  let best = 0
  let bi = 0
  for (let i = 0; i < s.n; i++) {
    const v = s.re[i] * s.re[i] + s.im[i] * s.im[i]
    if (v > best) {
      best = v
      bi = i
    }
  }
  if (bi === 0 || bi === s.n - 1) return { value: best, x: s.x[bi] }
  const I = (i: number) => s.re[i] * s.re[i] + s.im[i] * s.im[i]
  const y0 = I(bi - 1)
  const y1 = best
  const y2 = I(bi + 1)
  const den = y0 - 2 * y1 + y2
  const off = den !== 0 ? (0.5 * (y0 - y2)) / den : 0
  const dx = s.x[bi + 1] - s.x[bi]
  return { value: y1 - 0.25 * (y0 - y2) * off, x: s.x[bi] + off * dx }
}

// ---------- practical laser units ----------

/** Peak field E0 (V/m) of a linearly polarized beam of intensity I (W/cm²): I = ½ ε0 c E0². */
export function fieldFromIntensity(IWcm2: number): number {
  return Math.sqrt((2 * IWcm2 * 1e4) / (eps0 * c))
}

/** Normalized quiver speed v_os/c = eE0/(m_e ω c) for intensity I (W/cm²) and wavelength λ (µm). ≈ 0.855 λ_µm (I/10¹⁸)^{1/2}. */
export function quiverOverC(IWcm2: number, lamUm: number): number {
  const w = (2 * Math.PI * c) / (lamUm * 1e-6)
  return (e * fieldFromIntensity(IWcm2)) / (me * w * c)
}

// ---------- display helper (pure numerics) ----------

/**
 * Min and max of v(i) over the samples x[i] that fall in each of ncol equal columns spanning [x0, x1).
 * Columns with no samples get +∞ / −∞. Used to draw fields with many more oscillations than pixels
 * without aliasing: each pixel column shows the full range the field covers there.
 */
export function columnMinMax(
  x: Float64Array,
  n: number,
  v: (i: number) => number,
  x0: number,
  x1: number,
  outMin: Float64Array,
  outMax: Float64Array,
): void {
  const ncol = outMin.length
  outMin.fill(Infinity)
  outMax.fill(-Infinity)
  const k = ncol / (x1 - x0)
  for (let i = 0; i < n; i++) {
    const col = Math.floor((x[i] - x0) * k)
    if (col < 0 || col >= ncol) continue
    const val = v(i)
    if (val < outMin[col]) outMin[col] = val
    if (val > outMax[col]) outMax[col] = val
  }
}
