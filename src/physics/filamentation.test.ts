// B7 benchmarks: the paraxial solvers against vacuum diffraction, power conservation, the linear filamentation growth
// rate, and whole-beam self-focusing around the critical power.
import { describe, expect, it } from 'vitest'
import {
  createRadial,
  createSlab,
  criticalPowerW,
  fastestFilament,
  filamentationRate,
  gaussianWidthFactor,
  logSlope,
  radialAxis,
  radialHalfWidth,
  radialPower,
  radialRms,
  slabMode,
  slabPower,
  slabRms,
  stepRadial,
  stepSlab,
  TOWNES_N,
  unitsUm,
  upOverT,
} from './filamentation'

describe('slab split-step Fourier solver', () => {
  it('a Gaussian beam with the nonlinearity off follows vacuum diffraction within 1%', () => {
    const W = 6
    const L = 160
    const s = createSlab({ nx: 512, L, dZ: 0.05, nonlinear: false, profile: (X) => Math.exp(-(((X - L / 2) / W) ** 2)) })
    const w0 = slabRms(s)
    expect(w0).toBeCloseTo(W / 2, 6) // ⟨x²⟩ = W²/4 for intensity exp(−2x²/W²)
    const ZR = (W * W) / 4
    for (const target of [ZR, 2 * ZR, 3 * ZR]) {
      while (s.Z < target - 1e-9) stepSlab(s)
      expect(Math.abs(slabRms(s) / (w0 * gaussianWidthFactor(s.Z, W)) - 1)).toBeLessThan(0.01)
    }
  })

  it('conserves power to 1e-6 through filament formation and saturation', () => {
    const s0 = 0.05
    const L = (8 * 2 * Math.PI) / Math.sqrt(s0)
    const s = createSlab({ nx: 256, L, dZ: 0.02 / s0, noise: 0.01, seed: 3, profile: (X) => Math.sqrt(s0) * (1 + 0.02 * Math.cos((2 * Math.PI * 8 * X) / L)) })
    const P0 = slabPower(s)
    let peak = 0
    for (let i = 0; i < 600; i++) {
      stepSlab(s) // 12 e-folds of the fastest mode: well into the nonlinear stage
      for (let j = 0; j < s.nx; j++) peak = Math.max(peak, (s.re[j] ** 2 + s.im[j] ** 2) / s0)
    }
    expect(peak).toBeGreaterThan(3) // filaments have formed
    expect(Math.abs(slabPower(s) / P0 - 1)).toBeLessThan(1e-6)
  })

  it('a small ripple grows at the linear filamentation rate (two wavenumbers, within 2%)', () => {
    const s0 = 0.02
    const Kmax = Math.sqrt(s0)
    const L = (8 * 2 * Math.PI) / Kmax
    for (const m of [4, 10]) {
      const K = (2 * Math.PI * m) / L // K/K_max = 0.5 and 1.25
      const theory = filamentationRate(K, s0)
      const s = createSlab({ nx: 256, L, dZ: 0.02 / s0, profile: (X) => Math.sqrt(s0) * (1 + 1e-3 * Math.cos(K * X)) })
      const zs: number[] = []
      const as: number[] = []
      for (let i = 0; i < 400; i++) {
        stepSlab(s)
        zs.push(s.Z)
        as.push(slabMode(s, m))
      }
      const meas = logSlope(zs, as, 2 / theory, Infinity, 0, 0.05)!
      expect(meas).not.toBeNull()
      expect(Math.abs(meas / theory - 1)).toBeLessThan(0.02)
    }
  })

  it('the simulation default (351 nm, 1e15 W/cm², 2 keV, K = K_max, 0.3% noise) measures κ within 2%', () => {
    const s0 = upOverT(1e15, 0.351, 2)
    const NZ = 450
    const L = (8 * 2 * Math.PI) / Math.sqrt(s0)
    const K = (2 * Math.PI * 8) / L
    const theory = filamentationRate(K, s0)
    const s = createSlab({ nx: 256, L, dZ: 9 / s0 / NZ, noise: 0.003, seed: 4242, profile: (X) => Math.sqrt(s0) * (1 + 0.003 * Math.cos(K * X)) })
    const zs: number[] = []
    const as: number[] = []
    for (let i = 0; i < NZ; i++) {
      stepSlab(s)
      zs.push(s.Z)
      as.push(slabMode(s, 8))
    }
    const meas = logSlope(zs, as, Math.min(2 / theory, 0.45 * (9 / s0)), Infinity, 0, 0.1)!
    expect(Math.abs(meas / theory - 1)).toBeLessThan(0.02)
    // in physical units this is the 5.43 mm⁻¹ quoted in the lesson
    expect((theory / unitsUm(0.351, 0.1).z) * 1e3).toBeCloseTo(5.43, 2)
  })

  it('linear theory: fastest K² = s0 with κ = s0, cut-off at K² = 2 s0', () => {
    const s0 = 0.03
    let best = 0
    let bestK = 0
    for (let K = 0.001; K < 0.4; K += 0.0005) {
      const g = filamentationRate(K, s0)
      if (g > best) {
        best = g
        bestK = K
      }
    }
    expect(bestK).toBeCloseTo(Math.sqrt(s0), 3)
    expect(best).toBeCloseTo(s0, 6)
    expect(filamentationRate(Math.sqrt(2 * s0) * 1.0001, s0)).toBe(0)
  })
})

describe('physical units', () => {
  it('κ_max = (1/8)(v_os/v_e)² ω_pe²/(k0c²) and K_max = (v_os/2v_e) ω_pe/c', () => {
    const c = 2.99792458e8
    const me = 9.1093837015e-31
    const e = 1.602176634e-19
    const eps0 = 8.8541878128e-12
    const I = 1e15
    const lam = 0.351
    const nn = 0.1
    const T = 2
    const w0 = (2 * Math.PI * c) / (lam * 1e-6)
    const vos = (e * Math.sqrt((2 * I * 1e4) / (eps0 * c))) / (me * w0)
    const ve = Math.sqrt((T * 1e3 * e) / me)
    const wpe = w0 * Math.sqrt(nn)
    const k0 = (w0 / c) * Math.sqrt(1 - nn)
    const f = fastestFilament(I, lam, nn, T)
    expect(f.K / ((vos / (2 * ve)) * (wpe / c) * 1e-6)).toBeCloseTo(1, 6)
    expect(f.kappa / ((((vos / ve) ** 2 * wpe * wpe) / (8 * k0 * c * c)) * 1e-6)).toBeCloseTo(1, 6)
    // the worked example in the lesson: λ⊥ ≈ 14.6 µm, e-folding length ≈ 185 µm
    expect((2 * Math.PI) / f.K).toBeCloseTo(14.6, 0)
    expect(1 / f.kappa).toBeGreaterThan(180)
    expect(1 / f.kappa).toBeLessThan(190)
    expect(upOverT(I, lam, T)).toBeCloseTo(0.00576, 4)
    const u = unitsUm(lam, nn)
    expect(u.x).toBeCloseTo(c / wpe / 1e-6, 8)
  })

  it('critical powers: 31.7 MW per keV and 16.2 GW (Townes), 17.4 GW (Gaussian estimate), ratio mc²/T', () => {
    expect(criticalPowerW('relativistic', 1e-9) * 1e-9 * 1e-9).toBeCloseTo(16.22, 2)
    expect(criticalPowerW('relativistic', 1e-9, 1, 4 * Math.PI) * 1e-18).toBeCloseTo(17.42, 2)
    expect(criticalPowerW('ponderomotive', 1e-9, 1) * 1e-6 * 1e-9).toBeCloseTo(31.74, 1)
    const r = criticalPowerW('relativistic', 0.1) / criticalPowerW('ponderomotive', 0.1, 3)
    expect(r).toBeCloseTo(510.999 / 3, 2)
  })
})

describe('radial (round-beam) solver', () => {
  const beam = (Ppc: number, s0: number, nonlinear = true, N = 256, Rfac = 4.5) => {
    const W = Math.sqrt((2 * Ppc * TOWNES_N) / (Math.PI * s0))
    return { W, b: createRadial({ N, R: Rfac * W, nonlinear, profile: (r) => Math.sqrt(s0) * Math.exp(-((r / W) ** 2)) }) }
  }

  it('the beam power is P/P_c × N_c', () => {
    const { b } = beam(1.5, 0.02, true, 400, 5)
    expect(radialPower(b) / TOWNES_N).toBeCloseTo(1.5, 3)
  })

  it('with the nonlinearity off, a Gaussian follows vacuum diffraction within 1%', () => {
    const { W, b } = beam(1, 0.02, false)
    const w0 = radialRms(b)
    expect(w0 / (W / Math.SQRT2)).toBeCloseTo(1, 4)
    const ZR = (W * W) / 4
    const h = ZR / 300
    for (const target of [ZR, 2 * ZR]) {
      while (b.Z < target - 1e-9) stepRadial(b, h)
      expect(Math.abs(radialRms(b) / (w0 * gaussianWidthFactor(b.Z, W)) - 1)).toBeLessThan(0.01)
    }
  })

  it('the half-maximum width also follows vacuum diffraction within 1% when the plasma response is off', () => {
    const { W, b } = beam(1, 0.02, false)
    const h0 = radialHalfWidth(b)
    expect(h0 / (W * Math.sqrt(Math.LN2 / 2))).toBeCloseTo(1, 3)
    const ZR = (W * W) / 4
    for (const target of [0.5 * ZR, ZR, 2 * ZR]) {
      while (b.Z < target - 1e-9) stepRadial(b, ZR / 300)
      expect(Math.abs(radialHalfWidth(b) / (h0 * gaussianWidthFactor(b.Z, W)) - 1)).toBeLessThan(0.01)
    }
  })

  it('above P_c the bright core shrinks far below its vacuum width; below P_c it does not', () => {
    const run = (Ppc: number) => {
      const { W, b } = beam(Ppc, 0.0093 * Ppc / 2, true, 384, 4.5)
      const ZR = (W * W) / 4
      const h0 = radialHalfWidth(b)
      let minRatio = Infinity
      while (b.Z < 2 * ZR) {
        stepRadial(b, Math.min(ZR / 400, 0.08 / Math.max(1 - Math.exp(-radialAxis(b)), 0.02)))
        minRatio = Math.min(minRatio, radialHalfWidth(b) / (h0 * gaussianWidthFactor(b.Z, W)))
      }
      return minRatio
    }
    expect(run(0.5)).toBeGreaterThan(0.7)
    expect(run(2)).toBeLessThan(0.1)
  })

  it('conserves power to 1e-6 while self-focusing', () => {
    const { W, b } = beam(2, 0.02)
    const P0 = radialPower(b)
    const ZR = (W * W) / 4
    let peak = 0
    while (b.Z < 1.2 * ZR) {
      stepRadial(b, 0.05)
      peak = Math.max(peak, radialAxis(b) / 0.02)
    }
    expect(peak).toBeGreaterThan(10)
    expect(Math.abs(radialPower(b) / P0 - 1)).toBeLessThan(1e-6)
  })

  it('the rms width obeys the virial law V(Z) = V0 + 4HZ² of the cubic equation (within 0.3%), and H = 0 at N = 4π', () => {
    // For iψ_Z + ∇²ψ + |ψ|²ψ = 0 in 2D, d²/dZ² ∫r²|ψ|² = 8H with H = ∫(|∇ψ|² − |ψ|⁴/2) conserved. For the Gaussian
    // ψ = A e^(−r²/W²): N = πA²W²/2, ∫r²|ψ|² = πA²W⁴/4, H = πA² − πA⁴W²/8. Small s keeps the saturable response cubic.
    for (const Ppc of [0.5, 4 * Math.PI / TOWNES_N, 1.5]) {
      const W = 80
      const s0 = (2 * Ppc * TOWNES_N) / (Math.PI * W * W)
      const b = createRadial({ N: 512, R: 4.5 * W, profile: (r) => Math.sqrt(s0) * Math.exp(-((r / W) ** 2)) })
      const N = (Math.PI * s0 * W * W) / 2
      const H = Math.PI * s0 - (Math.PI * s0 * s0 * W * W) / 8
      const V0 = (Math.PI * s0 * W ** 4) / 4
      const ZR = (W * W) / 4
      for (const Zt of [0.25 * ZR, 0.5 * ZR, 0.75 * ZR]) {
        while (b.Z < Zt - 1e-9) stepRadial(b, Math.min(ZR / 400, Zt - b.Z))
        const Vth = (V0 + 4 * H * b.Z * b.Z) / N
        expect(Math.abs(radialRms(b) ** 2 / Vth - 1)).toBeLessThan(0.003)
      }
      if (Math.abs(Ppc - 4 * Math.PI / TOWNES_N) < 1e-9) expect(Math.abs(H) / (Math.PI * s0)).toBeLessThan(1e-12)
    }
  })

  it('the collapse peak of the simulation grid (W = 40, 768 cells) is converged: P/P_c = 1.2 reaches about 80 I0', () => {
    const peak = (NR: number, hfac: number) => {
      const WB = 40
      const s0 = (2 * 1.2 * TOWNES_N) / (Math.PI * WB * WB)
      const b = createRadial({ N: NR, R: 4.5 * WB, profile: (r) => Math.sqrt(s0) * Math.exp(-((r / WB) ** 2)) })
      const ZR = (WB * WB) / 4
      let ax = 0
      while (b.Z < 2 * ZR - 1e-9) {
        stepRadial(b, Math.min(2 * ZR - b.Z, ZR / 400 / hfac, 0.08 / hfac / Math.max(1 - Math.exp(-radialAxis(b)), 0.02)))
        ax = Math.max(ax, radialAxis(b) / s0)
      }
      return ax
    }
    const coarse = peak(768, 1)
    const fine = peak(1536, 2)
    expect(Math.abs(coarse / fine - 1)).toBeLessThan(0.03)
    expect(coarse).toBeGreaterThan(70)
    expect(coarse).toBeLessThan(90)
  })

  it('diffracts below P_c and self-focuses above it', () => {
    const run = (Ppc: number) => {
      const { W, b } = beam(Ppc, 0.02)
      const ZR = (W * W) / 4
      let peak = 0
      while (b.Z < 2 * ZR) {
        stepRadial(b, Math.min(0.05, ZR / 400))
        peak = Math.max(peak, radialAxis(b) / 0.02)
      }
      return peak
    }
    expect(run(0.7)).toBeLessThan(1.3)
    expect(run(1.5)).toBeGreaterThan(10)
  })
})
