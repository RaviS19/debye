// Plotter presets for A9 (kinetic theory).
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { ionAcousticDamping, ionAcousticDampingApprox, landauApprox, landauExact } from '../physics/plasmaZ'

export const PLOTS: PlotSpec[] = [
  {
    id: 'a9-landau-damping',
    title: 'Landau damping rate vs kλ_D',
    equation: '\\begin{gathered}\\dfrac{\\gamma}{\\omega_{pe}} \\approx -\\sqrt{\\dfrac{\\pi}{8}}\\,\\dfrac{1}{(k\\lambda_D)^3} \\\\ \\times\\exp\\!\\left(-\\dfrac{1}{2k^2\\lambda_D^2} - \\dfrac{3}{2}\\right)\\end{gathered}',
    blurb: 'The glowing curve is the exact damping rate: the root of the Maxwellian dispersion relation 1 + [1 + ζZ(ζ)]/(kλ_D)² = 0 with ζ = ω/(√2 k v_th), found numerically with the plasma dispersion function Z. The dashed curve is the small-kλ_D formula. Damping switches on extremely steeply: from 10⁻⁸ ω_pe at kλ_D = 0.15 to a tenth of ω_pe at 0.45. The formula gets the switch-on right to within a factor of 1.6 but badly underestimates the damping past kλ_D ≈ 0.6 (by a factor of 4 at 0.8), where the wave is no longer a weakly damped oscillation. (Its agreement at exactly 0.5 is a coincidence.) The amber line is the simulation’s benchmark, kλ_D = 0.5, where γ = −0.153 ω_pe.',
    x: { label: 'k λ_D', min: 0.14, max: 1.2 },
    y: { label: '|γ| / ω_pe', min: 1e-8, max: 3, log: true },
    params: [],
    curves: [
      { label: 'exact (kinetic root)', color: COLORS.cyan, fn: (k) => -landauExact(k)[1] },
      { label: 'small-kλ_D formula', color: COLORS.magenta, dashed: true, fn: (k) => landauApprox(k) },
    ],
    markers: [
      { label: 'kλ_D = 0.5', color: COLORS.amber, x: () => 0.5 },
    ],
  },
  {
    id: 'a9-langmuir-frequency',
    title: 'Langmuir wave frequency: kinetic vs Bohm–Gross',
    equation: '\\begin{gathered}1 + \\dfrac{1 + \\zeta Z(\\zeta)}{k^2\\lambda_D^2} = 0 \\\\ \\text{vs}\\quad \\omega^2 = \\omega_{pe}^2(1 + 3k^2\\lambda_D^2)\\end{gathered}',
    blurb: 'The real part of the kinetic root against the fluid Bohm–Gross relation of A5. They agree for long waves; by kλ_D = 0.3 the kinetic frequency is 3% higher (1.160 against 1.127), the same upward drift the A5 particle-in-cell measurements showed. The fluid theory keeps only the first thermal correction; the kinetic one keeps them all.',
    x: { label: 'k λ_D', min: 0, max: 1.2 },
    y: { label: 'ω / ω_pe', min: 0.9, max: 2.6 },
    params: [],
    curves: [
      { label: 'kinetic (real part)', color: COLORS.cyan, fn: (k) => (k >= 0.14 ? landauExact(k)[0] : NaN) },
      { label: 'Bohm–Gross', color: COLORS.magenta, dashed: true, fn: (k) => Math.sqrt(1 + 3 * k * k) },
    ],
  },
  {
    id: 'a9-ion-landau',
    title: 'Ion acoustic damping vs T_e / T_i',
    equation: '\\begin{gathered}-\\dfrac{\\gamma}{\\omega_r} \\approx \\sqrt{\\dfrac{\\pi}{8}}\\,\\Bigg[\\sqrt{\\dfrac{m_e}{M}} \\\\ +\\; \\left(\\dfrac{T_e}{T_i}\\right)^{3/2} e^{-T_e/2T_i - 3/2}\\Bigg]\\end{gathered}',
    blurb: 'Hydrogen, kλ_De = 0.1. The glowing curve is the exact root of the dispersion relation with kinetic electrons and ions; the dashed curve is the formula. With T_e ≈ T_i the wave speed sits inside the ion distribution and the wave is gone within a period. Only when T_e/T_i exceeds about 10 does ion damping die away, leaving a floor of weak electron Landau damping set by √(m_e/M). The formula is only a rough guide: it overestimates the damping by 40–80% for T_e/T_i between about 4 and 12, and below T_e/T_i ≈ 3 it even turns over, while the true damping keeps rising.',
    x: { label: 'T_e / T_i', min: 0.3, max: 100, log: true },
    y: { label: '−γ / ω_r', min: 0, max: 0.8 },
    params: [],
    curves: [
      { label: 'exact (kinetic root)', color: COLORS.cyan, fn: (t) => ionAcousticDamping(t) },
      { label: 'small-kλ_D formula', color: COLORS.magenta, dashed: true, fn: (t) => ionAcousticDampingApprox(t) },
    ],
    markers: [{ label: 'T_e = T_i', color: COLORS.amber, x: () => 1 }],
  },
]
