// A10: Korteweg–de Vries equation u_t + u u_x + u_xxx = 0 on a periodic domain.
// Pseudo-spectral in x; time stepping by fourth-order Runge–Kutta with an integrating factor, so the
// stiff dispersive term is integrated exactly (the scheme of Trefethen, Spectral Methods in MATLAB, p27).
// Single soliton: u = 3c sech²(√c (x − x₀ − ct)/2): height 3c, speed c, width ∝ 1/√c.

/** In-place iterative radix-2 complex FFT. inverse = true computes the unnormalized inverse. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
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
  const sgn = inverse ? 1 : -1
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sgn * 2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < half; k++) {
        const a = i + k
        const b = a + half
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

export interface Soliton {
  c: number // speed; height is 3c
  x0: number // initial centre
}

export interface Kdv {
  N: number
  L: number
  dt: number
  t: number
  x: Float64Array
  u: Float64Array // physical-space solution (refreshed by syncU)
  vr: Float64Array // spectrum, real part
  vi: Float64Array // spectrum, imaginary part
  k: Float64Array
  Er: Float64Array // e^{i k³ dt/2}
  Ei: Float64Array
  E2r: Float64Array // e^{i k³ dt}
  E2i: Float64Array
  g: Float64Array // −½ dt k (times i), zero above the 2/3 dealiasing cut
  // work arrays
  wr: Float64Array
  wi: Float64Array
  ar: Float64Array
  ai: Float64Array
  br: Float64Array
  bi: Float64Array
  cr: Float64Array
  ci: Float64Array
  dr: Float64Array
  di: Float64Array
}

/** Analytic single soliton of u_t + u u_x + u_xxx = 0. */
export function solitonProfile(x: number, c: number, x0: number): number {
  const s = 1 / Math.cosh((Math.sqrt(c) * (x - x0)) / 2)
  return 3 * c * s * s
}

/** Periodic distance a − b folded into [−L/2, L/2). */
export function wrapDist(d: number, L: number): number {
  d = ((d % L) + L) % L
  return d >= L / 2 ? d - L : d
}

export function createKdv(N: number, L: number, dt: number, solitons: Soliton[]): Kdv {
  const x = new Float64Array(N)
  const u = new Float64Array(N)
  for (let j = 0; j < N; j++) {
    x[j] = (j * L) / N
    let s = 0
    for (const so of solitons) s += solitonProfile(wrapDist(x[j] - so.x0, L), so.c, 0) // nearest periodic image
    u[j] = s
  }
  const k = new Float64Array(N)
  const kmax = (Math.PI * N) / L
  for (let j = 0; j < N; j++) {
    const m = j < N / 2 ? j : j === N / 2 ? 0 : j - N
    k[j] = (2 * Math.PI * m) / L
  }
  const Er = new Float64Array(N)
  const Ei = new Float64Array(N)
  const E2r = new Float64Array(N)
  const E2i = new Float64Array(N)
  const g = new Float64Array(N)
  for (let j = 0; j < N; j++) {
    const ph = (k[j] ** 3 * dt) / 2
    Er[j] = Math.cos(ph)
    Ei[j] = Math.sin(ph)
    E2r[j] = Math.cos(2 * ph)
    E2i[j] = Math.sin(2 * ph)
    g[j] = Math.abs(k[j]) < (2 / 3) * kmax ? -0.5 * dt * k[j] : 0
  }
  const vr = Float64Array.from(u)
  const vi = new Float64Array(N)
  fft(vr, vi)
  const z = () => new Float64Array(N)
  return { N, L, dt, t: 0, x, u, vr, vi, k, Er, Ei, E2r, E2i, g, wr: z(), wi: z(), ar: z(), ai: z(), br: z(), bi: z(), cr: z(), ci: z(), dr: z(), di: z() }
}

/** out = i g · FFT( real(IFFT(w))² ), with w given in s.wr/s.wi (overwritten). */
function nonlinear(s: Kdv, outR: Float64Array, outI: Float64Array) {
  const { N, wr, wi, g } = s
  fft(wr, wi, true)
  for (let j = 0; j < N; j++) {
    const v = wr[j] / N
    wr[j] = v * v
    wi[j] = 0
  }
  fft(wr, wi)
  for (let j = 0; j < N; j++) {
    // (i g)(a + ib) = −g b + i g a
    outR[j] = -g[j] * wi[j]
    outI[j] = g[j] * wr[j]
  }
}

/** One integrating-factor RK4 step. */
export function stepKdv(s: Kdv): void {
  const { N, vr, vi, Er, Ei, E2r, E2i, wr, wi, ar, ai, br, bi, cr, ci, dr, di } = s
  // a = N(v)
  wr.set(vr)
  wi.set(vi)
  nonlinear(s, ar, ai)
  // b = N(E (v + a/2))
  for (let j = 0; j < N; j++) {
    const pr = vr[j] + ar[j] / 2
    const pi = vi[j] + ai[j] / 2
    wr[j] = Er[j] * pr - Ei[j] * pi
    wi[j] = Er[j] * pi + Ei[j] * pr
  }
  nonlinear(s, br, bi)
  // c = N(E v + b/2)
  for (let j = 0; j < N; j++) {
    wr[j] = Er[j] * vr[j] - Ei[j] * vi[j] + br[j] / 2
    wi[j] = Er[j] * vi[j] + Ei[j] * vr[j] + bi[j] / 2
  }
  nonlinear(s, cr, ci)
  // d = N(E² v + E c)
  for (let j = 0; j < N; j++) {
    wr[j] = E2r[j] * vr[j] - E2i[j] * vi[j] + Er[j] * cr[j] - Ei[j] * ci[j]
    wi[j] = E2r[j] * vi[j] + E2i[j] * vr[j] + Er[j] * ci[j] + Ei[j] * cr[j]
  }
  nonlinear(s, dr, di)
  // v ← E² v + (E² a + 2E(b + c) + d)/6
  for (let j = 0; j < N; j++) {
    const nr = E2r[j] * vr[j] - E2i[j] * vi[j]
    const ni = E2r[j] * vi[j] + E2i[j] * vr[j]
    const sr = br[j] + cr[j]
    const si = bi[j] + ci[j]
    const tr = E2r[j] * ar[j] - E2i[j] * ai[j] + 2 * (Er[j] * sr - Ei[j] * si) + dr[j]
    const ti = E2r[j] * ai[j] + E2i[j] * ar[j] + 2 * (Er[j] * si + Ei[j] * sr) + di[j]
    vr[j] = nr + tr / 6
    vi[j] = ni + ti / 6
  }
  s.t += s.dt
}

/** Refresh s.u from the spectrum. */
export function syncU(s: Kdv): Float64Array {
  const { N, wr, wi, u } = s
  wr.set(s.vr)
  wi.set(s.vi)
  fft(wr, wi, true)
  for (let j = 0; j < N; j++) u[j] = wr[j] / N
  return u
}

/** Mass ∫u dx, conserved by KdV (and exactly by this scheme, since the k = 0 mode never changes). */
export function mass(s: Kdv): number {
  return (s.vr[0] * s.L) / s.N
}

/** Local maxima of u above `thresh`, refined by a parabola through three points; sorted tallest first. */
export function findPeaks(s: Kdv, thresh: number): { x: number; h: number }[] {
  const { N, u, L } = s
  const out: { x: number; h: number }[] = []
  const dx = L / N
  for (let j = 0; j < N; j++) {
    const a = u[(j - 1 + N) % N]
    const b = u[j]
    const c = u[(j + 1) % N]
    if (b > thresh && b >= a && b > c) {
      const den = a - 2 * b + c
      const d = den !== 0 ? (0.5 * (a - c)) / den : 0
      out.push({ x: (((j + d) * dx) % L + L) % L, h: b - 0.25 * (a - c) * d })
    }
  }
  return out.sort((p, q) => q.h - p.h)
}

/**
 * Asymptotic phase shifts after two solitons collide (speeds c₁ > c₂):
 * the faster one jumps forward by (2/√c₁) ln[(√c₁+√c₂)/(√c₁−√c₂)], the slower one back by (2/√c₂) ln[…].
 */
export function phaseShifts(c1: number, c2: number): { fast: number; slow: number } {
  const a = Math.sqrt(c1)
  const b = Math.sqrt(c2)
  const l = Math.log((a + b) / (a - b))
  return { fast: (2 / a) * l, slow: -(2 / b) * l }
}
