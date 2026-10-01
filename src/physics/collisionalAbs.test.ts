// B2 benchmarks: the collision frequency, full-wave inverse-bremsstrahlung absorption against the analytic
// ramp formulas, energy conservation, and the Langdon factor.
import { describe, expect, it } from 'vitest'
import { tauE } from './classicalTransport'
import {
  absorptionExp,
  absorptionLinear,
  absorptionParams,
  langdonAlpha,
  langdonFactor,
  matteExponent,
  nuEI,
  solveAbsorption,
  solveWaveNumerov,
  superGaussianF0Ratio,
  type AbsorptionSetup,
} from './collisionalAbs'
import { solveWave } from './lightRamp'

const deg = Math.PI / 180

describe('electron–ion collision frequency', () => {
  it('matches an independent Python evaluation and the practical form', () => {
    // python: Z lnΛ e⁴ n / (6√2 π^{3/2} ε0² √m_e (kT)^{3/2})
    expect(nuEI(1e27, 1000, 1, 7) / 643340673695.4332 - 1).toBeCloseTo(0, 9)
    expect(nuEI(9.049e27, 2000, 3.5, 6.3) / 6483464810462.808 - 1).toBeCloseTo(0, 9)
    // 2.91×10⁻⁶ Z n_e[cm⁻³] lnΛ / T_eV^{3/2}
    expect(nuEI(1e27, 1000, 1, 7) / ((2.91e-6 * 1e21 * 7) / 1000 ** 1.5)).toBeCloseTo(1, 2)
    // the same as A7's Braginskii 1/τ_e for Z = 1
    expect(nuEI(1e20, 1000, 1, 15) * tauE(1e20, 1000, 15)).toBeCloseTo(1, 2)
  })
})

/** Full-wave absorbed fraction with ν/ω = (ν_c/ω) n/n_c in a ramp of k0L = ωL/c. */
function fullWave(kind: 'linear' | 'exp', k0L: number, q: number, thetaDeg = 0) {
  return solveWave({
    ramp: kind === 'linear' ? { kind, L: k0L } : { kind, L: k0L, ncut: 0.001 },
    theta: thetaDeg * deg,
    nuc: q / k0L, // ν_c/ω = (ν_c L/c)/(ωL/c)
    h: 0.1,
  })
}

describe('full-wave absorption in a ramp (E″ + k0²(ε − sin²θ)E = 0, ε = 1 − u/(1 + iν/ω))', () => {
  it('linear ramp: 1 − |r|² = 1 − exp(−32ν_cL/15c) within 3% for ν_cL/c = 0.05, 0.5, 2', () => {
    for (const q of [0.05, 0.5, 2]) {
      const s = fullWave('linear', 300, q)
      expect(Math.abs((1 - s.R) / absorptionLinear(q) - 1)).toBeLessThan(0.03)
    }
  })

  it('oblique s-polarized light follows cos⁵θ within 3% at 20° and 40°', () => {
    for (const th of [20, 40]) {
      for (const q of [0.1, 0.5]) {
        const s = fullWave('linear', 500, q, th)
        expect(Math.abs((1 - s.R) / absorptionLinear(q, th * deg) - 1)).toBeLessThan(0.03)
      }
    }
  })

  it('exponential ramp: 1 − exp(−(8/3)(ν_cL/c) cos³θ) within 3%', () => {
    for (const q of [0.05, 0.5, 2]) {
      for (const th of [0, 30]) {
        const s = fullWave('exp', 200, q, th)
        expect(Math.abs((1 - s.R) / absorptionExp(q, th * deg) - 1)).toBeLessThan(0.03)
      }
    }
  })

  it('conserves energy: 1 − |r|² equals the integrated heating rate within 1%', () => {
    for (const [kind, q, th] of [['linear', 0.05, 0], ['linear', 2, 30], ['exp', 0.5, 20]] as const) {
      const s = fullWave(kind, 300, q, th)
      expect(Math.abs(s.heated / (1 - s.R) - 1)).toBeLessThan(0.01)
    }
  })

  it('in practical units: 351 nm light in a 100 µm CH-like ramp, full wave vs formula', () => {
    const setup: AbsorptionSetup = { lamUm: 0.351, TeV: 2000, Z: 3.5, Lum: 100, thetaDeg: 0, kind: 'linear', IWcm2: 1e14, langdon: false }
    const p = absorptionParams(setup)
    expect(p.nucOverOmega).toBeLessThan(0.01) // weakly collisional
    const s = solveAbsorption(setup)
    expect(Math.abs((1 - s.R) / p.formula - 1)).toBeLessThan(0.03)
    // ν_c L/c ∝ Z lnΛ L/(λ² T^{3/2}): 1053 nm has ~9× (times the lnΛ ratio) less
    const p1 = absorptionParams({ ...setup, lamUm: 1.053 })
    expect((p.q / p1.q) * (p1.lnL / p.lnL)).toBeCloseTo((1.053 / 0.351) ** 2, 6)
  })
})

describe('Numerov full-wave solver (used by the sim for long ramps)', () => {
  it('agrees with the RK4 solver and conserves energy where RK4 at the same step would not', () => {
    for (const [kind, k0L, q, th] of [['linear', 300, 0.5, 0], ['linear', 500, 0.1, 40], ['exp', 200, 2, 30]] as const) {
      const ramp = kind === 'linear' ? { kind, L: k0L } : { kind, L: k0L, ncut: 0.001 }
      const a = solveWave({ ramp, theta: th * deg, nuc: q / k0L, h: 0.05 })
      const b = solveWaveNumerov({ ramp, theta: th * deg, nuc: q / k0L, h: 0.25 })
      expect(Math.abs(b.R - a.R)).toBeLessThan(2e-4)
      expect(Math.abs(b.heated / (1 - b.R) - 1)).toBeLessThan(1e-3)
    }
    // 351 nm, 500 µm exponential ramp, 500 eV: the light is absorbed long before it turns (ν_cL/c ≈ 19)
    const s: AbsorptionSetup = { lamUm: 0.351, TeV: 500, Z: 1, Lum: 500, thetaDeg: 0, kind: 'exp', IWcm2: 1e14, langdon: false }
    const w = solveAbsorption(s)
    expect(1 - w.R).toBeGreaterThan(0.9999)
    expect(Math.abs(w.heated - (1 - w.R))).toBeLessThan(1e-3)
  })
})

describe('Langdon effect', () => {
  it('fit has the right limits and matches the super-Gaussian f(0) of Matte’s m(α) within 0.5%', () => {
    expect(langdonFactor(0)).toBe(1)
    expect(langdonFactor(1e9)).toBeCloseTo(0.447, 3)
    expect(matteExponent(1e-12)).toBeCloseTo(2, 6)
    expect(matteExponent(1e12)).toBeCloseTo(5, 3)
    expect(superGaussianF0Ratio(2)).toBeCloseTo(1, 10)
    expect(superGaussianF0Ratio(5)).toBeCloseTo(0.4456, 4)
    for (const a of [0.01, 0.1, 0.3, 1, 3, 10, 100]) {
      expect(Math.abs(langdonFactor(a) / superGaussianF0Ratio(matteExponent(a)) - 1)).toBeLessThan(0.005)
    }
  })

  it('α = Z v_os²/v_te² with v_os = eE0/m_eω and v_te = √(kT_e/m_e)', () => {
    // 10¹⁵ W/cm², 351 nm: v_os/c = 0.855·0.351·√(10⁻³); 2 keV: v_te/c = √(2/510.999)
    const vos = 0.8549297 * 0.351 * Math.sqrt(1e-3)
    const vte2 = 2 / 510.99895
    expect(langdonAlpha(1e15, 0.351, 2000, 1) / ((vos * vos) / vte2)).toBeCloseTo(1, 5)
    expect(langdonAlpha(1e15, 0.351, 2000, 40) / langdonAlpha(1e15, 0.351, 2000, 1)).toBeCloseTo(40, 10)
  })
})
