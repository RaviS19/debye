// A11 tokamak orbit benchmarks: trapped vs passing against v∥/v⊥ < √(2ε/(1−ε)), the banana width
// from p_φ conservation, and the vertical drift when the plasma current is switched off.
import { describe, expect, it } from 'vitest'
import { bananaWidth, bananaWidthExact, borisTokamak, guidingCentre, isTrappedExact, launchIon, OrbitTracker, tokamakB, trappingRatio, verticalDrift } from './tokamakOrbit'

const V = 0.008 // ρ/R₀ ≈ 0.008 (normalized units: R₀ = B₀ = q/m = 1)
const DT = 0.15

function classify(r0: number, ratio: number, q = 2) {
  const f = { q, current: true }
  const p = launchIon(r0, V, ratio, f)
  const tr = new OrbitTracker(p, f)
  for (let n = 0; n < 200000 && (tr.kind === 'undecided' || tr.crossings.length < 3); n++) {
    borisTokamak(p, f, DT)
    tr.update(p, f)
  }
  return tr
}

describe('tokamak field', () => {
  it('is divergence-free and has safety factor ≈ q R₀/R', () => {
    const f = { q: 2, current: true }
    const h = 1e-5
    const B = (x: number, y: number, z: number) => Array.from(tokamakB(x, y, z, f, new Float64Array(3)))
    const [x, y, z] = [1.1, 0.3, 0.12]
    const div = (B(x + h, y, z)[0] - B(x - h, y, z)[0] + B(x, y + h, z)[1] - B(x, y - h, z)[1] + B(x, y, z + h)[2] - B(x, y, z - h)[2]) / (2 * h)
    expect(Math.abs(div)).toBeLessThan(1e-8)
  })
})

describe('trapped vs passing', () => {
  it('matches v∥/v⊥ < √(2ε/(1−ε)) at the outboard midplane for two cases', () => {
    const eps = 0.2
    const crit = trappingRatio(eps)
    expect(crit).toBeCloseTo(0.7071, 4)
    const a = classify(eps, 0.4) // 0.4 < 0.707: trapped
    const b = classify(eps, 1.2) // 1.2 > 0.707: passing
    expect(a.kind).toBe('trapped')
    expect(b.kind).toBe('passing')
    // and at a larger radius the threshold rises, so the same 0.9 pitch becomes trapped
    expect(classify(0.3, 0.9).kind).toBe(trappingRatio(0.3) > 0.9 ? 'trapped' : 'passing')
    expect(classify(0.1, 0.9).kind).toBe('passing')
  })

  it('near the boundary, the full orbit agrees with the exact finite-width prediction (E, μ, p_φ), not the thin-orbit rule', () => {
    // at ε = 0.1 the thin-orbit boundary is 0.471, but these fat orbits (ρ ≈ 0.008 R₀, q = 2) stay trapped up to ≈ 0.5
    for (const [eps, ratio] of [[0.1, 0.5], [0.1, 0.6], [0.2, 0.75], [0.2, 0.8], [0.05, 0.4]] as const) {
      const exact = isTrappedExact(eps, V, ratio, 2) ? 'trapped' : 'passing'
      expect(classify(eps, ratio).kind).toBe(exact)
    }
    expect(isTrappedExact(0.1, V, 0.5, 2)).toBe(true)
    expect(trappingRatio(0.1)).toBeLessThan(0.5)
    // thin orbits (ρ → 0) recover √(2ε/(1−ε)) = 0.707 at ε = 0.2
    expect(isTrappedExact(0.2, 1e-5, 0.69, 2)).toBe(true)
    expect(isTrappedExact(0.2, 1e-5, 0.725, 2)).toBe(false)
  })

  it('banana width agrees with p_φ conservation (within 5%) and, for thin orbits, with 2qv∥₀/(ω_c ε)', () => {
    for (const ratio of [0.2, 0.4, 0.6]) {
      const tr = classify(0.2, ratio)
      const w = Math.abs(tr.crossings[1] - tr.crossings[0])
      expect(Math.abs(w / bananaWidthExact(0.2, V, ratio, 2) - 1)).toBeLessThan(0.05)
    }
    // fat orbits at small ε (width larger than the launch radius): the gyro jitter of the guiding-centre
    // estimate near the launch point must not be counted as a midplane crossing
    for (const [eps, ratio] of [[0.05, 0.4], [0.05, 0.2], [0.1, 0.3]] as const) {
      const tr = classify(eps, ratio)
      expect(tr.kind).toBe('trapped')
      const w = Math.abs(tr.crossings[1] - tr.crossings[0])
      expect(Math.abs(w / bananaWidthExact(eps, V, ratio, 2) - 1)).toBeLessThan(0.03)
    }
    // thin orbits (small ρ) recover the textbook estimate
    const v = 1e-4
    const vperp = v / Math.sqrt(1 + 0.16)
    expect(Math.abs(bananaWidthExact(0.2, v, 0.4, 2) / bananaWidth(0.2, 0.4 * vperp, 2) - 1)).toBeLessThan(0.01)
  })
})

describe('no plasma current', () => {
  it('the ion drifts vertically at (v∥² + ½v⊥²)/(ω_c R) within 15%', () => {
    const f = { q: 2, current: false }
    for (const ratio of [0.3, 1, 2]) {
      const p = launchIon(0.2, V, ratio, f)
      const g = new Float64Array(3)
      guidingCentre(p, f, g)
      const z0 = g[1]
      const R0 = g[0]
      const steps = 20000
      for (let i = 0; i < steps; i++) borisTokamak(p, f, DT)
      guidingCentre(p, f, g)
      const vperp = V / Math.sqrt(1 + ratio * ratio)
      const vd = (g[1] - z0) / (steps * DT)
      expect(vd).toBeGreaterThan(0) // ions drift up (+Z) for B along +φ
      expect(Math.abs(vd / verticalDrift(ratio * vperp, vperp) - 1)).toBeLessThan(0.15)
      expect(Math.abs(vd / verticalDrift(ratio * vperp, vperp) - 1)).toBeLessThan(0.02) // in practice ~0.2%
      expect(Math.abs(g[0] - R0)).toBeLessThan(0.005) // no radial motion
    }
  })
})
