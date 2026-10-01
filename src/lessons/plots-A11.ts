// A11 plotter presets: Bosch–Hale reactivities, the Lawson/ignition curves, the ignition triple product,
// the ICF burn fraction and the tokamak trapped-particle condition.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { nTauForQ, nTauIgnitionBrems, reactivity, svDD, svDT, tripleIgnition } from '../physics/fusion'
import { trappingRatio } from '../physics/tokamakOrbit'

const inRange = (T: number, f: (T: number) => number) => (T >= 0.2 && T <= 100 ? f(T) : NaN)

export const PLOTS: PlotSpec[] = [
  {
    id: 'a11-reactivity',
    title: 'Fusion reactivity vs temperature (D–T and D–D)',
    equation: '\\begin{gathered}\\langle\\sigma v\\rangle = C_1\\,\\theta\\sqrt{\\dfrac{\\xi}{m_rc^2\\,T^3}}\\;e^{-3\\xi} \\\\ \\xi = \\left(\\dfrac{B_G^2}{4\\theta}\\right)^{1/3}\\end{gathered}',
    blurb: 'Bosch & Hale’s 1992 fit to the measured cross-sections, averaged over a Maxwellian. D–T is about 1.1×10⁻²² m³/s at 10 keV and peaks near 8.9×10⁻²² m³/s at about 67 keV. D–D (both branches together) is roughly a hundred times weaker at 10–20 keV, which is why every near-term reactor burns D–T. The fit is valid from 0.2 to 100 keV, so the curves stop at 100 keV.',
    x: { label: 'ion temperature T (keV)', min: 1, max: 100, log: true },
    y: { label: '⟨σv⟩ (m³/s)', min: 1e-29, max: 3e-21, log: true },
    params: [],
    curves: [
      { label: 'D–T', color: COLORS.cyan, fn: (T) => inRange(T, svDT) },
      { label: 'D–D (both branches)', color: COLORS.magenta, fn: (T) => inRange(T, svDD) },
      { label: 'D(d,n)³He only', color: COLORS.violet, dashed: true, fn: (T) => inRange(T, (t) => reactivity('DDn', t)) },
    ],
    markers: [
      { label: '10 keV', color: COLORS.lime, x: () => 10 },
      { label: 'peak 67 keV', color: COLORS.amber, x: () => 66.6 },
    ],
  },
  {
    id: 'a11-lawson',
    title: 'Confinement needed for ignition and for Q = 1',
    equation: 'n\\tau_E = \\dfrac{12\\,kT}{\\langle\\sigma v\\rangle E_{\\text{fus}}\\left(\\dfrac{1}{Q} + \\dfrac{E_\\alpha}{E_{\\text{fus}}}\\right)}',
    blurb: 'Steady-state power balance for a 50:50 D–T plasma with T_e = T_i and thermal energy 3nkT. Q is fusion power over external heating power. Ignition (Q → ∞) needs about six times more n τ_E than breakeven (Q = 1). The dashed line adds bremsstrahlung losses: below about 4.3 keV radiation beats alpha heating and no confinement is good enough. Slide Q to see any other contour.',
    x: { label: 'temperature T (keV)', min: 1, max: 100, log: true },
    y: { label: 'n τ_E (s/m³)', min: 1e18, max: 1e23, log: true },
    params: [{ key: 'Q', label: 'Your Q', min: 0.05, max: 100, value: 10, log: true }],
    curves: [
      { label: 'ignition (Q = ∞)', color: COLORS.cyan, fn: (T) => inRange(T, (t) => nTauForQ(t, Infinity)) },
      { label: 'Q = 1', color: COLORS.magenta, fn: (T) => inRange(T, (t) => nTauForQ(t, 1)) },
      { label: 'your Q', color: COLORS.violet, fn: (T, p) => inRange(T, (t) => nTauForQ(t, p.Q)) },
      { label: 'ignition + bremsstrahlung', color: COLORS.amber, dashed: true, fn: (T) => inRange(T, nTauIgnitionBrems) },
    ],
    markers: [{ label: 'ideal ignition 4.3 keV', color: COLORS.red, x: () => 4.3 }],
  },
  {
    id: 'a11-triple-product',
    title: 'Ignition triple product',
    equation: 'n T \\tau_E \\geq \\dfrac{12\\,(kT)^2}{E_\\alpha \\langle\\sigma v\\rangle}',
    blurb: 'Multiply the ignition n τ_E by T and the curve has a clear minimum: about 2.8×10²¹ keV·s/m³ near 14 keV. That is why the triple product is the single number quoted for progress in magnetic fusion, and why tokamaks aim for 10–20 keV rather than the reactivity peak at 67 keV (plasma pressure, which scales with nT, is limited by stability).',
    x: { label: 'temperature T (keV)', min: 2, max: 100, log: true },
    y: { label: 'n T τ_E (keV·s/m³)', min: 1e21, max: 1e23, log: true },
    params: [],
    curves: [{ label: 'ignition', color: COLORS.cyan, fn: (T) => inRange(T, tripleIgnition) }],
    markers: [
      { label: 'minimum ≈ 13.5 keV', color: COLORS.lime, x: () => 13.54 },
      { label: '2.8×10²¹', color: COLORS.amber, y: () => 2.775e21 },
    ],
  },
  {
    id: 'a11-burn-fraction',
    title: 'Inertial fusion: burn fraction vs areal density',
    equation: 'f_{\\text{burn}} \\approx \\dfrac{\\rho R}{\\rho R + H_B},\\qquad H_B \\approx 6\\text{–}7\\ \\text{g/cm}^2',
    blurb: 'An imploded capsule is held together only by its own inertia; it flies apart in a time of order R/c_s. The fraction of fuel that burns before then depends on the areal density ρR. The hot spot needs ρR ≈ 0.3 g/cm² to stop its own 3.5 MeV alphas and ignite; burning a useful fraction of the fuel (about a third) needs a dense, cold shell with ρR ≈ 3 g/cm² around it. H_B depends weakly on the burn temperature; 6 to 7 g/cm² is typical.',
    x: { label: 'ρR (g/cm²)', min: 0.01, max: 30, log: true },
    y: { label: 'burn fraction', min: 0, max: 1 },
    params: [{ key: 'HB', label: 'Burn parameter H_B', min: 5, max: 8, value: 6, step: 0.1, unit: 'g/cm²' }],
    curves: [{ label: 'f_burn', color: COLORS.cyan, fn: (x, p) => x / (x + p.HB) }],
    markers: [
      { label: 'hot spot ≈ 0.3', color: COLORS.lime, x: () => 0.3 },
      { label: 'fuel ≈ 3', color: COLORS.amber, x: () => 3 },
    ],
  },
  {
    id: 'a11-trapping',
    title: 'Trapped particles in a tokamak',
    equation: '\\dfrac{v_\\parallel}{v_\\perp} < \\sqrt{\\dfrac{2\\varepsilon}{1-\\varepsilon}},\\qquad \\varepsilon = \\dfrac{r}{R_0}',
    blurb: 'The toroidal field is stronger on the inside of the torus, so the inboard side acts as a magnetic mirror with ratio (1+ε)/(1−ε). The cyan curve is the critical pitch ratio at the outboard midplane; the magenta curve is the fraction of an isotropic distribution trapped there, √(2ε/(1+ε)). Even a modest ε = 0.1 traps about 43% of the particles at that point (fewer when averaged around the flux surface).',
    x: { label: 'inverse aspect ratio ε = r/R₀', min: 0, max: 0.6 },
    y: { label: 'value', min: 0, max: 1.5 },
    params: [],
    curves: [
      { label: 'critical v∥/v⊥', color: COLORS.cyan, fn: (e) => (e > 0 ? trappingRatio(e) : 0) },
      { label: 'trapped fraction at outboard midplane', color: COLORS.magenta, fn: (e) => Math.sqrt((2 * e) / (1 + e)) },
    ],
    markers: [{ label: 'ITER-like edge ε ≈ 1/3', color: COLORS.lime, x: () => 1 / 3 }],
  },
]
