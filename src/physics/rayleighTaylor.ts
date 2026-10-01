// 2D Rayleigh–Taylor instability: heavy fluid resting on light fluid under gravity.
// Boussinesq model in vorticity–streamfunction form, free-slip walls at top and bottom,
// periodic in x:
//   ∂ω/∂t + u·∇ω = ∂b/∂x + ν∇²ω,    ∂b/∂t + u·∇b = 0,    ∇²ψ = −ω,    u = ∂ψ/∂z, w = −∂ψ/∂x
// b = −g(ρ − ρ̄)/ρ̄ is the buoyancy. Heavy fluid on top: b = −gA above the interface, +gA below,
// where A = (ρ_h − ρ_l)/(ρ_h + ρ_l) is the Atwood number.
// Units: box width 1, g = 1, so times are in √(width/g).
// Numerics: third-order upwind-biased advection, SSP-RK3 in time, Poisson solved by FFT in x and
// a tridiagonal (Thomas) solve in z. The buoyancy has no explicit diffusion; the upwind scheme only
// dissipates where the flow moves, so the resting interface keeps its initial width δ.

export interface RTOptions {
  A: number // Atwood number
  nu: number // kinematic viscosity (box width² / time unit)
  delta: number // interface half-width of the tanh profile
  mode: number // seeded mode number m, k = 2πm / Lx
  eta0?: number // seed amplitude of the interface displacement
  noise?: number // relative amplitude of random low modes added to the seed
  seed?: number
  flipped?: boolean // light fluid on top (stable)
  nx?: number
  nz?: number
}

export interface RT {
  nx: number
  nz: number // cells in z; nodes j = 0..nz, walls at j = 0 and j = nz
  lx: number
  lz: number
  dx: number
  dz: number
  A: number
  g: number
  nu: number
  delta: number
  mode: number
  k: number
  om: Float64Array // (nz+1)·nx, index j·nx + i
  b: Float64Array
  psi: Float64Array
  u: Float64Array
  w: Float64Array
  t: number
  // RK work
  om0: Float64Array
  b0: Float64Array
  rom: Float64Array
  rb: Float64Array
  pom: Float64Array // padded copies (two ghost rows per wall)
  pb: Float64Array
  cosT: Float64Array // cos/sin tables for mode diagnostics
  sinT: Float64Array
  // FFT / Poisson work
  fft: FFT
  specRe: Float64Array // (nz+1)·(nx/2+1)
  specIm: Float64Array
  cp: Float64Array[] // Thomas coefficients per x-mode
  inv: Float64Array[]
  bufRe: Float64Array
  bufIm: Float64Array
  // diagnostics
  times: number[]
  amps: number[] // mode-m amplitude of the vertical velocity
  etas: number[] // estimated interface displacement amplitude (from w / σ)
  slopes: number[] // largest interface slope |∂η/∂x| over all modes (seed noise included)
  bBar: Float64Array // unperturbed buoyancy profile b̄(z), for the interface displacement
  etaX: Float64Array // work: interface displacement η(x)
  flip: number // +1 heavy on top, −1 flipped
}

// ---------- small radix-2 complex FFT ----------
export interface FFT {
  n: number
  rev: Uint32Array
  cos: Float64Array
  sin: Float64Array
}

export function makeFFT(n: number): FFT {
  const bits = Math.round(Math.log2(n))
  if (1 << bits !== n) throw new Error('FFT size must be a power of two')
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    rev[i] = r
  }
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  return { n, rev, cos, sin }
}

/** In-place FFT. sign = −1 forward (e^{−ikx}), +1 inverse (unnormalized). */
export function fft(f: FFT, re: Float64Array, im: Float64Array, sign: 1 | -1): void {
  const n = f.n
  for (let i = 0; i < n; i++) {
    const j = f.rev[i]
    if (j > i) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = n / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const c = f.cos[k * step]
        const s = sign * f.sin[k * step]
        const a = start + k
        const b = a + half
        const tr = re[b] * c - im[b] * s
        const ti = re[b] * s + im[b] * c
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

// ---------- theory ----------
/** Sharp interface, inviscid: σ = √(A g k). */
export const rtSharp = (A: number, g: number, k: number) => Math.sqrt(Math.max(0, A * g * k))

/** tanh profile of half-width δ, inviscid (exact for an unbounded tanh profile): σ² = A g k / (1 + kδ). */
export const rtDiffuse = (A: number, g: number, k: number, delta: number) => Math.sqrt(Math.max(0, (A * g * k) / (1 + k * delta)))

/**
 * Viscous estimate: σ = √(σ₀² + ν²k⁴) − νk², the root of σ² + 2νk²σ = σ₀². A common approximate form, not an
 * exact result: it captures the viscous cut-off of short ripples, and for this solver's settings it agrees
 * with the exact linear rate to about 1% at small νk²/σ₀, but it can be off by tens of percent when the
 * viscous term is comparable with σ₀ (e.g. about 25% at A = 0.05, m = 5, ν = 3×10⁻³).
 */
export const rtViscous = (sigma0: number, nu: number, k: number) => Math.sqrt(sigma0 * sigma0 + nu * nu * k ** 4) - nu * k * k

/**
 * Exact linear growth rate for this solver's grid, profile and viscosity: march the linearized
 * equations for one Fourier mode in x until the fastest-growing eigenmode dominates.
 */
export function rtLinearGrowth(o: { A: number; nu: number; delta: number; mode: number; nx?: number; nz?: number }): number {
  const nx = o.nx ?? 64
  const nz = o.nz ?? 128
  const lx = 1
  const lz = 2
  const dx = lx / nx
  const dz = lz / nz
  const k = (2 * Math.PI * o.mode) / lx
  const ke4 = (8 * Math.sin(k * dx) - Math.sin(2 * k * dx)) / (6 * dx) // 4th-order ∂b/∂x
  const ke2 = Math.sin(k * dx) / dx // 2nd-order w = −∂ψ/∂x
  const lam = (4 / (dx * dx)) * Math.sin((k * dx) / 2) ** 2 // 5-point Laplacian in x
  const n = nz - 1
  const b0p = new Float64Array(n)
  const zc = lz / 2
  for (let j = 0; j < n; j++) {
    const z = (j + 1) * dz - zc
    const c = Math.cosh(z / o.delta)
    b0p[j] = (-o.A / o.delta) / (c * c)
  }
  // Thomas coefficients for (D² − λ)ψ = rhs, Dirichlet ends
  const a = 1 / (dz * dz)
  const d = -2 / (dz * dz) - lam
  const cp = new Float64Array(n)
  const iv = new Float64Array(n)
  let prev = 0
  for (let j = 0; j < n; j++) {
    const den = d - a * prev
    iv[j] = 1 / den
    cp[j] = a / den
    prev = cp[j]
  }
  const solve = (rhs: Float64Array, out: Float64Array) => {
    let p = 0
    for (let j = 0; j < n; j++) {
      p = (rhs[j] - a * p) * iv[j]
      out[j] = p
    }
    for (let j = n - 2; j >= 0; j--) out[j] -= cp[j] * out[j + 1]
  }
  // real form: ω̂ real, b̂ = −iβ; dω/dt = ke4 β + ν(D² − λ)ω, dβ/dt = −ke2 ψ b0', ψ = −(D² − λ)⁻¹ ω
  const om = new Float64Array(n)
  const be = new Float64Array(n)
  for (let j = 0; j < n; j++) be[j] = -b0p[j] // start from a displaced interface
  const psi = new Float64Array(n)
  const tmp = new Float64Array(n)
  const deriv = (om: Float64Array, be: Float64Array, dom: Float64Array, dbe: Float64Array) => {
    for (let j = 0; j < n; j++) tmp[j] = -om[j]
    solve(tmp, psi)
    for (let j = 0; j < n; j++) {
      const lap = ((j > 0 ? om[j - 1] : 0) - 2 * om[j] + (j < n - 1 ? om[j + 1] : 0)) / (dz * dz) - lam * om[j]
      dom[j] = ke4 * be[j] + o.nu * lap
      dbe[j] = -ke2 * psi[j] * b0p[j]
    }
  }
  const s0 = rtDiffuse(o.A, 1, k, o.delta)
  const dt = Math.min(0.02, 0.05 / Math.max(s0, 1e-3))
  const k1o = new Float64Array(n), k1b = new Float64Array(n)
  const k2o = new Float64Array(n), k2b = new Float64Array(n)
  const k3o = new Float64Array(n), k3b = new Float64Array(n)
  const k4o = new Float64Array(n), k4b = new Float64Array(n)
  const to = new Float64Array(n), tb = new Float64Array(n)
  const norm = () => {
    let s = 0
    for (let j = 0; j < n; j++) s += om[j] * om[j]
    return Math.sqrt(s)
  }
  const T = 20 / Math.max(s0, 0.05)
  const steps = Math.ceil(T / dt)
  let rate = 0
  let last = norm()
  for (let s = 0; s < steps; s++) {
    deriv(om, be, k1o, k1b)
    for (let j = 0; j < n; j++) { to[j] = om[j] + 0.5 * dt * k1o[j]; tb[j] = be[j] + 0.5 * dt * k1b[j] }
    deriv(to, tb, k2o, k2b)
    for (let j = 0; j < n; j++) { to[j] = om[j] + 0.5 * dt * k2o[j]; tb[j] = be[j] + 0.5 * dt * k2b[j] }
    deriv(to, tb, k3o, k3b)
    for (let j = 0; j < n; j++) { to[j] = om[j] + dt * k3o[j]; tb[j] = be[j] + dt * k3b[j] }
    deriv(to, tb, k4o, k4b)
    for (let j = 0; j < n; j++) {
      om[j] += (dt / 6) * (k1o[j] + 2 * k2o[j] + 2 * k3o[j] + k4o[j])
      be[j] += (dt / 6) * (k1b[j] + 2 * k2b[j] + 2 * k3b[j] + k4b[j])
    }
    const nn = norm()
    if (nn > 0 && last > 0) rate = Math.log(nn / last) / dt
    // renormalize to avoid overflow
    if (nn > 1e100 || nn < 1e-100) {
      const f = 1 / nn
      for (let j = 0; j < n; j++) { om[j] *= f; be[j] *= f }
      last = 1
    } else last = nn
  }
  return rate
}

// ---------- solver ----------
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRT(o: RTOptions): RT {
  const nx = o.nx ?? 64
  const nz = o.nz ?? 128
  const lx = 1
  const lz = 2
  const dx = lx / nx
  const dz = lz / nz
  const N = (nz + 1) * nx
  const mh = nx / 2 + 1
  const rt: RT = {
    nx, nz, lx, lz, dx, dz,
    A: o.A, g: 1, nu: o.nu, delta: o.delta, mode: o.mode,
    k: (2 * Math.PI * o.mode) / lx,
    om: new Float64Array(N), b: new Float64Array(N), psi: new Float64Array(N), u: new Float64Array(N), w: new Float64Array(N),
    t: 0,
    om0: new Float64Array(N), b0: new Float64Array(N), rom: new Float64Array(N), rb: new Float64Array(N),
    pom: new Float64Array((nz + 5) * nx), pb: new Float64Array((nz + 5) * nx),
    cosT: new Float64Array(nx), sinT: new Float64Array(nx),
    fft: makeFFT(nx),
    specRe: new Float64Array((nz + 1) * mh), specIm: new Float64Array((nz + 1) * mh),
    cp: [], inv: [],
    bufRe: new Float64Array(nx), bufIm: new Float64Array(nx),
    times: [], amps: [], etas: [], slopes: [],
    bBar: new Float64Array(nz + 1), etaX: new Float64Array(nx), flip: o.flipped ? -1 : 1,
  }
  for (let i = 0; i < nx; i++) {
    rt.cosT[i] = Math.cos((2 * Math.PI * o.mode * i) / nx)
    rt.sinT[i] = Math.sin((2 * Math.PI * o.mode * i) / nx)
  }
  // Thomas coefficients for each x-mode: (D_z² − λ_m) ψ = rhs on interior nodes, ψ = 0 at walls.
  const n = nz - 1
  const a = 1 / (dz * dz)
  for (let m = 0; m < mh; m++) {
    const lam = (4 / (dx * dx)) * Math.sin((Math.PI * m) / nx) ** 2
    const d = -2 / (dz * dz) - lam
    const cp = new Float64Array(n)
    const iv = new Float64Array(n)
    let prev = 0
    for (let j = 0; j < n; j++) {
      const den = d - a * prev
      iv[j] = 1 / den
      cp[j] = a / den
      prev = cp[j]
    }
    rt.cp.push(cp)
    rt.inv.push(iv)
  }
  // initial interface: z = lz/2 + η(x), η = η0 cos(kx) + a few random low modes
  const rand = rng(o.seed ?? 5)
  const eta0 = o.eta0 ?? 0.001
  const noise = o.noise ?? 0.08
  const eta = new Float64Array(nx)
  for (let i = 0; i < nx; i++) eta[i] = eta0 * Math.cos(rt.k * i * dx)
  for (let m = 1; m <= 10; m++) {
    const amp = eta0 * noise * (rand() * 2 - 1)
    const ph = 2 * Math.PI * rand()
    for (let i = 0; i < nx; i++) eta[i] += amp * Math.cos(2 * Math.PI * m * i * dx + ph)
  }
  const sgn = o.flipped ? -1 : 1
  for (let j = 0; j <= nz; j++) {
    const z = j * dz - lz / 2
    rt.bBar[j] = -sgn * o.A * rt.g * Math.tanh(z / o.delta)
    for (let i = 0; i < nx; i++) rt.b[j * nx + i] = -sgn * o.A * rt.g * Math.tanh((z - eta[i]) / o.delta)
  }
  record(rt)
  return rt
}

/** ∇²ψ = −ω with ψ = 0 on the walls. Rows are packed two at a time into one complex FFT. */
export function solvePoisson(rt: RT, om: Float64Array): void {
  const { nx, nz, fft: F, bufRe: re, bufIm: im, specRe: SR, specIm: SI } = rt
  const mh = nx / 2 + 1
  // forward transforms of rows 1..nz−1 (the right-hand side is −ω)
  for (let j = 1; j < nz; j += 2) {
    const j2 = j + 1 < nz ? j + 1 : -1
    for (let i = 0; i < nx; i++) {
      re[i] = -om[j * nx + i]
      im[i] = j2 > 0 ? -om[j2 * nx + i] : 0
    }
    fft(F, re, im, -1)
    for (let m = 0; m < mh; m++) {
      const mm = (nx - m) % nx
      // A_m = (Z_m + conj Z_{N−m})/2 ; B_m = (Z_m − conj Z_{N−m})/(2i)
      SR[j * mh + m] = 0.5 * (re[m] + re[mm])
      SI[j * mh + m] = 0.5 * (im[m] - im[mm])
      if (j2 > 0) {
        SR[j2 * mh + m] = 0.5 * (im[m] + im[mm])
        SI[j2 * mh + m] = -0.5 * (re[m] - re[mm])
      }
    }
  }
  // tridiagonal solve in z for each mode (real and imaginary parts separately)
  const a = 1 / (rt.dz * rt.dz)
  const n = nz - 1
  for (let m = 0; m < mh; m++) {
    const cp = rt.cp[m]
    const iv = rt.inv[m]
    let pr = 0
    let pi = 0
    for (let jj = 0; jj < n; jj++) {
      const idx = (jj + 1) * mh + m
      pr = (SR[idx] - a * pr) * iv[jj]
      pi = (SI[idx] - a * pi) * iv[jj]
      SR[idx] = pr
      SI[idx] = pi
    }
    for (let jj = n - 2; jj >= 0; jj--) {
      const idx = (jj + 1) * mh + m
      SR[idx] -= cp[jj] * SR[idx + mh]
      SI[idx] -= cp[jj] * SI[idx + mh]
    }
  }
  // inverse transforms, two rows at a time: Z = A + iB
  const psi = rt.psi
  for (let j = 1; j < nz; j += 2) {
    const j2 = j + 1 < nz ? j + 1 : -1
    for (let m = 0; m < mh; m++) {
      const ar = SR[j * mh + m]
      const ai = SI[j * mh + m]
      const br = j2 > 0 ? SR[j2 * mh + m] : 0
      const bi = j2 > 0 ? SI[j2 * mh + m] : 0
      re[m] = ar - bi
      im[m] = ai + br
      if (m > 0 && m < nx - m) {
        // conj(A) + i conj(B)
        re[nx - m] = ar + bi
        im[nx - m] = -ai + br
      }
    }
    fft(F, re, im, 1)
    for (let i = 0; i < nx; i++) {
      psi[j * nx + i] = re[i] / nx
      if (j2 > 0) psi[j2 * nx + i] = im[i] / nx
    }
  }
  for (let i = 0; i < nx; i++) {
    psi[i] = 0
    psi[nz * nx + i] = 0
  }
}

function velocities(rt: RT): void {
  const { nx, nz, dx, dz, psi, u, w } = rt
  for (let j = 0; j <= nz; j++) {
    const r = j * nx
    for (let i = 0; i < nx; i++) {
      const ip = i === nx - 1 ? 0 : i + 1
      const im = i === 0 ? nx - 1 : i - 1
      if (j === 0) u[r + i] = psi[nx + i] / dz // ψ odd about the wall
      else if (j === nz) u[r + i] = -psi[(nz - 1) * nx + i] / dz
      else u[r + i] = (psi[r + nx + i] - psi[r - nx + i]) / (2 * dz)
      w[r + i] = j === 0 || j === nz ? 0 : -(psi[r + ip] - psi[r + im]) / (2 * dx)
    }
  }
}

/** Copy a field into a buffer with two ghost rows at each wall: odd (ω, ψ) or even (b) reflection. */
function pad(rt: RT, src: Float64Array, dst: Float64Array, odd: boolean): void {
  const { nx, nz } = rt
  dst.set(src, 2 * nx)
  const s = odd ? -1 : 1
  for (let g = 1; g <= 2; g++) {
    for (let i = 0; i < nx; i++) {
      dst[(2 - g) * nx + i] = s * src[g * nx + i]
      dst[(nz + 2 + g) * nx + i] = s * src[(nz - g) * nx + i]
    }
  }
}

/** Tendencies of ω and b for the current velocity field. */
function tendencies(rt: RT, om: Float64Array, b: Float64Array): void {
  solvePoisson(rt, om)
  velocities(rt)
  const { nx, nz, dx, dz, u, w, rom, rb, nu, pom, pb } = rt
  pad(rt, om, pom, true)
  pad(rt, b, pb, false)
  const i6dx = 1 / (6 * dx)
  const i6dz = 1 / (6 * dz)
  const i12dx = 1 / (12 * dx)
  const idx2 = 1 / (dx * dx)
  const idz2 = 1 / (dz * dz)
  for (let j = 0; j <= nz; j++) {
    const r = j * nx
    const p = r + 2 * nx // same row in the padded buffers
    const wall = j === 0 || j === nz
    for (let i = 0; i < nx; i++) {
      const i1 = i === nx - 1 ? 0 : i + 1
      const i2 = i1 === nx - 1 ? 0 : i1 + 1
      const m1 = i === 0 ? nx - 1 : i - 1
      const m2 = m1 === 0 ? nx - 1 : m1 - 1
      const uu = u[r + i]
      const ww = w[r + i]
      const bc = pb[p + i]
      // third-order upwind-biased advection
      const bx = uu > 0 ? (2 * pb[p + i1] + 3 * bc - 6 * pb[p + m1] + pb[p + m2]) * i6dx : (-pb[p + i2] + 6 * pb[p + i1] - 3 * bc - 2 * pb[p + m1]) * i6dx
      const bzd =
        ww > 0
          ? (2 * pb[p + nx + i] + 3 * bc - 6 * pb[p - nx + i] + pb[p - 2 * nx + i]) * i6dz
          : (-pb[p + 2 * nx + i] + 6 * pb[p + nx + i] - 3 * bc - 2 * pb[p - nx + i]) * i6dz
      rb[r + i] = -(uu * bx + ww * bzd)
      if (wall) {
        rom[r + i] = 0
        continue
      }
      const oc = pom[p + i]
      const ox = uu > 0 ? (2 * pom[p + i1] + 3 * oc - 6 * pom[p + m1] + pom[p + m2]) * i6dx : (-pom[p + i2] + 6 * pom[p + i1] - 3 * oc - 2 * pom[p + m1]) * i6dx
      const ozd =
        ww > 0
          ? (2 * pom[p + nx + i] + 3 * oc - 6 * pom[p - nx + i] + pom[p - 2 * nx + i]) * i6dz
          : (-pom[p + 2 * nx + i] + 6 * pom[p + nx + i] - 3 * oc - 2 * pom[p - nx + i]) * i6dz
      const dbdx = (-pb[p + i2] + 8 * pb[p + i1] - 8 * pb[p + m1] + pb[p + m2]) * i12dx
      const lap = (pom[p + i1] - 2 * oc + pom[p + m1]) * idx2 + (pom[p + nx + i] - 2 * oc + pom[p - nx + i]) * idz2
      rom[r + i] = -(uu * ox + ww * ozd) + dbdx + nu * lap
    }
  }
}

/** Largest stable time step (CFL on the current velocity, capped). */
export function rtTimeStep(rt: RT, cap = 0.02): number {
  let vmax = 1e-9
  for (let i = 0; i < rt.u.length; i++) {
    const s = Math.abs(rt.u[i]) + Math.abs(rt.w[i])
    if (s > vmax) vmax = s
  }
  return Math.min(cap, (0.6 * rt.dx) / vmax, (0.2 * rt.dx * rt.dx) / Math.max(rt.nu, 1e-12))
}

/** One SSP-RK3 step. */
export function stepRT(rt: RT, dt: number): void {
  const { om, b, om0, b0, rom, rb } = rt
  const N = om.length
  om0.set(om)
  b0.set(b)
  tendencies(rt, om, b)
  for (let i = 0; i < N; i++) {
    om[i] = om0[i] + dt * rom[i]
    b[i] = b0[i] + dt * rb[i]
  }
  tendencies(rt, om, b)
  for (let i = 0; i < N; i++) {
    om[i] = 0.75 * om0[i] + 0.25 * (om[i] + dt * rom[i])
    b[i] = 0.75 * b0[i] + 0.25 * (b[i] + dt * rb[i])
  }
  tendencies(rt, om, b)
  for (let i = 0; i < N; i++) {
    om[i] = om0[i] / 3 + (2 / 3) * (om[i] + dt * rom[i])
    b[i] = b0[i] / 3 + (2 / 3) * (b[i] + dt * rb[i])
  }
  // b is only advected, so exactly it stays within its initial bounds ±gA. The third-order upwind
  // scheme is not monotone and overshoots at the steepened interface (by tens of percent late in the
  // run), which would add spurious buoyancy; clip back to the physical range.
  const bLim = rt.A * rt.g
  for (let i = 0; i < N; i++) {
    if (b[i] > bLim) b[i] = bLim
    else if (b[i] < -bLim) b[i] = -bLim
  }
  rt.t += dt
  solvePoisson(rt, om)
  velocities(rt)
  record(rt)
}

/** Amplitude of the seeded Fourier mode of the vertical velocity, rms over the height. */
export function modeAmplitude(rt: RT): number {
  const { nx, nz, w, cosT, sinT } = rt
  let s = 0
  for (let j = 1; j < nz; j++) {
    let cr = 0
    let ci = 0
    const r = j * nx
    for (let i = 0; i < nx; i++) {
      cr += w[r + i] * cosT[i]
      ci += w[r + i] * sinT[i]
    }
    s += cr * cr + ci * ci
  }
  return (2 / nx) * Math.sqrt(s / (nz - 1))
}

/** Vertical velocity of the seeded mode at the interface height (linear phase: dη/dt = w). */
function interfaceW(rt: RT): number {
  const { nx, nz, w, cosT, sinT } = rt
  const r = (nz / 2) * nx
  let cr = 0
  let ci = 0
  for (let i = 0; i < nx; i++) {
    cr += w[r + i] * cosT[i]
    ci += w[r + i] * sinT[i]
  }
  return (2 / nx) * Math.hypot(cr, ci)
}

/**
 * Largest interface slope over all Fourier modes. The interface displacement of each column follows from
 * the buoyancy it has gained: η(x) = ∫(b − b̄)dz / (2gA) for heavy on top (exact for a shifted profile).
 * A single mode η₀cos kx has maximum slope kη₀, so this generalizes the kη criterion to the seed noise.
 */
function maxSlope(rt: RT): number {
  const { nx, nz, b, bBar, etaX, dz, dx } = rt
  const c = (rt.flip * dz) / (2 * rt.g * rt.A)
  etaX.fill(0)
  for (let j = 1; j < nz; j++) {
    const r = j * nx
    const bb = bBar[j]
    for (let i = 0; i < nx; i++) etaX[i] += b[r + i] - bb
  }
  let m = 0
  for (let i = 0; i < nx; i++) {
    const ip = i === nx - 1 ? 0 : i + 1
    const im = i === 0 ? nx - 1 : i - 1
    m = Math.max(m, Math.abs(etaX[ip] - etaX[im]))
  }
  return (m * Math.abs(c)) / (2 * dx)
}

function record(rt: RT): void {
  rt.times.push(rt.t)
  rt.amps.push(modeAmplitude(rt))
  const s = rtDiffuse(rt.A, rt.g, rt.k, rt.delta)
  rt.etas.push(interfaceW(rt) / Math.max(s, 1e-6))
  rt.slopes.push(maxSlope(rt))
}

/** Interface slope at which the seed noise is clearly nonlinear (fingers forming) and the fit must stop. */
const SLOPE_MAX = 2

/**
 * Growth rate measured from the simulation: least-squares slope of ln(amplitude) over the linear
 * phase, from after the start-up transient (t > 2.5/σ, when the decaying partner of the mode has died away)
 * until the interface displacement reaches kη = 0.4, or until some part of the interface (a faster-growing
 * noise mode) is so steep (slope > 2) that its nonlinear coupling contaminates the seeded mode. With 10%
 * seed noise at m = 1 and low viscosity the noise wins this race and the fit, otherwise 25–50% low, is
 * abandoned.
 * Returns null until there is enough of a window; `noisy` flags a window cut short by the noise.
 */
export function measuredGrowth(rt: RT): { sigma: number; done: boolean; noisy?: boolean } | null {
  const s0 = rtDiffuse(rt.A, rt.g, rt.k, rt.delta)
  const t0 = 2.5 / s0
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0
  let done = false
  let noisy = false
  for (let i = 0; i < rt.times.length; i++) {
    const t = rt.times[i]
    if (rt.k * rt.etas[i] > 0.4 || rt.slopes[i] > SLOPE_MAX) {
      done = true
      noisy = rt.k * rt.etas[i] < 0.2
      break
    }
    if (t < t0 || rt.amps[i] <= 0) continue
    const y = Math.log(rt.amps[i])
    sx += t
    sy += y
    sxx += t * t
    sxy += t * y
    n++
  }
  if (n < 8) return done && noisy ? { sigma: NaN, done, noisy } : null
  const den = n * sxx - sx * sx
  if (den <= 0) return null
  const tspan = Math.sqrt(den) / n
  if (tspan * s0 < 0.25) return done && noisy ? { sigma: NaN, done, noisy } : null
  return { sigma: (n * sxy - sx * sy) / den, done, noisy }
}
