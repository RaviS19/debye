// A7 plotter presets: classical vs Bohm diffusion, Spitzer resistivity, diffusive decay of a slab.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { bohmD, classicalDperp, coulombLog, slabProfile, spitzerPar, spitzerPerp } from '../physics/classicalTransport'

export const PLOTS: PlotSpec[] = [
  {
    id: 'a7-dperp-vs-b',
    title: 'Diffusion across B: classical vs Bohm',
    equation: '\\dfrac{D_\\perp}{D} = \\dfrac{1}{1+\\omega_c^2\\tau^2},\\qquad \\dfrac{D_B}{D} = \\dfrac{1}{16\\,\\omega_c\\tau}',
    blurb: 'Both are divided by the field-free value D = kT/mν, and ω_cτ grows in proportion to B. Classical diffusion falls as 1/B² once ω_cτ > 1: particles can only hop one Larmor radius per collision. Bohm’s empirical law falls only as 1/B and wins beyond ω_cτ ≈ 16. Hot fusion plasmas have ω_cτ of a million or more, so the gap between the two is enormous. Bohm’s formula only makes sense for strongly magnetized plasma, so it is drawn from ω_cτ = 1.',
    x: { label: 'ω_c τ  (∝ B)', min: 0.01, max: 1e4, log: true },
    y: { label: 'D / (kT/mν)', min: 1e-8, max: 3, log: true },
    params: [],
    curves: [
      { label: 'classical D⊥', color: COLORS.cyan, fn: (x) => 1 / (1 + x * x) },
      { label: 'Bohm D_B', color: COLORS.magenta, fn: (x) => (x >= 1 ? 1 / (16 * x) : NaN) },
    ],
    markers: [
      { label: 'ω_cτ = 1', color: COLORS.amber, x: () => 1 },
      { label: 'crossover ≈ 16', color: COLORS.lime, x: () => 8 + Math.sqrt(63) },
    ],
  },
  {
    id: 'a7-fusion-diffusion',
    title: 'Classical vs Bohm in a hydrogen plasma',
    equation: 'D_\\perp = \\dfrac{\\eta_\\perp\\, n\\, k(T_e + T_i)}{B^2},\\qquad D_B = \\dfrac{kT_e}{16\\,eB}',
    blurb: 'A fully ionized hydrogen plasma with T_e = T_i. Classical diffusion (from electron–ion collisions, through the resistivity η⊥ ≈ 2η∥) is tiny in a hot, strongly magnetized plasma. If transport really were Bohm-like, a hot plasma would leak out many orders of magnitude faster and fusion would be hopeless. Measured transport in tokamaks sits between the two. The classical line assumes ω_cτ ≫ 1, true everywhere on this plot for the default values.',
    x: { label: 'B (T)', min: 0.01, max: 10, log: true },
    y: { label: 'D (m²/s)', min: 1e-7, max: 1e5, log: true },
    params: [
      { key: 'n', label: 'Density', min: 1e16, max: 1e22, value: 1e20, log: true, unit: 'm⁻³' },
      { key: 'T', label: 'Temperature T_e = T_i', min: 1, max: 3e4, value: 1000, log: true, unit: 'eV' },
    ],
    curves: [
      { label: 'classical D⊥', color: COLORS.cyan, fn: (B, p) => classicalDperp(p.n, p.T, p.T, B, coulombLog(p.n, p.T)) },
      { label: 'Bohm D_B', color: COLORS.magenta, fn: (B, p) => bohmD(p.T, B) },
    ],
  },
  {
    id: 'a7-spitzer',
    title: 'Spitzer resistivity vs electron temperature',
    equation: '\\eta_\\parallel \\approx 5.2\\times10^{-5}\\,\\dfrac{Z\\ln\\Lambda}{T_{eV}^{3/2}}\\ \\Omega\\,\\text{m}',
    blurb: 'Fast electrons barely feel the Coulomb field of an ion, so collisions fade as the −3/2 power of temperature and a hot plasma conducts better and better. The density cancels out: more carriers, but proportionally more collisions. Near 1 keV a hydrogen plasma conducts about as well as copper; at 10 keV it is roughly twenty times better. The dashed line is η⊥, the resistivity for current across B, about twice η∥. The Z slider uses the simple linear scaling; the true Z dependence is somewhat weaker.',
    x: { label: 'electron temperature T_e (eV)', min: 1, max: 1e5, log: true },
    y: { label: 'η (Ω·m)', min: 1e-10, max: 1e-2, log: true },
    params: [
      { key: 'lnL', label: 'Coulomb logarithm lnΛ', min: 5, max: 25, value: 15, step: 0.5 },
      { key: 'Z', label: 'Ion charge Z', min: 1, max: 10, value: 1, step: 1 },
    ],
    curves: [
      { label: 'η∥ (Spitzer)', color: COLORS.cyan, fn: (T, p) => spitzerPar(T, p.lnL, p.Z) },
      { label: 'η⊥ (Z = 1)', color: COLORS.violet, dashed: true, fn: (T, p) => spitzerPerp(T, p.lnL) },
    ],
    markers: [{ label: 'copper at room temperature, 1.7×10⁻⁸', color: COLORS.amber, y: () => 1.68e-8 }],
  },
  {
    id: 'a7-diffusion-decay',
    title: 'A plasma slab decaying by diffusion',
    equation: 'n(x,t) = \\sum_{m\\ \\text{odd}} \\dfrac{4}{m\\pi}(-1)^{\\frac{m-1}{2}} \\cos\\dfrac{m\\pi x}{L}\\, e^{-m^2 t/\\tau_1},\\qquad \\tau_1 = \\dfrac{(L/\\pi)^2}{D}',
    blurb: 'The plasma starts uniform between two walls that absorb it (n = 0 at x = ±L/2). The sharp corners are made of high-order modes, which decay m² times faster than the lowest one. Slide the time: by about 0.3 τ₁ only the smooth cosine is left (to within 3%), and after that the whole profile just shrinks exponentially with time constant τ₁.',
    x: { label: 'x / L', min: -0.5, max: 0.5 },
    y: { label: 'n / n₀', min: 0, max: 1.3 },
    params: [{ key: 't', label: 'Time t / τ₁', min: 0.0005, max: 3, value: 0.005, log: true }],
    curves: [
      { label: 'n(x, t)', color: COLORS.cyan, fn: (x, p) => slabProfile(x, p.t) },
      { label: 'lowest mode alone', color: COLORS.magenta, dashed: true, fn: (x, p) => (4 / Math.PI) * Math.cos(Math.PI * x) * Math.exp(-p.t) },
    ],
  },
]
