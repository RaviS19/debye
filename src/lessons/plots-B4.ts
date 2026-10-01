// B4 plotter presets: the normalized amplitude a0 against Iλ², and the light pressure of a laser against the
// thermal pressure of the plasma at the critical density.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { A0_COEF_CIRCULAR, A0_COEF_LINEAR, criticalPressure, lightPressure } from '../physics/ponderomotive'

const MBAR = 1e11 // Pa

export const PLOTS: PlotSpec[] = [
  {
    id: 'b4-a0',
    title: 'Normalized amplitude a₀ vs Iλ²',
    equation: '\\begin{gathered}a_0 = \\dfrac{eE_0}{m_e\\omega c} = \\dfrac{v_{os}}{c} \\\\ a_0 \\approx 0.855\\,\\lambda_{\\mu m}\\sqrt{I_{18}}\\ \\ \\text{(linear)}\\end{gathered}',
    blurb: 'Iλ² in W cm⁻² µm²; I₁₈ is the intensity in units of 10¹⁸ W/cm² and λ_µm the wavelength in µm. a₀ is the peak quiver speed in units of c. Below a₀ ≈ 0.1 the electrons are non-relativistic and the ponderomotive force of this lesson holds as written. At a₀ = 1 (Iλ² = 1.37×10¹⁸ for linear polarization) the quiver becomes relativistic, the magnetic force is as large as the electric one, and Track C takes over. Circular polarization with the same intensity has each field component √2 smaller, so a₀ is 0.604 λ√(I/10¹⁸) per component, though |v| is then constant through the cycle.',
    x: { label: 'Iλ² (W cm⁻² µm²)', min: 1e12, max: 1e21, log: true },
    y: { label: 'a₀', min: 1e-3, max: 30, log: true },
    params: [],
    curves: [
      { label: 'linear polarization', color: COLORS.cyan, fn: (x) => A0_COEF_LINEAR * Math.sqrt(x / 1e18) },
      { label: 'circular (per component)', color: COLORS.violet, dashed: true, fn: (x) => A0_COEF_CIRCULAR * Math.sqrt(x / 1e18) },
    ],
    markers: [
      { label: 'a₀ = 1: relativistic quiver', color: COLORS.red, y: () => 1 },
      { label: 'a₀ = 0.1', color: COLORS.amber, y: () => 0.1 },
      { label: '1.37×10¹⁸', color: COLORS.red, x: () => 1.368e18 },
    ],
  },
  {
    id: 'b4-pressures',
    title: 'Light pressure vs thermal pressure at n_c',
    equation: '\\begin{gathered}\\dfrac{I}{c}\\ \\ \\text{vs}\\ \\ n_c kT \\\\ n_c \\approx 1.1\\times10^{21}\\,\\lambda_{\\mu m}^{-2}\\ \\text{cm}^{-3}\\end{gathered}',
    blurb: 'Pressures in Mbar (10¹¹ Pa). The rising lines are the light pressure on an absorber (I/c) and on a perfect reflector (2I/c). The flat lines are the thermal pressure of the plasma at the critical density for three wavelengths, at the temperature you choose. Where the light pressure becomes a sizeable fraction of the plasma pressure, the light reshapes the profile: the steepening simulation shows a strong step already at (I/c)/(n_c kT) ≈ 0.1, because the swollen field near n_c is several times the vacuum field. Long wavelengths reach this point at much lower intensity, since n_c ∝ 1/λ².',
    x: { label: 'intensity I (W/cm²)', min: 1e12, max: 1e19, log: true },
    y: { label: 'pressure (Mbar)', min: 1e-4, max: 1e4, log: true },
    params: [{ key: 'T', label: 'Temperature T = T_e + T_i/Z', min: 0.1, max: 20, value: 1, log: true, unit: 'keV' }],
    curves: [
      { label: 'light I/c', color: COLORS.cyan, fn: (I) => lightPressure(I) / MBAR },
      { label: 'reflector 2I/c', color: COLORS.cyan, dashed: true, fn: (I) => (2 * lightPressure(I)) / MBAR },
      { label: 'n_c kT, 0.351 µm', color: COLORS.violet, fn: (_, p) => criticalPressure(0.351, p.T * 1000) / MBAR },
      { label: 'n_c kT, 1.053 µm', color: COLORS.magenta, fn: (_, p) => criticalPressure(1.053, p.T * 1000) / MBAR },
      { label: 'n_c kT, 10.6 µm', color: COLORS.amber, fn: (_, p) => criticalPressure(10.6, p.T * 1000) / MBAR },
    ],
  },
]
