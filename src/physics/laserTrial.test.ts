import { describe, expect, it } from 'vitest'
import { boltzmannRatio, newLaser, relaxationOmega, steadyPhotons, stepLaser, thresholdInversion, type LaserParams } from './laserRate'
import { fwhm, gaussianAmplitudes, lockedPulseWidth, max, mean, modeSumIntensity, phases } from './modeLock'
import { GLASSES, gddBroadened, gvd, makeGrid, shapePulse, transformLimit, widthAtHalf } from './pulse'

describe('L1 laser rate equations', () => {
  const run = (p: LaserParams, T: number, dt = 0.002) => {
    const s = newLaser()
    s.phi = 1e-6
    const Ns: number[] = []
    const ts: number[] = []
    while (s.t < T) {
      stepLaser(s, p, dt)
      Ns.push(s.N)
      ts.push(s.t)
    }
    return { s, Ns, ts }
  }
  it('clamps the inversion at threshold and gives φ = τc (R − R_th) above it', () => {
    const p = { R: 300, tauC: 0.01 }
    const { s } = run(p, 30)
    expect(s.N / thresholdInversion(p)).toBeCloseTo(1, 2)
    expect(Math.abs(s.phi / steadyPhotons(p) - 1)).toBeLessThan(0.01)
  })
  it('stays dark below threshold', () => {
    const p = { R: 50, tauC: 0.01 }
    const { s } = run(p, 30)
    expect(s.N).toBeCloseTo(50, 1)
    expect(s.phi).toBeLessThan(1e-3)
  })
  it('rings at the relaxation-oscillation frequency', () => {
    const p = { R: 300, tauC: 0.01 }
    const { Ns, ts } = run(p, 6)
    const nTh = thresholdInversion(p)
    // upward crossings of N through N_th after the first spike
    const up: number[] = []
    for (let i = 1; i < Ns.length; i++) if (ts[i] > 0.5 && Ns[i - 1] < nTh && Ns[i] >= nTh) up.push(ts[i])
    const period = (up[up.length - 1] - up[0]) / (up.length - 1)
    const w = (2 * Math.PI) / period
    expect(Math.abs(w / relaxationOmega(p) - 1)).toBeLessThan(0.1)
  })
  it('thermal populations never invert (633 nm at 300 K: ΔE/kT ≈ 75.8)', () => {
    expect(-Math.log(boltzmannRatio(632.8e-9, 300))).toBeCloseTo(75.8, 1)
    expect(boltzmannRatio(632.8e-9, 1e6)).toBeLessThan(1)
  })
})

describe('L2 mode-locking as a sum of modes', () => {
  it('a locked Gaussian comb gives the 0.441 time–bandwidth pulse', () => {
    const amp = gaussianAmplitudes(60, 12)
    const I = modeSumIntensity(amp, new Float64Array(amp.length), 4096)
    const w = fwhm(I) / 4096
    expect(Math.abs(w / lockedPulseWidth(12) - 1)).toBeLessThan(0.02)
  })
  it('N equal locked modes: peak N², mean N; random phases keep the mean', () => {
    const N = 21
    const amp = new Float64Array(N).fill(1)
    const locked = modeSumIntensity(amp, new Float64Array(N), 8192)
    expect(max(locked)).toBeCloseTo(N * N, 6)
    expect(mean(locked)).toBeCloseTo(N, 6)
    const noisy = modeSumIntensity(amp, phases(N, 0, 3), 8192)
    expect(mean(noisy)).toBeCloseTo(N, 6)
    expect(max(noisy)).toBeLessThan(0.6 * N * N)
  })
})

describe('L3 ultrashort pulses', () => {
  const g = makeGrid(2048, 1600)
  it('a flat-phase Gaussian spectrum is transform limited (Δν·τ = 0.441)', () => {
    const tau = transformLimit(800, 30) // ≈ 31.4 fs
    expect(tau).toBeCloseTo(31.4, 0)
    const dw = (2 * Math.PI * 2 * Math.LN2) / Math.PI / tau
    const out = shapePulse(g, dw, 0, 0)
    expect(Math.abs(widthAtHalf(out.I, g.dt) / tau - 1)).toBeLessThan(0.01)
    expect(Math.max(...out.I)).toBeCloseTo(1, 3)
  })
  it('GDD broadens the pulse as τ₀√(1 + (4 ln2 GDD/τ₀²)²) and chirps it red-first', () => {
    const tau0 = 20
    const dw = (4 * Math.LN2) / tau0
    for (const gdd of [100, 361, 1000]) {
      const out = shapePulse(g, dw, gdd, 0)
      expect(Math.abs(widthAtHalf(out.I, g.dt) / gddBroadened(tau0, gdd) - 1)).toBeLessThan(0.01)
    }
    const out = shapePulse(g, dw, 361, 0)
    const k0 = g.n / 2
    expect(out.instFreq[k0 - 15]).toBeLessThan(0) // early: red (Ω < 0)
    expect(out.instFreq[k0 + 15]).toBeGreaterThan(0) // late: blue
  })
  it('Sellmeier GVD: fused silica ≈ 36.2 and BK7 ≈ 44.7 fs²/mm at 800 nm', () => {
    expect(gvd(GLASSES[0], 0.8)).toBeCloseTo(36.2, 0)
    expect(gvd(GLASSES[1], 0.8)).toBeCloseTo(44.7, 0)
  })
})
