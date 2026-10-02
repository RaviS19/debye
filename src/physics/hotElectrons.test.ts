// B8 benchmarks: test electrons in a plasma wave against the trapping theory, the two-temperature fit against
// synthetic data, and the bi-Maxwellian and bremsstrahlung formulas against direct integration.
import { describe, expect, it } from 'vitest'
import {
  biMaxwellAbove,
  bounceFrequency,
  bremsSlopeT,
  bremsChannels,
  bremsShares,
  bremsThin,
  coldWavebreakingField,
  createSurf,
  crossoverEnergy,
  energyFractionAbove,
  erfc,
  fitTwoTemperature,
  fractionAbove,
  gauss,
  hamiltonian,
  hotEnergyFraction,
  maxEnergyError,
  maxTrappedVelocity,
  maxwellPdf3,
  measureBouncePeriod,
  measuredTrappedFraction,
  MEC2_KEV,
  reflectedEnergyKeV,
  reflectedEnergyNonRelKeV,
  rng,
  slopeTemperature,
  slopeWindow,
  poisson,
  srsPlasmaWave,
  trappedFraction,
  stepSurf,
} from './hotElectrons'

/** Simpson's rule on [a, b] with n (even) intervals. */
function simpson(f: (x: number) => number, a: number, b: number, n = 20000) {
  const h = (b - a) / n
  let s = f(a) + f(b)
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h)
  return (s * h) / 3
}

describe('electrons in a plasma wave', () => {
  it('the fastest trapped electron reaches v_ph + 2√(eφ0/m) (within 2%)', () => {
    for (const [vph, Phi] of [[3, 0.5], [4, 1], [5, 2.5]]) {
      const s = createSurf({ n: 6000, vph, Phi, seed: 11 })
      let vmax = 0
      const Tb = (2 * Math.PI) / bounceFrequency(Phi)
      while (s.t < 3 * Tb) {
        stepSurf(s, 0.05)
        for (let i = 0; i < s.n; i++) {
          if (hamiltonian(s.xi[i], s.u[i], Phi) < Phi) vmax = Math.max(vmax, s.u[i] + vph)
        }
      }
      const theory = maxTrappedVelocity(vph, Phi)
      expect(vmax).toBeLessThanOrEqual(theory * (1 + 1e-6))
      expect(Math.abs(vmax / theory - 1)).toBeLessThan(0.02)
    }
  })

  it('a deeply trapped electron bounces with period 2π/ω_b, ω_b = k√(eφ0/m) (within 2%)', () => {
    for (const Phi of [0.2, 1, 4]) {
      const T = measureBouncePeriod(Phi, 0.1, 0.02)
      expect(Math.abs(T / ((2 * Math.PI) / bounceFrequency(Phi)) - 1)).toBeLessThan(0.02)
    }
    // and the anharmonic correction for a wider orbit: T ≈ (2π/ω_b)(1 + ξ0²/16)
    const T = measureBouncePeriod(1, 0.6, 0.01)
    expect(T / (2 * Math.PI)).toBeCloseTo(1 + 0.36 / 16, 3)
  })

  it('the pusher conserves the wave-frame Hamiltonian to 1e-4 over many bounces', () => {
    for (const [vph, Phi] of [[3, 0.5], [4, 1], [6, 4]]) {
      const s = createSurf({ n: 3000, vph, Phi, seed: 5 })
      const Tb = (2 * Math.PI) / bounceFrequency(Phi)
      const dt = 0.05 // the time step the simulation uses
      while (s.t < 20 * Tb) stepSurf(s, dt, 10)
      expect(maxEnergyError(s)).toBeLessThan(1e-4)
    }
  })

  it('the trapped fraction matches the Maxwellian weight inside the separatrix (within 5%) and stays put', () => {
    // small-amplitude limit: f(v_ph) × mean band width (8√Φ/π)
    const fM = (v: number) => Math.exp(-0.5 * v * v) / Math.sqrt(2 * Math.PI)
    expect(trappedFraction(3, 1e-4) / ((fM(3) * 8 * Math.sqrt(1e-4)) / Math.PI)).toBeCloseTo(1, 3)
    for (const [vph, Phi] of [[3, 0.05], [3.5, 1], [6, 4]]) {
      const s = createSurf({ n: 5000, vph, Phi, seed: 99 }) // the simulation's loading
      const th = trappedFraction(vph, Phi)
      expect(Math.abs(measuredTrappedFraction(s) / th - 1)).toBeLessThan(0.05)
      while (s.t < 100) stepSurf(s, 0.05, 10)
      expect(Math.abs(measuredTrappedFraction(s) / th - 1)).toBeLessThan(0.05)
    }
  })

  it('trapped fractions quoted in the lesson (independent quadrature in Python with scipy)', () => {
    expect(trappedFraction(3.5, 1)).toBeCloseTo(0.0260899, 6)
    expect(trappedFraction(6, 4)).toBeCloseTo(0.00568346, 7)
    expect(trappedFraction(8, 4) / 6.07807e-6).toBeCloseTo(1, 4)
    expect(trappedFraction(3, 2)).toBeCloseTo(0.188070, 5) // problem B8-p6, slow wave
    expect(trappedFraction(8, 2) / 2.37104e-8).toBeCloseTo(1, 3) // problem B8-p6, fast wave
  })

  it('weights reproduce a Maxwellian: ∫f dv = 1 and ⟨v²⟩ = 1', () => {
    const s = createSurf({ n: 20000, vph: 4, Phi: 1, seed: 2 })
    let W = 0
    let W2 = 0
    for (let i = 0; i < s.n; i++) {
      W += s.w[i]
      W2 += s.w[i] * s.v0[i] ** 2
    }
    expect(W / s.n).toBeCloseTo(1, 2)
    expect(W2 / W).toBeCloseTo(1, 2)
  })
})

describe('two-temperature fit', () => {
  const sample = (N: number, alpha: number, Tc: number, Th: number, dims: number, seed: number) => {
    const r = rng(seed)
    const E = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      const T = r() < alpha ? Th : Tc
      let v2 = 0
      for (let d = 0; d < dims; d++) v2 += gauss(r) ** 2 * T
      E[i] = v2 / 2
    }
    return E
  }

  it('recovers T_hot within 3% from synthetic 3D samples', () => {
    for (const [alpha, Th] of [[0.1, 10], [0.02, 25], [0.3, 4]]) {
      const E = sample(100000, alpha, 1, Th, 3, 17)
      const f = fitTwoTemperature(E, null, 1.5, undefined, 2000)
      expect(Math.abs(f.Th / Th - 1)).toBeLessThan(0.03)
      expect(Math.abs(f.Tc - 1)).toBeLessThan(0.03)
      expect(Math.abs(f.alpha / alpha - 1)).toBeLessThan(0.08)
    }
  })

  it('recovers T_hot within 3% from one velocity component, also with T_c held fixed', () => {
    const E = sample(200000, 0.1, 1, 10, 1, 23)
    const f = fitTwoTemperature(E, null, 0.5, undefined, 3000)
    expect(Math.abs(f.Th / 10 - 1)).toBeLessThan(0.03)
    const g = fitTwoTemperature(E, null, 0.5, undefined, 3000, 1e-10, 1)
    expect(g.Tc).toBe(1)
    expect(Math.abs(g.Th / 10 - 1)).toBeLessThan(0.03)
    expect(Math.abs(g.alpha / 0.1 - 1)).toBeLessThan(0.05)
  })

  it('works with importance weights (uniform loading in v)', () => {
    // weighted samples from a bi-Maxwellian in 1D, loaded uniformly on [−12, 12]
    const r = rng(9)
    const N = 100000
    const E = new Float64Array(N)
    const w = new Float64Array(N)
    const alpha = 0.05
    const Th = 9
    for (let i = 0; i < N; i++) {
      const v = -12 + 24 * ((i + r()) / N)
      E[i] = (v * v) / 2
      w[i] = ((1 - alpha) * Math.exp(-v * v / 2) + (alpha / Math.sqrt(Th)) * Math.exp(-v * v / (2 * Th))) / Math.sqrt(2 * Math.PI)
    }
    const f = fitTwoTemperature(E, w, 0.5, undefined, 3000)
    expect(Math.abs(f.Th / Th - 1)).toBeLessThan(0.03)
    expect(Math.abs(f.alpha / alpha - 1)).toBeLessThan(0.05)
  })
})

describe('bi-Maxwellian energy integrals', () => {
  it('erfc matches reference values', () => {
    expect(erfc(0.5)).toBeCloseTo(0.4795001221869535, 13)
    expect(erfc(2)).toBeCloseTo(0.004677734981047266, 14)
    expect(erfc(3.5) / 7.430983723414128e-7).toBeCloseTo(1, 10)
    expect(erfc(-1)).toBeCloseTo(1.842700792949715, 13)
  })

  it('number and energy above E_p match direct integration', () => {
    for (const x of [0.3, 1, 2, 5, 9]) {
      const n = simpson((E) => maxwellPdf3(E, 1), x, x + 60)
      const en = simpson((E) => E * maxwellPdf3(E, 1), x, x + 60) / 1.5
      expect(fractionAbove(x) / n).toBeCloseTo(1, 6)
      expect(energyFractionAbove(x) / en).toBeCloseTo(1, 6)
    }
    const [alpha, Tc, Th, Ep] = [0.01, 2, 50, 100]
    const pdf = (E: number) => (1 - alpha) * maxwellPdf3(E, Tc) + alpha * maxwellPdf3(E, Th)
    const tot = simpson((E) => E * pdf(E), 1e-9, 2000, 200000)
    expect(tot).toBeCloseTo(1.5 * ((1 - alpha) * Tc + alpha * Th), 4)
    const above = biMaxwellAbove(Ep, alpha, Tc, Th)
    expect(above.number / simpson(pdf, Ep, 2000)).toBeCloseTo(1, 6)
    expect(above.energy / (simpson((E) => E * pdf(E), Ep, 2000) / tot)).toBeCloseTo(1, 5)
    expect(hotEnergyFraction(alpha, Tc, Th)).toBeCloseTo(0.2016, 4)
  })

  it('crossover energy: the two terms are equal there', () => {
    const [a, Tc, Th] = [0.01, 1, 20]
    for (const p of [0.5, 1.5]) {
      const Ex = crossoverEnergy(a, Tc, Th, p)
      expect((1 - a) * Tc ** -p * Math.exp(-Ex / Tc)).toBeCloseTo(a * Th ** -p * Math.exp(-Ex / Th), 12)
    }
  })
})

describe('bremsstrahlung and wave numbers', () => {
  it('thin-target Kramers bremsstrahlung from a Maxwellian falls as T^(−1/2) e^(−hν/T)', () => {
    // j(hν) ∝ ∫_{v>√(2hν)} f(v) v (1/(v² hν)) hν 4πv² dv with f ∝ T^(−3/2) e^(−v²/2T)
    for (const T of [1, 3]) {
      const j = (hv: number) => simpson((v) => T ** -1.5 * v * Math.exp((-v * v) / (2 * T)), Math.sqrt(2 * hv), Math.sqrt(2 * hv) + 40, 40000)
      for (const hv of [0.5, 2, 6]) expect(j(hv) / (T ** -0.5 * Math.exp(-hv / T))).toBeCloseTo(1, 6)
    }
    // the slope temperature tends to T_hot above the crossover, and to T_c well below it
    expect(bremsSlopeT(300, 0.01, 2, 50) / 50).toBeCloseTo(1, 3)
    expect(bremsSlopeT(1, 0.001, 2, 50) / 2).toBeCloseTo(1, 1)
    // a noiseless "detector" gives T_hot back from its slope
    const hv = Array.from({ length: 40 }, (_, i) => 20 + 10 * i)
    const counts = hv.map((h) => 1e6 * bremsThin(h, 0.01, 2, 50))
    expect(slopeTemperature(hv, counts, 150, 400)!.T / 50).toBeCloseTo(1, 4)
  })

  it('a Poisson-noisy detector recovers T_hot from the slope within 3% (the hot-tail builder)', () => {
    const hv = bremsChannels(5, 400, 60)
    const share = new Float64Array(hv.length)
    const r = rng(31)
    for (const [alpha, Tc, Th] of [[0.01, 2, 50], [0.003, 1, 25], [0.05, 3, 120], [0.001, 0.5, 15]]) {
      bremsShares(hv, alpha, Tc, Th, share)
      const counts = Array.from(share, (m) => poisson(3e6 * m, r))
      const win = slopeWindow(alpha, Tc, Th, 400)
      const fit = slopeTemperature(hv, counts, win.lo, win.hi)!
      expect(fit).not.toBeNull()
      expect(Math.abs(fit.T / Th - 1)).toBeLessThan(0.03)
      // the same with photon counting: N ~ Poisson(energy share/hν), signal N·hν, weights N
      const N = Array.from(share, (m, i) => poisson((3e6 * m) / hv[i] * 50, r))
      const fitN = slopeTemperature(hv, N.map((n, i) => n * hv[i]), win.lo, win.hi, N)!
      expect(Math.abs(fitN.T / Th - 1)).toBeLessThan(0.03)
      // inside the window the cold term is below 1% of the hot one
      const a = (1 - alpha) * Tc ** -0.5 * Math.exp(-win.lo / Tc)
      const b = alpha * Th ** -0.5 * Math.exp(-win.lo / Th)
      expect(a / b).toBeLessThan(0.0101)
    }
  })

  it('cold wave breaking: E = m ω_pe v_ph/e ≈ 96 √n[cm⁻³] V/m at v_ph = c', () => {
    const E = coldWavebreakingField(1e19 * 1e6, 2.99792458e8)
    expect(E / Math.sqrt(1e19)).toBeCloseTo(96.16, 1)
  })

  it('SRS plasma waves: v_ph = c/√3 at n_c/4 (cold), reflected electrons at 2v_ph carry 2β²γ²mc²', () => {
    const w = srsPlasmaWave(0.25, 0)!
    expect(w.vph).toBeCloseTo(1 / Math.sqrt(3), 6)
    expect(reflectedEnergyKeV(w.vph)).toBeCloseTo(MEC2_KEV, 6)
    expect(reflectedEnergyNonRelKeV(w.vph)).toBeCloseTo(MEC2_KEV / 1.5, 6)
    // with thermal corrections: matching (ω, k) and the phase velocity at 0.2 n_c, 3 keV
    const s = srsPlasmaWave(0.2, 3)!
    const b2 = 3 / MEC2_KEV
    const k0 = Math.sqrt(0.8)
    const ks = s.k - k0
    expect(Math.sqrt(0.2 + ks * ks) + s.w).toBeCloseTo(1, 10)
    expect(s.vph).toBeCloseTo(0.404, 3)
    expect(s.w ** 2).toBeCloseTo(0.2 + 3 * b2 * s.k ** 2, 12)
    expect(srsPlasmaWave(0.25, 3)).toBeNull()
    // relativistic velocity addition: v = 2v_ph/(1 + β²), γ − 1 = 2β²γ²
    const beta = 0.367
    const v = (2 * beta) / (1 + beta * beta)
    expect((1 / Math.sqrt(1 - v * v) - 1) * MEC2_KEV).toBeCloseTo(reflectedEnergyKeV(beta), 8)
  })
})
