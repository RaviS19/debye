// B3 plotter presets: the Denisov function and resonance absorption vs τ (Ginzburg's approximation against the
// exact full-wave curve), and the optimum angle of incidence vs the density scale length.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { denisovAbs, denisovPhi, exactAbs, TAU_OPT } from '../physics/resonanceAbs'

const toDeg = 180 / Math.PI
/** Angle (deg) at which τ = (k0L)^{1/3} sin θ takes a given value, for L in wavelengths. */
const angleFor = (LoverLam: number, tau: number) => {
  const s = tau / Math.cbrt(2 * Math.PI * LoverLam)
  return s <= 1 ? Math.asin(s) * toDeg : NaN
}

export const PLOTS: PlotSpec[] = [
  {
    id: 'b3-denisov',
    title: 'Resonance absorption vs τ: Denisov function',
    equation: '\\begin{gathered}\\tau = (k_0L)^{1/3}\\sin\\theta \\\\ f_A \\approx \\tfrac12\\phi^2(\\tau) \\\\ \\phi(\\tau) \\approx 2.3\\,\\tau\\, e^{-2\\tau^3/3}\\end{gathered}',
    blurb: 'Ginzburg’s formula (amber) and the exact full-wave absorption of a linear ramp in the limit of weak damping (cyan), which no longer depends on the angle and the scale length separately, only on τ. They agree for small τ, where the factor 2.3 is exact. At larger τ the tunnelling estimate exp(−2τ³/3) is too crude: the formula puts the peak at τ = 0.79 with 86% absorbed, while the exact curve peaks at τ = 0.68 with 49%. Small τ: too little of the field points along the density gradient. Large τ: the light turns too far below n_c and only a weak evanescent tail reaches the resonance.',
    x: { label: 'τ = (k₀L)^⅓ sin θ', min: 0, max: 2.2 },
    y: { label: 'absorbed fraction, or φ', min: 0, max: 1.4 },
    params: [],
    curves: [
      { label: 'φ(τ) ≈ 2.3τ·exp(−2τ³/3)', color: COLORS.violet, dashed: true, fn: (t) => denisovPhi(t) },
      { label: 'approx. f_A = φ²/2', color: COLORS.amber, fn: (t) => denisovAbs(t) },
      { label: 'exact f_A (full wave)', color: COLORS.cyan, fn: (t) => exactAbs(t) },
    ],
    markers: [
      { label: 'exact peak τ = 0.68', color: COLORS.cyan, x: () => TAU_OPT },
      { label: 'formula peak 0.79', color: COLORS.amber, x: () => Math.cbrt(0.5) },
    ],
  },
  {
    id: 'b3-optimum-angle',
    title: 'Best angle of incidence vs scale length',
    equation: '\\begin{gathered}\\sin\\theta_{\\rm opt} = \\dfrac{\\tau_{\\rm opt}}{(k_0L)^{1/3}} \\\\ \\tau_{\\rm opt} = 0.68\\ \\text{(exact)}\\end{gathered}',
    blurb: 'The angle that maximizes resonance absorption in a linear ramp of length L (measured from the plasma edge to n_c). Because only τ matters, the optimum angle shrinks slowly, as L^(−1/3): a ramp a thousand times longer needs an angle only ten times smaller. The dashed violet lines bound the band of angles where the exact absorption is above half its peak (τ from 0.34 to 1.06). Near and below k₀L = 1 (red line), and once the electron quiver excursion v_os/ω exceeds L in an intense field, the cold-fluid resonance gives way to vacuum heating (Track C).',
    x: { label: 'L / λ', min: 0.1, max: 1000, log: true },
    y: { label: 'angle of incidence θ (degrees)', min: 0, max: 70 },
    params: [],
    curves: [
      { label: 'exact optimum (τ = 0.68)', color: COLORS.cyan, fn: (L) => angleFor(L, TAU_OPT) },
      { label: 'Ginzburg formula (τ = 0.79)', color: COLORS.amber, dashed: true, fn: (L) => angleFor(L, Math.cbrt(0.5)) },
      { label: 'half max, low (τ = 0.34)', color: COLORS.violet, dashed: true, fn: (L) => angleFor(L, 0.34) },
      { label: 'half max, high (τ = 1.06)', color: COLORS.violet, dashed: true, fn: (L) => angleFor(L, 1.06) },
    ],
    markers: [{ label: 'k₀L = 1', color: COLORS.red, x: () => 1 / (2 * Math.PI) }],
  },
]
