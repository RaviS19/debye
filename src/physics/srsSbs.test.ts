// B6 benchmarks: growth rates against hand (Python) values and against the full SRS/SBS dispersion relation,
// the SBS cubic in its two limits, the Rosenbluth gains, and the three-wave envelope solver against the
// temporal growth rate, the steady-state spatial gain, Tang's pump-depleted steady state and Manley–Rowe.
import { describe, expect, it } from 'vitest'
import { quiverOverC } from './lightRamp'
import { normalize } from './parametric'
import {
  backscatterAt0,
  createThreeWave,
  cubicGrowingRoot,
  cubicMaxGrowth,
  fullDispersionGrowth,
  dampedGrowth,
  epwDamping,
  iawDampingRatio,
  manleyRoweBalance,
  sbsGain,
  sbsGrowth,
  srsGain,
  srsGrowth,
  stepThreeWave,
  tangReflectivity,
  toPerPs,
  umToNorm,
} from './srsSbs'

const CH = { TiKeV: 1, Z: 3.5, A: 6.5 }

describe('growth rates', () => {
  const N = normalize({ nn: 0.1, TeKeV: 2, ...CH })
  const vos = quiverOverC(1e15, 0.351)
  it('SRS backscatter, 10¹⁵ W/cm², 351 nm, 0.1 n_c, 2 keV: matches the hand value', () => {
    const s = srsGrowth(N, vos)!
    expect(s.gamma0 / 0.002365259842 - 1).toBeCloseTo(0, 6)
    expect(toPerPs(s.gamma0, 0.351) / 12.69323478 - 1).toBeCloseTo(0, 5)
    expect(s.klD).toBeCloseTo(0.298664427, 6)
  })
  it('SBS backscatter in CH: weak, strong and cubic values match the hand values', () => {
    const s = sbsGrowth(N, vos, CH.Z, CH.A)!
    expect(s.weak / 0.0004956889439 - 1).toBeCloseTo(0, 6)
    expect(s.cubic / 0.000491979131 - 1).toBeCloseTo(0, 5)
    expect(s.strong / 0.0009186836967 - 1).toBeCloseTo(0, 6)
    expect(s.kcs / 0.002435098381 - 1).toBeCloseTo(0, 6)
  })
  it('the formulas match the roots of the full dispersion relation (Stokes + anti-Stokes)', () => {
    // ω² − ω_k² = (k² v_os² ω_c²/4)[1/D(ω − 1, k − k0) + 1/D(ω + 1, k + k0)], D(ω, k) = ω² − k² − n/n_c
    const root = (nn: number, k: number, k0: number, wk2: number, wc2: number, v: number, guess: [number, number]) => {
      const F = (wr: number, wi: number): [number, number] => {
        const inv = (ar: number, ai: number) => {
          const d = ar * ar + ai * ai
          return [ar / d, -ai / d]
        }
        const D = (sr: number, si: number, kk: number): [number, number] => [sr * sr - si * si - kk * kk - nn, 2 * sr * si]
        const [m1r, m1i] = D(wr - 1, wi, k - k0)
        const [p1r, p1i] = D(wr + 1, wi, k + k0)
        const [ir1, ii1] = inv(m1r, m1i)
        const [ir2, ii2] = inv(p1r, p1i)
        const C = (k * k * v * v * wc2) / 4
        return [wr * wr - wi * wi - wk2 - C * (ir1 + ir2), 2 * wr * wi - C * (ii1 + ii2)]
      }
      let [wr, wi] = guess
      for (let it = 0; it < 60; it++) {
        const h = 1e-7 * Math.hypot(wr, wi)
        const f = F(wr, wi)
        const fx = F(wr + h, wi) // F is analytic, so F′ ≈ (F(ω + h) − F(ω))/h
        const dr = (fx[0] - f[0]) / h
        const di = (fx[1] - f[1]) / h
        const d = dr * dr + di * di
        const sr = (f[0] * dr + f[1] * di) / d
        const si = (f[1] * dr - f[0] * di) / d
        wr -= sr
        wi -= si
        if (Math.hypot(sr, si) < 1e-14 * Math.hypot(wr, wi)) break
      }
      return wi
    }
    const s = srsGrowth(N, vos)!
    expect(Math.abs(root(N.nn, s.k, s.k0, s.w * s.w, N.nn, vos, [s.w, s.gamma0]) / s.gamma0 - 1)).toBeLessThan(1e-4)
    // SBS at lower intensity (well inside weak coupling): the weak formula
    const v2 = quiverOverC(1e14, 0.351)
    const b = sbsGrowth(N, v2, CH.Z, CH.A)!
    const wpi2 = (N.nn * CH.Z * 9.1093837015e-31) / (CH.A * 1.6605390666e-27)
    expect(Math.abs(root(N.nn, b.k, b.k0, b.w * b.w, wpi2, v2, [b.w, b.weak]) / b.weak - 1)).toBeLessThan(0.01)
    expect(Math.abs(b.cubic / b.weak - 1)).toBeLessThan(0.01)
    // SBS far into strong coupling (cold, heavy, intense): the strong formula
    const Ns = normalize({ nn: 0.3, TeKeV: 0.05, TiKeV: 0.005, Z: 1, A: 1 })
    const v3 = quiverOverC(1e16, 0.351)
    const st = sbsGrowth(Ns, v3, 1, 1)!
    expect(st.strong / st.kcs).toBeGreaterThan(5)
    const wpi2s = (0.3 * 9.1093837015e-31) / 1.6605390666e-27
    const rs = root(Ns.nn, st.k, st.k0, st.w * st.w, wpi2s, v3, [st.strong / Math.sqrt(3), st.strong])
    expect(Math.abs(rs / st.strong - 1)).toBeLessThan(0.03)
    expect(Math.abs(st.cubic / rs - 1)).toBeLessThan(0.01)
  })
  it('the exported full-dispersion solver (used by the growth-rate map) agrees with the formulas', () => {
    const s = srsGrowth(N, vos)!
    expect(Math.abs(fullDispersionGrowth(N.nn, s.k, s.k0, s.w * s.w, N.nn, vos, [s.w, s.gamma0]) / s.gamma0 - 1)).toBeLessThan(1e-4)
    const v2 = quiverOverC(1e14, 0.351)
    const b = sbsGrowth(N, v2, CH.Z, CH.A)!
    const wpi2 = (N.nn * CH.Z * 9.1093837015e-31) / (CH.A * 1.6605390666e-27)
    const B = (b.k * b.k * v2 * v2 * wpi2) / 8
    const g = cubicGrowingRoot(-b.w, -b.w * b.w, b.w ** 3 + B)
    expect(g[1] / b.cubic - 1).toBeCloseTo(0, 9)
    expect(Math.abs(fullDispersionGrowth(N.nn, b.k, b.k0, b.w * b.w, wpi2, v2, g) / b.cubic - 1)).toBeLessThan(0.01)
  })
  it('the SBS cubic reduces to √(B/2a) for weak coupling and (√3/2)B^{1/3} for strong', () => {
    const a = 1e-3
    for (const B of [1e-12, 1e-11]) expect(cubicMaxGrowth(-a, -a * a, a * a * a + B) / Math.sqrt(B / (2 * a)) - 1).toBeCloseTo(0, 2)
    expect(cubicMaxGrowth(0, 0, 1e-9) / ((Math.sqrt(3) / 2) * 1e-3) - 1).toBeCloseTo(0, 9)
    expect(cubicMaxGrowth(-3, 3, -1)).toBe(0) // (ω − 1)³: all roots real
  })
  it('daughter damping: kinetic Landau table and the ion acoustic formula', () => {
    expect(epwDamping(0.5)).toBeCloseTo(0.1534, 3) // A9's exact root at kλ_D = 0.5
    expect(epwDamping(0.3)).toBeGreaterThan(0.01)
    expect(epwDamping(0.3)).toBeLessThan(0.015)
    expect(iawDampingRatio(7, 3.5, 6.5) / 0.08896989712 - 1).toBeCloseTo(0, 8)
    // net growth with a damped daughter: γ0²/ν for strong damping, γ0 − ν/2 for weak
    expect(dampedGrowth(0.01, 1) / 1e-4).toBeCloseTo(1, 3)
    expect(dampedGrowth(1, 1e-3)).toBeCloseTo(1 - 5e-4, 6)
  })
  it('Rosenbluth gains match the hand values (L = L_u = 300 µm)', () => {
    expect(srsGain(N, vos, umToNorm(300, 0.351)) / 1.624720949 - 1).toBeCloseTo(0, 5)
    expect(sbsGain(N, vos, CH.Z, CH.A, umToNorm(300, 0.351)) / 3.58981891 - 1).toBeCloseTo(0, 5)
  })
})

describe('three-wave envelope solver', () => {
  it('uniform plasma, no damping: temporal growth rate γ0 within 3%; with damping −ν/2 + √(ν²/4 + γ0²)', () => {
    for (const [K, nu] of [
      [0.05, 0],
      [0.1, 0],
      [0.05, 0.1],
    ]) {
      const s = createThreeWave({ n: 200, L: 100, K, nu, mode: 'periodic', seed: 1e-16 })
      const th = dampedGrowth(K, nu)
      const T1 = 5 / th
      const T2 = 15 / th
      stepThreeWave(s, Math.round(T1 / s.dt))
      const t1 = s.t
      const l1 = Math.log(s.a1r[50] ** 2 + s.a1i[50] ** 2)
      stepThreeWave(s, Math.round((T2 - T1) / s.dt))
      const l2 = Math.log(s.a1r[50] ** 2 + s.a1i[50] ** 2)
      const g = (l2 - l1) / (2 * (s.t - t1))
      expect(Math.abs(g / th - 1)).toBeLessThan(0.03)
    }
  })
  it('slab with a strongly damped plasma wave: steady-state spatial gain 2γ0²L/ν within 5%', () => {
    for (const [K, nu] of [
      [0.1, 0.5],
      [0.05, 0.25],
    ]) {
      const s = createThreeWave({ n: 400, L: 200, K, nu, mode: 'slab', seed: 1e-10 })
      stepThreeWave(s, 8 * s.n)
      const G = Math.log(backscatterAt0(s) / 1e-10)
      expect(Math.abs(G / ((2 * K * K * 200) / nu) - 1)).toBeLessThan(0.05)
    }
  })
  it('pump depletion: Tang’s steady state within 2%, and Manley–Rowe (one scattered quantum per pump quantum) to 1e-3', () => {
    const K = 0.14
    const nu = 0.5
    const eps = 1e-6
    const s = createThreeWave({ n: 400, L: 200, K, nu, mode: 'slab', seed: eps })
    for (let i = 0; i < 30; i++) {
      stepThreeWave(s, s.n)
      const mr = manleyRoweBalance(s)
      if (mr.pumpLost > 1e-3) expect(Math.abs(mr.scatMade / mr.pumpLost - 1)).toBeLessThan(1e-3)
    }
    const r = backscatterAt0(s)
    const rT = tangReflectivity((2 * K * K * 200) / nu, eps)
    expect(rT).toBeCloseTo(0.2294, 3)
    expect(Math.abs(r / rT - 1)).toBeLessThan(0.02)
    expect(r).toBeGreaterThan(0.2) // a fifth of the pump is reflected: strong depletion
  })
})
