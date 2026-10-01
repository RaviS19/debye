// B1 plotter presets: refractive index and group velocity, the Airy standing wave, and field swelling.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { airyIntensity, swellingPeak, wkbEnvelope } from '../physics/lightRamp'

const deg = Math.PI / 180

export const PLOTS: PlotSpec[] = [
  {
    id: 'b1-index-group',
    title: 'Refractive index and group velocity vs density',
    equation: '\\begin{gathered}\\eta = \\sqrt{1 - \\dfrac{n_e}{n_c}} = \\dfrac{v_g}{c} = \\dfrac{c}{v_\\phi} \\\\ \\dfrac{k_x}{k_0} = \\sqrt{\\cos^2\\theta - \\dfrac{n_e}{n_c}}\\end{gathered}',
    blurb: 'For light in a plasma the refractive index and the group velocity in units of c are the same function, so both fall to zero at n_c, while the phase velocity c/η shoots up. Energy conservation (constant energy flux) makes the time-averaged |E|² grow as 1/η (WKB), which is why the field swells as the light slows down. For oblique light only the part of k along the gradient falls to zero, and it does so at n_c cos²θ: slide the angle and watch the amber curve hit zero early.',
    x: { label: 'n_e / n_c', min: 0, max: 1.1 },
    y: { label: 'value', min: 0, max: 4 },
    params: [{ key: 'th', label: 'Angle of incidence θ', min: 0, max: 70, value: 40, step: 1, unit: '°' }],
    curves: [
      { label: 'η = v_g/c', color: COLORS.cyan, fn: (u) => (u <= 1 ? Math.sqrt(1 - u) : NaN) },
      { label: '1/η = v_φ/c ∝ WKB |E|²', color: COLORS.magenta, fn: (u) => (u < 1 ? 1 / Math.sqrt(1 - u) : NaN) },
      { label: 'k_x/k₀ at θ', color: COLORS.amber, fn: (u, p) => { const q = Math.cos(p.th * deg) ** 2 - u; return q >= 0 ? Math.sqrt(q) : NaN } },
    ],
    markers: [
      { label: 'n_c/4', color: COLORS.magenta, x: () => 0.25 },
      { label: 'n_c cos²θ', color: COLORS.amber, x: (p) => Math.cos(p.th * deg) ** 2 },
      { label: 'n_c', color: COLORS.red, x: () => 1 },
    ],
  },
  {
    id: 'b1-airy-standing-wave',
    title: 'Standing wave in a linear ramp: Airy vs WKB',
    equation: '\\begin{gathered}\\dfrac{|E|^2}{|E_{\\rm vac}|^2} = 4\\pi\\left(\\dfrac{\\omega L}{c}\\right)^{1/3}\\mathrm{Ai}^2(\\zeta) \\\\ \\zeta = \\left(\\dfrac{\\omega^2}{c^2L}\\right)^{1/3}(x - L)\\end{gathered}',
    blurb: 'The light enters the linear ramp n_e = n_c x/L at x = 0 and turns at x = L. The Airy solution (cyan) is a standing wave whose peaks grow toward the turning point, then it decays into an evanescent tail. The WKB envelope 4/η (magenta, dashed) follows the peaks until the last fringe or two, then diverges at x = L where the Airy function stays finite. Raise L/λ: the fringes crowd together and the peak grows, but only as the cube root of L. Zoom in near x/L = 1.',
    x: { label: 'x / L', min: 0.4, max: 1.12 },
    y: { label: '|E|² / |E_vac|²', min: 0, max: 26 },
    params: [{ key: 'L', label: 'Scale length L/λ', min: 1, max: 50, value: 10, step: 0.5 }],
    curves: [
      { label: 'Airy', color: COLORS.cyan, fn: (s, p) => { const kL = 2 * Math.PI * p.L; return airyIntensity(s * kL, kL) } },
      { label: 'WKB envelope 4/η', color: COLORS.magenta, dashed: true, fn: (s, p) => wkbEnvelope(s * 2 * Math.PI * p.L, 2 * Math.PI * p.L) },
      { label: 'WKB average 2/η', color: COLORS.violet, dashed: true, fn: (s) => (s < 1 ? 2 / Math.sqrt(1 - s) : NaN) },
    ],
    markers: [
      { label: 'n = n_c', color: COLORS.amber, x: () => 1 },
      { label: 'peak 3.6(ωL/c)^⅓', color: COLORS.lime, y: (p) => swellingPeak(2 * Math.PI * p.L) },
    ],
  },
  {
    id: 'b1-swelling-factor',
    title: 'Peak field swelling vs scale length',
    equation: '\\begin{gathered}\\dfrac{|E_{\\max}|^2}{|E_{\\rm vac}|^2} \\approx 4\\pi\\,\\mathrm{Ai}_{\\max}^2\\left(\\dfrac{\\omega L}{c}\\right)^{1/3}\\cos\\theta \\\\ = 3.6\\left(\\dfrac{2\\pi L}{\\lambda}\\right)^{1/3}\\cos\\theta\\end{gathered}',
    blurb: 'The time-averaged |E|² at the last standing-wave peak before the turning point, relative to |E|² of the incident wave in vacuum (s-polarized light at angle θ). It grows only as the cube root of L/λ: a 100 λ ramp gives about 31 at normal incidence, a 1000 λ ramp about 66. The dashed line is the WKB standing-wave peak at quarter-critical, 4/η = 4.6, for comparison: almost all of the swelling happens in the last few wavelengths before the turning point.',
    x: { label: 'L / λ', min: 1, max: 1000, log: true },
    y: { label: '|E_max|² / |E_vac|²', min: 1, max: 100, log: true },
    params: [{ key: 'th', label: 'Angle of incidence θ', min: 0, max: 70, value: 0, step: 1, unit: '°' }],
    curves: [
      { label: 'Airy peak', color: COLORS.cyan, fn: (L, p) => swellingPeak(2 * Math.PI * L, p.th * deg) },
      { label: 'WKB peak at n_c/4', color: COLORS.violet, dashed: true, fn: () => 4 / Math.sqrt(0.75) },
    ],
    markers: [
      { label: '100 µm at 351 nm', color: COLORS.amber, x: () => 100 / 0.351 },
      { label: '100 µm at 1053 nm', color: COLORS.lime, x: () => 100 / 1.053 },
    ],
  },
]
