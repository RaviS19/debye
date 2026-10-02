// B7 benchmarks for two-plasmon decay: matching conditions, the geometry of maximum growth, and the gradient
// parameters that set the inhomogeneous threshold.
import { describe, expect, it } from 'vitest'
import { hyperbolaKperp, MEC2_KEV, plasmonKz, tpdEta, tpdGammaMax, tpdGrowth, tpdLambda, tpdMatch, tpdMatchDensity, tpdThresholdIntensity } from './tpd'

describe('TPD matching and growth', () => {
  it('matched decays satisfy ω1 + ω2 = ω0 and k1 + k2 = k0 with Bohm–Gross plasmons below n_c/4', () => {
    for (const T of [1, 2, 4]) {
      for (const kp of [-0.6, -0.2, 0.3, 1.2, 1.6, 2.2]) {
        const kq = Number.isNaN(hyperbolaKperp(kp)) ? 0.7 : hyperbolaKperp(kp)
        const m = tpdMatch(kp, kq, T)
        if (!m) continue
        expect(m.n).toBeLessThan(0.25)
        expect(m.n).toBeGreaterThan(0.1)
        expect(m.w1 + m.w2).toBeCloseTo(1, 10)
        // each plasmon obeys its dispersion relation, with k2 = k0 − k1 as vectors
        const b2 = T / MEC2_KEV
        const k1v = [kp * m.k0, kq * m.k0]
        const k2v = [m.k0 - k1v[0], -k1v[1]]
        expect(Math.hypot(k1v[0] + k2v[0], k1v[1] + k2v[1])).toBeCloseTo(m.k0, 12)
        expect(m.w1 ** 2).toBeCloseTo(m.n + 3 * b2 * Math.hypot(k1v[0], k1v[1]) ** 2, 12)
        expect(m.w2 ** 2).toBeCloseTo(m.n + 3 * b2 * Math.hypot(k2v[0], k2v[1]) ** 2, 12)
      }
    }
    // at T → 0 every pair is matched at quarter-critical
    expect(tpdMatch(1.5, Math.sqrt(0.75), 1e-6)!.n).toBeCloseTo(0.25, 5)
  })

  it('the closed-form matching density agrees with a direct bisection of ω1 + ω2 = ω0', () => {
    const bisect = (a2: number, c2: number, b2: number) => {
      const f = (n: number) => Math.sqrt(n + 3 * b2 * (1 - n) * a2) + Math.sqrt(n + 3 * b2 * (1 - n) * c2) - 1
      let lo = 1e-12
      let hi = 0.25
      if (f(lo) > 0 || f(hi) < 0) return NaN
      for (let i = 0; i < 100; i++) {
        const m = 0.5 * (lo + hi)
        if (f(m) > 0) hi = m
        else lo = m
      }
      return 0.5 * (lo + hi)
    }
    let found = 0
    let none = 0
    for (const T of [0.5, 2, 5]) {
      const b2 = T / MEC2_KEV
      for (let kp = -3; kp <= 4; kp += 0.37) {
        for (let kq = 0; kq <= 4; kq += 0.29) {
          const a2 = kp * kp + kq * kq
          const c2 = (kp - 1) ** 2 + kq * kq
          const exact = bisect(a2, c2, b2)
          const closed = tpdMatchDensity(a2, c2, b2)
          if (Number.isNaN(exact)) {
            expect(Number.isNaN(closed)).toBe(true)
            none++
          } else {
            expect(closed).toBeCloseTo(exact, 10)
            found++
          }
        }
      }
    }
    expect(found).toBeGreaterThan(100)
    expect(none).toBeGreaterThan(10) // very short plasmons at 5 keV cannot be matched at any density
  })

  it('maximum homogeneous growth k0 v_os/4 lies on the hyperbola k⊥² = k∥(k∥ − k0)', () => {
    let best = 0
    let at = [0, 0]
    for (let kp = -3; kp <= 4; kp += 0.01) {
      for (let kq = 0.005; kq <= 4; kq += 0.01) {
        const g = tpdGrowth(kp, kq)
        if (g > best) {
          best = g
          at = [kp, kq]
        }
      }
    }
    expect(best).toBeCloseTo(0.25, 4)
    expect(Math.abs(at[1] ** 2 - at[0] * (at[0] - 1))).toBeLessThan(0.05)
    for (const kp of [-1.5, -0.4, 1.1, 1.7, 3]) {
      expect(tpdGrowth(kp, hyperbolaKperp(kp))).toBeCloseTo(0.25, 12)
      expect(tpdGrowth(kp, 1.2 * hyperbolaKperp(kp))).toBeLessThan(0.25)
      expect(tpdGrowth(2 * kp, 2 * hyperbolaKperp(kp), 2)).toBeCloseTo(0.5, 12) // ∝ k0
    }
    // inside 0 < k∥ < k0 the growth is below the maximum
    for (let kq = 0.05; kq < 3; kq += 0.05) expect(tpdGrowth(0.7, kq)).toBeLessThan(0.25 * 0.41)
  })

  it('in a gradient |κ′ v1 v2| = (3/2) k0 v_te²/L, independent of k⊥ (the Rosenbluth denominator)', () => {
    const T = 2
    const b2 = T / MEC2_KEV
    const L = 2000 // c/ω0
    for (const [kp, kq] of [[0.3, 0.8], [0.6, 0.3], [0.45, 1.4]]) {
      const m = tpdMatch(kp, kq, T)!
      const kperp = kq * m.k0
      const mism = (z: number) => {
        const n = m.n * (1 + z / L)
        return Math.sqrt(1 - n) - plasmonKz(m.w1, kperp, n, b2) - plasmonKz(m.w2, kperp, n, b2)
      }
      const dz = 0.5
      const kappaP = (mism(dz) - mism(-dz)) / (2 * dz)
      const v1 = (3 * b2 * plasmonKz(m.w1, kperp, m.n, b2)) / m.w1
      const v2 = (3 * b2 * plasmonKz(m.w2, kperp, m.n, b2)) / m.w2
      const theory = (1.5 * m.k0 * b2) / L // with ω1 ≈ ω2 ≈ ω_pe
      const exact = (theory * m.n) / (m.w1 * m.w2) // keeping ω1ω2 ≠ ω_pe²
      expect(Math.abs((kappaP * v1 * v2) / exact - 1)).toBeLessThan(0.005)
      expect(Math.abs((kappaP * v1 * v2) / theory - 1)).toBeLessThan(0.1)
    }
  })

  it('practical numbers: Λ = 0.0127 I14 L λ/T, η = 1 at Λ ≈ 1.04, γ_max at 5×10¹⁴ W/cm² and 0.351 µm', () => {
    expect(tpdLambda(1e14, 1, 1, 1)).toBeCloseTo(0.0127, 4)
    expect(tpdLambda(1e14, 82, 1, 1)).toBeCloseTo(1.04, 2)
    expect(tpdEta(8e14, 150, 0.351, 2)).toBeCloseTo(2.57, 2)
    expect(tpdThresholdIntensity(150, 0.351, 2) / 1e14).toBeCloseTo(3.11, 2)
    expect(tpdGammaMax(5e14, 0.351) / 1e12).toBeCloseTo(7.8, 1)
  })
})
