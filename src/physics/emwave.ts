// A6: electromagnetic waves in a cold, unmagnetized plasma.
//
// 1D FDTD (Yee) solver for a transverse wave E_y(x,t), B_z(x,t) with a cold-electron fluid
// current: dJ/dt = ε0 ω_p²(x) E. Normalized units: c = 1, ε0 = μ0 = 1, frequencies in units of a
// reference plasma frequency ω_ref (the plateau value in the lesson), lengths in c/ω_ref.
//
//   ∂E/∂t = −∂B/∂x − J,   ∂B/∂t = −∂E/∂x,   ∂J/∂t = ω_p²(x) E
//
// E and J live on integer nodes x_i = i·dx at integer and half-integer times; B lives on
// half nodes. The discrete dispersion relation is
//   (2/dt · sin(ω dt/2))² = (2/dx · sin(k dx/2))² + ω_p²,
// which tends to ω² = ω_p² + c²k² for small dx, dt.
//
// A total-field / scattered-field boundary at srcX injects a one-way wave travelling to +x, so
// the region x < srcX holds only the reflected wave (that is where the reflectance is measured).
// Mur boundaries at both ends and a graded absorbing layer at the right end remove outgoing waves.
// A lock-in over each full wave period gives the complex amplitude a(x) of the steady state.

export interface EMOptions {
  L: number // domain length (c/ω_ref)
  dx: number
  omega: number // source frequency (ω_ref)
  wp2: (x: number) => number // ω_p²(x)
  srcX: number // TF/SF boundary; total field for x ≥ srcX (must be vacuum there)
  amp?: number // incident amplitude
  rise?: number // smooth turn-on time
  sponge?: number // thickness of the absorbing layer at the right end
  courant?: number // target c·dt/dx (the exact dt is chosen so a period is a whole number of steps)
}

export interface EMGrid {
  nx: number
  dx: number
  dt: number
  t: number
  omega: number
  amp: number
  rise: number
  E: Float64Array
  B: Float64Array
  J: Float64Array
  wp2: Float64Array
  dampE: Float64Array // (1 − σdt/2)/(1 + σdt/2) on E and J nodes
  gainE: Float64Array // 1/(1 + σdt/2)
  dampB: Float64Array
  gainB: Float64Array
  src: number
  stepsPerPeriod: number
  phase: number // step counter within the current period
  accRe: Float64Array
  accIm: Float64Array
  aRe: Float64Array // complex amplitude from the last full period
  aIm: Float64Array
  periods: number // completed lock-in periods
  murL: number // Mur coefficient
}

export function createEM(o: EMOptions): EMGrid {
  const nx = Math.round(o.L / o.dx) + 1
  const dx = o.L / (nx - 1)
  const T = (2 * Math.PI) / o.omega
  const stepsPerPeriod = Math.ceil(T / ((o.courant ?? 0.5) * dx))
  const dt = T / stepsPerPeriod
  const wp2 = new Float64Array(nx)
  for (let i = 0; i < nx; i++) wp2[i] = o.wp2(i * dx)
  const sp = o.sponge ?? 0
  const sigma = (x: number) => {
    if (sp <= 0 || x < o.L - sp) return 0
    const s = (x - (o.L - sp)) / sp
    return 2.5 * s * s * s
  }
  const dampE = new Float64Array(nx)
  const gainE = new Float64Array(nx)
  const dampB = new Float64Array(nx - 1)
  const gainB = new Float64Array(nx - 1)
  for (let i = 0; i < nx; i++) {
    const s = (sigma(i * dx) * dt) / 2
    dampE[i] = (1 - s) / (1 + s)
    gainE[i] = 1 / (1 + s)
  }
  for (let i = 0; i < nx - 1; i++) {
    const s = (sigma((i + 0.5) * dx) * dt) / 2
    dampB[i] = (1 - s) / (1 + s)
    gainB[i] = 1 / (1 + s)
  }
  return {
    nx,
    dx,
    dt,
    t: 0,
    omega: o.omega,
    amp: o.amp ?? 1,
    rise: o.rise ?? 4 * T,
    E: new Float64Array(nx),
    B: new Float64Array(nx - 1),
    J: new Float64Array(nx),
    wp2,
    dampE,
    gainE,
    dampB,
    gainB,
    src: Math.max(2, Math.round(o.srcX / dx)),
    stepsPerPeriod,
    phase: 0,
    accRe: new Float64Array(nx),
    accIm: new Float64Array(nx),
    aRe: new Float64Array(nx),
    aIm: new Float64Array(nx),
    periods: 0,
    murL: (dt - dx) / (dt + dx),
  }
}

/** Incident wave at retarded time τ = t − (x − x_src): smooth sin² turn-on, then steady. */
export function incident(g: EMGrid, tau: number): number {
  if (tau <= 0) return 0
  const env = tau < g.rise ? Math.sin((Math.PI * tau) / (2 * g.rise)) ** 2 : 1
  return g.amp * env * Math.sin(g.omega * tau)
}

/** Advance the grid by one time step dt. */
export function stepEM(g: EMGrid): void {
  const { nx, E, B, J, wp2, dt } = g
  const r = dt / g.dx
  const s = g.src
  // J^{n+1/2} = J^{n-1/2} + dt ω_p² E^n   (absorbing layer damps it like E)
  for (let i = 0; i < nx; i++) {
    if (wp2[i] !== 0 || J[i] !== 0) J[i] = g.dampE[i] * J[i] + g.gainE[i] * dt * wp2[i] * E[i]
  }
  // B^{n+1/2} = B^{n-1/2} − dt ∂E/∂x
  for (let i = 0; i < nx - 1; i++) B[i] = g.dampB[i] * B[i] - g.gainB[i] * r * (E[i + 1] - E[i])
  // TF/SF: B at s−1/2 is a scattered-field value but E_s is total → subtract the incident E_s.
  B[s - 1] += r * incident(g, g.t)
  // keep old edge values for the Mur boundaries
  const e0 = E[0]
  const e1 = E[1]
  const eN = E[nx - 1]
  const eN1 = E[nx - 2]
  // E^{n+1} = E^n − dt ∂B/∂x − dt J^{n+1/2}
  for (let i = 1; i < nx - 1; i++) E[i] = g.dampE[i] * E[i] - g.gainE[i] * (r * (B[i] - B[i - 1]) + dt * J[i])
  // TF/SF: E_s is total but B_{s−1/2} is scattered → add the incident B (= E_inc for a +x wave, c = 1).
  E[s] += r * incident(g, g.t + dt / 2 + g.dx / 2)
  // first-order Mur absorbing boundaries
  E[0] = e1 + g.murL * (E[1] - e0)
  E[nx - 1] = eN1 + g.murL * (E[nx - 2] - eN)
  g.t += dt
  // lock-in: project E onto cos ωt and sin ωt over whole periods
  const c = Math.cos(g.omega * g.t)
  const sn = Math.sin(g.omega * g.t)
  const aR = g.accRe
  const aI = g.accIm
  for (let i = 0; i < nx; i++) {
    aR[i] += E[i] * c
    aI[i] += E[i] * sn
  }
  if (++g.phase === g.stepsPerPeriod) {
    const k = 2 / g.stepsPerPeriod
    for (let i = 0; i < nx; i++) {
      g.aRe[i] = aR[i] * k
      g.aIm[i] = aI[i] * k
      aR[i] = 0
      aI[i] = 0
    }
    g.phase = 0
    g.periods++
  }
}

/** Steady-state field amplitude |a(x)| from the last full period (E = |a| cos(ωt − φ)). */
export function amplitudeAt(g: EMGrid, i: number): number {
  return Math.hypot(g.aRe[i], g.aIm[i])
}

const idx = (g: EMGrid, x: number) => Math.max(0, Math.min(g.nx - 1, Math.round(x / g.dx)))

/** Reflected power fraction, from the scattered-field region x < srcX (only reflected light is there). */
export function reflectance(g: EMGrid): number {
  let sum = 0
  let n = 0
  for (let i = 2; i < g.src - 2; i++) {
    sum += g.aRe[i] ** 2 + g.aIm[i] ** 2
    n++
  }
  return n ? sum / n / (g.amp * g.amp) : NaN
}

/**
 * Where the wave turns around, measured from the field itself. In a linear ramp the exact field is
 * an Airy function Ai((x − x_c)/δ): it peaks at ζ = −1.019 and falls to Ai(0)/Ai_max = 0.6628 of
 * that peak exactly at the critical layer x_c. Find the last peak beyond xFrom and walk forward
 * to the 0.6628 level. Returns NaN if there is no clear peak (e.g. the wave is transmitted).
 */
export const AIRY_RATIO = 0.6627903338839711
export function turningPoint(g: EMGrid, xFrom: number): number {
  const i0 = idx(g, xFrom)
  let gmax = 0
  for (let i = i0; i < g.nx; i++) gmax = Math.max(gmax, amplitudeAt(g, i))
  if (gmax === 0) return NaN
  let peak = -1
  for (let i = g.nx - 2; i > i0; i--) {
    const a = amplitudeAt(g, i)
    if (a > 0.3 * gmax && a >= amplitudeAt(g, i - 1) && a > amplitudeAt(g, i + 1)) {
      peak = i
      break
    }
  }
  if (peak < 0) return NaN
  const target = AIRY_RATIO * amplitudeAt(g, peak)
  for (let i = peak + 1; i < g.nx; i++) {
    const a = amplitudeAt(g, i)
    if (a < target) {
      const a0 = amplitudeAt(g, i - 1)
      return (i - 1 + (a0 - target) / (a0 - a)) * g.dx
    }
  }
  return NaN
}

/** Least-squares slope of y(x) over the nodes in [x1, x2]. */
function slope(g: EMGrid, x1: number, x2: number, y: (i: number) => number): number {
  const i1 = idx(g, x1)
  const i2 = idx(g, x2)
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  let n = 0
  for (let i = i1; i <= i2; i++) {
    const x = i * g.dx
    const v = y(i)
    sx += x
    sy += v
    sxx += x * x
    sxy += x * v
    n++
  }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx)
}

/** Evanescent decay length 1/κ from the slope of ln|a| over [x1, x2]. */
export function decayLength(g: EMGrid, x1: number, x2: number): number {
  return -1 / slope(g, x1, x2, (i) => Math.log(amplitudeAt(g, i) + 1e-300))
}

/** Local wavenumber from the phase slope of a(x) over [x1, x2] (phase unwrapped). */
export function wavenumber(g: EMGrid, x1: number, x2: number): number {
  const i1 = idx(g, x1)
  const i2 = idx(g, x2)
  const ph = new Float64Array(i2 - i1 + 1)
  let prev = Math.atan2(g.aIm[i1], g.aRe[i1])
  let off = 0
  ph[0] = prev
  for (let i = i1 + 1; i <= i2; i++) {
    const p = Math.atan2(g.aIm[i], g.aRe[i])
    const d = p - prev
    if (d > Math.PI) off -= 2 * Math.PI
    else if (d < -Math.PI) off += 2 * Math.PI
    prev = p
    ph[i - i1] = p + off
  }
  return slope(g, x1, x2, (i) => ph[i - i1])
}

// ---------- the lesson's standard set-up ----------
// Units: ω_ref = plateau plasma frequency ω_p,max; lengths in c/ω_p,max.
// Vacuum up to X0, then either a linear ramp over RAMP to the plateau, or a sharp edge.

// The absorbing layer (x > 56, hidden in the sim) must be several plasma wavelengths thick: just above
// cutoff the wavelength in the plateau is long (14 c/ω_p at ω = 1.1) and a thin layer reflects it back.
export const LASER = { L: 116, dx: 0.05, srcX: 2, X0: 12, RAMP: 24, sponge: 60, view: 56 }

export type Profile = 'ramp' | 'edge'

export function laserProfile(profile: Profile): (x: number) => number {
  const { X0, RAMP } = LASER
  return (x) => (x < X0 ? 0 : profile === 'edge' || x >= X0 + RAMP ? 1 : (x - X0) / RAMP)
}

export function createLaser(omega: number, profile: Profile): EMGrid {
  return createEM({ L: LASER.L, dx: LASER.dx, omega, wp2: laserProfile(profile), srcX: LASER.srcX, sponge: LASER.sponge })
}

/** Theory: position of the critical layer n = n_c (i.e. ω_p(x) = ω), or NaN if ω exceeds the plateau ω_p. */
export function criticalX(omega: number, profile: Profile): number {
  if (omega >= 1) return NaN
  return profile === 'edge' ? LASER.X0 : LASER.X0 + LASER.RAMP * omega * omega
}

/** Theory: reflectance of a sharp vacuum–plasma edge (Fresnel, normal incidence), ω_p = 1. */
export function fresnelR(omega: number): number {
  if (omega <= 1) return 1
  const N = Math.sqrt(1 - 1 / (omega * omega))
  return ((1 - N) / (1 + N)) ** 2
}

/** Cold-plasma light: wavenumber k = √(ω² − ω_p²)/c (NaN below cutoff). */
export function plasmaK(omega: number, wp = 1): number {
  return omega > wp ? Math.sqrt(omega * omega - wp * wp) : NaN
}

/** Evanescent decay length 1/κ = c/√(ω_p² − ω²) (NaN above cutoff). */
export function skinDepth(omega: number, wp = 1): number {
  return omega < wp ? 1 / Math.sqrt(wp * wp - omega * omega) : NaN
}

// ---------- cold magnetized plasma (electrons only, ions fixed) ----------
// X = ω_p²/ω², Y = ω_c/ω. Stix parameters and the four principal modes.

export interface Stix {
  R: number
  L: number
  P: number
  S: number
}

export function stix(X: number, Y: number): Stix {
  const R = 1 - X / (1 - Y)
  const L = 1 - X / (1 + Y)
  const P = 1 - X
  return { R, L, P, S: (R + L) / 2 }
}

export type ModeName = 'R' | 'L' | 'O' | 'X'

/** n² = c²k²/ω² of each principal mode: R, L along B; O, X across B. */
export function modeN2(X: number, Y: number): Record<ModeName, number> {
  const { R, L, P, S } = stix(X, Y)
  return { R, L, O: P, X: (R * L) / S }
}

/** Which principal modes propagate (n² > 0) at the CMA point (X, Y). */
export function propagating(X: number, Y: number): Record<ModeName, boolean> {
  const n2 = modeN2(X, Y)
  const ok = (v: number) => v > 0 && Number.isFinite(v)
  return { R: ok(n2.R), L: ok(n2.L), O: ok(n2.O), X: ok(n2.X) }
}

/** Characteristic frequencies in units of ω_p, for b = ω_c/ω_p. */
export function cutoffs(b: number) {
  const r = Math.sqrt(b * b + 4)
  return { wR: (b + r) / 2, wL: (-b + r) / 2, wUH: Math.sqrt(1 + b * b), wc: b, wp: 1 }
}

/**
 * Dispersion branches ω(k) in units of ω_p (c = 1) for b = ω_c/ω_p, found by bisection on the
 * interval where each branch lives; k²(ω) = ω² n²(ω) is monotonic on each.
 */
export type Branch = 'O' | 'L' | 'R-high' | 'R-whistler' | 'X-high' | 'X-low'
export function branchOmega(branch: Branch, k: number, b: number): number {
  const { wR, wL, wUH } = cutoffs(b)
  const k2 = (w: number) => {
    const n2 = modeN2(1 / (w * w), b / w)
    const m = branch[0] as ModeName
    return w * w * n2[m]
  }
  let lo: number
  let hi: number
  switch (branch) {
    case 'O':
      return Math.sqrt(1 + k * k)
    case 'L':
      lo = wL
      hi = wL + k + 2
      break
    case 'R-high':
      lo = wR
      hi = wR + k + 2
      break
    case 'R-whistler':
      lo = 1e-9
      hi = b
      break
    case 'X-high':
      lo = wR
      hi = wR + k + 2
      break
    case 'X-low':
      lo = wL
      hi = wUH
      break
  }
  if (branch === 'R-whistler' && b <= 0) return NaN
  const target = k * k
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2
    const v = k2(mid)
    if (v < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Time for the lesson set-up to reach its steady state where the readouts are measured: the turn-on,
 * plus the group-delay of the wave from the source to the far end of the measuring window (x = 54 for the
 * transmitted wavelength) or to the turning point and back (for R, x_turn and the decay length), with a
 * 1.5× margin because the spectrum of the turn-on reaches frequencies whose group velocity is lower.
 */
export function settleTime(omega: number, profile: Profile): number {
  const T = (2 * Math.PI) / omega
  const wp2 = laserProfile(profile)
  const w2 = omega * omega
  // ∫ dx / v_g from X0 to xEnd, v_g = √(1 − ω_p²/ω²); the 1/√ singularity at a turning point is integrable
  const delay = (xEnd: number) => {
    const n = 400
    const h = (xEnd - LASER.X0) / n
    let s = 0
    for (let j = 0; j < n; j++) {
      const q = 1 - wp2(LASER.X0 + (j + 0.5) * h) / w2
      s += q > 0 ? h / Math.sqrt(q) : 0
    }
    return s
  }
  const vac = LASER.X0 - LASER.srcX
  let travel: number
  if (omega < 1) {
    const xc = criticalX(omega, profile)
    travel = 2 * vac + (profile === 'ramp' ? 2 * delay(xc) : 0)
  } else {
    // there and back for the reflection, and on to the end of the wavelength window
    travel = Math.max(2 * vac + 2 * delay(LASER.X0 + LASER.RAMP), vac + delay(54))
  }
  return 4 * T + 3 * T + 1.5 * travel + 30
}
