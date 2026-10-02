import { Eq } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { PicSrsSim } from '../sims/PicSrsSim'
import { PicTestsSim } from '../sims/PicTestsSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 27 }
const subText = { fontFamily: '"PT Sans", sans-serif', fontSize: 23 }

/** The PIC loop: push, deposit, field solve, gather; in the middle, a cloud-in-cell particle sharing its charge. */
function PicCycleDiagram() {
  const box = (x: number, y: number, title: string, sub: string, color: string) => (
    <g>
      <rect x={x} y={y} width={250} height={84} rx={12} fill="#0b1426" stroke={color} strokeWidth={2.5} />
      <text x={x + 125} y={y + 36} textAnchor="middle" fill="#e8eaf6" style={{ ...svgText, fontWeight: 700 }}>
        {title}
      </text>
      <text x={x + 125} y={y + 66} textAnchor="middle" fill="#9aa0c9" style={subText}>
        {sub}
      </text>
    </g>
  )
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22d3ee" strokeWidth={3} markerEnd="url(#b9-head)" />
  )
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg
        viewBox="-4 0 708 390"
        style={{ width: '100%', maxWidth: 620, display: 'block', margin: '0 auto' }}
        role="img"
        aria-label="The particle-in-cell loop: push the particles, deposit their charge and current on the grid, solve the field equations on the grid, gather the fields back to the particles, and repeat every time step"
      >
        <defs>
          <marker id="b9-head" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#22d3ee" />
          </marker>
        </defs>
        {box(225, 6, '1 · Push', 'advance x and u', '#fbbf24')}
        {box(450, 153, '2 · Deposit', 'ρ and J onto the grid', '#4ade80')}
        {box(225, 300, '3 · Field solve', 'Maxwell on the grid', '#22d3ee')}
        {box(0, 153, '4 · Gather', 'E, B to the particles', '#f472b6')}
        {arrow(478, 60, 570, 147)}
        {arrow(570, 243, 478, 330)}
        {arrow(222, 330, 130, 243)}
        {arrow(130, 147, 222, 60)}
        <text x={350} y={128} textAnchor="middle" fill="#9aa0c9" style={subText}>
          every Δt
        </text>
        {/* a cloud-in-cell particle a quarter cell past node j */}
        <line x1={280} y1={238} x2={420} y2={238} stroke="#314c72" strokeWidth={3} />
        {[300, 350, 400].map((x) => (
          <line key={x} x1={x} y1={228} x2={x} y2={248} stroke="#9aa0c9" strokeWidth={3} />
        ))}
        <rect x={337.5} y={180} width={50} height={22} fill="#fbbf24" opacity={0.3} rx={3} />
        <circle cx={362.5} cy={191} r={6} fill="#fbbf24" />
        <line x1={362.5} y1={198} x2={351} y2={227} stroke="#4ade80" strokeWidth={2} />
        <line x1={362.5} y1={198} x2={399} y2={227} stroke="#4ade80" strokeWidth={2} />
        <text x={346} y={220} textAnchor="end" fill="#4ade80" style={subText}>
          ¾
        </text>
        <text x={394} y={210} textAnchor="start" fill="#4ade80" style={subText}>
          ¼
        </text>
        <text x={350} y={274} textAnchor="middle" fill="#9aa0c9" style={subText}>
          j
        </text>
        <text x={400} y={274} textAnchor="middle" fill="#9aa0c9" style={subText}>
          j+1
        </text>
        <text x={362} y={170} textAnchor="middle" fill="#fbbf24" style={subText}>
          macroparticle
        </text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        One time step of a particle-in-cell code. The particles never interact directly; they talk only through the grid. In the middle, a
        cloud-in-cell macroparticle (amber, one cell wide) a quarter of a cell past node j gives ¾ of its charge to node j and ¼ to node j+1, and
        it reads the field back from the same two nodes with the same weights.
      </figcaption>
    </figure>
  )
}

export const B9: Lesson = {
  id: 'B9',
  title: 'Simulation methods',
  subtitle: 'Particle-in-cell and Vlasov codes: the PIC loop, resolution and noise, light in a 1D code, and a Raman simulation you run yourself',
  minutes: 60,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 2 (computer simulation of plasmas using particle codes) and Ch. 11 (nonlinear features of underdense plasma instabilities, much of it learned from simulations)',
    'C. K. Birdsall and A. B. Langdon, Plasma Physics via Computer Simulation (McGraw-Hill 1985; IOP 1991): leapfrog, particle shapes, grid heating and 1D electromagnetic programs',
    'R. W. Hockney and J. W. Eastwood, Computer Simulation Using Particles (McGraw-Hill 1981; IOP 1988)',
    'J. M. Dawson, Particle simulation of plasmas, Rev. Mod. Phys. 55, 403 (1983)',
    'A. B. Langdon and B. F. Lasinski, Electromagnetic and relativistic plasma simulation models, Methods in Computational Physics 16 (1976)',
  ],
  objectives: [
    'Explain the PIC loop (push, deposit, field solve, gather) and choose $\\Delta x$, $\\Delta t$ and the particles per cell from $\\Delta x \\lesssim \\lambda_{De}$, $\\omega_{pe}\\Delta t \\lesssim 0.2$, the Courant condition and the $1/\\sqrt{N}$ noise law',
    'Derive leapfrog stability ($\\omega_{pe}\\Delta t < 2$) and the 1D electromagnetic scheme along the characteristics of $F_\\pm = (E_y \\pm cB_z)/2$, and test a code against exact results: light speed, Gauss’s law and the canonical momentum $p_y + qA_y$',
    'Run a 1D PIC simulation of stimulated Raman scattering, compare its spectrum and growth with B6, check convergence, and say what simulations taught about saturation and hot electrons, and when a Vlasov code is the better tool',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'loop', label: 'The PIC loop' },
    { id: 'leapfrog', label: 'Time steps' },
    { id: 'grid', label: 'Resolution' },
    { id: 'noise', label: 'Noise' },
    { id: 'light', label: 'Light in 1D' },
    { id: 'tests', label: 'Testing a code' },
    { id: 'raman', label: 'Your Raman run' },
    { id: 'vlasov', label: 'Vlasov codes' },
    { id: 'taught', label: 'What codes taught' },
    { id: 'practice', label: 'Codes today' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          A laser corona at 10²¹ cm⁻³ holds a billion electrons in every cubic micrometre. Each one feels the laser, the ions and the fields of all
          the others. The theory in this track never followed them all: we linearized, averaged over the quiver motion, or kept three waves and
          dropped the rest. Those shortcuts fail exactly where the physics gets interesting, when a plasma wave traps electrons, breaks, or hands
          its energy to a hot tail. The honest way forward is to let a computer move the charges and watch what happens.
        </p>
        <p>
          A <strong>particle-in-cell (PIC)</strong> code makes this affordable with two tricks. First, it samples. Each macroparticle stands for a
          large number of real electrons moving together; it carries their total charge and mass, so its charge-to-mass ratio is that of one
          electron and it follows exactly the orbit a real electron would. Second, particles never interact directly. They deposit their charge
          and current on a grid, the grid solves Maxwell’s equations, and each particle reads the fields back from the grid. The work grows in
          proportion to the number of particles, not its square.
        </p>
        <PicCycleDiagram />
        <p>
          You have been running PIC codes since A1: the plasma oscillation there, the Bohm–Gross points of A5 and the two-stream instability of A8
          were all electrostatic PIC. Kruer gives these codes his second chapter because many of the nonlinear results in his book were first seen
          in simulations. This lesson opens the box: how the loop works, what limits the cell size and the time step, why simulated plasmas are
          noisy, how light gets into a 1D code, and how to tell physics from artefacts. Then you run a simulation of stimulated Raman scattering
          yourself.
        </p>
      </section>

      <section id="loop">
        <h2>The PIC loop</h2>
        <p>
          A macroparticle is a small cloud of charge rather than a point. In the cloud-in-cell scheme used here the cloud is one cell wide, so it
          shares its charge between the two nearest grid nodes in proportion to how much of it overlaps each. The field goes back to the particle
          with the same weights. Using the same shape both ways matters: it guarantees that a particle exerts no net force on itself and that the
          electric forces conserve total momentum.
        </p>
        <Eq
          title="Deposit and gather"
          src="\begin{gathered}\s{rho}{\rho_j} = \dfrac{1}{\s{dx}{\Delta x}}\sum_p \s{q}{q_p}\,\s{S}{S}(\s{X}{X_j} - \s{xp}{x_p}) \\ \s{E}{E}(x_p) = \sum_j E_j\,S(X_j - x_p)\end{gathered}"
          symbols={{
            rho: { name: 'ρ_j, charge density at grid node j', units: 'C/m³ (per unit area in 1D)', note: 'The current density J_j is deposited the same way, with q_p v_p in place of q_p.' },
            dx: { name: 'Δx, cell size', units: 'm', note: 'Must resolve the Debye length and the laser wavelength (see Resolution).' },
            q: { name: 'q_p, macroparticle charge', units: 'C', note: 'The charge of all the electrons it represents. Its mass is scaled by the same factor, so q/m is that of one electron.' },
            S: { name: 'S, particle shape (weighting function)', note: 'Cloud-in-cell: S(ξ) = 1 − |ξ|/Δx for |ξ| < Δx, zero beyond. Higher-order shapes are smoother and quieter but cost more.' },
            X: { name: 'X_j = jΔx, position of node j', units: 'm', note: 'Fields and densities live only on the grid.' },
            xp: { name: 'x_p, position of particle p', units: 'm', note: 'Particles move anywhere; they are not tied to the grid.' },
            E: { name: 'E, electric field', units: 'V/m', note: 'Interpolated from the grid to each particle with the same shape S, which removes the self-force.' },
          }}
          says="Each particle spreads its charge over the nearest grid points, the fields are solved on the grid, and each particle feels the field averaged over the same patch of grid it charged."
        />
        <p>
          Finite size is also a filter. A point charge on a grid makes a field that jumps whenever it crosses a node, and the shortest
          fluctuations alias onto long waves. Clouds keep the collective physics (shielding, plasma waves with kλ_De &lt; 1) and soften close
          encounters: two macroparticles that pass within a cell barely deflect each other. A PIC plasma is therefore nearly collisionless by
          construction, which suits the hot coronas of this track. Collisions (B2) can be added as a separate Monte Carlo step.
        </p>
      </section>

      <section id="leapfrog">
        <h2>Time steps</h2>
        <p>
          The particle push is <strong>leapfrog</strong>. Positions live at whole steps and velocities half a step off, and each is updated using
          the other at the midpoint of its step. That makes the scheme second-order accurate and time-reversible, with one force evaluation per
          step. Its limit shows up on the fastest motion in the plasma, the plasma oscillation.
        </p>
        <Derivation
          lessonId="B9"
          id="leapfrog-stability"
          title="Leapfrog on a plasma oscillation"
          steps={[
            {
              text: 'An electron sheet displaced by x feels a restoring field (A1), so x″ = −ω_pe²x. Leapfrog stores x at whole steps and v at half steps.',
              math: '\\begin{gathered}v^{n+1/2} = v^{n-1/2} - \\omega_{pe}^2\\Delta t\\,x^n \\\\ x^{n+1} = x^n + \\Delta t\\,v^{n+1/2}\\end{gathered}',
              why: 'Each update uses the other variable at the centre of its own step, so both are centred in time: second-order accurate, and running it backwards retraces the path exactly.',
            },
            {
              text: 'Eliminate v by subtracting the position update for step n from the one for step n+1.',
              math: 'x^{n+1} - 2x^n + x^{n-1} = -\\omega_{pe}^2\\Delta t^2\\,x^n',
              why: 'The left side is the centred second difference, which is Δt² x″ to second order in Δt.',
            },
            {
              text: 'Try a geometric solution x^n = λⁿ.',
              math: '\\lambda + \\frac{1}{\\lambda} = 2 - \\omega_{pe}^2\\Delta t^2',
              why: 'A linear recursion with constant coefficients is solved by powers, as a linear differential equation is solved by exponentials.',
            },
            {
              text: 'The two roots multiply to 1. While the right side lies between −2 and 2 they are complex, λ = e^{±iΩΔt} with |λ| = 1: an undamped oscillation at the code’s own frequency Ω.',
              math: '\\begin{gathered}\\cos\\Omega\\Delta t = 1 - \\frac{\\omega_{pe}^2\\Delta t^2}{2} \\\\ \\Longrightarrow\\quad \\sin\\frac{\\Omega\\Delta t}{2} = \\frac{\\omega_{pe}\\Delta t}{2}\\end{gathered}',
              why: 'Use 1 − cos θ = 2 sin²(θ/2). |λ| = 1 means leapfrog adds no numerical damping and no growth.',
            },
            {
              text: 'This needs ω_peΔt ≤ 2. Beyond it the right side is below −2, the roots are real and negative, and one of them has |λ| > 1: the displacement flips sign and grows every step.',
              math: '\\begin{gathered}\\omega_{pe}\\Delta t > 2: \\\\ |\\lambda| = \\frac{b + \\sqrt{b^2 - 4}}{2},\\quad b = \\omega_{pe}^2\\Delta t^2 - 2\\end{gathered}',
              why: 'At ω_peΔt = 2.2, |λ| = 2.43: the oscillation grows by a factor 2.4 per step and the code blows up within a few dozen steps.',
            },
            {
              text: 'Below the limit, expand for small steps: the code’s plasma frequency comes out slightly high.',
              math: '\\begin{gathered}\\frac{\\Omega}{\\omega_{pe}} = \\frac{2}{\\omega_{pe}\\Delta t}\\arcsin\\frac{\\omega_{pe}\\Delta t}{2} \\\\ \\approx 1 + \\frac{\\omega_{pe}^2\\Delta t^2}{24}\\end{gathered}',
              why: 'arcsin z ≈ z + z³/6. The error is 0.17% at ω_peΔt = 0.2, 1.1% at 0.5 and 4.7% at 1, hence the rule ω_peΔt ≲ 0.2.',
            },
          ]}
        />
        <Eq
          title="Leapfrog frequency"
          src="\begin{gathered}\sin\dfrac{\s{W}{\Omega}\,\s{dt}{\Delta t}}{2} = \dfrac{\s{wp}{\omega_{pe}}\,\Delta t}{2} \\ \dfrac{\Omega}{\omega_{pe}} - 1 \approx \dfrac{\omega_{pe}^2\,\Delta t^2}{24}\end{gathered}"
          plot="b9-leapfrog"
          symbols={{
            W: { name: 'Ω, the code’s oscillation frequency', units: 'rad/s', note: 'Real and undamped for ω_peΔt ≤ 2. Above 2 there is no real Ω: the mode grows.' },
            dt: { name: 'Δt, time step', units: 's', note: 'In an electromagnetic code it is also tied to the cell size by the Courant condition.' },
            wp: { name: 'ω_pe, electron plasma frequency', units: 'rad/s', note: 'ω_pe = √(ne²/ε₀m_e); ω_pe/ω₀ = √(n/n_c) for a laser of frequency ω₀.' },
          }}
          says="Leapfrog never damps a plasma oscillation, but it runs it a little fast, by ω_pe²Δt²/24, and above ω_peΔt = 2 it runs away altogether."
        />
        <p>
          With a magnetic field the velocity update needs one more idea, the <strong>Boris push</strong>: half the electric kick, a rotation of the
          velocity about B by the angle the particle gyrates through in Δt, then the other half kick. The rotation keeps the speed fixed exactly,
          so a particle in a pure magnetic field gyrates indefinitely without gaining or losing energy. In its relativistic form (it pushes
          u = γv/c and evaluates γ between the kicks) it is the standard push of laser–plasma codes. The orbit sims of A2 use it, and so do the
          sims below.
        </p>
      </section>

      <section id="grid">
        <h2>Cell size and time step</h2>
        <p>
          Four scales set the grid. The cell must resolve the Debye length, Δx ≲ λ_De; otherwise the grid cannot represent the shielding cloud,
          short fluctuations alias onto long ones, and a plasma at rest heats itself. This <strong>grid heating</strong> (the finite-grid
          instability) is a pure artefact. The time step must resolve the plasma period: ω_peΔt ≲ 0.2 for accuracy, below 2 for stability. In an
          electromagnetic code, light must not cross more than a cell per step (the Courant condition; cΔt ≤ Δx/√d for the standard Yee solver
          of A6 in d dimensions). And a laser code must resolve the laser itself, typically with 20–30 or more cells per wavelength.
        </p>
        <Eq
          title="Resolution rules"
          src="\begin{gathered}\s{dx}{\Delta x} \lesssim \s{lD}{\lambda_{De}},\qquad \s{wp}{\omega_{pe}}\s{dt}{\Delta t} \lesssim 0.2 \\ \s{c}{c}\,\Delta t \le \dfrac{\Delta x}{\sqrt{\s{d}{d}}},\qquad \Delta x \lesssim \dfrac{\s{lam}{\lambda_0}}{20\text{–}30}\end{gathered}"
          plot="b9-resolution"
          symbols={{
            dx: { name: 'Δx, cell size', units: 'm', note: 'The most expensive choice: halving it doubles the cells per dimension and, through the Courant condition, the number of steps.' },
            lD: { name: 'λ_De, electron Debye length', units: 'm', note: 'λ_De = v_te/ω_pe = √(ε₀T_e/ne²) with v_te² = T_e/m_e. About 11 nm at 0.1 n_c (351 nm light) and 2 keV.' },
            wp: { name: 'ω_pe, electron plasma frequency', units: 'rad/s', note: 'ω_pe/ω₀ = √(n/n_c).' },
            dt: { name: 'Δt, time step', units: 's', note: 'Leapfrog is stable for ω_peΔt < 2 and accurate to 0.17% at 0.2.' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'The Courant condition: nothing on the grid can move faster than one cell per step.' },
            d: { name: 'd, number of spatial dimensions', note: 'cΔt ≤ Δx, Δx/√2, Δx/√3 for a Yee solver on square cells in 1D, 2D and 3D.' },
            lam: { name: 'λ₀, laser wavelength', units: 'm', note: 'On coarser grids light travels at the wrong speed (numerical dispersion), which detunes the matching conditions of B5.' },
          }}
          says="Resolve the Debye length in space, the plasma period and the light crossing of a cell in time, and the laser wavelength with tens of cells."
        />
        <p>
          In a laser corona these rules collapse into one. At 0.1 n_c of 351 nm light and T_e = 2 keV, λ_De = 11 nm, which is λ₀/32: a cell of
          one Debye length already gives 32 cells per laser wavelength. With cΔt = Δx the step is 37 attoseconds and ω_peΔt = v_te/c = 0.063, far
          inside the leapfrog limit. In an electromagnetic code the light sets the time step, and the cost of a run comes from resolving λ_De in
          space for picoseconds: about 270,000 steps for 10 ps.
        </p>
        <Plotter spec={plotById('b9-resolution')!} />
        <p>
          The test sim further down measures the heating directly. With 64 particles per cell the temperature of a plasma at rest rises 3% in
          400 ω_pe⁻¹ at Δx = 2λ_De, 16% at 4λ_De, and nearly triples at 8λ_De. More particles slow the heating but do not cure it: at 8λ_De with
          256 per cell the temperature still more than doubles in the same time.
        </p>
      </section>

      <section id="noise">
        <h2>Particle noise</h2>
        <p>
          A simulation has far fewer particles than the plasma it models, so it is noisier. In thermal equilibrium every long-wavelength mode of the
          field behaves like an oscillator holding about T/2 of energy, however many particles there are, while each particle holds T/2 of kinetic
          energy per direction. So the ratio of field to kinetic energy is roughly the number of field modes with kλ_De ≲ 1 divided by the number
          of particles. In 1D there are about L/πλ_De such modes in a length L, against nL particles.
        </p>
        <Eq
          title="Thermal noise in a 1D code"
          src="\begin{gathered}\dfrac{\s{WE}{W_E}}{\s{WK}{W_K}} \approx \dfrac{1}{\pi\,\s{N}{N_\lambda}}\arctan\dfrac{\pi\,\s{lD}{\lambda_{De}}}{\s{dx}{\Delta x}} \\ N_\lambda = \s{ppc}{N_{\rm ppc}}\,\dfrac{\lambda_{De}}{\Delta x}\end{gathered}"
          plot="b9-noise"
          symbols={{
            WE: { name: 'W_E, energy in the fluctuating electric field', units: 'J', note: 'Summed over every mode the grid holds, up to k = π/Δx.' },
            WK: { name: 'W_K, electron kinetic energy along x', units: 'J', note: 'NT_e/2 for N electrons in 1D.' },
            N: { name: 'N_λ, particles per Debye length', note: 'The 1D plasma parameter of the simulation. For Δx ≪ λ_De the ratio tends to 1/(2N_λ).' },
            lD: { name: 'λ_De, Debye length', units: 'm', note: 'Modes longer than λ_De are collective oscillations holding about T/2 each; shorter ones are shielded and hold less.' },
            dx: { name: 'Δx, cell size', units: 'm', note: 'The grid holds no mode shorter than 2Δx, which caps the sum.' },
            ppc: { name: 'N_ppc, particles per cell', note: 'Point particles give this formula; cloud-in-cell shapes smooth the shortest modes and are about 15% quieter at Δx = λ_De.' },
          }}
          says="The field noise energy falls as one over the number of particles per Debye length, so its amplitude falls only as one over the square root: four times the particles buys half the noise."
        />
        <p>
          The flagship sim below runs 32 particles per cell at Δx ≈ λ_De, so W_E/W_K ≈ 1%. Why is a real plasma so much quieter? Its particles are
          single electrons. A corona at 0.1 n_c and 2 keV has about 5000 electrons in each Debye sphere. A 3D simulation of it with cells of λ₀/30
          and 8 particles per cell has about 28 macroparticles per Debye sphere, each standing for about 180 electrons, so its fluctuation energy is
          roughly 180 times higher.
        </p>
        <p>
          For collective physics that is usually acceptable: plasma waves and instabilities depend on the many particles in a Debye sphere, not on
          individual ones. But noise starts instabilities from a higher level, scatters particles like extra collisions, and drives the grid
          heating above. A careful run checks that its answer does not change when the number of particles is doubled.
        </p>
        <Plotter spec={plotById('b9-noise')!} />
      </section>

      <section id="light">
        <h2>Light in one dimension</h2>
        <p>
          The codes of A1, A5 and A8 solve only Gauss’s law. A laser code must also carry light. In 1D, with the laser travelling along x and
          polarized along y, only E_y and B_z carry the light, and there is a neat trick: split them into the light moving right and the light
          moving left, and move each along its own light rays.
        </p>
        <Derivation
          lessonId="B9"
          id="em-characteristics"
          title="A 1D light solver with no numerical dispersion"
          steps={[
            {
              text: 'In 1D everything depends only on x and t. For light polarized along y, Ampère’s and Faraday’s laws couple only E_y and B_z.',
              math: '\\begin{gathered}\\frac{\\partial E_y}{\\partial t} = -c^2\\frac{\\partial B_z}{\\partial x} - \\frac{J_y}{\\varepsilon_0} \\\\ \\frac{\\partial B_z}{\\partial t} = -\\frac{\\partial E_y}{\\partial x}\\end{gathered}',
              why: 'These are the y component of ∇×B = μ₀J + c⁻²∂E/∂t and the z component of ∇×E = −∂B/∂t, with ∂/∂y = ∂/∂z = 0 and c²μ₀ = 1/ε₀.',
            },
            {
              text: 'Add and subtract c times the second equation. The combinations F± obey one-way wave equations.',
              math: '\\begin{gathered}F_\\pm = \\frac{E_y \\pm cB_z}{2} \\\\ \\Big(\\frac{\\partial}{\\partial t} \\pm c\\,\\frac{\\partial}{\\partial x}\\Big)F_\\pm = -\\frac{J_y}{2\\varepsilon_0}\\end{gathered}',
              why: 'A vacuum wave moving to +x has E_y = cB_z, so it lives entirely in F₊; a wave moving to −x has E_y = −cB_z and lives in F₋.',
            },
            {
              text: 'Each left side is a derivative along a light ray: F₊ along x = x₀ + ct, F₋ along x = x₀ − ct. Along its ray, F₊ changes only where there is current.',
              math: '\\frac{dF_+}{dt}\\Big|_{x = x_0 + ct} = -\\frac{J_y}{2\\varepsilon_0}',
              why: 'This is the method of characteristics. In vacuum F₊ is constant along each ray: the wave keeps its shape and moves at c.',
            },
            {
              text: 'Choose cΔt = Δx. A ray that starts on a node lands exactly on the next node one step later, so each update is a shift by one cell plus the current met on the way.',
              math: '\\begin{gathered}F_{+,\\,j+1}^{\\,n+1} = F_{+,\\,j}^{\\,n} - \\frac{\\Delta t}{2\\varepsilon_0}J_{y,\\,j+1/2}^{\\,n+1/2} \\\\ F_{-,\\,j}^{\\,n+1} = F_{-,\\,j+1}^{\\,n} - \\frac{\\Delta t}{2\\varepsilon_0}J_{y,\\,j+1/2}^{\\,n+1/2}\\end{gathered}',
              why: 'The current is taken at the midpoint of the ray’s path in space and time, so the update is centred. In vacuum it is an exact shift: no numerical dispersion, which the test sim confirms against the Yee solver.',
            },
            {
              text: 'Rebuild the fields, and feed the laser in as F₊ at the left edge.',
              math: '\\begin{gathered}E_y = F_+ + F_-,\\qquad cB_z = F_+ - F_- \\\\ F_{+,\\,0}^{\\,n} = E_{\\rm laser}(t^n)\\end{gathered}',
              why: 'Light reaching an edge simply shifts off the grid, so open boundaries come for free. F₋ at the left edge is the backscattered light, one number per step, ready to Fourier-transform into a spectrum.',
            },
            {
              text: 'The longitudinal field E_x needs no wave solver. Advance it from the current; Gauss’s law then stays true if the current is deposited consistently with the charge.',
              math: '\\begin{gathered}\\frac{\\partial E_x}{\\partial t} = -\\frac{J_x}{\\varepsilon_0}\\quad\\Longrightarrow \\\\ \\frac{\\partial}{\\partial t}\\Big(\\frac{\\partial E_x}{\\partial x} - \\frac{\\rho}{\\varepsilon_0}\\Big) = -\\frac{1}{\\varepsilon_0}\\Big(\\frac{\\partial J_x}{\\partial x} + \\frac{\\partial \\rho}{\\partial t}\\Big) = 0\\end{gathered}',
              why: 'If each particle’s path is split where it crosses a node and its current is deposited piece by piece, the discrete continuity equation holds exactly, and any error in Gauss’s law stays at round-off.',
            },
          ]}
        />
        <p>
          This scheme dates from the early 1D electromagnetic codes (Langdon and Lasinski; Birdsall and Langdon), and it is the one this lesson’s
          sims use, in units where ω₀ = c = 1. The relativistic Boris push then moves each electron in E_x, E_y and B_z together.
        </p>
        <p>
          Because nothing in a 1D code depends on y, the y component of each particle’s canonical momentum is exactly conserved in the continuum.
          The code never needs the vector potential A_y, but it can integrate ∂A_y/∂t = −E_y on the side and check this conservation law, which
          tests the push, the interpolation and the light solver all at once.
        </p>
        <Eq
          title="Two conservation laws for testing a laser code"
          src="\begin{gathered}\s{py}{p_y} + \s{q}{q}\,\s{Ay}{A_y} = \text{const} \\ \s{uy}{u_y} = \s{ay}{a_y}\ \ \text{(electron from rest)} \\ \s{g}{\gamma} - u_x = 1\ \ \text{(vacuum)}\end{gathered}"
          symbols={{
            py: { name: 'p_y, transverse momentum', units: 'kg m/s', note: 'Relativistic: p = γm_ev.' },
            q: { name: 'q, particle charge', units: 'C', note: 'For an electron q = −e, so p_y − eA_y is conserved.' },
            Ay: { name: 'A_y, vector potential of the light', units: 'V s/m', note: 'E_y = −∂A_y/∂t. For a laser the amplitude is A₀ = E₀/ω₀.' },
            uy: { name: 'u_y = p_y/m_ec, normalized transverse momentum', note: 'An electron starting at rest where A_y = 0 has u_y = a_y at every later moment.' },
            ay: { name: 'a_y = eA_y/m_ec, normalized vector potential', note: 'Its peak in a laser is a₀ = eE₀/(m_eω₀c) = v_os/c, Kruer’s quiver speed over c (B1, B4).' },
            g: { name: 'γ, Lorentz factor', note: 'For an electron starting at rest and hit by a plane wave in vacuum, γ − u_x stays at 1. With u_y = a_y this gives u_x = a_y²/2.' },
          }}
          says="An electron in a 1D laser field keeps its transverse canonical momentum, so its transverse momentum simply follows the vector potential; in vacuum it also keeps γ − u_x, which fixes the forward push."
        />
        <p>
          In the lesson’s code the rms error in u_y − a_y is about 0.4% of a₀ at Δx = 0.15 c/ω₀, and it shrinks when the grid is refined. The two
          laws together give the relativistic quiver motion that C1 takes up when a₀ approaches 1.
        </p>
      </section>

      <section id="tests">
        <h2>Testing a code</h2>
        <p>
          Before trusting a code with physics nobody knows, run it on physics everybody knows. Each mode of the sim below compares this lesson’s
          code with an exact result. All of these checks, plus Gauss’s law (held to a relative error below 10⁻¹⁰, even with electrons leaving the
          box), also run as automated benchmarks.
        </p>
        <PicTestsSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>Vacuum pulse.</strong> The characteristic solver moves the pulse exactly one cell per step, at c, to round-off. The Yee
            solver of A6 at cΔt = 0.5Δx with 8 cells per carrier wavelength moves the packet at 0.94c and leaves a ringing tail. Push the Courant
            number to 1 and Yee becomes exact too (in 1D only); add cells per wavelength and the lag shrinks.
          </li>
          <li>
            <strong>Plasma oscillation.</strong> The measured frequency follows the leapfrog formula, 0.17% fast at ω_peΔt = 0.2 and 4.7% at 1.
            Above 2 the trace switches to a log scale and climbs in a straight line, at the growth rate of the derivation.
          </li>
          <li>
            <strong>Light in a plasma.</strong> A light wave travelling through a uniform plasma oscillates at ω² = ω_pe² + c²k² (B1). The code
            matches its own discrete dispersion relation to better than 0.1%, and the continuum to within a few per cent even at coarse resolution. The electron dots ride
            on the dashed line u_y = a_y: canonical momentum at work.
          </li>
          <li>
            <strong>Noise and heating.</strong> The measured W_E/W_K tracks the cloud-in-cell formula; quadruple the particles and it falls
            fourfold. Then raise Δx/λ_D to 8 and watch a plasma with no drive heat itself.
          </li>
        </ul>
      </section>

      <section id="raman">
        <h2>Your own Raman simulation</h2>
        <p>
          Now the real thing. The box is 130 c/ω₀ long (7.3 µm for 351 nm light, about 21 wavelengths) with 650 cells, so Δx = 0.2 c/ω₀ ≈ λ_De at
          the default 0.1 n_c and 2 keV, and cΔt = Δx. A slab 100 c/ω₀ (5.6 µm) long holds about 16,000 electron macroparticles on fixed ions,
          with short ramps at both ends; electrons that reach the walls leave the box. The laser comes in from the left. The reflected light is F₋
          at the left edge, and its Fourier transform is the backscatter spectrum. Each step takes well under a millisecond, so the run animates
          live.
        </p>
        <p>
          One compromise makes it fit in a browser. The default laser has a₀ = 0.08, which is 7×10¹⁶ W/cm² at 351 nm, about 70 times the
          10¹⁵ W/cm² typical of a fusion corona. Convective gain scales as IλL (B6). A real corona builds up its gain over hundreds of micrometres; this slab is a few
          micrometres long and the run lasts about half a picosecond, so the intensity has to make up the difference.
        </p>
        <PicSrsSim />
        <p>
          The benchmarks behind it run as automated tests. In a uniform periodic box at 0.1 n_c, 1 keV and a₀ = 0.05, the plasma wave and the
          backscatter grow at B6’s rate including Landau damping (measured over predicted: 0.96), and the scattered light sits at the matched
          frequency to 0.2% (0.664 against 0.663 ω₀). In an injected slab at 0.15 n_c the backscatter spectrum peaks within 5% of the Raman line,
          and a hot tail appears.
        </p>
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The benchmark.</strong> At the defaults, Bohm–Gross matching predicts ω_s = 0.644 ω₀ (545 nm for a 351 nm laser), kλ_De = 0.30
            and net growth γ = 0.019 ω₀ after Landau damping. The first burst arrives after about 400–600 ω₀⁻¹ and peaks at 0.641 ω₀, half a
            per cent from theory. Watch the phase space during the burst: electrons near the dashed line v_φ = 0.24c are trapped and swirl into
            vortices, and f(u_x) grows a tail. By ω₀t ≈ 1500 about 3% of the electrons are above 4v_te, against 3×10⁻⁵ in a Maxwellian, and the
            electrons leaving the box average about 10 keV.
          </li>
          <li>
            <strong>Bursts.</strong> The reflectivity comes in spikes of up to about 10% and averages 1–2% over the run. Each burst ends as
            trapped electrons drain the plasma wave and pull it out of resonance. Later bursts sit higher, at about 0.66–0.72 ω₀, so by matching
            the plasma wave behind them oscillates below the Bohm–Gross frequency. The likely reason is the distribution that earlier bursts
            flattened near v_φ, which lowers the wave’s frequency (the nonlinear frequency shift of trapping); Raman from the lower-density
            ramps may also contribute.
          </li>
          <li>
            <strong>Landau damping.</strong> Lower the density to 0.05 n_c. Now kλ_De = 0.46, the damping rate (ν = 0.026 ω₀) exceeds the
            undamped growth rate, and nothing comes back during the run: B6’s Landau cut-off, seen in a simulation.
          </li>
          <li>
            <strong>Colder plasma.</strong> At T_e = 1 keV, kλ_De = 0.21 and damping almost vanishes. Bursts reach about 20%, more electrons are
            heated, and those escaping average about 25 keV: a bigger plasma wave traps more electrons and accelerates them harder.
          </li>
          <li>
            <strong>Pump depletion.</strong> At 0.2 n_c (ω_s = 0.535 ω₀) the reflectivity climbs above one half, and at times less than a tenth of
            the laser gets through. Of the laser energy taken out, a fraction ω_s/ω₀ leaves as scattered light and the rest goes into the plasma
            wave (Manley–Rowe, B5) and then to hot electrons; the escaping electrons now average well over 100 keV.
          </li>
          <li>
            <strong>Weak drive.</strong> Halve a₀ to 0.04. The gain of this short slab is now too small, and less than 1% comes back by ω₀t = 1500.
          </li>
          <li>
            <strong>Convergence.</strong> Change the particles per cell. We ran each setting to ω₀t = 3000 with three random seeds. The burst
            peaks were 4–6% at 8 per cell, 8–12% at 32 and 10–14% at 128; the run-averaged reflectivity was 0.5–0.9%, about 1.3% and 1.5–1.9%.
            So 8 per cell is clearly too few, and 32 is close to converged but still slightly low. The onset time scattered by up to a few hundred
            ω₀⁻¹ from seed to seed, so compare averages over several runs, never a single burst.
          </li>
        </ul>
      </section>

      <section id="vlasov">
        <h2>Vlasov codes</h2>
        <p>
          The alternative to sampling the distribution is to store it. A <strong>Vlasov code</strong> puts f(x, v) itself on a grid in phase space
          and advances the Vlasov equation, usually by shifting f in x and in v in alternate steps, as in the Landau-damping sim of A9. There are
          no particles, so there is no particle noise: weak damping and the sparse tail of the distribution are as clean as the bulk. That makes
          Vlasov codes the tool of choice for careful studies of trapping, nonlinear frequency shifts and Landau damping, the kinetic physics
          behind SRS saturation.
        </p>
        <p>
          The price is dimensionality. Each spatial dimension brings a velocity dimension with it, so a d-dimensional Vlasov code works in 2d
          phase-space dimensions. Vlasov codes have artefacts of their own as well: as f develops ever finer filaments in v, the velocity grid
          eventually fails to resolve them, and an echo of the initial state returns at the recurrence time that A9 showed.
        </p>
        <Eq
          title="Cost of PIC and Vlasov codes"
          src="\begin{gathered}\s{NP}{N_{\rm PIC}} \sim \s{ppc}{N_{\rm ppc}}\,\s{Nx}{N_x^{\,d}} \\ \s{NV}{N_{\rm Vlasov}} \sim N_x^{\,d}\,\s{Nv}{N_v^{\,d}}\end{gathered}"
          plot="b9-cost"
          symbols={{
            NP: { name: 'N_PIC, particles to advance each step', note: 'Each particle carries a position and a momentum, a handful of numbers.' },
            ppc: { name: 'N_ppc, particles per cell', note: 'Tens to hundreds in production runs; the noise falls only as its square root.' },
            Nx: { name: 'N_x^d, number of grid cells', note: 'N_x cells per dimension in d dimensions.' },
            NV: { name: 'N_Vlasov, phase-space grid points', note: 'The whole distribution on a grid: no noise, but the cost grows with the power 2d.' },
            Nv: { name: 'N_v^d, velocity grid points per cell', note: 'Typically 64–512 per velocity dimension, enough to resolve trapping and the tail.' },
          }}
          says="Adding a dimension multiplies a PIC run by N_x but a Vlasov run by N_x N_v, which is why Vlasov codes rule in 1D1V and large 2D and 3D runs are almost all PIC."
        />
        <p>
          A 1D1V grid of 512 × 256 points is 1.3×10⁵ numbers, trivial for a laptop. A 3D3V grid of 256³ cells with 64³ velocities is 4.4×10¹²
          numbers, about 35 TB in double precision, before any work is done. A 3D PIC run on the same 256³ cells with 64 particles per cell holds
          about 10⁹ particles, around 50 GB.
        </p>
        <Plotter spec={plotById('b9-cost')!} />
      </section>

      <section id="taught">
        <h2>What simulations taught</h2>
        <p>Much of the nonlinear physics in Kruer Ch. 11 was found, or first made concrete, in simulations like yours. Qualitatively:</p>
        <ul>
          <li>
            <strong>SRS saturates by trapping.</strong> As the plasma wave grows it traps electrons moving near v_φ. They take energy from the wave,
            flatten the distribution near v_φ, and shift the wave’s frequency so that it slides out of resonance. Reflectivity comes in bursts
            rather than as a steady level. The flip side, found later, is that a flattened f also damps the wave less, so trapping can let Raman
            grow well above what linear Landau damping allows.
          </li>
          <li>
            <strong>Hot electrons.</strong> The trapped electrons leave with energies set by the phase velocity, tens of keV in a laser corona.
            Raman at higher density has faster plasma waves and makes hotter electrons. This is a main source of the hot electrons of B8.
          </li>
          <li>
            <strong>Plasma waves decay.</strong> With mobile ions, a large SRS plasma wave can itself decay into another plasma wave and an ion
            acoustic wave, another route to saturation that this sim’s fixed ions cannot show.
          </li>
          <li>
            <strong>SBS saturates through the ions.</strong> Ion trapping, harmonics of the ion wave, ion heating and pump depletion all limit
            Brillouin scattering. Because the ion wave is slow, these runs need mobile ions, realistic mass ratios and long times, so they cost
            more.
          </li>
          <li>
            <strong>Several dimensions change the answer.</strong> Side scatter, filamentation (B7) and competition between instabilities in
            speckled beams appear only in 2D and 3D runs, where the 1D picture of a single plane wave breaks down.
          </li>
        </ul>
      </section>

      <section id="practice">
        <h2>Codes today</h2>
        <p>
          The flagship sim is a complete 1D code in a few hundred lines. Production codes add what experiments need: two and three dimensions,
          several mobile ion species, collisions (B2) and field ionization (C2), absorbing boundary layers, higher-order shapes and current filters
          against noise and grid heating, and above all parallel computing on thousands of processors or GPUs. OSIRIS, EPOCH, Smilei and WarpX are
          examples of widely used codes of this kind.
        </p>
        <p>
          Even so, a 3D run of a whole beam for a nanosecond is far out of reach (problem 2 costs a much smaller 2D run). Practitioners simulate a
          single speckle or a short slab for picoseconds, and connect to experiments through reduced models such as fluid codes with paraxial
          light. A good run is also a checked run:
        </p>
        <ul>
          <li>resolution: Δx ≲ λ_De and enough cells per wavelength, confirmed by repeating on a finer grid;</li>
          <li>particles: the answer does not change when the particles per cell double;</li>
          <li>statistics: several random seeds, compared through averages;</li>
          <li>boundaries: no light or particles reflected from the walls back into the region of interest;</li>
          <li>model: is fixed-ion, 1D or reduced-mass physics good enough for this question?</li>
        </ul>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          This closes Track B. You have followed a laser into a plasma (B1), watched it lose energy to collisions (B2) and resonance absorption
          (B3), push the plasma (B4), and drive parametric instabilities (B5–B7) that make hot electrons (B8). Now you can simulate the whole chain
          in one code. The last problem below is a capstone for Track B: it reads the temperature and density of a corona from its Raman and
          Brillouin light, the way experiments do, using B1, B5 and B6 together. Track C turns up the intensity until a₀ ≥ 1 (C1), where u_y = a_y means relativistic quiver motion and PIC becomes the main
          tool of the field. C8 comes back to PIC in practice for the intense-laser problems of Track C.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B9-p1',
      kind: 'numeric',
      concept: 'pic-resolution',
      prompt: 'You plan a 1D electromagnetic PIC run of a 1053 nm laser in a plasma at $0.05\\,n_c$ with $T_e = 1$ keV, using $\\Delta x = \\lambda_{De}$ and $c\\Delta t = \\Delta x$. How many time steps does 20 ps take? Give the answer in units of $10^5$ steps.',
      answer: 1.81,
      tol: 0.03,
      unit: '×10⁵ steps',
      hints: [
        '$n_c \\approx 1.115\\times10^{21}/\\lambda_{\\mu m}^2$ cm⁻³, so $n = 5.0\\times10^{19}$ cm⁻³. Then $\\lambda_{De} = \\sqrt{\\varepsilon_0 T_e/(ne^2)}$ with $T_e$ in joules and $n$ in m⁻³.',
        '$\\Delta t = \\lambda_{De}/c$, and the number of steps is $20\\ \\text{ps}/\\Delta t$.',
      ],
      solution: '$n = 0.05\\times1.006\\times10^{21} = 5.03\\times10^{19}$ cm⁻³ $= 5.03\\times10^{25}$ m⁻³. $\\lambda_{De} = \\sqrt{8.854\\times10^{-12}\\times1.602\\times10^{-16}/(5.03\\times10^{25}\\times(1.602\\times10^{-19})^2)} = 33.2$ nm, so $\\Delta t = 33.2\\ \\text{nm}/c = 0.111$ fs and 20 ps takes $1.81\\times10^5$ steps. Check the other rules: $\\omega_{pe}\\Delta t = v_{te}/c = 0.044$, far below 0.2, and $\\lambda_0/\\Delta x = 32$ cells per wavelength. In an electromagnetic code the Courant condition, not the plasma period, sets the step.',
    },
    {
      id: 'B9-p2',
      kind: 'numeric',
      concept: 'pic-cost',
      prompt: 'A 2D PIC run for 351 nm light: a box 100 µm × 50 µm with square cells of $\\lambda_0/30$, 64 macroparticles per cell for each of two species, and $c\\Delta t = \\Delta x/\\sqrt2$. If one particle step costs 50 ns of one processor core (including its share of the field work), how many core-hours does 10 ps take? Answer in units of $10^4$ core-hours.',
      answer: 2.35,
      tol: 0.04,
      unit: '×10⁴ core-hours',
      hints: [
        '$\\Delta x = 351/30 = 11.7$ nm. Count the cells in each direction, multiply, then multiply by 128 particles per cell.',
        '$\\Delta t = \\Delta x/(\\sqrt2\\,c)$. Total work = particles × steps × 50 ns; divide by 3600 s per hour.',
      ],
      solution: 'The box has $8547\\times4274 = 3.65\\times10^7$ cells and $4.68\\times10^9$ particles. $\\Delta t = 11.7\\ \\text{nm}/(\\sqrt2\\,c) = 0.0276$ fs, so 10 ps is $3.62\\times10^5$ steps. That is $1.69\\times10^{15}$ particle steps; at 50 ns each, $8.5\\times10^7$ core-seconds $= 2.35\\times10^4$ core-hours, about a day on a thousand cores. Making it 3D with a 50 µm depth multiplies the cost by about 5000 (4274 times more cells and $\\sqrt{3/2}$ times more steps).',
    },
    {
      id: 'B9-p3',
      kind: 'numeric',
      concept: 'pic-noise',
      prompt: 'In a 1D thermal-plasma test with point particles and $\\Delta x = \\lambda_{De}$, how many particles per cell bring the fluctuation energy down to $W_E/W_K = 10^{-3}$? Use $W_E/W_K = \\arctan(\\pi\\lambda_{De}/\\Delta x)/(\\pi N_\\lambda)$, with $N_\\lambda$ the number of particles per Debye length.',
      answer: 402,
      tol: 0.03,
      unit: 'particles per cell',
      hints: ['With $\\Delta x = \\lambda_{De}$, $N_\\lambda$ equals the number of particles per cell.', '$\\arctan\\pi = 1.263$.'],
      solution: '$W_E/W_K = \\arctan(\\pi)/(\\pi N_{\\rm ppc}) = 0.402/N_{\\rm ppc}$, so $N_{\\rm ppc} = 402$. The noise amplitude goes as the square root of this ratio: halving it again needs four times as many particles, about 1600 per cell. Cloud-in-cell shapes smooth the shortest modes and lower the coefficient to about 0.34, but the $1/N$ scaling is the same.',
    },
    {
      id: 'B9-p4',
      kind: 'mcq',
      concept: 'grid-heating',
      prompt: 'A 1D electromagnetic PIC run of a plasma at $n = 0.2\\,n_c$ with $T_e = 0.2$ keV uses $\\Delta x = 0.2\\,c/\\omega_0$, $c\\Delta t = \\Delta x$ and 64 particles per cell. With no laser at all, the electron temperature climbs steadily, by about a quarter in 400 $\\omega_{pe}^{-1}$. What is wrong?',
      options: [
        'The time step breaks the leapfrog limit $\\omega_{pe}\\Delta t < 2$; halve it',
        'The cell is about 4.5 Debye lengths, so the grid aliases short-wavelength noise and heats the plasma; refine $\\Delta x$ towards $\\lambda_{De}$ (more particles only slow it)',
        'The Courant condition is violated, because $c\\Delta t$ must be strictly less than $\\Delta x$',
        'Nothing: this is physical collisional heating of a thermal plasma',
      ],
      correct: 1,
      hints: [
        'Find $\\lambda_{De}$ in units of $c/\\omega_0$: $(v_{te}/c)/\\sqrt{n/n_c}$, with $v_{te}/c = \\sqrt{T_e/m_ec^2}$.',
        'Here $\\omega_{pe}\\Delta t = \\sqrt{0.2}\\times0.2$. Is that anywhere near 2? And the 1D characteristic scheme is built for $c\\Delta t = \\Delta x$ exactly.',
      ],
      solution: '$v_{te}/c = \\sqrt{0.2/511} = 0.0198$ and $\\omega_{pe}/\\omega_0 = 0.447$, so $\\lambda_{De} = 0.044\\,c/\\omega_0$ and $\\Delta x = 4.5\\,\\lambda_{De}$. The grid cannot represent the Debye cloud, short-wavelength fluctuations alias onto long ones, and the plasma heats until its Debye length becomes a sizeable fraction of the cell: grid heating. The time step is fine ($\\omega_{pe}\\Delta t = 0.089$), the 1D light solver is exact at $c\\Delta t = \\Delta x$, and a PIC plasma has almost no physical collisions. In the test sim, $\\Delta x = 4\\lambda_D$ with 64 particles per cell heats by 16% in 400 $\\omega_{pe}^{-1}$; more particles slow it, but the cure is a finer grid (or smoother shapes).',
    },
    {
      id: 'B9-p5',
      kind: 'numeric',
      concept: 'canonical-momentum',
      prompt: 'In a 1D code, an electron at rest is overtaken by a linearly polarized laser pulse in vacuum with peak $a_0 = eA_0/(m_ec) = 0.3$. Using $u_y = a_y$ and $\\gamma - u_x = 1$, find the electron’s peak kinetic energy in keV.',
      answer: 23.0,
      tol: 0.03,
      unit: 'keV',
      hints: [
        'Square $\\gamma = 1 + u_x$ and compare with $\\gamma^2 = 1 + u_x^2 + u_y^2$ to show $u_x = u_y^2/2$.',
        'Then $\\gamma - 1 = u_x = a_y^2/2$, largest where $|a_y| = a_0$. Multiply by $m_ec^2 = 511$ keV.',
      ],
      solution: '$(1 + u_x)^2 = 1 + u_x^2 + u_y^2$ gives $u_x = u_y^2/2 = a_y^2/2$, so $\\gamma - 1 = a_y^2/2$. At the peak, $(\\gamma - 1)m_ec^2 = 0.045\\times511 = 23.0$ keV. All of it is handed back once the pulse has passed: in 1D vacuum a plane wave leaves no net energy. At 351 nm, $a_0 = 0.3$ is $1.0\\times10^{18}$ W/cm². A 1D code should reproduce $u_y = a_y$ to the accuracy of its interpolation; this lesson’s code does so with an rms error below 1% of $a_0$.',
    },
    {
      id: 'B9-p6',
      kind: 'numeric',
      concept: 'lpi-diagnostics',
      prompt: 'Capstone. A 351 nm laser heats a CH plasma ($Z = 3.5$, $A = 6.5$, $T_i = T_e/2$). The backscattered light shows a Raman line at 567 nm and Brillouin light red-shifted by 0.85 nm. Find $T_e$ in keV. Use Bohm–Gross matching for Raman backscatter ($v_{te}^2 = T_e/m_e$), and for Brillouin $\\Delta\\omega = kc_s$ with $k = 2k_0 = 2(\\omega_0/c)\\sqrt{1 - n/n_c}$ and $c_s^2 = (ZT_e + 3T_i)/M$.',
      answer: 2.02,
      tol: 0.05,
      unit: 'keV',
      hints: [
        'Raman gives $\\omega_s = (351/567)\\,\\omega_0 = 0.619\\,\\omega_0$, so $\\omega_{ek} = 0.381\\,\\omega_0$; a cold first guess is $n/n_c = 0.381^2 = 0.145$. Brillouin depends only weakly on n: $\\Delta\\lambda/\\lambda_0 = 2\\sqrt{1 - n/n_c}\\,c_s/c$ gives $c_s$, and here $c_s^2 = 5T_e/M$.',
        'Correct the density with Bohm–Gross, in units of $\\omega_0$ and $c$: iterate $n/n_c = \\omega_{ek}^2 - 3k^2v_{te}^2$ with $k = \\sqrt{1 - n/n_c} + \\sqrt{\\omega_s^2 - n/n_c}$. Then redo the Brillouin step with the new n.',
      ],
      solution: 'Raman (B6): $\\omega_s = 0.619\\,\\omega_0$, $\\omega_{ek} = 0.381\\,\\omega_0$, cold guess $n = 0.145\\,n_c$. Brillouin (B6): $\\Delta\\omega/\\omega_0 = 0.85/351 = 2.42\\times10^{-3}$, so $c_s/c = 2.42\\times10^{-3}/(2\\sqrt{0.855}) = 1.31\\times10^{-3}$, $c_s = 3.93\\times10^5$ m/s and $T_e = Mc_s^2/5 = 2.08$ keV with $M = 6.5$ u. Bohm–Gross with $v_{te}^2/c^2 = 2.08/511$ converges to $k = 1.45\\,\\omega_0/c$ and $n = 0.119\\,n_c$: the thermal correction is large. Brillouin again with $n = 0.119$: $c_s = 3.87\\times10^5$ m/s and $T_e = 2.02$ keV; one more round gives $n = 0.120\\,n_c$ and the same $T_e$. So $T_e \\approx 2.0$ keV and $n \\approx 0.12\\,n_c = 1.1\\times10^{21}$ cm⁻³ (B1). The Raman plasma wave has $k\\lambda_{De} = 0.26$, weakly damped, so Raman can grow (B6), and $v_\\phi = 0.26c = 4.2\\,v_{te}$: electrons it traps reach $\\tfrac12 m_ev_\\phi^2 \\approx 18$ keV and beyond, the hot electrons of B8. These are almost exactly the flagship sim’s default conditions.',
    },
  ],
  cards: [
    {
      id: 'B9-c1',
      front: 'The particle-in-cell loop, in four steps',
      back: 'Push the particles with the Lorentz force (leapfrog, Boris); deposit their charge and current on the grid with a shape $S$; solve the field equations on the grid; gather $E$ and $B$ back to each particle with the same $S$. Repeat every $\\Delta t$',
    },
    {
      id: 'B9-c2',
      front: 'Resolution rules for an explicit PIC run',
      back: '$\\Delta x \\lesssim \\lambda_{De}$ (else grid heating); $\\omega_{pe}\\Delta t \\lesssim 0.2$ (leapfrog unstable above 2); $c\\Delta t \\le \\Delta x/\\sqrt d$ (Courant, Yee); 20–30 or more cells per laser wavelength',
    },
    {
      id: 'B9-c3',
      front: 'Leapfrog on a plasma oscillation: frequency and stability limit',
      back: '$\\sin(\\Omega\\Delta t/2) = \\omega_{pe}\\Delta t/2$: undamped, fast by $\\omega_{pe}^2\\Delta t^2/24$ (0.17% at 0.2); unstable for $\\omega_{pe}\\Delta t > 2$',
    },
    {
      id: 'B9-c4',
      front: 'PIC noise: how it scales, and why a real plasma is quieter',
      back: '$W_E/W_K \\approx 1/(2N_\\lambda)$ in 1D for $\\Delta x \\ll \\lambda_{De}$, with $N_\\lambda$ particles per Debye length: energy $\\propto 1/N$, amplitude $\\propto 1/\\sqrt N$. A corona at $0.1\\,n_c$ (351 nm) and 2 keV has about 5000 electrons per Debye sphere; a 3D run of it with cells of $\\lambda_0/30$ and 8 per cell has about 28 macroparticles there, each about 180 electrons',
    },
    {
      id: 'B9-c5',
      front: 'The 1D electromagnetic PIC scheme and its exact tests',
      back: '$F_\\pm = (E_y \\pm cB_z)/2$ obey $(\\partial_t \\pm c\\,\\partial_x)F_\\pm = -J_y/2\\varepsilon_0$; with $c\\Delta t = \\Delta x$ each shifts one cell per step, exactly in vacuum. Tests: light at $c$, $p_y + qA_y$ conserved ($u_y = a_y$), Gauss’s law to round-off with a charge-conserving deposit',
    },
    {
      id: 'B9-c6',
      front: 'PIC or Vlasov, and what simulations taught about SRS and SBS',
      back: 'Vlasov: noise-free $f(x,v)$ on a grid, cost $\\propto N_x^dN_v^d$, ideal in 1D1V; PIC $\\propto N_{\\rm ppc}N_x^d$, so 2D and 3D runs are PIC. SRS saturates by electron trapping, in bursts, making hot electrons set by $v_\\phi$; SBS saturates through ion trapping, harmonics, ion heating and pump depletion',
    },
  ],
}
