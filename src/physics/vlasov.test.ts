// A9: the Vlasov–Poisson solver against linear Landau theory.
import { describe, expect, it } from 'vitest'
import { averageF, createVlasov, peakFit, recurrenceTime, slopeFit, stepVlasov, totalEnergy } from './vlasov'
import { bumpRoot, landauExact } from './plasmaZ'

describe('Vlasov–Poisson', () => {
  it('linear Landau damping, kλ_D = 0.5, α = 0.01: γ ≈ −0.1534 ω_p and ω ≈ 1.4157 ω_p within 1.5%', () => {
    const s = createVlasov({ k: 0.5, alpha: 0.01 })
    stepVlasov(s, 400)
    const fit = peakFit(s.times, s.e1, Math.min(35, 0.5 * recurrenceTime(s)))!
    // reference root from scipy.special.wofz (independent of plasmaZ.ts): ω = 1.41566, γ = −0.153359
    expect(Math.abs(fit.gamma / -0.153359 - 1)).toBeLessThan(0.015)
    expect(Math.abs(fit.omega / 1.41566 - 1)).toBeLessThan(0.015)
    const [wr, wi] = landauExact(0.5)
    expect(Math.abs(fit.gamma / wi - 1)).toBeLessThan(0.015)
    expect(Math.abs(fit.omega / wr - 1)).toBeLessThan(0.015)
  })
  it('conserves particles and energy', () => {
    const s = createVlasov({ k: 0.5, alpha: 0.5 })
    const E0 = totalEnergy(s)
    const avg = new Float64Array(s.nv)
    averageF(s, avg)
    const n0 = avg.reduce((a, b) => a + b, 0)
    stepVlasov(s, 300)
    averageF(s, avg)
    expect(Math.abs(avg.reduce((a, b) => a + b, 0) / n0 - 1)).toBeLessThan(1e-6)
    expect(Math.abs(totalEnergy(s) / E0 - 1)).toBeLessThan(0.01)
  })
  it('bump on tail grows at the kinetic-theory rate within 3%', () => {
    const k = 0.3
    const r = bumpRoot(k)!
    const s = createVlasov({ k, alpha: 0.001, profile: 'bump' })
    stepVlasov(s, 450)
    const fit = slopeFit(s.times, s.e1, 3 / r[1], (r[1] * r[1]) / k)!
    expect(fit.done).toBe(true)
    expect(Math.abs(fit.gamma / r[1] - 1)).toBeLessThan(0.03)
  })
  it('trapping stops strong damping (α = 0.5): the field stays far above the linear prediction', () => {
    const s = createVlasov({ k: 0.5, alpha: 0.5 })
    stepVlasov(s, 400)
    const late = Math.max(...s.e1.slice(300))
    const linear = (0.5 / 0.5) * Math.exp(-0.1533 * 35)
    expect(late).toBeGreaterThan(5 * linear)
    // the behaviour the lesson describes: the envelope drops by a factor of about 30 (t ≈ 15–20),
    // then recovers to about a sixth of its start by t ≈ 40
    const env = (a: number, b: number) => Math.max(...s.e1.filter((_, i) => s.times[i] >= a && s.times[i] < b))
    expect(env(15, 20) / s.e1[0]).toBeLessThan(0.06)
    expect(env(15, 20) / s.e1[0]).toBeGreaterThan(0.02)
    expect(env(35, 40) / s.e1[0]).toBeGreaterThan(0.1)
  })
})
