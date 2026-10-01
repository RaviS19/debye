// A10 sheath benchmarks: the Bohm criterion, linear theory at the sheath edge, the floating
// potential, Child–Langmuir, the Sagdeev critical Mach number and the ponderomotive constant.
import { describe, expect, it } from 'vitest'
import { mp } from './constants'
import {
  childLangmuirJ,
  childLangmuirThickness,
  criticalMach,
  floatingPotential,
  integrateSheath,
  isMonotonic,
  linearRate,
  mAr,
  mD,
  measuredGrowth,
  measuredWavelength,
  ponderomotiveEV,
  sheathDrop,
  sheathSagdeev,
  solitonAmplitude,
  bohmSpeed,
} from './sheath'
import { e } from './constants'

describe('Bohm criterion', () => {
  it('gives a monotonic sheath for M = 1.2 that reaches the wall', () => {
    const p = integrateSheath(1.2, { chiWall: 3 })
    expect(p.reachedWall).toBe(true)
    expect(isMonotonic(p)).toBe(true)
  })

  it('gives a non-monotonic (oscillating) potential for M = 0.8', () => {
    const p = integrateSheath(0.8, { xMax: 40 })
    expect(isMonotonic(p)).toBe(false)
    expect(Math.max(...p.chi.subarray(0, p.n))).toBeLessThan(0.021) // never grows into a sheath
  })

  it('M = 1 is the marginal case and is still monotonic', () => {
    const p = integrateSheath(1.0, { chiWall: 3, xMax: 200 })
    expect(p.reachedWall).toBe(true)
    expect(isMonotonic(p)).toBe(true)
  })

  it('matches linear theory near the edge: growth √(1−1/M²) and wavelength 2π/√(1/M²−1)', () => {
    for (const M of [1.2, 1.5, 2]) {
      const k = measuredGrowth(integrateSheath(M, { chi0: 0.002 }))
      expect(Math.abs(k / linearRate(M) - 1)).toBeLessThan(0.03)
    }
    for (const M of [0.6, 0.8]) {
      const lam = measuredWavelength(integrateSheath(M, { chi0: 0.002, xMax: 80 }))
      expect(Math.abs(lam / ((2 * Math.PI) / linearRate(M)) - 1)).toBeLessThan(0.01)
    }
  })

  it('stays finite over the whole slider range (𝓜 = 0.5 to 2, H to Ar) with the sim settings', () => {
    for (const Mi of [mp, mD, mAr]) {
      for (let M = 0.5; M <= 2.0001; M += 0.05) {
        const p = integrateSheath(M, { chi0: 0.05, xMax: 30, h: 0.02, chiWall: sheathDrop(Mi, M) })
        for (let i = 0; i < p.n; i++) expect(Number.isFinite(p.chi[i])).toBe(true)
        expect(p.reflected).toBe(false)
        expect(isMonotonic(p)).toBe(M >= 1)
        if (M >= 1) expect(p.reachedWall).toBe(true)
      }
    }
  })

  it('conserves the first integral ½χ′² − S(χ)', () => {
    const p = integrateSheath(1.3, { chiWall: 5 })
    const I = (i: number) => 0.5 * p.dchi[i] ** 2 - sheathSagdeev(p.chi[i], 1.3)
    expect(Math.abs(I(p.n - 1) - I(0))).toBeLessThan(1e-8)
  })
})

describe('floating wall', () => {
  it('matches ½ ln(2πm_e/M) − ½ for H, D and Ar', () => {
    expect(floatingPotential(mp)).toBeCloseTo(-3.339, 3)
    expect(floatingPotential(mD)).toBeCloseTo(-3.685, 3)
    expect(floatingPotential(mAr)).toBeCloseTo(-5.179, 3)
    // sheath drop plus the ½ presheath drop, with the flux balance at M = 1
    for (const Mi of [mp, mD, mAr]) expect(-(sheathDrop(Mi, 1) + 0.5)).toBeCloseTo(floatingPotential(Mi), 12)
  })

  it('Child–Langmuir thickness is consistent with the Bohm flux', () => {
    // J_CL(V, d) with d from the thickness formula equals e n c_s, for T_e = 2 eV, n = 1e16, V = 200 V
    const Te = 2
    const n = 1e16
    const lD = Math.sqrt((8.8541878128e-12 * Te) / (n * e))
    const d = childLangmuirThickness(200 / Te) * lD
    expect(d * 1e3).toBeCloseTo(2.636, 2)
    expect(childLangmuirJ(200, d) / (e * n * bohmSpeed(Te, mp))).toBeCloseTo(1, 10)
  })
})

describe('ion acoustic solitons and the ponderomotive potential', () => {
  it('critical Mach number is 1.585', () => {
    expect(criticalMach()).toBeCloseTo(1.585, 3)
    expect(solitonAmplitude(1.7)).toBeNaN()
  })

  it('small solitons approach the KdV amplitude 3(M − 1)', () => {
    expect(solitonAmplitude(1.02) / 0.06).toBeGreaterThan(0.97)
    expect(solitonAmplitude(1.1)).toBeCloseTo(0.2795, 3)
  })

  it('U_p = 9.34e-14 I λ² eV', () => {
    expect(ponderomotiveEV(1, 1) / 9.337e-14).toBeCloseTo(1, 3)
    expect(ponderomotiveEV(1e15, 1.053)).toBeCloseTo(103.5, 0)
  })
})
