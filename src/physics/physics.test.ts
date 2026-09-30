// Every simulation is checked against the analytic result the lesson teaches.
import { describe, expect, it } from 'vitest'
import { borisStep, mirrorField, mirrorZmax, sandboxField, type Particle } from './boris'
import { createPic, stepPic } from './pic1d'
import { createDebye, radialProfile, sweepDebye, theoryDensity } from './debye'
import {
  cyclotronFrequency,
  debyeLength,
  larmorRadius,
  lossFraction,
  lossConeAngle,
  plasmaFrequency,
  plasmaParameter,
  mp,
} from './constants'

describe('formulas', () => {
  it('matches textbook numbers', () => {
    expect(debyeLength(1e16, 10)).toBeCloseTo(2.35e-4, 6) // 7430·√(T/n)
    expect(plasmaFrequency(1e18) / (2 * Math.PI)).toBeCloseTo(8.98e9, -7) // 8.98√n Hz
    expect(cyclotronFrequency(1) / (2 * Math.PI)).toBeCloseTo(2.799e10, -8) // 28 GHz/T
    expect(larmorRadius(1e5, 0.1, mp)).toBeCloseTo(1.044e-2, 4)
    expect((lossConeAngle(4) * 180) / Math.PI).toBeCloseTo(30, 6)
    expect(lossFraction(4)).toBeCloseTo(0.134, 3)
    expect(plasmaParameter(1e18, 10)).toBeGreaterThan(5e4)
  })
})

describe('Boris pusher', () => {
  it('gyrates at ω_c = qB/m and conserves energy', () => {
    const p: Particle = { x: [0, 0, 0], v: [1, 0, 0], q: 1, m: 1 }
    const f = sandboxField(1, 0, 0, 0)
    const dt = 0.01
    let t = 0
    let crossings = 0
    let prevVy = p.v[1]
    while (t < 20 * Math.PI) {
      borisStep(p, f, t, dt)
      t += dt
      if (prevVy < 0 && p.v[1] >= 0) crossings++
      prevVy = p.v[1]
    }
    expect(crossings).toBe(10) // period 2π
    expect(Math.hypot(...p.v)).toBeCloseTo(1, 10)
  })

  it('drifts at E×B/B² for either sign of charge', () => {
    for (const q of [1, -1]) {
      const p: Particle = { x: [0, 0, 0], v: [0, 0, 0], q, m: 1 }
      const f = sandboxField(2, 0, 0.5, 0) // E = x̂ 0.5, B = ẑ 2 → v_E = −ŷ 0.25
      const T = 2 * Math.PI * 20 // whole gyro-periods (ω_c = 2)
      const dt = 0.005
      for (let t = 0; t < T / 2; t += dt) borisStep(p, f, t, dt)
      expect(p.x[1] / (T / 2)).toBeCloseTo(-0.25, 2)
    }
  })

  it('∇B drift is opposite for ions and electrons and matches ½ v⊥ r_L ∇B/B', () => {
    const drift = (q: number) => {
      const p: Particle = { x: [0, 0, 0], v: [0.1, 0, 0], q, m: 1 }
      const f = sandboxField(1, 0.05, 0, 0)
      const dt = 0.01
      const T = 2 * Math.PI * 50
      for (let t = 0; t < T; t += dt) borisStep(p, f, t, dt)
      return p.x[1] / T
    }
    const theory = 0.5 * 0.1 * 0.1 * 0.05 // v⊥ r_L (∇B/B) / 2
    const ion = drift(1)
    const ele = drift(-1)
    expect(Math.sign(ion)).toBe(-Math.sign(ele))
    expect(Math.abs(ion)).toBeGreaterThan(theory * 0.8)
    expect(Math.abs(ion)).toBeLessThan(theory * 1.2)
  })

  it('mirror traps particles outside the loss cone and loses those inside', () => {
    const R = 4 // loss cone 30°
    const L = 30
    const zm = mirrorZmax(R, L)
    const f = mirrorField(1, L)
    const run = (pitchDeg: number) => {
      const th = (pitchDeg * Math.PI) / 180
      const p: Particle = { x: [0, 0, 0], v: [Math.sin(th) * 0.3, 0, Math.cos(th) * 0.3], q: 1, m: 1 }
      for (let t = 0; t < 2000; t += 0.02) {
        borisStep(p, f, t, 0.02)
        if (Math.abs(p.x[2]) > zm) return 'lost'
      }
      return 'trapped'
    }
    expect(run(45)).toBe('trapped')
    expect(run(20)).toBe('lost')
  })
})

describe('1D PIC', () => {
  it('cold plasma oscillates at ω_pe = 1', () => {
    const pic = createPic({ n: 4000, ng: 64, L: 2 * Math.PI, dt: 0.05, amplitude: 0.01, mode: 1, vth: 0 })
    const samples: number[] = []
    for (let i = 0; i < 400; i++) {
      stepPic(pic)
      samples.push(pic.E[16])
    }
    const zeros: number[] = []
    for (let i = 1; i < samples.length; i++) {
      if (samples[i - 1] < 0 && samples[i] >= 0) zeros.push(i * pic.dt)
    }
    const period = (zeros[zeros.length - 1] - zeros[0]) / (zeros.length - 1)
    expect((2 * Math.PI) / period).toBeCloseTo(1, 1)
  })
})

describe('Debye Monte Carlo', () => {
  it('reproduces the Boltzmann density near the charge', () => {
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const s = createDebye(4000, rand)
    for (let i = 0; i < 600; i++) sweepDebye(s, 0.06, rand)
    const acc = new Array(6).fill(0)
    for (let k = 0; k < 60; k++) {
      sweepDebye(s, 0.06, rand)
      radialProfile(s, 6, 0.3).forEach((d, i) => (acc[i] += d / 60))
    }
    // compare away from the steep core, where a bin average ≈ the point value
    for (const [bin, r] of [[2, 0.125], [3, 0.175], [5, 0.275]] as const) {
      const ratio = acc[bin] / theoryDensity(s, r)
      expect(ratio).toBeGreaterThan(0.85)
      expect(ratio).toBeLessThan(1.15)
    }
    expect(acc[0]).toBeGreaterThan(3 * acc[5]) // the shielding cloud
  })
})
