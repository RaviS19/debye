import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { gddBroadened, transformLimit } from '../physics/pulse'

export const PLOTS: PlotSpec[] = [
  {
    id: 'l3-gdd-broadening',
    title: 'How GDD stretches a pulse',
    equation: '\\tau = \\tau_0\\sqrt{1 + \\left(\\dfrac{4\\ln 2\\,\\mathrm{GDD}}{\\tau_0^2}\\right)^2}',
    blurb: 'The shorter the pulse, the more fragile it is: the broadening depends on GDD/τ₀². A 10 fs pulse is wrecked by the GDD of a few millimetres of glass that a 100 fs pulse barely notices.',
    x: { label: 'GDD (fs²)', min: 1, max: 1e5, log: true },
    y: { label: 'output FWHM (fs)', min: 1, max: 1e5, log: true },
    params: [{ key: 't0', label: 'Input pulse (transform limited)', min: 5, max: 500, value: 20, log: true, unit: 'fs' }],
    curves: [
      { label: 'your τ₀', color: COLORS.cyan, fn: (g, p) => gddBroadened(p.t0, g) },
      { label: '10 fs', color: COLORS.magenta, dashed: true, fn: (g) => gddBroadened(10, g) },
      { label: '100 fs', color: COLORS.violet, dashed: true, fn: (g) => gddBroadened(100, g) },
    ],
    markers: [{ label: '10 mm fused silica at 800 nm', color: COLORS.amber, x: () => 362 }],
  },
  {
    id: 'l3-tbp',
    title: 'Transform limit vs bandwidth',
    equation: '\\tau_{TL} = \\dfrac{0.441\\,\\lambda_0^2}{c\\,\\Delta\\lambda}',
    blurb: 'The shortest Gaussian pulse a spectrum can support. At a fixed bandwidth in nanometres, longer centre wavelengths give longer pulses because Δν = cΔλ/λ².',
    x: { label: 'bandwidth Δλ (nm)', min: 1, max: 300, log: true },
    y: { label: 'shortest pulse (fs)', min: 1, max: 2000, log: true },
    params: [{ key: 'lam', label: 'Centre wavelength', min: 400, max: 2000, value: 800, unit: 'nm' }],
    curves: [
      { label: 'your λ₀', color: COLORS.cyan, fn: (d, p) => transformLimit(p.lam, d) },
      { label: '1030 nm (Yb)', color: COLORS.violet, dashed: true, fn: (d) => transformLimit(1030, d) },
      { label: '1560 nm (Er)', color: COLORS.magenta, dashed: true, fn: (d) => transformLimit(1560, d) },
    ],
  },
]
