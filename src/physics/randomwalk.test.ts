// A7 benchmark: the random walk across B reproduces classical diffusion D⊥ = (kT/mν)/(1 + ω_c²/ν²).
//
// The gyration between collisions is exact, so the only error is sampling noise: for N particles the
// relative standard deviation of ⟨Δx²⟩ is about 1/√N (1.6% for N = 4000, measured 1.1–1.8% over 12
// seeds). Tolerances are ~3σ; the finite-time curve is used where the 1/t approach to D matters.
import { describe, expect, it } from 'vitest'
import { advanceWalkers, createWalkers, dPerp, measuredD, msd, theoryMSD } from './randomwalk'

function measure(w: number, seed = 11, n = 4000, T = 60) {
  const ws = createWalkers(n, w, seed)
  while (ws.t < T - 1e-9) advanceWalkers(ws, 0.1)
  return { ws, D: measuredD(ws) }
}

describe('random walk across B', () => {
  for (const w of [0, 1, 3]) {
    it(`ω_c/ν = ${w}: ⟨Δx²⟩ matches the exact curve and ⟨Δx²⟩/2t → D⊥ = (kT/mν)/(1 + ω_c²/ν²)`, () => {
      const { ws, D } = measure(w)
      expect(Math.abs(msd(ws) / theoryMSD(ws.t, w) - 1)).toBeLessThan(0.05)
      // at t = 60ν⁻¹ the ballistic start still biases ⟨Δx²⟩/2t by up to 1/(νt) ≈ 1.7%
      expect(Math.abs(D / dPerp(w) - 1)).toBeLessThan(0.06)
    })
  }

  it('at large ω_c/ν, D⊥ falls as 1/B² (doubling B quarters D⊥)', () => {
    const d4 = measure(4, 5).D
    const d8 = measure(8, 6).D
    // the exact classical ratio is (1+16)/(1+64) = 0.2615; pure 1/B² would be 0.25
    expect(Math.abs(d8 / d4 / (17 / 65) - 1)).toBeLessThan(0.07)
    expect(Math.abs(d8 * (1 + 64) - 1)).toBeLessThan(0.06)
  })

  it('early motion is ballistic and follows the exact ⟨Δx²⟩(t) curve', () => {
    const ws = createWalkers(4000, 2, 3)
    for (const tStop of [0.3, 1, 3]) {
      while (ws.t < tStop - 1e-9) advanceWalkers(ws, 0.05)
      expect(Math.abs(msd(ws) / theoryMSD(ws.t, 2) - 1)).toBeLessThan(0.05)
    }
    expect(theoryMSD(0.01, 2)).toBeCloseTo(1e-4, 6) // ⟨Δx²⟩ ≈ (kT/m) t² at first
    // and the long-time slope of the exact curve is 2D⊥
    expect((theoryMSD(1000, 2) - theoryMSD(900, 2)) / 200).toBeCloseTo(dPerp(2), 10)
  })

  it('collisions happen at rate ν and velocities stay Maxwellian', () => {
    const { ws } = measure(3, 9, 2000, 20)
    let hits = 0
    let v2 = 0
    for (let i = 0; i < ws.n; i++) {
      hits += ws.collisions[i]
      v2 += ws.vx[i] ** 2 + ws.vy[i] ** 2
    }
    expect(Math.abs(hits / ws.n / 20 - 1)).toBeLessThan(0.03)
    expect(Math.abs(v2 / (2 * ws.n) - 1)).toBeLessThan(0.05) // ⟨v_x²⟩ = kT/m
  })

  it('stays finite at the slider extremes and beyond', () => {
    for (const w of [0, 1e-9, 5, 1e4]) {
      const ws = createWalkers(500, w, 2)
      for (let k = 0; k < 100; k++) advanceWalkers(ws, 0.2)
      expect(Number.isFinite(msd(ws))).toBe(true)
      expect(Math.abs(msd(ws) / theoryMSD(ws.t, w) - 1)).toBeLessThan(0.2)
    }
  })
})
