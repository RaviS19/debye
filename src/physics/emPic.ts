// B9: a one-dimensional electromagnetic particle-in-cell (PIC) code, the kind of code Kruer Ch. 2 describes.
//
// Normalized units: the laser frequency ω0 = 1 and c = 1, so times are in 1/ω0 and lengths in c/ω0 = λ0/2π.
// Densities are in units of the critical density n_c, so ω_pe² = n/n_c. Fields are a = eE/(m_e c ω0) for
// E and eB/(m_e ω0) for B; momenta are u = p/(m_e c) = γv/c; the vector potential is a_y = eA_y/(m_e c). For
// a laser, the peak of a_y is a0 = v_os/c = eE0/(m_e ω0 c) (Kruer's v_os, divided by c).
//
// Electrons only: each macro-particle carries charge −w and mass w (w = its share of n Δx), so q/m = −1 and
// every macro-particle follows exactly the orbit of a real electron. Ions are a fixed neutralizing
// background, placed where the electrons start, so the plasma is exactly neutral at t = 0.
//
//   Gauss    ∂E_x/∂x = n_i − n_e           (not solved: kept true by the charge-conserving current)
//   Ampère   ∂E_x/∂t = −J_x,               J = −Σ w v S(x − x_p)/Δx
//   Light    (∂t ± ∂x) F± = −J_y/2,         F± = (E_y ± B_z)/2
//   Push     du/dt = −(E + v × B),          relativistic Boris
//
// F₊ is light moving to +x and F₋ light moving to −x. With Δt = Δx (c = 1) each is shifted exactly one cell
// per step along its characteristic, so the light needs no field solve and has no numerical dispersion in
// vacuum. With open boundaries the laser is fed in as F₊ at x = 0, and whatever arrives at an edge leaves.
//
// Grid: nodes x_j = jΔx carry F±, E_y, B_z and the ion density; faces (j + ½)Δx carry E_x, J_x and J_y.
// Shapes are linear (cloud-in-cell). E_x is averaged from faces to nodes before it is interpolated, which
// makes the electrostatic force momentum-conserving (no particle pushes on itself).
import { mulberry32 } from './randomwalk'
import { normalize } from './parametric'
import { dampedGrowth, epwDamping, srsGrowth } from './srsSbs'

export const MEC2_KEV = 510.99895 // electron rest energy, keV

/** Thermal speed v_te/c = √(kT_e/m_e c²) for T_e in keV. */
export const vteOf = (TeKeV: number) => Math.sqrt(TeKeV / MEC2_KEV)

export interface Slab {
  x0: number // start of the up-ramp
  x1: number // end of the down-ramp
  ramp: number // ramp length (linear ramps at both ends)
  n: number // plateau density, n/n_c
}

/** Density n/n_c of a slab with linear ramps. */
export function slabDensity(s: Slab, x: number): number {
  if (x <= s.x0 || x >= s.x1) return 0
  const r = Math.max(1e-9, s.ramp)
  return s.n * Math.min(1, (x - s.x0) / r, (s.x1 - x) / r)
}

export interface EmPicOptions {
  nx: number // number of cells
  dx: number // cell size; the time step is dt = dx (c = 1)
  periodic?: boolean // periodic box (tests) or open boundaries (laser into a slab)
  density: (x: number) => number // electron density n/n_c
  ppc: number // macro-particles per cell wherever n > 0
  TeKeV: number // electron temperature (Maxwellian in u_x and u_y)
  seed?: number
  /** Incoming laser E_y at x = 0 (open boundaries only), as a function of time. */
  laser?: (t: number) => number
  /** Periodic only: initial travelling light wave E_y = a cos(kx) moving to +x (a pump), frequency from the
   *  plasma dispersion relation. */
  pump?: { a: number; k: number }
  /** Particles are absorbed at these positions (open boundaries). Default: two cells inside the edges. */
  absorbAt?: [number, number]
  /** Initial sinusoidal displacement of the electrons, δx = amp sin(2π mode x / L) (tests). */
  displace?: { amp: number; mode: number }
  /** Cold electrons: drop the thermal spread entirely (tests). */
  cold?: boolean
  /** Samples of the boundary fields are stored every `dec` steps (default 4). */
  dec?: number
}

export interface EmPic {
  nx: number
  dx: number
  dt: number
  L: number
  periodic: boolean
  t: number
  steps: number
  // fields (nodes: nx + 1 open, nx periodic; faces: nx)
  fp: Float64Array
  fm: Float64Array
  ex: Float64Array
  ay: Float64Array // a_y = eA_y/(m c) on nodes, from ∂A/∂t = −E (diagnostic)
  ayPrev: Float64Array // a_y one step earlier
  jxP: Float64Array // J_x on faces, face f at index f + 1 (one spare face each side)
  jyP: Float64Array // J_y likewise
  rhoI: Float64Array // fixed ion density on nodes
  nodeF: Float64Array // scratch: (E_x, E_y, B_z) interleaved on the nodes, for the gather
  // particles
  np: number
  x: Float64Array
  ux: Float64Array
  uy: Float64Array
  w: Float64Array
  py0: Float64Array // initial canonical momentum u_y − a_y (conserved in 1D)
  alive: Uint8Array
  xa: number
  xb: number
  // laser and diagnostics
  laser: ((t: number) => number) | null
  dec: number
  ring: number // ring-buffer length
  inL: Float64Array // F₊ at x = 0 (incident), every dec steps
  outL: Float64Array // F₋ at x = 0 (reflected)
  outR: Float64Array // F₊ at x = L (transmitted)
  nSamples: number
  escaped: number[] // kinetic energies (m c² units) of absorbed electrons
  escapedW: number[] // their weights
  vte: number
  n0: number // a reference density (the maximum of the profile)
}

function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-300)) * Math.cos(2 * Math.PI * rand())
}

export function createEmPic(o: EmPicOptions): EmPic {
  const nx = o.nx
  const dx = o.dx
  const L = nx * dx
  const periodic = !!o.periodic
  const nn = periodic ? nx : nx + 1
  const rand = mulberry32(o.seed ?? 12345)
  const vte = o.cold ? 0 : vteOf(o.TeKeV)
  const [xa, xb] = periodic ? [0, L] : (o.absorbAt ?? [2 * dx, L - 2 * dx])
  // quiet start: ppc evenly spaced particles in every cell with n > 0, weights proportional to n
  const xs: number[] = []
  const ws: number[] = []
  let n0 = 0
  for (let c = 0; c < nx; c++) {
    for (let k = 0; k < o.ppc; k++) {
      const x = (c + (k + 0.5) / o.ppc) * dx
      if (!periodic && (x <= xa || x >= xb)) continue
      const n = o.density(x)
      if (n <= 0) continue
      n0 = Math.max(n0, n)
      xs.push(x)
      ws.push((n * dx) / o.ppc)
    }
  }
  const np = xs.length
  const s: EmPic = {
    nx,
    dx,
    dt: dx,
    L,
    periodic,
    t: 0,
    steps: 0,
    fp: new Float64Array(nn),
    fm: new Float64Array(nn),
    ex: new Float64Array(nx),
    ay: new Float64Array(nn),
    ayPrev: new Float64Array(nn),
    jxP: new Float64Array(nx + 3),
    jyP: new Float64Array(nx + 3),
    rhoI: new Float64Array(nn),
    nodeF: new Float64Array(3 * nn + 3),
    np,
    x: new Float64Array(xs),
    ux: new Float64Array(np),
    uy: new Float64Array(np),
    w: new Float64Array(ws),
    py0: new Float64Array(np),
    alive: new Uint8Array(np).fill(1),
    xa,
    xb,
    laser: o.laser ?? null,
    dec: o.dec ?? 4,
    ring: 8192,
    inL: new Float64Array(8192),
    outL: new Float64Array(8192),
    outR: new Float64Array(8192),
    nSamples: 0,
    escaped: [],
    escapedW: [],
    vte,
    n0,
  }
  // fixed ions where the electrons start (before any displacement): exact neutrality
  depositDensity(s, s.rhoI, 1)
  if (o.displace) {
    const kx = (2 * Math.PI * o.displace.mode) / L
    for (let i = 0; i < np; i++) s.x[i] = wrap(s.x[i] + o.displace.amp * Math.sin(kx * s.x[i]), L)
    // Gauss's law for the displaced electrons: E_x = ∫ρ dx (zero mean in a periodic box)
    gaussField(s)
  }
  for (let i = 0; i < np; i++) {
    s.ux[i] = vte * gauss(rand)
    s.uy[i] = vte * gauss(rand)
    s.py0[i] = s.uy[i]
  }
  if (o.pump && periodic) {
    // E_y = a cos(kx − ωt), B_z = (k/ω) E_y, a_y = (a/ω) sin(kx − ωt); electrons carry u_y = a_y + thermal
    // (canonical momentum), set at t = −dt/2 for the leapfrog
    const { a, k } = o.pump
    const w = emOmegaNumerical(k, n0, dx)
    for (let j = 0; j < nn; j++) {
      const xj = j * dx
      const ey = a * Math.cos(k * xj)
      const bz = (k / w) * ey
      s.fp[j] = 0.5 * (ey + bz)
      s.fm[j] = 0.5 * (ey - bz)
      s.ay[j] = (a / w) * Math.sin(k * xj)
    }
    for (let i = 0; i < np; i++) s.uy[i] += (a / w) * Math.sin(k * s.x[i] + (w * s.dt) / 2)
  }
  // stagger the momenta back half a step in the initial E_x (only nonzero after a displacement)
  if (o.displace) {
    nodeFields(s)
    const exN = new Float64Array(s.fp.length)
    for (let j = 0; j < exN.length; j++) exN[j] = s.nodeF[3 * j]
    for (let i = 0; i < np; i++) s.ux[i] += 0.5 * s.dt * gatherNode(s, exN, s.x[i])
  }
  return s
}

function wrap(x: number, L: number) {
  x %= L
  return x < 0 ? x + L : x
}

/** Cloud-in-cell deposit of the electron density (sign = +1) onto nodes, added to `out` after clearing it. */
function depositDensity(s: EmPic, out: Float64Array, sign: number): void {
  out.fill(0)
  const idx = 1 / s.dx
  const nn = out.length
  for (let i = 0; i < s.np; i++) {
    const q = s.x[i] * idx
    let j = Math.floor(q)
    const f = q - j
    const c = (sign * s.w[i]) * idx
    if (j >= nn) j -= nn
    let j1 = j + 1
    if (j1 >= nn) j1 = s.periodic ? j1 - nn : nn - 1
    out[j] += c * (1 - f)
    out[j1] += c * f
  }
}

/** Charge density n_i − n_e on the nodes. */
export function chargeDensity(s: EmPic): Float64Array {
  const rho = new Float64Array(s.rhoI.length)
  depositDensity(s, rho, -1)
  for (let j = 0; j < rho.length; j++) rho[j] += s.rhoI[j]
  return rho
}

/** Solve Gauss's law directly for E_x (used only to set up a displaced start in a periodic box). */
function gaussField(s: EmPic): void {
  const rho = chargeDensity(s)
  // face j lies between nodes j and j + 1, so E_j − E_{j−1} = ρ_j Δx
  let acc = 0
  let mean = 0
  for (let j = 0; j < s.nx; j++) {
    acc += rho[j] * s.dx
    s.ex[j] = acc
    mean += acc
  }
  mean /= s.nx
  for (let j = 0; j < s.nx; j++) s.ex[j] -= mean // zero-mean field
}

/** E_x (averaged from the faces), E_y and B_z on the nodes, interleaved for the gather. For a periodic box the
 *  first node is repeated at the end, so the gather never wraps. */
function nodeFields(s: EmPic): void {
  const { fp, fm, ex, nodeF, nx } = s
  const nn = fp.length
  for (let j = 0; j < nn; j++) {
    const left = j === 0 ? (s.periodic ? ex[nx - 1] : 0) : ex[j - 1]
    const right = j < nx ? ex[j] : 0
    nodeF[3 * j] = 0.5 * (left + right)
    nodeF[3 * j + 1] = fp[j] + fm[j]
    nodeF[3 * j + 2] = fp[j] - fm[j]
  }
  if (s.periodic) {
    nodeF[3 * nn] = nodeF[0]
    nodeF[3 * nn + 1] = nodeF[1]
    nodeF[3 * nn + 2] = nodeF[2]
  }
}

/** Linear interpolation of a node array at x. */
function gatherNode(s: EmPic, f: Float64Array, x: number): number {
  const q = x / s.dx
  let j = Math.floor(q)
  const a = q - j
  const nn = f.length
  if (j >= nn) j -= nn
  let j1 = j + 1
  if (j1 >= nn) j1 = s.periodic ? 0 : nn - 1
  return f[j] * (1 - a) + f[j1] * a
}

/** Advance by `steps` time steps. */
export function stepEmPic(s: EmPic, steps = 1): void {
  for (let k = 0; k < steps; k++) step(s)
}

function step(s: EmPic): void {
  const { nx, dt, x, ux, uy, w, alive, jxP, jyP, nodeF } = s
  const idx = 1 / s.dx
  const per = s.periodic
  const L = s.L
  const xa = s.xa
  const xb = s.xb
  const np = s.np
  const h = -0.5 * dt // (q/m) dt/2 with q/m = −1
  const cx = 1 / dt
  nodeFields(s)
  jxP.fill(0)
  jyP.fill(0)
  // jxP and jyP hold face f at index f + 1, with one spare face on each side (folded back below)
  for (let i = 0; i < np; i++) {
    if (alive[i] === 0) continue
    const x0 = x[i]
    // gather E_x, E_y, B_z at x^n (linear weights)
    const q = x0 * idx
    const j = q | 0
    const a = q - j
    const b = 1 - a
    const k3 = 3 * j
    const Ex = nodeF[k3] * b + nodeF[k3 + 3] * a
    const Ey = nodeF[k3 + 1] * b + nodeF[k3 + 4] * a
    const Bz = nodeF[k3 + 2] * b + nodeF[k3 + 5] * a
    // relativistic Boris: half kick, rotation about z, half kick
    const umx = ux[i] + h * Ex
    const umy = uy[i] + h * Ey
    const tz = (h * Bz) / Math.sqrt(1 + umx * umx + umy * umy)
    const upx = umx + umy * tz
    const upy = umy - umx * tz
    const sz = (2 * tz) / (1 + tz * tz)
    const nux = umx + upy * sz + h * Ex
    const nuy = umy - upx * sz + h * Ey
    ux[i] = nux
    uy[i] = nuy
    const ig = 1 / Math.sqrt(1 + nux * nux + nuy * nuy)
    let x1 = x0 + dt * nux * ig
    let dead = false
    if (!per && (x1 <= xa || x1 >= xb)) {
      // absorbed: deposit the path up to the boundary, then freeze the charge there
      x1 = x1 <= xa ? xa : xb
      dead = true
    }
    // transverse current at the half step, x^{n+1/2}, onto the faces
    const qh = 0.5 * (x0 + x1) * idx - 0.5
    const jh = qh >= 0 ? qh | 0 : -1
    const ah = qh - jh
    const cy = -w[i] * nuy * ig * idx
    jyP[jh + 1] += cy * (1 - ah)
    jyP[jh + 2] += cy * ah
    // charge-conserving longitudinal current: split the path at the node it crosses (|Δx| < Δx)
    const s1 = x1 * idx
    const j1 = s1 >= 0 ? s1 | 0 : -1
    const c = w[i] * cx
    if (j1 === j) jxP[j + 1] += c * (q - s1)
    else if (j1 > j) {
      jxP[j + 1] += c * (q - j1)
      jxP[j1 + 1] += c * (j1 - s1)
    } else {
      jxP[j + 1] += c * (q - j)
      jxP[j1 + 1] += c * (j - s1)
    }
    if (dead) {
      alive[i] = 0
      ux[i] = 0
      uy[i] = 0
      s.escaped.push(1 / ig - 1)
      s.escapedW.push(w[i])
    } else if (per) {
      x1 = x1 >= L ? x1 - L : x1 < 0 ? x1 + L : x1
    }
    x[i] = x1
  }
  if (per) {
    // fold the spare faces: face −1 is face nx − 1, face nx is face 0
    jxP[nx] += jxP[0]
    jxP[1] += jxP[nx + 1]
    jxP[2] += jxP[nx + 2]
    jyP[nx] += jyP[0]
    jyP[1] += jyP[nx + 1]
  }
  // fields: Ampère for E_x, characteristics for F±, A_y for the canonical-momentum check
  const { ex, fp, fm, ay } = s
  for (let f = 0; f < nx; f++) ex[f] -= dt * jxP[f + 1]
  const hh = 0.5 * dt
  const tNew = s.t + dt
  if (per) {
    const lastP = fp[nx - 1] - hh * jyP[nx]
    for (let jn = nx - 1; jn > 0; jn--) fp[jn] = fp[jn - 1] - hh * jyP[jn]
    fp[0] = lastP
    const firstM = fm[0] - hh * jyP[1]
    for (let jn = 0; jn < nx - 1; jn++) fm[jn] = fm[jn + 1] - hh * jyP[jn + 1]
    fm[nx - 1] = firstM
  } else {
    for (let jn = nx; jn > 0; jn--) fp[jn] = fp[jn - 1] - hh * jyP[jn]
    fp[0] = s.laser ? s.laser(tNew) : 0
    for (let jn = 0; jn < nx; jn++) fm[jn] = fm[jn + 1] - hh * jyP[jn + 1]
    fm[nx] = 0
  }
  s.ayPrev.set(ay)
  const nn = fp.length
  for (let jn = 0; jn < nn; jn++) ay[jn] -= hh * (nodeF[3 * jn + 1] + fp[jn] + fm[jn])
  s.t = tNew
  s.steps++
  if (s.steps % s.dec === 0) {
    const r = s.nSamples % s.ring
    s.inL[r] = fp[0]
    s.outL[r] = fm[0]
    s.outR[r] = fp[nn - 1]
    s.nSamples++
  }
}

// ---------- diagnostics ----------

/** Largest violation of Gauss's law, max_j |(E_{j+½} − E_{j−½})/Δx − ρ_j|, over nodes away from the edges. */
export function gaussError(s: EmPic): { err: number; scale: number } {
  const rho = chargeDensity(s)
  let err = 0
  let scale = 0
  const j0 = s.periodic ? 0 : 1
  const j1 = s.periodic ? s.nx : s.nx
  for (let j = j0; j < j1; j++) {
    const left = j === 0 ? s.ex[s.nx - 1] : s.ex[j - 1]
    const div = (s.ex[j] - left) / s.dx
    err = Math.max(err, Math.abs(div - rho[j]))
    scale = Math.max(scale, Math.abs(rho[j]), Math.abs(div))
  }
  return { err, scale }
}

/**
 * Transverse canonical momentum: in 1D, p_y + qA_y = p_y − eA_y is constant for every electron, so
 * u_y − a_y(x) should keep its initial value. u_y lives at half steps, so it is compared with a_y at the
 * half step (the mean of the last two grid values) at the particle's half-step position. Returns the largest
 * deviation over live particles.
 */
export function canonicalError(s: EmPic): number {
  let err = 0
  for (let i = 0; i < s.np; i++) {
    if (!s.alive[i]) continue
    const ig = 1 / Math.sqrt(1 + s.ux[i] * s.ux[i] + s.uy[i] * s.uy[i])
    let xh = s.x[i] - 0.5 * s.dt * s.ux[i] * ig
    if (s.periodic) xh = wrap(xh, s.L)
    const ay = 0.5 * (gatherNode(s, s.ay, xh) + gatherNode(s, s.ayPrev, xh))
    err = Math.max(err, Math.abs(s.uy[i] - ay - s.py0[i]))
  }
  return err
}

/** Energies (per unit area, in n_c m c² (c/ω0) units): longitudinal field, transverse field, particle kinetic. */
export function energies(s: EmPic): { ex: number; em: number; kin: number } {
  let ex = 0
  for (let f = 0; f < s.nx; f++) ex += 0.5 * s.ex[f] * s.ex[f]
  let em = 0
  for (let j = 0; j < s.fp.length; j++) em += s.fp[j] * s.fp[j] + s.fm[j] * s.fm[j] // (E² + B²)/2
  let kin = 0
  for (let i = 0; i < s.np; i++) if (s.alive[i]) kin += s.w[i] * (Math.sqrt(1 + s.ux[i] * s.ux[i] + s.uy[i] * s.uy[i]) - 1)
  return { ex: ex * s.dx, em: em * s.dx, kin }
}

/** Mean of u_x² over live particles (the x temperature in units of m c², when there is no drift). */
export function meanUx2(s: EmPic): number {
  let a = 0
  let wsum = 0
  for (let i = 0; i < s.np; i++) {
    if (!s.alive[i]) continue
    a += s.w[i] * s.ux[i] * s.ux[i]
    wsum += s.w[i]
  }
  return a / wsum
}

/** Complex amplitude of Fourier mode m of a face or node array over a periodic box: (2/N) Σ f e^{−2πimj/N}. */
export function modeOf(f: Float64Array, m: number, n = f.length): [number, number] {
  let re = 0
  let im = 0
  const th = (2 * Math.PI * m) / n
  for (let j = 0; j < n; j++) {
    re += f[j] * Math.cos(th * j)
    im -= f[j] * Math.sin(th * j)
  }
  return [(2 * re) / n, (2 * im) / n]
}

/** In-place radix-2 FFT (n a power of 2). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k + len / 2] = re[i + k] - ar
        im[i + k + len / 2] = im[i + k] - ai
        re[i + k] += ar
        im[i + k] += ai
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}

/**
 * Power spectrum of the last `n` samples (a power of 2) of a boundary time series (outL, inL or outR), with
 * a Hann window. Returns ω (units of ω0) and power for ω from 0 to the Nyquist frequency. Null until there
 * are enough samples.
 */
export function spectrumOf(s: EmPic, series: Float64Array, n: number): { omega: Float64Array; power: Float64Array } | null {
  if (s.nSamples < n || n > s.ring) return null
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const r = (s.nSamples - n + i) % s.ring
    re[i] = series[r] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)))
  }
  fft(re, im)
  const dts = s.dt * s.dec
  const half = n / 2
  const omega = new Float64Array(half)
  const power = new Float64Array(half)
  for (let k = 0; k < half; k++) {
    omega[k] = (2 * Math.PI * k) / (n * dts)
    power[k] = re[k] * re[k] + im[k] * im[k]
  }
  return { omega, power }
}

/** Frequency of the strongest peak of a spectrum within [w0, w1], refined by a parabola through the top three bins. */
export function peakFrequency(sp: { omega: Float64Array; power: Float64Array }, w0: number, w1: number): number {
  let best = -1
  for (let k = 1; k < sp.omega.length - 1; k++) {
    if (sp.omega[k] < w0 || sp.omega[k] > w1) continue
    if (best < 0 || sp.power[k] > sp.power[best]) best = k
  }
  if (best < 1) return NaN
  const y0 = Math.log(sp.power[best - 1] + 1e-300)
  const y1 = Math.log(sp.power[best] + 1e-300)
  const y2 = Math.log(sp.power[best + 1] + 1e-300)
  const den = y0 - 2 * y1 + y2
  const off = den !== 0 ? (0.5 * (y0 - y2)) / den : 0
  return sp.omega[best] + off * (sp.omega[1] - sp.omega[0])
}

/** Mean of a boundary series' square over its last `m` samples. */
export function meanSquare(s: EmPic, series: Float64Array, m: number): number {
  const k = Math.min(m, s.nSamples, s.ring)
  if (k === 0) return 0
  let a = 0
  for (let i = 0; i < k; i++) {
    const r = (s.nSamples - 1 - i) % s.ring
    a += series[r] * series[r]
  }
  return a / k
}

// ---------- theory ----------

/** Laser with a smooth sin² rise: E_y(t) = a0 env(t) sin(t) (ω0 = 1). */
export function laserDrive(a0: number, rise = 30): (t: number) => number {
  return (t) => {
    if (t <= 0) return 0
    const env = t < rise ? Math.sin((Math.PI * t) / (2 * rise)) ** 2 : 1
    return a0 * env * Math.sin(t)
  }
}

/** Frequency of light of wavenumber k in a uniform cold plasma for this code (Δt = Δx):
 *  sin²(ωΔ/2) = sin²(kΔ/2) + (n Δ²/4) cos(kΔ/2), which tends to ω² = n + k² as Δ → 0. */
export function emOmegaNumerical(k: number, n: number, dx: number): number {
  const s2 = Math.sin((k * dx) / 2) ** 2 + ((n * dx * dx) / 4) * Math.cos((k * dx) / 2)
  return (2 / dx) * Math.asin(Math.min(1, Math.sqrt(s2)))
}

/** Leapfrog plasma oscillation: the code's frequency over ω_pe, (2/ω_peΔt) asin(ω_peΔt/2). NaN above 2 (unstable). */
export function leapfrogRatio(wpdt: number): number {
  if (wpdt <= 0) return 1
  if (wpdt > 2) return NaN
  return (2 / wpdt) * Math.asin(wpdt / 2)
}

/** Above ω_peΔt = 2 the leapfrog oscillation grows by a factor |λ| per step; returns the growth rate per ω_pe⁻¹. */
export function leapfrogGrowth(wpdt: number): number {
  if (wpdt <= 2) return 0
  const b = wpdt * wpdt - 2
  const lam = (b + Math.sqrt(b * b - 4)) / 2
  return Math.log(lam) / wpdt
}

/** Yee FDTD in vacuum with Courant number ν = cΔt/Δx: the numerical phase speed ω/(ck) for kΔx. */
export function yeePhaseSpeed(kdx: number, courant: number): number {
  const w = 2 * Math.asin(Math.min(1, courant * Math.sin(kdx / 2))) // ωΔt
  return w / (courant * kdx)
}

/** Yee FDTD in vacuum: the numerical group velocity dω/dk over c, cos(kΔx/2)/√(1 − ν² sin²(kΔx/2)). */
export function yeeGroupVelocity(kdx: number, courant: number): number {
  const s = Math.sin(kdx / 2)
  return Math.cos(kdx / 2) / Math.sqrt(1 - courant * courant * s * s)
}

/**
 * Thermal fluctuation energy of E_x relative to the electrons' x kinetic energy, W_E/W_K, in a 1D code with ppc
 * particles per cell and cell size Δx = r λ_De. Each Fourier mode up to the grid limit k = π/Δx holds, by the
 * fluctuation–dissipation theorem, (T/2)(1 − 1/ε) = (T/2) S²/(k²λ_D² + S²), where S(k) = sinc²(kΔx/2) is the
 * cloud-in-cell shape factor (S = 1 for point particles). Summing the modes,
 *   W_E/W_K = (1/π ppc) ∫₀^π S²/(u²/r² + S²) du,  u = kΔx,
 * which for point particles is (r/π) atan(π/r)/ppc, and 1/(2N_λ) when Δx ≪ λ_D, with N_λ = ppc/r particles
 * per Debye length. Either way it falls as 1/ppc: the field noise amplitude falls as 1/√ppc.
 */
export function noiseRatio(ppc: number, r: number, shaped = true): number {
  if (!shaped) return ((r / Math.PI) * Math.atan(Math.PI / r)) / ppc
  const n = 200 // Simpson
  let acc = 0
  for (let i = 0; i <= n; i++) {
    const u = (Math.PI * i) / n
    const h = u / 2
    const S = h === 0 ? 1 : (Math.sin(h) / h) ** 2
    const f = (S * S) / ((u * u) / (r * r) + S * S)
    acc += f * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2)
  }
  return (acc * (Math.PI / n)) / 3 / (Math.PI * ppc)
}

/**
 * A periodic box for a homogeneous SRS test: m pump wavelengths long (k0 = √(1 − n) fits exactly), with m chosen
 * in [m0, m1] so that a box mode p lies closest to the matched plasma-wave wavenumber. Returns the box length,
 * m, p and the detuning Δk = |2πp/L − k|.
 */
export function srsPeriodicBox(nn: number, TeKeV: number, m0 = 8, m1 = 30): { L: number; m: number; p: number; dk: number } | null {
  const pr = srsPrediction(nn, TeKeV, 0.01, true)
  if (!pr) return null
  const k0 = Math.sqrt(1 - nn)
  let best = { L: 0, m: 0, p: 0, dk: Infinity }
  for (let m = m0; m <= m1; m++) {
    const L = (2 * Math.PI * m) / k0
    const p = Math.round((pr.k * L) / (2 * Math.PI))
    const dk = Math.abs((2 * Math.PI * p) / L - pr.k)
    if (dk < best.dk) best = { L, m, p, dk }
  }
  return best
}

export interface SrsPrediction {
  k: number // plasma-wave wavenumber (ω0/c)
  ks: number // backscattered light wavenumber
  wek: number // plasma-wave frequency (Bohm–Gross)
  ws: number // Raman (Stokes) frequency ω0 − ω_ek
  vphi: number // plasma-wave phase velocity / c
  klD: number
  gamma0: number // undamped growth rate (units of ω0)
  nu: number // Landau damping of the plasma wave (amplitude, units of ω0)
  gamma: number // net growth with that damping
  vos: number // quiver speed in the plasma (WKB), units of c
}

/** Homogeneous SRS backscatter for a laser of vacuum a0 = v_os/c in a plasma at n/n_c and T_e (keV), from
 *  B6's matching and growth-rate code. In the plasma the WKB amplitude is a0 (1 − n/n_c)^{−1/4}. */
export function srsPrediction(nn: number, TeKeV: number, a0: number, inPlasma = false): SrsPrediction | null {
  const N = normalize({ nn, TeKeV, TiKeV: TeKeV, Z: 1, A: 1 })
  const vos = inPlasma ? a0 : a0 * (1 - nn) ** -0.25
  const g = srsGrowth(N, vos)
  if (!g) return null
  const nu = epwDamping(g.klD) * Math.sqrt(nn)
  return { k: g.k, ks: g.ks, wek: g.w, ws: g.ws, vphi: g.w / g.k, klD: g.klD, gamma0: g.gamma0, nu, gamma: dampedGrowth(g.gamma0, nu), vos }
}

// ---------- Yee comparison for the vacuum-pulse test ----------

export interface YeePulse {
  n: number
  dx: number
  dt: number
  t: number
  E: Float64Array // nodes
  B: Float64Array // half nodes, half steps
}

/** A right-moving Gaussian pulse E_y = B_z = exp(−(x − x0)²/σ²) on a 1D Yee grid with Courant number ν. */
export function createYeePulse(n: number, dx: number, courant: number, x0: number, sigma: number, kc = 0): YeePulse {
  const dt = courant * dx
  const E = new Float64Array(n)
  const B = new Float64Array(n - 1)
  const g = (x: number) => Math.exp(-((x - x0) ** 2) / (sigma * sigma)) * (kc ? Math.cos(kc * (x - x0)) : 1)
  for (let i = 0; i < n; i++) E[i] = g(i * dx)
  for (let i = 0; i < n - 1; i++) B[i] = g((i + 0.5) * dx + 0.5 * dt) // B at t = −dt/2
  return { n, dx, dt, t: 0, E, B }
}

export function stepYee(y: YeePulse, steps = 1): void {
  const r = y.dt / y.dx
  for (let k = 0; k < steps; k++) {
    for (let i = 0; i < y.n - 1; i++) y.B[i] -= r * (y.E[i + 1] - y.E[i])
    for (let i = 1; i < y.n - 1; i++) y.E[i] -= r * (y.B[i] - y.B[i - 1])
    y.t += y.dt
  }
}
