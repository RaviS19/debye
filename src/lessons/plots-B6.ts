// B6 plotter presets: SRS growth, Landau damping and kλ_De vs density; SBS growth in weak and strong coupling;
// Rosenbluth gains vs scale length.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { quiverOverC } from '../physics/lightRamp'
import { normalize } from '../physics/parametric'
import { dampedGrowth, epwDamping, iawDampingRatio, sbsGain, sbsGrowth, srsGain, srsGrowth, umToNorm } from '../physics/srsSbs'

const CH = { Z: 3.5, A: 6.5 }
const srs = (nn: number, p: Record<string, number>) => srsGrowth(normalize({ nn, TeKeV: p.T, TiKeV: 1, Z: 1, A: 1 }), quiverOverC(p.I, p.lam))
const landauNu = (nn: number, p: Record<string, number>) => {
  const s = srs(nn, p)
  return s ? epwDamping(s.klD) * Math.sqrt(nn) : NaN
}
const sbs = (nn: number, p: Record<string, number>) =>
  sbsGrowth(normalize({ nn, TeKeV: p.T, TiKeV: (CH.Z * p.T) / p.R, ...CH }), quiverOverC(p.I, p.lam), CH.Z, CH.A)

export const PLOTS: PlotSpec[] = [
  {
    id: 'b6-srs-growth',
    title: 'SRS backscatter: growth, Landau damping and kλ_De',
    equation: '\\begin{gathered}\\gamma_0 = \\dfrac{k v_{os}}{4}\\,\\dfrac{\\omega_{pe}}{\\sqrt{\\omega_{ek}\\,\\omega_s}} \\\\ \\gamma = -\\dfrac{\\nu}{2} + \\sqrt{\\dfrac{\\nu^2}{4} + \\gamma_0^2}\\end{gathered}',
    blurb: 'Stimulated Raman backscatter at each density, in units of the laser frequency ω₀, from the exact matching conditions with the Bohm–Gross plasma wave. The undamped growth rate γ₀ (cyan) rises with density, because the plasma wave carries more of the coupling, until SRS stops just below n_c/4. At low density the plasma wave has a large kλ_De (amber) and its Landau damping ν (magenta, the exact kinetic root of A9) grows steeply once kλ_De passes about 0.3 (the dotted line). The net growth with that damping (lime) shows the result: Raman is suppressed in the low-density, hot corona and survives at higher density. Hotter plasma moves the cut-off to higher density; longer laser wavelengths raise every growth rate, since v_os ∝ λ√I.',
    x: { label: 'n / n_c', min: 0.01, max: 0.25 },
    y: { label: 'γ/ω₀, ν/ω₀ and kλ_De', min: 1e-5, max: 2, log: true },
    params: [
      { key: 'T', label: 'Electron temperature', min: 0.3, max: 6, value: 2, step: 0.1, unit: 'keV' },
      { key: 'I', label: 'Laser intensity', min: 1e13, max: 1e17, value: 1e15, log: true, unit: 'W/cm²' },
      { key: 'lam', label: 'Laser wavelength', min: 0.351, max: 1.053, value: 0.351, step: 0.001, unit: 'µm' },
    ],
    curves: [
      { label: 'γ₀/ω₀ (undamped)', color: COLORS.cyan, fn: (n, p) => srs(n, p)?.gamma0 ?? NaN },
      { label: 'Landau ν/ω₀', color: COLORS.magenta, fn: (n, p) => landauNu(n, p) },
      {
        label: 'net growth with damping',
        color: COLORS.lime,
        dashed: true,
        fn: (n, p) => {
          const s = srs(n, p)
          return s ? dampedGrowth(s.gamma0, epwDamping(s.klD) * Math.sqrt(n)) : NaN
        },
      },
      { label: 'kλ_De of the plasma wave', color: COLORS.amber, fn: (n, p) => srs(n, p)?.klD ?? NaN },
    ],
    markers: [
      { label: 'kλ_De = 0.3', color: COLORS.amber, y: () => 0.3 },
      { label: 'n_c/4', color: COLORS.red, x: () => 0.25 },
    ],
  },
  {
    id: 'b6-sbs-growth',
    title: 'SBS backscatter: weak and strong coupling',
    equation: '\\begin{gathered}\\gamma_{\\rm w} = \\dfrac{k v_{os}}{4}\\,\\dfrac{\\omega_{pi}}{\\sqrt{kc_s\\,\\omega_0}} \\\\ \\gamma_{\\rm s} = \\dfrac{\\sqrt3}{4}\\Big(\\dfrac{k^2v_{os}^2\\,\\omega_{pi}^2}{\\omega_0}\\Big)^{1/3}\\end{gathered}',
    blurb: 'Stimulated Brillouin backscatter in a CH plasma (Z = 3.5, A = 6.5), with the ion temperature set by ZT_e/T_i. The solid cyan curve is the growing root of the resonant cubic, which contains both regimes. Where γ is small compared with the ion-acoustic frequency kc_s (amber), it follows the weak-coupling formula (violet, dashed); where the pump is strong enough to beat kc_s, the ion response is no longer a free sound wave and the growth follows the strongly coupled formula (magenta, dashed), which grows only as the cube root of I. Raise the intensity or lower T_e to cross over. The lime curve is the ion Landau damping rate: lower ZT_e/T_i towards 3 and it climbs towards the growth rate.',
    x: { label: 'n / n_c', min: 0.01, max: 1 },
    y: { label: 'rate / ω₀', min: 1e-6, max: 1e-2, log: true },
    params: [
      { key: 'I', label: 'Laser intensity', min: 1e13, max: 1e17, value: 1e15, log: true, unit: 'W/cm²' },
      { key: 'T', label: 'Electron temperature', min: 0.1, max: 6, value: 2, step: 0.05, unit: 'keV' },
      { key: 'R', label: 'ZT_e / T_i', min: 3, max: 40, value: 7, step: 0.5 },
      { key: 'lam', label: 'Laser wavelength', min: 0.351, max: 1.053, value: 0.351, step: 0.001, unit: 'µm' },
    ],
    curves: [
      { label: 'γ, resonant cubic', color: COLORS.cyan, fn: (n, p) => sbs(n, p)?.cubic ?? NaN },
      { label: 'weak-coupling formula', color: COLORS.violet, dashed: true, fn: (n, p) => sbs(n, p)?.weak ?? NaN },
      { label: 'strong-coupling formula', color: COLORS.magenta, dashed: true, fn: (n, p) => sbs(n, p)?.strong ?? NaN },
      { label: 'kc_s (ion acoustic frequency)', color: COLORS.amber, fn: (n, p) => sbs(n, p)?.kcs ?? NaN },
      {
        label: 'ion Landau damping ν/ω₀',
        color: COLORS.lime,
        fn: (n, p) => {
          const s = sbs(n, p)
          return s ? iawDampingRatio(p.R, CH.Z, CH.A) * s.kcs : NaN
        },
      },
    ],
  },
  {
    id: 'b6-rosenbluth-gain',
    title: 'Convective gain vs scale length',
    equation: '\\begin{gathered}G = \\dfrac{2\\pi\\gamma_0^2}{|\\kappa\'\\,v_1v_2|} \\\\ G_{\\rm SRS} \\approx \\dfrac{\\pi}{4}\\,\\dfrac{k^2v_{os}^2}{k_s\\,c^2}\\,L \\\\ G_{\\rm SBS} \\approx \\dfrac{\\pi}{8}\\,\\dfrac{v_{os}^2}{v_{te}^2}\\,\\dfrac{n}{n_c}\\,\\dfrac{\\omega_0 L_u}{c} \\\\ \\times\\dfrac{1}{\\sqrt{1 - n/n_c}\\,(1 + 3T_i/ZT_e)}\\end{gathered}',
    blurb: 'Rosenbluth intensity gain exponents for backscatter in a CH plasma: SRS in a linear density gradient of scale length L, and SBS in a linear flow-velocity gradient over which the flow changes by c_s in a distance L_u (here equal to L). Both are proportional to I λ² × (L/λ), so to IλL: long plasmas at high intensity give large gains. The dotted line is G = 10, a rough guide to where scattering from thermal noise starts to matter. The SRS gain hardly depends on density until close to n_c/4, where the scattered light is born almost at rest and the gain climbs steeply; there the convective formula stops applying and the instability turns absolute. The SBS gain grows with density and falls with temperature; at 0.1 n_c and 2 keV it is about twice the SRS gain.',
    x: { label: 'scale length L (µm)', min: 10, max: 3000, log: true },
    y: { label: 'gain exponent G', min: 0.01, max: 1000, log: true },
    params: [
      { key: 'I', label: 'Laser intensity', min: 1e13, max: 1e17, value: 1e15, log: true, unit: 'W/cm²' },
      { key: 'n', label: 'Density at the matching point', min: 0.02, max: 0.24, value: 0.1, step: 0.005, unit: 'n_c' },
      { key: 'T', label: 'Electron temperature', min: 0.3, max: 6, value: 2, step: 0.1, unit: 'keV' },
      { key: 'lam', label: 'Laser wavelength', min: 0.351, max: 1.053, value: 0.351, step: 0.001, unit: 'µm' },
    ],
    curves: [
      {
        label: 'SRS, density gradient',
        color: COLORS.cyan,
        fn: (Lum, p) => srsGain(normalize({ nn: p.n, TeKeV: p.T, TiKeV: 1, Z: 1, A: 1 }), quiverOverC(p.I, p.lam), umToNorm(Lum, p.lam)),
      },
      {
        label: 'SBS, flow gradient (CH, ZT_e/T_i = 7)',
        color: COLORS.magenta,
        fn: (Lum, p) => sbsGain(normalize({ nn: p.n, TeKeV: p.T, TiKeV: (CH.Z * p.T) / 7, ...CH }), quiverOverC(p.I, p.lam), CH.Z, CH.A, umToNorm(Lum, p.lam)),
      },
    ],
    markers: [{ label: 'G = 10', color: COLORS.amber, y: () => 10 }],
  },
]
