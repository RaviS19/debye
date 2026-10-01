import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { VlasovSim } from '../sims/VlasovSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 19 }

/** Why a Maxwellian damps a wave: near v = ω/k there are more slightly slower electrons than slightly faster ones. */
function SurfDiagram() {
  const X = (v: number) => 40 + 120 * v
  const Y = (f: number) => 250 - 200 * f
  const f0 = (v: number) => Math.exp(-v * v / 2)
  const vp = 1.8
  const band = 0.4
  let curve = ''
  for (let v = 0; v <= 4.5001; v += 0.05) curve += `${v === 0 ? 'M' : 'L'}${X(v).toFixed(1)},${Y(f0(v)).toFixed(1)} `
  const area = (a: number, b: number) => {
    let d = `M${X(a)},${Y(0)} `
    for (let v = a; v <= b + 1e-9; v += 0.02) d += `L${X(v).toFixed(1)},${Y(f0(v)).toFixed(1)} `
    return d + `L${X(b)},${Y(0)} Z`
  }
  // tangent at v_phi, showing the negative slope
  const s = -vp * f0(vp)
  const tan = (v: number) => f0(vp) + s * (v - vp)
  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const h = 10
    return (
      <g stroke={color} fill={color} strokeWidth={3}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <path d={`M${x2},${y2} L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)} Z`} stroke="none" />
      </g>
    )
  }
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 600 300" style={{ width: '100%', maxWidth: 640, display: 'block', margin: '0 auto' }} role="img" aria-label="Electrons near the wave speed in a Maxwellian distribution">
        <path d={area(vp - band, vp)} fill="rgba(244,114,182,0.45)" />
        <path d={area(vp, vp + band)} fill="rgba(34,211,238,0.45)" />
        <path d={curve} fill="none" stroke="#e8eaf6" strokeWidth={2.5} />
        <line x1={X(1.15)} y1={Y(tan(1.15))} x2={X(2.35)} y2={Y(tan(2.35))} stroke="#fbbf24" strokeWidth={1.8} strokeDasharray="6 5" />
        <line x1={X(vp)} y1={40} x2={X(vp)} y2={Y(0)} stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 4" />
        <line x1={X(0)} y1={Y(0)} x2={X(4.6)} y2={Y(0)} stroke="#9aa0c9" strokeWidth={1.5} />
        <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={30} stroke="#9aa0c9" strokeWidth={1.5} />
        {arrow(X(vp - band) - 4, 150, X(vp) - 8, 150, '#f472b6')}
        {arrow(X(vp + band) + 4, 186, X(vp) + 8, 186, '#22d3ee')}
        <text x={X(0.12)} y={40} fill="#e8eaf6" style={svgText}>f₀(v), Maxwellian</text>
        <text x={X(vp) - 36} y={276} fill="#fbbf24" style={svgText}>v = ω/k</text>
        <text x={X(4.45)} y={276} fill="#9aa0c9" style={svgText}>v</text>
        <text x={X(0) - 6} y={276} fill="#9aa0c9" style={svgText}>0</text>
        <text x={330} y={84} fill="#f472b6" style={svgText}>slightly slower: many,</text>
        <text x={330} y={106} fill="#f472b6" style={svgText}>pushed forward, gain energy</text>
        <text x={330} y={140} fill="#22d3ee" style={svgText}>slightly faster: fewer,</text>
        <text x={330} y={162} fill="#22d3ee" style={svgText}>held back, give energy</text>
        <text x={X(2.42)} y={222} fill="#fbbf24" style={{ ...svgText, fontSize: 16 }}>slope ∂f₀/∂v &lt; 0</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        A wave moving at v = ω/k (amber) acts on the electrons moving at nearly its own speed. It speeds up those slightly slower than it
        (magenta) and slows down those slightly faster (cyan), bunching both toward its own speed. Because f₀ slopes downward there, the
        magenta group is bigger than the cyan one: more electrons gain energy than lose it, and the energy they gain comes out of the wave.
        Reverse the slope and the same bookkeeping makes the wave grow.
      </figcaption>
    </figure>
  )
}

export const A9: Lesson = {
  id: 'A9',
  title: 'Kinetic theory',
  subtitle: 'The distribution function, the Vlasov equation, Landau damping, trapping and the bump-on-tail instability',
  minutes: 60,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 7: the meaning of f(v), the equations of kinetic theory, plasma oscillations and Landau damping, a physical derivation of Landau damping, ion Landau damping',
    'Bellan, Fundamentals of Plasma Physics: the chapters on the Vlasov equation and on Landau damping (including the Laplace-transform treatment)',
    'Cheng and Knorr, “The integration of the Vlasov equation in configuration space”, Journal of Computational Physics 22, 330 (1976): the split semi-Lagrangian method the simulation below uses',
  ],
  objectives: [
    'Describe a plasma by its distribution function $f(x, v, t)$, recover density and flow as moments, and say when the collisionless Vlasov equation applies',
    'Derive the Landau damping rate from the linearized Vlasov equation, and explain why the slope $\\partial f_0/\\partial v$ at $v = \\omega/k$ decides between damping and growth',
    'Measure Landau damping, particle trapping and the bump-on-tail instability in a Vlasov simulation, and explain why ion acoustic waves survive only when $T_e \\gg T_i$',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'distribution', label: 'Distribution function' },
    { id: 'vlasov', label: 'Vlasov equation' },
    { id: 'linear', label: 'Landau’s prescription' },
    { id: 'picture', label: 'Physical picture' },
    { id: 'rate', label: 'Damping rate' },
    { id: 'sim', label: 'Simulation' },
    { id: 'ion', label: 'Ion Landau damping' },
    { id: 'trapping', label: 'Trapping' },
    { id: 'bump', label: 'Bump on tail' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          Watch surfers waiting for a wave. The ones sitting still are lifted and dropped as it passes, and are left where they were. The one
          paddling at almost the wave’s speed is caught and carried: the wave pushes her forward and gives her energy. A surfer going
          slightly <em>faster</em> than the wave does the opposite: she runs up its back and pushes on it, handing energy to the wave.
        </p>
        <p>
          The electrons in a plasma wave are those surfers. In a thermal plasma there are always electrons moving at nearly the wave’s speed,
          and at any speed above the average there are more slightly slower electrons than slightly faster ones. So the wave gives away more
          energy than it gets back, and it dies. No collisions are needed. This is <strong>Landau damping</strong>, and it is the main reason
          plasma waves, the Langmuir waves of A5 and the ion waves, fade away in a hot plasma.
        </p>
        <p>
          The fluid theory of A4–A8 cannot see any of this. It averages over velocities before it starts, so it knows the density and the
          mean flow but not how many electrons move at exactly the wave’s speed. To see them we need the distribution of velocities itself.
          That is kinetic theory.
        </p>
      </section>

      <section id="distribution">
        <h2>The distribution function</h2>
        <p>
          Instead of a density n(x, t), describe the electrons by a density in <strong>phase space</strong>, position and velocity together:
          f(x, v, t) dx dv is the number of electrons in the small box dx dv around (x, v). Everything the fluid picture uses is a
          velocity average, or <strong>moment</strong>, of f. The zeroth moment counts particles; the first gives their flow; the second gives
          the pressure, the spread of velocities about the mean, which is where temperature lives.
        </p>
        <Eq
          title="Moments of the distribution function"
          src="\begin{gathered}\s{n}{n}(x,t) = \int \s{f}{f}(x,\s{v}{v},t)\,dv \\ n\,\s{u}{u} = \int v\,f\,dv\end{gathered}"
          symbols={{
            n: { name: 'n, number density', units: 'm⁻³', note: 'The zeroth moment: integrate over all velocities to count every particle at x.' },
            f: { name: 'f, distribution function', units: 's/m⁴ (per m³ per m/s) with one velocity component; s³/m⁶ (per m³ per (m/s)³) in full 3D', note: 'The density of particles in phase space. For a Maxwellian at rest, f = n (2πv_th²)^(−1/2) exp(−v²/2v_th²), with v_th = √(kT/m).' },
            v: { name: 'v, velocity', units: 'm/s', note: 'An independent coordinate, on the same footing as x. The fluid equations lose it by integrating over it.' },
            u: { name: 'u, mean (fluid) velocity', units: 'm/s', note: 'The first moment divided by n: the fluid velocity of A4. The next moment, p = m∫(v − u)²f dv, is the pressure.' },
          }}
          says="A fluid description keeps only the first few moments of f. Each moment equation involves the next moment up (the momentum equation needs the pressure, the pressure equation needs the heat flux), so a fluid theory always has to be closed by an assumption, such as the isothermal or adiabatic law of A4. Kinetic theory keeps the whole of f and needs no closure."
        />
        <p>
          A note on units used from here on: v_th = √(kT_e/m) (Chen uses √(2kT/m), which moves some factors of √2), so the Debye length is
          simply λ_D = v_th/ω_p.
        </p>
      </section>

      <section id="vlasov">
        <h2>The Vlasov equation</h2>
        <p>
          Follow a small blob of electrons through phase space. Each electron moves in x at its velocity v and in v at its acceleration
          (q/m)(E + v×B). The smoothed fields push every electron in the blob the same way, so the blob moves and distorts but its
          phase-space density stays the same. Only collisions, sudden kicks from individual neighbours, can knock an electron out of the blob.
          So df/dt along the orbit equals a collision term, and when collisions are negligible it is zero.
        </p>
        <Eq
          title="Vlasov equation"
          src="\begin{gathered}\dfrac{\partial \s{f}{f}}{\partial t} + \s{v}{\mathbf{v}}\cdot\nabla f \\ + \dfrac{\s{q}{q}}{\s{m}{m}}\left(\s{E}{\mathbf{E}} + \mathbf{v}\times\s{B}{\mathbf{B}}\right)\cdot\dfrac{\partial f}{\partial \mathbf{v}} = 0\end{gathered}"
          symbols={{
            f: { name: 'f(x, v, t), distribution function', note: 'One f for each species (electrons, each kind of ion).' },
            v: { name: 'v, velocity', units: 'm/s', note: 'v·∇f carries particles through space at their own speed: free streaming.' },
            q: { name: 'q, particle charge', units: 'C', note: '−e for electrons.' },
            m: { name: 'm, particle mass', units: 'kg', note: 'In the same field an electron is accelerated about 1836 times more than a proton.' },
            E: { name: 'E, electric field', units: 'V/m', note: 'The smoothed field, found from Poisson’s (or Maxwell’s) equations using the charge density ρ = Σ q∫f dv. This feedback makes the equation nonlinear.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'External plus self-generated. The waves in this lesson are electrostatic along B, so B drops out.' },
          }}
          says="The phase-space density is carried unchanged along every particle orbit. The fields that bend the orbits are made by the particles themselves, so f and E must be solved together: the Vlasov–Poisson system in the simulation below."
        />
        <p>
          When may the collision term be dropped? When the process is fast compared with collisions. The collision rate of A7 is smaller than
          ω_p by roughly the number of electrons in a Debye sphere (up to lnΛ and numerical factors). At 10¹⁹ m⁻³ and 100 eV, for instance,
          an electron has one collision in several tens of thousands of plasma periods. A Langmuir wave that damps in a few periods has
          never met a collision.
        </p>
        <p>
          That raises a puzzle. The Vlasov equation has no friction and runs equally well backwards in time. How can it damp anything? The
          answer, which the simulation makes visible, is that the wave’s energy is not destroyed but moved into ever finer ripples of f in
          velocity (<strong>phase mixing</strong>). The density and field, which average f over v, no longer see them. Experiments have even
          brought such “lost” waves back: a second wave launched later can make the hidden ripples line up again, and a plasma echo appears
          after both have damped (A10 shows how).
        </p>
      </section>

      <section id="linear">
        <h2>Linearizing, and Landau’s prescription</h2>
        <p>
          Take electrons in one dimension, ions as a fixed neutralizing background, and a small wave on a uniform equilibrium f₀(v). Write
          f₀ = n₀ĝ(v), with ĝ normalized to 1. Every perturbed quantity varies as exp[i(kx − ωt)].
        </p>
        <Derivation
          lessonId="A9"
          id="landau"
          title="From the Vlasov equation to the Landau damping rate"
          steps={[
            { text: 'Linearize the 1D Vlasov equation for electrons (charge −e) about f₀(v), keeping terms of first order in f₁ and E₁.', math: '-i\\omega f_1 + ikv\\,f_1 - \\dfrac{e}{m}E_1\\,f_0^{\\prime}(v) = 0', why: 'E is zero in equilibrium, so the only first-order force term is E₁ acting on the unperturbed f₀. The term E₁·∂f₁/∂v is second order and dropped.' },
            { text: 'Solve for the perturbed distribution.', math: 'f_1 = \\dfrac{ie}{m}\\,\\dfrac{E_1\\,f_0^{\\prime}(v)}{\\omega - kv}', why: 'The denominator vanishes for electrons moving at the wave’s phase velocity v = ω/k. These resonant electrons are the whole story of this lesson.' },
            { text: 'Put the perturbed density ∫f₁dv into Poisson’s equation. E₁ cancels, leaving the dispersion relation.', math: '\\begin{gathered}ikE_1 = -\\dfrac{e}{\\varepsilon_0}\\int f_1\\,dv \\\\ \\Rightarrow\\; 1 = \\dfrac{\\omega_p^2}{k^2}\\int \\dfrac{\\hat g^{\\prime}(v)\\,dv}{v - \\omega/k}\\end{gathered}', why: 'Check: for a cold plasma, integrate by parts and expand for v ≪ ω/k; the integral becomes k²/ω² and the relation gives ω = ω_p, the plasma oscillation of A5.' },
            { text: 'The integral has a pole at v = ω/k. Landau solved the initial-value problem (a Laplace transform in time) and showed the v-integration must pass below the pole. For weak damping this gives a principal part plus half a residue.', math: '\\begin{gathered}\\int \\dfrac{\\hat g^{\\prime}\\,dv}{v - v_\\phi} = \\mathcal{P}\\!\\!\\int \\dfrac{\\hat g^{\\prime}\\,dv}{v - v_\\phi} \\\\ +\\; i\\pi\\,\\hat g^{\\prime}(v_\\phi)\\end{gathered}', why: 'Here v_φ = ω/k and k > 0. The initial-value problem is well defined for Im ω > 0, where the pole lies above the real v axis; continuing to damped waves (Im ω < 0) drags the contour below the pole. Vlasov’s earlier principal-value treatment missed the iπ term entirely.' },
            { text: 'Write the relation as ε(ω) = 1 − (ω_p²/k²)∫… = 0 and split ε = ε_r + iε_i. With ω = ω_r + iγ and |γ| ≪ ω_r, expand to first order in γ.', math: '\\varepsilon_r(\\omega_r) = 0,\\qquad \\gamma = -\\dfrac{\\varepsilon_i}{\\partial\\varepsilon_r/\\partial\\omega}', why: 'The principal part gives ε_r ≈ 1 − ω_p²/ω² − 3k²v_th²ω_p²/ω⁴: the Bohm–Gross wave of A5. So ∂ε_r/∂ω ≈ 2/ω_p. The half-residue gives ε_i = −π(ω_p²/k²)ĝ′(v_φ).' },
            { text: 'The damping rate is set by the slope of the distribution at the phase velocity.', math: '\\gamma = \\dfrac{\\pi}{2}\\,\\omega_p\\,\\dfrac{\\omega_p^2}{k^2}\\,\\hat g^{\\prime}\\!\\left(\\dfrac{\\omega}{k}\\right)', why: 'Negative slope (any Maxwellian above v = 0): γ < 0, damping. Positive slope (a bump): γ > 0, growth.' },
            { text: 'For a Maxwellian, ĝ′ = −(v/v_th²)ĝ. Use v_φ ≈ ω_p/k in the prefactor and ω² = ω_p²(1 + 3k²λ_D²) in the exponent.', math: '\\begin{gathered}\\hat g^{\\prime}(v) = -\\dfrac{v\\,e^{-v^2/2v_{th}^2}}{\\sqrt{2\\pi}\\,v_{th}^3} \\\\ \\Rightarrow\\; \\dfrac{\\gamma}{\\omega_p} = -\\sqrt{\\dfrac{\\pi}{8}}\\,\\dfrac{e^{-1/2k^2\\lambda_D^2 - 3/2}}{(k\\lambda_D)^3}\\end{gathered}', why: 'ω²/(2k²v_th²) = 1/(2k²λ_D²) + 3/2: the Bohm–Gross correction moves the phase velocity out a little, which is where the factor e^(−3/2) comes from. (π/2)/√(2π) = √(π/8).' },
          ]}
        />
        <p>
          The weak-damping expansion is not needed. For a Maxwellian the velocity integral, taken along Landau’s contour, is a tabulated
          special function, the <strong>plasma dispersion function</strong> Z(ζ) of Fried and Conte, and the dispersion relation can be
          solved exactly for complex ω. That is what the theory lines in the simulation and the plots below use.
        </p>
        <Eq
          title="Kinetic dispersion relation for Langmuir waves"
          src="\s{eps}{\varepsilon}(k,\omega) = 1 + \dfrac{1 + \s{zeta}{\zeta}\,\s{Z}{Z}(\zeta)}{\s{k}{k}^2\s{lD}{\lambda_D}^2} = 0"
          plot="a9-langmuir-frequency"
          symbols={{
            eps: { name: 'ε, dielectric function', note: 'A wave exists where ε = 0: the plasma’s response sustains the field with no external charge.' },
            zeta: { name: 'ζ = ω/(√2 k v_th)', note: 'The phase velocity in units of √2 v_th. Complex, because ω is: ω = ω_r + iγ.' },
            Z: { name: 'Z(ζ), plasma dispersion function', note: 'Z(ζ) = π^(−1/2)∫e^(−s²)/(s − ζ) ds along the Landau contour; equivalently i√π e^(−ζ²) erfc(−iζ). For large ζ, Z ≈ −1/ζ − 1/(2ζ³) − …, which gives back Bohm–Gross; its imaginary part i√π e^(−ζ²) gives the damping.' },
            k: { name: 'k, wavenumber', units: 'm⁻¹', note: 'Real: a wave set up in space and left to evolve in time.' },
            lD: { name: 'λ_D, Debye length', units: 'm', note: 'v_th/ω_p = √(ε₀kT_e/(n e²)).' },
          }}
          says="All of Landau damping for a Maxwellian in one line. For long waves (kλ_D ≪ 1) its root is the Bohm–Gross wave with an exponentially small damping. By kλ_D ≈ 0.5 the wave loses a factor e in about one and a half periods, and beyond about 0.6 the root is a strongly damped transient rather than a wave."
        />
        <Plotter spec={plotById('a9-langmuir-frequency')!} />
      </section>

      <section id="picture">
        <h2>The physical picture</h2>
        <p>
          The mathematics hides a simple energy balance. Most electrons are far from the wave speed: they slosh back and forth in the field
          and hand the energy back each cycle. That sloshing is the ordinary fluid response, and it sets the frequency. Only electrons within
          a narrow band around v = ω/k see an almost steady field, so they can be pushed consistently one way. Those are the surfers.
        </p>
        <SurfDiagram />
        <p>
          Chen works this out by following particles one by one; the result is the formula in step 6 of the derivation. It is worth reading
          as a statement about the slope alone.
        </p>
        <Eq
          title="Damping (or growth) from the slope of f₀"
          src="\s{g}{\gamma} = \dfrac{\pi}{2}\,\s{wp}{\omega_p}\,\dfrac{\omega_p^2}{\s{k}{k}^2}\;\s{gp}{\hat g^{\prime}}\!\left(\dfrac{\s{w}{\omega}}{k}\right)"
          symbols={{
            g: { name: 'γ, growth rate', units: 's⁻¹', note: 'Imaginary part of ω. Negative means damping: the amplitude falls as e^(γt).' },
            wp: { name: 'ω_p, plasma frequency', units: 'rad/s', note: '√(n₀e²/(ε₀m)).' },
            k: { name: 'k, wavenumber', units: 'm⁻¹', note: 'Sets the phase velocity ω/k, and so which electrons resonate.' },
            gp: { name: 'ĝ′, slope of the normalized distribution', units: '(s/m)²', note: 'd/dv of f₀/n₀, evaluated at the phase velocity. Only this one number about f₀ enters the damping rate.' },
            w: { name: 'ω ≈ ω_r, wave frequency', units: 'rad/s', note: 'ω/k is the phase velocity: the speed of the resonant electrons.' },
          }}
          says="Only the resonant electrons matter, and only through the slope of f₀ at their speed. More slow than fast (negative slope): the wave loses energy. More fast than slow (positive slope, as on the near side of a bump): the wave gains it, and the plasma is unstable."
        />
      </section>

      <section id="rate">
        <h2>The damping rate</h2>
        <p>
          For a Maxwellian the slope at v_φ is proportional to exp(−v_φ²/2v_th²), so the damping depends extremely steeply on how far out
          in the tail the wave speed sits. Long waves (kλ_D small) are fast, v_φ ≈ ω_p/k ≫ v_th, and find almost no electrons to push.
          Short waves find plenty.
        </p>
        <Eq
          title="Landau damping of Langmuir waves in a Maxwellian"
          src="\begin{gathered}\dfrac{\s{g}{\gamma}}{\s{wp}{\omega_p}} \approx -\sqrt{\dfrac{\pi}{8}}\,\dfrac{1}{(\s{k}{k}\s{lD}{\lambda_D})^3} \\ \times\exp\!\left(-\dfrac{1}{2k^2\lambda_D^2} - \dfrac{3}{2}\right)\end{gathered}"
          plot="a9-landau-damping"
          symbols={{
            g: { name: 'γ, damping rate', units: 's⁻¹', note: 'Negative: the field amplitude falls as e^(γt), the energy as e^(2γt).' },
            wp: { name: 'ω_p, electron plasma frequency', units: 'rad/s', note: 'The wave frequency is close to ω_p for kλ_D ≪ 1.' },
            k: { name: 'k, wavenumber', units: 'm⁻¹', note: 'Phase velocity ω/k ≈ ω_p/k, so kλ_D ≈ v_th/v_φ.' },
            lD: { name: 'λ_D, Debye length', units: 'm', note: 'With v_th = √(kT_e/m), λ_D = v_th/ω_p.' },
          }}
          says="The exponential is the fraction of electrons near the wave speed. At kλ_D = 0.2 a wave lasts about 3000 periods per e-fold; at 0.3, about 15; at 0.5, one and a half. So Langmuir waves shorter than about a dozen Debye lengths (kλ_D ≳ 0.5) are not seen: the Debye length sets the shortest plasma wave."
        />
        <Plotter spec={plotById('a9-landau-damping')!} />
      </section>

      <section id="sim">
        <h2>Watch it happen</h2>
        <p>
          The simulation below solves the Vlasov–Poisson system directly: f on a 64 × 128 grid in (x, v), advanced by the split
          semi-Lagrangian method of Cheng and Knorr. Each step shifts f along x at speed v for half a step, recomputes E from Poisson’s
          equation, shifts f along v by the force for a full step, then shifts in x for another half step. Nothing is random: there are no
          particles and no noise, so a damping rate of 10⁻² is as easy to see as one of 1. The run starts from a Maxwellian with a density
          ripple of relative size α at wavenumber k.
        </p>
        <VlasovSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The benchmark.</strong> At kλ_D = 0.5 and α = 0.01, the peaks of |E₁| fall on a straight line. The measured rate and
            frequency should match the exact root, γ = −0.1534 ω_p and ω = 1.416 ω_p, to within about 1%.
          </li>
          <li>
            <strong>The δf view.</strong> Watch the departure from the Maxwellian. At first it is a smooth ripple in x. Soon it tilts into
            stripes in (x, v), and the stripes get finer as time goes on (their spacing in v is about 2π/kt). The density and field, which
            average over v, no longer see the finer stripes, which is what phase mixing means. The electrons that actually take energy from the
            wave are the resonant ones near the dashed lines at v = ±ω/k.
          </li>
          <li>
            <strong>The steepness.</strong> Slide k down to 0.3: the damping is now 12 times weaker, and only a few electrons are resonant.
            Slide it up past 0.6 and the amplitude falls by e in less than one period.
          </li>
          <li>
            <strong>The grid’s limit.</strong> The filaments eventually become finer than the velocity grid (Δv = 0.125 v_th). A grid this
            coarse brings the wave back, artificially, at the recurrence time 2π/(kΔv), which is about 100 at k = 0.5, so each run stops at
            t = 80.
          </li>
        </ul>
      </section>

      <section id="ion">
        <h2>Ion Landau damping</h2>
        <p>
          Ion acoustic waves (A5) travel at about the sound speed c_s = √((kT_e + 3kT_i)/M). The electrons, far faster, see an almost
          stationary wave and sit near the top of their Maxwellian, where the slope is small; they give a small damping set by
          √(m/M). The ions are the problem. Their thermal speed is √(kT_i/M), and the ratio of the wave speed to it is √(T_e/T_i + 3). With
          T_e = T_i the wave runs at only 2 ion thermal speeds, right in the thick of the ions, and the ions damp it within a period.
        </p>
        <Eq
          title="Damping of ion acoustic waves (kλ_De ≪ 1)"
          src="\begin{gathered}-\dfrac{\s{g}{\gamma}}{\s{wr}{\omega_r}} \approx \sqrt{\dfrac{\pi}{8}}\,\Bigg[\sqrt{\dfrac{\s{m}{m}}{\s{M}{M}}} \\ +\; \left(\dfrac{\s{Te}{T_e}}{\s{Ti}{T_i}}\right)^{3/2} e^{-T_e/2T_i - 3/2}\Bigg]\end{gathered}"
          plot="a9-ion-landau"
          symbols={{
            g: { name: 'γ, damping rate', units: 's⁻¹', note: 'Negative for damping.' },
            wr: { name: 'ω_r, wave frequency', units: 'rad/s', note: 'About kc_s for long waves. The ratio −γ/ω_r is the damping per radian of phase.' },
            m: { name: 'm, electron mass', units: 'kg', note: 'The first term is electron Landau damping; for hydrogen √(m/M) = 0.023.' },
            M: { name: 'M, ion mass', units: 'kg', note: 'Heavier ions weaken the electron term but not the ion term, which depends only on T_e/T_i.' },
            Te: { name: 'T_e, electron temperature', units: 'eV', note: 'Sets the wave speed through the pressure of the electrons.' },
            Ti: { name: 'T_i, ion temperature', units: 'eV', note: 'Sets how many ions are near the wave speed.' },
          }}
          says="The second term, from the ions, falls off exponentially in T_e/T_i. Below T_e/T_i ≈ 3 an ion acoustic wave loses most of its amplitude in a single period. By T_e/T_i ≈ 10 the ion term is down to the size of the electron term, and beyond that only weak electron damping is left. That is why clean ion acoustic waves are seen only in plasmas with hot electrons and cold ions, and it is the damping that A5’s ion temperature term warned about."
        />
        <Plotter spec={plotById('a9-ion-landau')!} />
      </section>

      <section id="trapping">
        <h2>Trapping and the bounce frequency</h2>
        <p>
          Linear theory assumes each resonant electron is nudged but never turned around. In the frame moving with the wave, the wave is a row
          of stationary potential wells of depth 2eE₁/k (crest to trough). An electron moving slowly enough relative to the wave is <strong>trapped</strong> in
          a well and bounces back and forth in it. Near the bottom of the well the motion is simple harmonic.
        </p>
        <Eq
          title="Bounce frequency of a trapped electron"
          src="\s{wB}{\omega_B} = \sqrt{\dfrac{\s{e}{e}\,\s{k}{k}\,\s{E}{E_1}}{\s{m}{m}}}"
          symbols={{
            wB: { name: 'ω_B, bounce frequency', units: 'rad/s', note: 'How fast a deeply trapped electron oscillates in the wave’s potential well, seen in the wave frame.' },
            e: { name: 'e, elementary charge', units: 'C', note: '1.602×10⁻¹⁹ C.' },
            k: { name: 'k, wavenumber', units: 'm⁻¹', note: 'Shorter wells (larger k) are steeper for the same field.' },
            E: { name: 'E₁, wave field amplitude', units: 'V/m', note: 'The well depth (crest to trough) is 2eE₁/k, so the trapped band of velocities is ±2ω_B/k around ω/k.' },
            m: { name: 'm, electron mass', units: 'kg', note: 'Ions bounce in ion waves at √(m/M) of the rate for the same field.' },
          }}
          says="Compare ω_B with the damping rate. If ω_B ≪ |γ| the wave dies before any electron completes a bounce, and linear Landau damping holds. If ω_B ≫ |γ| the trapped electrons bounce, and after half a bounce they are giving energy back: the damping stops, the amplitude rings at about ω_B and settles at a finite level (O’Neil, 1965)."
        />
        <p>
          In the simulation’s units the density ripple α gives E₁ = α/(kλ_D) and so ω_B = √α ω_p. The benchmark, α = 0.01, has ω_B/|γ| ≈ 0.65:
          linear. Choose the <em>Trapping</em> preset (α = 0.5, ω_B/|γ| ≈ 4.6). The field falls at first, by a factor of about 30 by
          t ≈ 15–20, which is about two bounce periods of the initial field (2π/ω_B ≈ 9). Then, instead of falling further, it grows
          again: the trapped electrons have turned around in their wells and are handing energy back. By t ≈ 40 it has recovered to about
          a sixth of its starting value, and from then on it rings slowly about a finite level. In the f view the resonant electrons roll
          up into vortices, one per wavelength, at v = ±ω/k. Undamped nonlinear waves held up by trapped particles in this way are the BGK
          modes Chen mentions.
        </p>
      </section>

      <section id="bump">
        <h2>Bump on tail: Landau damping in reverse</h2>
        <p>
          The slope formula says nothing about Maxwellians. Add a weak, warm beam to the tail of the distribution and there is a range of
          speeds, on the slow side of the bump, where ∂f₀/∂v &gt; 0. A wave with its phase velocity there finds more electrons slightly
          faster than itself than slightly slower. The surfers now push the wave, and it grows. This is the <strong>bump-on-tail
          instability</strong>, Landau damping run backwards.
        </p>
        <p>
          The simulation’s <em>Bump on tail</em> preset uses 90% of the electrons in a Maxwellian and 10% in a beam at 4.5 v_th with thermal
          spread 0.5 v_th. The slope is positive between about 3.1 and 4.5 v_th. At kλ_D = 0.3 the exact root of the kinetic dispersion
          relation has ω = 1.00 ω_p, so v_φ = 3.34 v_th, inside the positive-slope window, and γ = +0.198 ω_p. After a brief transient (the Landau-damped part of
          the initial ripple dies away by t ≈ 10), the simulation’s |E₁| climbs on that slope for about 20 time units, by a factor of about
          50, and the measured rate matches the kinetic root to about 1%.
        </p>
        <p>
          Then, at about 75 times its starting amplitude (t ≈ 35), it stops. The wave has grown until its bounce frequency is comparable with its growth rate, and it traps the beam electrons.
          Watch the f view: the bump rolls up into a vortex and, averaged over x (the side strip), the positive slope is flattened into a
          plateau. With no positive slope left, the drive is gone. The cold two-stream instability of A8 is the other limit of the same
          physics: a beam so cold and dense that it is a fluid, and the growth is reactive rather than resonant.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Everything here was linear in the wave amplitude except the last two sections, which already showed what happens when it is not:
          particles are trapped, distributions flatten, and waves saturate. A10 takes up nonlinear plasma physics properly, with sheaths,
          solitons, the ponderomotive force, the parametric instabilities in which one wave decays into two, and the plasma echoes that
          prove Landau damping is reversible. Landau damping returns
          throughout Track B: in laser plasmas the electron plasma waves driven by stimulated Raman scattering (B6) are Landau damped, and
          when they are driven hard enough to trap electrons they make the hot electrons of B8. In Track C the same trapping, at relativistic
          amplitude, is how a laser wakefield catches electrons and accelerates them.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'A9-p1',
      kind: 'numeric',
      concept: 'landau-damping-rate',
      prompt: 'At $k\\lambda_D = 0.5$ the kinetic dispersion relation for a Maxwellian gives $\\omega = 1.416\\,\\omega_{pe}$ and $\\gamma = -0.1534\\,\\omega_{pe}$. How many wave periods does the field amplitude take to fall by a factor $e$?',
      answer: 1.469,
      tol: 0.03,
      unit: 'periods',
      hints: ['One period is $2\\pi/\\omega_r$.', 'The amplitude falls by $e$ in a time $1/|\\gamma|$.'],
      solution: 'Period $= 2\\pi/1.416 = 4.44\\,\\omega_{pe}^{-1}$. e-folding time $= 1/0.1534 = 6.52\\,\\omega_{pe}^{-1}$. Ratio $6.52/4.44 = 1.47$ periods. A wave this short is barely a wave; at $k\\lambda_D = 0.3$ the same ratio is about 15, and at 0.2 about 3000.',
    },
    {
      id: 'A9-p2',
      kind: 'numeric',
      concept: 'bounce-frequency',
      prompt: 'An electron plasma wave of wavelength 1 mm has a field amplitude of 10 kV/m. What is the bounce frequency $\\omega_B$ of an electron trapped near the bottom of one of its potential wells, in units of $10^9$ rad/s?',
      answer: 3.32,
      tol: 0.03,
      unit: '×10⁹ rad/s',
      hints: ['$\\omega_B = \\sqrt{ekE_1/m}$ with $k = 2\\pi/\\lambda$.', '$k = 6283$ m⁻¹, so $ekE_1 = 1.602\\times10^{-19}\\times6283\\times10^4$ N/m.'],
      solution: '$ekE_1/m = 1.602\\times10^{-19}\\times6283\\times10^{4}/9.109\\times10^{-31} = 1.105\\times10^{19}$ s⁻², so $\\omega_B = 3.32\\times10^9$ rad/s. If the wave’s Landau damping rate is much smaller than this, trapped electrons bounce many times before the wave decays, and linear damping theory fails.',
    },
    {
      id: 'A9-p3',
      kind: 'numeric',
      concept: 'ion-landau-damping',
      prompt: 'Use the small-$k\\lambda_{De}$ formula $-\\gamma/\\omega_r \\approx \\sqrt{\\pi/8}\\,[\\sqrt{m/M} + (T_e/T_i)^{3/2}e^{-T_e/2T_i - 3/2}]$ to estimate the damping per radian of an ion acoustic wave in hydrogen ($M/m = 1836$) with $T_e/T_i = 20$. Give $-\\gamma/\\omega_r$ in percent.',
      answer: 1.52,
      tol: 0.03,
      unit: '%',
      hints: ['$\\sqrt{m/M} = 0.0233$ and $\\sqrt{\\pi/8} = 0.627$.', 'The ion term is $20^{1.5}e^{-11.5} = 89.4\\times1.01\\times10^{-5}$.'],
      solution: 'Electron term: $0.02334$. Ion term: $89.4\\times1.01\\times10^{-5} = 9.1\\times10^{-4}$. Sum $0.02425$, times $0.627$: $-\\gamma/\\omega_r = 0.0152$, i.e. 1.5%. At this temperature ratio the ions hardly damp the wave at all; what is left is the electron term. (The exact kinetic root at $k\\lambda_{De} = 0.1$ gives 1.33%.)',
    },
    {
      id: 'A9-p4',
      kind: 'numeric',
      concept: 'particle-trapping',
      prompt: 'In the simulation’s units ($\\omega_{pe} = \\lambda_D = v_{th} = 1$, and $e/m = 1$), a density ripple of relative size $\\alpha$ at wavenumber $k$ makes a field $E_1 = \\alpha/k$, so $\\omega_B = \\sqrt{kE_1}$. At $k = 0.5$ the wave damps at $|\\gamma| = 0.1534$. Above what $\\alpha$ does the bounce frequency exceed the damping rate, so that trapping matters?',
      answer: 0.0235,
      tol: 0.03,
      unit: '',
      hints: ['Show that $\\omega_B = \\sqrt{\\alpha}$, independent of $k$.', 'Set $\\sqrt{\\alpha} = |\\gamma|$.'],
      solution: '$\\omega_B^2 = kE_1 = k\\cdot\\alpha/k = \\alpha$, so $\\omega_B = \\sqrt{\\alpha}$. Setting it equal to $0.1534$ gives $\\alpha = 0.1534^2 = 0.0235$. The benchmark run ($\\alpha = 0.01$, $\\omega_B/|\\gamma| = 0.65$) is below this, so linear theory holds; the Trapping preset ($\\alpha = 0.5$, ratio 4.6) is well above it, and the damping stops.',
    },
    {
      id: 'A9-p5',
      kind: 'mcq',
      concept: 'landau-damping-mechanism',
      prompt: 'Why does a Langmuir wave in a collisionless Maxwellian plasma lose energy?',
      options: [
        'Electrons collide with ions at the wave crests, turning wave energy into heat',
        'Near $v = \\omega/k$ there are more electrons slightly slower than the wave than slightly faster; the wave speeds up the slow ones and slows the fast ones, so on balance it gives energy to the electrons',
        'The fastest electrons outrun the wave and carry its energy away as a heat flux',
        'The wave’s field is screened out by Debye shielding after a few periods',
      ],
      correct: 1,
      hints: ['Which electrons see an almost steady field from the wave? What decides whether they gain or lose energy on average?'],
      solution: 'Only electrons moving at nearly the phase velocity see a steady force and exchange energy with the wave on average. Those slightly slower are accelerated (they gain energy), those slightly faster are decelerated (they give energy). A Maxwellian has negative slope at $v_\\phi > 0$, so the gainers outnumber the givers and the wave loses energy. No collisions are involved, and the “lost” energy sits in fine-scale structure of $f$ in velocity.',
    },
    {
      id: 'A9-p6',
      kind: 'mcq',
      concept: 'bump-on-tail',
      prompt: 'A weak, warm electron beam adds a bump to the tail of a Maxwellian. Which Langmuir waves does it make grow?',
      options: [
        'All of them, as long as the beam is fast enough',
        'Those whose phase velocity $\\omega/k$ lies on the slow side of the bump, where $\\partial f_0/\\partial v > 0$',
        'Those whose phase velocity equals the beam’s thermal spread',
        'Those slower than the thermal electrons, $\\omega/k < v_{th}$',
      ],
      correct: 1,
      hints: ['The growth rate is proportional to $\\hat g^{\\prime}(\\omega/k)$. Where is that positive?'],
      solution: '$\\gamma \\propto \\hat g^{\\prime}(\\omega/k)$. It is positive only between the minimum of $f$ below the bump and the bump’s peak, so only waves with $v_\\phi$ in that window grow (in the simulation’s preset, about 3.1 to 4.5 $v_{th}$). Waves slower than that are Landau damped by the main Maxwellian as usual. The instability saturates when trapping flattens the positive slope into a plateau.',
    },
  ],
  cards: [
    { id: 'A9-c1', front: 'The Vlasov equation, and when it applies', back: '$\\partial f/\\partial t + \\mathbf{v}\\cdot\\nabla f + (q/m)(\\mathbf{E}+\\mathbf{v}\\times\\mathbf{B})\\cdot\\partial f/\\partial\\mathbf{v} = 0$, with E and B from the particles themselves; valid on times short compared with the collision time' },
    { id: 'A9-c2', front: 'Landau’s prescription for the pole at $v = \\omega/k$', back: 'Treat the wave as an initial-value problem: the $v$ integral passes below the pole (for $k > 0$), giving $\\mathcal{P}\\!\\int + i\\pi\\,\\hat g^{\\prime}(\\omega/k)$' },
    { id: 'A9-c3', front: 'Landau damping rate of a Langmuir wave in a Maxwellian', back: '$\\gamma/\\omega_p \\approx -\\sqrt{\\pi/8}\\,(k\\lambda_D)^{-3}\\exp(-1/2k^2\\lambda_D^2 - 3/2)$; exactly $-0.153$ at $k\\lambda_D = 0.5$' },
    { id: 'A9-c4', front: 'What decides between Landau damping and growth?', back: 'The slope of $f_0$ at the phase velocity: $\\gamma = (\\pi/2)\\,\\omega_p(\\omega_p^2/k^2)\\,\\hat g^{\\prime}(\\omega/k)$. Negative slope damps; positive slope (bump on tail) grows' },
    { id: 'A9-c5', front: 'Why do ion acoustic waves need $T_e \\gg T_i$?', back: 'Their speed $c_s \\approx \\sqrt{(kT_e + 3kT_i)/M}$ is only $\\sqrt{T_e/T_i + 3}$ ion thermal speeds; unless $T_e/T_i \\gtrsim 10$ many ions are resonant and damp the wave strongly (for $T_e \\approx T_i$, within a period)' },
    { id: 'A9-c6', front: 'Bounce frequency, and when trapping stops Landau damping', back: '$\\omega_B = \\sqrt{ekE_1/m}$. If $\\omega_B \\gg |\\gamma|$, trapped electrons bounce and return energy to the wave, and the damping stops (O’Neil)' },
  ],
}
