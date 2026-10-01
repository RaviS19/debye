// A11 fusion benchmarks: Bosch–Hale reactivities against the published table, the ignition minimum,
// and the power-balance relations behind the Lawson explorer.
import { describe, expect, it } from 'vitest'
import { argmin, bremsstrahlung, E_ALPHA, E_FUS, fusionPower, keV, nTauForQ, nTauForQBrems, nTauIgnitionBrems, qAt, qAtBrems, reactivity, svDT, tripleIgnition } from './fusion'

const rel = (a: number, b: number) => Math.abs(a / b - 1)

describe('Bosch–Hale reactivity', () => {
  it('D–T matches the tabulated values of Bosch & Hale (1992)', () => {
    // Table VIII of the paper, converted from cm³/s to m³/s
    const table: [number, number][] = [[1, 6.857e-27], [2, 2.977e-25], [5, 1.366e-23], [10, 1.136e-22], [20, 4.330e-22], [50, 8.649e-22]]
    for (const [T, sv] of table) expect(rel(svDT(T), sv)).toBeLessThan(0.002)
  })

  it('D–T is about 1.1e-22 m³/s at 10 keV and peaks near 8.9e-22 m³/s at about 67 keV', () => {
    expect(svDT(10)).toBeCloseTo(1.136e-22, 24)
    const Tpk = argmin((T) => -svDT(T), 20, 100)
    expect(Tpk).toBeGreaterThan(64)
    expect(Tpk).toBeLessThan(69)
    expect(rel(svDT(Tpk), 8.95e-22)).toBeLessThan(0.01)
  })

  it('D–D branches are nearly equal and about 100 times below D–T at 15 keV', () => {
    const n = reactivity('DDn', 10)
    const p = reactivity('DDp', 10)
    expect(rel(n, 6.02e-25)).toBeLessThan(0.01)
    expect(rel(p, 5.78e-25)).toBeLessThan(0.01)
    const ratio = (reactivity('DDn', 15) + reactivity('DDp', 15)) / svDT(15)
    expect(ratio).toBeGreaterThan(0.009)
    expect(ratio).toBeLessThan(0.012)
  })
})

describe('Lawson and ignition', () => {
  it('ignition triple product n T τ_E has its minimum ≈ 2.8e21 keV·s/m³ near 14 keV', () => {
    const Tmin = argmin(tripleIgnition, 5, 40)
    expect(Tmin).toBeGreaterThan(12.5)
    expect(Tmin).toBeLessThan(14.5)
    expect(rel(tripleIgnition(Tmin), 2.775e21)).toBeLessThan(0.01)
    expect(tripleIgnition(Tmin)).toBeGreaterThan(2.5e21)
    expect(tripleIgnition(Tmin)).toBeLessThan(3.2e21)
  })

  it('ignition is Q = ∞, and Q = 1 needs 6 times less n τ_E', () => {
    const T = 15
    expect(nTauForQ(T, Infinity)).toBeCloseTo((12 * T * keV) / (E_ALPHA * svDT(T)), -15)
    expect(nTauForQ(T, Infinity) / nTauForQ(T, 1)).toBeCloseTo(((1 + E_ALPHA / E_FUS) * E_FUS) / E_ALPHA, 6)
    expect(qAt(T, nTauForQ(T, 1))).toBeCloseTo(1, 9)
    expect(qAt(T, nTauForQ(T, 10))).toBeCloseTo(10, 7)
    expect(qAt(T, 2 * nTauForQ(T, Infinity))).toBe(Infinity)
  })

  it('fusion power density and ignition time for n = 1e20 m⁻³, T = 15 keV', () => {
    expect(fusionPower(1e20, 15) / 1e6).toBeCloseTo(1.93, 2)
    expect(nTauForQ(15, Infinity) / 1e20).toBeCloseTo(1.866, 2)
  })

  it('bremsstrahlung sets an ideal ignition temperature near 4.3 keV', () => {
    expect(nTauIgnitionBrems(4.2)).toBeNaN()
    expect(nTauIgnitionBrems(4.4)).toBeGreaterThan(0)
    // P_α = P_brems at 4.30 keV
    const f = (T: number) => Math.abs(0.25 * 1e40 * svDT(T) * E_ALPHA - bremsstrahlung(1e20, T))
    expect(argmin(f, 3, 6)).toBeCloseTo(4.3, 1)
  })
})

describe('Q with radiation', () => {
  it('is consistent with nTauForQBrems, and radiation lowers Q at fixed n τ_E', () => {
    for (const T of [8, 15, 30]) {
      for (const Q of [1, 10]) expect(qAtBrems(T, nTauForQBrems(T, Q))).toBeCloseTo(Q, 6)
      expect(qAtBrems(T, nTauForQ(T, 1))).toBeLessThan(1) // radiation lowers Q at fixed n τ_E
    }
    expect(nTauForQBrems(15, Infinity)).toBeCloseTo(nTauIgnitionBrems(15), -12)
  })
})
