// 1D1V Vlasov–Poisson solver for electrons on a fixed, uniform ion background.
// Normalized units: ω_pe = 1, λ_D = 1, v_th = √(kT_e/m_e) = 1, electron charge −1, mean density 1.
//   ∂f/∂t + v ∂f/∂x − E ∂f/∂v = 0,    ∂E/∂x = 1 − ∫f dv
// Time stepping is the Cheng–Knorr split (J. Comput. Phys. 22, 330, 1976): shift in x for dt/2,
// in v for dt, in x for dt/2. Each shift is semi-Lagrangian: follow the characteristic back and
// interpolate f there with a 4-point cubic (Lagrange) stencil. Periodic in x, f = 0 beyond ±vmax.
// Poisson is solved spectrally with an FFT.
import { fft, makeFFT, type FFT } from './rayleighTaylor'

export type Profile = 'maxwell' | 'bump'

export interface VlasovOptions {
  k: number // wavenumber of the box's fundamental mode (L = 2π/k)
  alpha: number // initial density perturbation f = (1 + α cos kx) f₀(v)
  profile?: Profile
  nx?: number
  nv?: number
  vmax?: number
  dt?: number
}

export interface Vlasov {
  nx: number
  nv: number
  L: number
  k: number
  alpha: number
  dx: number
  vmax: number
  dv: number
  dt: number
  t: number
  profile: Profile
  v: Float64Array // cell-centre velocities
  f: Float64Array // f[i·nv + j] at x_i, v_j
  f0: Float64Array // initial spatially averaged f₀(v_j)
  col: Float64Array // work: one column / row
  out: Float64Array
  E: Float64Array
  rho: Float64Array
  re: Float64Array
  im: Float64Array
  fftp: FFT
  times: number[]
  e1: number[] // |E| of the fundamental Fourier mode
}

/** Maxwellian, or 90% Maxwellian core plus a 10% warm beam at v = 4.5 with v_t = 0.5 (bump on tail). */
export function f0Of(profile: Profile, v: number): number {
  const g = (u: number, s: number) => Math.exp(-((v - u) ** 2) / (2 * s * s)) / (Math.sqrt(2 * Math.PI) * s)
  return profile === 'bump' ? 0.9 * g(0, 1) + 0.1 * g(4.5, 0.5) : g(0, 1)
}

export function createVlasov(o: VlasovOptions): Vlasov {
  const nx = o.nx ?? 64
  const nv = o.nv ?? 128
  const vmax = o.vmax ?? 8
  const L = (2 * Math.PI) / o.k
  const dv = (2 * vmax) / nv
  const profile = o.profile ?? 'maxwell'
  const s: Vlasov = {
    nx, nv, L, k: o.k, alpha: o.alpha, dx: L / nx, vmax, dv, dt: o.dt ?? 0.1, t: 0, profile,
    v: new Float64Array(nv), f: new Float64Array(nx * nv), f0: new Float64Array(nv),
    col: new Float64Array(Math.max(nx, nv) + 8), out: new Float64Array(Math.max(nx, nv)),
    E: new Float64Array(nx), rho: new Float64Array(nx), re: new Float64Array(nx), im: new Float64Array(nx),
    fftp: makeFFT(nx), times: [], e1: [],
  }
  for (let j = 0; j < nv; j++) {
    s.v[j] = -vmax + (j + 0.5) * dv
    s.f0[j] = f0Of(profile, s.v[j])
  }
  for (let i = 0; i < nx; i++) {
    const a = 1 + o.alpha * Math.cos(o.k * i * s.dx)
    for (let j = 0; j < nv; j++) s.f[i * nv + j] = a * s.f0[j]
  }
  poisson(s)
  s.times.push(0)
  s.e1.push(modeE1(s))
  return s
}

/** Cubic Lagrange weights for a point θ ∈ [0,1) past node 0, using nodes −1, 0, 1, 2. */
function weights(th: number): [number, number, number, number] {
  return [(-th * (th - 1) * (th - 2)) / 6, ((th + 1) * (th - 1) * (th - 2)) / 2, (-(th + 1) * th * (th - 2)) / 2, ((th + 1) * th * (th - 1)) / 6]
}

/** Shift in x by v·tau for every velocity row (periodic). */
function advectX(s: Vlasov, tau: number): void {
  const { nx, nv, f, col, out, dx } = s
  for (let j = 0; j < nv; j++) {
    const p = (-s.v[j] * tau) / dx // f_new(x_i) = f(x_i + p·dx)
    const j0 = Math.floor(p)
    const [w0, w1, w2, w3] = weights(p - j0)
    for (let i = 0; i < nx; i++) col[i] = f[i * nv + j]
    const base = (((j0 - 1) % nx) + nx) % nx
    for (let i = 0; i < nx; i++) {
      let a = base + i
      if (a >= nx) a -= nx
      let b = a + 1
      if (b >= nx) b -= nx
      let c = b + 1
      if (c >= nx) c -= nx
      let d = c + 1
      if (d >= nx) d -= nx
      out[i] = w0 * col[a] + w1 * col[b] + w2 * col[c] + w3 * col[d]
    }
    for (let i = 0; i < nx; i++) f[i * nv + j] = out[i]
  }
}

/** Shift in v by the electric acceleration −E·tau for every x column (f = 0 beyond ±vmax). */
function advectV(s: Vlasov, tau: number): void {
  const { nx, nv, f, col, dv, E } = s
  const pad = 4
  for (let i = 0; i < nx; i++) {
    const p = (E[i] * tau) / dv // electrons: v_new = v_old − E·tau, so the foot is at v + E·tau
    const j0 = Math.floor(p)
    const [w0, w1, w2, w3] = weights(p - j0)
    const r = i * nv
    col.fill(0)
    for (let j = 0; j < nv; j++) col[j + pad] = f[r + j]
    // col[j + pad] holds f_j; source node for output j is j + j0 (+ −1..2)
    for (let j = 0; j < nv; j++) {
      const a = j + j0 - 1 + pad
      let acc = 0
      if (a >= 0 && a < nv + pad) acc += w0 * col[a]
      if (a + 1 >= 0 && a + 1 < nv + pad) acc += w1 * col[a + 1]
      if (a + 2 >= 0 && a + 2 < nv + pad) acc += w2 * col[a + 2]
      if (a + 3 >= 0 && a + 3 < nv + pad) acc += w3 * col[a + 3]
      f[r + j] = acc
    }
  }
}

/** Density, charge and field. ∂E/∂x = ρ = n_i − n_e with n_i the mean electron density. */
export function poisson(s: Vlasov): void {
  const { nx, nv, f, rho, re, im, E, dv, k } = s
  let mean = 0
  for (let i = 0; i < nx; i++) {
    let n = 0
    const r = i * nv
    for (let j = 0; j < nv; j++) n += f[r + j]
    rho[i] = -n * dv
    mean += rho[i]
  }
  mean /= nx
  for (let i = 0; i < nx; i++) {
    re[i] = rho[i] - mean
    im[i] = 0
  }
  fft(s.fftp, re, im, -1)
  // E_m = ρ_m / (i k m)
  re[0] = 0
  im[0] = 0
  for (let m = 1; m < nx; m++) {
    const mm = m <= nx / 2 ? m : m - nx
    const km = k * mm
    const r0 = re[m]
    const i0 = im[m]
    re[m] = i0 / km
    im[m] = -r0 / km
  }
  // the Nyquist mode of a real signal cannot carry a derivative consistently; drop it
  re[nx / 2] = 0
  im[nx / 2] = 0
  fft(s.fftp, re, im, 1)
  for (let i = 0; i < nx; i++) E[i] = re[i] / nx
}

/** Amplitude of the fundamental Fourier mode of E. */
export function modeE1(s: Vlasov): number {
  const { nx, E } = s
  let cr = 0
  let ci = 0
  for (let i = 0; i < nx; i++) {
    const ph = (2 * Math.PI * i) / nx
    cr += E[i] * Math.cos(ph)
    ci += E[i] * Math.sin(ph)
  }
  return (2 / nx) * Math.hypot(cr, ci)
}

export function stepVlasov(s: Vlasov, steps = 1): void {
  for (let n = 0; n < steps; n++) {
    advectX(s, 0.5 * s.dt)
    poisson(s)
    advectV(s, s.dt)
    advectX(s, 0.5 * s.dt)
    poisson(s)
    s.t += s.dt
    s.times.push(s.t)
    s.e1.push(modeE1(s))
  }
}

/** Spatially averaged distribution ⟨f⟩(v). */
export function averageF(s: Vlasov, out: Float64Array): void {
  out.fill(0)
  for (let i = 0; i < s.nx; i++) for (let j = 0; j < s.nv; j++) out[j] += s.f[i * s.nv + j] / s.nx
}

/** Total energy (kinetic + field), for checking conservation. */
export function totalEnergy(s: Vlasov): number {
  let ke = 0
  for (let i = 0; i < s.nx; i++) for (let j = 0; j < s.nv; j++) ke += 0.5 * s.v[j] * s.v[j] * s.f[i * s.nv + j]
  ke *= s.dv * s.dx
  let fe = 0
  for (let i = 0; i < s.nx; i++) fe += 0.5 * s.E[i] * s.E[i] * s.dx
  return ke + fe
}

/** Recurrence time 2π/(kΔv): after this the finite velocity grid makes the initial state reappear. */
export const recurrenceTime = (s: Vlasov) => (2 * Math.PI) / (s.k * s.dv)

/**
 * Damping (or growth) rate and frequency from the peaks of |E₁(t)|. Each peak is refined with a parabola
 * through three samples; ln(peak) is fitted with a straight line. |E₁| of a standing wave peaks twice per
 * period, so ω = π / (mean peak spacing). Uses peaks with t ≤ tMax and amplitude above `floor`.
 */
export function peakFit(times: number[], amps: number[], tMax: number, floor = 0): { gamma: number; omega: number; peaks: number } | null {
  const pt: number[] = []
  const pa: number[] = []
  for (let i = 1; i < amps.length - 1 && times[i] <= tMax; i++) {
    if (amps[i] > amps[i - 1] && amps[i] >= amps[i + 1] && amps[i] > floor) {
      const y0 = Math.log(amps[i - 1])
      const y1 = Math.log(amps[i])
      const y2 = Math.log(amps[i + 1])
      const den = y0 - 2 * y1 + y2
      const d = den !== 0 ? (0.5 * (y0 - y2)) / den : 0
      const h = times[i + 1] - times[i]
      pt.push(times[i] + d * h)
      pa.push(y1 - 0.25 * (y0 - y2) * d)
    }
  }
  if (pt.length < 3) return null
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  const n = pt.length
  for (let i = 0; i < n; i++) {
    sx += pt[i]
    sy += pa[i]
    sxx += pt[i] * pt[i]
    sxy += pt[i] * pa[i]
  }
  const gamma = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const omega = Math.PI / ((pt[n - 1] - pt[0]) / (n - 1))
  return { gamma, omega, peaks: n }
}

/** Least-squares slope of ln|E₁| between t0 and the first time |E₁| exceeds ampStop. */
export function slopeFit(times: number[], amps: number[], t0: number, ampStop: number): { gamma: number; done: boolean } | null {
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0
  let done = false
  for (let i = 0; i < times.length; i++) {
    if (amps[i] > ampStop) {
      done = true
      break
    }
    if (times[i] < t0 || amps[i] <= 0) continue
    const y = Math.log(amps[i])
    sx += times[i]
    sy += y
    sxx += times[i] * times[i]
    sxy += times[i] * y
    n++
  }
  if (n < 20) return null
  return { gamma: (n * sxy - sx * sy) / (n * sxx - sx * sx), done }
}
