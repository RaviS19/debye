// B7: filamentation and self-focusing of a laser beam in a plasma, from the paraxial wave equation with a
// steady-state ponderomotive density response.
//
// Physical model. The field E = Re[a(x, z) exp(i(k0 z − ω0 t))] obeys, for an envelope that varies slowly along z,
//     2 i k0 ∂a/∂z + ∇⊥²a + (ω0²/c²) δε a = 0,     δε = −δn/n_c,
// with k0 = (ω0/c)√(1 − n0/n_c). The plasma is in pressure balance with the light (isothermal electrons, the light on
// for longer than a sound crossing time of the structure), so the density is a Boltzmann factor in the ponderomotive
// potential U_p = e²|a|²/(4 m ω0²) = m v_os²/4:
//     n = n0 exp(−U_p/T*),      T* = T_e + T_i/Z.
// Linearized: δn/n0 = −U_p/T*. (The sims take cold ions, T* = T_e.)
//
// Normalized units: X = x ω_pe/c, Z = z ω_pe²/(2 k0 c²) and ψ with |ψ|² = U_p/T* (call it s). The equation becomes
//     i ∂ψ/∂Z + ∇⊥²ψ + N(s) ψ = 0,
// with N = 1 − exp(−s) for a beam in an otherwise undisturbed plasma (the density far from the beam is n0), and
// N = 1 − exp(−s)/⟨exp(−s)⟩ for the periodic slab, where the plasma pushed out of bright regions has to go
// somewhere inside the box (particle number is conserved). Both are ≈ s for small s and saturate at 1 (n → 0).
//
// Linear theory (periodic slab, uniform background s0, ripple ∝ cos KX): amplitude and phase ripples couple and grow
// as exp(κZ) with κ² = K²(2 s0 − K²). Fastest at K² = s0 with κ = s0; cut-off at K² = 2 s0. In physical units:
//     K_max = (v_os/2v_e)(ω_pe/c),    κ_max = (1/8)(v_os/v_e)² ω_pe²/(k0 c²),     v_e = √(T*/m).
//
// Two solvers, both exactly unitary (they conserve power to round-off):
//  • slab (one transverse coordinate, periodic): Strang split-step Fourier. Diffraction is exact in Fourier space,
//    the nonlinear refraction is an exact phase in real space.
//  • radial (a round beam, cylindrical symmetry): Strang splitting with Crank–Nicolson for the radial Laplacian
//    (1/r)∂r(r ∂r), written in flux form on a staggered grid, which is self-adjoint in the weighted inner product
//    Σ r_j|ψ_j|², so Crank–Nicolson is unitary in exactly that norm.
// The radial solver gives whole-beam self-focusing its real meaning: in two transverse dimensions the cubic equation
// collapses above the Townes power N_c = ∫|R|² d²X = 11.70 (R the Townes profile); a Gaussian beam focuses on its own
// (its width starts to shrink) above N = 4π.
import { fft } from './kdv'
import { c, e, eps0, me } from './constants'
import { ponderomotiveEV } from './ponderomotive'

// ---------- physical helpers ----------

/** Power of the Townes soliton of i∂ψ/∂Z + ∇²ψ + |ψ|²ψ = 0 in two transverse dimensions: the collapse threshold. */
export const TOWNES_N = 11.700896
/** The virial threshold for a Gaussian beam to start narrowing in the same equation: N = 4π. */
export const GAUSSIAN_N = 4 * Math.PI

/** U_p/T* for intensity I (W/cm²), wavelength λ (µm) and temperature T* (keV). */
export const upOverT = (IWcm2: number, lamUm: number, TkeV: number) => ponderomotiveEV(IWcm2, lamUm) / (TkeV * 1e3)

/** Lengths of the normalized units, in µm: X unit c/ω_pe and Z unit 2k0c²/ω_pe² = λ0 √(1 − n/n_c)/(π n/n_c). */
export function unitsUm(lamUm: number, nn: number) {
  const x = lamUm / (2 * Math.PI * Math.sqrt(nn))
  const z = (lamUm * Math.sqrt(1 - nn)) / (Math.PI * nn)
  return { x, z }
}

/** Linear spatial growth rate κ(K) of a ripple on a uniform beam, normalized units; 0 beyond cut-off. */
export const filamentationRate = (K: number, s0: number) => K * Math.sqrt(Math.max(0, 2 * s0 - K * K))

/** Same in physical units: K in µm⁻¹ → κ in µm⁻¹, for intensity I (W/cm²), λ (µm), n/n_c and T* (keV). */
export function filamentationRateUm(Kum: number, IWcm2: number, lamUm: number, nn: number, TkeV: number) {
  const u = unitsUm(lamUm, nn)
  return filamentationRate(Kum * u.x, upOverT(IWcm2, lamUm, TkeV)) / u.z
}

/** Fastest-growing transverse wavenumber (µm⁻¹) and its rate (µm⁻¹). */
export function fastestFilament(IWcm2: number, lamUm: number, nn: number, TkeV: number) {
  const u = unitsUm(lamUm, nn)
  const s0 = upOverT(IWcm2, lamUm, TkeV)
  return { K: Math.sqrt(s0) / u.x, kappa: s0 / u.z, s0 }
}

/**
 * Critical power for whole-beam self-focusing in watts, P_c = N_c ε0 c η/(2β), where the paraxial equation reads
 * 2ik0 a_z + ∇²a + β|a|²a = 0, the power is P = (ε0 c η/2)∫|a|², and η = √(1 − n/n_c) is the refractive index.
 * Ponderomotive: β = (ω_pe²/c²) e²/(4 m ω0² T*). Relativistic (a ≪ 1): β = (ω_pe²/c²) e²/(4 m² ω0² c²). The ratio of
 * the two is m c²/T*. With N = N_c (Townes) this gives 31.7 MW per keV and 16.2 GW, times (n_c/n)η; with the Gaussian
 * estimate N = 4π it gives 34.1 MW per keV and 17.4 GW.
 */
export function criticalPowerW(kind: 'ponderomotive' | 'relativistic', nn: number, TkeV = 1, N = TOWNES_N) {
  const eta = Math.sqrt(1 - nn)
  const rel = (2 * N * eps0 * me * me * c ** 5) / (e * e) // W, at n = n_c, η = 1
  const P = kind === 'relativistic' ? rel : (rel * TkeV * 1e3 * e) / (me * c * c)
  return (P * eta) / nn
}

// ---------- slab solver (periodic, split-step Fourier) ----------

export type Response = 'local' | 'conserving'

export interface Slab {
  nx: number
  L: number // box width (normalized X units)
  re: Float64Array
  im: Float64Array
  k2: Float64Array // K² for each FFT index
  dZ: number
  Z: number
  response: Response
  nonlinear: boolean
  // scratch
  fr: Float64Array
  fi: Float64Array
}

/** Mulberry32: small deterministic RNG for seeded noise. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SlabInit {
  nx: number
  L: number
  dZ: number
  response?: Response
  nonlinear?: boolean
  /** initial envelope ψ(X) (real), e.g. a uniform beam with a ripple */
  profile: (X: number) => number
  /** relative random amplitude noise (uniform in ±noise), seeded */
  noise?: number
  seed?: number
}

export function createSlab(o: SlabInit): Slab {
  const { nx, L } = o
  const re = new Float64Array(nx)
  const im = new Float64Array(nx)
  const r = rng(o.seed ?? 12345)
  for (let j = 0; j < nx; j++) {
    const X = (j * L) / nx
    re[j] = o.profile(X) * (1 + (o.noise ?? 0) * (2 * r() - 1))
  }
  const k2 = new Float64Array(nx)
  for (let j = 0; j < nx; j++) {
    const m = j <= nx / 2 ? j : j - nx
    const K = (2 * Math.PI * m) / L
    k2[j] = K * K
  }
  return { nx, L, re, im, k2, dZ: o.dZ, Z: 0, response: o.response ?? 'conserving', nonlinear: o.nonlinear ?? true, fr: new Float64Array(nx), fi: new Float64Array(nx) }
}

/** Nonlinear refraction for a step h: ψ → ψ exp(i N(s) h). */
function slabPhase(s: Slab, h: number) {
  const { nx, re, im } = s
  let norm = 1
  if (s.response === 'conserving') {
    let m = 0
    for (let j = 0; j < nx; j++) m += Math.exp(-(re[j] * re[j] + im[j] * im[j]))
    norm = nx / m
  }
  for (let j = 0; j < nx; j++) {
    const a = re[j]
    const b = im[j]
    const N = 1 - Math.exp(-(a * a + b * b)) * norm
    const ph = N * h
    const cs = Math.cos(ph)
    const sn = Math.sin(ph)
    re[j] = a * cs - b * sn
    im[j] = a * sn + b * cs
  }
}

/** Advance n steps of Strang splitting: half refraction, exact diffraction, half refraction. */
export function stepSlab(s: Slab, n = 1) {
  const { nx, re, im, k2, dZ } = s
  for (let it = 0; it < n; it++) {
    if (s.nonlinear) slabPhase(s, dZ / 2)
    fft(re, im)
    for (let j = 0; j < nx; j++) {
      const ph = -k2[j] * dZ
      const cs = Math.cos(ph)
      const sn = Math.sin(ph)
      const a = re[j]
      const b = im[j]
      re[j] = (a * cs - b * sn) / nx
      im[j] = (a * sn + b * cs) / nx
    }
    fft(re, im, true)
    if (s.nonlinear) slabPhase(s, dZ / 2)
    s.Z += dZ
  }
}

/** Σ|ψ|² ΔX: the power per unit length in the normalized units. */
export function slabPower(s: Slab) {
  let p = 0
  for (let j = 0; j < s.nx; j++) p += s.re[j] * s.re[j] + s.im[j] * s.im[j]
  return (p * s.L) / s.nx
}

/** Relative amplitude of Fourier mode m of the intensity |ψ|², |Î_m|/Î_0. */
export function slabMode(s: Slab, m: number) {
  const { nx, re, im, fr, fi } = s
  for (let j = 0; j < nx; j++) {
    fr[j] = re[j] * re[j] + im[j] * im[j]
    fi[j] = 0
  }
  fft(fr, fi)
  return Math.hypot(fr[m], fi[m]) / Math.abs(fr[0])
}

/** RMS half-width √⟨(X − X̄)²⟩ of the intensity (for a beam well inside the box). */
export function slabRms(s: Slab) {
  let w = 0
  let wx = 0
  let wxx = 0
  for (let j = 0; j < s.nx; j++) {
    const I = s.re[j] * s.re[j] + s.im[j] * s.im[j]
    const X = (j * s.L) / s.nx
    w += I
    wx += I * X
    wxx += I * X * X
  }
  const m = wx / w
  return Math.sqrt(wxx / w - m * m)
}

/** n/n0 of the plasma at grid point j (the steady-state response used by the solver). */
export function slabDensity(s: Slab, out: Float64Array) {
  const { nx, re, im } = s
  let norm = 1
  if (s.response === 'conserving') {
    let m = 0
    for (let j = 0; j < nx; j++) m += Math.exp(-(re[j] * re[j] + im[j] * im[j]))
    norm = nx / m
  }
  for (let j = 0; j < nx; j++) out[j] = Math.exp(-(re[j] * re[j] + im[j] * im[j])) * norm
}

/** Least-squares slope of ln y against x over the points with x in [x0, x1] and y in (yLo, yHi). */
export function logSlope(xs: ArrayLike<number>, ys: ArrayLike<number>, x0: number, x1: number, yLo = 0, yHi = Infinity) {
  let n = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]
    const y = ys[i]
    if (x < x0 || x > x1 || !(y > yLo) || !(y < yHi)) continue
    const ly = Math.log(y)
    n++
    sx += x
    sy += ly
    sxx += x * x
    sxy += x * ly
  }
  if (n < 5) return null
  const d = n * sxx - sx * sx
  return d > 0 ? (n * sxy - sx * sy) / d : null
}

// ---------- radial solver (round beam, Crank–Nicolson + nonlinear phase) ----------

export interface Radial {
  N: number
  R: number // outer radius (Dirichlet ψ = 0 just beyond it)
  dr: number
  r: Float64Array // cell centres (j + ½)dr
  re: Float64Array
  im: Float64Array
  up: Float64Array // Laplacian couplings: (Lψ)_j = up_j ψ_{j+1} + di_j ψ_j + lo_j ψ_{j−1}
  lo: Float64Array
  di: Float64Array
  Z: number
  nonlinear: boolean
  // scratch for the tridiagonal solve
  cr: Float64Array
  ci: Float64Array
  dr2: Float64Array
  di2: Float64Array
}

export function createRadial(o: { N: number; R: number; nonlinear?: boolean; profile: (r: number) => number }): Radial {
  const { N, R } = o
  const dr = R / N
  const r = new Float64Array(N)
  const up = new Float64Array(N)
  const lo = new Float64Array(N)
  const di = new Float64Array(N)
  const re = new Float64Array(N)
  for (let j = 0; j < N; j++) {
    r[j] = (j + 0.5) * dr
    const rp = r[j] + dr / 2
    const rm = r[j] - dr / 2 // 0 at the axis: no flux through r = 0
    up[j] = rp / (r[j] * dr * dr)
    lo[j] = rm / (r[j] * dr * dr)
    di[j] = -(rp + rm) / (r[j] * dr * dr)
    re[j] = o.profile(r[j])
  }
  return {
    N,
    R,
    dr,
    r,
    re,
    im: new Float64Array(N),
    up,
    lo,
    di,
    Z: 0,
    nonlinear: o.nonlinear ?? true,
    cr: new Float64Array(N),
    ci: new Float64Array(N),
    dr2: new Float64Array(N),
    di2: new Float64Array(N),
  }
}

function radialPhase(b: Radial, h: number) {
  const { N, re, im } = b
  for (let j = 0; j < N; j++) {
    const a = re[j]
    const q = im[j]
    const ph = (1 - Math.exp(-(a * a + q * q))) * h
    const cs = Math.cos(ph)
    const sn = Math.sin(ph)
    re[j] = a * cs - q * sn
    im[j] = a * sn + q * cs
  }
}

/** Crank–Nicolson for ∂ψ/∂Z = i Lψ: (1 − i h/2 L)ψ' = (1 + i h/2 L)ψ, solved by the Thomas algorithm in complex arithmetic. */
function radialDiffract(b: Radial, h: number) {
  const { N, re, im, up, lo, di, cr, ci, dr2, di2 } = b
  const a = h / 2
  // right-hand side r = ψ + i a Lψ  (stored in dr2 + i di2)
  for (let j = 0; j < N; j++) {
    let lr = di[j] * re[j]
    let li = di[j] * im[j]
    if (j + 1 < N) {
      lr += up[j] * re[j + 1]
      li += up[j] * im[j + 1]
    }
    if (j > 0) {
      lr += lo[j] * re[j - 1]
      li += lo[j] * im[j - 1]
    }
    dr2[j] = re[j] - a * li
    di2[j] = im[j] + a * lr
  }
  // matrix: sub = −i a lo_j, diag = 1 − i a di_j, sup = −i a up_j. Forward sweep with complex c'_j and d'_j.
  // c'_0 = sup_0/diag_0, d'_0 = r_0/diag_0; c'_j = sup_j/(diag_j − sub_j c'_{j−1}); d'_j = (r_j − sub_j d'_{j−1})/(same)
  let pr = 0 // previous c' (real, imag)
  let pi = 0
  let qr = 0 // previous d'
  let qi = 0
  for (let j = 0; j < N; j++) {
    // den = diag − sub·c'_{j−1}, with sub = −i a lo_j:  sub·c' = −i a lo (pr + i pi) = a lo pi − i a lo pr
    const sr = j > 0 ? a * lo[j] * pi : 0
    const si = j > 0 ? -a * lo[j] * pr : 0
    const denr = 1 - sr
    const deni = -a * di[j] - si
    const dd = denr * denr + deni * deni
    // c'_j = sup/den, sup = −i a up_j
    const supr = 0
    const supi = j + 1 < N ? -a * up[j] : 0
    const ncr = (supr * denr + supi * deni) / dd
    const nci = (supi * denr - supr * deni) / dd
    // d'_j = (r_j − sub d'_{j−1})/den; sub d' = −i a lo (qr + i qi) = a lo qi − i a lo qr
    const tr = dr2[j] - (j > 0 ? a * lo[j] * qi : 0)
    const ti = di2[j] - (j > 0 ? -a * lo[j] * qr : 0)
    const ndr = (tr * denr + ti * deni) / dd
    const ndi = (ti * denr - tr * deni) / dd
    cr[j] = ncr
    ci[j] = nci
    dr2[j] = ndr
    di2[j] = ndi
    pr = ncr
    pi = nci
    qr = ndr
    qi = ndi
  }
  // back substitution: ψ_j = d'_j − c'_j ψ_{j+1}
  re[N - 1] = dr2[N - 1]
  im[N - 1] = di2[N - 1]
  for (let j = N - 2; j >= 0; j--) {
    const xr = re[j + 1]
    const xi = im[j + 1]
    re[j] = dr2[j] - (cr[j] * xr - ci[j] * xi)
    im[j] = di2[j] - (cr[j] * xi + ci[j] * xr)
  }
}

/** Advance the round beam by n Strang steps of size h. */
export function stepRadial(b: Radial, h: number, n = 1) {
  for (let it = 0; it < n; it++) {
    if (b.nonlinear) radialPhase(b, h / 2)
    radialDiffract(b, h)
    if (b.nonlinear) radialPhase(b, h / 2)
    b.Z += h
  }
}

/** ∫|ψ|² 2πr dr on the grid. */
export function radialPower(b: Radial) {
  let p = 0
  for (let j = 0; j < b.N; j++) p += (b.re[j] * b.re[j] + b.im[j] * b.im[j]) * b.r[j]
  return 2 * Math.PI * p * b.dr
}

/** √⟨r²⟩ of the intensity. For a Gaussian with 1/e² intensity radius W it is W/√2. */
export function radialRms(b: Radial) {
  let w = 0
  let wr = 0
  for (let j = 0; j < b.N; j++) {
    const I = (b.re[j] * b.re[j] + b.im[j] * b.im[j]) * b.r[j]
    w += I
    wr += I * b.r[j] * b.r[j]
  }
  return Math.sqrt(wr / w)
}

/**
 * Half width at half maximum of the intensity, measured outward from the axis: the radius where |ψ|² first falls to
 * half its on-axis value (linear interpolation between cells). For a Gaussian of 1/e² radius W it is W√(ln2/2), and it
 * follows the same vacuum law as the rms radius. Unlike the rms radius, it tracks the bright core of a self-focused
 * beam rather than the power radiated into its wings.
 */
export function radialHalfWidth(b: Radial) {
  const s0 = b.re[0] * b.re[0] + b.im[0] * b.im[0]
  const half = s0 / 2
  let prev = s0
  for (let j = 1; j < b.N; j++) {
    const sj = b.re[j] * b.re[j] + b.im[j] * b.im[j]
    if (sj <= half) {
      const f = (prev - half) / (prev - sj)
      return b.r[j - 1] + f * b.dr
    }
    prev = sj
  }
  return b.R
}

/** Largest nonlinear index change N = 1 − exp(−s) on the grid (≤ 1); sets a safe step size. */
export function radialMaxN(b: Radial) {
  let m = 0
  for (let j = 0; j < b.N; j++) m = Math.max(m, b.re[j] * b.re[j] + b.im[j] * b.im[j])
  return 1 - Math.exp(-m)
}

/** On-axis intensity s(0) = |ψ(r → 0)|² (first cell). */
export const radialAxis = (b: Radial) => b.re[0] * b.re[0] + b.im[0] * b.im[0]

/** Vacuum (or linear) diffraction of a Gaussian: width factor √(1 + (Z/Z_R)²) with Z_R = W²/4 in normalized units. */
export const gaussianWidthFactor = (Z: number, W: number) => Math.sqrt(1 + (Z / ((W * W) / 4)) ** 2)
