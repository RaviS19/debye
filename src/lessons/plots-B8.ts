// B8 plotter presets: a two-temperature electron distribution on log axes, the cold wave-breaking field against
// density, and the energy of electrons thrown forward by the plasma waves of stimulated Raman scattering.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { coldWavebreakingField, crossoverEnergy, reflectedEnergyKeV, reflectedEnergyNonRelKeV, srsPlasmaWave } from '../physics/hotElectrons'

const C = 2.99792458e8
const NC_UM2 = 1.1148e21 // n_c λ² in cm⁻³ µm² (ε0 m_e ω²/e² for λ = 1 µm)

export const PLOTS: PlotSpec[] = [
  {
    id: 'b8-bimaxwellian',
    title: 'Two-temperature electron distribution',
    equation: '\\begin{gathered}f(E) \\propto \\dfrac{1-\\alpha}{T_c^{3/2}}\\,e^{-E/T_c} \\\\ +\\ \\dfrac{\\alpha}{T_h^{3/2}}\\,e^{-E/T_h}\\end{gathered}',
    blurb:
      'The distribution per unit velocity-space volume, as a function of electron energy E = ½mv², normalized to 1 at E = 0 for the cold part alone. On a logarithmic axis each Maxwellian is a straight line of slope −1/T (dashed). The cold line plunges, the hot line hardly falls, and past the crossover the few hot electrons outnumber the cold ones at every energy: a hot fraction α of a percent dominates everything above a few tens of keV. The number per unit energy, dN/dE, carries an extra factor √E that bends the lines slightly at low E; the slopes far out are the same.',
    x: { label: 'electron energy E (keV)', min: 0, max: 300 },
    y: { label: 'f(E) (cold value at E = 0 is 1)', min: 1e-10, max: 2, log: true },
    params: [
      { key: 'Tc', label: 'Cold temperature T_c', min: 0.3, max: 5, value: 2, step: 0.1, unit: 'keV' },
      { key: 'a', label: 'Hot fraction α', min: 1e-4, max: 0.3, value: 0.01, log: true },
      { key: 'Th', label: 'Hot temperature T_h', min: 10, max: 200, value: 50, step: 1, unit: 'keV' },
    ],
    curves: [
      { label: 'total', color: COLORS.cyan, fn: (E, p) => (1 - p.a) * Math.exp(-E / p.Tc) + p.a * (p.Tc / p.Th) ** 1.5 * Math.exp(-E / p.Th) },
      { label: 'cold part', color: COLORS.violet, dashed: true, fn: (E, p) => (1 - p.a) * Math.exp(-E / p.Tc) },
      { label: 'hot part', color: COLORS.magenta, dashed: true, fn: (E, p) => p.a * (p.Tc / p.Th) ** 1.5 * Math.exp(-E / p.Th) },
    ],
    markers: [{ label: 'crossover', color: COLORS.amber, x: (p) => crossoverEnergy(p.a, p.Tc, p.Th, 1.5) }],
  },
  {
    id: 'b8-wavebreaking',
    title: 'Cold wave-breaking field vs density',
    equation: '\\begin{gathered}E_{\\max} = \\dfrac{m_e\\,\\omega_{pe}\\,v_{ph}}{e} \\\\ \\approx 96\\,\\dfrac{v_{ph}}{c}\\sqrt{n\\,[\\text{cm}^{-3}]}\\ \\ \\text{V/m}\\end{gathered}',
    blurb:
      'The largest field a cold electron plasma wave of phase velocity v_ph can carry before the electron fluid overtakes the wave and the wave breaks (Dawson’s limit). Warm plasma breaks earlier, because thermal electrons already move close to v_ph and are caught at a lower amplitude. The amber line marks quarter-critical density for your laser wavelength, where TPD plasma waves and the fastest SRS plasma waves live (v_ph roughly 0.3–0.6c there). For comparison, a 0.351 µm laser at 10¹⁵ W/cm² has a peak field of about 9×10¹⁰ V/m.',
    x: { label: 'electron density n (cm⁻³)', min: 1e16, max: 1e23, log: true },
    y: { label: 'E_max (V/m)', min: 1e8, max: 1e14, log: true },
    params: [
      { key: 'b', label: 'Your phase velocity v_ph/c', min: 0.05, max: 1, value: 0.4, step: 0.01 },
      { key: 'lam', label: 'Laser wavelength (marker)', min: 0.25, max: 10.6, value: 0.351, log: true, unit: 'µm' },
    ],
    curves: [
      { label: 'v_ph = c', color: COLORS.violet, dashed: true, fn: (n) => coldWavebreakingField(n * 1e6, C) },
      { label: 'your v_ph', color: COLORS.cyan, fn: (n, p) => coldWavebreakingField(n * 1e6, p.b * C) },
      { label: 'v_ph = 0.1c', color: COLORS.magenta, dashed: true, fn: (n) => coldWavebreakingField(n * 1e6, 0.1 * C) },
    ],
    markers: [{ label: 'n_c/4 for your λ', color: COLORS.amber, x: (p) => NC_UM2 / (4 * p.lam * p.lam) }],
  },
  {
    id: 'b8-srs-electron-energy',
    title: 'Energy of electrons thrown forward by SRS plasma waves',
    equation: '\\begin{gathered}\\varepsilon = 2\\beta^2\\gamma^2 m_ec^2 \\\\ \\beta = \\dfrac{v_{ph}}{c} = \\dfrac{\\omega_{ek}}{ck_{ek}} \\\\ \\varepsilon \\approx 2m_ev_{ph}^2\\ \\ (\\beta \\ll 1)\\end{gathered}',
    blurb:
      'An electron picked up from rest and reflected by the potential wall of a wave moving at v_ph leaves at twice v_ph (relativistically, 2v_ph/(1 + β²)). The phase velocity is that of the plasma wave made by backscattered Raman light at each density, with exact matching and Bohm–Gross plasma waves at your temperature. Near n_c/4 the plasma wave’s wavenumber falls to about k₀ while its frequency stays near ω₀/2, so v_ph climbs toward c/√3 and the reflected electrons reach hundreds of keV: the most dangerous hot electrons come from the highest-density Raman light and from TPD. The dashed line is the non-relativistic estimate 2mv_ph² at your T_e; for a cold wave at n_c/4 it is 33% low. Curves stop just below n_c/4 when T > 0, where the scattered light would be born at its cut-off.',
    x: { label: 'density n/n_c', min: 0.02, max: 0.25 },
    y: { label: 'electron energy (keV)', min: 5, max: 1000, log: true },
    params: [{ key: 'T', label: 'Electron temperature', min: 0.5, max: 6, value: 3, step: 0.1, unit: 'keV' }],
    curves: [
      { label: 'cold plasma waves', color: COLORS.violet, fn: (n) => { const w = srsPlasmaWave(n, 0); return w ? reflectedEnergyKeV(w.vph) : NaN } },
      { label: 'at your T_e', color: COLORS.cyan, fn: (n, p) => { const w = srsPlasmaWave(n, p.T); return w ? reflectedEnergyKeV(w.vph) : NaN } },
      { label: 'non-relativistic 2mv_ph²', color: COLORS.magenta, dashed: true, fn: (n, p) => { const w = srsPlasmaWave(n, p.T); return w ? reflectedEnergyNonRelKeV(w.vph) : NaN } },
    ],
    markers: [{ label: 'n_c/4', color: COLORS.red, x: () => 0.25 }],
  },
]
