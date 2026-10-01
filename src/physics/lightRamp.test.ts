// B1 benchmarks: Airy function, ray tracing in density ramps, and the full-wave field near a turning point.
import { describe, expect, it } from 'vitest'
import {
  AIRY_MAX,
  AIRY_ZMAX,
  NC_CM3_UM2,
  SWELL_COEF,
  airyAi,
  expRayDy,
  linearRayX,
  peakIntensity,
  quiverOverC,
  reflectionPhase,
  solveWave,
  swellingPeak,
  traceRay,
  wkbEnvelope,
  type Ramp,
} from './lightRamp'

const deg = Math.PI / 180

describe('constants and practical units', () => {
  it('critical density and quiver speed', () => {
    expect(NC_CM3_UM2 / 1e21).toBeCloseTo(1.1149, 3) // n_c ≈ 1.115×10²¹/λ² cm⁻³
    expect(quiverOverC(1e18, 1)).toBeCloseTo(0.855, 3) // v_os/c = 0.855 λ_µm √(I/10¹⁸)
    expect(quiverOverC(1e16, 1.053) / (0.855 * 1.053 * 0.1)).toBeCloseTo(1, 3)
  })
})

describe('Airy function', () => {
  // reference values from scipy.special.airy
  const ref: [number, number][] = [
    [-30, -0.08796818845684005],
    [-12.5, -0.2762745613811602],
    [-7.5, 0.3217757163806479],
    [-6.9, 0.10168799773976456],
    [-3.3, -0.4171809373745501],
    [0, 0.3550280538878172],
    [1.7, 0.05432479273291946],
  ]
  it('matches tabulated values', () => {
    for (const [x, v] of ref) expect(Math.abs(airyAi(x) - v)).toBeLessThan(1e-9)
    for (const [x, v] of [[4.9, 0.00013599211701506735], [5.1, 8.613242706478854e-5], [8, 4.6922076160992236e-8]]) {
      expect(Math.abs(airyAi(x) / v - 1)).toBeLessThan(1e-6)
    }
  })
  it('has its largest maximum 0.5357 at ζ = −1.0188, so 4π·max(Ai)² = 3.606', () => {
    expect(airyAi(AIRY_ZMAX)).toBeCloseTo(AIRY_MAX, 10)
    expect(airyAi(AIRY_ZMAX - 1e-3)).toBeLessThan(AIRY_MAX)
    expect(airyAi(AIRY_ZMAX + 1e-3)).toBeLessThan(AIRY_MAX)
    expect(SWELL_COEF).toBeCloseTo(3.6056, 4)
  })
})

describe('ray tracing (RK4 on dx/dt = ∂ω/∂k, dk/dt = −∂ω/∂x)', () => {
  it('turns at n_e = n_c cos²θ within 0.5% (linear and exponential ramps, three angles)', () => {
    for (const kind of ['linear', 'exp'] as const) {
      const L = 2 * Math.PI * 40 // L = 40 λ
      const r: Ramp = { kind, L }
      for (const th of [10, 30, 50]) {
        const t = th * deg
        const x0 = kind === 'linear' ? -0.3 * L : L * Math.log(1e-4)
        const ray = traceRay(r, x0, 0, t, L / 200, 40 * L, x0)
        expect(ray.turn).not.toBeNull()
        const want = Math.cos(t) ** 2
        expect(Math.abs(ray.turn!.u / want - 1)).toBeLessThan(0.005)
        // depth: L cos²θ into a linear ramp; L ln(cos²θ) relative to n_c for the exponential
        const depth = kind === 'linear' ? L * want : L * Math.log(want)
        expect(Math.abs(ray.turn!.x - depth) / L).toBeLessThan(0.005)
      }
    }
  })

  it('follows the analytic parabola x = y cot θ − y²/(4L sin²θ) in a linear ramp', () => {
    const L = 2 * Math.PI * 25
    const th = 35 * deg
    const r: Ramp = { kind: 'linear', L }
    const ray = traceRay(r, 0, 0, th, L / 150, 10 * L, -1)
    const yMax = 2 * L * Math.sin(2 * th)
    let worst = 0
    let checked = 0
    for (let i = 0; i < ray.n; i++) {
      const y = ray.ys[i]
      if (y > yMax) break
      worst = Math.max(worst, Math.abs(ray.xs[i] - linearRayX(y, L, th)))
      checked++
    }
    expect(checked).toBeGreaterThan(100)
    expect(worst / L).toBeLessThan(1e-9)
    // it leaves the ramp at y = 2L sin 2θ, at the mirror angle
    const exitY = ray.ys.find((_, i) => i > 10 && ray.xs[i] <= 0)!
    expect(Math.abs(exitY - yMax) / L).toBeLessThan(0.01)
  })

  it('takes the group delay 2L cos θ/c to reach the turning point of a linear ramp (round trip 4L/c at normal incidence)', () => {
    const L = 2 * Math.PI * 30
    for (const th of [0, 25, 50]) {
      const ray = traceRay({ kind: 'linear', L }, 0, 0, th * deg, L / 400, 6 * L, -1)
      expect(Math.abs(ray.turn!.t / (2 * L * Math.cos(th * deg)) - 1)).toBeLessThan(1e-6)
    }
  })

  it('follows the analytic path in an exponential ramp', () => {
    const L = 2 * Math.PI * 25
    const th = 30 * deg
    const r: Ramp = { kind: 'exp', L }
    const ray = traceRay(r, L * Math.log(1e-4), 0, th, L / 300, 20 * L, L * Math.log(1e-4))
    const yt = ray.turn!.y
    let worst = 0
    for (let i = 0; i < ray.n; i++) {
      const x = ray.xs[i]
      const y = ray.ys[i]
      if (y > yt) break // inbound branch only
      if (x < L * Math.log(1e-3)) continue
      worst = Math.max(worst, Math.abs(yt - y - expRayDy(x, L, th)))
    }
    expect(worst / L).toBeLessThan(2e-3)
  })
})

describe('full-wave field in a linear ramp (Helmholtz equation, RK4)', () => {
  it('peak |E|² and its position match the Airy solution within 1% for ωL/c = 50, 200, 1000', () => {
    for (const kL of [50, 200, 1000]) {
      const s = solveWave({ ramp: { kind: 'linear', L: kL }, h: 0.05 })
      expect(Math.abs(s.R - 1)).toBeLessThan(1e-6)
      const pk = peakIntensity(s)
      const theory = swellingPeak(kL)
      expect(Math.abs(pk.value / theory - 1)).toBeLessThan(0.01)
      const below = (kL - pk.x) / s.delta // distance below n_c in Airy widths
      expect(Math.abs(below / -AIRY_ZMAX - 1)).toBeLessThan(0.01)
    }
  })

  it('WKB: far from the turning point the standing-wave maxima follow 4/η within 2%', () => {
    for (const kL of [50, 200, 1000]) {
      const s = solveWave({ ramp: { kind: 'linear', L: kL }, h: 0.05 })
      const I = (i: number) => s.re[i] ** 2 + s.im[i] ** 2
      let n = 0
      let worst = 0
      for (let i = 1; i < s.n - 1; i++) {
        const zeta = (s.x[i] - kL) / s.delta
        if (s.x[i] <= 0 || zeta > -6) continue
        if (I(i) >= I(i - 1) && I(i) > I(i + 1)) {
          worst = Math.max(worst, Math.abs(I(i) / wkbEnvelope(s.x[i], kL) - 1))
          n++
        }
      }
      expect(n).toBeGreaterThan(3)
      expect(worst).toBeLessThan(0.02)
    }
  })

  it('reflects totally with phase (4/3)k0L − π/2, and swells as cos θ at oblique incidence', () => {
    const s = solveWave({ ramp: { kind: 'linear', L: 200 }, h: 0.05 })
    const ph = Math.atan2(s.rIm, s.rRe)
    const want = reflectionPhase(200)
    const d = Math.atan2(Math.sin(ph - want), Math.cos(ph - want))
    expect(Math.abs(d)).toBeLessThan(0.01)
    for (const th of [20, 40]) {
      const so = solveWave({ ramp: { kind: 'linear', L: 1000 }, theta: th * deg, h: 0.05 })
      expect(Math.abs(so.R - 1)).toBeLessThan(1e-6)
      expect(Math.abs(peakIntensity(so).value / swellingPeak(1000, th * deg) - 1)).toBeLessThan(0.01)
      expect(Math.abs(so.xTurn / (1000 * Math.cos(th * deg) ** 2) - 1)).toBeLessThan(1e-12)
    }
  })
})
