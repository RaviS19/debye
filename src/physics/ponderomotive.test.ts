// B4 benchmarks: practical laser formulas against SI, test electrons in a focal spot against the ponderomotive
// (guiding-centre) theory, and the steepened density profile against pressure balance.
import { describe, expect, it } from 'vitest'
import { c, e, eps0, me } from './constants'
import {
  A0_COEF_CIRCULAR,
  A0_COEF_LINEAR,
  a0Of,
  criticalDensity,
  linearCheck,
  peakField,
  ponderomotiveEV,
  quiver,
  runElectron,
  steepDiagnostics,
  steepen,
  UP_COEF,
  type FocusParams,
} from './ponderomotive'

describe('practical formulas agree with the SI expressions', () => {
  it('a0 = 0.855 λ_µm √(I/10¹⁸ W cm⁻²) for linear polarization (0.604 for circular)', () => {
    expect(A0_COEF_LINEAR).toBeCloseTo(0.855, 3)
    expect(A0_COEF_CIRCULAR).toBeCloseTo(0.6045, 3)
    expect(A0_COEF_LINEAR / A0_COEF_CIRCULAR).toBeCloseTo(Math.SQRT2, 10)
    // a0 = 1 at Iλ² = 1.37×10¹⁸ W cm⁻² µm² (linear)
    expect(a0Of(1.368e18, 1)).toBeCloseTo(1, 3)
    // direct SI: I = ½ε0cE0², a0 = eE0/(m_e ω c)
    const I = 3e16
    const lam = 0.8
    const E0 = Math.sqrt((2 * I * 1e4) / (eps0 * c))
    const w = (2 * Math.PI * c) / (lam * 1e-6)
    expect(a0Of(I, lam) / ((e * E0) / (me * w * c)) - 1).toBeLessThan(1e-12)
    expect(Math.abs(a0Of(I, lam) / (0.855 * lam * Math.sqrt(I / 1e18)) - 1)).toBeLessThan(1e-3)
  })

  it('U_p[eV] = 9.34×10⁻¹⁴ I λ² equals e²E0²/(4m_eω²) = m_e v_os²/4 (linear) and e²E0²/(2m_eω²) (circular)', () => {
    expect(UP_COEF).toBeGreaterThan(9.33e-14)
    expect(UP_COEF).toBeLessThan(9.345e-14)
    for (const [I, lam] of [
      [1e15, 1.053],
      [1e14, 0.351],
      [1e13, 10.6],
    ]) {
      const w = (2 * Math.PI * c) / (lam * 1e-6)
      const E0 = peakField(I, 'linear')
      const lin = (e * e * E0 * E0) / (4 * me * w * w) / e
      expect(Math.abs(ponderomotiveEV(I, lam) / lin - 1)).toBeLessThan(1e-12)
      const { vos } = quiver(I, lam)
      expect(Math.abs((me * vos * vos) / 4 / e / lin - 1)).toBeLessThan(1e-12)
      const Ec = peakField(I, 'circular')
      expect(Math.abs((e * e * Ec * Ec) / (2 * me * w * w) / e / lin - 1)).toBeLessThan(1e-12)
      expect(Math.abs(ponderomotiveEV(I, lam) / (9.34e-14 * I * lam * lam) - 1)).toBeLessThan(0.002)
    }
    // n_c ≈ 1.115×10²¹/λ² cm⁻³
    expect(criticalDensity(1) * 1e-6).toBeCloseTo(1.115e21, -18)
  })
})

describe('test electrons in a focal spot (non-relativistic, a0 ≪ 1)', () => {
  const base: Omit<FocusParams, 'pol'> = { a0: 0.1, w: 20, tOn: 6 * Math.PI, vxb: true }
  const cases: [FocusParams, number, number][] = [
    [{ ...base, pol: 'linear' }, 10, 0],
    [{ ...base, pol: 'linear' }, 0, 10],
    [{ ...base, pol: 'circular' }, 6, 8],
    [{ ...base, a0: 0.05, w: 40, pol: 'linear' }, 15, 5],
  ]
  for (const [p, x0, y0] of cases) {
    const label = `${p.pol}, a0 = ${p.a0}, ωw/c = ${p.w}, start (${x0}, ${y0}) c/ω`
    it(`${label}: final drift energy = U_p(start) within 3%, slow path = ponderomotive path within 5%`, () => {
      const r = runElectron(p, x0, y0)
      expect(Math.abs(r.keFinal / r.upStart - 1)).toBeLessThan(0.03)
      const r0 = Math.hypot(x0, y0)
      let dev = 0
      for (const s of r.avg) {
        const R = Math.hypot(s.X, s.Y)
        if (R - r0 > 0.1 * p.w && R < 2.5 * p.w) dev = Math.max(dev, Math.abs(Math.hypot(s.x, s.y) - R) / (R - r0))
      }
      expect(dev).toBeLessThan(0.05)
      // quiver excursion eE/(mω²) = a0 f(r) c/ω at the electron's position
      const f = Math.exp(-(r.quiverAt * r.quiverAt) / (p.w * p.w))
      expect(Math.abs(r.quiverAmp / (p.a0 * f) - 1)).toBeLessThan(0.02)
    })
  }

  it('without the v × B force the push is −(e²/2mω²)(E·∇)E: an electron on the y axis, with E along x, gets no push along y', () => {
    const r = runElectron({ ...base, pol: 'linear', vxb: false }, 0, 10, 3, 1500)
    for (const s of r.avg) expect(Math.abs(s.y - 10)).toBeLessThan(1e-6)
    const last = r.avg[r.avg.length - 1]
    expect(Math.hypot(last.X, last.Y)).toBeGreaterThan(2 * base.w) // the ponderomotive prediction has long gone
  })

  it('without v × B, circular polarization keeps only the electric half of the push: drift energy = U_p(start)/2 within 1%', () => {
    const r = runElectron({ ...base, pol: 'circular', vxb: false }, 8.66, 5)
    expect(Math.abs(r.keFinal / r.upStart - 0.5)).toBeLessThan(0.005)
  })

  it('at the edge of the sliders (a0 = 0.25, ωw/c = 10) the expansion degrades only to the percent level', () => {
    for (const pol of ['linear', 'circular'] as const) {
      const p: FocusParams = { a0: 0.25, w: 10, pol, tOn: 10 * Math.PI, vxb: true }
      const r = runElectron(p, 4.33, 2.5)
      expect(Number.isFinite(r.keFinal)).toBe(true)
      expect(Math.abs(r.keFinal / r.upStart - 1)).toBeLessThan(0.02)
    }
  })
})

describe('ponderomotive steepening: n = n0 exp(−U_p/kT) with the light solved in the same profile', () => {
  it('with no light pressure (P → 0) the field is B1’s Airy standing wave: peak |E|²/E0² = 3.61 (k0L)^{1/3}', () => {
    for (const L of [50, 100, 200]) {
      const s = steepen(L, 1e-9)
      let mx = 0
      for (const v of s.E) mx = Math.max(mx, v * v)
      expect(Math.abs(mx / (3.6056 * Math.cbrt(L)) - 1)).toBeLessThan(0.01)
    }
  })

  for (const [L, P] of [
    [50, 0.1],
    [100, 0.05],
    [100, 0.2],
    [200, 0.1],
  ]) {
    it(`k0L = ${L}, P = (I/c)/(n_c kT) = ${P}: pressure balance, push = 2I/c, and self-consistency`, () => {
      const s = steepen(L, P)
      expect(s.ok).toBe(true)
      const d = steepDiagnostics(s, L, P)
      // n kT + EM momentum flux − (force holding the original ramp) is constant, to 10⁻³ n_c kT
      expect(d.balanceError).toBeLessThan(1e-3)
      // the light pushes the plasma with 2I/c in total (perfect reflector); 2I/c = 2P n_c kT
      expect(Math.abs(d.emFluxVacuum / (2 * P) - 1)).toBeLessThan(1e-3)
      expect(Math.abs(d.totalPush / (2 * P) - 1)).toBeLessThan(5e-3)
      // the light computed afresh in the frozen profile is the light that made it
      expect(linearCheck(s, L, P)).toBeLessThan(5e-3)
      // the step: the jump in plasma pressure from the last antinode to the shelf is the light pressure at the
      // antinode (less the little left on the shelf) plus the ramp support over the step, which is the smaller part;
      // and the profile at n_c has steepened by more than a factor 10
      expect(Math.abs(d.uHigh - d.uLow - (d.peakPressure - d.shelfPressure + d.support))).toBeLessThan(2e-3)
      expect(d.support).toBeLessThan(0.3 * (d.uHigh - d.uLow))
      expect(d.uLow).toBeLessThan(1)
      expect(d.uHigh).toBeGreaterThan(1)
      expect(d.scaleAtNc).toBeLessThan(0.1 * L)
    })
  }
})
