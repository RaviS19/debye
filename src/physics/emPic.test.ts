// B9 benchmarks: the 1D electromagnetic PIC code against the analytic results the lesson teaches.
import { describe, expect, it } from 'vitest'
import {
  canonicalError,
  createEmPic,
  createYeePulse,
  emOmegaNumerical,
  energies,
  gaussError,
  laserDrive,
  leapfrogGrowth,
  leapfrogRatio,
  meanSquare,
  meanUx2,
  modeOf,
  noiseRatio,
  peakFrequency,
  slabDensity,
  spectrumOf,
  srsPeriodicBox,
  srsPrediction,
  stepEmPic,
  stepYee,
  vteOf,
  yeeGroupVelocity,
  yeePhaseSpeed,
  type EmPic,
} from './emPic'
import { fullDispersionGrowth } from './srsSbs'

/** Least-squares slope of ln y over the exponential phase: between 1/30 and 1/3 of the first maximum. */
function growthFit(ts: number[], ys: number[]): { g: number; t0: number; t1: number } {
  let imax = 0
  for (let i = 0; i < ys.length; i++) if (ys[i] > ys[imax]) imax = i
  let i1 = imax
  while (i1 > 0 && ys[i1] > ys[imax] / 3) i1--
  let i0 = i1
  while (i0 > 0 && ys[i0] > ys[imax] / 30) i0--
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  let n = 0
  for (let i = i0; i <= i1; i++) {
    const y = Math.log(ys[i])
    sx += ts[i]
    sy += y
    sxx += ts[i] * ts[i]
    sxy += ts[i] * y
    n++
  }
  return { g: (n * sxy - sx * sy) / (n * sxx - sx * sx), t0: ts[i0], t1: ts[i1] }
}

/** Accumulated phase of Fourier mode m of an array, unwrapped, sampled each call. */
function phaseTracker() {
  let prev = NaN
  let acc = 0
  return (re: number, im: number) => {
    const p = Math.atan2(im, re)
    if (!isNaN(prev)) {
      let d = p - prev
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      acc += d
    }
    prev = p
    return acc
  }
}

describe('electromagnetic fields', () => {
  it('a vacuum pulse moves at exactly c, without dispersion', () => {
    const dx = 0.15
    const tau = 8
    const pulse = (t: number) => (t > 0 ? Math.exp(-(((t - 30) / tau) ** 2)) * Math.sin(t) : 0)
    const s = createEmPic({ nx: 800, dx, density: () => 0, ppc: 1, TeKeV: 1, laser: pulse })
    expect(s.np).toBe(0)
    stepEmPic(s, 600)
    let err = 0
    let peak = 0
    for (let j = 0; j < s.fp.length; j++) {
      err = Math.max(err, Math.abs(s.fp[j] - pulse(s.t - j * dx)), Math.abs(s.fm[j]))
      peak = Math.max(peak, Math.abs(s.fp[j]))
    }
    expect(peak).toBeGreaterThan(0.9)
    expect(err).toBeLessThan(1e-12) // the characteristic shift is exact: round-off only
  })

  it('Yee FDTD is exact at cΔt = Δx (the magic time step) and dispersive below it', () => {
    const run = (courant: number) => {
      const y = createYeePulse(1200, 0.1, courant, 20, 3, 4)
      const T = 60
      stepYee(y, Math.round(T / y.dt))
      let err = 0
      for (let i = 0; i < y.n; i++) {
        const x = i * y.dx - y.t
        err = Math.max(err, Math.abs(y.E[i] - Math.exp(-(((x - 20) / 3) ** 2)) * Math.cos(4 * (x - 20))))
      }
      return err
    }
    expect(run(1)).toBeLessThan(1e-10) // round-off only
    expect(run(0.5)).toBeGreaterThan(1e-3)
    // the numerical phase speed at Courant 0.5 is below c, and tends to c for long waves
    expect(yeePhaseSpeed(0.4, 0.5)).toBeLessThan(1)
    expect(yeePhaseSpeed(0.4, 0.5)).toBeGreaterThan(0.99)
    expect(yeePhaseSpeed(0.4, 1)).toBeCloseTo(1, 12)
    // a wave packet with 8 cells per wavelength at Courant 0.5 travels at the numerical group velocity
    const kc = (2 * Math.PI) / 8
    const y = createYeePulse(1400, 1, 0.5, 100, 20, kc)
    const centroid = () => {
      let a = 0
      let b = 0
      for (let i = 0; i < y.n; i++) {
        a += i * y.E[i] ** 2
        b += y.E[i] ** 2
      }
      return a / b
    }
    stepYee(y, 200) // let the packet settle (E and B start slightly out of step)
    const c0 = centroid()
    const t0 = y.t
    stepYee(y, 1600)
    const vg = (centroid() - c0) / (y.t - t0)
    expect(Math.abs(vg / yeeGroupVelocity(kc, 0.5) - 1)).toBeLessThan(0.01)
    expect(yeeGroupVelocity(kc, 0.5)).toBeLessThan(0.95)
  })

  it('light in a uniform plasma follows ω² = ω_pe² + c²k² (within 3%) and the code’s own dispersion relation (0.1%)', () => {
    for (const [n, m] of [[0.1, 4], [0.2, 10], [0.5, 2]]) {
      const nx = 512
      const dx = 0.15
      const L = nx * dx
      const k = (2 * Math.PI * m) / L
      const s = createEmPic({ nx, dx, periodic: true, density: () => n, ppc: 8, TeKeV: 0, cold: true, pump: { a: 0.01, k } })
      const ey = new Float64Array(nx)
      const track = phaseTracker()
      let acc = 0
      const phase = () => {
        for (let j = 0; j < nx; j++) ey[j] = s.fp[j] + s.fm[j]
        const [re, im] = modeOf(ey, m)
        acc = track(re, im)
      }
      phase()
      while (s.t < 200) {
        stepEmPic(s, 1)
        phase()
      }
      const w = Math.abs(acc) / s.t
      expect(Math.abs(w / Math.sqrt(n + k * k) - 1)).toBeLessThan(0.03)
      expect(Math.abs(w / emOmegaNumerical(k, n, dx) - 1)).toBeLessThan(0.001)
    }
  })
})

describe('particles', () => {
  it('cold plasma oscillates at ω_pe (within 2%), and at the leapfrog frequency (2/Δt) asin(ω_peΔt/2)', () => {
    for (const wpdt of [0.05, 0.2, 1]) {
      const dx = 0.1
      const n = (wpdt / dx) ** 2
      const s = createEmPic({ nx: 64, dx, periodic: true, density: () => n, ppc: 20, TeKeV: 0, cold: true, displace: { amp: 0.001, mode: 1 } })
      // zero crossings of E_x mode 1, refined by linear interpolation between steps
      const zs: number[] = []
      let prev = modeOf(s.ex, 1)[0]
      let tPrev = 0
      while (s.t < (2 * Math.PI * 20) / Math.sqrt(n)) {
        stepEmPic(s, 1)
        const v = modeOf(s.ex, 1)[0]
        if (prev < 0 && v >= 0) zs.push(tPrev + ((s.t - tPrev) * -prev) / (v - prev))
        prev = v
        tPrev = s.t
      }
      const w = (2 * Math.PI * (zs.length - 1)) / (zs[zs.length - 1] - zs[0]) / Math.sqrt(n)
      if (wpdt <= 0.2) expect(Math.abs(w - 1)).toBeLessThan(0.02)
      expect(Math.abs(w / leapfrogRatio(wpdt) - 1)).toBeLessThan(0.005)
    }
  })

  it('leapfrog is unstable above ω_peΔt = 2: the oscillation grows at the predicted rate', () => {
    const wpdt = 2.2
    const dx = 0.1
    const n = (wpdt / dx) ** 2
    const s = createEmPic({ nx: 64, dx, periodic: true, density: () => n, ppc: 20, TeKeV: 0, cold: true, displace: { amp: 1e-9, mode: 1 } })
    const a0 = Math.hypot(...modeOf(s.ex, 1))
    stepEmPic(s, 20)
    const a1 = Math.hypot(...modeOf(s.ex, 1))
    const measured = Math.log(a1 / a0) / (20 * wpdt)
    expect(Math.abs(measured / leapfrogGrowth(wpdt) - 1)).toBeLessThan(0.05)
  })

  it('the transverse canonical momentum p_y − eA_y stays constant to O(Δx²)', () => {
    const run = (dx: number) => {
      const slab = { x0: 20, x1: 60, ramp: 5, n: 0.1 }
      const s = createEmPic({ nx: Math.round(80 / dx), dx, density: (x) => slabDensity(slab, x), ppc: 10, TeKeV: 0.01, laser: laserDrive(0.05) })
      stepEmPic(s, Math.round(100 / dx))
      let a = 0
      let e = 0
      let m = 0
      for (let i = 0; i < s.np; i++) {
        if (!s.alive[i]) continue
        const ig = 1 / Math.sqrt(1 + s.ux[i] ** 2 + s.uy[i] ** 2)
        const xh = s.x[i] - 0.5 * s.dt * s.ux[i] * ig
        const q = xh / s.dx
        const j = Math.floor(q)
        const f = q - j
        const ay = 0.5 * (s.ay[j] * (1 - f) + s.ay[j + 1] * f + s.ayPrev[j] * (1 - f) + s.ayPrev[j + 1] * f)
        e += (s.uy[i] - ay - s.py0[i]) ** 2
        a += (s.uy[i] - s.py0[i]) ** 2
        m++
      }
      // the transverse momentum itself is of order a0; the error is a small fraction of it
      return { rms: Math.sqrt(e / m) / 0.05, size: Math.sqrt(a / m) / 0.05, max: canonicalError(s) / 0.05 }
    }
    const coarse = run(0.15)
    const fine = run(0.075)
    expect(coarse.size).toBeGreaterThan(0.3) // electrons really are quivering
    expect(coarse.rms).toBeLessThan(0.01) // rms deviation under 1% of a0
    expect(coarse.max).toBeLessThan(0.03)
    expect(fine.rms).toBeLessThan(coarse.rms / 2.5) // second order: ÷4 ideally
  })

  it('Gauss’s law holds to round-off with charge-conserving deposition, even as electrons escape', () => {
    const slab = { x0: 15, x1: 45, ramp: 3, n: 0.15 }
    const s = createEmPic({ nx: 400, dx: 0.15, density: (x) => slabDensity(slab, x), ppc: 16, TeKeV: 5, laser: laserDrive(0.1) })
    stepEmPic(s, 1500)
    expect(s.escaped.length).toBeGreaterThan(0)
    const g = gaussError(s)
    expect(g.scale).toBeGreaterThan(1e-3)
    expect(g.err / g.scale).toBeLessThan(1e-10)
  })
})

describe('numerical noise and heating', () => {
  const thermal = (r: number, ppc: number) => {
    const vte = 0.05
    const dx = 0.1
    const wp = (r * vte) / dx // Δx/λ_D = r
    return { s: createEmPic({ nx: 64, dx, periodic: true, density: () => wp * wp, ppc, TeKeV: vte * vte * 510.99895, seed: 2 }), wp }
  }

  it('field noise energy falls as 1/(particles per cell) and matches the fluctuation estimate within 15%', () => {
    const measure = (ppc: number) => {
      const { s, wp } = thermal(1, ppc)
      while (s.t * wp < 20) stepEmPic(s, 10)
      let acc = 0
      let m = 0
      while (s.t * wp < 120) {
        stepEmPic(s, 5)
        acc += energies(s).ex / (0.5 * meanUx2(s) * wp * wp * s.L)
        m++
      }
      return acc / m
    }
    const r16 = measure(16)
    const r128 = measure(128)
    expect(Math.abs(r16 / noiseRatio(16, 1) - 1)).toBeLessThan(0.15)
    expect(Math.abs(r128 / noiseRatio(128, 1) - 1)).toBeLessThan(0.15)
    expect(Math.abs(r16 / r128 / 8 - 1)).toBeLessThan(0.15)
  })

  it('grid heating: harmless at Δx ≈ λ_D, strong at Δx = 8λ_D', () => {
    const heat = (r: number) => {
      const { s, wp } = thermal(r, 50)
      const u0 = meanUx2(s)
      while (s.t * wp < 200) stepEmPic(s, 10)
      return meanUx2(s) / u0
    }
    expect(Math.abs(heat(1) - 1)).toBeLessThan(0.03)
    expect(heat(8)).toBeGreaterThan(1.5)
  })
})

describe('stimulated Raman scattering', () => {
  it('homogeneous periodic box: plasma wave and backscatter grow at the SRS rate (within 25%), at the Raman frequency', () => {
    const n = 0.1
    const T = 1
    const a = 0.05
    const box = srsPeriodicBox(n, T)!
    const pr = srsPrediction(n, T, a, true)!
    const nx = Math.round(box.L / 0.15)
    const k0 = Math.sqrt(1 - n)
    const s = createEmPic({ nx, dx: box.L / nx, periodic: true, density: () => n, ppc: 48, TeKeV: T, pump: { a, k: k0 }, seed: 3 })
    const ts: number[] = []
    const epw: number[] = []
    const light: number[] = []
    const track = phaseTracker()
    let ph = 0
    let tph = NaN
    while (s.t < 8 / pr.gamma0) {
      stepEmPic(s, 4)
      const e = modeOf(s.ex, box.p)
      const b = modeOf(s.fm, box.p - box.m) // backscattered light: k_s = k − k0, moving to −x
      ts.push(s.t)
      epw.push(Math.hypot(e[0], e[1]))
      light.push(Math.hypot(b[0], b[1]))
      if (s.t > 4 / pr.gamma0) {
        ph = track(b[0], b[1])
        if (isNaN(tph)) tph = s.t
      }
    }
    // with Stokes and anti-Stokes light the full dispersion relation agrees with the formula here
    const kp = (2 * Math.PI * box.p) / box.L
    const full = fullDispersionGrowth(n, kp, k0, n + 3 * kp * kp * vteOf(T) ** 2, n, a, [pr.wek, pr.gamma0])
    expect(Math.abs(full / pr.gamma - 1)).toBeLessThan(0.02)
    const ge = growthFit(ts, epw)
    const gl = growthFit(ts, light)
    expect(ge.t1 - ge.t0).toBeGreaterThan(1.5 / pr.gamma) // a real exponential stretch, not two points
    expect(Math.abs(ge.g / pr.gamma - 1)).toBeLessThan(0.25)
    expect(Math.abs(gl.g / pr.gamma - 1)).toBeLessThan(0.25)
    // measured here: within about 5% of theory
    expect(Math.abs(ge.g / pr.gamma - 1)).toBeLessThan(0.1)
    const ws = Math.abs(ph) / (s.t - tph)
    expect(Math.abs(ws / pr.ws - 1)).toBeLessThan(0.02)
  }, 60000)

  const injected = (n: number, T: number, a0: number, tEnd: number): EmPic => {
    const slab = { x0: 15, x1: 115, ramp: 5, n }
    const s = createEmPic({ nx: 650, dx: 0.2, density: (x) => slabDensity(slab, x), ppc: 32, TeKeV: T, laser: laserDrive(a0), seed: 1 })
    while (s.t < tEnd) stepEmPic(s, 10)
    return s
  }

  it('laser into a slab: the backscattered spectrum peaks at the Raman frequency from matching (within 5%)', () => {
    const n = 0.15
    const T = 2
    const s = injected(n, T, 0.05, 1000)
    const pr = srsPrediction(n, T, 0.05)!
    const sp = spectrumOf(s, s.outL, 512)!
    const peak = peakFrequency(sp, 0.3, 0.95)
    expect(Math.abs(peak / pr.ws - 1)).toBeLessThan(0.05)
    const per = Math.round((2 * Math.PI) / (s.dt * s.dec))
    const R = meanSquare(s, s.outL, 8 * per) / meanSquare(s, s.inL, 8 * per)
    expect(R).toBeGreaterThan(0.01) // SRS has really grown out of the noise
    // electrons have been heated into a tail beyond 4 v_te
    let hot = 0
    let tot = 0
    for (let i = 0; i < s.np; i++) {
      if (!s.alive[i]) continue
      tot += s.w[i]
      if (s.ux[i] > 4 * vteOf(T)) hot += s.w[i]
    }
    expect(hot / tot).toBeGreaterThan(1e-3) // a Maxwellian has 3×10⁻⁵ there
  }, 60000)
})
