// B5 benchmarks: the pumped coupled oscillators against the analytic growth rates (matched, detuned, damped,
// purely growing, the pumped swing), the matching solver against both conservation laws and the dispersion
// relations, the SRS backscatter wavelength against an independent calculation, and the Rosenbluth gain against
// a direct integration of the spatial coupled-mode equations.
import { describe, expect, it } from 'vitest'
import {
  decayGrowth,
  gamma0Of,
  measureOscGrowth,
  normalize,
  omegaOf,
  purelyGrowing,
  rosenbluthGain,
  solveMatching,
  srsBackscatter,
  type OscParams,
  type Process,
} from './parametric'

/** Pump amplitude E0 = 1 and c1 = c2 = c chosen to give the requested γ0. */
const decay = (w1: number, w2: number, g0: number, D: number, G1 = 0, G2 = 0): OscParams => {
  const cc = 2 * g0 * Math.sqrt(w1 * w2)
  return { w1, w2, w0: w1 + w2 + D, c1: cc, c2: cc, E0: 1, G1, G2 }
}

describe('pumped coupled oscillators (RK4) vs the coupled-mode growth rate', () => {
  it('exactly matched, undamped: measured growth = γ0 = √(c1c2E0²/4ω1ω2) within 0.5%', () => {
    for (const [w1, w2, g0] of [
      [1, 0.5, 0.02],
      [1, 0.3, 0.015],
      [1, 1, 0.03],
    ]) {
      const p = decay(w1, w2, g0, 0)
      expect(gamma0Of(p)).toBeCloseTo(g0, 12)
      const m = measureOscGrowth(p, 25 / g0)
      expect(Math.abs(m.gamma / g0 - 1)).toBeLessThan(0.005)
    }
  })
  it('detuned by Δ = ω0 − ω1 − ω2: growth = √(γ0² − Δ²/4) within 2%; none for |Δ| > 2γ0', () => {
    const g0 = 0.02
    for (const D of [0.02, -0.03]) {
      const p = decay(1, 0.5, g0, D)
      const th = Math.sqrt(g0 * g0 - (D * D) / 4)
      expect(decayGrowth(g0, D, 0, 0)).toBeCloseTo(th, 12)
      expect(Math.abs(measureOscGrowth(p, 25 / th).gamma / th - 1)).toBeLessThan(0.02)
    }
    const off = measureOscGrowth(decay(1, 0.5, g0, 0.06), 1500)
    expect(Math.abs(off.gamma)).toBeLessThan(0.002) // bounded beating, no exponential growth
  })
  it('damping: growth = −Γ + γ0 above threshold, and decay below the threshold γ0² = Γ1Γ2', () => {
    const g0 = 0.02
    const above = decay(1, 0.5, g0, 0, 0.008, 0.008)
    expect(Math.abs(measureOscGrowth(above, 1500).gamma / 0.012 - 1)).toBeLessThan(0.005)
    // unequal damping: −(Γ1+Γ2)/2 + √((Γ1−Γ2)²/4 + γ0²)
    const th = -(0.004 + 0.02) / 2 + Math.sqrt(((0.004 - 0.02) / 2) ** 2 + g0 * g0)
    expect(decayGrowth(g0, 0, 0.004, 0.02)).toBeCloseTo(th, 12)
    expect(Math.abs(measureOscGrowth(decay(1, 0.5, g0, 0, 0.004, 0.02), 1500).gamma / th - 1)).toBeLessThan(0.005)
    // below threshold (Γ1Γ2 = 0.025² > γ0²): the seed dies away
    const below = measureOscGrowth(decay(1, 0.5, g0, 0, 0.025, 0.025), 1500)
    expect(Math.abs(below.gamma / -0.005 - 1)).toBeLessThan(0.01)
    expect(decayGrowth(g0, 0, 0.025, 0.025)).toBeCloseTo(-0.005, 12)
  })
  it('pumped swing (Mathieu, ω0 = 2ω): x″ + ω²(1 + h cos 2ωt)x = 0 grows at hω/4', () => {
    // symmetric seed x1 = x2 in identical oscillators is exactly the Mathieu equation with h = 2cE0/ω²
    const h = 0.1
    const p: OscParams = { w1: 1, w2: 1, w0: 2, c1: h / 2, c2: h / 2, E0: 1, G1: 0, G2: 0 }
    expect(gamma0Of(p)).toBeCloseTo(h / 4, 12)
    expect(Math.abs(measureOscGrowth(p, 600).gamma / (h / 4) - 1)).toBeLessThan(0.005)
    // detuned swing (Landau & Lifshitz §27): ω0 = 2ω + δ grows at √((hω/4)² − δ²/4)
    const det: OscParams = { ...p, w0: 2.02 }
    const thd = Math.sqrt((h / 4) ** 2 - 0.02 ** 2 / 4)
    expect(decayGrowth(h / 4, 0.02, 0, 0)).toBeCloseTo(thd, 12)
    expect(Math.abs(measureOscGrowth(det, 30 / thd).gamma / thd - 1)).toBeLessThan(0.02)
  })
  it('purely growing mode (ω2 ≈ 0, ω0 just below ω1) matches the two-sideband dispersion relation', () => {
    for (const [w2, w0, cc, G] of [
      [0.03, 0.97, 0.02, 0],
      [0.0, 0.95, 0.03, 0],
      [0.03, 0.97, 0.03, 0.02],
    ]) {
      const p: OscParams = { w1: 1, w2, w0, c1: cc, c2: cc, E0: 1, G1: G, G2: G }
      const th = purelyGrowing(p)
      expect(th).toBeGreaterThan(0.02)
      expect(Math.abs(measureOscGrowth(p, 20 / th).gamma / th - 1)).toBeLessThan(0.005)
    }
    // pump above ω1: no purely growing mode
    expect(purelyGrowing({ w1: 1, w2: 0.03, w0: 1.03, c1: 0.02, c2: 0.02, E0: 1, G1: 0, G2: 0 })).toBe(0)
  })
})

describe('wave-matching solver', () => {
  const plasma = (nn: number) => normalize({ nn, TeKeV: 2, TiKeV: 1, Z: 3.5, A: 6.5 })
  it('daughters satisfy ω0 = ω1 + ω2, k0 = k1 + k2 and their dispersion relations to 1e-9', () => {
    const cases: [Process, number, number[]][] = [
      ['SRS', 0.1, [180, 120, 90, 45, 10]],
      ['SRS', 0.02, [180, 60]],
      ['SBS', 0.1, [180, 90, 30]],
      ['SBS', 0.6, [180, 135]],
      ['TPD', 0.235, [30, 45, 60]],
      ['IAD', 0.95, [180, 90, 0]],
    ]
    for (const [proc, nn, angles] of cases) {
      const N = plasma(nn)
      for (const deg of angles) {
        const m = solveMatching(proc, N, (deg * Math.PI) / 180)
        expect(m, `${proc} ${nn} ${deg}°`).not.toBeNull()
        if (!m) continue
        const k1 = Math.hypot(...m.k1)
        const k2 = Math.hypot(...m.k2)
        // energy
        expect(Math.abs(m.w1 + m.w2 - 1)).toBeLessThan(1e-9)
        // momentum (k2 is built as k0 − k1; check the vector sum)
        expect(Math.abs(m.k1[0] + m.k2[0] - Math.sqrt(1 - nn))).toBeLessThan(1e-12)
        expect(Math.abs(m.k1[1] + m.k2[1])).toBeLessThan(1e-12)
        // dispersion relations, written out independently
        const disp = (kind: string, k: number) =>
          kind === 'light' ? Math.sqrt(nn + k * k) : kind === 'epw' ? Math.sqrt(nn + 3 * k * k * N.vte2) : k * N.cs
        expect(Math.abs(m.w1 / disp(m.kinds[0], k1) - 1)).toBeLessThan(1e-9)
        expect(Math.abs(m.w2 / disp(m.kinds[1], k2) - 1)).toBeLessThan(1e-9)
        // direction of daughter 1
        expect(Math.atan2(m.k1[1], m.k1[0])).toBeCloseTo((deg * Math.PI) / 180, 9)
      }
    }
  })
  it('SRS backscatter of 351 nm light at 0.1 n_c, T_e = 2 keV: λ_s from an independent fixed-point solution', () => {
    const N = plasma(0.1)
    const m = solveMatching('SRS', N, Math.PI)!
    // independent: iterate ω_ek = √(ω_pe² + 3k²v_te²) with k = k0 + k_s, k_s = √((1 − ω_ek)² − ω_pe²)
    const vte2 = 2 / 510.99895
    const k0 = Math.sqrt(0.9)
    let wek = Math.sqrt(0.1)
    for (let i = 0; i < 200; i++) {
      const ks = Math.sqrt((1 - wek) ** 2 - 0.1)
      wek = Math.sqrt(0.1 + 3 * (k0 + ks) ** 2 * vte2)
    }
    const lamS = 351 / (1 - wek)
    expect(351 / m.w1 / lamS - 1).toBeCloseTo(0, 9)
    expect(lamS).toBeCloseTo(545.06, 1) // Python reference 545.0597 nm
    // the fast 1D solver agrees
    expect(351 / srsBackscatter(N)!.ws / lamS - 1).toBeCloseTo(0, 9)
    // and the plasma wave sits right at kλ_De ≈ 0.30
    const k = Math.hypot(...m.k2)
    expect((k * Math.sqrt(N.vte2)) / Math.sqrt(0.1)).toBeCloseTo(0.2987, 3)
    expect(omegaOf('epw', k, N)).toBeCloseTo(wek, 12)
  })
  it('SRS has no solution at or above n_c/4 in any direction; SBS works up to n_c', () => {
    for (const nn of [0.25, 0.3, 0.5, 0.9]) {
      const N = plasma(nn)
      for (let deg = 0; deg <= 180; deg += 15) expect(solveMatching('SRS', N, (deg * Math.PI) / 180)).toBeNull()
      expect(srsBackscatter(N)).toBeNull()
      expect(solveMatching('SBS', N, Math.PI)).not.toBeNull()
    }
    expect(solveMatching('SBS', plasma(1.0), Math.PI)).toBeNull()
  })
})

describe('Rosenbluth gain', () => {
  // v1 a1' = γ0 b e^{iκ'x²/2},  v2 b' = γ0 a1 e^{−iκ'x²/2}  (b = conj a2), co-propagating, from x = −X to X
  function amplitudeGain(g0: number, kp: number, v1: number, v2: number, X: number, h = 0.05) {
    let ar = 1
    let ai = 0
    let br = 0
    let bi = 0
    const f = (x: number, a: [number, number], b: [number, number]) => {
      const ph = (kp * x * x) / 2
      const cr = Math.cos(ph)
      const ci = Math.sin(ph)
      return [
        (g0 / v1) * (b[0] * cr - b[1] * ci),
        (g0 / v1) * (b[0] * ci + b[1] * cr),
        (g0 / v2) * (a[0] * cr + a[1] * ci),
        (g0 / v2) * (a[1] * cr - a[0] * ci),
      ]
    }
    for (let x = -X; x < X - 1e-9; x += h) {
      const k1 = f(x, [ar, ai], [br, bi])
      const k2 = f(x + h / 2, [ar + (h / 2) * k1[0], ai + (h / 2) * k1[1]], [br + (h / 2) * k1[2], bi + (h / 2) * k1[3]])
      const k3 = f(x + h / 2, [ar + (h / 2) * k2[0], ai + (h / 2) * k2[1]], [br + (h / 2) * k2[2], bi + (h / 2) * k2[3]])
      const k4 = f(x + h, [ar + h * k3[0], ai + h * k3[1]], [br + h * k3[2], bi + h * k3[3]])
      ar += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
      ai += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
      br += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
      bi += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])
    }
    return Math.hypot(ar, ai)
  }
  it('intensity gain exp(G), G = 2πγ0²/|κ′v1v2|: amplitude gain exponent within 3% of G/2', () => {
    for (const [g0, kp] of [
      [0.1, 0.01],
      [0.1, 0.02],
      [0.2, 0.05],
    ]) {
      const G = rosenbluthGain(g0, kp, 1, 0.5)
      const lnAmp = Math.log(amplitudeGain(g0, kp, 1, 0.5, 400))
      expect(Math.abs(lnAmp / (G / 2) - 1)).toBeLessThan(0.03)
    }
  })
})
