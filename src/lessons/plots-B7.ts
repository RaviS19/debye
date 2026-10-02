// B7 plotter presets: the filamentation growth rate against transverse wavenumber, the two-plasmon-decay threshold
// parameter against density scale length, and the critical power for self-focusing against density.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { criticalPowerW, fastestFilament, filamentationRateUm } from '../physics/filamentation'
import { tpdEta } from '../physics/tpd'

const LAM3 = 0.351 // µm

export const PLOTS: PlotSpec[] = [
  {
    id: 'b7-filamentation-growth',
    title: 'Filamentation growth rate vs ripple wavenumber',
    equation:
      '\\begin{gathered}\\kappa = \\dfrac{K}{2k_0}\\sqrt{K_c^2 - K^2} \\\\ K_c^2 = \\dfrac{\\omega_{pe}^2}{c^2}\\,\\dfrac{v_{os}^2}{2v_e^2} \\\\ \\kappa_{\\max} = \\tfrac18\\left(\\dfrac{v_{os}}{v_e}\\right)^{2}\\dfrac{\\omega_{pe}^2}{k_0c^2} \\\\ \\text{at}\\ \\ K = K_c/\\sqrt2\\end{gathered}',
    blurb:
      'The spatial growth rate κ of an intensity ripple of transverse wavenumber K (wavelength 2π/K) on a wide uniform beam, in a plasma in steady pressure balance with the light (isothermal electrons, cold ions: v_e = √(T_e/m)). Long ripples barely refract; short ones are wiped out by diffraction faster than the plasma can focus them; the fastest grow at K_c/√2. More intensity or density, or a colder plasma, raises K_c² ∝ (n/n_c)(U_p/T): the fastest ripple gets shorter (K ∝ K_c) and grows faster (κ_max ∝ K_c²), so doubling the intensity (dashed) doubles the peak rate at √2 times the wavenumber. Default: 0.351 µm light at 10¹⁵ W/cm² in 2 keV plasma at 0.1 n_c, where the fastest ripple has a wavelength of about 15 µm and grows by e in about 185 µm. (v_os here is from the vacuum relation I = ½ε₀cE₀²; inside the plasma E₀² is larger by 1/√(1 − n/n_c), a 5% correction at 0.1 n_c.)',
    x: { label: 'ripple wavenumber K (µm⁻¹)', min: 0, max: 1.4 },
    y: { label: 'growth rate κ (mm⁻¹)', min: 0, max: 14 },
    params: [
      { key: 'I', label: 'Intensity', min: 1e14, max: 1e16, value: 1e15, log: true, unit: 'W/cm²' },
      { key: 'n', label: 'Density n/n_c', min: 0.02, max: 0.5, value: 0.1, step: 0.01 },
      { key: 'T', label: 'Electron temperature', min: 0.5, max: 5, value: 2, step: 0.1, unit: 'keV' },
      { key: 'lam', label: 'Wavelength', min: 0.25, max: 1.1, value: LAM3, step: 0.001, unit: 'µm' },
    ],
    curves: [
      { label: 'your beam', color: COLORS.cyan, fn: (K, p) => 1e3 * filamentationRateUm(K, p.I, p.lam, p.n, p.T) },
      { label: 'twice the intensity', color: COLORS.magenta, dashed: true, fn: (K, p) => 1e3 * filamentationRateUm(K, 2 * p.I, p.lam, p.n, p.T) },
    ],
    markers: [
      { label: 'fastest K', color: COLORS.amber, x: (p) => fastestFilament(p.I, p.lam, p.n, p.T).K },
      { label: 'cut-off √2 K_max', color: COLORS.red, x: (p) => Math.SQRT2 * fastestFilament(p.I, p.lam, p.n, p.T).K },
    ],
  },
  {
    id: 'b7-tpd-threshold',
    title: 'Two-plasmon decay threshold parameter vs scale length',
    equation: '\\eta = \\dfrac{I_{14}\\,L_{\\mu m}\\,\\lambda_{\\mu m}}{82\\,T_{\\text{keV}}}',
    blurb:
      'η ≈ 1 marks the threshold for absolute two-plasmon decay in a linear density profile (Simon et al. 1983, in the practical form quoted in recent TPD papers; at 0.351 µm it reads I₁₄L_µm/T_keV ≈ 233). I₁₄ is the intensity at quarter-critical in units of 10¹⁴ W/cm², L the density scale length there. It is the dimensionless combination Λ = γ₀²L/(k₀v_te²) = 0.0127 I₁₄Lλ/T in disguise: the homogeneous growth rate squared against the rate at which the gradient detunes the two plasmons. Longer scale lengths and colder coronas are more unstable, so η grows with the size of the target as well as with the intensity.',
    x: { label: 'density scale length L at n_c/4 (µm)', min: 10, max: 1000, log: true },
    y: { label: 'η', min: 0.01, max: 100, log: true },
    params: [
      { key: 'I', label: 'Intensity at n_c/4', min: 1e13, max: 1e16, value: 5e14, log: true, unit: 'W/cm²' },
      { key: 'lam', label: 'Wavelength', min: 0.25, max: 1.1, value: LAM3, step: 0.001, unit: 'µm' },
    ],
    curves: [
      { label: 'T_e = 1 keV', color: COLORS.magenta, fn: (L, p) => tpdEta(p.I, L, p.lam, 1) },
      { label: 'T_e = 2 keV', color: COLORS.cyan, fn: (L, p) => tpdEta(p.I, L, p.lam, 2) },
      { label: 'T_e = 4 keV', color: COLORS.violet, fn: (L, p) => tpdEta(p.I, L, p.lam, 4) },
    ],
    markers: [{ label: 'η = 1: threshold', color: COLORS.red, y: () => 1 }],
  },
  {
    id: 'b7-critical-power',
    title: 'Critical power for self-focusing vs density',
    equation:
      '\\begin{gathered}P_c^{\\text{pond}} \\approx 32\\,T^*_{\\text{keV}}\\,\\dfrac{n_c}{n}\\ \\text{MW} \\\\ P_c^{\\text{rel}} \\approx 16\\text{–}17\\,\\dfrac{n_c}{n}\\ \\text{GW}\\end{gathered}',
    blurb:
      'Both from the paraxial equation in two transverse dimensions, which collapses above the Townes power (the factor √(1 − n/n_c), the refractive index, is included). The ponderomotive P_c, for a plasma in pressure balance at T* = T_e + T_i/Z, is mc²/T* times smaller than the relativistic one, which matters only for intense short pulses (Track C). The dashed amber line is the power in one speckle of a phase-plate-smoothed 0.351 µm beam at your intensity, I(λF)² with F = 8: an average speckle is below P_c in an ICF corona (about 11 times below at 0.1 n_c and 3 keV, 4 times at n_c/4), and only the rare speckles several times brighter than average self-focus.',
    x: { label: 'density n/n_c', min: 0.01, max: 1, log: true },
    y: { label: 'power (W)', min: 1e6, max: 1e14, log: true },
    params: [
      { key: 'T', label: 'Temperature T* = T_e + T_i/Z', min: 0.3, max: 10, value: 3, log: true, unit: 'keV' },
      { key: 'I', label: 'Laser intensity (speckle line)', min: 1e13, max: 1e17, value: 1e15, log: true, unit: 'W/cm²' },
    ],
    curves: [
      { label: 'ponderomotive P_c at your T*', color: COLORS.cyan, fn: (n, p) => (n < 1 ? criticalPowerW('ponderomotive', n, p.T) : NaN) },
      { label: 'ponderomotive P_c at 1 keV', color: COLORS.violet, dashed: true, fn: (n) => (n < 1 ? criticalPowerW('ponderomotive', n, 1) : NaN) },
      { label: 'relativistic P_c', color: COLORS.magenta, fn: (n) => (n < 1 ? criticalPowerW('relativistic', n) : NaN) },
      { label: 'one F/8 speckle at 0.351 µm', color: COLORS.amber, dashed: true, fn: (_, p) => p.I * (LAM3 * 1e-4 * 8) ** 2 },
    ],
  },
]
