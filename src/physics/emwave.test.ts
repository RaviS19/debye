// A6 benchmarks: the FDTD plasma solver against cold-plasma theory, and the CMA classifier.
import { describe, expect, it } from 'vitest'
import {
  branchOmega,
  createLaser,
  criticalX,
  cutoffs,
  decayLength,
  fresnelR,
  LASER,
  modeN2,
  plasmaK,
  propagating,
  reflectance,
  settleTime,
  skinDepth,
  stepEM,
  turningPoint,
  wavenumber,
  type EMGrid,
  type Profile,
} from './emwave'

function run(omega: number, profile: Profile, until: number): EMGrid {
  const g = createLaser(omega, profile)
  while (g.t < until) stepEM(g)
  return g
}

describe('FDTD light in a uniform plasma', () => {
  // Sharp edge: the plasma is uniform (ω_p = 1) from x = 12 on. Measure k from the steady-state phase.
  for (const omega of [1.2, 1.5, 2]) {
    it(`ω = ${omega} ω_p: wavelength and phase velocity match ω² = ω_p² + c²k² (within 1%)`, () => {
      const g = run(omega, 'edge', settleTime(omega, 'edge'))
      const k = wavenumber(g, 15, 50)
      const kTh = plasmaK(omega)
      expect(Math.abs(k / kTh - 1)).toBeLessThan(0.01)
      const vph = omega / k
      expect(Math.abs(vph / (omega / kTh) - 1)).toBeLessThan(0.01)
      expect(vph).toBeGreaterThan(1) // faster than light: phase velocity, carries no signal
    })
  }
})

describe('FDTD reflection from a density ramp', () => {
  for (const omega of [0.5, 0.7, 0.85]) {
    it(`ω = ${omega} ω_p: the wave turns around at the n = n_c layer and is totally reflected`, () => {
      const g = run(omega, 'ramp', settleTime(omega, 'ramp') + 20)
      const xc = criticalX(omega, 'ramp')
      const xt = turningPoint(g, LASER.X0)
      // Airy scale δ = (c² L/ω²)^{1/3} ≈ 2.9 c/ω_p here; demand agreement to 3 grid cells (δ/20)
      expect(Math.abs(xt - xc)).toBeLessThan(3 * LASER.dx)
      // the turn-on also excites frequencies near the plateau cutoff ω_p, which ring for hundreds of
      // periods and beat with ω in the one-period lock-in: a ±2% wobble at ω = 0.85, less further away
      expect(Math.abs(reflectance(g) - 1)).toBeLessThan(omega > 0.8 ? 0.025 : 0.01)
    })
  }

  it('ω above the peak plasma frequency is transmitted (no reflection from a gradual ramp)', () => {
    const g = run(1.5, 'ramp', settleTime(1.5, 'ramp'))
    expect(reflectance(g)).toBeLessThan(1e-3)
    expect(Math.abs(wavenumber(g, 40, 54) / plasmaK(1.5) - 1)).toBeLessThan(0.01)
  })
})

describe('FDTD at a sharp plasma edge', () => {
  for (const omega of [0.5, 0.7]) {
    it(`ω = ${omega} ω_p: evanescent tail decays over c/√(ω_p² − ω²) (within 2%)`, () => {
      const g = run(omega, 'edge', settleTime(omega, 'edge'))
      const d = decayLength(g, LASER.X0 + 0.5, LASER.X0 + 3)
      expect(Math.abs(d / skinDepth(omega) - 1)).toBeLessThan(0.02)
      expect(Math.abs(reflectance(g) - 1)).toBeLessThan(0.01)
    })
  }

  it('above cutoff, the reflected fraction matches Fresnel |(1−N)/(1+N)|², even close to cutoff', () => {
    // ω = 1.1 has a plasma wavelength of 14 c/ω_p: a short absorbing layer reflects it and spoils R
    for (const omega of [1.1, 1.2, 1.5]) {
      const g = run(omega, 'edge', settleTime(omega, 'edge'))
      expect(Math.abs(reflectance(g) / fresnelR(omega) - 1)).toBeLessThan(0.03)
    }
  })
})

describe('the sim readouts settle at every slider frequency next to the cutoff', () => {
  // The sim marks a readout "ready" at settleTime; from then on it must stay inside the sim's own
  // tolerances (R within 0.03, x_turn within 0.3, decay length within 4%, wavelength within 2%).
  for (const [omega, profile] of [[0.9, 'ramp'], [0.9, 'edge'], [1.1, 'ramp'], [1.1, 'edge']] as const) {
    it(`ω = ${omega}, ${profile}`, () => {
      const g = run(omega, profile, settleTime(omega, profile))
      const Rth = profile === 'edge' ? fresnelR(omega) : omega < 1 ? 1 : 0
      let p = g.periods
      const tEnd = g.t + 150
      while (g.t < tEnd) {
        stepEM(g)
        if (g.periods === p) continue
        p = g.periods
        expect(Math.abs(reflectance(g) - Rth)).toBeLessThan(0.03)
        if (omega > 1) expect(Math.abs(wavenumber(g, 40, 54) / plasmaK(omega) - 1)).toBeLessThan(0.02)
        else if (profile === 'ramp') expect(Math.abs(turningPoint(g, LASER.X0) - criticalX(omega, 'ramp'))).toBeLessThan(0.3)
        else expect(Math.abs(decayLength(g, LASER.X0 + 0.5, LASER.X0 + 3) / skinDepth(omega) - 1)).toBeLessThan(0.05)
      }
    })
  }
})

describe('CMA diagram classifier (cold electrons, fixed ions)', () => {
  const cases: [number, number, string][] = [
    [0.5, 0.2, 'RLOX'], // thin plasma, weak field: everything propagates
    [2, 0.5, ''], // overdense, weak field: nothing gets in
    [0.6, 0.5, 'LO'], // past the R cutoff, below the upper-hybrid layer: R and X evanescent
    [1.2, 0.3, 'LX'], // X between upper hybrid and L cutoff; O beyond its cutoff
    [2.8, 1.5, 'R'], // whistler: only the R wave survives in dense plasma with ω < ω_c
    [0.3, 1.5, 'RLOX'],
  ]
  for (const [X, Y, want] of cases) {
    it(`X = ${X}, Y = ${Y} → ${want || 'none'}`, () => {
      const p = propagating(X, Y)
      const got = (['R', 'L', 'O', 'X'] as const).filter((m) => p[m]).join('')
      expect(got).toBe(want)
    })
  }

  it('cutoffs and resonances sit where the formulas say', () => {
    const b = 0.7
    const { wR, wL, wUH } = cutoffs(b)
    // at ω = ω_R the R-wave has n = 0; at ω_L the L-wave does; at ω_UH the X-mode resonates
    expect(Math.abs(modeN2(1 / wR ** 2, b / wR).R)).toBeLessThan(1e-12)
    expect(Math.abs(modeN2(1 / wL ** 2, b / wL).L)).toBeLessThan(1e-12)
    expect(Math.abs(modeN2(1 / (wUH * 1.000001) ** 2, b / (wUH * 1.000001)).X)).toBeGreaterThan(1e4)
    // dispersion branches start at their cutoffs and approach their resonances
    expect(branchOmega('R-high', 1e-6, b)).toBeCloseTo(wR, 6)
    expect(branchOmega('L', 1e-6, b)).toBeCloseTo(wL, 6)
    expect(branchOmega('X-low', 1e-6, b)).toBeCloseTo(wL, 6)
    expect(branchOmega('X-high', 1e-6, b)).toBeCloseTo(wR, 6)
    expect(branchOmega('R-whistler', 50, b)).toBeLessThan(b)
    expect(branchOmega('R-whistler', 50, b)).toBeGreaterThan(0.99 * b)
    expect(branchOmega('X-low', 50, b)).toBeGreaterThan(0.99 * wUH)
    // and every branch satisfies its own dispersion relation
    for (const [br, m] of [['R-high', 'R'], ['R-whistler', 'R'], ['L', 'L'], ['X-low', 'X'], ['X-high', 'X']] as const) {
      const k = 1.3
      const w = branchOmega(br, k, b)
      expect(modeN2(1 / w ** 2, b / w)[m] * w * w).toBeCloseTo(k * k, 6)
    }
  })
})
