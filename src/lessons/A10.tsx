import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { KdvSim } from '../sims/KdvSim'
import { SheathSim } from '../sims/SheathSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A10: Lesson = {
  id: 'A10',
  title: 'Nonlinear effects',
  subtitle: 'Sheaths and the Bohm criterion, shocks and solitons, the ponderomotive force and parametric instabilities',
  minutes: 60,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 8 (Nonlinear effects): sheaths, the Bohm criterion and the Child–Langmuir law, ion acoustic shock waves and the Sagdeev potential, the ponderomotive force, parametric instabilities, plasma echoes, the Korteweg–de Vries equation',
    'Lieberman & Lichtenberg, Principles of Plasma Discharges and Materials Processing: the chapter on DC sheaths (Bohm criterion, presheath, floating wall, Child law)',
    'Kruer, The Physics of Laser Plasma Interactions: the ponderomotive force and parametric instabilities (the core of Track B)',
  ],
  objectives: [
    'Derive the Bohm criterion $u_0 \\geq c_s$ and the floating wall potential $e\\phi_w/kT_e = \\tfrac12\\ln(2\\pi m_e/M) - \\tfrac12$',
    'Explain solitons as a balance of steepening and dispersion, using the Sagdeev potential and the KdV equation',
    'Compute the ponderomotive force and potential of a laser, and state the matching conditions $\\omega_0 = \\omega_1 + \\omega_2$, $\\mathbf{k}_0 = \\mathbf{k}_1 + \\mathbf{k}_2$',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'sheath', label: 'Sheaths' },
    { id: 'bohm', label: 'Bohm criterion' },
    { id: 'wall', label: 'Floating wall' },
    { id: 'shocks', label: 'Shocks' },
    { id: 'kdv', label: 'Solitons' },
    { id: 'ponder', label: 'Ponderomotive' },
    { id: 'parametric', label: 'Parametric' },
    { id: 'echoes', label: 'Echoes' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          Every wave in A5 and A6 came from one trick: assume the disturbance is small, keep only terms linear in it, and throw away
          products like <M>{'n_1 v_1'}</M> or <M>{'v_1\\,\\partial v_1/\\partial x'}</M>. Linear waves then add up without noticing each
          other, and their amplitude never matters.
        </p>
        <p>
          This lesson is about what those discarded terms do. They matter in three places. At a <strong>wall</strong>, the potential
          drops by several kT_e/e, which is not small, so the Boltzmann factor cannot be linearized. In a <strong>large wave</strong>, the
          crest outruns the trough, the wave steepens, and it either breaks into a shock or balances against dispersion as a soliton.
          And in <strong>intense light</strong>, the oscillating field pushes plasma out of bright regions (the ponderomotive force) and
          lets one wave feed two others (parametric instabilities). These last two are central to Track B.
        </p>
      </section>

      <section id="sheath">
        <h2>Sheaths</h2>
        <p>
          Put a wall into a plasma. Electrons move about <M>{'\\sqrt{M/m_e}'}</M> times faster than ions at similar temperatures, so at
          first the wall collects far more electrons than ions and charges negative. It keeps charging until its potential turns back all
          but just enough electrons to match the ion flux. The potential drop sits in a thin layer a few Debye lengths thick, the
          <strong> sheath</strong>, where the plasma is not neutral. Everywhere else it stays neutral: the sheath is Debye shielding of
          the wall.
        </p>
        <p>
          Inside the sheath, electrons are repelled and follow the Boltzmann factor. Cold ions fall down the potential hill: they speed up,
          and since their flux is constant, their density drops. Poisson's equation ties the two together.
        </p>
        <Eq
          title="Planar sheath equation"
          src="\begin{gathered}\s{eps}{\varepsilon_0}\dfrac{d^2\s{phi}{\phi}}{dx^2} = \s{e}{e}\,(n_e - n_i) \\ n_e = \s{ns}{n_s}\,e^{e\phi/\s{kT}{kT_e}} \\ n_i = n_s\left(1 - \dfrac{2e\phi}{\s{M}{M}\s{u}{u_0}^2}\right)^{-1/2}\end{gathered}"
          symbols={{
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: 'Turns net charge density into curvature of the potential.' },
            phi: { name: 'φ(x), potential', units: 'V', note: 'Measured from the sheath edge, where φ = 0. It falls (φ < 0) toward a floating or negatively biased wall.' },
            e: { name: 'e, elementary charge', units: 'C', note: 'Singly charged ions are assumed.' },
            ns: { name: 'n_s, density at the sheath edge', units: 'm⁻³', note: 'Ions and electrons are equally dense here; it is about 0.61 of the bulk density because of the presheath.' },
            kT: { name: 'kT_e, electron temperature', units: 'J', note: 'Sets how quickly electrons are turned away: their density falls by a factor e for every kT_e/e of potential drop.' },
            M: { name: 'M, ion mass', units: 'kg', note: 'The ions are taken as cold (T_i ≪ T_e), so they all move at one speed.' },
            u: { name: 'u₀, ion speed at the sheath edge', units: 'm/s', note: 'Energy conservation, ½Mu² = ½Mu₀² − eφ, and flux conservation, n_i u = n_s u₀, give the ion term.' },
          }}
          says="Electrons follow the Boltzmann factor; ions keep their flux while speeding up, so their density falls too. Where ions outnumber electrons the potential curves downward and keeps falling toward the wall; where electrons win it curves back up."
        />
      </section>

      <section id="bohm">
        <h2>The Bohm criterion</h2>
        <p>
          The sheath equation has a catch. Near the edge the potential has fallen only a little, and both densities have fallen a little.
          If the ions thin out faster than the electrons, the charge there is negative and the potential bends back up instead of falling
          on to the wall. Which one thins faster depends on how fast the ions arrive: slow ions are strongly affected by a small push, fast
          ions hardly notice. Try it.
        </p>
        <SheathSim />
        <Derivation
          lessonId="A10"
          id="bohm"
          title="Ions must enter at the sound speed"
          steps={[
            { text: 'Use dimensionless variables: the potential drop χ = −eφ/kT_e, distance ξ = x/λ_D (with the edge density n_s), and the entry Mach number 𝓜 = u₀/c_s with c_s = √(kT_e/M). The sheath equation becomes', math: '\\chi\'\' = \\left(1 + \\dfrac{2\\chi}{\\mathcal{M}^2}\\right)^{-1/2} - e^{-\\chi}', why: 'Divide Poisson by e n_s and use λ_D² = ε₀kT_e/(n_s e²). The ion term: 2eφ/(Mu₀²) = −2χ kT_e/(Mu₀²) = −2χ/𝓜². Primes are derivatives with respect to ξ.' },
            { text: 'Multiply both sides by χ′ and integrate from the sheath edge, where χ = 0 and the field χ′ ≈ 0.', math: '\\tfrac12\\chi\'^2 = \\mathcal{M}^2\\left[\\left(1+\\dfrac{2\\chi}{\\mathcal{M}^2}\\right)^{1/2} - 1\\right] + e^{-\\chi} - 1', why: 'χ′χ″ = (½χ′²)′, and each term on the right is χ′ times a function of χ, so it integrates directly. This is the same "energy" trick as for a ball rolling in a potential.' },
            { text: 'The left side is a square, so the right side must be positive for every χ > 0 in the sheath. The hardest place is just inside the edge, where χ is small.' },
            { text: 'Expand the right side for small χ. The linear terms cancel and the first survivor is quadratic.', math: '\\tfrac12\\chi\'^2 \\approx \\tfrac12\\chi^2\\left(1 - \\dfrac{1}{\\mathcal{M}^2}\\right)', why: '𝓜²[(1 + 2χ/𝓜²)^{1/2} − 1] ≈ χ − χ²/(2𝓜²), and e^{−χ} − 1 ≈ −χ + χ²/2. The χ terms cancel.' },
            { text: 'Positivity demands 𝓜 ≥ 1: the ions must reach the sheath edge at least at the ion sound speed.', math: 'u_0 \\geq c_s = \\sqrt{\\dfrac{kT_e}{M}}', why: 'For 𝓜 < 1 the right side is negative near χ = 0, so χ′ would be imaginary. Physically, the linearized equation χ″ = (1 − 1/𝓜²)χ then describes oscillation, not growth, exactly what the simulation shows.' },
            { text: 'The physical reading: for a small drop χ, electrons thin out as 1 − χ and ions as 1 − χ/𝓜². A sheath needs positive space charge, so the ions must thin out more slowly: 1/𝓜² ≤ 1.' },
          ]}
        />
        <Eq
          title="Bohm sheath criterion"
          src="\s{u}{u_0} \;\geq\; \s{cs}{c_s} = \sqrt{\dfrac{\s{kT}{kT_e}}{\s{M}{M}}}"
          symbols={{
            u: { name: 'u₀, ion speed entering the sheath', units: 'm/s', note: 'Directed speed of the ion flow at the sheath edge.' },
            cs: { name: 'c_s, ion sound (Bohm) speed', units: 'm/s', note: 'The ion acoustic speed of A5 with cold ions. For hydrogen at 10 eV it is about 31 km/s.' },
            kT: { name: 'kT_e, electron temperature', units: 'J', note: 'Hot electrons set the scale because they are what the sheath has to repel.' },
            M: { name: 'M, ion mass', units: 'kg', note: 'Heavier ions reach the wall more slowly.' },
          }}
          says="Ions cannot drift into a sheath; they have to arrive already moving at the sound speed. In practice the criterion is met with near equality: the sheath edge is, in effect, where the ion flow reaches c_s."
        />
        <p>
          Where do the ions get that speed? From a <strong>presheath</strong>: a weak electric field that extends over a long distance
          (roughly an ion mean free path, or the size of the device) and gently accelerates the ions. The presheath stays quasi-neutral. To
          give an ion the energy ½Mc_s² = ½kT_e it needs a potential drop of kT_e/2e, and the Boltzmann electrons then thin out to
          <M>{'n_s = n_0 e^{-1/2} \\approx 0.61\\,n_0'}</M>. That factor sets the ion current any wall or probe collects.
        </p>
      </section>

      <section id="wall">
        <h2>The floating wall and Child–Langmuir</h2>
        <Derivation
          lessonId="A10"
          id="floating"
          title="Floating potential of an isolated wall"
          steps={[
            { text: 'The ion flux into the sheath is set by the Bohm criterion (at the marginal speed, u₀ = c_s), and it is unchanged all the way to the wall.', math: '\\Gamma_i = n_s c_s', why: 'Cold ions are not reflected by a falling potential, so every ion that enters the sheath hits the wall.' },
            { text: 'Electrons are a Maxwellian at the sheath edge. Only the fast ones can climb the potential drop Δφ = φ_w − φ_s < 0; the one-way flux through a plane of a Maxwellian is ¼ n v̄.', math: '\\Gamma_e = \\tfrac14 n_s \\bar v_e\\, e^{e\\Delta\\phi/kT_e}, \\qquad \\bar v_e = \\sqrt{\\dfrac{8kT_e}{\\pi m_e}}', why: 'A Maxwellian in a retarding potential stays a Maxwellian at the same temperature, just with its density reduced by the Boltzmann factor. So the flux formula applies with the reduced density.' },
            { text: 'An isolated (floating) wall draws no net current, so the two fluxes are equal.', math: 'e^{e\\Delta\\phi/kT_e} = \\dfrac{4c_s}{\\bar v_e} = \\sqrt{\\dfrac{2\\pi m_e}{M}}', why: '4√(kT_e/M) / √(8kT_e/πm_e) = √(16πm_e/8M) = √(2πm_e/M). The temperature cancels.' },
            { text: 'Take the logarithm: the drop across the sheath alone.', math: '\\dfrac{e\\Delta\\phi}{kT_e} = \\tfrac12 \\ln\\dfrac{2\\pi m_e}{M}' },
            { text: 'Add the presheath drop of ½ kT_e/e to get the wall potential relative to the bulk plasma.', math: '\\dfrac{e\\phi_w}{kT_e} = \\tfrac12\\ln\\dfrac{2\\pi m_e}{M} - \\tfrac12', why: 'For hydrogen: ½ ln(2π/1836) = −2.84, so eφ_w/kT_e = −3.34. For deuterium −3.69, for argon −5.18. This assumes cold ions and no electrons emitted by the wall.' },
          ]}
        />
        <Eq
          title="Floating wall potential"
          src="\dfrac{\s{e}{e}\s{phi}{\phi_w}}{\s{kT}{kT_e}} = \tfrac{1}{2}\ln\!\left(\dfrac{2\pi \s{me}{m_e}}{\s{M}{M}}\right) - \tfrac{1}{2}"
          plot="a10-floating-potential"
          symbols={{
            e: { name: 'e, elementary charge', units: 'C', note: 'eφ_w/kT_e is the potential in units of the electron temperature in volts.' },
            phi: { name: 'φ_w, wall potential', units: 'V', note: 'Relative to the bulk plasma. Negative: the wall repels electrons.' },
            kT: { name: 'kT_e, electron temperature', units: 'J', note: 'The whole drop scales with T_e: a 10 eV hydrogen plasma floats a wall about 33 V below itself.' },
            me: { name: 'm_e, electron mass', units: 'kg', note: 'Light electrons are fast, which is why the wall must turn most of them away.' },
            M: { name: 'M, ion mass', units: 'kg', note: 'Enters only through a logarithm, so the answer is always a few kT_e/e.' },
          }}
          says="A floating wall sits a few kT_e/e below the plasma: about 3.3 for hydrogen and 5.2 for argon. The ½ is the presheath; the logarithm is the sheath."
        />
        <Plotter spec={plotById('a10-floating-potential')!} />
        <p>
          Bias the wall much more negative than floating (a Langmuir probe collecting ion current, or a wafer in a plasma etcher) and the
          electrons are turned away completely. Only ions cross the sheath, and their own space charge limits the current, just as electron
          space charge limits the current in a vacuum diode. The ion flux is still fixed by the Bohm criterion, so the sheath has to grow
          thicker until its space charge can carry that flux across the applied voltage.
        </p>
        <Eq
          title="Child–Langmuir law"
          src="\s{J}{J} = \dfrac{4}{9}\,\s{eps}{\varepsilon_0}\sqrt{\dfrac{2e}{\s{M}{M}}}\;\dfrac{|\s{V}{V}|^{3/2}}{\s{d}{d}^2}"
          plot="a10-child-langmuir"
          symbols={{
            J: { name: 'J, ion current density', units: 'A/m²', note: 'The largest current that ions starting at rest can carry across the gap: more would make the field at the start point reverse.' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: 'The only plasma property left is the ions’ own space charge.' },
            M: { name: 'M, ion mass', units: 'kg', note: 'Heavier ions are slower, so each carries its charge across more slowly and the current is lower.' },
            V: { name: 'V, voltage across the sheath', units: 'V', note: 'Much larger than kT_e/e for this law to hold.' },
            d: { name: 'd, sheath thickness', units: 'm', note: 'Setting J = e n_s c_s gives d = (√2/3) λ_D (2e|V|/kT_e)^{3/4}.' },
          }}
          says="A strongly biased sheath is a space-charge-limited diode. A bias of about 100 kT_e/e gives a sheath about 25 Debye lengths thick, and 1000 kT_e/e about 140."
        />
      </section>

      <section id="shocks">
        <h2>Shocks and the Sagdeev potential</h2>
        <p>
          Now let a large ion acoustic wave travel through the plasma. In the compressed part of the wave the ions are already moving
          forward, so the crest is carried along faster than the trough and the front steepens. Left alone that would make a
          vertical front. Two effects stop it. <strong>Dispersion</strong>: when the front gets as sharp as a few λ_D, short wavelengths
          travel more slowly (ω = kc_s/√(1 + k²λ_D²)), which spreads it again. <strong>Dissipation</strong>, from collisions or from ions
          reflected off the front, turns it into a shock: a steady jump, usually trailed by oscillations that come from the dispersion.
        </p>
        <p>
          If steepening and dispersion balance exactly, you get a single hump that travels without changing shape: a solitary wave, or
          <strong> soliton</strong>. In its own frame the plasma streams in at Mach number 𝓜, which is just the sheath problem again with the
          potential rising instead of falling. The same first integral turns into a ball rolling in a landscape, the Sagdeev potential.
        </p>
        <Eq
          title="Sagdeev potential of an ion acoustic soliton"
          src="\begin{gathered}\tfrac{1}{2}\left(\dfrac{d\s{chi}{\chi}}{d\s{xi}{\xi}}\right)^{2} + \s{V}{V}(\chi) = 0 \\ V(\chi) = 1 - e^{\chi} \\ \qquad +\, \s{Mach}{\mathcal{M}}^2\left(1 - \sqrt{1 - 2\chi/\mathcal{M}^2}\right)\end{gathered}"
          plot="a10-sagdeev"
          symbols={{
            chi: { name: 'χ = eφ/kT_e, potential of the hump', note: 'Positive: a soliton is a hill of potential and a bump of ion density.' },
            xi: { name: 'ξ = (x − ut)/λ_D, position in the wave frame', note: 'Plays the role of time for the rolling ball.' },
            V: { name: 'V(χ), Sagdeev (pseudo)potential', note: 'The landscape the ball rolls in with zero total "energy". A soliton needs V < 0 between 0 and its peak, and V = 0 at the peak.' },
            Mach: { name: '𝓜 = u/c_s, Mach number', note: 'Solitons exist only for 1 < 𝓜 < 1.58. Below 1 there is no dip (the Bohm condition again); above 1.58 the hump would reflect the incoming ions.' },
          }}
          says="The ball starts at χ = 0 (undisturbed plasma), rolls down into the dip, climbs out the other side, stops where V = 0 (the soliton peak) and rolls back. Faster solitons have deeper dips and taller peaks."
        />
        <Plotter spec={plotById('a10-sagdeev')!} />
      </section>

      <section id="kdv">
        <h2>Solitons and the KdV equation</h2>
        <p>
          For small amplitudes, just above 𝓜 = 1, the ion fluid equations with Boltzmann electrons boil down to one equation for the
          potential. Stretch the coordinates to follow the wave, ξ = ε^½(x − t) and τ = ε^{3/2} t (in units of λ_D and 1/ω_pi, with ε the
          small amplitude), and keep the leading nonlinear and dispersive terms: the result is the Korteweg–de Vries equation.
        </p>
        <Eq
          title="Korteweg–de Vries equation"
          src="\dfrac{\partial \s{U}{U}}{\partial \s{tau}{\tau}} + \underbrace{U\,\dfrac{\partial U}{\partial \s{xi}{\xi}}}_{\text{steepening}} + \underbrace{\tfrac{1}{2}\,\dfrac{\partial^{3} U}{\partial \xi^{3}}}_{\text{dispersion}} = 0"
          symbols={{
            U: { name: 'U, wave amplitude', note: 'The potential eφ/kT_e divided by the small parameter ε. Larger U means a bigger, faster disturbance.' },
            tau: { name: 'τ, slow time', note: 'Time measured in the frame moving at c_s, stretched so that slow nonlinear evolution appears at order one.' },
            xi: { name: 'ξ, position in the moving frame', note: 'Stretched by ε^½ because solitons are wide when they are small.' },
          }}
          says="Steepening makes big parts of the wave move faster; dispersion makes sharp features spread out. The soliton U = 3c sech²[(c/2)^½(ξ − cτ)] balances them: height 3c, speed c, width ∝ 1/√c. Taller solitons are faster and narrower."
        />
        <p>
          Back in physical units, a small ion acoustic soliton has peak <M>{'e\\phi_{\\max}/kT_e \\approx 3(\\mathcal{M}-1)'}</M> and a width of
          about <M>{'\\lambda_D\\sqrt{2/(\\mathcal{M}-1)}'}</M>. At 𝓜 = 1.1 the KdV estimate gives a peak of 0.30; the full Sagdeev
          potential gives 0.28. The simulation below solves the KdV equation in the rescaled form <M>{'u_t + u u_x + u_{xxx} = 0'}</M>,
          whose soliton is <M>{'u = 3c\\,\\operatorname{sech}^2[\\sqrt{c}\\,(x - ct)/2]'}</M>.
        </p>
        <KdvSim />
        <p>
          The remarkable part is the collision. Two waves governed by a nonlinear equation should mangle each other; these come out with
          exactly their original shapes and speeds, like particles. The only trace of the encounter is a shift: the fast soliton ends up
          ahead of where it would have been, and the slow one behind. Zabusky and Kruskal found this behaviour in computer runs in 1965 and
          coined the word soliton for it.
        </p>
      </section>

      <section id="ponder">
        <h2>The ponderomotive force</h2>
        <p>
          An electron in an oscillating field quivers back and forth, and at each end of its swing the field is pushing it back toward the
          centre. If the field is stronger on one side, the push back from the strong-field end is larger than the push back from the
          weak-field end. Averaged over a cycle it is shoved toward weaker field, whatever the sign of its charge. Intense light therefore pushes electrons out of a bright focus, and the ions follow to keep the
          plasma neutral.
        </p>
        <Derivation
          lessonId="A10"
          id="ponderomotive"
          title="Ponderomotive force on one electron"
          steps={[
            { text: 'Take an oscillating field whose amplitude varies slowly in space, E = E_s(x) cos ωt. To first order the electron quivers about x₀ with the field evaluated there.', math: 'v_1 = \\dfrac{qE_s}{m\\omega}\\sin\\omega t,\\qquad x_1 = -\\dfrac{qE_s}{m\\omega^2}\\cos\\omega t', why: 'Integrate m dv/dt = qE_s(x₀) cos ωt twice. The quiver amplitude qE_s/mω² is assumed much smaller than the scale over which E_s changes.' },
            { text: 'At second order, the electron samples the field at its displaced position x₀ + x₁. Expand the field.', math: 'm\\dfrac{dv_2}{dt} = q\\,x_1\\dfrac{\\partial E_s}{\\partial x}\\cos\\omega t = -\\dfrac{q^2}{m\\omega^2}E_s\\dfrac{\\partial E_s}{\\partial x}\\cos^2\\omega t', why: 'E(x₀ + x₁) ≈ E(x₀) + x₁ ∂E/∂x. The first piece gives the quiver; the second is the correction. x₁ and E oscillate at the same frequency, locked exactly out of phase, so their product is −cos² ωt and does not average to zero.' },
            { text: 'Average over a cycle, ⟨cos² ωt⟩ = ½.', math: 'F_{NL} = -\\dfrac{q^2}{4m\\omega^2}\\dfrac{\\partial (E_s^2)}{\\partial x}', why: 'E_s ∂E_s/∂x = ½ ∂(E_s²)/∂x. The charge appears squared, so electrons and ions are both pushed toward weak field, but the force on ions is m_e/M times smaller.' },
            { text: 'Recognize the gradient of the cycle-averaged quiver energy, the ponderomotive potential.', math: 'F_{NL} = -\\nabla U_p,\\qquad U_p = \\tfrac12 m\\langle v_1^2\\rangle = \\dfrac{q^2E_s^2}{4m\\omega^2}', why: 'For an electromagnetic wave the magnetic force v × B adds a second-order term too; including it gives the same result in three dimensions.' },
            { text: 'Multiply by the electron density and use ω_p² = ne²/ε₀m to get the force per unit volume.', math: '\\mathbf{F}_{NL} = -\\dfrac{\\omega_p^2}{\\omega^2}\\,\\nabla\\!\\left(\\dfrac{\\varepsilon_0\\langle E^2\\rangle}{2}\\right)', why: 'n q²/(4mω²) ∇E_s² = (ne²/ε₀m)(ε₀/2ω²) ∇⟨E²⟩ with ⟨E²⟩ = E_s²/2.' },
            { text: 'With intensity I = cε₀⟨E²⟩ and ω = 2πc/λ, the potential in practical units is', math: 'U_p\\,[\\text{eV}] \\approx 9.34\\times10^{-14}\\; I\\,[\\text{W/cm}^2]\\;\\lambda^2\\,[\\mu\\text{m}]', why: 'U_p = e²I/(2m_e ε₀ c ω²). This holds for linear and circular polarization alike when written with the intensity, as long as the electrons stay non-relativistic.' },
          ]}
        />
        <Eq
          title="Ponderomotive force"
          src="\s{F}{\mathbf{F}_{NL}} = -\dfrac{\s{wp}{\omega_p}^2}{\s{w}{\omega}^2}\,\nabla\!\left(\dfrac{\s{eps}{\varepsilon_0}\langle \s{E}{E^2}\rangle}{2}\right)"
          plot="a10-ponderomotive"
          symbols={{
            F: { name: 'F_NL, ponderomotive force density', units: 'N/m³', note: 'Force per unit volume on the plasma electrons, averaged over the fast oscillation.' },
            wp: { name: 'ω_p, electron plasma frequency', units: 'rad/s', note: 'Carries the density: ω_p² ∝ n. Denser plasma, more electrons pushed.' },
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'High-frequency fields make electrons quiver less, so the force drops as 1/ω².' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: 'ε₀⟨E²⟩/2 is the time-averaged electric energy density of the wave.' },
            E: { name: '⟨E²⟩, mean square electric field', units: 'V²/m²', note: 'Averaged over a wave period. The force points down its gradient.' },
          }}
          says="The plasma is pushed out of regions of high wave energy, with a strength set by ω_p²/ω². Near the critical density (ω_p ≈ ω) the force per unit volume is simply minus the gradient of the light's electric energy density."
        />
        <Plotter spec={plotById('a10-ponderomotive')!} />
        <p>
          This one force drives a lot of Track B and C: a laser beam digs a density channel that focuses it further (self-focusing and
          filamentation, B7), steepens the density profile at the critical surface, and in the relativistic regime blows electrons out to
          form the bubble behind a wakefield (C4).
        </p>
      </section>

      <section id="parametric">
        <h2>Parametric instabilities</h2>
        <p>
          Picture two pendulums, coupled by a spring whose stiffness is wiggled at frequency ω₀. If ω₀ equals the sum of their natural
          frequencies, the wiggling pumps energy into both, and their oscillations grow exponentially. That is a parametric instability. In
          a plasma the "pump" is a strong wave (usually the laser), the two pendulums are natural modes of the plasma, and the coupling is
          one of the nonlinear terms, for example the ponderomotive force of the beat between two waves.
        </p>
        <Eq
          title="Matching conditions"
          src="\s{w0}{\omega_0} = \s{w1}{\omega_1} + \s{w2}{\omega_2},\qquad \s{k0}{\mathbf{k}_0} = \s{k1}{\mathbf{k}_1} + \s{k2}{\mathbf{k}_2}"
          symbols={{
            w0: { name: 'ω₀, pump frequency', units: 'rad/s', note: 'The strong driving wave, for example a laser.' },
            w1: { name: 'ω₁, first daughter wave', units: 'rad/s', note: 'A natural mode of the plasma (scattered light, Langmuir wave or ion acoustic wave) with its own dispersion relation.' },
            w2: { name: 'ω₂, second daughter wave', units: 'rad/s', note: 'Both daughters must satisfy their own dispersion relations and the matching conditions at the same time.' },
            k0: { name: 'k₀, pump wavevector', units: 'm⁻¹', note: 'Momentum of a pump quantum is ħk₀.' },
            k1: { name: 'k₁, first daughter wavevector', units: 'm⁻¹', note: 'Direction matters: backscatter (k₁ ≈ −k₀) needs the largest k₂.' },
            k2: { name: 'k₂, second daughter wavevector', units: 'm⁻¹', note: 'Fixed once k₀ and k₁ are chosen.' },
          }}
          says="Energy and momentum conservation for quanta: one pump photon decays into two daughter quanta. The instability grows only if the pump beats the damping of both daughters: the undamped growth rate γ₀ (∝ pump amplitude) must exceed √(Γ₁Γ₂)."
        />
        <div className="grid three">
          <div className="card">
            <span className="pill ghost">SRS</span>
            <p style={{ marginTop: 10 }}>Stimulated Raman scattering: light → scattered light + electron plasma wave. Only below quarter-critical density, since each daughter needs at least ω_pe.</p>
          </div>
          <div className="card">
            <span className="pill ghost">SBS</span>
            <p style={{ marginTop: 10 }}>Stimulated Brillouin scattering: light → scattered light + ion acoustic wave. The ion wave takes almost no energy, so the light bounces back nearly unshifted.</p>
          </div>
          <div className="card">
            <span className="pill ghost">TPD</span>
            <p style={{ marginTop: 10 }}>Two-plasmon decay: light → two electron plasma waves, near quarter-critical where ω_pe ≈ ω₀/2. A source of hot electrons (B8).</p>
          </div>
        </div>
        <p>
          A signature: SRS right at quarter-critical density produces scattered light at ω₀/2, about twice the laser wavelength. Laser
          fusion experiments use scattered light like this, and emission near ω₀/2 and 3ω₀/2, as diagnostics of these instabilities. Lessons B5 to B7 work out the growth rates.
        </p>
      </section>

      <section id="echoes">
        <h2>Plasma echoes</h2>
        <p>
          Landau damping (A9) looks irreversible: the field of a wave disappears. But nothing was lost. The wave's information was
          phase-mixed into ever finer ripples of the distribution function f(v). Excite a wave at wavenumber k₁ at t = 0 and let it
          damp away; excite a second at k₂ at t = τ and let that damp too. At t = τk₂/(k₂ − k₁) the two sets of ripples unmix and a third
          field appears out of nowhere at k₂ − k₁: the <strong>echo</strong>. Echoes were observed in the late 1960s and are the cleanest
          proof that collisionless damping is reversible phase mixing. Collisions smear the fine ripples and weaken the echo, which makes
          it a sensitive way to measure small collision rates.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Sheaths decide how much heat a fusion plasma dumps onto the wall, and the floating potential reappears in every probe
          measurement. A11 puts the whole of Track A together to ask what it takes to confine a burning plasma. The ponderomotive force and
          parametric instabilities are central to Track B (B4, B5), and large-amplitude, steepening plasma waves lead to wave breaking
          and wakefield acceleration in Track C.
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'A10-p1', kind: 'numeric', concept: 'floating-potential', prompt: 'A deuterium plasma has $T_e = 5$ eV and cold ions. An isolated metal plate floats in it. How far below the bulk plasma potential does the plate float, in volts?', answer: 18.4, tol: 0.03, unit: 'V', hints: ['$e\\phi_w/kT_e = \\tfrac12\\ln(2\\pi m_e/M) - \\tfrac12$, with $M = 3670\\,m_e$ for a deuteron.', '$\\ln(2\\pi/3670) = -6.37$.'], solution: '$e\\phi_w/kT_e = \\tfrac12(-6.37) - \\tfrac12 = -3.69$, so $\\phi_w = -3.69 \\times 5$ V $= -18.4$ V. About 15.9 V of that is the sheath and 2.5 V the presheath.' },
    { id: 'A10-p2', kind: 'numeric', concept: 'bohm-criterion', prompt: 'A Langmuir probe biased far negative sits in a hydrogen plasma with bulk density $n_0 = 10^{17}\\ \\text{m}^{-3}$, $T_e = 4$ eV and cold ions. Using the Bohm flux at the sheath edge, what ion current density does it collect, in A/m²?', answer: 190, tol: 0.03, unit: 'A/m²', hints: ['$J = e\\,n_s c_s$ with $n_s = n_0 e^{-1/2}$ (the presheath).', '$c_s = \\sqrt{kT_e/M} = \\sqrt{4 \\times 1.602\\times10^{-19}/1.673\\times10^{-27}} \\approx 1.96\\times10^4$ m/s.'], solution: '$n_s = 0.607\\times10^{17}$ m⁻³, so $J = 1.602\\times10^{-19} \\times 6.07\\times10^{16} \\times 1.96\\times10^4 \\approx 190$ A/m². The ion saturation current depends on $T_e$ through $c_s$, which is how probes measure density once $T_e$ is known.' },
    { id: 'A10-p3', kind: 'numeric', concept: 'child-langmuir', prompt: 'A probe in a plasma with sheath-edge density $n_s = 10^{16}\\ \\text{m}^{-3}$ and $T_e = 2$ eV is biased 200 V below the plasma. Estimate the sheath thickness from the Child–Langmuir law with the Bohm flux, in millimetres.', answer: 2.64, tol: 0.03, unit: 'mm', hints: ['$d = (\\sqrt2/3)\\,\\lambda_D\\,(2\\chi)^{3/4}$ with $\\chi = e|V|/kT_e = 100$.', '$\\lambda_D = 7430\\sqrt{2/10^{16}} = 1.05\\times10^{-4}$ m.'], solution: '$(2\\chi)^{3/4} = 200^{0.75} = 53.2$, so $d = 0.471 \\times 53.2\\,\\lambda_D = 25.1\\,\\lambda_D = 2.64$ mm. Much thicker than a floating sheath (a few λ_D).' },
    { id: 'A10-p4', kind: 'numeric', concept: 'ponderomotive-force', prompt: 'A Nd:glass laser ($\\lambda = 1.053$ µm) is focused to $10^{15}$ W/cm². What is the ponderomotive potential $U_p$ of an electron (its cycle-averaged quiver energy), in eV?', answer: 103.5, tol: 0.03, unit: 'eV', hints: ['$U_p \\approx 9.34\\times10^{-14}\\,I\\,\\lambda^2$ eV with $I$ in W/cm² and $\\lambda$ in µm.'], solution: '$U_p = 9.34\\times10^{-14} \\times 10^{15} \\times 1.109 = 103.5$ eV. Electrons in the focus sit on a potential hill about 100 eV high, which pushes them outward across the focal spot; that is far more than the thermal energy of a cool plasma.' },
    { id: 'A10-p5', kind: 'numeric', concept: 'kdv-soliton', prompt: 'In a hydrogen plasma with $T_e = 10$ eV and cold ions, an ion acoustic soliton has peak potential $e\\phi/kT_e = 0.2$. Using the KdV result $e\\phi_{\\max}/kT_e \\approx 3(\\mathcal{M}-1)$, how fast does it travel, in km/s?', answer: 33.0, tol: 0.03, unit: 'km/s', hints: ['$\\mathcal{M} = 1 + 0.2/3 = 1.067$.', '$c_s = \\sqrt{kT_e/M} = 3.10\\times10^4$ m/s for protons at 10 eV.'], solution: '$u = 1.067 \\times 3.10\\times10^4 = 3.30\\times10^4$ m/s ≈ 33 km/s, only 7% faster than sound. Its width is about $\\lambda_D\\sqrt{2/0.067} \\approx 5.5\\,\\lambda_D$: small solitons are wide and slow.' },
    { id: 'A10-p6', kind: 'mcq', concept: 'bohm-criterion', prompt: 'Why must ions enter a sheath at least at the ion sound speed?', options: ['Otherwise the ions would be reflected by the negative wall', 'Otherwise, as the potential starts to fall, the ion density drops faster than the electron density; the net negative charge bends the potential back up, so no monotonic sheath exists', 'Otherwise electrons would reach the wall before the ions', 'Otherwise the ions would be Landau damped'], correct: 1, hints: ['Compare how $n_e \\approx 1 - \\chi$ and $n_i \\approx 1 - \\chi/\\mathcal{M}^2$ fall for a small potential drop χ.'], solution: 'A sheath needs positive space charge so that the potential keeps curving down toward the wall. For a small drop χ, electrons thin out as $1-\\chi$ and ions as $1-\\chi/\\mathcal{M}^2$. If $\\mathcal{M} < 1$ the ions thin out faster, the charge is negative, and the potential oscillates instead of falling. A falling potential never reflects positive ions, so option 1 is wrong.' },
  ],
  cards: [
    { id: 'A10-c1', front: 'Bohm sheath criterion, and where ions get the speed', back: '$u_0 \\geq c_s = \\sqrt{kT_e/M}$, gained in a quasi-neutral presheath with a drop of $kT_e/2e$, leaving $n_s \\approx 0.61\\,n_0$' },
    { id: 'A10-c2', front: 'Floating wall potential (cold ions)', back: '$e\\phi_w/kT_e = \\tfrac12\\ln(2\\pi m_e/M) - \\tfrac12$: about −3.3 (H), −3.7 (D), −5.2 (Ar)' },
    { id: 'A10-c3', front: 'Child–Langmuir law', back: '$J = \\tfrac49\\varepsilon_0\\sqrt{2e/M}\\,|V|^{3/2}/d^2$; with the Bohm flux, $d = (\\sqrt2/3)\\lambda_D(2e|V|/kT_e)^{3/4}$' },
    { id: 'A10-c4', front: 'KdV soliton of $u_t + uu_x + u_{xxx} = 0$', back: '$u = 3c\\,\\operatorname{sech}^2[\\sqrt c\\,(x-ct)/2]$: height $3c$, speed $c$, width $\\propto 1/\\sqrt c$. Taller is faster and narrower.' },
    { id: 'A10-c5', front: 'Ponderomotive force density and potential', back: '$\\mathbf F_{NL} = -(\\omega_p^2/\\omega^2)\\nabla(\\varepsilon_0\\langle E^2\\rangle/2)$; $U_p \\approx 9.34\\times10^{-14} I\\lambda^2$ eV (W/cm², µm)' },
    { id: 'A10-c6', front: 'Parametric instability: matching and threshold', back: '$\\omega_0 = \\omega_1+\\omega_2$, $\\mathbf k_0 = \\mathbf k_1+\\mathbf k_2$; grows if $\\gamma_0^2 > \\Gamma_1\\Gamma_2$' },
  ],
}
