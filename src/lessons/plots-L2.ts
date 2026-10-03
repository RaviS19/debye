import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'

export const PLOTS: PlotSpec[] = [
  {
    id: 'l2-airy',
    title: 'Fabry–Pérot transmission',
    equation: 'T(\\delta) = \\dfrac{1}{1 + \\dfrac{4R}{(1-R)^2}\\sin^2(\\delta/2)},\\qquad \\delta = \\dfrac{4\\pi n L \\nu}{c}',
    blurb: 'A cavity only lets through frequencies whose round trip is a whole number of wavelengths. The peaks repeat every free spectral range c/2nL; higher mirror reflectivity makes them sharper (finesse F = π√R/(1−R)).',
    x: { label: 'frequency (free spectral ranges)', min: -1.5, max: 1.5 },
    y: { label: 'transmission', min: 0, max: 1.05 },
    params: [{ key: 'R', label: 'Mirror reflectivity R', min: 0.05, max: 0.99, value: 0.8 }],
    curves: [
      { label: 'your R', color: COLORS.cyan, fn: (f, p) => 1 / (1 + ((4 * p.R) / (1 - p.R) ** 2) * Math.sin(Math.PI * f) ** 2) },
      { label: 'R = 0.3', color: COLORS.violet, dashed: true, fn: (f) => 1 / (1 + ((4 * 0.3) / 0.49) * Math.sin(Math.PI * f) ** 2) },
    ],
    markers: [{ label: 'one FSR', color: COLORS.amber, x: () => 1 }],
  },
  {
    id: 'l2-pulse-width',
    title: 'Shortest pulse vs gain bandwidth',
    equation: '\\tau_p \\approx \\dfrac{0.441}{\\Delta\\nu}',
    blurb: 'A mode-locked laser cannot beat its gain bandwidth. HeNe lasers have about 1.5 GHz of gain, so even locked they give sub-nanosecond pulses. Ti:sapphire has over 100 THz, enough for pulses of a few femtoseconds.',
    x: { label: 'gain bandwidth Δν (Hz)', min: 1e8, max: 1e15, log: true },
    y: { label: 'pulse duration (s)', min: 1e-16, max: 1e-8, log: true },
    params: [{ key: 'k', label: 'Time–bandwidth product', min: 0.3, max: 1, value: 0.441, step: 0.001 }],
    curves: [{ label: 'τ = K / Δν', color: COLORS.cyan, fn: (dn, p) => p.k / dn }],
    markers: [
      { label: 'HeNe ~1.5 GHz', color: COLORS.magenta, x: () => 1.5e9 },
      { label: 'Nd:YAG ~120 GHz', color: COLORS.amber, x: () => 1.2e11 },
      { label: 'Ti:sapphire ~100 THz', color: COLORS.lime, x: () => 1e14 },
    ],
  },
]
