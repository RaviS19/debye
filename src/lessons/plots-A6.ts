// A6 plotter presets: light in plasma, critical density, magnetized dispersion, Alfvén speed.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { c, e, eps0, me, mp } from '../physics/constants'
import { branchOmega, cutoffs } from '../physics/emwave'

const mu0 = 1 / (eps0 * c * c)
/** Critical density in m⁻³ for vacuum wavelength λ in µm. */
const nCrit = (lamUm: number) => (eps0 * me * (2 * Math.PI * c / (lamUm * 1e-6)) ** 2) / (e * e)

export const PLOTS: PlotSpec[] = [
  {
    id: 'a6-light-dispersion',
    title: 'Light in an unmagnetized plasma',
    equation: '\\omega^2 = \\omega_p^2 + c^2k^2',
    blurb: 'No wave exists below ω_p: that gap is the cutoff. Near the cutoff the curve is flat, so the group velocity dω/dk (the speed of energy) goes to zero while the phase velocity ω/k shoots above c. Far above ω_p the plasma hardly matters and the curve hugs the vacuum light line. Tap the plot to read off k at your frequency.',
    x: { label: 'ck / ω_p', min: 0, max: 4 },
    y: { label: 'ω / ω_p', min: 0, max: 4 },
    params: [{ key: 'w', label: 'Your frequency ω/ω_p', min: 1, max: 4, value: 1.5, step: 0.01 }],
    curves: [
      { label: 'plasma: ω = √(ω_p² + c²k²)', color: COLORS.cyan, fn: (k) => Math.sqrt(1 + k * k) },
      { label: 'vacuum: ω = ck', color: COLORS.violet, dashed: true, fn: (k) => k },
    ],
    markers: [
      { label: 'cutoff ω = ω_p', color: COLORS.red, y: () => 1 },
      { label: 'your ω', color: COLORS.amber, y: (p) => p.w },
      { label: 'your k', color: COLORS.amber, x: (p) => Math.sqrt(Math.max(0, p.w * p.w - 1)) },
    ],
  },
  {
    id: 'a6-critical-density',
    title: 'Critical density vs laser wavelength',
    equation: 'n_c = \\dfrac{\\varepsilon_0 m_e \\omega^2}{e^2} \\approx \\dfrac{1.1\\times10^{27}}{\\lambda_{\\mu m}^2}\\ \\text{m}^{-3}',
    blurb: 'Light can only travel where the electron density is below n_c. Shorter wavelengths push n_c up as 1/λ², which is why frequency-tripled 351 nm light reaches about nine times denser plasma than the 1053 nm fundamental of a glass laser. The dashed line is n_c/4, where the laser can decay into plasma waves (Track B). Drag or zoom out to see microwaves, whose n_c is many decades lower.',
    x: { label: 'vacuum wavelength λ (µm)', min: 0.1, max: 20, log: true },
    y: { label: 'electron density (m⁻³)', min: 1e24, max: 1e30, log: true },
    params: [],
    curves: [
      { label: 'critical density n_c', color: COLORS.cyan, fn: (lam) => nCrit(lam) },
      { label: 'quarter-critical n_c/4', color: COLORS.magenta, dashed: true, fn: (lam) => nCrit(lam) / 4 },
    ],
    markers: [
      { label: '351 nm', color: COLORS.violet, x: () => 0.351 },
      { label: '1053 nm', color: COLORS.amber, x: () => 1.053 },
      { label: 'CO₂ 10.6 µm', color: COLORS.lime, x: () => 10.6 },
    ],
  },
  {
    id: 'a6-magnetized-dispersion',
    title: 'R, L, O and X waves in a magnetized plasma',
    equation: '\\begin{gathered}n_{R,L}^2 = 1 - \\dfrac{\\omega_p^2/\\omega^2}{1 \\mp \\omega_c/\\omega} \\\\ n_O^2 = 1 - \\dfrac{\\omega_p^2}{\\omega^2} \\\\ n_X^2 = 1 - \\dfrac{\\omega_p^2}{\\omega^2}\\,\\dfrac{\\omega^2-\\omega_p^2}{\\omega^2-\\omega_h^2}\\end{gathered}',
    blurb: 'Each branch except the whistler starts at a cutoff (k = 0), and each either climbs to the light line or flattens against a resonance (k → ∞). The R wave splits in two: a high branch above ω_R and the whistler, which starts at ω = 0 and flattens below ω_c. The X-mode also splits, with a lower branch that ends at the upper-hybrid resonance ω_h. The O-mode ignores B entirely. Slide the field strength and watch the gaps open and close.',
    x: { label: 'ck / ω_p', min: 0, max: 4 },
    y: { label: 'ω / ω_p', min: 0, max: 4 },
    params: [{ key: 'b', label: 'Field strength ω_c / ω_p', min: 0.1, max: 3, value: 0.8, step: 0.05 }],
    curves: [
      { label: 'O', color: COLORS.amber, fn: (k) => branchOmega('O', k, 1) },
      { label: 'R', color: COLORS.cyan, fn: (k, p) => branchOmega('R-high', k, p.b) },
      { label: 'R (whistler)', color: COLORS.cyan, dashed: true, fn: (k, p) => branchOmega('R-whistler', k, p.b) },
      { label: 'L', color: COLORS.magenta, fn: (k, p) => branchOmega('L', k, p.b) },
      { label: 'X', color: COLORS.lime, fn: (k, p) => branchOmega('X-high', k, p.b) },
      { label: 'X (lower)', color: COLORS.lime, dashed: true, fn: (k, p) => branchOmega('X-low', k, p.b) },
      { label: 'light line', color: COLORS.violet, dashed: true, fn: (k) => k },
    ],
    markers: [
      { label: 'ω_c', color: COLORS.red, y: (p) => p.b },
      { label: 'ω_h (upper hybrid)', color: COLORS.lime, y: (p) => cutoffs(p.b).wUH },
    ],
  },
  {
    id: 'a6-alfven-speed',
    title: 'Alfvén speed',
    equation: '\\begin{gathered}v_A = \\dfrac{B}{\\sqrt{\\mu_0 \\rho}} \\\\ \\dfrac{\\omega}{k} = \\dfrac{v_A}{\\sqrt{1 + v_A^2/c^2}}\\end{gathered}',
    blurb: 'Field lines behave like strings with tension B²/μ₀, loaded with the plasma mass density ρ = n m_i. Stronger field, faster waves; heavier plasma, slower. In very thin plasma the simple formula would exceed c; the full result (solid) bends over and never does, because the displacement current adds inertia.',
    x: { label: 'B (T)', min: 1e-4, max: 10, log: true },
    y: { label: 'speed (m/s)', min: 1e3, max: 1e9, log: true },
    params: [
      { key: 'n', label: 'Ion density', min: 1e6, max: 1e22, value: 1e20, log: true, unit: 'm⁻³' },
      { key: 'A', label: 'Ion mass', min: 1, max: 40, value: 2, step: 1, unit: '× m_p' },
    ],
    curves: [
      { label: 'phase speed ω/k', color: COLORS.cyan, fn: (B, p) => { const v = B / Math.sqrt(mu0 * p.n * p.A * mp); return v / Math.sqrt(1 + (v * v) / (c * c)) } },
      { label: 'B/√(μ₀ρ)', color: COLORS.magenta, dashed: true, fn: (B, p) => B / Math.sqrt(mu0 * p.n * p.A * mp) },
    ],
    markers: [{ label: 'speed of light', color: COLORS.red, y: () => c }],
  },
]
