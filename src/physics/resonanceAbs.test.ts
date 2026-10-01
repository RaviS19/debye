// B3 benchmarks: the full-wave p- and s-polarized solver against the limits the lesson teaches.
import { describe, expect, it } from 'vitest'
import {
  absorption,
  collisionalAbsLinear,
  DENISOV_SMALL_TAU,
  denisovAbs,
  exactAbs,
  F_MAX,
  solveWave,
  TAU_OPT,
  thetaOfTau,
} from './resonanceAbs'

const deg = Math.PI / 180

describe('resonance absorption is independent of the damping when the damping is weak', () => {
  for (const k0L of [50, 200]) {
    it(`k0L = ${k0L}, τ = 0.7: ν_c/ω = 1e-6 and 1e-7 agree within 2%, and both match the ν → 0+ contour`, () => {
      const th = thetaOfTau(k0L, 0.7)
      const a = absorption(k0L, th, 1e-6, 'p')
      const b = absorption(k0L, th, 1e-7, 'p')
      const c = absorption(k0L, th, 0, 'p')
      expect(Math.abs(a / b - 1)).toBeLessThan(0.02)
      expect(Math.abs(b / c - 1)).toBeLessThan(0.01)
      expect(c).toBeGreaterThan(0.45)
    })
  }

  it('the resonant field is limited by the damping: peak |E_x| = |D_x|/(ε0 ν/ω) within 2%', () => {
    for (const nuc of [1e-3, 1e-4]) {
      const sol = solveWave({ k0L: 200, theta: thetaOfTau(200, 0.7), nuc, pol: 'p' })
      const peak = Math.max(...sol.ex)
      expect(Math.abs((peak * nuc) / sol.driver - 1)).toBeLessThan(0.02)
    }
  })

  it('energy is conserved: power dissipated in the plasma equals 1 − |r|² within 0.5%', () => {
    for (const [nuc, pol, th] of [
      [1e-3, 'p', 8],
      [1e-4, 'p', 6],
      [2e-3, 's', 20],
    ] as const) {
      const sol = solveWave({ k0L: 200, theta: th * deg, nuc, pol })
      expect(Math.abs(sol.fDiss / sol.fA - 1)).toBeLessThan(0.005)
    }
  })
})

describe('s and p polarization', () => {
  it('at normal incidence p and s give the same absorption (to 1e-6)', () => {
    for (const nuc of [2e-3, 5e-4]) {
      const p = absorption(200, 0, nuc, 'p')
      const s = absorption(200, 0, nuc, 's')
      expect(Math.abs(p - s)).toBeLessThan(1e-6)
    }
  })

  it('s-polarized light is absorbed only by collisions, matching B2’s 1 − exp(−(32/15)(ν_c/ω)k0L cos⁵θ) within 2%', () => {
    for (const [k0L, nuc] of [
      [200, 2e-3],
      [500, 4e-4],
    ]) {
      for (const th of [0, 20, 40]) {
        const f = absorption(k0L, th * deg, nuc, 's')
        const wkb = collisionalAbsLinear(nuc, k0L, th * deg)
        expect(Math.abs(f / wkb - 1)).toBeLessThan(0.02)
      }
    }
  })

  it('s-polarized absorption vanishes as ν → 0 while p-polarized does not', () => {
    const th = thetaOfTau(200, 0.7)
    expect(absorption(200, th, 1e-7, 's')).toBeLessThan(1e-4)
    expect(absorption(200, th, 1e-7, 'p')).toBeGreaterThan(0.45)
  })
})

describe('the Denisov curve: absorption depends only on τ = (k0L)^{1/3} sin θ', () => {
  it('collapses onto one function of τ for k0L = 50, 200, 800 within 2%, and matches the tabulated exact curve', () => {
    for (const tau of [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4]) {
      const fs = [50, 200, 800].map((k0L) => absorption(k0L, thetaOfTau(k0L, tau), 0, 'p'))
      const ref = exactAbs(tau)
      for (const f of fs) expect(Math.abs(f / ref - 1)).toBeLessThan(0.02)
    }
  })

  it(`peaks at τ = ${TAU_OPT} with f_A = ${F_MAX} (k0L = 800; golden-section search)`, () => {
    const k0L = 800
    const f = (t: number) => absorption(k0L, thetaOfTau(k0L, t), 0, 'p')
    let a = 0.4
    let b = 1.1
    const g = (Math.sqrt(5) - 1) / 2
    let c = b - g * (b - a)
    let d = a + g * (b - a)
    let fc = f(c)
    let fd = f(d)
    while (b - a > 2e-3) {
      if (fc > fd) {
        b = d
        d = c
        fd = fc
        c = b - g * (b - a)
        fc = f(c)
      } else {
        a = c
        c = d
        fc = fd
        d = a + g * (b - a)
        fd = f(d)
      }
    }
    const tOpt = (a + b) / 2
    // the brief remembered τ ≈ 0.8 ± 0.1; that is the peak of Ginzburg's approximate formula. The exact peak is lower.
    expect(Math.abs(tOpt - TAU_OPT)).toBeLessThan(0.01)
    expect(Math.abs(f(tOpt) - F_MAX)).toBeLessThan(0.003)
  })

  it('Ginzburg’s φ ≈ 2.3τe^{−2τ³/3} is exact as τ → 0 but overestimates the peak (0.855 at τ = 0.794 vs 0.494)', () => {
    expect(DENISOV_SMALL_TAU).toBeCloseTo(2.3, 2)
    const small = absorption(800, thetaOfTau(800, 0.05), 0, 'p')
    expect(Math.abs(small / denisovAbs(0.05) - 1)).toBeLessThan(0.02)
    const tauApprox = Math.cbrt(0.5)
    expect(denisovAbs(tauApprox)).toBeCloseTo(0.855, 3)
    expect(denisovAbs(tauApprox) / F_MAX).toBeGreaterThan(1.7)
  })

  it('a sweep stays inside the frame budget: one k0L = 630 solve takes under 3 ms', () => {
    const t0 = performance.now()
    for (let i = 0; i < 10; i++) absorption(630, (5 + i * 0.3) * deg, 1e-4, 'p')
    expect((performance.now() - t0) / 10).toBeLessThan(3)
  })
})
