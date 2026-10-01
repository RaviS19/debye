import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { CmaSim } from '../sims/CmaSim'
import { LaserPlasmaSim } from '../sims/LaserPlasmaSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A6: Lesson = {
  id: 'A6',
  title: 'EM waves',
  subtitle: 'Cutoffs, critical density, R, L, O and X waves, Alfvén waves and the CMA diagram',
  minutes: 55,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 4, second half: electromagnetic waves with and without B₀, cutoffs and resonances, whistlers and Faraday rotation, hydromagnetic waves, the CMA diagram',
    'Stix, Waves in Plasmas: the cold-plasma dispersion relation and the CMA diagram',
    'Bellan, Fundamentals of Plasma Physics: cold plasma waves in a magnetized plasma',
  ],
  objectives: [
    'Derive $\\omega^2 = \\omega_p^2 + c^2k^2$ and explain why light below $\\omega_p$ turns around at the critical density',
    'Compute the critical density $n_c$ for any laser and the evanescent decay length beyond it',
    'Use the CMA diagram to tell which of the R, L, O and X waves propagate for given $\\omega_p/\\omega$ and $\\omega_c/\\omega$',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'light', label: 'Light in plasma' },
    { id: 'cutoff', label: 'Cutoff' },
    { id: 'magnetized', label: 'With B' },
    { id: 'cma', label: 'CMA diagram' },
    { id: 'alfven', label: 'Alfvén waves' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          A light wave is an oscillating electric field. In a plasma that field shakes the free electrons, and shaking electrons are a
          current. That current makes its own field, which partly cancels the wave’s. The faster the wave oscillates, the less the
          electrons, held back by their inertia, can keep up, and the less they interfere.
        </p>
        <p>
          So there is a competition between two clocks: the wave frequency ω and the plasma frequency ω_p from A1. If ω is well above
          ω_p, the electrons lag behind and the light gets through, only slightly changed. If ω is below ω_p, the electrons respond
          so quickly that they short out the field completely. The wave cannot enter; it is reflected. This is why shortwave (and night-time AM) radio bounces off
          the ionosphere while FM and satellite signals pass through, why metals are shiny, and why a laser stops at a definite layer
          in the plasma it creates.
        </p>
        <p>
          Add a magnetic field and the electrons can no longer respond the same way in every direction. The single cutoff splits into
          several, new resonances appear where the wave keeps pace with the gyrating electrons, and the zoo of R, L, O and X waves
          appears. At the lowest frequencies the ions join in and the field lines themselves carry waves, like plucked strings.
        </p>
      </section>

      <section id="light">
        <h2>Light in a plasma</h2>
        <p>
          Start without a magnetic field. The electrons feel only the wave’s electric field; ions are too heavy to matter at optical or
          microwave frequencies. Their current enters Maxwell’s equations, and a single extra term appears in the dispersion relation.
        </p>
        <Eq
          title="Dispersion relation for light"
          src="\s{w}{\omega}^2 = \s{wp}{\omega_p^2} + \s{c}{c}^2 \s{k}{k}^2"
          plot="a6-light-dispersion"
          symbols={{
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'Set by the source (the laser or the transmitter). It stays the same as the wave moves through a changing plasma; the wavelength adapts instead.' },
            wp: { name: 'ω_p, plasma frequency', units: 'rad/s', note: 'ω_p² = n e²/(ε₀ m_e), from A1. It acts like a mass term: no wave can have ω below it.' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'The speed of light in vacuum.' },
            k: { name: 'k, wavenumber', units: 'rad/m', note: '2π divided by the wavelength in the plasma. For a given ω, a plasma gives a smaller k (longer wavelength) than vacuum.' },
          }}
          says="The plasma adds a floor at ω_p. Below it, k² would be negative, so the wave cannot propagate. Above it, the wavelength is longer than in vacuum and the refractive index n = ck/ω = √(1 − ω_p²/ω²) is less than 1."
        />
        <Derivation
          lessonId="A6"
          id="light"
          title="Light in a plasma from Maxwell plus electron inertia"
          steps={[
            { text: 'Take the curl of Faraday’s law and use Ampère’s law (with the plasma current j) to eliminate B.', math: '\\nabla\\times\\nabla\\times\\mathbf{E} = -\\mu_0\\dfrac{\\partial \\mathbf{j}}{\\partial t} - \\dfrac{1}{c^2}\\dfrac{\\partial^2\\mathbf{E}}{\\partial t^2}', why: 'Faraday: ∇×E = −∂B/∂t. Ampère–Maxwell: ∇×B = μ₀j + (1/c²)∂E/∂t. Curl the first, swap the order of curl and ∂/∂t, and substitute the second.' },
            { text: 'For a transverse plane wave E ∝ exp(i(kx − ωt)) with k·E = 0, the double curl is just k²E.', math: '(\\omega^2 - c^2k^2)\\,\\mathbf{E} = -\\dfrac{i\\omega}{\\varepsilon_0}\\,\\mathbf{j}', why: '∇×∇×E = ∇(∇·E) − ∇²E. Transverse means ∇·E = 0, and −∇² → k². Each ∂/∂t becomes −iω, and μ₀c² = 1/ε₀.' },
            { text: 'Each electron is pushed by the wave field. Ions are about 1836 times heavier and barely move. The magnetic force v×B is second order in the wave amplitude and is dropped.', math: 'm_e\\dfrac{\\partial \\mathbf{v}}{\\partial t} = -e\\mathbf{E}\\ \\Rightarrow\\ \\mathbf{v} = \\dfrac{e\\mathbf{E}}{i\\omega m_e}', why: '−iω m v = −eE. The electron velocity is 90° out of phase with E: it is an inductive, not a resistive, response.' },
            { text: 'The electron current is j = −n e v.', math: '\\mathbf{j} = \\dfrac{i n e^2}{\\omega m_e}\\,\\mathbf{E}' },
            { text: 'Substitute. The factors of i combine to −i² = +1, and the plasma frequency appears.', math: '\\omega^2 - c^2k^2 = \\dfrac{n e^2}{\\varepsilon_0 m_e} = \\omega_p^2', why: '(−iω/ε₀)(i n e²/(ω m)) = n e²/(ε₀ m). Only electrons contribute because the ion term is smaller by m_e/m_i.' },
            { text: 'Read off the two velocities. The phase velocity exceeds c; the group velocity, which carries energy and information, does not.', math: 'v_\\phi = \\dfrac{\\omega}{k} = \\dfrac{c}{\\sqrt{1-\\omega_p^2/\\omega^2}},\\qquad v_g = \\dfrac{d\\omega}{dk} = c\\sqrt{1-\\dfrac{\\omega_p^2}{\\omega^2}},\\qquad v_\\phi v_g = c^2', why: 'Differentiate ω² = ω_p² + c²k²: 2ω dω = 2c²k dk, so dω/dk = c²k/ω = c²/v_φ.' },
          ]}
        />
      </section>

      <section id="cutoff">
        <h2>Cutoff and the critical density</h2>
        <p>
          Fix the wave frequency and let the density rise, as it does for a laser heading into the plasma it blows off a target. As
          ω_p climbs toward ω, the wavelength stretches and the group velocity drops: the wave slows down and its field piles up. Where
          ω_p reaches ω, k falls to zero and the wave turns around. That layer is the <strong>critical density</strong>.
        </p>
        <Eq
          title="Critical density"
          src="\s{nc}{n_c} = \dfrac{\s{eps}{\varepsilon_0}\, \s{m}{m_e}\, \s{w}{\omega}^2}{\s{e}{e}^2} \approx \dfrac{1.1\times 10^{27}}{\s{lam}{\lambda_{\mu m}}^2}\ \text{m}^{-3}"
          plot="a6-critical-density"
          symbols={{
            nc: { name: 'n_c, critical density', units: 'm⁻³', note: 'The electron density at which ω_p = ω. Light of this frequency cannot go any deeper.' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: '8.85×10⁻¹² F/m.' },
            m: { name: 'm_e, electron mass', units: 'kg', note: 'Electron inertia: a heavier charge carrier would short out the field less easily.' },
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'ω = 2πc/λ. Doubling the frequency quadruples n_c.' },
            e: { name: 'e, elementary charge', units: 'C', note: '1.602×10⁻¹⁹ C.' },
            lam: { name: 'λ_µm, vacuum wavelength in micrometres', units: 'µm', note: 'For a 1053 nm glass laser n_c ≈ 1.0×10²⁷ m⁻³; for its third harmonic at 351 nm, n_c ≈ 9.0×10²⁷ m⁻³.' },
          }}
          says="Shorter wavelengths reach denser plasma. That single fact drives laser-fusion design choices, and it is the starting point of Track B."
        />
        <p>
          Past the critical layer the field does not stop dead. With ω &lt; ω_p, k becomes imaginary, and the field decays as
          exp(−x/δ) with <M>{'\\delta = c/\\sqrt{\\omega_p^2 - \\omega^2}'}</M>. Deep below cutoff this is the <strong>skin depth</strong>{' '}
          <M>{'c/\\omega_p'}</M>, independent of the wave frequency. No energy flows into this evanescent tail on average: all of it
          comes back out.
        </p>
        <LaserPlasmaSim />
        <p>
          In a smooth ramp the reflection is total and happens at n_c itself. At a sharp edge it happens at the surface, and above cutoff
          a sharp edge still reflects a little (like glass), while a gentle ramp lets everything through. Try both in the simulation.
        </p>
        <Plotter spec={plotById('a6-critical-density')!} />
      </section>

      <section id="magnetized">
        <h2>Adding a magnetic field</h2>
        <p>
          Now thread the plasma with a steady field B₀. Electrons can still slide freely along B₀, but across it they gyrate at ω_c.
          How a wave fares depends on how its electric field is oriented relative to B₀.
        </p>
        <div className="grid two">
          <div className="card">
            <span className="pill">O-mode · k ⊥ B, E ∥ B</span>
            <p style={{ marginTop: 10 }}>
              The wave shakes electrons along the field lines, where the magnetic force does nothing. So B₀ is irrelevant: same
              dispersion and same cutoff at ω = ω_p as without a field. The “ordinary” wave.
            </p>
          </div>
          <div className="card">
            <span className="pill">X-mode · k ⊥ B, E ⊥ B</span>
            <p style={{ marginTop: 10 }}>
              The electrons are pushed across B, so their motion bends into ellipses and the wave picks up a component along k. Cutoffs
              move to ω_R and ω_L, and a resonance appears at the upper-hybrid frequency <M>{'\\omega_h^2 = \\omega_p^2 + \\omega_c^2'}</M>.
            </p>
          </div>
          <div className="card">
            <span className="pill">R wave · k ∥ B</span>
            <p style={{ marginTop: 10 }}>
              Circularly polarized, rotating the same way the electrons gyrate. At ω = ω_c it stays in step with them and pumps
              energy in continuously: electron cyclotron resonance, the basis of electron cyclotron resonance heating (ECRH) in tokamaks.
            </p>
          </div>
          <div className="card">
            <span className="pill">L wave · k ∥ B</span>
            <p style={{ marginTop: 10 }}>
              Rotates against the electron gyration, so it never resonates with electrons. (With ions included it resonates at the ion
              cyclotron frequency instead.)
            </p>
          </div>
        </div>
        <Eq
          title="R and L waves along B"
          src="\s{n}{n}^2_{R,L} = \dfrac{\s{c}{c}^2\s{k}{k}^2}{\s{w}{\omega}^2} = 1 - \dfrac{\s{wp}{\omega_p^2}/\s{w}{\omega}^2}{1 \mp \s{wc}{\omega_c}/\s{w}{\omega}}"
          plot="a6-magnetized-dispersion"
          symbols={{
            n: { name: 'n, refractive index', note: 'c k/ω. n² > 0: the wave propagates. n² < 0: evanescent (cutoff side). n → ∞: resonance, the wavelength shrinks to zero and the wave is absorbed.' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'Speed of light in vacuum.' },
            k: { name: 'k, wavenumber', units: 'rad/m', note: 'Along B₀ for these two waves.' },
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'The frequency of the wave.' },
            wp: { name: 'ω_p, plasma frequency', units: 'rad/s', note: 'Sets how strongly the electrons respond.' },
            wc: { name: 'ω_c, electron cyclotron frequency', units: 'rad/s', note: 'eB₀/m_e, about 2π × 28 GHz per tesla. The upper sign (minus) is the R wave, which resonates at ω = ω_c; the lower sign is the L wave.' },
          }}
          says="The magnetic field shifts the effective frequency the electrons see from ω to ω ∓ ω_c. For the R wave that shift can reach zero, giving a resonance; setting n = 0 gives the cutoffs ω_R,L = ½[±ω_c + √(ω_c² + 4ω_p²)]."
        />
        <Derivation
          lessonId="A6"
          id="rl-waves"
          title="Why circular polarization, and where the resonance comes from"
          steps={[
            { text: 'Let the wave travel along B₀ = B₀ẑ. The electron equation now has the Lorentz force from B₀.', math: '-i\\omega m_e \\mathbf{v} = -e\\,(\\mathbf{E} + \\mathbf{v}\\times\\mathbf{B}_0)', why: 'Small-amplitude wave, so the wave’s own B is still negligible, but B₀ is not.' },
            { text: 'The x and y equations are coupled by B₀. Rotating combinations decouple them.', math: 'v_\\pm = v_x \\pm i v_y,\\qquad E_\\pm = E_x \\pm iE_y', why: 'The Lorentz force rotates velocity in the xy-plane, and circular combinations are exactly the eigenvectors of a rotation.' },
            { text: 'Each circular component responds as if the frequency were shifted by ±ω_c.', math: 'v_\\pm = \\dfrac{-ie\\,E_\\pm}{m_e(\\omega \\pm \\omega_c)}', why: 'Written for v±, the magnetic force becomes ±i e B₀ v±; moving it to the left turns −iω into −i(ω ± ω_c). The E₋ component, with ω − ω_c, rotates the same way the electrons gyrate: that is the R wave.' },
            { text: 'Use j = −n e v in the same wave equation as before, (ω² − c²k²)E = −iωj/ε₀.', math: '\\omega^2 - c^2k^2 = \\dfrac{\\omega_p^2\\,\\omega}{\\omega \\mp \\omega_c}', why: 'Identical algebra to the unmagnetized case, with ω replaced by ω ∓ ω_c in the electron response only.' },
            { text: 'Divide by ω². The R wave (upper sign) has a resonance where the denominator vanishes.', math: 'n^2_{R,L} = 1 - \\dfrac{\\omega_p^2/\\omega^2}{1 \\mp \\omega_c/\\omega},\\qquad n_R \\to \\infty\\ \\text{at}\\ \\omega = \\omega_c', why: 'At resonance the electrons are driven in step with their natural gyration and absorb the wave: electron cyclotron heating.' },
            { text: 'Below ω_c the R wave propagates at any density. For ω ≪ ω_c and dense plasma it is the whistler, whose group velocity rises with frequency.', math: 'n^2 \\approx \\dfrac{\\omega_p^2}{\\omega\\,\\omega_c}\\ \\Rightarrow\\ v_g = \\dfrac{2c\\sqrt{\\omega\\,\\omega_c}}{\\omega_p}', why: 'A lightning flash launches all frequencies at once; high ones arrive first, so a radio receiver hears a falling whistle.' },
          ]}
        />
        <Eq
          title="X-mode"
          src="\s{n}{n}_X^2 = 1 - \dfrac{\s{wp}{\omega_p^2}}{\s{w}{\omega}^2}\,\dfrac{\s{w}{\omega}^2 - \s{wp}{\omega_p^2}}{\s{w}{\omega}^2 - \s{wh}{\omega_h^2}}"
          plot="a6-magnetized-dispersion"
          symbols={{
            n: { name: 'n_X, refractive index of the X-mode', note: 'For k ⊥ B₀ with E ⊥ B₀.' },
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'The frequency of the wave.' },
            wp: { name: 'ω_p, plasma frequency', units: 'rad/s', note: 'Note that n_X = 1 at ω = ω_p: the O-mode cutoff is not an X-mode cutoff.' },
            wh: { name: 'ω_h, upper-hybrid frequency', units: 'rad/s', note: 'ω_h² = ω_p² + ω_c². The electrons’ own oscillation across B, combining the plasma spring and the magnetic spring. n_X → ∞ there.' },
          }}
          says="n² = 0 at ω_R and ω_L (the cutoffs) and n² → ∞ at ω_h (the resonance). Between ω_h and ω_R the X-mode is evanescent; below ω_L it is cut off."
        />
        <p>
          A linearly polarized wave along B₀ is a sum of an R and an L wave. They travel at slightly different speeds, so the plane of
          polarization turns as the wave advances. For ω ≫ ω_p, ω_c this <strong>Faraday rotation</strong> is
          <M>{'\\ \\theta \\approx \\int \\tfrac{\\omega_p^2\\,\\omega_c}{2c\\,\\omega^2}\\,dz \\propto \\lambda^2 \\int n B_\\parallel\\,dz'}</M>. Measuring
          it gives the line-integrated n·B along a chord, which is used to measure internal magnetic fields in tokamaks and interstellar
          fields in astronomy.
        </p>
        <Plotter spec={plotById('a6-magnetized-dispersion')!} />
      </section>

      <section id="cma">
        <h2>The CMA diagram</h2>
        <p>
          All four cold-plasma waves depend on just two numbers: <M>{'X = \\omega_p^2/\\omega^2'}</M> (how dense the plasma is for this
          wave) and <M>{'Y = \\omega_c/\\omega'}</M> (how strong the field is). Plot every cutoff and resonance in the X–Y plane and it
          divides into regions; inside each region the same set of waves propagates. This map, due to Clemmow, Mullaly and Allis, tells
          you at a glance what a given wave does as it travels into a plasma: at fixed ω and B, moving into denser plasma is a
          horizontal line to the right, and each boundary you cross switches a wave on or off.
        </p>
        <CmaSim />
        <p>
          Some patterns to find: the whole top strip (Y &gt; 1) always carries the R wave, however dense, which is the whistler region.
          Right of X = 1 the O-mode is gone. The X-mode has a pocket of evanescence between the R cutoff and the upper-hybrid line.
          And since the R cutoff line reaches X = 0 exactly at Y = 1, an X-mode at the electron cyclotron frequency launched from the
          low-field side of a tokamak always meets the R cutoff, and reflects, before it can reach the cyclotron layer.
        </p>
      </section>

      <section id="alfven">
        <h2>Alfvén waves</h2>
        <p>
          At frequencies far below the ion cyclotron frequency, the ions and electrons both stay frozen to the field lines (A2’s E×B
          drift carries them together). Bend a field line and you have to drag its plasma along. The magnetic field supplies tension
          B²/μ₀, the plasma supplies mass, and the result is a wave on a string that runs along B.
        </p>
        <Eq
          title="Alfvén speed"
          src="\s{vA}{v_A} = \dfrac{\s{B}{B}}{\sqrt{\s{mu}{\mu_0}\, \s{rho}{\rho}}}"
          plot="a6-alfven-speed"
          symbols={{
            vA: { name: 'v_A, Alfvén speed', units: 'm/s', note: 'Speed of shear waves along B. In a tokamak core it is several million metres per second, one to a few per cent of c.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'Tension per unit area of the field lines is B²/μ₀.' },
            mu: { name: 'μ₀, vacuum permeability', units: 'H/m', note: '4π×10⁻⁷ H/m.' },
            rho: { name: 'ρ, mass density', units: 'kg/m³', note: 'Almost all ions: ρ ≈ n_i m_i.' },
          }}
          says="Like a guitar string, v = √(tension/mass density). Double the field and the wave is twice as fast; use deuterium instead of hydrogen and it is √2 slower. Including the displacement current gives ω/k = v_A/√(1 + v_A²/c²), which never exceeds c."
        />
        <p>
          Squeezing the field instead of bending it gives the magnetosonic (compressional) wave across B, with speed
          <M>{'\\sqrt{v_A^2 + c_s^2}'}</M>, where magnetic pressure and gas pressure act together.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Everything here is lossless: the cold electrons respond perfectly in phase. Real plasmas have collisions, which let electrons
          turn the wave’s oscillating energy into heat. That is the subject of A7 (collisions, diffusion and resistivity), and it is
          exactly how a laser deposits its energy near the critical density: collisional absorption, lesson B2. Track B starts from
          this lesson’s ramp and Airy pattern (B1), where light arriving at an angle θ turns around earlier, at n_c cos²θ, and then
          asks what happens when the swollen field near n_c drives the plasma hard.
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'A6-p1', kind: 'numeric', concept: 'critical-density', prompt: 'What is the critical density for frequency-tripled Nd:glass light at 351 nm? Give it in units of $10^{27}\\ \\text{m}^{-3}$.', answer: 9.05, tol: 0.03, unit: '×10²⁷ m⁻³', hints: ['$n_c \\approx 1.11\\times10^{27}/\\lambda_{\\mu m}^2\\ \\text{m}^{-3}$.', '$\\lambda^2 = 0.351^2 = 0.123\\ \\mu\\text{m}^2$.'], solution: '$n_c = 1.115\\times10^{27}/0.1232 = 9.05\\times10^{27}\\ \\text{m}^{-3}$, nine times the $1.0\\times10^{27}$ of the 1053 nm fundamental. The shorter wavelength deposits energy in denser plasma, closer to the target.' },
    { id: 'A6-p2', kind: 'numeric', concept: 'skin-depth', prompt: 'A 10 GHz microwave beam hits a plasma with $n = 10^{20}\\ \\text{m}^{-3}$. Over what distance does its field fall by a factor $e$ inside the plasma? Answer in millimetres.', answer: 0.535, tol: 0.03, unit: 'mm', hints: ['First check whether it propagates: $\\omega_p = 56.4\\sqrt{n}$ rad/s.', '$\\delta = c/\\sqrt{\\omega_p^2 - \\omega^2}$, with $\\omega = 2\\pi\\times10^{10}$ rad/s.'], solution: '$\\omega_p = 5.64\\times10^{11}$ rad/s, far above $\\omega = 6.28\\times10^{10}$ rad/s, so the wave is cut off. $\\delta = 3.00\\times10^8/\\sqrt{3.18\\times10^{23} - 3.9\\times10^{21}} = 5.35\\times10^{-4}$ m ≈ 0.53 mm, essentially the skin depth $c/\\omega_p = 0.53$ mm.' },
    { id: 'A6-p3', kind: 'mcq', concept: 'o-mode', prompt: 'An O-mode wave travels across $\\mathbf{B}_0$ with its electric field parallel to $\\mathbf{B}_0$. Why is its cutoff the same $\\omega = \\omega_p$ as in an unmagnetized plasma?', options: ['The magnetic field is too weak to matter at these frequencies', 'The electrons it drives move along B₀, so the magnetic force on them is zero', 'The O-mode is a longitudinal wave', 'The ions cancel the effect of B₀'], correct: 1, hints: ['What is $\\mathbf{v}\\times\\mathbf{B}_0$ when $\\mathbf{v} \\parallel \\mathbf{B}_0$?'], solution: 'The wave field pushes electrons along $\\mathbf{B}_0$, and $\\mathbf{v}\\times\\mathbf{B}_0 = 0$ for that motion. The electrons respond exactly as if there were no field, so the dispersion relation is $\\omega^2 = \\omega_p^2 + c^2k^2$ whatever the field strength.' },
    { id: 'A6-p4', kind: 'numeric', concept: 'alfven-speed', prompt: 'Find the Alfvén speed in a deuterium plasma with $n = 10^{20}\\ \\text{m}^{-3}$ and $B = 2$ T. Give it in units of $10^6$ m/s.', answer: 3.09, tol: 0.03, unit: '×10⁶ m/s', hints: ['$\\rho = n m_D$ with $m_D = 3.34\\times10^{-27}$ kg.', '$v_A = B/\\sqrt{\\mu_0\\rho}$, $\\mu_0 = 4\\pi\\times10^{-7}$.'], solution: '$\\rho = 3.34\\times10^{-7}\\ \\text{kg/m}^3$, $\\mu_0\\rho = 4.20\\times10^{-13}$, $\\sqrt{\\cdot} = 6.48\\times10^{-7}$, so $v_A = 2/6.48\\times10^{-7} = 3.09\\times10^6$ m/s, about 1% of the speed of light.' },
    { id: 'A6-p5', kind: 'numeric', concept: 'upper-hybrid', prompt: 'A plasma has $n = 10^{19}\\ \\text{m}^{-3}$ in a 1 T field. What is the upper-hybrid frequency $f_h = \\omega_h/2\\pi$, in GHz?', answer: 39.9, tol: 0.03, unit: 'GHz', hints: ['$f_{pe} \\approx 8.98\\sqrt{n}$ Hz and $f_{ce} \\approx 28.0$ GHz per tesla.', '$f_h^2 = f_{pe}^2 + f_{ce}^2$.'], solution: '$f_{pe} = 8.98\\times\\sqrt{10^{19}} = 28.4$ GHz and $f_{ce} = 28.0$ GHz, so $f_h = \\sqrt{28.4^2 + 28.0^2} = 39.9$ GHz.' },
    { id: 'A6-p6', kind: 'mcq', concept: 'cma-diagram', prompt: 'A wave meets a plasma where $X = \\omega_p^2/\\omega^2 = 1.5$ and $Y = \\omega_c/\\omega = 0.8$. Which of the principal waves propagate? (Check your answer on the CMA diagram.)', options: ['R and O', 'L and X', 'Only the O-mode', 'None of them'], correct: 1, hints: ['$R = 1 - X/(1-Y)$, $L = 1 - X/(1+Y)$, $P = 1 - X$, $S = (R+L)/2$.', 'O propagates if $P > 0$, X if $RL/S > 0$.'], solution: '$R = 1 - 1.5/0.2 = -6.5$ (R cut off), $L = 1 - 1.5/1.8 = 0.17$ (L propagates), $P = -0.5$ (O cut off), $S = -3.17$, so $RL/S = 0.34 > 0$ (X propagates). The point sits between the upper-hybrid line and the L cutoff.' },
  ],
  cards: [
    { id: 'A6-c1', front: 'Dispersion relation for light in an unmagnetized plasma', back: '$\\omega^2 = \\omega_p^2 + c^2k^2$, with $v_\\phi v_g = c^2$' },
    { id: 'A6-c2', front: 'Critical density, and its handy numeric form', back: '$n_c = \\varepsilon_0 m_e\\omega^2/e^2 \\approx 1.1\\times10^{27}/\\lambda_{\\mu m}^2\\ \\text{m}^{-3}$' },
    { id: 'A6-c3', front: 'How far does a wave below cutoff reach into the plasma?', back: 'It decays as $e^{-x/\\delta}$ with $\\delta = c/\\sqrt{\\omega_p^2 - \\omega^2}$, the skin depth $c/\\omega_p$ when $\\omega \\ll \\omega_p$' },
    { id: 'A6-c4', front: 'R and L cutoff frequencies', back: '$\\omega_{R,L} = \\tfrac{1}{2}\\left[\\pm\\omega_c + \\sqrt{\\omega_c^2 + 4\\omega_p^2}\\right]$' },
    { id: 'A6-c5', front: 'Which wave has a resonance at $\\omega = \\omega_c$, and which at $\\omega_h$?', back: 'The R wave along B at $\\omega_c$; the X-mode across B at the upper hybrid $\\omega_h^2 = \\omega_p^2 + \\omega_c^2$' },
    { id: 'A6-c6', front: 'Alfvén speed', back: '$v_A = B/\\sqrt{\\mu_0\\rho}$: a wave on field lines with tension $B^2/\\mu_0$' },
  ],
}
