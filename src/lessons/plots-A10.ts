// A10 plotter presets: floating wall potential vs ion mass, Child–Langmuir sheath thickness,
// the Sagdeev potential of an ion acoustic soliton, and the ponderomotive potential of a laser.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { amu, childLangmuirThickness, floatingPotential, ponderomotiveEV, sagdeevV, sheathDrop } from '../physics/sheath'

export const PLOTS: PlotSpec[] = [
  {
    id: 'a10-floating-potential',
    title: 'Floating wall potential vs ion mass',
    equation: '\\dfrac{e\\phi_w}{kT_e} = \\tfrac{1}{2}\\ln\\!\\left(\\dfrac{2\\pi m_e}{M}\\right) - \\tfrac{1}{2}',
    blurb: 'An isolated wall charges up until it repels all but a trickle of electrons, just enough to match the ion flux. Heavier ions arrive more slowly, so the wall must turn away more electrons and floats more negative. The dependence is only logarithmic: going from hydrogen to xenon (131 times heavier) adds just 2.4 kT_e/e. The dashed line is the drop across the sheath alone; the extra ½ kT_e/e is the presheath that speeds the ions up to c_s.',
    x: { label: 'ion mass number A', min: 0.8, max: 300, log: true },
    y: { label: 'eφ_w / kT_e', min: -7, max: 0 },
    params: [],
    curves: [
      { label: 'wall (sheath + presheath)', color: COLORS.cyan, fn: (A) => floatingPotential(A * amu) },
      { label: 'sheath drop only', color: COLORS.violet, dashed: true, fn: (A) => -sheathDrop(A * amu) },
    ],
    markers: [
      { label: 'H', color: COLORS.lime, x: () => 1 },
      { label: 'He', color: COLORS.amber, x: () => 4 },
      { label: 'Ar', color: COLORS.magenta, x: () => 40 },
      { label: 'Xe', color: COLORS.red, x: () => 131 },
    ],
  },
  {
    id: 'a10-child-langmuir',
    title: 'Sheath thickness vs wall bias',
    equation: '\\dfrac{d}{\\lambda_D} = \\dfrac{\\sqrt{2}}{3}\\left(\\dfrac{2e|V|}{kT_e}\\right)^{3/4}',
    blurb: 'Bias a wall far below the floating potential and the sheath swells until the space charge of the ions crossing it can support the voltage: the Child–Langmuir law with the Bohm flux. A floating sheath is a few Debye lengths thick; a sheath holding 1000 kT_e/e is about 140 λ_D thick. The thickness grows only as the ¾ power of the voltage.',
    x: { label: 'e|V| / kT_e', min: 1, max: 1000, log: true },
    y: { label: 'd / λ_D', min: 0.5, max: 500, log: true },
    params: [],
    curves: [{ label: 'Child–Langmuir sheath', color: COLORS.cyan, fn: (chi) => childLangmuirThickness(chi) }],
    markers: [{ label: 'floating sheath drop, H (for scale)', color: COLORS.lime, x: () => 2.84 }],
  },
  {
    id: 'a10-sagdeev',
    title: 'Sagdeev potential of an ion acoustic soliton',
    equation: '\\begin{gathered}\\tfrac{1}{2}\\left(\\dfrac{d\\chi}{d\\xi}\\right)^2 + V(\\chi) = 0 \\\\ V(\\chi) = 1 - e^{\\chi} \\\\ \\qquad +\\, \\mathcal{M}^2\\left(1 - \\sqrt{1 - 2\\chi/\\mathcal{M}^2}\\right)\\end{gathered}',
    blurb: 'Read this as a ball rolling in the landscape V(χ) with zero total energy, where "time" is position through the wave. The ball starts at χ = 0 (undisturbed plasma), rolls into the dip, and turns around where V climbs back to 0: that turning point is the soliton’s peak. For Mach number ≤ 1 there is no dip. Above about 1.58 the curve never returns to 0 before χ = 𝓜²/2, where ions would be reflected, so no soliton exists. Zoom in near 𝓜 = 1.1: the dip is shallow and the soliton small.',
    x: { label: 'χ = eφ / kT_e', min: 0, max: 1.4 },
    y: { label: 'V(χ)', min: -0.3, max: 0.15 },
    params: [{ key: 'M', label: 'Mach number 𝓜 = u/c_s', min: 0.9, max: 1.7, value: 1.4, step: 0.01 }],
    curves: [
      { label: 'V(χ), your 𝓜', color: COLORS.cyan, fn: (x, p) => sagdeevV(x, p.M) },
      { label: '𝓜 = 1.2', color: COLORS.violet, dashed: true, fn: (x) => sagdeevV(x, 1.2) },
    ],
    markers: [
      { label: 'V = 0', color: COLORS.axis, y: () => 0 },
      { label: 'ions reflected at χ = 𝓜²/2', color: COLORS.red, x: (p) => (p.M * p.M) / 2 },
    ],
  },
  {
    id: 'a10-ponderomotive',
    title: 'Ponderomotive potential of a laser',
    equation: '\\begin{gathered}U_p = \\dfrac{e^2 \\langle E^2\\rangle}{2 m_e \\omega^2} \\\\ U_p\\,[\\text{eV}] \\approx 9.34\\times10^{-14}\\, I\\lambda^2 \\end{gathered}',
    blurb: 'I in W/cm² and λ in µm. The cycle-averaged quiver energy of an electron in a laser field, and the height of the hill that pushes electrons out of an intense focus. It grows as Iλ², so long-wavelength light pushes much harder at the same intensity. Where U_p approaches m_ec²/4 ≈ 128 keV (the normalized amplitude a₀ reaches 1, Iλ² ≈ 1.37×10¹⁸ W cm⁻² µm²) the electrons become relativistic and this formula no longer holds: that is Track C.',
    x: { label: 'intensity I (W/cm²)', min: 1e10, max: 1e20, log: true },
    y: { label: 'U_p (eV)', min: 1e-4, max: 1e7, log: true },
    params: [{ key: 'lam', label: 'Your wavelength', min: 0.2, max: 12, value: 0.8, log: true, unit: 'µm' }],
    curves: [
      { label: '0.351 µm (UV)', color: COLORS.violet, fn: (I) => ponderomotiveEV(I, 0.351) },
      { label: '1.053 µm (Nd:glass)', color: COLORS.magenta, fn: (I) => ponderomotiveEV(I, 1.053) },
      { label: '10.6 µm (CO₂)', color: COLORS.amber, fn: (I) => ponderomotiveEV(I, 10.6) },
      { label: 'your λ', color: COLORS.cyan, fn: (I, p) => ponderomotiveEV(I, p.lam) },
    ],
    markers: [
      { label: 'a₀ = 1: m_ec²/4, relativistic above', color: COLORS.red, y: () => 1.2775e5 },
      { label: 'hydrogen ionization 13.6 eV', color: COLORS.lime, y: () => 13.6 },
    ],
  },
]
