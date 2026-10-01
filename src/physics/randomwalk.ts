// A7: random walk across a magnetic field.
//
// Particles gyrate exactly in a uniform B (along z) and suffer collisions at random times (a Poisson
// process with rate ν). Each collision replaces the velocity with a fresh draw from a Maxwellian, so
// memory of the old orbit is lost completely (a BGK/Krook collision model). Motion is 2D, in the
// plane perpendicular to B.
//
// Normalized units: ν = 1 (time in collision times), kT/m = 1 (so v_th = √(kT/m) = 1 per component),
// lengths in v_th/ν (the mean free path). The only parameter is w = ω_c/ν.
//
// The velocity autocorrelation is ⟨v_x(0)v_x(t)⟩ = (kT/m) e^{−νt} cos(ω_c t), so the diffusion
// coefficient is D⊥ = ∫ C dt = (kT/mν) / (1 + ω_c²/ν²) — in these units 1/(1 + w²).

export interface Walkers {
  n: number
  w: number // ω_c / ν
  t: number
  x: Float64Array
  y: Float64Array
  vx: Float64Array
  vy: Float64Array
  tNext: Float64Array // time of each particle's next collision
  collisions: Uint32Array
  rand: () => number
}

/** Small, fast, seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-300)) * Math.cos(2 * Math.PI * rand())
}

function expTime(rand: () => number): number {
  return -Math.log(1 - rand())
}

export function createWalkers(n: number, w: number, seed = 1): Walkers {
  const rand = mulberry32(seed)
  const ws: Walkers = {
    n,
    w,
    t: 0,
    x: new Float64Array(n),
    y: new Float64Array(n),
    vx: new Float64Array(n),
    vy: new Float64Array(n),
    tNext: new Float64Array(n),
    collisions: new Uint32Array(n),
    rand,
  }
  for (let i = 0; i < n; i++) {
    ws.vx[i] = gauss(rand)
    ws.vy[i] = gauss(rand)
    ws.tNext[i] = expTime(rand)
  }
  return ws
}

/** Exact free gyration of particle i for a time h (positive charge, B along +z). */
function gyrate(ws: Walkers, i: number, h: number): void {
  const vx = ws.vx[i]
  const vy = ws.vy[i]
  const w = ws.w
  const th = w * h
  if (Math.abs(th) < 1e-6) {
    ws.x[i] += vx * h + 0.5 * w * vy * h * h
    ws.y[i] += vy * h - 0.5 * w * vx * h * h
    ws.vx[i] = vx + w * vy * h
    ws.vy[i] = vy - w * vx * h
    return
  }
  const c = Math.cos(th)
  const s = Math.sin(th)
  // dv/dt = ω_c (v_y, −v_x): clockwise rotation seen from +z
  ws.x[i] += (vx * s + vy * (1 - c)) / w
  ws.y[i] += (vy * s - vx * (1 - c)) / w
  ws.vx[i] = vx * c + vy * s
  ws.vy[i] = vy * c - vx * s
}

/** Advance particles [i0, i1) from ws.t to ws.t + dt, handling every collision exactly. Does not touch ws.t. */
export function advanceRange(ws: Walkers, i0: number, i1: number, t0: number, dt: number): number {
  const tEnd = t0 + dt
  let hits = 0
  for (let i = i0; i < i1; i++) {
    let now = t0
    while (ws.tNext[i] < tEnd) {
      gyrate(ws, i, ws.tNext[i] - now)
      now = ws.tNext[i]
      ws.vx[i] = gauss(ws.rand)
      ws.vy[i] = gauss(ws.rand)
      ws.tNext[i] = now + expTime(ws.rand)
      ws.collisions[i]++
      hits++
    }
    gyrate(ws, i, tEnd - now)
  }
  return hits
}

export function advanceWalkers(ws: Walkers, dt: number): void {
  advanceRange(ws, 0, ws.n, ws.t, dt)
  ws.t += dt
}

/** Mean squared displacement per dimension, ⟨Δx²⟩ = (⟨Δx²⟩ + ⟨Δy²⟩)/2 (all start at the origin). */
export function msd(ws: Walkers): number {
  let s = 0
  for (let i = 0; i < ws.n; i++) s += ws.x[i] * ws.x[i] + ws.y[i] * ws.y[i]
  return s / (2 * ws.n)
}

/** Measured diffusion coefficient ⟨Δx²⟩ / 2t. */
export function measuredD(ws: Walkers): number {
  return ws.t > 0 ? msd(ws) / (2 * ws.t) : NaN
}

/** Classical cross-field diffusion D⊥ = (kT/mν)/(1 + ω_c²/ν²), normalized units. */
export function dPerp(w: number): number {
  return 1 / (1 + w * w)
}

/**
 * Exact ⟨Δx²⟩(t) for this model, including the early ballistic part:
 * ⟨Δx²⟩ = 2(kT/m) Re[ t/a − (1 − e^{−at})/a² ],  a = ν − iω_c.
 */
export function theoryMSD(t: number, w: number): number {
  const d = 1 + w * w
  const p = (1 - w * w) / (d * d) // Re(1/a²)
  const q = (2 * w) / (d * d) // Im(1/a²)
  const e = Math.exp(-t)
  const ur = 1 - e * Math.cos(w * t) // Re(1 − e^{−at})
  const ui = -e * Math.sin(w * t) // Im(1 − e^{−at})
  return 2 * (t / d - (ur * p - ui * q))
}
