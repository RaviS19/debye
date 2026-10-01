// A7 formula checks: Spitzer's constant from first principles, Bohm, and diffusive decay of a slab.
import { describe, expect, it } from 'vitest'
import { e, eps0, me } from './constants'
import { bohmD, classicalDperp, coulombLog, freeD, slabDecayTime, slabProfile, spitzerPar, spitzerPerp, tauE } from './classicalTransport'

describe('transport formulas', () => {
  it('τ_e matches its first-principles form and Spitzer η∥ = 0.51 m_e/(n e² τ_e) ≈ 5.2×10⁻⁵ lnΛ/T^{3/2}', () => {
    const T = 1 // eV
    const exact = (6 * Math.SQRT2 * Math.PI ** 1.5 * eps0 ** 2 * Math.sqrt(me) * (T * e) ** 1.5) / (e ** 4)
    expect(Math.abs(tauE(1, 1, 1) / exact - 1)).toBeLessThan(0.01)
    const eta = (0.5129 * me) / (e * e * exact) // per unit lnΛ at 1 eV, density cancels
    expect(Math.abs(spitzerPar(1, 1) / eta - 1)).toBeLessThan(0.03)
    expect(spitzerPerp(100, 15) / spitzerPar(100, 15)).toBeCloseTo(1.98, 1)
    // a 1 keV plasma is about as good a conductor as copper (1.68×10⁻⁸ Ω·m)
    expect(spitzerPar(1000, 15)).toBeCloseTo(2.47e-8, 9)
  })

  it('Bohm, free diffusion, and the fully ionized classical D⊥ ∝ 1/B²', () => {
    expect(bohmD(100, 1)).toBeCloseTo(6.25, 10)
    expect(freeD(2, me, 1e8)).toBeCloseTo(3517.6, 0)
    const lnL = coulombLog(1e20, 1000)
    expect(lnL).toBeGreaterThan(14)
    expect(lnL).toBeLessThan(16)
    const d1 = classicalDperp(1e20, 1000, 1000, 1, lnL)
    expect(classicalDperp(1e20, 1000, 1000, 2, lnL) / d1).toBeCloseTo(0.25, 10)
    expect(bohmD(1000, 1) / d1).toBeGreaterThan(1e4) // Bohm would be catastrophically worse
  })

  it('a flat slab profile diffuses into the lowest cosine mode, decaying on τ = (L/π)²/D', () => {
    expect(slabProfile(0, 0)).toBeCloseTo(1, 2)
    expect(slabProfile(0.3, 1e-4)).toBeCloseTo(1, 2)
    // after a while only the lowest mode (4/π) cos(πx/L) e^{−t/τ₁} is left
    for (const x of [0, 0.2, 0.4]) {
      expect(slabProfile(x, 1.5) / ((4 / Math.PI) * Math.cos(Math.PI * x) * Math.exp(-1.5))).toBeCloseTo(1, 3)
    }
    expect(slabDecayTime(0.1, 1) * 1e3).toBeCloseTo(1.013, 3)
  })
})
