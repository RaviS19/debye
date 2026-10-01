// A8: the Rayleigh–Taylor solver against linear theory.
import { describe, expect, it } from 'vitest'
import { createRT, measuredGrowth, modeAmplitude, rtDiffuse, rtLinearGrowth, rtSharp, rtTimeStep, rtViscous, stepRT, type RTOptions } from './rayleighTaylor'

function runLinear(o: RTOptions) {
  const rt = createRT(o)
  while (rt.t < 12) {
    stepRT(rt, rtTimeStep(rt))
    const m = measuredGrowth(rt)
    if (m?.done) return m.sigma
  }
  throw new Error('linear phase never ended')
}

describe('Rayleigh–Taylor linear theory', () => {
  it('tanh interface: σ² = Agk/(1 + kδ) when inviscid', () => {
    for (const mode of [1, 2, 4]) {
      const k = 2 * Math.PI * mode
      const s = rtLinearGrowth({ A: 0.25, nu: 0, delta: 0.02, mode })
      expect(Math.abs(s / rtDiffuse(0.25, 1, k, 0.02) - 1)).toBeLessThan(0.02)
    }
  })
  it('viscosity slows growth by about νk² (viscous estimate within 5%)', () => {
    const k = 4 * Math.PI
    const s = rtLinearGrowth({ A: 0.25, nu: 1e-3, delta: 0.02, mode: 2 })
    const est = rtViscous(rtDiffuse(0.25, 1, k, 0.02), 1e-3, k)
    expect(Math.abs(s / est - 1)).toBeLessThan(0.05)
    expect(s).toBeLessThan(rtDiffuse(0.25, 1, k, 0.02))
  })
})

describe('Rayleigh–Taylor simulation', () => {
  it('measured linear growth matches the exact viscous value (2%) and √(Agk) (20%)', () => {
    const o = { A: 0.25, nu: 3e-4, delta: 0.02, mode: 2, noise: 0.01 }
    const meas = runLinear(o)
    const exact = rtLinearGrowth(o)
    const ideal = rtSharp(0.25, 1, 4 * Math.PI)
    expect(Math.abs(meas / exact - 1)).toBeLessThan(0.02)
    expect(Math.abs(meas / ideal - 1)).toBeLessThan(0.2)
  })
  it('inviscid 2D run matches the analytic tanh-profile rate σ² = Agk/(1 + kδ) within 2%', () => {
    // independent of rtLinearGrowth: the closed-form Pöschl–Teller eigenvalue of the tanh profile
    for (const mode of [1, 3]) {
      const meas = runLinear({ A: 0.25, nu: 0, delta: 0.02, mode, eta0: 0.002 / mode, noise: 0.01 })
      expect(Math.abs(meas / rtDiffuse(0.25, 1, 2 * Math.PI * mode, 0.02) - 1)).toBeLessThan(0.02)
    }
  })
  it('viscous run matches an independent continuum eigenvalue within 1.5%', () => {
    // dense eigen-solve of the linearized viscous Boussinesq equations, tanh profile, free-slip walls at
    // z = ±1, 1400 points in z (scipy): σ = 1.5167 for A = 0.25, ν = 3e-4, δ = 0.02, k = 4π
    const meas = runLinear({ A: 0.25, nu: 3e-4, delta: 0.02, mode: 2, noise: 0.01 })
    expect(Math.abs(meas / 1.5167 - 1)).toBeLessThan(0.015)
    // the viscous estimate √(σ₀² + ν²k⁴) − νk² is only approximate: 1.5378, 1.4% high here
    const k = 4 * Math.PI
    expect(rtViscous(rtDiffuse(0.25, 1, k, 0.02), 3e-4, k) / 1.5167 - 1).toBeGreaterThan(0.005)
  })
  it('large seed noise never yields a contaminated rate: the fit is either accurate or abandoned', () => {
    for (const noise of [0.03, 0.1]) {
      for (const A of [0.05, 0.5]) {
        const o = { A, nu: 1e-4, delta: 0.02, mode: 1, eta0: 0.002, noise }
        const rt = createRT(o)
        let m = measuredGrowth(rt)
        while (rt.t < 12 && !m?.done) {
          stepRT(rt, rtTimeStep(rt))
          m = measuredGrowth(rt)
        }
        if (m && Number.isFinite(m.sigma)) expect(Math.abs(m.sigma / rtLinearGrowth(o) - 1)).toBeLessThan(0.03)
        else expect(m?.noisy).toBe(true)
      }
    }
  })
  it('short, fast modes still leave a fit window (m = 5, A = 0.5, seed kη₀ fixed as in the sim)', () => {
    const o = { A: 0.5, nu: 1e-4, delta: 0.02, mode: 5, eta0: 0.002 / 5, noise: 0.1 }
    const meas = runLinear(o)
    expect(Math.abs(meas / rtLinearGrowth(o) - 1)).toBeLessThan(0.03)
  })
  it('the nonlinear stage stays finite and the buoyancy stays within ±gA', () => {
    const rt = createRT({ A: 0.5, nu: 1e-4, delta: 0.02, mode: 1, eta0: 0.002 })
    while (rt.t < 12) stepRT(rt, rtTimeStep(rt))
    let bmax = 0
    for (const x of rt.b) bmax = Math.max(bmax, Math.abs(x))
    expect(Number.isFinite(bmax)).toBe(true)
    expect(bmax).toBeLessThanOrEqual(0.5 + 1e-12)
    for (const x of rt.om) expect(Number.isFinite(x)).toBe(true)
  })
  it('growth rate scales as √A', () => {
    const oLo = { A: 0.1, nu: 3e-4, delta: 0.02, mode: 1, noise: 0.01 }
    const oHi = { ...oLo, A: 0.4 }
    const lo = runLinear(oLo)
    const hi = runLinear(oHi)
    expect(hi / lo).toBeGreaterThan(1.9)
    expect(hi / lo).toBeLessThan(2.1)
    expect(Math.abs(lo / rtLinearGrowth(oLo) - 1)).toBeLessThan(0.02)
    expect(Math.abs(hi / rtLinearGrowth(oHi) - 1)).toBeLessThan(0.02)
  })
  it('light fluid on top is stable: the ripple only oscillates', () => {
    const rt = createRT({ A: 0.25, nu: 3e-4, delta: 0.02, mode: 2, flipped: true, noise: 0.01 })
    let peak = 0
    while (rt.t < 6) {
      stepRT(rt, rtTimeStep(rt))
      peak = Math.max(peak, modeAmplitude(rt))
    }
    // an unstable run grows by e^{1.5·6} ≈ 8000; a stable one stays at the seed's level
    const seedVelocity = 0.001 * rtDiffuse(0.25, 1, 4 * Math.PI, 0.02)
    expect(peak).toBeLessThan(3 * seedVelocity)
  })
})
