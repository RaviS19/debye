// A5 benchmarks: a warm-electron PIC run rings at the Bohm–Gross frequency, the ion acoustic and hybrid
// formulas reduce to their textbook limits, and a wave packet moves its crests at ω/k and its envelope at dω/dk.
import { describe, expect, it } from 'vitest'
import {
  bohmGross,
  bohmGrossGroup,
  bohmGrossSI,
  createEpwRun,
  createPacket,
  epwFrequency,
  evalPacket,
  ionAcoustic,
  ionAcousticSI,
  ionCyclotronWave,
  lowerHybrid,
  lowerHybridSI,
  createTracker,
  trackPacket,
  trackedGroupVelocity,
  trackedPhaseVelocity,
  PACKET_MODELS,
  phaseGroup,
  soundSpeed,
  stepEpwRun,
  upperHybrid,
  upperHybridSI,
} from './eswaves'
import { cyclotronFrequency, debyeLength, me, mp, plasmaFrequency } from './constants'

describe('electron plasma waves in 1D PIC (warm electrons)', () => {
  // Real part of the Landau root of 1 + [1 + ζZ(ζ)]/(kλ_D)² = 0 with ζ = ω/(√2 k v_th), from a Z-function
  // root solve (scipy wofz + fsolve). The fluid Bohm–Gross relation falls below these as kλ_D grows.
  const KINETIC: Record<number, number> = { 0.2: 1.0640, 0.25: 1.1057, 0.3: 1.1598 }

  it('measured ω matches Bohm–Gross within 3% and kinetic theory within 1.5% for kλ_D = 0.2–0.3', () => {
    for (const K of [0.2, 0.25, 0.3]) {
      const run = createEpwRun(K, 12000)
      stepEpwRun(run, 900)
      const w = epwFrequency(run)!
      expect(w).not.toBeNull()
      expect(run.faded).toBe(false)
      expect(Math.abs(w / bohmGross(K) - 1)).toBeLessThan(0.03)
      expect(Math.abs(w / KINETIC[K] - 1)).toBeLessThan(0.015)
      expect(w).toBeGreaterThan(1.02) // clearly above the cold ω_pe: the thermal shift is resolved
    }
  }, 20000)

  it('the explorer\'s k range (0.05–0.45) always yields a frequency, even when Landau damping fades the wave', () => {
    const lo = createEpwRun(0.05, 12000)
    stepEpwRun(lo, 900)
    expect(Math.abs(epwFrequency(lo)! / bohmGross(0.05) - 1)).toBeLessThan(0.01)
    const hi = createEpwRun(0.45, 12000)
    stepEpwRun(hi, 900)
    expect(epwFrequency(hi)).not.toBeNull()
    expect(epwFrequency(hi)!).toBeGreaterThan(bohmGross(0.45)) // kinetic ω_r = 1.350 lies above Bohm–Gross 1.268
    expect(Math.abs(epwFrequency(hi)! / 1.3503 - 1)).toBeLessThan(0.03)
  }, 10000)

  it('long waves recover the cold plasma frequency', () => {
    const run = createEpwRun(0.08, 8000)
    stepEpwRun(run, 700)
    expect(epwFrequency(run)!).toBeCloseTo(1.0096, 2)
  }, 10000)
})

describe('fluid dispersion relations', () => {
  const mu = me / mp

  it('Bohm–Gross in SI agrees with the normalized form and v_φ v_g = 3 v_th²', () => {
    const n = 1e18
    const T = 10
    const k = (2 * Math.PI) / 1e-3
    const K = k * debyeLength(n, T)
    expect(bohmGrossSI(k, n, T) / plasmaFrequency(n)).toBeCloseTo(bohmGross(K), 10)
    expect(bohmGrossSI(k, n, T) / (2 * Math.PI)).toBeCloseTo(9.268e9, -7) // problem A5-p1
    for (const x of [0.1, 0.3, 1]) expect((bohmGross(x) / x) * bohmGrossGroup(x)).toBeCloseTo(3, 10)
  })

  it('ion sound speed c_s = √((kTe + 3kTi)/M) and its limits', () => {
    expect(soundSpeed(10, 0)).toBeCloseTo(3.095e4, -1) // 10 eV electrons, cold protons: about 31 km/s
    expect(soundSpeed(20, 2)).toBeCloseTo(4.990e4, -1) // problem A5-p2
    const n = 1e17
    const Te = 5
    const Ti = 0.5
    const lD = debyeLength(n, Te)
    // long waves: ω/k → c_s
    const kSmall = 1e-4 / lD
    expect(ionAcousticSI(kSmall, n, Te, Ti) / kSmall).toBeCloseTo(soundSpeed(Te, Ti), -1)
    // the normalized function is the same relation
    const K = 0.7
    const wSI = ionAcousticSI(K / lD, n, Te, Ti)
    expect(wSI / plasmaFrequency(n)).toBeCloseTo(ionAcoustic(K, mu, Ti / Te), 8)
    // short waves with cold ions: ω → ω_pi
    expect(ionAcoustic(300, mu, 0) / Math.sqrt(mu)).toBeCloseTo(1, 4)
    expect(ionAcousticSI(300 / lD, n, Te, 0) / plasmaFrequency(n, mp)).toBeCloseTo(1, 4)
  })

  it('hybrid and cyclotron frequencies', () => {
    const n = 1e19
    const B = 1
    expect(upperHybridSI(n, B) / (2 * Math.PI)).toBeCloseTo(3.987e10, -7) // problem A5-p3
    const wc = cyclotronFrequency(B) / plasmaFrequency(n)
    expect(upperHybrid(0, wc)).toBeCloseTo(upperHybridSI(n, B) / plasmaFrequency(n), 10)
    expect(lowerHybrid(me / mp, wc)).toBeCloseTo(lowerHybridSI(n, B) / plasmaFrequency(n), 10)
    // dense plasma: ω_LH → √(ω_ce Ω_ci)
    const dense = lowerHybridSI(1e24, B)
    expect(dense / Math.sqrt(cyclotronFrequency(B) * cyclotronFrequency(B, mp))).toBeCloseTo(1, 2)
    // it is the cold-plasma lower hybrid resonance: the root of S = 1 − ω_pe²/(ω² − ω_ce²) − ω_pi²/(ω² − Ω_ci²) = 0
    for (const nn of [1e16, 1e18, 1e20]) {
      const wpe2 = plasmaFrequency(nn) ** 2
      const wpi2 = plasmaFrequency(nn, mp) ** 2
      const wce = cyclotronFrequency(B)
      const wci = cyclotronFrequency(B, mp)
      const S = (w: number) => 1 - wpe2 / (w * w - wce * wce) - wpi2 / (w * w - wci * wci)
      let lo = wci * 1.000001
      let hi = Math.sqrt(wce * wci) * 1.5
      for (let i = 0; i < 200; i++) {
        const mid = Math.sqrt(lo * hi)
        if (S(mid) < 0) lo = mid
        else hi = mid
      }
      expect(Math.abs(lowerHybridSI(nn, B) / lo - 1)).toBeLessThan(2e-3) // equal up to O(m_e/M)
    }
    // warm-fluid upper hybrid branch: ω² − ω_h² = 3k²v_th²
    expect(upperHybrid(0.4, wc) ** 2 - upperHybrid(0, wc) ** 2).toBeCloseTo(3 * 0.16, 10)
    // electrostatic ion cyclotron wave starts at Ω_ci
    expect(ionCyclotronWave(0, me / mp, 0.1, wc) / ((me / mp) * wc)).toBeCloseTo(1, 10)
  })
})

describe('wave packets', () => {
  const measure = (key: keyof typeof PACKET_MODELS, k0: number) => {
    const w = PACKET_MODELS[key].w
    const L = 400
    const sigma = 10 / k0
    const xs = new Float64Array(1600).map((_, i) => (i * L) / 1600)
    const re = new Float64Array(xs.length)
    const env = new Float64Array(xs.length)
    const p = createPacket(w, k0, sigma, L, 100)
    evalPacket(p, xs, 0, re, env)
    const tr = createTracker(xs, env)
    const dt = 0.1
    for (let t = dt; t <= 60 + 1e-9; t += dt) {
      evalPacket(p, xs, t, re, env)
      trackPacket(tr, xs, re, env, dt, k0, sigma, L)
    }
    return { vg: trackedGroupVelocity(tr), vp: trackedPhaseVelocity(tr), theory: phaseGroup(w, k0) }
  }

  it('electron plasma wave: crests at ω/k, envelope at dω/dk = 3k v_th²/ω', () => {
    const m = measure('epw', 0.5)
    expect(Math.abs(m.vp / m.theory.vp - 1)).toBeLessThan(0.015)
    expect(Math.abs(m.vg / m.theory.vg - 1)).toBeLessThan(0.03)
    expect(m.theory.vg).toBeCloseTo(bohmGrossGroup(0.5), 6)
  })

  it('ion acoustic wave near the Debye rollover: v_g < v_φ', () => {
    const m = measure('iaw', 1)
    expect(Math.abs(m.vp / m.theory.vp - 1)).toBeLessThan(0.015)
    expect(Math.abs(m.vg / m.theory.vg - 1)).toBeLessThan(0.03)
    expect(m.theory.vg).toBeCloseTo(1 / 2 ** 1.5, 5)
  })

  it('cold plasma oscillation: crests move but the packet stays put', () => {
    const m = measure('cold', 0.5)
    expect(Math.abs(m.vg)).toBeLessThan(0.01)
    expect(Math.abs(m.vp / 2 - 1)).toBeLessThan(0.015)
  })

  it('the simulation\'s own packet (L = 12σ, 480 points, 3× speed) reads within its 3% + 0.01 tolerance at every slider end', () => {
    const cases: [keyof typeof PACKET_MODELS, number][] = [['epw', 0.25], ['epw', 1.2], ['iaw', 0.2], ['iaw', 2], ['cold', 0.25], ['cold', 1.2]]
    for (const [key, k0] of cases) {
      const w = PACKET_MODELS[key].w
      const sigma = 10 / k0
      const L = 12 * sigma
      const xs = new Float64Array(480).map((_, i) => (i * L) / 480)
      const re = new Float64Array(480)
      const env = new Float64Array(480)
      const p = createPacket(w, k0, sigma, L, 0.3 * L)
      evalPacket(p, xs, 0, re, env)
      const tr = createTracker(xs, env)
      const dt = (0.45 / Math.max(w(k0), 0.2)) * 3
      let t = 0
      for (let f = 0; f < 300; f++) {
        t += dt
        evalPacket(p, xs, t, re, env)
        trackPacket(tr, xs, re, env, dt, k0, sigma, L)
      }
      const th = phaseGroup(w, k0)
      expect(Math.abs(trackedPhaseVelocity(tr) - th.vp)).toBeLessThan(0.03 * th.vp + 0.01)
      expect(Math.abs(trackedGroupVelocity(tr) - th.vg)).toBeLessThan(0.03 * Math.abs(th.vg) + 0.01)
    }
  })
})
