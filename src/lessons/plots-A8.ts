// Plotter presets for A8 (equilibrium and stability).
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { spitzerPar } from '../physics/classicalTransport'
import { rtDiffuse, rtSharp, rtViscous } from '../physics/rayleighTaylor'
import { K_CUTOFF, K_MAX_GROWTH, twoStreamGamma, twoStreamStableOmega } from '../physics/twoStream'

const MU0 = 1.25663706212e-6

/** k that maximizes the viscous, diffuse-interface growth rate (golden-section search in ln k). */
function fastestK(A: number, nu: number, delta: number): number {
  const f = (lk: number) => rtViscous(rtDiffuse(A, 1, Math.exp(lk), delta), nu, Math.exp(lk))
  let a = Math.log(0.1)
  let b = Math.log(1e5)
  const r = (Math.sqrt(5) - 1) / 2
  for (let i = 0; i < 80; i++) {
    const c = b - r * (b - a)
    const d = a + r * (b - a)
    if (f(c) > f(d)) b = d
    else a = c
  }
  return Math.exp((a + b) / 2)
}

export const PLOTS: PlotSpec[] = [
  {
    id: 'a8-rt-growth',
    title: 'Rayleigh–Taylor growth rate vs wavenumber',
    equation: '\\sigma = \\sqrt{\\dfrac{Agk}{1+k\\delta} + \\nu^2k^4} - \\nu k^2',
    blurb: 'Units of the simulation: box width L = 1, g = 1, rates in √(g/L). A sharp, inviscid interface gives σ = √(Agk): the shorter the ripple, the faster it grows, without limit. A finite interface width δ caps the growth once the ripple is shorter than the transition layer (for a tanh profile of half-width δ in a Boussinesq fluid, like the simulation’s, the capped form is exact). Viscosity kills short ripples outright, so there is a fastest-growing wavelength (amber line). The green line is the simulation’s default mode, m = 2. The viscous curve is a common approximate form, the root of σ² + 2νk²σ = σ₀², not an exact result: it captures the cut-off of short ripples, and at the simulation’s default settings it is about 1.5% above the exact linear rate, but where viscosity and buoyancy compete (short ripples, large ν) it can be off by tens of percent.',
    x: { label: 'wavenumber k (1/L)', min: 1, max: 1e3, log: true },
    y: { label: 'growth rate σ (√(g/L))', min: 0.1, max: 100, log: true },
    params: [
      { key: 'A', label: 'Atwood number A', min: 0.01, max: 1, value: 0.25, step: 0.01 },
      { key: 'nu', label: 'Viscosity ν', min: 1e-6, max: 1e-2, value: 3e-4, log: true, unit: 'L√(gL)' },
      { key: 'd', label: 'Interface half-width δ', min: 1e-4, max: 0.1, value: 0.02, log: true, unit: 'L' },
    ],
    curves: [
      { label: 'sharp, inviscid √(Agk)', color: COLORS.violet, dashed: true, fn: (k, p) => rtSharp(p.A, 1, k) },
      { label: 'with interface width δ', color: COLORS.magenta, fn: (k, p) => rtDiffuse(p.A, 1, k, p.d) },
      { label: 'with δ and viscosity ν', color: COLORS.cyan, fn: (k, p) => rtViscous(rtDiffuse(p.A, 1, k, p.d), p.nu, k) },
    ],
    markers: [
      { label: 'm=2', color: COLORS.lime, x: () => 4 * Math.PI },
      { label: 'fastest', color: COLORS.amber, x: (p) => fastestK(p.A, p.nu, p.d) },
    ],
  },
  {
    id: 'a8-two-stream',
    title: 'Two-stream growth rate vs beam speed',
    equation: '\\begin{gathered}\\dfrac{\\gamma}{\\omega_b} = \\sqrt{\\sqrt{1+4K^2} - K^2 - 1} \\\\ K = \\dfrac{k v_0}{\\omega_b}\\end{gathered}',
    blurb: 'Two equal cold beams at ±v0, each with plasma frequency ω_b. The instability is purely growing (no real frequency) for K below √2 and peaks at γ = ω_b/2 when K = √3/2. For a fixed beam speed, K measures the wavenumber: too short a wave (large K) and the beams pass each other’s bunches too quickly to respond; the dashed line is then the real frequency of the stable, slow wave. The simulation fixes k and varies v0; the curve is the same.',
    x: { label: 'K = k v0 / ω_b', min: 0, max: 2.2 },
    y: { label: 'γ / ω_b  (or ω / ω_b)', min: 0, max: 1 },
    params: [],
    curves: [
      { label: 'growth rate γ/ω_b', color: COLORS.cyan, fn: (K) => (K < K_CUTOFF ? twoStreamGamma(K) : NaN) },
      { label: 'stable wave ω/ω_b', color: COLORS.violet, dashed: true, fn: (K) => twoStreamStableOmega(K) },
    ],
    markers: [
      { label: 'fastest', color: COLORS.amber, x: () => K_MAX_GROWTH },
      { label: 'cut-off', color: COLORS.red, x: () => K_CUTOFF },
    ],
  },
  {
    id: 'a8-pressure-balance',
    title: 'Pressure balance across a plasma column',
    equation: 'p(r) + \\dfrac{B^2(r)}{2\\mu_0} = \\dfrac{B_0^2}{2\\mu_0}',
    blurb: 'A cylinder of plasma with a Gaussian pressure profile, held by an axial field B₀ (all pressures in units of B₀²/2μ₀). The plasma is diamagnetic: its current digs a hole in the field exactly deep enough that the total pressure is flat. β on axis is the ratio of the plasma pressure there to the field pressure outside. At β = 1 the field on axis vanishes; the plasma cannot hold more.',
    x: { label: 'radius r / a', min: 0, max: 2.5 },
    y: { label: 'pressure / (B₀²/2μ₀)', min: 0, max: 1.2 },
    params: [{ key: 'beta', label: 'β on axis', min: 0, max: 1, value: 0.3, step: 0.01 }],
    curves: [
      { label: 'plasma p', color: COLORS.magenta, fn: (r, p) => p.beta * Math.exp(-r * r) },
      { label: 'magnetic B²/2μ₀', color: COLORS.cyan, fn: (r, p) => 1 - p.beta * Math.exp(-r * r) },
      { label: 'total', color: COLORS.lime, dashed: true, fn: () => 1 },
      { label: 'B / B₀', color: COLORS.amber, dashed: true, fn: (r, p) => Math.sqrt(Math.max(0, 1 - p.beta * Math.exp(-r * r))) },
    ],
  },
  {
    id: 'a8-magnetic-diffusion',
    title: 'Magnetic diffusion time vs temperature',
    equation: '\\begin{gathered}\\tau_B = \\dfrac{\\mu_0 L^2}{\\eta} \\\\ \\eta \\approx 5.2\\times10^{-5}\\,\\dfrac{\\ln\\Lambda}{T_{eV}^{3/2}}\\ \\Omega\\,\\text{m}\\end{gathered}',
    blurb: 'How long a field takes to soak into (or leak out of) a hydrogen plasma of size L, using the Spitzer resistivity of A7 with lnΛ = 15. The exact decay time of a given shape has an extra geometric factor (for the slowest mode of a sphere of radius L it is 1/π²), so treat τ_B as the scale. Because η falls as the −3/2 power of temperature, hot plasmas hold their field for a very long time: at 1 keV and L = 1 m, about a minute. The amber line is a copper block of the same size (η = 1.7×10⁻⁸ Ω m); above about 1.3 keV the plasma conducts better than copper. Over shorter times the field lines are frozen into the plasma.',
    x: { label: 'electron temperature T_e (eV)', min: 1, max: 1e5, log: true },
    y: { label: 'τ_B (s)', min: 1e-6, max: 1e8, log: true },
    params: [{ key: 'L', label: 'Size L', min: 1e-3, max: 1e3, value: 1, log: true, unit: 'm' }],
    curves: [{ label: 'τ_B', color: COLORS.cyan, fn: (T, p) => (MU0 * p.L * p.L) / spitzerPar(T, 15) }],
    markers: [
      { label: 'copper, same L', color: COLORS.amber, y: (p) => (MU0 * p.L * p.L) / 1.7e-8 },
      { label: 'beats Cu', color: COLORS.lime, x: () => ((5.2e-5 * 15) / 1.7e-8) ** (2 / 3) },
    ],
  },
]
