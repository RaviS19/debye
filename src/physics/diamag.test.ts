// A4 benchmark: particles that only gyrate about fixed guiding centres still carry the diamagnetic flux
// Γ_y = (1/qB) dp/dx = n v_D through any line in a density or temperature gradient.
import { describe, expect, it } from 'vitest'
import { advanceDiamag, createDiamag, densityAt, lineFlux, measuredFlux, theoryDrift, theoryFlux, type DiamagInit } from './diamag'

const base: DiamagInit = { n: 4000, Lx: 32, Ly: 20, gn: 0.04, gT: 0, charge: 1 }
const run = (o: Partial<DiamagInit>, periods = 6, dt = 0.1) => {
  const d = createDiamag({ ...base, ...o })
  const steps = Math.round((periods * 2 * Math.PI) / dt)
  for (let s = 0; s < steps; s++) advanceDiamag(d, dt, 4)
  return d
}

describe('diamagnetic flux from fixed guiding centres', () => {
  it('loads a 2D Maxwellian: ⟨ρ²⟩ = 2 kT/(m ω_c²) and a linear density profile', () => {
    const d = createDiamag({ ...base, gn: 0.05 })
    let r2 = 0
    for (let i = 0; i < d.N; i++) r2 += d.rho[i] ** 2
    expect(r2 / d.N).toBeGreaterThan(1.98)
    expect(r2 / d.N).toBeLessThan(2.02)
    // guiding-centre counts in the left and right quarters follow n ∝ 1 + g(x − Lx/2)
    let left = 0
    let right = 0
    for (let i = 0; i < d.N; i++) {
      if (d.X[i] < 8) left++
      else if (d.X[i] > 24) right++
    }
    expect(left / right).toBeCloseTo(densityAt(d, 4) / densityAt(d, 28), 2)
  })

  it('density gradient: net flux across the band equals n v_D within 5%', () => {
    for (const gn of [0.02, 0.04, 0.055]) {
      const d = run({ gn })
      const th = theoryFlux(d)
      expect(Math.abs(measuredFlux(d) / th - 1)).toBeLessThan(0.05)
      expect(th).toBeCloseTo(densityAt(d, d.Lx / 2) * theoryDrift(d), 10) // Γ = n v_D
    }
  })

  it('electrons carry the opposite particle flux, so the same current', () => {
    const ion = run({ gn: 0.04, charge: 1 })
    const ele = run({ gn: 0.04, charge: -1 })
    expect(Math.sign(measuredFlux(ele))).toBe(-1)
    expect(Math.abs(measuredFlux(ele) / theoryFlux(ele) - 1)).toBeLessThan(0.05)
    expect(Math.abs(1 * measuredFlux(ion) - -1 * measuredFlux(ele))).toBeLessThan(0.1 * theoryFlux(ion)) // J = qΓ agrees
  })

  it('temperature gradient alone (uniform density) also drives the flux: Γ = (dp/dx)/qB', () => {
    const d = run({ gn: 0, gT: 0.04 })
    expect(Math.abs(measuredFlux(d) / theoryFlux(d) - 1)).toBeLessThan(0.05)
    const both = run({ gn: 0.03, gT: 0.03 })
    expect(Math.abs(measuredFlux(both) / theoryFlux(both) - 1)).toBeLessThan(0.05)
  })

  it('no gradient, no flux', () => {
    const d = run({ gn: 0, gT: 0 })
    expect(Math.abs(measuredFlux(d))).toBeLessThan(0.01 * densityAt(d, 16) * 0.04)
  })

  it('a single line: more particles cross one way than the other, net = n v_D within 10% (40 000 particles)', () => {
    const d = run({ n: 40000, gn: 0.04 }, 1, 0.1)
    expect(d.up).toBeGreaterThan(d.down)
    expect(Math.abs(lineFlux(d) / theoryFlux(d) - 1)).toBeLessThan(0.1)
  })
})
