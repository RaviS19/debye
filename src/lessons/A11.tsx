import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { LawsonSim } from '../sims/LawsonSim'
import { TokamakOrbitSim } from '../sims/TokamakOrbitSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A11: Lesson = {
  id: 'A11',
  title: 'Controlled fusion',
  subtitle: 'Fusion reactivity, the Lawson criterion and ignition, tokamak orbits, and inertial confinement',
  minutes: 60,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.): the controlled fusion chapter (fusion reactions, the Lawson criterion, magnetic confinement and tokamaks, laser fusion); Ch. 2 for the drifts',
    'Freidberg, Plasma Physics and Fusion Energy: fusion power balance, ignition and Q; single-particle orbits in a tokamak',
    'Wesson, Tokamaks: fusion reactivity, the tokamak field and safety factor, trapped particles and banana orbits',
    'Bosch & Hale, Nuclear Fusion 32, 611 (1992): the reactivity fit used throughout this lesson',
  ],
  objectives: [
    'Use the Bosch–Hale reactivity to compute fusion power and the ignition condition $nT\\tau_E \\geq 12\\,T^2/(E_\\alpha\\langle\\sigma v\\rangle)$',
    'Explain, with the drifts of A2, why a purely toroidal field cannot hold a plasma and how a plasma current (or twisted coils) fixes it',
    'Tell trapped from passing orbits in a tokamak, and explain how inertial fusion trades $\\tau_E$ for $\\rho R$',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'reaction', label: 'D–T' },
    { id: 'reactivity', label: 'Reactivity' },
    { id: 'lawson', label: 'Lawson' },
    { id: 'torus', label: 'Why twist' },
    { id: 'orbits', label: 'Orbits' },
    { id: 'icf', label: 'Inertial' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          Two light nuclei that touch can fuse and release millions of electron-volts. The problem is getting them to touch: they repel
          each other with a Coulomb barrier of a few hundred keV. Quantum tunnelling lets them through at much lower energies, but only
          rarely, so the only practical way is to make the fuel so hot that its ions collide thousands of times with a small chance each
          time. At 10 keV (about 116 million kelvin) hydrogen fuel is a fully ionized plasma, and everything in Track A applies.
        </p>
        <p>
          A burning plasma has to satisfy three things at once: <strong>hot</strong> enough for the reactions to go, <strong>dense</strong>
          enough for them to happen often, and <strong>held together long</strong> enough for the fusion power to pay back what it cost to
          heat it. Magnetic fusion holds a thin plasma for seconds; inertial fusion squeezes a tiny pellet to enormous density and lets it
          burn for a fraction of a nanosecond before it flies apart. This lesson builds the conditions and shows why the magnetic bottle has
          to be twisted.
        </p>
      </section>

      <section id="reaction">
        <h2>The D–T reaction</h2>
        <p>
          The easiest reaction by far is deuterium plus tritium. It releases 17.6 MeV, shared between an alpha particle and a neutron. The
          reactants are nearly at rest, so the products fly apart with equal and opposite momenta, and the kinetic energies split in the
          inverse ratio of the masses: the neutron, four times lighter, takes four fifths.
        </p>
        <Eq
          title="D–T fusion"
          src="\begin{gathered}\s{D}{\mathrm{D}} + \s{T}{\mathrm{T}} \;\to\; \s{a}{{}^{4}\mathrm{He}} + \s{n}{\mathrm{n}} \\ E_\alpha \approx 3.5,\ \ E_n \approx 14.1\ \mathrm{MeV}\end{gathered}"
          symbols={{
            D: { name: 'D, deuterium', note: 'One proton and one neutron. About one hydrogen atom in 6400 in sea water is deuterium, so the supply is effectively unlimited.' },
            T: { name: 'T, tritium', note: 'Radioactive (half-life about 12 years) and absent in nature. A reactor breeds it from lithium in a blanket: n + ⁶Li → T + ⁴He.' },
            a: { name: '⁴He, alpha particle', units: '3.5 MeV', note: 'Charged, so the magnetic field keeps it in the plasma, where it slows down and heats the fuel. Alpha heating is what makes ignition possible.' },
            n: { name: 'n, neutron', units: '14.1 MeV', note: 'Uncharged, so it leaves the plasma at once. It carries 80% of the energy to the blanket, where it becomes heat for a power plant and breeds tritium.' },
          }}
          says="Only the 3.5 MeV alpha stays to heat the plasma; the 14.1 MeV neutron is the power plant's output. That 1 : 4 split appears in every power balance below."
        />
      </section>

      <section id="reactivity">
        <h2>Reactivity</h2>
        <p>
          The fusion cross-section σ(E) rises steeply with collision energy because tunnelling through the Coulomb barrier gets
          exponentially easier. A plasma has a Maxwellian spread of energies, so what matters is the average of σv over all pairs, the
          reactivity ⟨σv⟩. The product of a falling Maxwellian tail and a rising tunnelling probability peaks well above the temperature:
          at 10 keV most D–T reactions come from pairs colliding with a few tens of keV, deep in the tail.
        </p>
        <Eq
          title="Bosch–Hale reactivity"
          src="\begin{gathered}\s{sv}{\langle\sigma v\rangle} = \s{C}{C_1}\,\s{th}{\theta}\sqrt{\dfrac{\s{xi}{\xi}}{\s{mr}{m_rc^2}\,\s{T}{T}^3}}\;e^{-3\xi} \\ \xi = \left(\dfrac{\s{BG}{B_G}^2}{4\theta}\right)^{1/3}\end{gathered}"
          plot="a11-reactivity"
          symbols={{
            sv: { name: '⟨σv⟩, reactivity', units: 'cm³/s in the paper (×10⁻⁶ for m³/s)', note: 'The reaction rate per unit volume divided by n_D n_T. D–T: about 1.1×10⁻²² m³/s at 10 keV.' },
            C: { name: 'C₁, fitted constant', note: 'One of seven coefficients (C₁ to C₇) fitted to measured cross-sections by Bosch and Hale in 1992. For D–T, C₁ = 1.17302×10⁻⁹.' },
            th: { name: 'θ, modified temperature', units: 'keV', note: 'θ = T / [1 − T(C₂ + T(C₄ + TC₆)) / (1 + T(C₃ + T(C₅ + TC₇)))]. It absorbs how the measured cross-section departs from the pure tunnelling form (for D–T, mainly a nuclear resonance).' },
            xi: { name: 'ξ, Gamow exponent', note: 'e^{−3ξ} is the tunnelling suppression averaged over the Maxwellian. It shrinks as θ grows, so the reactivity climbs very fast at low temperature.' },
            mr: { name: 'm_rc², reduced mass energy', units: 'keV', note: 'For D–T, 1 124 656 keV.' },
            T: { name: 'T, ion temperature', units: 'keV', note: 'The fit is valid from 0.2 to 100 keV.' },
            BG: { name: 'B_G, Gamow constant', units: 'keV^½', note: 'Set by the charges and reduced mass: B_G = πα Z₁Z₂ √(2m_rc²). For D–T, 34.3827.' },
          }}
          says="A slightly corrected Gamow tunnelling factor, averaged over a Maxwellian. The D–T reactivity rises about 150-fold from 3 to 15 keV, peaks near 8.9×10⁻²² m³/s at about 67 keV, and beats D–D by about a factor of 100 at 10–20 keV."
        />
        <Plotter spec={plotById('a11-reactivity')!} />
        <p>
          In a 50:50 D–T plasma with electron density n, there are n/2 of each ion, so the fusion power density is
          <M>{'P_{\\text{fus}} = \\tfrac14 n^2\\langle\\sigma v\\rangle E_{\\text{fus}}'}</M> with <M>{'E_{\\text{fus}} = 17.6'}</M> MeV. At
          n = 10²⁰ m⁻³ and 15 keV that is about 1.9 MW per cubic metre: a tokamak plasma of 800 m³ at these values would produce about
          1.5 GW.
        </p>
      </section>

      <section id="lawson">
        <h2>The Lawson criterion and ignition</h2>
        <p>
          Every plasma leaks heat, by conduction and convection across the field (A7) and by radiation. Lump it all into one number, the
          energy confinement time τ_E: the thermal energy divided by the power lost. The plasma ignites when the alphas alone replace those
          losses, so no external heating is needed.
        </p>
        <Derivation
          lessonId="A11"
          id="ignition"
          title="The ignition condition"
          steps={[
            { text: 'Thermal energy per unit volume, with electrons and ions (n of each) at the same temperature T.', math: 'W = \\tfrac32 nkT + \\tfrac32 nkT = 3nkT', why: 'Each species has 3/2 kT per particle. In a 50:50 D–T plasma the ion density n_D + n_T equals the electron density n.' },
            { text: 'Define the energy confinement time by the loss power: whatever the mechanism, the plasma loses its energy in a time τ_E.', math: 'P_{\\text{loss}} = \\dfrac{W}{\\tau_E} = \\dfrac{3nkT}{\\tau_E}' },
            { text: 'Alpha heating: each reaction leaves E_α = 3.5 MeV in the plasma.', math: 'P_\\alpha = n_D n_T\\langle\\sigma v\\rangle E_\\alpha = \\tfrac14 n^2\\langle\\sigma v\\rangle E_\\alpha', why: 'The reaction rate per volume is n_D n_T⟨σv⟩ for two different species (no factor ½ for double counting, which only applies to identical particles such as D–D).' },
            { text: 'Ignition: alpha heating at least balances the losses. Solve for the product nτ_E.', math: 'n\\tau_E \\geq \\dfrac{12\\,kT}{E_\\alpha\\langle\\sigma v\\rangle}', why: '¼n²⟨σv⟩E_α ≥ 3nkT/τ_E. Divide by n/4.' },
            { text: 'Multiply by kT to get the triple product, the quantity quoted for progress in magnetic fusion.', math: 'n\\,kT\\,\\tau_E \\geq \\dfrac{12\\,(kT)^2}{E_\\alpha\\langle\\sigma v\\rangle}', why: 'nkT is the plasma pressure, which the magnetic field and stability limit (A8). So the triple product is roughly pressure × confinement time.' },
            { text: 'The right side is smallest where ⟨σv⟩ grows exactly as T². With Bosch–Hale this happens near 13.5 keV, where the minimum is', math: 'n T\\tau_E \\geq 2.8\\times10^{21}\\ \\text{keV}\\cdot\\text{s}/\\text{m}^3', why: 'Minimizing T²/⟨σv⟩: d ln⟨σv⟩/d ln T = 2 at the optimum. Below it the reactivity collapses; above it the pressure grows faster than the reactivity. This ignores radiation, which pushes the requirement up at low T.' },
          ]}
        />
        <Eq
          title="Ignition triple product"
          src="\s{n}{n}\,\s{T}{T}\,\s{tau}{\tau_E} \;\geq\; \dfrac{12\,T^2}{\s{Ea}{E_\alpha}\,\s{sv}{\langle\sigma v\rangle}}"
          plot="a11-triple-product"
          symbols={{
            n: { name: 'n, electron (= ion) density', units: 'm⁻³', note: 'Tokamaks run near 10²⁰ m⁻³, a few millionths of the number density of air.' },
            T: { name: 'T, temperature', units: 'keV (energy units, so k is absorbed)', note: 'Ions and electrons assumed equal. The optimum for the triple product is near 14 keV.' },
            tau: { name: 'τ_E, energy confinement time', units: 's', note: 'Thermal energy divided by loss power. Set mainly by turbulent transport across the field.' },
            Ea: { name: 'E_α, alpha energy', units: '3.5 MeV', note: 'Only the charged product heats the plasma; the neutron escapes.' },
            sv: { name: '⟨σv⟩, D–T reactivity', units: 'm³/s', note: 'From Bosch–Hale; about 2.7×10⁻²² m³/s at 15 keV.' },
          }}
          says="At the best temperature, a D–T plasma ignites when density × temperature × confinement time exceeds about 3×10²¹ keV·s/m³: for example 10²⁰ m⁻³, 14 keV and 2 s."
        />
        <p>
          Short of ignition you can still get net fusion power by heating from outside. Define the gain Q as fusion power over heating power.
          In steady state the heating plus alpha power replaces the losses, <M>{'P_{\\text{heat}} + P_\\alpha = 3nkT/\\tau_E'}</M>, which gives
          <M>{'\\;n\\tau_E = 12kT/[\\langle\\sigma v\\rangle E_{\\text{fus}}(1/Q + E_\\alpha/E_{\\text{fus}})]'}</M>. Q = 1 (scientific
          breakeven) needs six times less nτ_E than ignition, Q = ∞. A power plant needs Q of order 10 or more, because heating systems and
          electricity generation are far from perfectly efficient; ITER was designed to reach Q = 10.
        </p>
        <LawsonSim />
        <Plotter spec={plotById('a11-lawson')!} />
      </section>

      <section id="torus">
        <h2>Why the field must twist</h2>
        <p>
          A3 showed that a straight magnetic bottle leaks out of its ends. The obvious fix is to bend the tube into a doughnut, a torus,
          so the field lines close on themselves. Coils around the tube make a toroidal field. It fails, and the reason is the drifts of A2.
        </p>
        <Derivation
          lessonId="A11"
          id="torus-drift"
          title="A purely toroidal field cannot hold a plasma"
          steps={[
            { text: 'Ampère’s law around the torus: the coil current threads the loop the same way at every major radius R, so the field falls off as 1/R.', math: 'B_\\phi = \\dfrac{\\mu_0 N I}{2\\pi R} \\propto \\dfrac{1}{R}', why: 'N coils carrying current I; the enclosed current NI is the same for any circle inside the tube. The field is stronger on the inside (small R).' },
            { text: 'So ∇B points toward the torus axis, and the field lines are circles, curved around the same axis. Both give drifts (A2), and for B ∝ 1/R they add up exactly.', math: '\\mathbf v_{\\nabla B} + \\mathbf v_R = \\dfrac{m}{qBR}\\left(v_\\parallel^2 + \\tfrac12 v_\\perp^2\\right)\\hat{\\mathbf z}', why: 'Curvature drift (m v∥²/qB²)(R_c × B)/R_c², ∇B drift (m v⊥²/2qB)(B × ∇B)/B². With ∇B = −(B/R)R̂ and R_c = R R̂ both point along ẑ for B along +φ̂.' },
            { text: 'The drift is vertical and depends on the sign of q: ions go one way (up, for B along +φ̂), electrons the other.', why: 'This is a charge-dependent drift, so it is a current, unlike E×B. The simulation below measures exactly this drift speed.' },
            { text: 'Charge piles up: positive at the top, negative at the bottom. That makes a vertical electric field inside the plasma, pointing down.', math: '\\mathbf E = -E\\,\\hat{\\mathbf z}' },
            { text: 'Now every particle feels E×B. For both species it points away from the torus axis: the whole plasma is pushed outward into the wall.', math: '\\mathbf v_E = \\dfrac{\\mathbf E\\times\\mathbf B}{B^2} = \\dfrac{E}{B}\\,(-\\hat{\\mathbf z}\\times\\hat{\\boldsymbol\\phi}) = +\\dfrac{E}{B}\\,\\hat{\\mathbf R}', why: 'ẑ × φ̂ = −R̂ in the right-handed (R, φ, z) system. E×B does not depend on charge (A2), so there is nothing to stop it.' },
            { text: 'The cure: twist the field lines so that each one winds around the short way (poloidally) as it goes around the long way. A field line then spends half its time on top and half on the bottom, and electrons flowing freely along it short out the charge separation before it builds up.' },
          ]}
        />
        <p>
          In a <strong>tokamak</strong> the twist comes from a large current driven around the torus inside the plasma itself; its
          poloidal field B_θ adds to the toroidal field B_φ to make helical field lines. In a <strong>stellarator</strong> the twist is built
          into intricately shaped external coils, with no plasma current needed. The twist is measured by the safety factor q.
        </p>
        <Eq
          title="Safety factor"
          src="\begin{gathered}\s{q}{q}(r) = \dfrac{\s{r}{r}\,\s{Bp}{B_\phi}}{\s{R}{R}\,\s{Bt}{B_\theta}} \\ q(a) > 1\ \ \text{(Kruskal–Shafranov)}\end{gathered}"
          symbols={{
            q: { name: 'q, safety factor', note: 'The number of times a field line goes around the torus the long way for each time around the short way. Its inverse, 1/q, is the rotational transform ι/2π.' },
            r: { name: 'r, minor radius', units: 'm', note: 'Distance from the magnetic axis; a is the plasma edge.' },
            Bp: { name: 'B_φ, toroidal field', units: 'T', note: 'From the external coils; typically several tesla.' },
            R: { name: 'R, major radius', units: 'm', note: 'Distance from the torus axis to the magnetic axis.' },
            Bt: { name: 'B_θ, poloidal field', units: 'T', note: 'From the plasma current I: B_θ(a) = μ₀I/(2πa) at the edge of a circular plasma. Typically ten times weaker than B_φ.' },
          }}
          says="Too little twist is dangerous: if q at the edge falls below 1, the whole plasma column can kink into a helix (A8). That caps the plasma current at I < 2πa²B_φ/(μ₀R); real tokamaks keep q at the edge near 3 or more."
        />
        <div className="grid three">
          <div className="card">
            <span className="pill ghost">Tokamak</span>
            <p style={{ marginTop: 10 }}>Twist from a toroidal plasma current, driven inductively by a transformer, which also heats the plasma ohmically (A7). Simple coils and the best confinement so far, but the current must be sustained and can end in a sudden disruption.</p>
          </div>
          <div className="card">
            <span className="pill ghost">Stellarator</span>
            <p style={{ marginTop: 10 }}>Twist from three-dimensional external coils. No plasma current is needed, so it can run steadily without disruptions, at the price of complicated coils that must be built very precisely. Large examples are Wendelstein 7-X in Germany and the Large Helical Device in Japan.</p>
          </div>
          <div className="card">
            <span className="pill ghost">Rotational transform</span>
            <p style={{ marginTop: 10 }}>ι/2π = 1/q: the poloidal turn per toroidal turn. Field lines on each flux surface wind at their own pitch, and where q is a ratio of small integers they close on themselves, which is where instabilities like to start.</p>
          </div>
        </div>
      </section>

      <section id="orbits">
        <h2>Trapped and passing orbits</h2>
        <p>
          The twist fixes the drift, but it creates something new. Following a field line from the outside of the torus to the inside, the
          field strength rises from B₀/(1+ε) to B₀/(1−ε), with ε = r/R₀. That is a magnetic mirror (A3). Ions with enough parallel velocity
          sail through and circulate around the torus: <strong>passing</strong> particles. Those with too little bounce back and forth on the
          outer side: <strong>trapped</strong> particles. Their vertical drift carries them outward on one leg of the bounce and inward on
          the other, so seen in cross-section they trace a banana.
        </p>
        <Eq
          title="Trapping condition"
          src="\begin{gathered}\dfrac{\s{vpar}{v_\parallel}}{\s{vperp}{v_\perp}} < \sqrt{\dfrac{2\s{eps}{\varepsilon}}{1-\varepsilon}} \\ \text{(at the outboard midplane)}\end{gathered}"
          plot="a11-trapping"
          symbols={{
            vpar: { name: 'v∥, speed along B', units: 'm/s', note: 'Measured where the particle is launched, on the outer side where B is weakest.' },
            vperp: { name: 'v⊥, speed across B', units: 'm/s', note: 'μ = mv⊥²/2B is conserved, so v⊥ grows as the particle moves inward to stronger field.' },
            eps: { name: 'ε = r/R₀, inverse aspect ratio', note: 'The mirror ratio along a field line is (1+ε)/(1−ε), so the loss-cone condition of A3 becomes this.' },
          }}
          says="It is the mirror condition of A3 with mirror ratio (1+ε)/(1−ε). Near the edge of a fat tokamak (ε ≈ 0.3) almost 70% of the particles at the outboard midplane are trapped."
        />
        <TokamakOrbitSim />
        <p>
          The banana width comes from conservation of the canonical toroidal momentum: for a thin orbit it is about
          <M>{'\\;2q\\,v_{\\parallel 0}/(\\omega_c\\,\\varepsilon)'}</M>, larger than a Larmor radius by roughly q/√ε. Collisions knock
          particles between bananas, so trapped particles set a floor on transport (neoclassical transport) and, less obviously, drive a
          current of their own, the bootstrap current, which helps a tokamak sustain its twist.
        </p>
      </section>

      <section id="icf">
        <h2>Inertial confinement</h2>
        <p>
          The other route skips the magnetic field. Fill a millimetre-sized capsule with D–T, blast its surface with lasers (directly, or
          with X-rays from a gold can, a hohlraum, as at the National Ignition Facility), and the ablating surface drives the rest inward like
          a rocket. The fuel is compressed to about a thousand times liquid density and a central hot spot reaches fusion temperatures.
          Nothing holds it together except its own inertia: it flies apart in a time of order R/c_s, a fraction of a nanosecond.
        </p>
        <p>
          The Lawson product nτ then becomes n·R/c_s. Since n ∝ ρ, the condition is on the areal density ρR. Two numbers matter. The hot
          spot needs ρR ≈ 0.3 g/cm² at 5–10 keV, so that it stops its own 3.5 MeV alphas and ignites. Burning a useful fraction of the
          fuel needs a dense shell with ρR of a few g/cm² around it.
        </p>
        <Eq
          title="Burn fraction"
          src="\s{f}{f_{\text{burn}}} \approx \dfrac{\s{rr}{\rho R}}{\rho R + \s{H}{H_B}}"
          plot="a11-burn-fraction"
          symbols={{
            f: { name: 'f_burn, burn fraction', note: 'Fraction of the fuel that fuses before the capsule disassembles.' },
            rr: { name: 'ρR, areal density', units: 'g/cm²', note: 'Mass density × radius of the compressed fuel: how much material a particle crosses on its way out.' },
            H: { name: 'H_B, burn parameter', units: 'g/cm²', note: 'About 6–7 g/cm² for D–T at typical burn temperatures. It bundles the reactivity, sound speed and the geometry of disassembly.' },
          }}
          says="Burning a third of the fuel needs ρR ≈ 3 g/cm². Compression is the whole game: squeezing a sphere of fixed mass to radius R raises ρR as 1/R²."
        />
        <p>
          On 5 December 2022 the National Ignition Facility put 2.05 MJ of laser light into a hohlraum and got about 3.15 MJ of fusion energy
          out: a target gain of about 1.5, the first time a fusion target released more energy than the light that drove it. The lasers drew
          roughly 300 MJ from the grid, so this was scientific gain, not net electricity, but it showed that a hot spot can ignite and burn
          into the surrounding fuel.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          This lesson used almost all of Track A: the drifts of A2 decide why the torus must twist, the mirror of A3 makes banana orbits,
          transport from A7 sets τ_E, the stability limits of A8 cap the pressure and the current, and the sheaths of A10 set how much heat
          reaches the wall. Track B follows the inertial route from the laser's side: how light is absorbed in a plasma, and the parametric
          instabilities and hot electrons that can spoil a compression. Track C goes to relativistic intensities, where ideas like fast
          ignition live.
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'A11-p1', kind: 'numeric', concept: 'fusion-power-density', prompt: 'A 50:50 D–T plasma has electron density $n = 10^{20}\\ \\text{m}^{-3}$ and $T = 15$ keV, where $\\langle\\sigma v\\rangle = 2.74\\times10^{-22}\\ \\text{m}^3/\\text{s}$. What is the fusion power density, in MW/m³?', answer: 1.93, tol: 0.03, unit: 'MW/m³', hints: ['$P = \\tfrac14 n^2\\langle\\sigma v\\rangle E_{\\text{fus}}$, since $n_D = n_T = n/2$.', '$E_{\\text{fus}} = 17.6$ MeV $= 2.82\\times10^{-12}$ J.'], solution: '$P = 0.25\\times10^{40}\\times2.74\\times10^{-22}\\times2.82\\times10^{-12} = 1.93\\times10^6$ W/m³ ≈ 1.9 MW/m³. One fifth of it, 0.39 MW/m³, is alpha heating.' },
    { id: 'A11-p2', kind: 'numeric', concept: 'dt-reaction', prompt: 'D–T fusion releases 17.6 MeV. The reactants are nearly at rest. Using momentum conservation and mass numbers 4 (alpha) and 1 (neutron), how much kinetic energy does the alpha carry, in MeV?', answer: 3.52, tol: 0.02, unit: 'MeV', hints: ['Equal and opposite momenta: $p_\\alpha = p_n$.', 'With $E = p^2/2m$, the energies are in the inverse ratio of the masses: $E_\\alpha/E_n = m_n/m_\\alpha = 1/4$.'], solution: '$E_\\alpha = 17.6 \\times \\tfrac{1}{1+4} = 3.52$ MeV, and the neutron takes $14.1$ MeV. Exact nuclear masses shift these by less than 1%.' },
    { id: 'A11-p3', kind: 'numeric', concept: 'lawson-criterion', prompt: 'For the plasma of problem 1 ($n = 10^{20}\\ \\text{m}^{-3}$, $T = 15$ keV, $\\langle\\sigma v\\rangle = 2.74\\times10^{-22}\\ \\text{m}^3/\\text{s}$), what energy confinement time is needed for ignition, in seconds? Ignore radiation.', answer: 1.87, tol: 0.03, unit: 's', hints: ['$n\\tau_E \\geq 12kT/(E_\\alpha\\langle\\sigma v\\rangle)$ with $E_\\alpha = 3.52$ MeV.', '$12kT/E_\\alpha = 12\\times15/3520 = 0.0511$.'], solution: '$n\\tau_E = 0.0511/2.74\\times10^{-22} = 1.87\\times10^{20}$ s/m³, so $\\tau_E = 1.87$ s. The triple product is $2.8\\times10^{21}$ keV·s/m³, right at the minimum of the ignition curve.' },
    { id: 'A11-p4', kind: 'numeric', concept: 'safety-factor', prompt: 'A circular tokamak has $R = 3$ m, $a = 1$ m and $B_\\phi = 5$ T. What is the largest plasma current allowed by the Kruskal–Shafranov limit $q(a) > 1$, in MA?', answer: 8.33, tol: 0.03, unit: 'MA', hints: ['$q(a) = aB_\\phi/(RB_\\theta)$ with $B_\\theta = \\mu_0 I/(2\\pi a)$.', 'Set $q(a) = 1$ and solve: $I = 2\\pi a^2 B_\\phi/(\\mu_0 R)$.'], solution: '$I = 2\\pi\\times1\\times5/(4\\pi\\times10^{-7}\\times3) = 8.33\\times10^6$ A = 8.33 MA. In practice tokamaks keep $q(a) \\approx 3$ or more, so this machine would run below about 2.8 MA.' },
    { id: 'A11-p5', kind: 'numeric', concept: 'trapped-particles', prompt: 'On a flux surface with $\\varepsilon = r/R_0 = 0.1$, what percentage of an isotropic ion population at the outboard midplane is trapped?', answer: 42.6, tol: 0.03, unit: '%', hints: ['Trapped if $v_\\parallel^2/v_\\perp^2 < 2\\varepsilon/(1-\\varepsilon)$. Rewrite with $v_\\parallel = v\\cos\\theta$: $\\cos^2\\theta < 2\\varepsilon/(1+\\varepsilon)$.', 'For an isotropic distribution $\\cos\\theta$ is uniformly distributed, so the trapped fraction is $\\sqrt{2\\varepsilon/(1+\\varepsilon)}$.'], solution: '$\\sqrt{0.2/1.1} = 0.426$, so about 43% are trapped there. Averaged around the whole flux surface the fraction is smaller (it is zero at the inboard midplane, which only passing particles reach), but it still scales as $\\sqrt{\\varepsilon}$, so even a slim tokamak has many trapped particles.' },
    { id: 'A11-p6', kind: 'mcq', concept: 'toroidal-confinement', prompt: 'Why does a tokamak need a toroidal plasma current (or a stellarator its twisted coils)?', options: ['To heat the plasma ohmically; confinement would work without it', 'In a purely toroidal field the ∇B and curvature drifts carry ions and electrons vertically in opposite directions; the resulting vertical electric field drives an outward E×B drift of the whole plasma. Twisted field lines let charges flow along B and short out the separation', 'Without it the particles would stream out through the ends of the field lines', 'The plasma current produces the toroidal field that holds the plasma'], correct: 1, hints: ['In which direction does B vary in a torus, and which drifts does that cause (A2)?', 'Which drift does not depend on the sign of the charge?'], solution: 'B ∝ 1/R, so ∇B and field-line curvature both drive a vertical, charge-dependent drift: ions one way, electrons the other. The charge separation makes a vertical E, and E×B then pushes all particles outward. Twisting the field lines (a poloidal field from the plasma current, or helical coils) connects top and bottom along B, so electrons short out the separation. The current does heat ohmically, but that is not why it is needed; the field lines in a torus have no ends; and the toroidal field comes from external coils.' },
  ],
  cards: [
    { id: 'A11-c1', front: 'D–T reaction and its energy split', back: 'D + T → ⁴He (3.5 MeV) + n (14.1 MeV), 17.6 MeV in all. Only the alpha stays to heat the plasma.' },
    { id: 'A11-c2', front: 'Ignition triple product (D–T, no radiation)', back: '$nT\\tau_E \\geq 12T^2/(E_\\alpha\\langle\\sigma v\\rangle)$, minimum ≈ $2.8\\times10^{21}$ keV·s/m³ near 14 keV. Q = 1 needs about 6× less.' },
    { id: 'A11-c3', front: 'D–T reactivity at 10 keV, and where it peaks', back: '$\\langle\\sigma v\\rangle \\approx 1.1\\times10^{-22}$ m³/s at 10 keV; peak ≈ $8.9\\times10^{-22}$ m³/s near 67 keV (Bosch–Hale)' },
    { id: 'A11-c4', front: 'Why does a purely toroidal field fail?', back: '∇B and curvature drifts separate ions and electrons vertically; the resulting E gives an outward E×B drift of the whole plasma. Twisted field lines short it out.' },
    { id: 'A11-c5', front: 'Safety factor and the Kruskal–Shafranov limit', back: '$q = rB_\\phi/(RB_\\theta)$, toroidal turns per poloidal turn; kink stability needs $q(a) > 1$' },
    { id: 'A11-c6', front: 'Inertial fusion: the confinement parameter and the NIF milestone', back: 'Areal density ρR (hot spot ≈ 0.3 g/cm²). In Dec 2022 NIF got about 3.15 MJ of fusion from 2.05 MJ of laser light.' },
  ],
}
