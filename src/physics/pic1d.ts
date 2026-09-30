// 1D electrostatic particle-in-cell code, periodic box, fixed neutralizing ion background.
// Normalized units: ω_pe = 1, ε0 = 1, background density n0 = 1, electron q/m = −1.

export interface Pic1D {
  L: number
  ng: number
  x: Float64Array
  v: Float64Array
  E: Float64Array
  rho: Float64Array
  q: number
  m: number
  t: number
  dt: number
}

export interface PicInit {
  n: number // macro-particles
  ng: number // grid cells
  L: number // box length (in c/ω_pe or λ_D units; the code only needs ω_pe = 1)
  dt: number
  amplitude: number // initial displacement δx = A sin(kx)
  mode: number // which Fourier mode to excite
  vth: number // thermal spread (0 = cold plasma)
  beams?: number // two-stream: ±beams drift speed
  seed?: number
}

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

export function createPic(o: PicInit): Pic1D {
  const rand = rng(o.seed ?? 7)
  const x = new Float64Array(o.n)
  const v = new Float64Array(o.n)
  const k = (2 * Math.PI * o.mode) / o.L
  for (let i = 0; i < o.n; i++) {
    const x0 = ((i + 0.5) * o.L) / o.n
    x[i] = wrap(x0 + o.amplitude * Math.sin(k * x0), o.L)
    // Box–Muller for a Maxwellian spread
    const g = Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
    v[i] = o.vth * g + (o.beams ? (i % 2 ? o.beams : -o.beams) : 0)
  }
  const pic: Pic1D = {
    L: o.L,
    ng: o.ng,
    x,
    v,
    E: new Float64Array(o.ng),
    rho: new Float64Array(o.ng),
    q: -o.L / o.n,
    m: o.L / o.n,
    t: 0,
    dt: o.dt,
  }
  solveField(pic)
  // Stagger v back half a step for leapfrog.
  gatherAndKick(pic, -0.5 * pic.dt)
  return pic
}

function wrap(x: number, L: number) {
  x %= L
  return x < 0 ? x + L : x
}

/** Cloud-in-cell deposit, then Gauss's law dE/dx = ρ with zero-mean E. */
export function solveField(p: Pic1D): void {
  const dx = p.L / p.ng
  const rho = p.rho
  rho.fill(0)
  for (let i = 0; i < p.x.length; i++) {
    const s = p.x[i] / dx - 0.5
    const j = Math.floor(s)
    const f = s - j
    const j0 = (j + p.ng) % p.ng
    const j1 = (j + 1) % p.ng
    rho[j0] += (p.q * (1 - f)) / dx
    rho[j1] += (p.q * f) / dx
  }
  for (let j = 0; j < p.ng; j++) rho[j] += 1 // ion background
  let acc = 0
  let mean = 0
  for (let j = 0; j < p.ng; j++) {
    acc += rho[j] * dx
    p.E[j] = acc
    mean += acc
  }
  mean /= p.ng
  for (let j = 0; j < p.ng; j++) p.E[j] -= mean
}

function fieldAt(p: Pic1D, x: number): number {
  const dx = p.L / p.ng
  // E[j] lives on the right face of cell j; shift to interpolate
  const s = x / dx - 1
  const j = Math.floor(s)
  const f = s - j
  return p.E[(j + p.ng) % p.ng] * (1 - f) + p.E[(j + 1 + p.ng) % p.ng] * f
}

function gatherAndKick(p: Pic1D, dt: number) {
  const qm = p.q / p.m
  for (let i = 0; i < p.x.length; i++) p.v[i] += qm * fieldAt(p, p.x[i]) * dt
}

export function stepPic(p: Pic1D): void {
  gatherAndKick(p, p.dt)
  for (let i = 0; i < p.x.length; i++) p.x[i] = wrap(p.x[i] + p.v[i] * p.dt, p.L)
  solveField(p)
  p.t += p.dt
}

export function fieldEnergy(p: Pic1D): number {
  const dx = p.L / p.ng
  let w = 0
  for (let j = 0; j < p.ng; j++) w += 0.5 * p.E[j] * p.E[j] * dx
  return w
}

export function kineticEnergy(p: Pic1D): number {
  let w = 0
  for (let i = 0; i < p.v.length; i++) w += 0.5 * p.m * p.v[i] * p.v[i]
  return w
}
