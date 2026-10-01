// A9: plasma dispersion function and the kinetic dispersion relations.
import { describe, expect, it } from 'vitest'
import { bumpRoot, faddeeva, ionAcousticDamping, ionAcousticDampingApprox, landauApprox, landauExact, ME_OVER_MP, plasmaZ } from './plasmaZ'

describe('plasma dispersion function', () => {
  it('matches reference values (scipy.special.wofz)', () => {
    const cases: [number, number, number, number][] = [
      [0, 0, 0, Math.sqrt(Math.PI)],
      [1, 0, -1.0761590138255368, 0.6520493321732922],
      [2, -0.3, -0.6153750048712467, -0.1096657782300344],
      [1.5, -1.2, 0.33969257752890974, -1.784935593219072],
    ]
    for (const [zr, zi, re, im] of cases) {
      const Z = plasmaZ([zr, zi])
      expect(Z[0]).toBeCloseTo(re, 9)
      expect(Z[1]).toBeCloseTo(im, 9)
    }
  })
  it('has the right asymptotics: Z(ζ) → −1/ζ − 1/(2ζ³) − 3/(4ζ⁵) for large real ζ', () => {
    const z = 20
    expect(plasmaZ([z, 0])[0]).toBeCloseTo(-1 / z - 1 / (2 * z ** 3) - 3 / (4 * z ** 5), 8)
  })
  it('w(z) satisfies the reflection formula across the real axis', () => {
    const w1 = faddeeva([0.7, -0.4])
    const w2 = faddeeva([-0.7, 0.4])
    // w(−z) = 2e^{−z²} − w(z)
    const zr = 0.7, zi = -0.4
    const er = Math.exp(-(zr * zr - zi * zi)) * Math.cos(-2 * zr * zi)
    const ei = Math.exp(-(zr * zr - zi * zi)) * Math.sin(-2 * zr * zi)
    expect(w2[0]).toBeCloseTo(2 * er - w1[0], 12)
    expect(w2[1]).toBeCloseTo(2 * ei - w1[1], 12)
  })
})

describe('Landau damping of Langmuir waves', () => {
  it('kλ_D = 0.5: ω = 1.4157 ω_p, γ = −0.1534 ω_p', () => {
    const [wr, wi] = landauExact(0.5)
    expect(wr).toBeCloseTo(1.4157, 3)
    expect(wi).toBeCloseTo(-0.1534, 3)
  })
  it('small-kλ_D formula agrees at long wavelength and fails at short', () => {
    expect(landauExact(0.15)[1]).toBeCloseTo(-8.553e-9, 11)
    expect(Math.abs(landauApprox(0.15) / -landauExact(0.15)[1] - 1)).toBeLessThan(0.1)
    expect(landauApprox(1) / -landauExact(1)[1]).toBeLessThan(0.2)
  })
})

describe('ion Landau damping', () => {
  it('is weak for T_e ≫ T_i (electron term only) and strong for T_e ≈ T_i', () => {
    const hot = ionAcousticDamping(100)
    expect(hot / (Math.sqrt(Math.PI / 8) * Math.sqrt(ME_OVER_MP))).toBeGreaterThan(0.9)
    expect(hot / ionAcousticDampingApprox(100)).toBeGreaterThan(0.9)
    expect(ionAcousticDamping(1)).toBeGreaterThan(0.4)
  })
  it('matches independent roots (scipy.special.wofz) quoted in the lesson', () => {
    // kλ_De = 0.1, hydrogen: −γ/ω_r = 0.4317 at T_e = T_i (T_e/T_i = 1.01 in the reference run), 0.0133 at 20
    expect(ionAcousticDamping(20)).toBeCloseTo(0.0133, 3)
    expect(Math.abs(ionAcousticDamping(1) / 0.43 - 1)).toBeLessThan(0.02)
    // Langmuir root at kλ_D = 0.3: ω = 1.15985, γ = −0.0126204
    const [wr, wi] = landauExact(0.3)
    expect(wr).toBeCloseTo(1.15985, 4)
    expect(wi / -0.0126204).toBeCloseTo(1, 3)
  })
})

describe('bump on tail', () => {
  it('has a growing root with phase velocity on the rising slope of the bump', () => {
    const r = bumpRoot(0.3)!
    expect(r[1]).toBeCloseTo(0.198, 2)
    const vphi = r[0] / 0.3
    expect(vphi).toBeGreaterThan(3)
    expect(vphi).toBeLessThan(4.5)
  })
})
