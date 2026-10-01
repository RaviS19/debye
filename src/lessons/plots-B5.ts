// B5 plotter presets: the SRS backscatter wavelength vs density, and the growth rate vs frequency mismatch.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { decayGrowth, normalize, srsBackscatter } from '../physics/parametric'

/** Backscattered SRS wavelength (nm) for laser wavelength lamNm at density nn and T_e (keV), Bohm–Gross plasma wave. */
const srsLambda = (lamNm: number, nn: number, TeKeV: number) => {
  const b = srsBackscatter(normalize({ nn, TeKeV, TiKeV: 1, Z: 1, A: 1 }))
  return b ? lamNm / b.ws : NaN
}
const coldLambda = (lamNm: number, nn: number) => (nn < 0.25 ? lamNm / (1 - Math.sqrt(nn)) : NaN)

export const PLOTS: PlotSpec[] = [
  {
    id: 'b5-srs-wavelength',
    title: 'SRS backscattered wavelength vs density',
    equation: '\\begin{gathered}\\lambda_s = \\dfrac{\\lambda_0}{1 - \\omega_{ek}/\\omega_0} \\\\ \\omega_{ek}^2 = \\omega_{pe}^2 + 3k^2v_{te}^2 \\\\ k = k_0 + k_s\\end{gathered}',
    blurb: 'Where in the plasma the Raman light came from, read off a spectrometer. The backscattered light gives up one plasma-wave quantum, ħω_ek ≥ ħω_pe, so it is red-shifted more the denser the plasma it scattered in. Solid: exact matching with the Bohm–Gross plasma wave at your T_e; dashed: the cold-plasma estimate λ₀/(1 − √(n/n_c)). Thermal corrections push the light further to the red and end the curves slightly below n_c/4, where the scattered light would have to be born at its own cutoff. Light scattered right at n_c/4 comes out at ω₀/2, twice the laser wavelength (the dotted lines).',
    x: { label: 'n / n_c', min: 0.005, max: 0.26 },
    y: { label: 'scattered wavelength λ_s (nm)', min: 300, max: 2300 },
    params: [{ key: 'T', label: 'Electron temperature', min: 0.1, max: 6, value: 2, step: 0.1, unit: 'keV' }],
    curves: [
      { label: '351 nm laser', color: COLORS.cyan, fn: (n, p) => srsLambda(351, n, p.T) },
      { label: '351 nm, cold', color: COLORS.cyan, dashed: true, fn: (n) => coldLambda(351, n) },
      { label: '527 nm laser', color: COLORS.lime, fn: (n, p) => srsLambda(527, n, p.T) },
      { label: '1053 nm laser', color: COLORS.magenta, fn: (n, p) => srsLambda(1053, n, p.T) },
      { label: '1053 nm, cold', color: COLORS.magenta, dashed: true, fn: (n) => coldLambda(1053, n) },
    ],
    markers: [
      { label: 'n_c/4', color: COLORS.amber, x: () => 0.25 },
      { label: '2 × 351 nm', color: COLORS.cyan, y: () => 702 },
      { label: '2 × 1053 nm', color: COLORS.magenta, y: () => 2106 },
    ],
  },
  {
    id: 'b5-growth-mismatch',
    title: 'Growth rate vs frequency mismatch, with damping',
    equation: '\\begin{gathered}\\gamma = \\sqrt{\\gamma_0^2 - \\Delta^2/4} - \\Gamma \\\\ \\text{threshold: } \\gamma_0^2 = \\Gamma_1\\Gamma_2\\end{gathered}',
    blurb: 'Growth rate γ = Im δ of two pumped oscillators (the root of (δ + iΓ₁)(δ − Δ + iΓ₂) = −γ₀²), in units of the undamped, perfectly matched rate γ₀, against the frequency mismatch Δ = ω₀ − ω₁ − ω₂. Undamped (dashed), growth survives for |Δ| < 2γ₀: the stronger the pump, the more mismatch it tolerates. With damping (solid) the whole curve drops. With equal damping it simply moves down by Γ; with unequal damping the threshold at Δ = 0 is γ₀² = Γ₁Γ₂, so one strongly damped wave can be compensated by a weakly damped partner. Below the zero line the daughters decay: the pump is below threshold.',
    x: { label: 'mismatch Δ / γ₀', min: -3, max: 3 },
    y: { label: 'growth rate γ / γ₀', min: -1.2, max: 1.2 },
    params: [
      { key: 'G1', label: 'Damping of daughter 1, Γ₁/γ₀', min: 0, max: 2, value: 0.3, step: 0.01 },
      { key: 'G2', label: 'Damping of daughter 2, Γ₂/γ₀', min: 0, max: 4, value: 1.2, step: 0.01 },
    ],
    curves: [
      { label: 'undamped', color: COLORS.violet, dashed: true, fn: (D) => decayGrowth(1, D, 0, 0) },
      { label: 'with damping Γ₁, Γ₂', color: COLORS.cyan, fn: (D, p) => decayGrowth(1, D, p.G1, p.G2) },
    ],
    markers: [
      { label: 'threshold (γ = 0)', color: COLORS.red, y: () => 0 },
      { label: '|Δ| = 2γ₀', color: COLORS.amber, x: () => 2 },
    ],
  },
]
