// B9 plotter presets: the safe region for Δx and Δt, leapfrog accuracy and instability, particle noise vs particles
// per cell, and the cost of PIC and Vlasov codes in 1, 2 and 3 dimensions.
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { leapfrogGrowth, leapfrogRatio, MEC2_KEV, noiseRatio } from '../physics/emPic'

/** ω_peΔt of an electromagnetic code with cΔt = ν Δx, at a given Δx/λ_De: ω_peΔt = ν (Δx/λ_De)(v_te/c). */
const emStep = (r: number, TkeV: number, courant: number) => courant * r * Math.sqrt(TkeV / MEC2_KEV)

export const PLOTS: PlotSpec[] = [
  {
    id: 'b9-resolution',
    title: 'Where an electromagnetic PIC run is safe',
    equation: '\\begin{gathered}\\omega_{pe}\\Delta t = \\nu\\,\\dfrac{\\Delta x}{\\lambda_{De}}\\,\\dfrac{v_{te}}{c} \\\\ \\nu = \\dfrac{c\\Delta t}{\\Delta x} \\le 1,\\ \\tfrac{1}{\\sqrt2},\\ \\tfrac{1}{\\sqrt3}\\end{gathered}',
    blurb: 'Every PIC run is a point on this map: cell size against Debye length across, time step against the plasma period up. Above ω_peΔt = 2 (red) leapfrog is unstable; above about 0.2 (amber) its error in the plasma frequency passes 0.2% and climbs fast (4.7% at 1). Far to the right of Δx = λ_De (lime) the grid heats the plasma by itself (in this lesson’s code, slowly at Δx = 4λ_De and fast at 8). In an electromagnetic code the time step is not free: light must not cross more than a cell per step (the Courant condition), so ω_peΔt is tied to Δx by v_te/c. The cyan line is a 1D code at cΔt = Δx, the magenta dashed line a 3D Yee code at cΔt = Δx/√3. Because v_te ≪ c, any run that resolves λ_De sits far below the leapfrog limit: for laser–plasma runs the cost comes from resolving space, not the plasma period. Lower T_e and λ_De shrinks, so the same Δx moves right.',
    x: { label: 'Δx / λ_De', min: 0.1, max: 100, log: true },
    y: { label: 'ω_pe Δt', min: 1e-3, max: 10, log: true },
    params: [{ key: 'T', label: 'Electron temperature', min: 0.05, max: 20, value: 2, log: true, unit: 'keV' }],
    curves: [
      { label: '1D EM code, cΔt = Δx', color: COLORS.cyan, fn: (r, p) => emStep(r, p.T, 1) },
      { label: '3D Yee code, cΔt = Δx/√3', color: COLORS.magenta, dashed: true, fn: (r, p) => emStep(r, p.T, 1 / Math.sqrt(3)) },
    ],
    markers: [
      { label: 'ω_peΔt = 2', color: COLORS.red, y: () => 2 },
      { label: 'ω_peΔt = 0.2', color: COLORS.amber, y: () => 0.2 },
      { label: 'Δx = λ_De', color: COLORS.lime, x: () => 1 },
    ],
  },
  {
    id: 'b9-leapfrog',
    title: 'Leapfrog: frequency error and instability',
    equation: '\\sin\\dfrac{\\omega\\Delta t}{2} = \\dfrac{\\omega_{pe}\\Delta t}{2}',
    blurb: 'A plasma oscillation advanced with leapfrog. Below ω_peΔt = 2 the oscillation is exactly undamped (leapfrog is time-reversible) but runs fast: the cyan curve is the relative frequency error, which the dashed violet line ω_pe²Δt²/24 matches at small steps. It is 0.17% at ω_peΔt = 0.2 and 4.7% at 1. At ω_peΔt = 2 the frequency locks to the Nyquist frequency π/Δt, and above it the oscillation grows every step (magenta, growth rate in units of ω_pe): the code explodes. The oscillation mode of the lesson’s test sim shows both.',
    x: { label: 'ω_pe Δt', min: 0.01, max: 3, log: true },
    y: { label: 'error, growth rate / ω_pe', min: 1e-6, max: 3, log: true },
    params: [],
    curves: [
      {
        label: 'frequency error ω/ω_pe − 1',
        color: COLORS.cyan,
        fn: (x) => {
          const err = x < 2 ? leapfrogRatio(x) - 1 : NaN
          return err > 0 ? err : NaN
        },
      },
      { label: 'small-step estimate ω_pe²Δt²/24', color: COLORS.violet, dashed: true, fn: (x) => (x * x) / 24 },
      { label: 'growth rate above 2 (per ω_pe⁻¹)', color: COLORS.magenta, fn: (x) => (x > 2 ? leapfrogGrowth(x) : NaN) },
    ],
    markers: [
      { label: '0.2', color: COLORS.amber, x: () => 0.2 },
      { label: 'stability limit 2', color: COLORS.red, x: () => 2 },
    ],
  },
  {
    id: 'b9-noise',
    title: 'Particle noise vs particles per cell',
    equation: '\\begin{gathered}\\dfrac{W_E}{W_K} \\approx \\dfrac{1}{\\pi N_\\lambda}\\arctan\\dfrac{\\pi\\lambda_{De}}{\\Delta x} \\\\ \\to \\dfrac{1}{2N_\\lambda}\\ \\text{for}\\ \\Delta x \\ll \\lambda_{De}\\end{gathered}',
    blurb: 'A thermal 1D plasma made of a finite number of macroparticles fills every grid mode with random electric field. The cyan curve is the energy in that field over the electrons’ kinetic energy for point particles, summed over all modes the grid holds; N_λ = ppc·λ_De/Δx is the number of particles per Debye length. The violet curve uses cloud-in-cell particles, which smooth the shortest modes away and so are quieter (the test sim measures this curve to about 5%). Both fall as 1/ppc, so the noise amplitude, like the density noise in one cell (amber, 1/√ppc), falls only as the square root: four times the particles for half the noise. A laser corona at 0.1 n_c and 2 keV has about 5000 electrons in a Debye sphere, each carrying a single electron charge, so it is much quieter than an affordable simulation.',
    x: { label: 'particles per cell', min: 1, max: 1e4, log: true },
    y: { label: 'W_E/W_K and δn/n', min: 1e-5, max: 1, log: true },
    params: [{ key: 'r', label: 'Cell size Δx/λ_De', min: 0.1, max: 8, value: 1, log: true }],
    curves: [
      { label: 'W_E/W_K, point particles', color: COLORS.cyan, fn: (q, p) => noiseRatio(q, p.r, false) },
      { label: 'W_E/W_K, cloud-in-cell', color: COLORS.violet, fn: (q, p) => noiseRatio(q, p.r, true) },
      { label: 'density noise in one cell, 1/√ppc', color: COLORS.amber, dashed: true, fn: (q) => 1 / Math.sqrt(q) },
    ],
    markers: [{ label: 'flagship: 32 per cell', color: COLORS.lime, x: () => 32 }],
  },
  {
    id: 'b9-cost',
    title: 'The cost of PIC and Vlasov codes',
    equation: '\\begin{gathered}N_{\\rm PIC} = N_{\\rm ppc}\\,N_x^{\\,d} \\\\ N_{\\rm Vlasov} = N_x^{\\,d}\\,N_v^{\\,d}\\end{gathered}',
    blurb: 'The number of unknowns a code advances every step, for N_x grid points per spatial dimension. PIC (solid) stores ppc particles per cell; a Vlasov code (dashed) stores f on a grid with N_v points per velocity dimension, so each spatial dimension also adds a velocity dimension. In 1D1V the Vlasov grid is affordable and noise-free, which is why it is the tool of choice for clean studies of trapping and Landau damping. Each added dimension multiplies its cost by N_x N_v, against N_x for PIC, so in 3D3V a Vlasov code needs something like N_v³ ≈ 10⁶ unknowns per cell where PIC gets by with tens of particles. That is why large 2D and 3D laser–plasma runs are almost all PIC. Work per unknown differs between codes, so read this as a scaling, not a timing.',
    x: { label: 'grid points per dimension N_x', min: 10, max: 1e4, log: true },
    y: { label: 'unknowns per step', min: 1e2, max: 1e24, log: true },
    params: [
      { key: 'ppc', label: 'Particles per cell (PIC)', min: 1, max: 1000, value: 64, log: true },
      { key: 'nv', label: 'Velocity points per dimension (Vlasov)', min: 16, max: 1024, value: 128, log: true },
    ],
    curves: [
      { label: 'PIC 1D', color: COLORS.cyan, fn: (n, p) => p.ppc * n },
      { label: 'PIC 2D', color: COLORS.violet, fn: (n, p) => p.ppc * n * n },
      { label: 'PIC 3D', color: COLORS.magenta, fn: (n, p) => p.ppc * n ** 3 },
      { label: 'Vlasov 1D1V', color: COLORS.cyan, dashed: true, fn: (n, p) => n * p.nv },
      { label: 'Vlasov 2D2V', color: COLORS.violet, dashed: true, fn: (n, p) => (n * p.nv) ** 2 },
      { label: 'Vlasov 3D3V', color: COLORS.magenta, dashed: true, fn: (n, p) => (n * p.nv) ** 3 },
    ],
    markers: [{ label: 'flagship sim: 650 cells', color: COLORS.lime, x: () => 650 }],
  },
]
