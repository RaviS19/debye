// B4: the ponderomotive force.
//
// Three pieces:
//  1. Practical formulas: the normalized amplitude a0 = eE0/(m_e ω c), the quiver velocity and excursion, and the
//     ponderomotive potential U_p = e²⟨E²⟩/(2 m_e ω²) in laser units, with the polarization stated.
//  2. Test electrons in a focal spot (non-relativistic). Normalized units: ω = 1, c = 1, so lengths are in c/ω,
//     times in 1/ω, velocities in c and fields in units of m_e ω c/e (so the field amplitude is a0). The field is
//     defined through a vector potential, E = −∂A/∂t and B = ∇×A, so it obeys Faraday's law exactly:
//        linear:    A = −a0 f(r) g(t) sin t x̂
//        circular:  A = −a0 f(r) g(t) (sin t x̂ − cos t ŷ)
//     with f = exp(−r²/w²) and a smooth turn-on g(t) = sin²(πt/2T_on) for t < T_on, then 1. For t > T_on this is
//     E = a0 f cos t x̂ (linear) or a0 f (cos t x̂ + sin t ŷ) (circular), plus the small B_z = (∇×A)_z that a field
//     varying across the beam must carry. This is the field in the focal plane of a standing wave (two
//     counter-propagating beams), at an antinode of E, where the large B of a travelling wave vanishes.
//     Electrons obey dv/dt = −(E + v × B) (charge −e) and are advanced with RK4.
//  3. Ponderomotive profile steepening: a plasma in pressure balance with the light, n = n0(x) exp(−U_p(x)/kT),
//     with the field from the Helmholtz equation in that same profile, solved exactly by shooting.
import { c, e, eps0, me } from './constants'

// ---------- 1. practical formulas ----------

export type Polarization = 'linear' | 'circular'

/** Laser angular frequency (rad/s) for a vacuum wavelength in µm. */
export const omegaOf = (lamUm: number) => (2 * Math.PI * c) / (lamUm * 1e-6)

/** Critical density n_c = ε0 m_e ω²/e² in m⁻³. */
export const criticalDensity = (lamUm: number) => (eps0 * me * omegaOf(lamUm) ** 2) / (e * e)

/**
 * Peak field E0 (V/m) for intensity I (W/cm²). Linear: I = ½ε0cE0². Circular, with E0 the amplitude of each of
 * the two components (|E| = E0 at all times): I = ε0cE0².
 */
export function peakField(IWcm2: number, pol: Polarization = 'linear'): number {
  const I = IWcm2 * 1e4
  return Math.sqrt(((pol === 'linear' ? 2 : 1) * I) / (eps0 * c))
}

/** Normalized amplitude a0 = eE0/(m_e ω c) = v_os/c. */
export function a0Of(IWcm2: number, lamUm: number, pol: Polarization = 'linear'): number {
  return (e * peakField(IWcm2, pol)) / (me * omegaOf(lamUm) * c)
}

/** a0 = A0_COEF · λ_µm · √(I/10¹⁸ W cm⁻²): 0.855 for linear, 0.604 for circular polarization. */
export const A0_COEF_LINEAR = a0Of(1e18, 1, 'linear')
export const A0_COEF_CIRCULAR = a0Of(1e18, 1, 'circular')

/**
 * Ponderomotive potential (cycle-averaged quiver energy) in eV: U_p = e²⟨E²⟩/(2 m_e ω²) = e²I/(2ε0 c m_e ω²).
 * Written with the intensity it is the same for both polarizations (non-relativistic).
 * Linear: U_p = e²E0²/(4m_eω²) = m_e v_os²/4. Circular: e²E0²/(2m_eω²) = m_e v_os²/2.
 */
export function ponderomotiveEV(IWcm2: number, lamUm: number): number {
  const I = IWcm2 * 1e4
  return (e * e * I) / (2 * eps0 * c * me * omegaOf(lamUm) ** 2) / e
}

/** U_p[eV] = UP_COEF · I[W/cm²] · λ²[µm²] = 9.337×10⁻¹⁴ I λ². */
export const UP_COEF = ponderomotiveEV(1, 1)

/** Quiver velocity amplitude v_os = eE0/(m_e ω) (m/s) and excursion x_os = eE0/(m_e ω²) (m). */
export function quiver(IWcm2: number, lamUm: number, pol: Polarization = 'linear') {
  const E0 = peakField(IWcm2, pol)
  const w = omegaOf(lamUm)
  return { vos: (e * E0) / (me * w), xos: (e * E0) / (me * w * w) }
}

/** Radiation pressure of light of intensity I (W/cm²) on a perfect absorber (I/c) in Pa; a reflector feels 2I/c. */
export const lightPressure = (IWcm2: number) => (IWcm2 * 1e4) / c

/** Thermal pressure n_c k T_e in Pa at the critical density of wavelength λ (µm), T_e in eV. */
export const criticalPressure = (lamUm: number, TeV: number) => criticalDensity(lamUm) * TeV * e

// ---------- 2. test electrons in a focal spot ----------

export interface FocusParams {
  a0: number // field amplitude (eE0/mωc)
  w: number // spot radius in c/ω (field ∝ exp(−r²/w²))
  pol: Polarization
  tOn: number // turn-on time in 1/ω
  vxb: boolean // include the magnetic force
}

/** Envelope g(t) and its derivative. */
export function turnOn(t: number, tOn: number): [number, number] {
  if (t >= tOn) return [1, 0]
  const s = Math.sin((Math.PI * t) / (2 * tOn))
  return [s * s, (Math.PI / (2 * tOn)) * Math.sin((Math.PI * t) / tOn)]
}

/** Fields at (x, y, t): returns [Ex, Ey, Bz] in normalized units. */
export function focusField(p: FocusParams, x: number, y: number, t: number, out: Float64Array) {
  const w2 = p.w * p.w
  const f = Math.exp(-(x * x + y * y) / w2)
  const fx = ((-2 * x) / w2) * f
  const fy = ((-2 * y) / w2) * f
  const [g, gp] = turnOn(t, p.tOn)
  const s = Math.sin(t)
  const co = Math.cos(t)
  const a = p.a0
  if (p.pol === 'linear') {
    // A = −a f g sin t x̂ → E = a f (g cos t + g′ sin t) x̂, B_z = −∂_y A_x = a g sin t ∂_y f
    out[0] = a * f * (g * co + gp * s)
    out[1] = 0
    out[2] = p.vxb ? a * g * s * fy : 0
  } else {
    // A = −a f g (sin t x̂ − cos t ŷ)
    out[0] = a * f * (g * co + gp * s)
    out[1] = a * f * (g * s - gp * co)
    // B_z = ∂_x A_y − ∂_y A_x = a g (cos t ∂_x f + sin t ∂_y f)
    out[2] = p.vxb ? a * g * (co * fx + s * fy) : 0
  }
}

/** Ponderomotive potential (units of m_e c²) at radius² r2 and time t: k a0² f² g², k = ¼ (linear) or ½ (circular). */
export function upNorm(p: FocusParams, r2: number, t: number): number {
  const [g] = turnOn(t, p.tOn)
  const k = p.pol === 'linear' ? 0.25 : 0.5
  return k * p.a0 * p.a0 * Math.exp((-2 * r2) / (p.w * p.w)) * g * g
}

/** A set of test electrons: state arrays x, y, vx, vy (normalized units). */
export interface Electrons {
  n: number
  x: Float64Array
  y: Float64Array
  vx: Float64Array
  vy: Float64Array
  t: number
}

export function createElectrons(pos: [number, number][]): Electrons {
  const n = pos.length
  const el: Electrons = { n, x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n), t: 0 }
  pos.forEach(([x, y], i) => {
    el.x[i] = x
    el.y[i] = y
  })
  return el
}

const fb = new Float64Array(3)
/** Acceleration of an electron: −(E + v × B), v × B with B = B_z ẑ is (v_y B_z, −v_x B_z). */
function accel(p: FocusParams, x: number, y: number, vx: number, vy: number, t: number, out: Float64Array) {
  focusField(p, x, y, t, fb)
  out[0] = -(fb[0] + vy * fb[2])
  out[1] = -(fb[1] - vx * fb[2])
}

const a1 = new Float64Array(2)
const a2 = new Float64Array(2)
const a3 = new Float64Array(2)
const a4 = new Float64Array(2)

/** Advance every electron by one RK4 step h (in 1/ω). Electrons beyond rMax are frozen (they have left). */
export function stepElectrons(el: Electrons, p: FocusParams, h: number, rMax = Infinity) {
  const t = el.t
  const r2max = rMax * rMax
  for (let i = 0; i < el.n; i++) {
    const x = el.x[i]
    const y = el.y[i]
    if (x * x + y * y > r2max) continue
    const vx = el.vx[i]
    const vy = el.vy[i]
    accel(p, x, y, vx, vy, t, a1)
    const x2 = x + 0.5 * h * vx
    const y2 = y + 0.5 * h * vy
    const vx2 = vx + 0.5 * h * a1[0]
    const vy2 = vy + 0.5 * h * a1[1]
    accel(p, x2, y2, vx2, vy2, t + 0.5 * h, a2)
    const x3 = x + 0.5 * h * vx2
    const y3 = y + 0.5 * h * vy2
    const vx3 = vx + 0.5 * h * a2[0]
    const vy3 = vy + 0.5 * h * a2[1]
    accel(p, x3, y3, vx3, vy3, t + 0.5 * h, a3)
    const x4 = x + h * vx3
    const y4 = y + h * vy3
    const vx4 = vx + h * a3[0]
    const vy4 = vy + h * a3[1]
    accel(p, x4, y4, vx4, vy4, t + h, a4)
    el.x[i] = x + (h / 6) * (vx + 2 * vx2 + 2 * vx3 + vx4)
    el.y[i] = y + (h / 6) * (vy + 2 * vy2 + 2 * vy3 + vy4)
    el.vx[i] = vx + (h / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0])
    el.vy[i] = vy + (h / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1])
  }
  el.t += h
}

/** Guiding centre: R̈ = −∇U_p(R, t). State [X, Y, VX, VY]. */
export interface Centre {
  s: Float64Array
  t: number
}

export function createCentre(x: number, y: number): Centre {
  return { s: Float64Array.from([x, y, 0, 0]), t: 0 }
}

function gcAcc(p: FocusParams, x: number, y: number, t: number, out: Float64Array) {
  // −∇[k a0² e^{−2r²/w²} g²] = (4/w²) U_p (x, y)
  const U = upNorm(p, x * x + y * y, t)
  const c4 = (4 * U) / (p.w * p.w)
  out[0] = c4 * x
  out[1] = c4 * y
}

export function stepCentre(g: Centre, p: FocusParams, h: number) {
  const [x, y, vx, vy] = g.s
  const t = g.t
  gcAcc(p, x, y, t, a1)
  gcAcc(p, x + 0.5 * h * vx, y + 0.5 * h * vy, t + 0.5 * h, a2)
  const vx2 = vx + 0.5 * h * a1[0]
  const vy2 = vy + 0.5 * h * a1[1]
  gcAcc(p, x + 0.5 * h * vx2, y + 0.5 * h * vy2, t + 0.5 * h, a3)
  const vx3 = vx + 0.5 * h * a2[0]
  const vy3 = vy + 0.5 * h * a2[1]
  gcAcc(p, x + h * vx3, y + h * vy3, t + h, a4)
  const vx4 = vx + h * a3[0]
  const vy4 = vy + h * a3[1]
  g.s[0] = x + (h / 6) * (vx + 2 * vx2 + 2 * vx3 + vx4)
  g.s[1] = y + (h / 6) * (vy + 2 * vy2 + 2 * vy3 + vy4)
  g.s[2] = vx + (h / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0])
  g.s[3] = vy + (h / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1])
  g.t += h
}

/** RK4 steps per laser period used by the sims and tests. */
export const STEPS_PER_PERIOD = 32

/**
 * Follow one electron from rest at (x0, y0) until it is beyond rOut·w (or tMax), and its guiding centre alongside.
 * Returns the period-averaged trajectory (one sample per period), the final drift energy ½|v̄|² and U_p at the
 * start (both in m_e c²), and the measured quiver amplitude early on.
 */
export function runElectron(p: FocusParams, x0: number, y0: number, rOut = 3, tMax = 2e5) {
  const el = createElectrons([[x0, y0]])
  const gc = createCentre(x0, y0)
  const N = STEPS_PER_PERIOD
  const h = (2 * Math.PI) / N
  const avg: { t: number; x: number; y: number; X: number; Y: number }[] = []
  const px = new Float64Array(N)
  let ke = 0
  let quiverAmp = NaN
  let quiverAt = NaN
  while (el.t < tMax) {
    let sx = 0
    let sy = 0
    let svx = 0
    let svy = 0
    let gx = 0
    let gy = 0
    for (let k = 0; k < N; k++) {
      stepElectrons(el, p, h)
      stepCentre(gc, p, h)
      if (k === N / 2 - 1) {
        // the guiding centre at mid-period, where the period average of the particle is centred
        gx = gc.s[0]
        gy = gc.s[1]
      }
      px[k] = el.x[0]
      sx += el.x[0]
      sy += el.y[0]
      svx += el.vx[0]
      svy += el.vy[0]
    }
    const mx = sx / N
    const my = sy / N
    avg.push({ t: el.t - Math.PI, x: mx, y: my, X: gx, Y: gy })
    ke = 0.5 * ((svx / N) ** 2 + (svy / N) ** 2)
    if (Number.isNaN(quiverAmp) && el.t > p.tOn + 2 * Math.PI) {
      // excursion along x after removing the slow drift across this period
      let lo = Infinity
      let hi = -Infinity
      for (let k = 0; k < N; k++) {
        const d = px[k] - (svx / N) * h * (k - (N - 1) / 2)
        lo = Math.min(lo, d)
        hi = Math.max(hi, d)
      }
      quiverAmp = 0.5 * (hi - lo)
      quiverAt = Math.hypot(mx, my)
    }
    if (Math.hypot(mx, my) > rOut * p.w) break
  }
  return { avg, keFinal: ke, upStart: upNorm(p, x0 * x0 + y0 * y0, 1e9), quiverAmp, quiverAt, tEnd: el.t }
}

// ---------- 3. profile steepening ----------
//
// Normal incidence on a linear ramp n0 = n_c x/L (x > 0, capped at U_MAX n_c), in normalized units (k0 = 1).
// The plasma is in pressure balance with the light: the ponderomotive force on the electrons, passed to the ions
// by the ambipolar field, is balanced by the extra pressure gradient, so n = n0 exp(−U_p/kT) with
// kT = k(T_e + T_i/Z). Whatever holds up the original ramp n0 (in a real target, the ablation flow) is kept.
// With E(x) the real standing-wave amplitude in units of the incident amplitude, U_p/kT = (P/2)E², where
// P = (I/c)/(n_c kT) is the light pressure in units of the thermal pressure at n_c. The field obeys the
// nonlinear Helmholtz equation   E'' + [1 − u0(x) exp(−(P/2)E²)] E = 0,
// solved by shooting from the evanescent side, adjusting the starting amplitude until the incident wave in
// vacuum has amplitude 1 (standing wave of amplitude 2, since the light is totally reflected).

export const U_MAX = 3 // the ramp levels off at 3 n_c
export let STEEP_H = 0.1 // RK4 step in c/ω (let: the tests refine it)
export const setSteepH = (h: number) => (STEEP_H = h)

export interface SteepSolution {
  ok: boolean // false if no static reflection exists (the light pushes through the whole ramp)
  logEps: number // log10 of the starting amplitude that matches the incident wave
  x: Float64Array // increasing
  E: Float64Array // standing-wave amplitude (incident = 1)
  dE: Float64Array
  u: Float64Array // n/n_c
  u0: Float64Array // n0/n_c
  xStart: number
}

export const rampU0 = (x: number, L: number) => (x <= 0 ? 0 : Math.min(x / L, U_MAX))

/** Integrate from xs back to the vacuum point x = −π with starting amplitude 10^le; return the standing-wave amplitude there. */
function shoot(L: number, P: number, xs: number, le: number, store?: { x: Float64Array; E: Float64Array; dE: Float64Array }): number {
  const h = STEEP_H
  const n = Math.round((xs + Math.PI) / h)
  let x = xs
  const u0s = rampU0(xs, L)
  const kap = Math.sqrt(Math.max(u0s - 1, 1e-6))
  let E = 10 ** le
  let D = -kap * E
  const f = (xx: number, EE: number) => -(1 - rampU0(xx, L) * Math.exp(-0.5 * P * EE * EE)) * EE
  if (store) {
    store.x[n] = x
    store.E[n] = E
    store.dE[n] = D
  }
  for (let i = n - 1; i >= 0; i--) {
    // RK4 with step −h
    const k1e = D
    const k1d = f(x, E)
    const k2e = D - 0.5 * h * k1d
    const k2d = f(x - 0.5 * h, E - 0.5 * h * k1e)
    const k3e = D - 0.5 * h * k2d
    const k3d = f(x - 0.5 * h, E - 0.5 * h * k2e)
    const k4e = D - h * k3d
    const k4d = f(x - h, E - h * k3e)
    E -= (h / 6) * (k1e + 2 * k2e + 2 * k3e + k4e)
    D -= (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d)
    x -= h
    if (!Number.isFinite(E) || Math.abs(E) > 1e8) return Infinity
    if (store) {
      store.x[i] = x
      store.E[i] = E
      store.dE[i] = D
    }
  }
  return Math.hypot(E, D) // in vacuum E'' + E = 0, so E² + E'² is the squared standing-wave amplitude
}

/** Where to start the shooting: beyond any reflection point the light can reach (u0 = 2.9, or the ramp top). */
export function steepStart(L: number) {
  return L * (U_MAX - 0.1)
}

/**
 * Self-consistent steepened profile for ramp length L (= k0L) and pressure ratio P = (I/c)/(n_c kT).
 * guess: a previous logEps to speed up continuation in P.
 */
export function steepen(L: number, P: number, guess?: number): SteepSolution {
  const xs = steepStart(L)
  const target = Math.log(2)
  const F = (le: number) => Math.log(shoot(L, P, xs, le)) - target
  // S grows monotonically with the starting amplitude; bracket the root in log10 ε, then Illinois regula falsi
  let lo = -300
  let hi = 0
  let flo = F(lo)
  let fhi = F(hi)
  if (guess !== undefined && Number.isFinite(guess)) {
    const a = Math.max(-300, guess - 0.5)
    const b = Math.min(0, guess + 0.5)
    const fa = F(a)
    const fb = F(b)
    if (fa <= 0 && fb >= 0) {
      lo = a
      hi = b
      flo = fa
      fhi = fb
    }
  }
  const n = Math.round((xs + Math.PI) / STEEP_H)
  const store = { x: new Float64Array(n + 1), E: new Float64Array(n + 1), dE: new Float64Array(n + 1) }
  const fail = (): SteepSolution => ({ ok: false, logEps: NaN, x: store.x, E: store.E, dE: store.dE, u: new Float64Array(n + 1), u0: new Float64Array(n + 1), xStart: xs })
  if (!(flo < 0) || !(fhi > 0) || !Number.isFinite(flo)) return fail()
  let side = 0
  let le = lo
  for (let it = 0; it < 100; it++) {
    le = (lo * fhi - hi * flo) / (fhi - flo)
    if (!Number.isFinite(le) || le <= lo || le >= hi) le = 0.5 * (lo + hi)
    const fm = F(le)
    if (Math.abs(fm) < 1e-11 || hi - lo < 1e-13) break
    if (fm > 0 || !Number.isFinite(fm)) {
      hi = le
      fhi = Number.isFinite(fm) ? fm : 50
      if (side === 1) flo /= 2
      side = 1
    } else {
      lo = le
      flo = fm
      if (side === -1) fhi /= 2
      side = -1
    }
  }
  shoot(L, P, xs, le, store)
  const u = new Float64Array(n + 1)
  const u0 = new Float64Array(n + 1)
  for (let i = 0; i <= n; i++) {
    u0[i] = rampU0(store.x[i], L)
    u[i] = u0[i] * Math.exp(-0.5 * P * store.E[i] * store.E[i])
  }
  // a valid static reflection needs a negligible field where the integration started
  const ok = 0.5 * P * store.E[n] * store.E[n] < 1e-6
  return { ok, logEps: le, x: store.x, E: store.E, dE: store.dE, u, u0, xStart: xs }
}

export interface SteepDiagnostics {
  /** EM momentum flux (light pressure) in units of n_c kT: (P/2)(E² + E′²); 2P in vacuum = 2I/c */
  emFluxVacuum: number
  /** total ponderomotive force per unit area on the plasma, ∫ n ∂_x U_p dx, in units of n_c kT */
  totalPush: number
  /** largest deviation of n kT + T_EM − ∫ (holding force) from its vacuum value, in units of n_c kT */
  balanceError: number
  /** last antinode (the field maximum nearest the reflection), the density there (the bottom of the step) and on
   *  the shelf beyond, where the field has died (E² < 1% of its peak) */
  xPeak: number
  uLow: number
  uHigh: number
  /** light pressure (EM momentum flux) at the last antinode, ≈ ε0⟨E²⟩/2 there since E′ = 0, in units of n_c kT */
  peakPressure: number
  /** the light pressure left where the field has died, and the ramp support ∫ n d(ln n0) between the two points */
  shelfPressure: number
  support: number
  /** density scale length u/(du/dx) where the density last crosses n_c, in c/ω */
  scaleAtNc: number
}

export function steepDiagnostics(s: SteepSolution, L: number, P: number): SteepDiagnostics {
  const { x, E, dE, u } = s
  const n = x.length
  // momentum balance: d/dx[u + (P/2)(E² + E′²)] = u d ln u0/dx  (= u/x on the ramp, 0 on the plateau)
  let hold = 0
  const flux = (i: number) => u[i] + 0.5 * P * (E[i] * E[i] + dE[i] * dE[i])
  const ref = flux(0)
  let err = 0
  let push = 0
  const holdDens = (i: number) => (x[i] > 0 && x[i] < L * U_MAX ? u[i] / x[i] : 0)
  for (let i = 1; i < n; i++) {
    const hx = x[i] - x[i - 1]
    hold += 0.5 * (holdDens(i) + holdDens(i - 1)) * hx
    err = Math.max(err, Math.abs(flux(i) - hold - ref))
    // ∫ u d(U_p/kT) = ∫ u (P/2) d(E²)
    push += 0.5 * (u[i] + u[i - 1]) * 0.5 * P * (E[i] * E[i] - E[i - 1] * E[i - 1])
  }
  // field maximum nearest the reflection: global maximum of E² (the last antinode)
  let ip = 0
  for (let i = 0; i < n; i++) if (E[i] * E[i] > E[ip] * E[ip]) ip = i
  // the shelf: where the field has died (E² < 1% of the peak)
  let iHigh = ip
  while (iHigh < n - 1 && E[iHigh] * E[iHigh] > 0.01 * E[ip] * E[ip]) iHigh++
  let support = 0
  for (let i = ip + 1; i <= iHigh; i++) support += 0.5 * (holdDens(i) + holdDens(i - 1)) * (x[i] - x[i - 1])
  // last crossing of n_c
  let ic = -1
  for (let i = n - 1; i > 0; i--)
    if ((u[i] - 1) * (u[i - 1] - 1) <= 0 && u[i] !== u[i - 1]) {
      ic = i
      break
    }
  let scale = NaN
  if (ic > 0) {
    const du = (u[ic] - u[ic - 1]) / (x[ic] - x[ic - 1])
    scale = du > 0 ? 1 / du : NaN
  }
  return {
    emFluxVacuum: 0.5 * P * (E[0] * E[0] + dE[0] * dE[0]),
    totalPush: -push,
    balanceError: err,
    xPeak: x[ip],
    uLow: u[ip],
    uHigh: u[iHigh],
    peakPressure: flux(ip) - u[ip],
    shelfPressure: flux(iHigh) - u[iHigh],
    support,
    scaleAtNc: scale,
  }
}

/**
 * Self-consistency check: freeze the final profile n(x) (evaluated between grid points from the cubic Hermite
 * interpolant of the field) and solve the ordinary, linear Helmholtz equation E'' + (1 − n/n_c)E = 0 in it for an
 * incident amplitude of 1. Returns the largest |E_linear| − |E_steady| relative to the peak field: the light that the
 * steepened plasma lets through must be the light that steepened it.
 */
export function linearCheck(s: SteepSolution, L: number, P: number): number {
  const { x, E, dE } = s
  const n = x.length
  const uAt = (xx: number, EE: number) => rampU0(xx, L) * Math.exp(-0.5 * P * EE * EE)
  const lin = new Float64Array(n)
  let F = 1e-30
  let D = -Math.sqrt(Math.max(rampU0(x[n - 1], L) - 1, 1e-6)) * F
  lin[n - 1] = F
  for (let i = n - 2; i >= 0; i--) {
    const h = x[i + 1] - x[i]
    // profile at the ends and the midpoint of the step, from the steady-state field
    const uR = uAt(x[i + 1], E[i + 1])
    const uL = uAt(x[i], E[i])
    const Em = 0.5 * (E[i] + E[i + 1]) + (h / 8) * (dE[i] - dE[i + 1])
    const uM = uAt(x[i] + 0.5 * h, Em)
    const f = (uu: number, FF: number) => -(1 - uu) * FF
    const k1e = D
    const k1d = f(uR, F)
    const k2e = D - 0.5 * h * k1d
    const k2d = f(uM, F - 0.5 * h * k1e)
    const k3e = D - 0.5 * h * k2d
    const k3d = f(uM, F - 0.5 * h * k2e)
    const k4e = D - h * k3d
    const k4d = f(uL, F - h * k3e)
    F -= (h / 6) * (k1e + 2 * k2e + 2 * k3e + k4e)
    D -= (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d)
    lin[i] = F
    if (i === 0) {
      const S = Math.hypot(F, D) / 2
      let err = 0
      let peak = 0
      for (let k = 0; k < n; k++) {
        err = Math.max(err, Math.abs(Math.abs(lin[k] / S) - Math.abs(E[k])))
        peak = Math.max(peak, Math.abs(E[k]))
      }
      return err / peak
    }
  }
  return NaN
}
