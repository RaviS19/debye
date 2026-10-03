import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { boltzmannRatio } from '../physics/laserRate'

export const PLOTS: PlotSpec[] = [
  {
    id: 'l1-boltzmann',
    title: 'Thermal populations never invert',
    equation: '\\dfrac{N_2}{N_1} = \\exp\\!\\left(-\\dfrac{h c}{\\lambda k_B T}\\right)',
    blurb: 'Upper-to-lower population ratio for equal degeneracies. Heating helps, but the ratio only approaches 1 as T → ∞. For visible light at room temperature it is around 10⁻³³. Inversion needs a pump that is not in thermal equilibrium.',
    x: { label: 'temperature T (K)', min: 10, max: 1e7, log: true },
    y: { label: 'N₂ / N₁', min: 1e-40, max: 2, log: true },
    params: [{ key: 'lam', label: 'Transition wavelength', min: 0.2, max: 20, value: 0.633, log: true, unit: 'µm' }],
    curves: [
      { label: 'your λ', color: COLORS.cyan, fn: (T, p) => boltzmannRatio(p.lam * 1e-6, T) },
      { label: 'CO₂ laser, 10.6 µm', color: COLORS.magenta, fn: (T) => boltzmannRatio(10.6e-6, T) },
    ],
    markers: [
      { label: 'room temperature', color: COLORS.lime, x: () => 300 },
      { label: 'N₂ = N₁ (never reached)', color: COLORS.red, y: () => 1 },
    ],
  },
  {
    id: 'l1-power-curve',
    title: 'Laser output vs pump',
    equation: 'P_{out} \\propto \\dfrac{T}{T + L_i}\\,(P_{pump} - P_{th}),\\qquad P_{th} \\propto T + L_i',
    blurb: 'Each line is one output coupler T with internal loss L_i. More transmission lets more light out, but raises the threshold. The best coupler balances the two; with these numbers and 20 W of pump it sits near T = 10%.',
    x: { label: 'pump power (W)', min: 0, max: 20 },
    y: { label: 'output power (W)', min: 0, max: 10 },
    params: [{ key: 'Li', label: 'Internal round-trip loss', min: 0.005, max: 0.1, value: 0.02, unit: '' }],
    curves: [1, 10, 30].map((Tp, i) => ({
      label: `T = ${Tp}%`,
      color: [COLORS.violet, COLORS.cyan, COLORS.amber][i],
      fn: (P: number, p: Record<string, number>) => {
        const T = Tp / 100
        const g0 = 0.04 // small-signal round-trip gain per watt of pump
        const Pth = (T + p.Li) / g0
        return P > Pth ? 0.6 * (T / (T + p.Li)) * (P - Pth) : 0
      },
    })),
  },
]
