import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { DiamagSim } from '../sims/DiamagSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A4: Lesson = {
  id: 'A4',
  title: 'Plasmas as fluids',
  subtitle: 'Two-fluid equations, fluid drifts and the diamagnetic current',
  minutes: 55,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 3 (the fluid equation of motion, fluid drifts perpendicular and parallel to B, the plasma approximation)',
    'Bellan, Fundamentals of Plasma Physics, Ch. 2 (from Vlasov to the two-fluid equations)',
    'Fitzpatrick, Plasma Physics (open lecture notes), the chapter on plasma fluid theory',
  ],
  objectives: [
    'Write the two-fluid continuity and momentum equations and say what every term does',
    'Derive the fluid drift $\\mathbf{u}_\\perp = \\mathbf{v}_E + \\mathbf{v}_D$ and explain why the diamagnetic drift moves the fluid but no guiding centre',
    'Use the Boltzmann relation and the plasma approximation, and say when each one fails',
  ],
  sections: [
    { id: 'idea', label: 'Why a fluid?' },
    { id: 'equations', label: 'Two-fluid equations' },
    { id: 'drifts', label: 'Fluid drifts' },
    { id: 'origin', label: 'Where it comes from' },
    { id: 'parallel', label: 'Along B' },
    { id: 'quasi', label: 'Plasma approximation' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>Why a fluid?</h2>
        <p>
          In A2 and A3 we followed one particle at a time through fields that were simply given. A laboratory plasma easily holds
          10<sup>16</sup> or more particles in every cubic metre (a tokamak about 10<sup>20</sup>), and they make the fields they move in. Following each one is
          hopeless, and usually pointless: what you can measure (density, flow, pressure, current) are averages over many particles.
          Fluid theory tracks those averages directly.
        </p>
        <p>
          Averaging works when a small parcel of plasma, a <strong>fluid element</strong>, holds many particles that stay together long
          enough to act as one. In air, collisions keep the molecules of a parcel together. In a magnetized plasma, gyration does the
          job across the field: apart from slow drifts, no particle strays more than a Larmor radius from its field line. Along the field nothing holds the
          particles back except collisions, so that is where fluid theory is weakest and kinetic theory (A9) takes over.
        </p>
        <p>
          We keep <strong>two fluids</strong>, one for electrons and one for ions, because their masses and temperatures are so
          different. Each has its own density <M>{'n_s'}</M>, velocity <M>{'\\mathbf{u}_s'}</M> and pressure <M>{'p_s'}</M>. The two
          fluids never touch directly (in this lesson we ignore collisions). They talk only through <M>{'\\mathbf{E}'}</M> and{' '}
          <M>{'\\mathbf{B}'}</M>, which they create themselves through their charge and current.
        </p>
      </section>

      <section id="equations">
        <h2>The two-fluid equations</h2>
        <p>
          First, bookkeeping. If particles are neither created nor destroyed (no ionization or recombination), the density at a point
          can only change by particles flowing in or out.
        </p>
        <Eq
          title="Continuity"
          src="\dfrac{\partial \s{n}{n}}{\partial \s{t}{t}} + \nabla\cdot(\s{n}{n}\,\s{u}{\mathbf{u}}) = 0"
          symbols={{
            n: { name: 'n, number density of one species', units: 'm⁻³', note: 'Electrons and ions each have their own continuity equation.' },
            t: { name: 't, time', units: 's', note: 'Time at a fixed point in space.' },
            u: { name: 'u, fluid velocity', units: 'm/s', note: 'The average velocity of the particles in a fluid element. Individual particles move much faster, in all directions.' },
          }}
          says="The density at a point rises only if more particles flow in than flow out. The flux nu is the number of particles crossing a unit area per second."
        />
        <p>
          Next, Newton's law for a fluid element. The acceleration has to be measured <em>while moving with the fluid</em>. Think of a
          weather balloon drifting with the wind: its thermometer reading changes because the day warms up (a change in time at a fixed
          place, <M>{'\\partial T/\\partial t'}</M>) and because the balloon drifts into colder air (<M>{'\\mathbf{u}\\cdot\\nabla T'}</M>).
          The sum is the <strong>convective derivative</strong> <M>{'d/dt = \\partial/\\partial t + \\mathbf{u}\\cdot\\nabla'}</M>.
        </p>
        <Eq
          title="Momentum equation (one species)"
          src="\begin{aligned} \s{m}{m}\s{n}{n}\,\dfrac{d\s{u}{\mathbf{u}}}{dt} &= \s{q}{q}\s{n}{n}\left(\s{E}{\mathbf{E}} + \s{u}{\mathbf{u}}\times\s{B}{\mathbf{B}}\right) - \s{p}{\nabla p} \\ \dfrac{d}{dt} &= \dfrac{\partial}{\partial t} + \s{conv}{\mathbf{u}\cdot\nabla} \end{aligned}"
          symbols={{
            m: { name: 'm, particle mass', units: 'kg', note: 'mn is the mass density of this species. Electrons have almost none, which is why their inertia is often dropped.' },
            n: { name: 'n, density', units: 'm⁻³', note: 'The force terms are per unit volume, so every force is multiplied by n.' },
            u: { name: 'u, fluid velocity', units: 'm/s', note: 'Average velocity of the species.' },
            conv: { name: 'u·∇, convective part of d/dt', units: '1/s', note: 'Applied to u it gives (u·∇)u: the velocity change a fluid element sees because it moves to a place where the flow is different. It is quadratic in u, the source of most fluid nonlinearity.' },
            q: { name: 'q, charge', units: 'C', note: '+e for singly charged ions, −e for electrons.' },
            E: { name: 'E, electric field', units: 'V/m', note: 'Set by all charges together through Maxwell’s equations.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'Acts on the average velocity u, just as it acts on a single particle’s v.' },
            p: { name: '∇p, pressure gradient', units: 'N/m³', note: 'Random thermal motion carries momentum across the surface of the element. More particles hit it from the high-pressure side, so it is pushed toward low pressure. This term has no counterpart in single-particle motion.' },
          }}
          says="Each fluid element is pushed by the Lorentz force on all of its charges and by the pressure difference across it. Collisions would add a friction term between the species (lesson A7)."
        />
        <p>
          The pressure needs one more relation, an <strong>equation of state</strong>. For slow changes heat has time to flow and the
          temperature stays fixed (isothermal, <M>{'\\gamma = 1'}</M>). For fast changes heat cannot flow and the compression is
          adiabatic, with <M>{'\\gamma = (N+2)/N'}</M> for <M>{'N'}</M> compressed degrees of freedom.
        </p>
        <Eq
          title="Equation of state"
          src="\dfrac{\nabla \s{p}{p}}{\s{p}{p}} = \s{g}{\gamma}\,\dfrac{\nabla \s{n}{n}}{\s{n}{n}} \qquad (p \propto n^{\gamma})"
          symbols={{
            p: { name: 'p = nkT, pressure', units: 'Pa', note: 'For an ideal gas of particles p = nkT. Its gradient is the force per unit volume in the momentum equation.' },
            g: { name: 'γ, ratio of specific heats', note: 'γ = 1 isothermal; 5/3 for three-dimensional adiabatic compression; 3 when a wave squeezes the particles along one direction only, faster than they can share energy with the other directions.' },
            n: { name: 'n, density', units: 'm⁻³', note: 'Compressing the fluid raises its density and, unless it is isothermal, its temperature too.' },
          }}
          says="Squeeze a fluid and its pressure rises faster than its density whenever γ > 1, because the temperature rises as well. For isothermal plasma ∇p = kT∇n."
        />
        <div className="grid three">
          <div className="card">
            <span className="pill ghost">γ = 1 · isothermal</span>
            <p style={{ marginTop: 10 }}>Slow changes: heat flows freely and evens out the temperature. Used for the drifts below.</p>
          </div>
          <div className="card">
            <span className="pill ghost">γ = 5/3 · 3D adiabatic</span>
            <p style={{ marginTop: 10 }}>Fast, isotropic compression of a monatomic gas. Used for ordinary sound and in MHD.</p>
          </div>
          <div className="card">
            <span className="pill ghost">γ = 3 · 1D adiabatic</span>
            <p style={{ marginTop: 10 }}>A wave that compresses the particles along one direction only, like the electron plasma waves of A5.</p>
          </div>
        </div>
        <p>
          Count the unknowns: <M>{'n'}</M>, <M>{'\\mathbf{u}'}</M> and <M>{'p'}</M> for each of two species (10), plus{' '}
          <M>{'\\mathbf{E}'}</M> and <M>{'\\mathbf{B}'}</M> (6). Count the equations: two continuity, six momentum components, two
          equations of state, and Faraday’s and Ampère’s laws (6), with the current density{' '}
          <M>{'\\sum_s q_s n_s \\mathbf{u}_s'}</M> as the source. Sixteen of each: the set is closed. (Gauss’s laws, with charge density{' '}
          <M>{'\\sum_s q_s n_s'}</M>, only constrain the starting state; the other equations then keep them satisfied.)
        </p>
      </section>

      <section id="drifts">
        <h2>Fluid drifts across B</h2>
        <p>
          Now look for slow, steady flows across a uniform field. “Slow” means the fluid changes on timescales much longer than a
          gyro-period, so the inertia on the left of the momentum equation is small compared with the magnetic force.
        </p>
        <Derivation
          lessonId="A4"
          id="fluid-drift"
          title="Fluid drifts from the momentum equation"
          steps={[
            {
              text: 'Drop the inertia. For changes at frequency ω, the left side is smaller than the magnetic force by about ω/ω_c.',
              math: '0 = qn\\left(\\mathbf{E} + \\mathbf{u}_\\perp \\times \\mathbf{B}\\right) - \\nabla p',
              why: 'mn du/dt ~ mnωu while qnuB = mnω_c u. For ω ≪ ω_c the inertia is negligible, just as for guiding-centre drifts in A2.',
            },
            {
              text: 'Take the cross product of every term with B.',
              math: '\\begin{aligned} 0 = qn\\big[&\\mathbf{E}\\times\\mathbf{B} + (\\mathbf{u}_\\perp\\times\\mathbf{B})\\times\\mathbf{B}\\big] \\\\ &- \\nabla p\\times\\mathbf{B} \\end{aligned}',
            },
            {
              text: 'Simplify the double cross product. u⊥ is perpendicular to B by definition.',
              math: '\\begin{gathered} (\\mathbf{u}_\\perp\\times\\mathbf{B})\\times\\mathbf{B} \\\\ = \\mathbf{B}(\\mathbf{u}_\\perp\\cdot\\mathbf{B}) - B^2\\mathbf{u}_\\perp = -B^2\\,\\mathbf{u}_\\perp \\end{gathered}',
              why: 'The identity (a×b)×c = b(a·c) − a(b·c), with u⊥·B = 0.',
            },
            {
              text: 'Solve for the perpendicular fluid velocity.',
              math: '\\begin{aligned} \\mathbf{u}_\\perp &= \\dfrac{\\mathbf{E}\\times\\mathbf{B}}{B^2} - \\dfrac{\\nabla p\\times\\mathbf{B}}{qnB^2} \\\\ &\\equiv \\mathbf{v}_E + \\mathbf{v}_D \\end{aligned}',
              why: 'The first term is the E×B drift of A2, the same for every species. The second is new: the diamagnetic drift. It depends on the sign of q, so ions and electrons drift in opposite directions.',
            },
            {
              text: 'For isothermal species ∇p = kT∇n. Its size is set by the density gradient length L_n = n/|∇n|.',
              math: 'v_D = \\dfrac{kT}{eB}\\,\\dfrac{1}{L_n}',
              why: 'Multiply top and bottom by the thermal speed and it reads v_D = v_th (ρ/L_n) with v_th = √(kT/m) and ρ = v_th/ω_c: the diamagnetic drift is slower than thermal motion by the small ratio ρ/L_n.',
            },
            {
              text: 'Opposite charges drifting in opposite directions make a current. Add the ion and electron contributions.',
              math: '\\begin{aligned} \\mathbf{J}_D &= en(\\mathbf{v}_{Di} - \\mathbf{v}_{De}) \\\\ &= (kT_i + kT_e)\\,\\dfrac{\\mathbf{B}\\times\\nabla n}{B^2} \\end{aligned}',
              why: 'In general J_D = B×∇p/B² with p = p_i + p_e. Check: J_D×B = ∇p, so this current is exactly what holds the plasma pressure against the magnetic field (lesson A8).',
            },
          ]}
        />
        <Eq
          title="Diamagnetic drift"
          src="\s{vD}{\mathbf{v}_D} = -\dfrac{\s{p}{\nabla p}\times\s{B}{\mathbf{B}}}{\s{q}{q}\,\s{n}{n}\,\s{B}{B}^2}"
          plot="a4-diamagnetic-drift"
          symbols={{
            vD: { name: 'v_D, diamagnetic drift', units: 'm/s', note: 'A velocity of the fluid, perpendicular to both B and the pressure gradient. No guiding centre moves with it.' },
            p: { name: '∇p, pressure gradient', units: 'Pa/m', note: 'Points toward higher pressure: denser or hotter plasma. In a magnetized column it points inward, toward the axis.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'A stronger field gives smaller orbits and a slower drift.' },
            q: { name: 'q, charge', units: 'C', note: 'The sign flips the direction: ions and electrons drift opposite ways, so their currents add.' },
            n: { name: 'n, density', units: 'm⁻³', note: 'For isothermal plasma ∇p/n = kT∇n/n = kT/L_n in size.' },
          }}
          says="The fluid flows along the lines of constant pressure, around the plasma column, in opposite senses for ions and electrons. The mass of the particles does not appear."
        />
        <Plotter spec={plotById('a4-drift-compare')!} />
        <p>
          Why “diamagnetic”? The current <M>{'\\mathbf{J}_D'}</M> circulates in the sense that <em>weakens</em> the field inside the
          plasma, like a diamagnetic material. Each gyrating particle is a small current loop whose magnetic moment points against{' '}
          <M>{'\\mathbf{B}'}</M> (A3). The ratio of plasma pressure to magnetic pressure, <M>{'\\beta = p/(B^2/2\\mu_0)'}</M>, measures how
          much of the field the plasma pushes aside.
        </p>
        <div className="grid three">
          <div className="card">
            <span className="pill">E×B</span>
            <p style={{ marginTop: 10 }}>Particles and fluid both move, at the same speed. No current, because every species moves together.</p>
          </div>
          <div className="card">
            <span className="pill">Diamagnetic</span>
            <p style={{ marginTop: 10 }}>Only the fluid moves. Guiding centres stay put. It exists only when there is a pressure gradient.</p>
          </div>
          <div className="card">
            <span className="pill">∇B and curvature</span>
            <p style={{ marginTop: 10 }}>Guiding centres drift, but in a plasma of uniform, isotropic pressure the magnetization current of the gyrating particles cancels their current exactly.</p>
          </div>
        </div>
      </section>

      <section id="origin">
        <h2>Where does the diamagnetic current come from?</h2>
        <p>
          Here is the puzzle. In A2 no single-particle drift looked like <M>{'\\mathbf{v}_D'}</M>. With uniform <M>{'\\mathbf{B}'}</M> and no{' '}
          <M>{'\\mathbf{E}'}</M>, the guiding centres do not move at all. Yet the fluid flows. The answer is in how you count.
        </p>
        <p>
          Draw a short line in the plasma and count particles crossing it. An ion gyrates clockwise when <M>{'\\mathbf{B}'}</M> points out of
          the screen. It crosses the line upward on the left side of its orbit, which means its guiding centre is to the <em>right</em> of
          the crossing point. The ones crossing downward have their guiding centres to the left. Put the denser plasma on the right and
          more particles cross upward than downward. There is a net flux, although no guiding centre goes anywhere.
        </p>
        <DiamagSim />
        <p>
          With uniform density and a temperature gradient, the guiding centres are spread evenly, but the orbits on the hot side are
          bigger, so they reach the line more often. The flux follows the <em>pressure</em>, exactly as the fluid equation says.
        </p>
        <Derivation
          lessonId="A4"
          id="counting"
          title="Counting crossings gives the diamagnetic flux"
          steps={[
            {
              text: 'An ion with guiding centre (X, Y) and Larmor radius ρ cuts the horizontal line y = y₀ at two points, if |Y − y₀| < ρ.',
              math: '\\begin{gathered} x = X \\mp s \\\\ s = \\sqrt{\\rho^2 - (Y - y_0)^2} \\end{gathered}',
              why: 'Plain geometry: the circle of radius ρ about (X, Y) meets the line where (x − X)² + (y₀ − Y)² = ρ².',
            },
            {
              text: 'Moving clockwise, the ion crosses upward at the left point and downward at the right point, once each per gyro-period. So an upward crossing at x comes from a guiding centre at x + s, a downward one from x − s.',
            },
            {
              text: 'Count crossings through a unit length of line in one period. Guiding centres have density n(X); add up over all heights Y within reach.',
              math: '\\begin{aligned} &N_\\uparrow - N_\\downarrow \\\\ &= \\textstyle\\int dY\\,\\big[n(x+s) - n(x-s)\\big] \\\\ &\\approx \\dfrac{dn}{dx}\\textstyle\\int 2s\\,dY = \\pi\\rho^2\\,\\dfrac{dn}{dx} \\end{aligned}',
              why: 'Taylor-expand n(x ± s) = n(x) ± s n′. The integral of 2s over Y is the area of the orbit, πρ².',
            },
            {
              text: 'Divide by the period 2π/ω_c to get a flux (particles per unit length per second).',
              math: '\\begin{aligned} \\Gamma_y &= \\dfrac{\\omega_c}{2\\pi}\\,\\pi\\rho^2\\,\\dfrac{dn}{dx} \\\\ &= \\dfrac{m v_\\perp^2}{2qB}\\,\\dfrac{dn}{dx} \\end{aligned}',
              why: 'ρ = v⊥/ω_c and ω_c = qB/m, so ω_c ρ²/2 = m v⊥²/(2qB). This is μ/q: each particle behaves as a current loop.',
            },
            {
              text: 'Average over a Maxwellian, where ⟨v⊥²⟩ = 2kT/m (two degrees of freedom).',
              math: '\\Gamma_y = \\dfrac{kT}{qB}\\,\\dfrac{dn}{dx} = n\\,v_D',
              why: 'Compare the fluid result: v_D = −∇p×B/(qnB²) with ∇p = kT n′ x̂ and B = B ẑ gives v_D = (kT n′/qnB) ŷ. The same.',
            },
            {
              text: 'If the temperature varies too, the orbit size depends on X, and the same count gives the pressure gradient.',
              math: '\\Gamma_y = \\dfrac{1}{qB}\\,\\dfrac{d(nkT)}{dx} = \\dfrac{1}{qB}\\,\\dfrac{dp}{dx}',
              why: 'Only the product n⟨ρ²⟩ ∝ nT = p enters the count. The current qΓ is the curl of the magnetization M = −(p/B) ẑ of all those current loops: J = ∇×M = B×∇p/B².',
            },
          ]}
        />
      </section>

      <section id="parallel">
        <h2>Along the field: the Boltzmann relation</h2>
        <p>
          Along <M>{'\\mathbf{B}'}</M> the Lorentz force vanishes, and the electron momentum equation balances just two forces: the
          electric field and the pressure gradient. Electron inertia is tiny, so for anything slower than the electrons’ own response
          the two forces cancel: <M>{'en\\,\\partial\\phi/\\partial z = kT_e\\,\\partial n/\\partial z'}</M> for isothermal electrons.
          Integrate once.
        </p>
        <Eq
          title="Boltzmann relation"
          src="\s{n}{n_e} = \s{n0}{n_0}\,\exp\!\left(\dfrac{\s{e}{e}\,\s{phi}{\phi}}{\s{kT}{kT_e}}\right)"
          plot="a4-boltzmann"
          symbols={{
            n: { name: 'n_e, electron density', units: 'm⁻³', note: 'Local electron density along the field line.' },
            n0: { name: 'n₀, reference density', units: 'm⁻³', note: 'Density where φ = 0.' },
            e: { name: 'e, elementary charge', units: 'C', note: 'Electrons have charge −e, so they gather where φ is high.' },
            phi: { name: 'φ, electrostatic potential', units: 'V', note: 'Measured from where n = n₀.' },
            kT: { name: 'kT_e, electron temperature', units: 'J (or eV)', note: 'Every kT_e/e volts of potential changes the density by a factor e ≈ 2.7.' },
          }}
          says="Electrons are so light and mobile that along B they instantly arrange themselves in the potential. It is the Boltzmann factor of A1, here derived from force balance rather than from thermodynamics."
        />
        <p>
          This relation sets the potential of sheaths at walls, lets Langmuir probes measure <M>{'T_e'}</M> from an exponential current
          trace, and provides the “spring” in ion acoustic waves (A5). It fails when the electrons cannot keep up: in waves whose phase
          velocity approaches the electron thermal speed, or at frequencies near <M>{'\\omega_{pe}'}</M>.
        </p>
      </section>

      <section id="quasi">
        <h2>The plasma approximation</h2>
        <p>
          Poisson’s equation, <M>{'\\varepsilon_0\\nabla\\cdot\\mathbf{E} = e(n_i - n_e)'}</M>, involves the small difference of two huge
          numbers. For slow motions on scales much larger than <M>{'\\lambda_D'}</M> there is a better route: set <M>{'n_i = n_e = n'}</M>{' '}
          and find <M>{'\\mathbf{E}'}</M> from the fluid equations (for example, from the Boltzmann relation) instead of from Poisson.
          This does <em>not</em> mean <M>{'\\nabla\\cdot\\mathbf{E} = 0'}</M>. It means the imbalance needed to make the field is too small to
          matter for the densities.
        </p>
        <Eq
          title="How neutral is quasi-neutral?"
          src="\dfrac{\s{dn}{n_i - n_e}}{\s{n1}{n_1}} = \dfrac{(\s{k}{k}\,\s{lam}{\lambda_D})^2}{1 + (\s{k}{k}\,\s{lam}{\lambda_D})^2}"
          symbols={{
            dn: { name: 'n_i − n_e, charge imbalance', units: 'm⁻³', note: 'The uncompensated charge that produces the electric field.' },
            n1: { name: 'n₁, density ripple', units: 'm⁻³', note: 'Amplitude of a sinusoidal ion density perturbation, with Boltzmann electrons responding to it.' },
            k: { name: 'k, wavenumber of the ripple', units: 'm⁻¹', note: 'k = 2π/wavelength. Long ripples mean small k.' },
            lam: { name: 'λ_D, Debye length', units: 'm', note: 'Below this scale electrons cannot shield, and neutrality fails.' },
          }}
          says="For ripples much longer than λ_D the imbalance is a tiny fraction of the ripple (about 2×10⁻⁴ in problem 4), yet that tiny imbalance carries the whole electric field. When kλ_D approaches 1 the approximation fails: that is the Debye correction to ion waves in A5."
        />
      </section>

      <section id="next">
        <h2>Where this goes</h2>
        <p>
          A5 linearizes exactly these equations to find the electrostatic waves of a plasma, using <M>{'\\gamma_e = 3'}</M> for fast
          electron oscillations and the Boltzmann relation plus the plasma approximation for slow ion waves. A7 adds collisions to the
          momentum equation to get diffusion and resistivity, and A8 uses <M>{'\\mathbf{J}\\times\\mathbf{B} = \\nabla p'}</M>, the
          diamagnetic current at work, to hold a plasma in equilibrium.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'A4-p1',
      kind: 'numeric',
      prompt: 'A hydrogen plasma column sits in a field $B = 0.5$ T. The ions have a uniform temperature of 100 eV and the density gradient length is $L_n = n/|\\nabla n| = 2$ cm. What is the ion diamagnetic drift speed, in km/s?',
      answer: 10,
      tol: 0.03,
      unit: 'km/s',
      hints: ['For uniform temperature, $v_D = kT/(eBL_n)$.', 'With $T$ in eV, $kT/e$ is just $T$ in volts: 100 V.'],
      solution: '$v_D = 100\\ \\text{V}/(0.5\\ \\text{T} \\times 0.02\\ \\text{m}) = 1.0\\times10^4$ m/s $= 10$ km/s. For comparison the ion thermal speed $\\sqrt{kT/M} \\approx 98$ km/s and $\\rho_i \\approx 2.0$ mm, so $v_D/v_{ti} = \\rho_i/L_n \\approx 0.10$.',
      concept: 'diamagnetic-drift',
    },
    {
      id: 'A4-p2',
      kind: 'numeric',
      prompt: 'At a point where $n = 10^{19}\\ \\text{m}^{-3}$, the density gradient length is 5 cm, $T_e = T_i = 20$ eV and $B = 1$ T. What is the total diamagnetic current density, in A/m²?',
      answer: 1282,
      tol: 0.03,
      unit: 'A/m²',
      hints: ['$J_D = (kT_i + kT_e)\\,|\\nabla n|/B$.', '$|\\nabla n| = n/L_n = 2\\times10^{20}\\ \\text{m}^{-4}$ and $kT_i + kT_e = 40$ eV $= 6.41\\times10^{-18}$ J.'],
      solution: '$J_D = 6.41\\times10^{-18}\\ \\text{J} \\times 2\\times10^{20}\\ \\text{m}^{-4} / 1\\ \\text{T} \\approx 1.28\\times10^3$ A/m². Ions and electrons drift in opposite directions, so their currents add.',
      concept: 'diamagnetic-current',
    },
    {
      id: 'A4-p3',
      kind: 'numeric',
      prompt: 'Electrons with $T_e = 5$ eV are in force balance along a field line. The electron density at point A is 3 times that at point B on the same line. What is the potential difference $\\phi_A - \\phi_B$, in volts?',
      answer: 5.49,
      tol: 0.02,
      unit: 'V',
      hints: ['Boltzmann: $n_A/n_B = \\exp[e(\\phi_A - \\phi_B)/kT_e]$.', 'Take the logarithm: $\\phi_A - \\phi_B = (kT_e/e)\\ln 3$.'],
      solution: '$\\phi_A - \\phi_B = 5\\ \\text{V}\\times\\ln 3 = 5.49$ V. Positive: electrons crowd where the potential is higher.',
      concept: 'boltzmann-relation',
    },
    {
      id: 'A4-p4',
      kind: 'numeric',
      prompt: 'A plasma with $n = 10^{18}\\ \\text{m}^{-3}$ and $T_e = 10$ eV carries a small ion density ripple of wavelength 1 cm. The electrons follow the Boltzmann relation. What is $(n_i - n_e)/n_1$, the charge imbalance as a fraction of the ripple amplitude? (Enter it like 3e-4.)',
      answer: 2.18e-4,
      tol: 0.03,
      unit: '',
      hints: ['$(n_i - n_e)/n_1 = (k\\lambda_D)^2/[1 + (k\\lambda_D)^2]$.', '$\\lambda_D = 23.5$ µm and $k = 2\\pi/0.01\\ \\text{m} = 628\\ \\text{m}^{-1}$.'],
      solution: '$k\\lambda_D = 628 \\times 2.35\\times10^{-5} = 0.0148$, so the ratio is $0.0148^2/(1 + 0.0148^2) \\approx 2.18\\times10^{-4}$. The plasma is neutral to two parts in ten thousand relative to the ripple, which is why setting $n_i = n_e$ works so well.',
      concept: 'plasma-approximation',
    },
    {
      id: 'A4-p5',
      kind: 'mcq',
      prompt: 'In the diamagnetic simulation you switch from ions to electrons, keeping the same temperature and density gradient. What happens?',
      options: ['The particle flux and the current both reverse', 'The particle flux reverses but the current keeps its direction', 'Nothing changes, because the flux depends only on $\\nabla p$', 'The flux vanishes, because electrons are so light'],
      correct: 1,
      hints: ['Which way do electrons gyrate compared with ions?', 'The current is $q\\Gamma$.'],
      solution: 'Electrons gyrate the other way, so the crossers from the dense side now move downward and $\\Gamma$ reverses. The current $q\\Gamma$ flips sign twice and keeps its direction, so the ion and electron diamagnetic currents add. The mass never enters $v_D$.',
      concept: 'diamagnetic-drift',
    },
    {
      id: 'A4-p6',
      kind: 'mcq',
      prompt: 'In a magnetized column the electrons happen to follow the Boltzmann relation across the field as well, $n = n_0 e^{e\\phi/kT_e}$, with the density peaked on the axis. How do the electron E×B drift and the electron diamagnetic drift compare?',
      options: ['They add, so the electrons rotate twice as fast as the ions', 'They cancel exactly, so the electron fluid does not rotate', 'Both are zero', 'Both point along B'],
      correct: 1,
      hints: ['Boltzmann gives $\\nabla\\phi = (kT_e/e)\\,\\nabla n/n$.', 'Write $\\mathbf{v}_E = -\\nabla\\phi\\times\\mathbf{B}/B^2$ and $\\mathbf{v}_{De} = kT_e\\,\\nabla n\\times\\mathbf{B}/(enB^2)$.'],
      solution: 'Substituting $\\nabla\\phi$ gives $\\mathbf{v}_E = -(kT_e/e)\\,\\nabla n\\times\\mathbf{B}/(nB^2) = -\\mathbf{v}_{De}$. The two cancel: the electric field that holds the electrons in Boltzmann balance is exactly the one whose E×B drift undoes their diamagnetic flow.',
      concept: 'fluid-drifts',
    },
  ],
  cards: [
    { id: 'A4-c1', front: 'Fluid momentum equation for one species', back: '$mn\\,[\\partial_t\\mathbf{u} + (\\mathbf{u}\\cdot\\nabla)\\mathbf{u}] = qn(\\mathbf{E} + \\mathbf{u}\\times\\mathbf{B}) - \\nabla p$' },
    { id: 'A4-c2', front: 'Convective derivative', back: '$d/dt = \\partial/\\partial t + \\mathbf{u}\\cdot\\nabla$: the change seen while moving with the fluid' },
    { id: 'A4-c3', front: 'Diamagnetic drift, and its size', back: '$\\mathbf{v}_D = -\\nabla p\\times\\mathbf{B}/(qnB^2)$; $v_D = kT/(eBL_n) = v_{th}\\,\\rho/L_n$' },
    { id: 'A4-c4', front: 'Why does the fluid flow when no guiding centre moves?', back: 'Gyration in a gradient: more particles cross any line from the denser (or hotter) side. Net flux, no drift.' },
    { id: 'A4-c5', front: 'Boltzmann relation, and where it comes from', back: '$n_e = n_0\\exp(e\\phi/kT_e)$: electron force balance along B with inertia neglected' },
    { id: 'A4-c6', front: 'Plasma approximation', back: 'Set $n_i = n_e$ but keep $\\mathbf{E}$; the imbalance is $\\sim(k\\lambda_D)^2$ of the perturbation, so it fails at $k\\lambda_D \\sim 1$' },
  ],
}
