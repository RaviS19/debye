// Diamagnetic drift from pure gyration. Every particle circles a guiding centre that never moves,
// yet a density (or temperature) gradient makes more particles cross a line one way than the other.
//
// Normalized units: |q| = m = B = 1, so ω_c = 1. The temperature at the slab centre is T0 = 1, so the
// thermal speed v_th = √(kT/m) = 1 and the thermal Larmor radius ρ_th = v_th/ω_c = 1.
// B points out of the screen (+z); the gradients point along +x; the diamagnetic flow is along y.
// Theory: particle flux Γ_y = (1/qB) ∂p/∂x, fluid velocity v_D = Γ_y / n = (∂p/∂x)/(q n B).

export interface DiamagInit {
  n: number // number of particles
  Lx: number // slab width (guiding centres fill 0..Lx)
  Ly: number // periodic height
  gn: number // (1/n0) dn/dx at the centre, i.e. 1/L_n (linear profile)
  gT: number // (1/T0) dT/dx at the centre, i.e. 1/L_T (linear profile)
  charge: 1 | -1 // +1 ion (gyrates clockwise, B out of screen), −1 electron (anticlockwise)
}

export interface Diamag {
  N: number
  Lx: number
  Ly: number
  gn: number
  gT: number
  q: 1 | -1
  X: Float64Array // guiding centres (fixed)
  Y: Float64Array
  rho: Float64Array // Larmor radius of each particle
  phase0: Float64Array
  x: Float64Array // current position (y unwrapped: y = Y + ρ cos φ)
  y: Float64Array
  t: number
  // measurement window: the band a ≤ x ≤ b over the full height, and the counting line y = y0 inside it
  a: number
  b: number
  y0: number
  up: number // crossings of the counting line
  down: number
  bandFlux: number // ∫ Σ_{particles in band} v_y dt  (= net crossings of every horizontal line in the band)
  flash: Float32Array // >0 recently crossed upward, <0 downward (decays in the view)
}

const PHI = (Math.sqrt(5) - 1) / 2 // golden ratio: pairs with (i+½)/N to give a Fibonacci lattice in (X, ρ)
const PLASTIC = 0.7548776662466927 // 1/plastic number, for the y positions
const PHASE = 0.5698402909980532 // 1/φ₃ with φ₃⁴ = φ₃ + 1, for gyro-phases

/** Inverse CDF of a linear density profile n ∝ 1 + g·u on −h ≤ u ≤ h. */
function linearQuantile(q: number, g: number, h: number): number {
  if (Math.abs(g) < 1e-9) return -h + 2 * h * q
  const c = h - (g * h * h) / 2 - 2 * h * q
  return (-1 + Math.sqrt(1 - 2 * g * c)) / g
}

/**
 * Quiet start: guiding-centre x from the exact inverse CDF of the density profile, Larmor radii from the
 * 2D Maxwellian (Rayleigh) inverse CDF at the local temperature, arranged on a Fibonacci lattice so the
 * band measurement converges with a few thousand particles instead of a few hundred thousand.
 */
export function createDiamag(o: DiamagInit): Diamag {
  const N = o.n
  const h = o.Lx / 2
  const X = new Float64Array(N)
  const Y = new Float64Array(N)
  const rho = new Float64Array(N)
  const phase0 = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    const u = linearQuantile((i + 0.5) / N, o.gn, h)
    X[i] = u + h
    Y[i] = ((0.5 + i * PLASTIC) % 1) * o.Ly
    const T = Math.max(0.02, 1 + o.gT * u)
    const qr = (0.5 + i * PHI) % 1
    rho[i] = Math.sqrt(T) * Math.sqrt(-2 * Math.log(1 - qr)) // v⊥/ω_c with ⟨v⊥²⟩ = 2kT/m
    phase0[i] = 2 * Math.PI * ((0.5 + i * PHASE) % 1)
  }
  const d: Diamag = {
    N,
    Lx: o.Lx,
    Ly: o.Ly,
    gn: o.gn,
    gT: o.gT,
    q: o.charge,
    X,
    Y,
    rho,
    phase0,
    x: new Float64Array(N),
    y: new Float64Array(N),
    t: 0,
    a: o.Lx / 4,
    b: (3 * o.Lx) / 4,
    y0: o.Ly / 2,
    up: 0,
    down: 0,
    bandFlux: 0,
    flash: new Float32Array(N),
  }
  place(d, 0)
  return d
}

/** Exact gyration: ions clockwise (φ = φ0 + t), electrons anticlockwise (φ = φ0 − t), about fixed (X, Y). */
function place(d: Diamag, t: number) {
  for (let i = 0; i < d.N; i++) {
    const ph = d.phase0[i] + d.q * t
    d.x[i] = d.X[i] + d.rho[i] * Math.sin(ph)
    d.y[i] = d.Y[i] + d.rho[i] * Math.cos(ph)
  }
}

/** Advance by dt in `sub` sub-steps, counting line crossings and accumulating the band flux. */
export function advanceDiamag(d: Diamag, dt: number, sub = 4): void {
  const h = dt / sub
  const { a, b, y0 } = d
  for (let s = 0; s < sub; s++) {
    const t1 = d.t + h
    for (let i = 0; i < d.N; i++) {
      const ph = d.phase0[i] + d.q * t1
      const xn = d.X[i] + d.rho[i] * Math.sin(ph)
      const yn = d.Y[i] + d.rho[i] * Math.cos(ph)
      const xo = d.x[i]
      const yo = d.y[i]
      const xm = 0.5 * (xo + xn)
      if (xm >= a && xm <= b) {
        d.bandFlux += yn - yo
        if ((yo - y0) * (yn - y0) < 0) {
          if (yn > yo) {
            d.up++
            d.flash[i] = 1
          } else {
            d.down++
            d.flash[i] = -1
          }
        }
      }
      d.x[i] = xn
      d.y[i] = yn
    }
    d.t = t1
  }
}

/** Mean background density n0 (particles per unit area) and the profiles n(x), T(x). */
export function meanDensity(d: Diamag): number {
  return d.N / (d.Lx * d.Ly)
}
export const densityAt = (d: Diamag, x: number) => meanDensity(d) * (1 + d.gn * (x - d.Lx / 2))
export const temperatureAt = (d: Diamag, x: number) => 1 + d.gT * (x - d.Lx / 2)

/** Theory: Γ_y = (1/qB) dp/dx at the band centre, with p = n kT (q = ±1, B = 1). */
export function theoryFlux(d: Diamag): number {
  return (meanDensity(d) * (d.gn + d.gT)) / d.q
}

/** Theory: diamagnetic fluid velocity v_D = (dp/dx)/(q n B) at the centre, in units of v_th. */
export function theoryDrift(d: Diamag): number {
  return (d.gn + d.gT) / d.q
}

/** Measured particle flux Γ_y averaged over every horizontal line in the band (and over time). */
export function measuredFlux(d: Diamag): number {
  return d.t > 0 ? d.bandFlux / ((d.b - d.a) * d.Ly * d.t) : 0
}

/** Measured flux through the single counting line y = y0, a ≤ x ≤ b. Noisier: it samples few particles. */
export function lineFlux(d: Diamag): number {
  return d.t > 0 ? (d.up - d.down) / ((d.b - d.a) * d.t) : 0
}
