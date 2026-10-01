import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { RandomWalkSim } from '../sims/RandomWalkSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A7: Lesson = {
  id: 'A7',
  title: 'Diffusion & resistivity',
  subtitle: 'Random walks, ambipolar diffusion, diffusion across B, Bohm diffusion and Spitzer resistivity',
  minutes: 55,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 5: diffusion and mobility, ambipolar diffusion, decay of a plasma, recombination, diffusion across B, fully ionized plasmas, Spitzer resistivity, Bohm diffusion',
    'Goldston & Rutherford, Introduction to Plasma Physics: the chapters on Coulomb collisions, resistivity and classical transport',
    'Fitzpatrick, Plasma Physics (open lecture notes): collisions and transport',
  ],
  objectives: [
    'Explain diffusion as a random walk and derive $D = kT/m\\nu$, the mobility, and the ambipolar diffusion coefficient',
    'Show why classical diffusion across $B$ falls as $1/B^2$ while Bohm diffusion falls only as $1/B$, and measure $D_\\perp$ in a simulation',
    'Estimate the Spitzer resistivity of a plasma and explain why a hot plasma conducts better than copper',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'diffusion', label: 'Diffusion' },
    { id: 'ambipolar', label: 'Ambipolar' },
    { id: 'decay', label: 'Decay' },
    { id: 'across', label: 'Across B' },
    { id: 'bohm', label: 'Bohm' },
    { id: 'resistivity', label: 'Resistivity' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          So far every particle moved smoothly: gyrating, drifting, oscillating in waves. Real particles also collide. Each collision
          knocks a particle onto a new, random course, so over many collisions it performs a <strong>random walk</strong>. A crowd of
          random walkers spreads out from where it is dense to where it is thin. That is diffusion, and it is how a plasma leaks out of
          any container that holds it.
        </p>
        <p>
          The rule of thumb for any random walk: the diffusion coefficient is (step length)² × (steps per second). Without a magnetic
          field the step is the mean free path, λ_mfp = v_th/ν, taken once per collision, so D ≈ λ_mfp² ν. Put in a strong magnetic
          field and a particle can no longer fly off in a straight line. Between collisions it circles a field line; a collision only
          moves it to a neighbouring circle, about one Larmor radius away. The step shrinks from λ_mfp to r_L, and diffusion across B
          slows enormously. That is the basic reason magnetic confinement works.
        </p>
        <p>
          The same collisions resist the flow of current. Oddly, hot electrons barely notice the ions they fly past, so the hotter a
          plasma, the better it conducts: a fusion plasma is a better conductor than copper.
        </p>
      </section>

      <section id="diffusion">
        <h2>Diffusion and mobility</h2>
        <p>
          In a weakly ionized gas the charged particles mostly collide with neutral atoms. If the neutral density is n_n and the
          cross-section σ, the mean free path is λ_mfp = 1/(n_n σ) and the collision frequency is ν = n_n σ v. Each collision removes, on
          average, the momentum the particle had, which acts like a friction force −mνv on the fluid.
        </p>
        <Eq
          title="Free diffusion and mobility"
          src="\s{D}{D} = \dfrac{\s{kT}{kT}}{\s{m}{m}\,\s{nu}{\nu}}, \qquad \s{mu}{\mu} = \dfrac{|\s{q}{q}|}{\s{m}{m}\,\s{nu}{\nu}} = \dfrac{|\s{q}{q}|\,\s{D}{D}}{\s{kT}{kT}}"
          symbols={{
            D: { name: 'D, diffusion coefficient', units: 'm²/s', note: 'Flux per unit density gradient, Γ = −D∇n. Equivalently the mean squared spread grows as ⟨Δx²⟩ = 2Dt along each axis.' },
            kT: { name: 'kT, temperature', units: 'J', note: 'Thermal energy of the species. Hotter particles take longer steps between collisions.' },
            m: { name: 'm, particle mass', units: 'kg', note: 'Heavier particles move slower at the same temperature, so they diffuse more slowly.' },
            nu: { name: 'ν, collision frequency', units: 's⁻¹', note: 'More collisions mean shorter, more frequent steps; the net effect is slower diffusion.' },
            mu: { name: 'μ, mobility', units: 'm²/(V·s)', note: 'Drift speed per unit electric field, v = ±μE.' },
            q: { name: 'q, charge', units: 'C', note: 'e for singly charged ions and electrons.' },
          }}
          says="Both D and μ are set by the same collisions, so they are tied together (the Einstein relation μ = |q|D/kT). Electrons are much lighter, so they diffuse and drift far faster than ions."
        />
        <Derivation
          lessonId="A7"
          id="fick"
          title="Diffusion and mobility from the fluid equation"
          steps={[
            { text: 'Write the fluid momentum equation for one species, with the electric force, the pressure gradient, and a collisional drag against a stationary neutral gas.', math: 'mn\\dfrac{d\\mathbf{v}}{dt} = \\pm enE - \\nabla p - mn\\nu\\,\\mathbf{v}', why: 'Each collision with a neutral removes the particle’s ordered momentum on average, so momentum is lost at the rate ν per unit time.' },
            { text: 'If things change slowly compared with 1/ν, the inertia term is negligible. With an isothermal gas p = nkT, solve for the velocity.', math: '\\mathbf{v} = \\pm\\dfrac{e}{m\\nu}\\mathbf{E} - \\dfrac{kT}{m\\nu}\\dfrac{\\nabla n}{n}', why: 'Setting dv/dt ≈ 0 is the same approximation as terminal velocity for a falling object with drag.' },
            { text: 'Multiply by n to get the particle flux. It has a drift part and a Fick’s-law part.', math: '\\boldsymbol{\\Gamma} = n\\mathbf{v} = \\pm\\mu n\\mathbf{E} - D\\nabla n,\\qquad \\mu = \\dfrac{|q|}{m\\nu},\\ D = \\dfrac{kT}{m\\nu}' },
            { text: 'The ratio is independent of the collisions: the Einstein relation.', math: '\\mu = \\dfrac{|q|\\,D}{kT}', why: 'Both come from the same friction force, so ν cancels in the ratio.' },
            { text: 'Check with the random-walk picture: a step of λ_mfp = v_th/ν taken ν times per second.', math: 'D \\sim \\lambda_{mfp}^2\\,\\nu = \\dfrac{v_{th}^2}{\\nu} = \\dfrac{kT}{m\\nu}', why: 'Here v_th = √(kT/m), the one-dimensional thermal speed. For a 1D random walk with N steps of length Δ, ⟨x²⟩ = NΔ², so ⟨x²⟩ grows linearly in time.' },
          ]}
        />
      </section>

      <section id="ambipolar">
        <h2>Ambipolar diffusion</h2>
        <p>
          Electrons diffuse much faster than ions. They cannot simply run away, though: the moment a few leave, the plasma charges
          positive and an electric field appears that holds the electrons back and pushes the ions out. The field adjusts until both
          species leave at exactly the same rate. The plasma diffuses as a whole, at a rate in between: faster than ions alone, much
          slower than electrons alone.
        </p>
        <Eq
          title="Ambipolar diffusion"
          src="\begin{gathered}\s{Da}{D_a} = \dfrac{\s{mui}{\mu_i}\s{De}{D_e} + \s{mue}{\mu_e}\s{Di}{D_i}}{\s{mui}{\mu_i} + \s{mue}{\mu_e}} \\ \s{Da}{D_a} \approx \s{Di}{D_i}\left(1 + \dfrac{\s{Te}{T_e}}{\s{Ti}{T_i}}\right)\end{gathered}"
          symbols={{
            Da: { name: 'D_a, ambipolar diffusion coefficient', units: 'm²/s', note: 'The rate at which the quasineutral plasma as a whole spreads out.' },
            mui: { name: 'μ_i, ion mobility', units: 'm²/(V·s)', note: 'Small, because ions are heavy.' },
            mue: { name: 'μ_e, electron mobility', units: 'm²/(V·s)', note: 'Large. The approximation uses μ_e ≫ μ_i.' },
            De: { name: 'D_e, electron diffusion coefficient', units: 'm²/s', note: 'What electrons would do on their own.' },
            Di: { name: 'D_i, ion diffusion coefficient', units: 'm²/s', note: 'What ions would do on their own.' },
            Te: { name: 'T_e, electron temperature', note: 'Hot electrons build a stronger ambipolar field, which pushes the ions out harder.' },
            Ti: { name: 'T_i, ion temperature', note: 'In a gas discharge the ions are near room temperature and T_e/T_i can be 100.' },
          }}
          says="The ions set the pace, but the electrons’ field boosts them by a factor 1 + T_e/T_i. With equal temperatures, the plasma diffuses at twice the ion rate."
        />
        <Derivation
          lessonId="A7"
          id="ambipolar"
          title="Ambipolar diffusion"
          steps={[
            { text: 'Demand equal fluxes of ions and electrons, so no net current flows out and the plasma stays neutral (n_i ≈ n_e = n).', math: '\\Gamma = \\mu_i nE - D_i\\nabla n = -\\mu_e nE - D_e\\nabla n' },
            { text: 'Solve for the electric field that makes this true.', math: 'E = \\dfrac{D_i - D_e}{\\mu_i + \\mu_e}\\,\\dfrac{\\nabla n}{n}', why: 'Since D_e > D_i and ∇n points inward, E points outward: it retards electrons and accelerates ions.' },
            { text: 'Put E back into the ion flux.', math: '\\Gamma = -\\dfrac{\\mu_i D_e + \\mu_e D_i}{\\mu_i + \\mu_e}\\,\\nabla n \\equiv -D_a\\nabla n' },
            { text: 'Use μ_e ≫ μ_i and the Einstein relation μ = eD/kT for each species.', math: 'D_a \\approx D_i + \\dfrac{\\mu_i}{\\mu_e}D_e = D_i\\left(1 + \\dfrac{T_e}{T_i}\\right)', why: 'μ_i/μ_e = (eD_i/kT_i)/(eD_e/kT_e), so (μ_i/μ_e)·D_e = D_i T_e/T_i.' },
          ]}
        />
      </section>

      <section id="decay">
        <h2>Decay of a plasma by diffusion</h2>
        <p>
          Switch off the source that keeps a plasma alive and it drains into the walls. Combining the continuity equation with
          Γ = −D∇n gives the diffusion equation ∂n/∂t = D∇²n. Separate the variables and the density becomes a sum of spatial modes, each
          decaying exponentially. The walls absorb, so n = 0 there. Short-wavelength modes (sharp features) die first, because curvature
          drives diffusion; soon only the smoothest shape, the lowest mode, is left.
        </p>
        <Eq
          title="Lowest-mode decay time"
          src="\s{tau}{\tau_1} = \left(\dfrac{\s{L}{L}}{\pi}\right)^2 \dfrac{1}{\s{D}{D}}"
          plot="a7-diffusion-decay"
          symbols={{
            tau: { name: 'τ₁, decay time of the lowest mode', units: 's', note: 'The density at the centre falls as exp(−t/τ₁) once the higher modes have gone.' },
            L: { name: 'L, slab width', units: 'm', note: 'Distance between the two absorbing walls. The lowest mode is cos(πx/L).' },
            D: { name: 'D, diffusion coefficient', units: 'm²/s', note: 'Usually the ambipolar D_a, since electrons and ions leave together.' },
          }}
          says="The decay time grows as the square of the size: double the container and the plasma lives four times longer. For a long cylinder of radius a the lowest mode is the Bessel function J₀(2.405 r/a) and τ₁ = (a/2.405)²/D."
        />
        <Plotter spec={plotById('a7-diffusion-decay')!} />
        <p>
          Diffusion is not the only loss. Ions and electrons can also recombine into neutral atoms. That rate goes as n_i n_e = n², so
          <M>{'\\ dn/dt = -\\alpha n^2'}</M>, whose solution is <M>{'1/n = 1/n_0 + \\alpha t'}</M>. The two are easy to tell apart in an
          experiment: diffusion makes ln n fall linearly in time, recombination makes 1/n rise linearly. Recombination dominates in dense
          plasmas, where volume processes beat the walls.
        </p>
      </section>

      <section id="across">
        <h2>Diffusion across a magnetic field</h2>
        <p>
          Along B nothing changes: the magnetic force does nothing to motion along the field, and D∥ = kT/mν. Across B, the Lorentz force turns each free flight into a
          circle, so without collisions a guiding centre never moves across the field at all. Collisions are now what lets particles
          escape. The simulation below makes this concrete: two clouds of identical particles, one in a field and one not.
        </p>
        <RandomWalkSim />
        <Eq
          title="Classical diffusion across B"
          src="\s{Dp}{D_\perp} = \dfrac{\s{D}{D}}{1 + \s{wc}{\omega_c^2}\s{tau}{\tau}^2} \;\xrightarrow{\ \omega_c\tau\,\gg\, 1\ }\; \dfrac{\s{kT}{kT}\,\s{nu}{\nu}}{\s{m}{m}\,\s{wc}{\omega_c^2}}"
          plot="a7-dperp-vs-b"
          symbols={{
            Dp: { name: 'D⊥, diffusion coefficient across B', units: 'm²/s', note: 'Measured in the simulation from the spread of the magnetized cloud.' },
            D: { name: 'D, field-free diffusion coefficient', units: 'm²/s', note: 'kT/mν, the value along B.' },
            wc: { name: 'ω_c, cyclotron frequency', units: 'rad/s', note: '|q|B/m, proportional to B.' },
            tau: { name: 'τ = 1/ν, mean time between collisions', units: 's', note: 'ω_cτ counts how many radians a particle gyrates between collisions. Above 1, the particle is magnetized.' },
            kT: { name: 'kT, temperature', units: 'J', note: 'Thermal energy.' },
            nu: { name: 'ν, collision frequency', units: 's⁻¹', note: 'In the strong-field limit D⊥ grows with ν: collisions are what move particles across B.' },
            m: { name: 'm, particle mass', units: 'kg', note: 'Particle mass.' },
          }}
          says="Weak field: nothing changes. Strong field: D⊥ ≈ r_L²ν, a random walk with step r_L. Since r_L ∝ 1/B, doubling the field cuts diffusion by four."
        />
        <Derivation
          lessonId="A7"
          id="dperp"
          title="D⊥ from the perpendicular force balance"
          steps={[
            { text: 'Take the steady-state perpendicular momentum balance, now with the magnetic force. B points along z.', math: 'mn\\nu\\,\\mathbf{v}_\\perp = \\pm en(\\mathbf{E} + \\mathbf{v}_\\perp\\times\\mathbf{B}) - kT\\nabla_\\perp n' },
            { text: 'Divide by mnν. The magnetic force couples v_x and v_y through ω_cτ = eB/(mν).', math: 'v_x = \\pm\\mu E_x - \\dfrac{D}{n}\\dfrac{\\partial n}{\\partial x} \\pm \\omega_c\\tau\\,v_y,\\qquad v_y = \\pm\\mu E_y - \\dfrac{D}{n}\\dfrac{\\partial n}{\\partial y} \\mp \\omega_c\\tau\\,v_x', why: '(v×B)_x = v_y B and (v×B)_y = −v_x B for B = Bẑ, and eB/(mν) = ω_cτ.' },
            { text: 'Substitute the second equation into the first and collect the v_x terms.', math: 'v_x(1 + \\omega_c^2\\tau^2) = \\pm\\mu E_x - \\dfrac{D}{n}\\dfrac{\\partial n}{\\partial x} + \\omega_c^2\\tau^2\\left(\\dfrac{E_y}{B} \\mp \\dfrac{kT}{eBn}\\dfrac{\\partial n}{\\partial y}\\right)', why: 'The bracket is the x-component of the E×B drift plus the diamagnetic drift from A2 and A4. The same algebra works for v_y.' },
            { text: 'Write it compactly. The mobility and diffusion across B are both reduced by the same factor.', math: '\\mathbf{v}_\\perp = \\pm\\mu_\\perp\\mathbf{E} - D_\\perp\\dfrac{\\nabla n}{n} + \\dfrac{\\mathbf{v}_E + \\mathbf{v}_D}{1 + \\nu^2/\\omega_c^2},\\qquad D_\\perp = \\dfrac{D}{1+\\omega_c^2\\tau^2}' },
            { text: 'The drift terms move plasma along the density contours, around the column, not out of it. The loss across B comes from the D⊥ and μ⊥ terms only.', why: 'v_D is always perpendicular to ∇n, and in a cylindrically symmetric column E is radial like ∇n, so v_E is too: both point around the column (azimuthally) and carry no flux down the gradient.' },
            { text: 'In a strong field, ω_cτ ≫ 1, and D⊥ becomes a random walk with step r_L.', math: 'D_\\perp \\approx \\dfrac{kT\\nu}{m\\omega_c^2} = \\left(\\dfrac{v_{th}}{\\omega_c}\\right)^2\\nu = r_L^2\\,\\nu \\propto \\dfrac{1}{B^2}', why: 'Compare D = λ_mfp²ν: the step length has changed from the mean free path to the Larmor radius. Notice the collision frequency moved from the denominator to the numerator.' },
          ]}
        />
        <Plotter spec={plotById('a7-dperp-vs-b')!} />
        <p>
          In a fully ionized plasma there are no neutrals, and collisions between like particles do not help: two electrons that collide
          shift their guiding centres by equal and opposite amounts, leaving their average position where it was. Only electron–ion collisions move plasma across B. The
          result is automatically ambipolar, <M>{'D_\\perp = \\eta_\\perp n\\,k(T_e + T_i)/B^2'}</M>, where η⊥ is the resistivity for current across B from the
          resistivity section below.
        </p>
      </section>

      <section id="bohm">
        <h2>Bohm diffusion</h2>
        <p>
          Early magnetized plasma experiments leaked far faster than classical theory allowed, and the loss fell only as 1/B, not 1/B².
          From measurements on magnetized arcs in the 1940s, David Bohm proposed an empirical formula that fitted surprisingly many
          experiments.
        </p>
        <Eq
          title="Bohm diffusion"
          src="\s{DB}{D_B} = \dfrac{1}{16}\,\dfrac{\s{kT}{kT_e}}{\s{e}{e}\,\s{B}{B}}"
          plot="a7-fusion-diffusion"
          symbols={{
            DB: { name: 'D_B, Bohm diffusion coefficient', units: 'm²/s', note: 'With T_e in eV and B in tesla, D_B = T_eV/(16 B) m²/s: 100 eV at 1 T gives about 6 m²/s.' },
            kT: { name: 'kT_e, electron temperature', units: 'J', note: 'D_B rises with temperature, the opposite of classical diffusion.' },
            e: { name: 'e, elementary charge', units: 'C', note: 'kT_e/e is just the temperature in volts.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'Only one power of B.' },
          }}
          says="Bohm diffusion ignores collisions completely, grows with temperature and falls only as 1/B. At the high fields and temperatures a fusion plasma needs, it is millions of times larger than classical diffusion."
        />
        <p>
          The usual explanation is turbulence: small fluctuating electric fields, with eφ a fair fraction of kT_e, whose E×B drifts shuffle
          plasma across the field. Estimating that shuffle gives D ~ kT_e/(eB), with the 1/16 as a fitted number. It is worse at high B
          simply because 1/B falls more slowly than 1/B², and worse at high T because it grows with T while classical diffusion shrinks.
          Beating Bohm-like losses was a central problem of fusion research through the 1950s and 1960s. Transport in modern tokamaks is
          still “anomalous”, driven by turbulence and well above classical, but far below Bohm.
        </p>
      </section>

      <section id="resistivity">
        <h2>Resistivity of a fully ionized plasma</h2>
        <p>
          An electric field accelerates the electrons against the ions; electron–ion collisions pass that momentum to the ions and
          limit the current. This is a Drude model: j = ne²E/(mν_ei), so η = mν_ei/(ne²). The key is how ν_ei depends on temperature. A
          Coulomb collision deflects an electron strongly only if it passes within the distance where its kinetic energy equals the
          Coulomb energy, b ∝ 1/v². The cross-section goes as b² ∝ 1/v⁴, so ν_ei = nσv ∝ n/v³ ∝ <M>{'nT_e^{-3/2}'}</M>. The many weak, distant
          deflections add the factor lnΛ, a slowly varying number between about 10 and 20.
        </p>
        <Eq
          title="Spitzer resistivity"
          src="\s{eta}{\eta_\parallel} \approx 5.2\times10^{-5}\,\dfrac{\s{Z}{Z}\,\s{lnL}{\ln\Lambda}}{\s{T}{T_{eV}^{3/2}}}\ \Omega\,\text{m}"
          plot="a7-spitzer"
          symbols={{
            eta: { name: 'η∥, parallel (Spitzer) resistivity', units: 'Ω·m', note: 'For current along B, or with no field. For current across B, η⊥ ≈ 2η∥.' },
            Z: { name: 'Z, ion charge state', note: 'The 5.2×10⁻⁵ is for Z = 1. For heavier ions the numerical factor drops by up to about 40%, so the true Z dependence is weaker than linear.' },
            lnL: { name: 'lnΛ, Coulomb logarithm', note: 'Counts the weak, distant collisions. About 10 in cold dense plasmas, 15 to 20 in fusion plasmas.' },
            T: { name: 'T_eV, electron temperature in eV', units: 'eV', note: 'The only strong dependence: η falls as the −3/2 power of temperature. Ten times hotter, about 32 times less resistive.' },
          }}
          says="No density: more carriers, but proportionally more collisions. A 1 keV hydrogen plasma conducts about as well as copper; at 10 keV it is about twenty times better."
        />
        <p>
          Where the 5.2×10⁻⁵ comes from: η∥ = 0.51 m_e/(ne²τ_e) with the standard electron collision time
          <M>{'\\ \\tau_e = 6\\sqrt{2}\\,\\pi^{3/2}\\varepsilon_0^2\\sqrt{m_e}\\,(kT_e)^{3/2}/(\\ln\\Lambda\\, e^4 n)'}</M>. Evaluated in SI
          units that gives <M>{'5.3\\times10^{-5}\\ln\\Lambda/T_{eV}^{3/2}'}</M> Ω·m, within about 1% of the 5.2×10⁻⁵ quoted by Chen. The factor 0.51 (rather than 1) appears because the current is carried mostly by
          the faster electrons, which collide less; electron–electron collisions partly undo that advantage. The formula assumes a fully ionized plasma, Maxwellian electrons, no neutrals, and no trapped
          particles; in a tokamak, electrons trapped in the weak-field side’s magnetic mirror cannot carry current, which raises the
          effective resistivity (neoclassical correction).
        </p>
        <Plotter spec={plotById('a7-spitzer')!} />
        <p>
          This has a sharp consequence for heating. A tokamak drives a large current through its plasma, and the ohmic power ηj² heats it.
          But as the plasma heats up, η falls as <M>{'T_e^{-3/2}'}</M>, and the current cannot be raised freely because it is limited by stability.
          Ohmic heating therefore stalls at a few keV, short of the roughly 10 keV that fusion needs. The rest has to come from neutral
          beams or from waves, such as the electron cyclotron heating of A6.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Collisions also damp waves: an electron oscillating in a laser field loses its ordered motion to ions at the rate ν_ei, which
          is collisional (inverse bremsstrahlung) absorption, lesson B2. Diffusion across B sets how long a magnetic bottle can hold a
          plasma, and the question of whether that bottle is stable at all is A8.
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'A7-p1', kind: 'numeric', concept: 'bohm-diffusion', prompt: 'Estimate the Bohm diffusion coefficient for a plasma with $T_e = 100$ eV in a field of 1 T, in m²/s.', answer: 6.25, tol: 0.02, unit: 'm²/s', hints: ['$D_B = kT_e/(16eB)$, and $kT_e/e$ is the temperature in volts.'], solution: '$D_B = 100\\ \\text{V}/(16 \\times 1\\ \\text{T}) = 6.25$ m²/s. The classical value for a fusion-grade plasma in the same field would be smaller by many orders of magnitude.' },
    { id: 'A7-p2', kind: 'numeric', concept: 'spitzer-resistivity', prompt: 'Use Spitzer’s formula to estimate the resistivity of a hydrogen plasma at $T_e = 1$ keV with $\\ln\\Lambda = 15$. Give it in units of $10^{-8}\\ \\Omega\\,\\text{m}$.', answer: 2.47, tol: 0.03, unit: '×10⁻⁸ Ω·m', hints: ['$\\eta \\approx 5.2\\times10^{-5}\\,Z\\ln\\Lambda/T_{eV}^{3/2}$ Ω·m.', '$1000^{3/2} = 3.16\\times10^4$.'], solution: '$\\eta = 5.2\\times10^{-5}\\times15/3.16\\times10^4 = 2.47\\times10^{-8}$ Ω·m, only about 1.5 times the resistivity of copper ($1.7\\times10^{-8}$ Ω·m).' },
    { id: 'A7-p3', kind: 'numeric', concept: 'diffusion-decay', prompt: 'A plasma slab between two absorbing walls 10 cm apart has an ambipolar diffusion coefficient of 1 m²/s. After the source is switched off, what is the decay time of the lowest diffusion mode, in milliseconds?', answer: 1.013, tol: 0.03, unit: 'ms', hints: ['$\\tau_1 = (L/\\pi)^2/D$ with $L = 0.1$ m.'], solution: '$\\tau_1 = (0.1/\\pi)^2/1 = 1.01\\times10^{-3}$ s ≈ 1.0 ms. Higher modes decay faster: $\\sin(2\\pi x/L)$, present if the profile is lopsided, 4 times faster, and $\\cos(3\\pi x/L)$ 9 times faster.' },
    { id: 'A7-p4', kind: 'numeric', concept: 'classical-diffusion-across-b', prompt: 'Electrons with $T_e = 2$ eV collide with neutrals at $\\nu = 10^8\\ \\text{s}^{-1}$ in a field of 0.01 T. What is their diffusion coefficient across B, in m²/s?', answer: 11.3, tol: 0.03, unit: 'm²/s', hints: ['First $D = kT/(m\\nu)$, with $kT = 2\\times1.602\\times10^{-19}$ J.', '$\\omega_c = eB/m = 1.76\\times10^{9}$ s⁻¹, so $\\omega_c\\tau = 17.6$.'], solution: '$D = 3.20\\times10^{-19}/(9.11\\times10^{-31}\\times10^8) = 3.52\\times10^3$ m²/s. With $\\omega_c\\tau = 17.6$, $D_\\perp = 3.52\\times10^3/(1 + 309) = 11.3$ m²/s, about 300 times less than along B.' },
    { id: 'A7-p5', kind: 'mcq', concept: 'ohmic-heating', prompt: 'Why can ohmic heating alone not bring a tokamak plasma to fusion temperatures?', options: ['The current cannot flow along the magnetic field', 'The resistivity falls as $T_e^{-3/2}$, so the heating power $\\eta j^2$ falls as the plasma heats, and the current is capped by stability', 'Hot electrons stop colliding with neutral atoms', 'The plasma density drops as it heats'], correct: 1, hints: ['How does the Spitzer resistivity depend on temperature?'], solution: 'Ohmic power is $\\eta j^2$. Since $\\eta \\propto T_e^{-3/2}$, the same current heats less and less as the plasma gets hotter, and the current cannot be raised freely because of stability limits. Ohmic heating stalls at a few keV, so extra heating (neutral beams, RF waves) is needed.' },
    { id: 'A7-p6', kind: 'numeric', concept: 'ambipolar-diffusion', prompt: 'In a gas discharge, ions alone would diffuse with $D_i = 0.02$ m²/s. The electrons are at 3 eV and the ions at 0.03 eV (roughly room temperature). What is the ambipolar diffusion coefficient, in m²/s?', answer: 2.02, tol: 0.03, unit: 'm²/s', hints: ['$D_a \\approx D_i(1 + T_e/T_i)$.'], solution: '$T_e/T_i = 100$, so $D_a = 0.02 \\times 101 = 2.02$ m²/s. The hot electrons’ electric field drags the ions out a hundred times faster than they would diffuse on their own.' },
  ],
  cards: [
    { id: 'A7-c1', front: 'Free diffusion coefficient, mobility, and the relation between them', back: '$D = kT/(m\\nu)$, $\\mu = |q|/(m\\nu)$, so $\\mu = |q|D/kT$ (Einstein)' },
    { id: 'A7-c2', front: 'Ambipolar diffusion coefficient', back: '$D_a \\approx D_i(1 + T_e/T_i)$: the electrons’ field drags the ions out faster' },
    { id: 'A7-c3', front: 'Classical diffusion across B, and its strong-field limit', back: '$D_\\perp = D/(1 + \\omega_c^2\\tau^2) \\to kT\\nu/(m\\omega_c^2) = r_L^2\\nu \\propto 1/B^2$' },
    { id: 'A7-c4', front: 'Bohm diffusion and its scaling', back: '$D_B = kT_e/(16eB) \\propto T/B$, no dependence on collisions' },
    { id: 'A7-c5', front: 'Spitzer resistivity', back: '$\\eta_\\parallel \\approx 5.2\\times10^{-5}\\,Z\\ln\\Lambda/T_{eV}^{3/2}$ Ω·m, independent of density' },
    { id: 'A7-c6', front: 'Decay time of the lowest diffusion mode in a slab of width $L$', back: '$\\tau_1 = (L/\\pi)^2/D$' },
  ],
}
