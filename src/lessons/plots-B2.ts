// B2 plotter presets: absorption vs scale length, the collision frequency at n_c, absorption vs wavelength.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { absorptionParams, lnLambda, nuEI, type AbsorptionSetup } from '../physics/collisionalAbs'
import { criticalDensity } from '../physics/lightRamp'

const absorbed = (lamUm: number, Lum: number, TkeV: number, Z: number, thetaDeg = 0, kind: 'linear' | 'exp' = 'linear') => {
  const s: AbsorptionSetup = { lamUm, TeV: TkeV * 1000, Z, Lum, thetaDeg, kind, IWcm2: 1e14, langdon: false }
  return absorptionParams(s).formula
}
const nuAtCritical = (lamUm: number, TkeV: number, Z: number) => {
  const nc = criticalDensity(lamUm)
  return nuEI(nc, TkeV * 1000, Z, lnLambda(nc, TkeV * 1000, Z))
}

export const PLOTS: PlotSpec[] = [
  {
    id: 'b2-absorption-vs-scale-length',
    title: 'Collisional absorption vs scale length',
    equation: '\\begin{gathered}A = 1 - \\exp\\!\\Big(-\\dfrac{32}{15}\\dfrac{\\nu_c L}{c}\\cos^5\\theta\\Big) \\\\ \\dfrac{\\nu_c L}{c} \\propto \\dfrac{Z\\ln\\Lambda\\,L}{\\lambda^2T_e^{3/2}}\\end{gathered}',
    blurb: 'Absorbed fraction of s-polarized light in a linear ramp, from the WKB formula with ν_ei evaluated at the critical density of each wavelength (lnΛ from the NRL formula). Every curve has the same shape, 1 − e^(−L/L_abs); shorter wavelengths reach denser, more collisional plasma, so their absorption length L_abs is shorter: λ² alone gives a factor of nine between 1053 nm and 351 nm, and the smaller Coulomb logarithm of the denser plasma trims it to about 7.7. Raise T_e and the curves slide to the right as T^(3/2); raise Z and they slide left. The dashed curve is a 351 nm exponential ramp with the same L.',
    x: { label: 'scale length L (µm)', min: 3, max: 1000, log: true },
    y: { label: 'absorbed fraction', min: 0, max: 1 },
    params: [
      { key: 'T', label: 'Electron temperature', min: 0.3, max: 5, value: 2, step: 0.1, unit: 'keV' },
      { key: 'Z', label: 'Ion charge Z', min: 1, max: 40, value: 5, step: 0.5 },
      { key: 'th', label: 'Angle of incidence θ', min: 0, max: 60, value: 0, step: 1, unit: '°' },
    ],
    curves: [
      { label: '1053 nm', color: COLORS.red, fn: (L, p) => absorbed(1.053, L, p.T, p.Z, p.th) },
      { label: '527 nm', color: COLORS.lime, fn: (L, p) => absorbed(0.527, L, p.T, p.Z, p.th) },
      { label: '351 nm', color: COLORS.cyan, fn: (L, p) => absorbed(0.351, L, p.T, p.Z, p.th) },
      { label: '351 nm, exponential ramp', color: COLORS.cyan, dashed: true, fn: (L, p) => absorbed(0.351, L, p.T, p.Z, p.th, 'exp') },
    ],
    markers: [{ label: 'L = 100 µm', color: COLORS.amber, x: () => 100 }],
  },
  {
    id: 'b2-collision-frequency',
    title: 'Electron–ion collision frequency at the critical density',
    equation: '\\begin{gathered}\\nu_{ei}(n_c) \\approx 2.91\\times10^{-6} \\\\ \\times\\,\\dfrac{Z\\,n_c[\\text{cm}^{-3}]\\ln\\Lambda}{T_{eV}^{3/2}}\\ \\text{s}^{-1}\\end{gathered}',
    blurb: 'ν_ei evaluated at the critical density of the chosen wavelength, for hydrogen (Z = 1), CH plastic (Z_eff = ⟨Z²⟩/⟨Z⟩ = 5.3), aluminium (13) and gold (about 40 when partly ionized at a few keV). The lines fall as T_e^(−3/2), bent slightly by lnΛ (the small kinks are where the NRL formula for lnΛ switches branch, at T_e = 10Z² eV). The dashed line is one thousandth of the laser frequency: in a hot corona ν_ei/ω ≈ 10⁻³, so an electron collides only about once every 160 laser periods and the light is weakly damped and the formulas with ν ≪ ω apply. Lower the wavelength and n_c, hence ν_ei, rises as 1/λ².',
    x: { label: 'T_e (keV)', min: 0.1, max: 10, log: true },
    y: { label: 'ν_ei at n_c (s⁻¹)', min: 1e10, max: 1e16, log: true },
    params: [{ key: 'lam', label: 'Laser wavelength', min: 0.248, max: 1.053, value: 0.351, step: 0.001, unit: 'µm' }],
    curves: [
      { label: 'Z = 1', color: COLORS.violet, fn: (T, p) => nuAtCritical(p.lam, T, 1) },
      { label: 'CH, Z = 5.3', color: COLORS.cyan, fn: (T, p) => nuAtCritical(p.lam, T, 5.3) },
      { label: 'Al, Z = 13', color: COLORS.lime, fn: (T, p) => nuAtCritical(p.lam, T, 13) },
      { label: 'Au, Z ≈ 40', color: COLORS.amber, fn: (T, p) => nuAtCritical(p.lam, T, 40) },
      { label: 'ω/1000', color: COLORS.magenta, dashed: true, fn: (_T, p) => (2 * Math.PI * 299792458) / (p.lam * 1e-6) / 1000 },
    ],
  },
  {
    id: 'b2-absorption-vs-wavelength',
    title: 'Collisional absorption vs laser wavelength',
    equation: '\\begin{gathered}A(\\lambda) = 1 - \\exp\\!\\Big(-\\dfrac{32}{15}\\dfrac{\\nu_c L}{c}\\Big) \\\\ \\dfrac{\\nu_c L}{c} \\approx 3.4\\times10^{-4}\\,\\dfrac{Z\\ln\\Lambda\\,L_{\\mu m}}{\\lambda_{\\mu m}^2\\,T_{keV}^{3/2}}\\end{gathered}',
    blurb: 'The case for short wavelengths. For a fixed plasma (scale length, temperature, Z), the optical depth grows as 1/λ², so a plasma that absorbs only about half of a 1053 nm beam (Nd:glass, 1ω) absorbs almost all of a 351 nm beam (3ω). This, together with fewer hot electrons from instabilities, is why direct- and indirect-drive fusion moved to frequency-tripled light in the 1980s. Markers: 1ω = 1053 nm, 2ω = 527 nm, 3ω = 351 nm, and the 248 nm KrF laser. Solid: linear ramp at normal incidence; dashed: exponential ramp; amber: linear ramp at 30°, s-polarized. Real coronas are hotter at higher intensity, which pulls all of these down.',
    x: { label: 'λ (µm)', min: 0.2, max: 1.2 },
    y: { label: 'absorbed fraction', min: 0, max: 1 },
    params: [
      { key: 'L', label: 'Scale length L', min: 10, max: 500, value: 100, step: 5, unit: 'µm' },
      { key: 'T', label: 'Electron temperature', min: 0.3, max: 5, value: 2, step: 0.1, unit: 'keV' },
      { key: 'Z', label: 'Ion charge Z', min: 1, max: 40, value: 5, step: 0.5 },
    ],
    curves: [
      { label: 'linear ramp', color: COLORS.cyan, fn: (lam, p) => absorbed(lam, p.L, p.T, p.Z) },
      { label: 'exponential ramp', color: COLORS.magenta, dashed: true, fn: (lam, p) => absorbed(lam, p.L, p.T, p.Z, 0, 'exp') },
      { label: 'linear, 30°', color: COLORS.amber, fn: (lam, p) => absorbed(lam, p.L, p.T, p.Z, 30) },
    ],
    markers: [
      { label: '1ω', color: COLORS.red, x: () => 1.053 },
      { label: '2ω', color: COLORS.lime, x: () => 0.527 },
      { label: '3ω', color: COLORS.violet, x: () => 0.351 },
      { label: 'KrF', color: COLORS.white, x: () => 0.248 },
    ],
  },
]
