// Plotter presets for A5 (electrostatic waves).
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { cyclotronFrequency, mp, plasmaFrequency } from '../physics/constants'
import { lowerHybridSI, upperHybridSI } from '../physics/eswaves'

const TWO_PI = 2 * Math.PI

export const PLOTS: PlotSpec[] = [
  {
    id: 'a5-bohm-gross',
    title: 'Bohm–Gross dispersion',
    equation: '\\omega^2 = \\omega_{pe}^2 + \\gamma_e\\, k^2 v_{th}^2',
    blurb: 'Here v_th² = kT_e/m_e. Normalized so the curves hold for any density and temperature. Long waves oscillate at ω_pe; short waves become sound-like with speed √γ_e v_th. The slope of the curve is the group velocity. The factor γ_e = 3 comes from one-dimensional adiabatic compression; set γ_e = 1 to see the isothermal (slower) version.',
    x: { label: 'k λ_De', min: 0, max: 1 },
    y: { label: 'ω / ω_pe', min: 0, max: 2.2 },
    params: [{ key: 'g', label: 'Electron γ_e', min: 1, max: 3, value: 3, step: 0.05 }],
    curves: [
      { label: 'cold: ω = ω_pe', color: COLORS.violet, dashed: true, fn: () => 1 },
      { label: 'Bohm–Gross', color: COLORS.cyan, fn: (K, p) => Math.sqrt(1 + p.g * K * K) },
      { label: 'ω = √γ_e k v_th', color: COLORS.magenta, dashed: true, fn: (K, p) => Math.sqrt(p.g) * K },
    ],
  },
  {
    id: 'a5-ion-acoustic',
    title: 'Ion acoustic dispersion and the Debye rollover',
    equation: '\\omega^2 = k^2\\left[\\dfrac{kT_e}{M(1+k^2\\lambda_D^2)} + \\dfrac{3kT_i}{M}\\right]',
    blurb: 'Frequency in units of the ion plasma frequency, wavenumber in units of 1/λ_De. At long wavelength the wave is sound: ω = k c_s. Once kλ_D approaches 1 the electrons can no longer shield the ion bunches and, for cold ions, the wave saturates at ω_pi. Ion temperature keeps the curve rising.',
    x: { label: 'k λ_De', min: 0, max: 5 },
    y: { label: 'ω / ω_pi', min: 0, max: 2.5 },
    params: [{ key: 'tau', label: 'T_i / T_e', min: 0, max: 1, value: 0, step: 0.01 }],
    curves: [
      { label: 'ω = k c_s (no Debye correction)', color: COLORS.violet, dashed: true, fn: (K, p) => K * Math.sqrt(1 + 3 * p.tau) },
      { label: 'with Debye correction', color: COLORS.magenta, fn: (K, p) => K * Math.sqrt(1 / (1 + K * K) + 3 * p.tau) },
    ],
    markers: [{ label: 'ω_pi', color: COLORS.amber, y: () => 1 }],
  },
  {
    id: 'a5-upper-hybrid',
    title: 'Upper hybrid frequency vs magnetic field',
    equation: 'f_h = \\sqrt{f_{pe}^2 + f_{ce}^2}',
    blurb: 'The upper hybrid frequency follows the larger of the plasma and cyclotron frequencies and exceeds both. Where they are equal, f_h = √2 f_pe.',
    x: { label: 'B (T)', min: 1e-3, max: 20, log: true },
    y: { label: 'frequency (Hz)', min: 1e7, max: 1e13, log: true },
    params: [{ key: 'n', label: 'Density', min: 1e14, max: 1e24, value: 1e19, log: true, unit: 'm⁻³' }],
    curves: [
      { label: 'f_pe', color: COLORS.violet, dashed: true, fn: (_B, p) => plasmaFrequency(p.n) / TWO_PI },
      { label: 'f_ce', color: COLORS.magenta, dashed: true, fn: (B) => cyclotronFrequency(B) / TWO_PI },
      { label: 'upper hybrid f_h', color: COLORS.amber, fn: (B, p) => upperHybridSI(p.n, B) / TWO_PI },
    ],
  },
  {
    id: 'a5-lower-hybrid',
    title: 'Lower hybrid frequency vs magnetic field',
    equation: '\\dfrac{1}{\\omega_{LH}^2} = \\dfrac{1}{\\omega_{ce}\\Omega_{ci}} + \\dfrac{1}{\\omega_{pi}^2 + \\Omega_{ci}^2}',
    blurb: 'Hydrogen plasma. In a dense plasma (ω_pi ≫ √(ω_ce Ω_ci)) the lower hybrid frequency is the geometric mean √(f_ce f_ci) and does not depend on density. In a thin plasma f_LH² ≈ f_pi² + f_ci², so it drops toward f_pi, or toward f_ci once f_pi falls below f_ci.',
    x: { label: 'B (T)', min: 1e-2, max: 20, log: true },
    y: { label: 'frequency (Hz)', min: 1e5, max: 1e12, log: true },
    params: [{ key: 'n', label: 'Density', min: 1e14, max: 1e24, value: 1e19, log: true, unit: 'm⁻³' }],
    curves: [
      { label: 'f_ci', color: COLORS.violet, dashed: true, fn: (B) => cyclotronFrequency(B, mp) / TWO_PI },
      { label: 'f_pi', color: COLORS.magenta, dashed: true, fn: (_B, p) => plasmaFrequency(p.n, mp) / TWO_PI },
      { label: '√(f_ce f_ci)', color: COLORS.cyan, dashed: true, fn: (B) => Math.sqrt(cyclotronFrequency(B) * cyclotronFrequency(B, mp)) / TWO_PI },
      { label: 'lower hybrid f_LH', color: COLORS.lime, fn: (B, p) => lowerHybridSI(p.n, B) / TWO_PI },
    ],
  },
]
