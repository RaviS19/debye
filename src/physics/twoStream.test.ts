// A8: the two-stream instability in the 1D PIC code against cold-beam theory.
import { describe, expect, it } from 'vitest'
import { createTwoStream, K_CUTOFF, K_MAX_GROWTH, measuredTwoStream, OMEGA_B, stepTwoStream, twoStreamGamma } from './twoStream'

describe('cold two-stream theory', () => {
  it('peaks at γ = ω_b/2 for kv0 = (√3/2)ω_b and cuts off at √2', () => {
    expect(twoStreamGamma(K_MAX_GROWTH)).toBeCloseTo(0.5, 12)
    for (const K of [0.8, 0.85, 0.88, 0.95]) expect(twoStreamGamma(K)).toBeLessThanOrEqual(0.5)
    expect(twoStreamGamma(K_CUTOFF + 1e-6)).toBe(0)
    expect(twoStreamGamma(K_CUTOFF - 0.01)).toBeGreaterThan(0)
  })
  it('the growing root satisfies 1 = ω_b²/(ω − kv0)² + ω_b²/(ω + kv0)²', () => {
    for (const K of [0.3, 0.866, 1.2]) {
      const g = twoStreamGamma(K) // ω = iγ in units of ω_b; (iγ ∓ K)² = K² − γ² ∓ 2iγK
      const a = K * K - g * g
      const b = 2 * g * K
      // 1/(a − ib) + 1/(a + ib) = 2a/(a² + b²)
      expect((2 * a) / (a * a + b * b)).toBeCloseTo(1, 10)
    }
  })
})

describe('two-stream PIC', () => {
  const run = (K: number) => {
    const r = createTwoStream(K, { n: 16000 })
    while (r.pic.t < 40 && !measuredTwoStream(r)?.done) stepTwoStream(r, 10)
    return measuredTwoStream(r)!.gamma
  }
  it('fastest growth rate matches ω_b/2 = ω_pe/(2√2) within 2%', () => {
    const g = run(K_MAX_GROWTH)
    expect(Math.abs(g / (0.5 * OMEGA_B) - 1)).toBeLessThan(0.02)
  })
  it('growth rate follows the cold-beam curve on both sides of the peak', () => {
    for (const K of [0.3, 0.5, 1.2]) {
      const g = run(K)
      expect(Math.abs(g / (twoStreamGamma(K) * OMEGA_B) - 1)).toBeLessThan(0.03)
    }
  })
  it('near the cut-off (K = 1.4, slow growth) the fit still completes and agrees within 5%', () => {
    const K = 1.4
    const r = createTwoStream(K, { n: 16000 })
    while (r.pic.t < 90 && !measuredTwoStream(r)?.done) stepTwoStream(r, 10)
    const m = measuredTwoStream(r)!
    expect(m.done).toBe(true)
    expect(Math.abs(m.gamma / (twoStreamGamma(K) * OMEGA_B) - 1)).toBeLessThan(0.05)
  })
  it('beams faster than kv0 = √2 ω_b do not grow', () => {
    const r = createTwoStream(1.6, { n: 16000 })
    stepTwoStream(r, 600) // t = 30
    expect(Math.max(...r.amps)).toBeLessThan(5 * r.amps[0])
  })
})
