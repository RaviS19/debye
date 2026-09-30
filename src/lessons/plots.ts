// Plotter presets, each tied to an equation in the lessons ("Plot it").
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { debyeLength, plasmaFrequency, plasmaParameter, cyclotronFrequency, larmorRadius, lossConeAngle, lossFraction, me, mp, e } from '../physics/constants'

export const PLOTS: PlotSpec[] = [
  {
    id: 'debye-length',
    title: 'Debye length vs density',
    equation: '\\lambda_D = \\sqrt{\\dfrac{\\varepsilon_0 k T_e}{n e^2}} \\approx 7430\\sqrt{T_{eV}/n}\\ \\text{m}',
    blurb: 'Each line is one electron temperature. Hotter electrons push back harder against the test charge, so the shielding cloud is bigger. Denser plasma has more electrons nearby, so it shields over a shorter distance.',
    x: { label: 'density n (m⁻³)', min: 1e6, max: 1e32, log: true },
    y: { label: 'λ_D (m)', min: 1e-12, max: 1e3, log: true },
    params: [{ key: 'T', label: 'Your temperature', min: 0.01, max: 1e5, value: 10, log: true, unit: 'eV' }],
    curves: [
      { label: 'T = 1 eV', color: COLORS.violet, fn: (n) => debyeLength(n, 1) },
      { label: 'T = 1 keV', color: COLORS.magenta, fn: (n) => debyeLength(n, 1000) },
      { label: 'your T', color: COLORS.cyan, fn: (n, p) => debyeLength(n, p.T) },
    ],
    markers: [
      { label: 'tokamak n ~ 10²⁰', color: COLORS.lime, x: () => 1e20 },
      { label: 'solid density', color: COLORS.amber, x: () => 1e29 },
    ],
  },
  {
    id: 'debye-potential',
    title: 'Bare vs shielded potential',
    equation: '\\phi(r) = \\dfrac{q}{4\\pi\\varepsilon_0 r}\\, e^{-r/\\lambda_D}',
    blurb: 'The dashed line is the bare Coulomb potential of the test charge. The glowing line is what the plasma lets through. Past about 2–3 λ_D the charge is effectively invisible.',
    x: { label: 'r / λ_D', min: 0.05, max: 5 },
    y: { label: 'φ (units of q/4πε₀λ_D)', min: 0, max: 5 },
    params: [{ key: 'lam', label: 'Debye length scale', min: 0.3, max: 3, value: 1, unit: '× λ_D' }],
    curves: [
      { label: 'Coulomb', color: COLORS.violet, dashed: true, fn: (r) => 1 / r },
      { label: 'Debye-shielded', color: COLORS.cyan, fn: (r, p) => Math.exp(-r / p.lam) / r },
    ],
    markers: [{ label: 'r = λ', color: COLORS.amber, x: (p) => p.lam }],
  },
  {
    id: 'plasma-frequency',
    title: 'Plasma frequency vs density',
    equation: 'f_{pe} = \\dfrac{\\omega_{pe}}{2\\pi} = \\dfrac{1}{2\\pi}\\sqrt{\\dfrac{n e^2}{\\varepsilon_0 m_e}} \\approx 8.98\\sqrt{n}\\ \\text{Hz}',
    blurb: 'Light below the plasma frequency cannot travel through the plasma, and this sets the critical density for lasers in Track B. The ionosphere reflects AM radio for exactly this reason.',
    x: { label: 'density n (m⁻³)', min: 1e8, max: 1e30, log: true },
    y: { label: 'frequency (Hz)', min: 1e3, max: 1e17, log: true },
    params: [{ key: 'lam', label: 'Light wavelength', min: 0.1, max: 1e7, value: 1.053, log: true, unit: 'µm' }],
    curves: [
      { label: 'electron f_pe', color: COLORS.cyan, fn: (n) => plasmaFrequency(n) / (2 * Math.PI) },
      { label: 'ion f_pi (protons)', color: COLORS.magenta, fn: (n) => plasmaFrequency(n, mp) / (2 * Math.PI) },
    ],
    markers: [
      { label: 'your light', color: COLORS.amber, y: (p) => 2.998e8 / (p.lam * 1e-6) },
      { label: 'ionosphere', color: COLORS.lime, x: () => 1e12 },
    ],
  },
  {
    id: 'plasma-parameter',
    title: 'Particles in a Debye sphere',
    equation: 'N_D = \\tfrac{4}{3}\\pi n \\lambda_D^3',
    blurb: 'A true plasma needs N_D ≫ 1, so shielding is a collective, statistical effect. Almost every lab and space plasma has N_D from thousands to over 10¹⁰.',
    x: { label: 'density n (m⁻³)', min: 1e6, max: 1e32, log: true },
    y: { label: 'N_D', min: 1e-2, max: 1e20, log: true },
    params: [{ key: 'T', label: 'Temperature', min: 0.01, max: 1e5, value: 10, log: true, unit: 'eV' }],
    curves: [{ label: 'N_D', color: COLORS.cyan, fn: (n, p) => plasmaParameter(n, p.T) }],
    markers: [{ label: 'N_D = 1 (not a plasma below)', color: COLORS.red, y: () => 1 }],
  },
  {
    id: 'larmor-radius',
    title: 'Larmor radius vs magnetic field',
    equation: 'r_L = \\dfrac{m v_\\perp}{|q| B}',
    blurb: 'Ions gyrate on circles roughly √(m_p/m_e) ≈ 43 times larger than electrons at the same temperature. That is why ions feel field gradients first.',
    x: { label: 'B (T)', min: 1e-5, max: 20, log: true },
    y: { label: 'r_L (m)', min: 1e-7, max: 1e4, log: true },
    params: [{ key: 'T', label: 'Perpendicular energy', min: 0.1, max: 1e5, value: 1000, log: true, unit: 'eV' }],
    curves: [
      { label: 'electron', color: COLORS.cyan, fn: (B, p) => larmorRadius(Math.sqrt((2 * p.T * e) / me), B, me) },
      { label: 'proton', color: COLORS.magenta, fn: (B, p) => larmorRadius(Math.sqrt((2 * p.T * e) / mp), B, mp) },
    ],
    markers: [{ label: 'ITER ~5.3 T', color: COLORS.lime, x: () => 5.3 }],
  },
  {
    id: 'cyclotron-frequency',
    title: 'Cyclotron frequency vs field',
    equation: 'f_c = \\dfrac{|q| B}{2\\pi m}',
    blurb: 'Electrons gyrate at 28 GHz per tesla, which is why fusion devices heat electrons with high-power microwaves (gyrotrons). Protons are 1836 times slower.',
    x: { label: 'B (T)', min: 1e-4, max: 20, log: true },
    y: { label: 'f_c (Hz)', min: 1, max: 1e13, log: true },
    params: [],
    curves: [
      { label: 'electron', color: COLORS.cyan, fn: (B) => cyclotronFrequency(B) / (2 * Math.PI) },
      { label: 'proton', color: COLORS.magenta, fn: (B) => cyclotronFrequency(B, mp) / (2 * Math.PI) },
    ],
  },
  {
    id: 'exb',
    title: 'E×B drift speed',
    equation: 'v_E = \\dfrac{E}{B}',
    blurb: 'The drift does not depend on charge, mass or energy. Everything moves together, so E×B shifts the whole plasma and carries no current.',
    x: { label: 'E (V/m)', min: 1, max: 1e6, log: true },
    y: { label: 'v_E (m/s)', min: 1e-2, max: 1e9, log: true },
    params: [{ key: 'B', label: 'Magnetic field', min: 1e-4, max: 10, value: 0.1, log: true, unit: 'T' }],
    curves: [{ label: 'v_E', color: COLORS.cyan, fn: (E, p) => E / p.B }],
    markers: [{ label: 'speed of light (formula fails near here)', color: COLORS.red, y: () => 2.998e8 }],
  },
  {
    id: 'loss-cone',
    title: 'Mirror ratio and the loss cone',
    equation: '\\sin^2\\theta_m = \\dfrac{1}{R},\\qquad f_{\\text{lost}} = 1-\\cos\\theta_m',
    blurb: 'A higher mirror ratio narrows the loss cone, but slowly: even R = 10 still loses about 5% of an isotropic plasma straight away, and collisions keep refilling the cone.',
    x: { label: 'mirror ratio R', min: 1, max: 20 },
    y: { label: 'value', min: 0, max: 1 },
    params: [],
    curves: [
      { label: 'loss-cone angle θ_m / 90°', color: COLORS.cyan, fn: (R) => (lossConeAngle(R) * 2) / Math.PI },
      { label: 'fraction lost', color: COLORS.magenta, fn: (R) => lossFraction(R) },
    ],
    markers: [{ label: 'R = 4 → 30°', color: COLORS.amber, x: () => 4 }],
  },
  {
    id: 'mirror-profile',
    title: 'Where a particle turns around',
    equation: 'B_{\\text{turn}} = \\dfrac{B_0}{\\sin^2\\theta_0}',
    blurb: 'The curve is the field along the mirror axis. A particle launched at the midplane with pitch angle θ₀ reflects where B reaches B₀/sin²θ₀. If that is above the peak, it escapes.',
    x: { label: 'z / L', min: -2, max: 2 },
    y: { label: 'B / B₀', min: 0, max: 6 },
    params: [{ key: 'th', label: 'Pitch angle θ₀', min: 5, max: 90, value: 40, unit: '°' }],
    curves: [{ label: 'B(z)', color: COLORS.cyan, fn: (z) => 1 + z * z }],
    markers: [
      { label: 'turning field', color: COLORS.magenta, y: (p) => 1 / Math.sin((p.th * Math.PI) / 180) ** 2 },
      { label: 'mirror throat (R = 5)', color: COLORS.amber, y: () => 5 },
    ],
  },
]

export const plotById = (id: string) => PLOTS.find((p) => p.id === id)
