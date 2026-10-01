// A10 KdV benchmarks: soliton speed, shape preservation, mass conservation and the two-soliton phase shift.
import { describe, expect, it } from 'vitest'
import { createKdv, fft, findPeaks, mass, phaseShifts, solitonProfile, stepKdv, syncU, wrapDist } from './kdv'

describe('FFT', () => {
  it('round-trips and matches a single mode', () => {
    const N = 64
    const re = new Float64Array(N)
    const im = new Float64Array(N)
    for (let j = 0; j < N; j++) re[j] = Math.cos((2 * Math.PI * 3 * j) / N)
    fft(re, im)
    expect(re[3]).toBeCloseTo(N / 2, 9)
    expect(re[N - 3]).toBeCloseTo(N / 2, 9)
    fft(re, im, true)
    expect(re[5] / N).toBeCloseTo(Math.cos((2 * Math.PI * 15) / N), 12)
  })
})

describe('KdV solver', () => {
  it('a single soliton moves at c = height/3 (within 3%) and keeps its shape', () => {
    const c = 1
    const L = 100
    const s = createKdv(256, L, 0.02, [{ c, x0: 20 }])
    const m0 = mass(s)
    const T = 30
    const steps = Math.round(T / s.dt)
    for (let i = 0; i < steps; i++) stepKdv(s)
    syncU(s)
    const pk = findPeaks(s, 1)[0]
    const speed = wrapDist(pk.x - 20, L) / s.t
    expect(Math.abs(speed / c - 1)).toBeLessThan(0.03)
    expect(Math.abs(speed / c - 1)).toBeLessThan(0.005) // in practice far better
    expect(pk.h).toBeCloseTo(3 * c, 2)
    // shape matches the analytic profile
    let err = 0
    for (let j = 0; j < s.N; j++) err = Math.max(err, Math.abs(s.u[j] - solitonProfile(wrapDist(s.x[j] - 20 - c * s.t, L), c, 0)))
    expect(err).toBeLessThan(0.02)
    expect(mass(s)).toBeCloseTo(m0, 10)
  })

  it('taller solitons are faster: speed ∝ height', () => {
    const L = 100
    const run = (c: number) => {
      const s = createKdv(256, L, 0.02, [{ c, x0: 10 }])
      for (let i = 0; i < 1000; i++) stepKdv(s)
      syncU(s)
      return wrapDist(findPeaks(s, c)[0].x - 10, L) / s.t
    }
    const v1 = run(0.5)
    const v2 = run(1.5)
    expect(v2 / v1).toBeCloseTo(3, 1)
  })

  it('two solitons pass through each other with the analytic phase shifts', () => {
    const L = 150
    const c1 = 1
    const c2 = 0.25
    const s = createKdv(512, L, 0.02, [{ c: c1, x0: 25 }, { c: c2, x0: 55 }])
    const T = 100
    for (let i = 0; i < Math.round(T / s.dt); i++) stepKdv(s)
    syncU(s)
    const pk = findPeaks(s, 0.4)
    expect(pk.length).toBe(2)
    const theory = phaseShifts(c1, c2)
    const fast = wrapDist(pk[0].x - (25 + c1 * s.t), L)
    const slow = wrapDist(pk[1].x - (55 + c2 * s.t), L)
    expect(pk[0].h).toBeCloseTo(3 * c1, 1) // both emerge unchanged
    expect(pk[1].h).toBeCloseTo(3 * c2, 1)
    // the peak finder is accurate to a small fraction of a grid cell (dx ≈ 0.3), so 1.5% is generous
    expect(Math.abs(fast / theory.fast - 1)).toBeLessThan(0.015)
    expect(Math.abs(slow / theory.slow - 1)).toBeLessThan(0.015)
  })

  it('stays stable with the sim grid (N = 512, L = 200, dt = 0.025) at the extreme slider heights', () => {
    for (const [A1, A2] of [[4.5, 0.3], [4.5, 1.2], [2.4, 0.3]]) {
      const c1 = A1 / 3
      const c2 = A2 / 3
      const s = createKdv(512, 200, 0.025, [{ c: c1, x0: 20 }, { c: c2, x0: 50 }])
      const tEnd = (200 - 30 - 20) / c1
      while (s.t < tEnd) stepKdv(s)
      syncU(s)
      for (const v of s.u) expect(Number.isFinite(v)).toBe(true)
      const pk = findPeaks(s, Math.min(0.4 * A2, 0.2))
      expect(pk.length).toBe(2)
      expect(pk[0].h).toBeCloseTo(A1, 1)
      expect(pk[1].h).toBeCloseTo(A2, 1)
      const th = phaseShifts(c1, c2)
      expect(Math.abs(wrapDist(pk[0].x - (20 + c1 * s.t), 200) / th.fast - 1)).toBeLessThan(0.03)
      expect(Math.abs(wrapDist(pk[1].x - (50 + c2 * s.t), 200) / th.slow - 1)).toBeLessThan(0.03)
    }
  })
})
