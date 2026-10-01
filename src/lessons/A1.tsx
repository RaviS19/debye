import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { DebyeSim } from '../sims/DebyeSim'
import { PlasmaOscSim } from '../sims/PlasmaOscSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A1: Lesson = {
  id: 'A1',
  title: 'What is a plasma?',
  subtitle: 'Debye shielding, the plasma parameter and the plasma frequency',
  minutes: 45,
  refs: ['Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 1, §1.1–1.6', 'Chen Ch. 4, §4.3 for more on plasma oscillations', 'Bellan, Fundamentals of Plasma Physics, Ch. 1'],
  objectives: [
    'Explain why a plasma hides any charge placed in it, and over what distance',
    'Compute $\\lambda_D$, $N_D$ and $\\omega_{pe}$ for any plasma, in your head to one significant figure',
    'State the three conditions that make an ionized gas a plasma',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'shielding', label: 'Shielding' },
    { id: 'derive', label: 'Derive λ_D' },
    { id: 'parameter', label: 'Plasma parameter' },
    { id: 'oscillation', label: 'Plasma frequency' },
    { id: 'criteria', label: 'Criteria' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          Heat a gas enough and electrons are knocked off its atoms. You now have a soup of free electrons and ions. That alone does
          not make it a plasma. What makes it a plasma is that the charges act <strong>collectively</strong>. Each particle feels the
          combined field of a huge number of others, and the whole soup responds as one to anything that disturbs it.
        </p>
        <p>
          Two consequences define everything that follows. The plasma <strong>hides</strong> any charge you put in it (Debye shielding).
          And if you push its electrons, the plasma <strong>rings</strong> at a natural frequency (the plasma frequency). This lesson
          builds both from scratch.
        </p>
      </section>

      <section id="shielding">
        <h2>Debye shielding</h2>
        <p>
          Put a positive charge into a plasma. Electrons are attracted and crowd around it; ions are pushed away a little. From far away
          the charge plus its cloud looks neutral. If the electrons were cold, they would pile right on top of the charge and hide it
          perfectly. They are not cold: thermal motion lets some electrons escape the potential well. The cloud therefore has a size,
          set by a balance between electrostatic attraction and thermal energy. That size is the <strong>Debye length</strong>.
        </p>
        <DebyeSim />
        <Eq
          title="Debye length"
          src="\s{lam}{\lambda_D} = \sqrt{\dfrac{\s{eps}{\varepsilon_0}\, \s{kT}{k T_e}}{\s{n}{n}\, \s{e}{e}^2}}"
          plot="debye-length"
          symbols={{
            lam: { name: 'λ_D, Debye length', units: 'm', note: 'The distance over which a plasma screens out a charge. The potential of a test charge falls by a factor e every λ_D, on top of the usual 1/r.' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: '8.85×10⁻¹² F/m. It sets how strongly charges talk to each other through empty space.' },
            kT: { name: 'kT_e, electron temperature', units: 'J (usually quoted in eV)', note: 'Thermal energy of the electrons. Hot electrons resist being pulled into the cloud, so the cloud is bigger. 1 eV ≈ 11,600 K.' },
            n: { name: 'n, density', units: 'm⁻³', note: 'Number of electrons per cubic metre far from the charge. More electrons available means the charge is shielded over a shorter distance.' },
            e: { name: 'e, elementary charge', units: 'C', note: '1.602×10⁻¹⁹ C, the charge of a proton.' },
          }}
          says="Hotter electrons give a bigger shielding cloud; denser plasma gives a smaller one. The handy form is λ_D ≈ 7430 √(T_eV / n) metres."
        />
        <Plotter spec={plotById('debye-potential')!} />
      </section>

      <section id="derive">
        <h2>Derive it yourself</h2>
        <Derivation
          lessonId="A1"
          id="debye"
          title="Debye length from Poisson + Boltzmann"
          steps={[
            { text: 'Start from Poisson’s equation for the potential around the test charge. Ions are heavy and stay put, so n_i = n∞.', math: '\\varepsilon_0 \\nabla^2 \\phi = -e\\,(n_i - n_e)', why: 'Poisson relates the curvature of φ to the net charge density. Ions move √(m_i/m_e) ≈ 43 times slower than electrons at the same temperature, so on the electron timescale they form a fixed background.' },
            { text: 'Electrons in thermal equilibrium follow the Boltzmann distribution in the potential φ.', math: 'n_e = n_\\infty \\exp\\!\\left(\\dfrac{e\\phi}{kT_e}\\right)', why: 'An electron has potential energy −eφ. Boltzmann says density ∝ exp(−energy/kT) = exp(+eφ/kT): electrons gather where φ is high, i.e. near a positive charge.' },
            { text: 'Far from the charge eφ ≪ kT_e, so expand the exponential to first order.', math: 'n_e \\approx n_\\infty\\left(1 + \\dfrac{e\\phi}{kT_e}\\right)', why: 'This linearization is the key approximation. It fails very close to the charge, which is why the simulation gives the test charge a finite core.' },
            { text: 'Substitute. The n∞ terms cancel, leaving an equation linear in φ.', math: '\\varepsilon_0 \\nabla^2 \\phi = \\dfrac{n_\\infty e^2}{kT_e}\\,\\phi', why: 'n_i − n_e = n∞ − n∞(1 + eφ/kT) = −n∞eφ/kT. Multiply by −e and the signs combine to a plus.' },
            { text: 'Collect the constants into one length.', math: '\\nabla^2 \\phi = \\dfrac{\\phi}{\\lambda_D^2}, \\qquad \\lambda_D^2 = \\dfrac{\\varepsilon_0 kT_e}{n_\\infty e^2}', why: 'The equation has units of 1/length² on both sides, so the combination must be a length. Dimensional analysis alone predicts λ_D up to a constant.' },
            { text: 'In spherical symmetry the solution that vanishes at infinity and matches the bare Coulomb potential near r = 0 is the Yukawa (screened Coulomb) potential.', math: '\\phi(r) = \\dfrac{q}{4\\pi\\varepsilon_0 r}\\, e^{-r/\\lambda_D}', why: 'Try φ = f(r)/r. Then ∇²φ = f″/r, so f″ = f/λ_D², giving f ∝ e^{−r/λ_D}. The growing solution e^{+r/λ_D} is thrown out.' },
          ]}
        />
      </section>

      <section id="parameter">
        <h2>The plasma parameter</h2>
        <p>
          Shielding is a statistical idea: it only works if there are many electrons inside the cloud. Count them with the number of
          particles in a Debye sphere.
        </p>
        <Eq
          title="Plasma parameter"
          src="\s{N}{N_D} = \tfrac{4}{3}\pi\, \s{n}{n}\, \s{lam}{\lambda_D}^3"
          plot="plasma-parameter"
          symbols={{
            N: { name: 'N_D, particles per Debye sphere', note: 'If N_D ≫ 1, shielding is smooth and collective effects dominate over binary collisions. Typical lab and space plasmas have N_D from 10³ to over 10¹⁰.' },
            n: { name: 'n, density', units: 'm⁻³', note: 'Number density of electrons.' },
            lam: { name: 'λ_D, Debye length', units: 'm', note: 'Radius of the sphere.' },
          }}
          says="Because λ_D³ ∝ T^{3/2}/n^{3/2}, N_D ∝ T^{3/2}/√n. Hot, thin plasmas are the most ideal. Cold, dense ones (like warm dense matter in laser targets) can have N_D near 1 and behave very differently."
        />
      </section>

      <section id="oscillation">
        <h2>The plasma frequency</h2>
        <p>
          Now push. Shift a slab of electrons sideways by a small distance ξ. The exposed ions pull them back, they overshoot, and the
          plasma oscillates. Nothing in the restoring force depends on the size of the slab or the wavelength, so every cold plasma
          rings at the same frequency.
        </p>
        <PlasmaOscSim />
        <Eq
          title="Electron plasma frequency"
          src="\s{w}{\omega_{pe}} = \sqrt{\dfrac{\s{n}{n}\, \s{e}{e}^2}{\s{eps}{\varepsilon_0}\, \s{m}{m_e}}}"
          plot="plasma-frequency"
          symbols={{
            w: { name: 'ω_pe, plasma frequency', units: 'rad/s', note: 'Natural oscillation frequency of electrons against the ion background. f_pe = ω_pe/2π ≈ 8.98 √n Hz.' },
            n: { name: 'n, density', units: 'm⁻³', note: 'Denser plasma, more charge exposed per displacement, stiffer spring, higher frequency.' },
            e: { name: 'e, elementary charge', units: 'C', note: 'Appears squared: once for the charge that creates the field and once for the charge that feels it.' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: 'Converts charge density to electric field.' },
            m: { name: 'm_e, electron mass', units: 'kg', note: 'Inertia. Ions have their own, much lower, ion plasma frequency with m_i in place of m_e.' },
          }}
          says="The density alone sets how fast a plasma responds. Electromagnetic waves below ω_pe cannot propagate, which is why the ionosphere reflects shortwave radio and why lasers stop at the critical density (Track B)."
        />
        <Derivation
          lessonId="A1"
          id="plasma-freq"
          title="Plasma frequency from a displaced slab"
          steps={[
            { text: 'Displace all electrons in a slab by ξ(t). A sheet of uncovered ion charge n e ξ per unit area appears on one side and an equal electron excess on the other.' },
            { text: 'The two charge sheets act like a parallel-plate capacitor. Gauss’s law gives the field between them.', math: 'E = \\dfrac{n e \\xi}{\\varepsilon_0}', why: 'A sheet of surface charge σ produces a field σ/ε₀ between the plates of a capacitor, with σ = n e ξ.' },
            { text: 'Newton’s law for each electron. The force points back toward equilibrium.', math: 'm_e \\ddot{\\xi} = -eE = -\\dfrac{n e^2}{\\varepsilon_0}\\,\\xi' },
            { text: 'This is a harmonic oscillator.', math: '\\ddot{\\xi} + \\omega_{pe}^2\\,\\xi = 0, \\qquad \\omega_{pe}^2 = \\dfrac{n e^2}{\\varepsilon_0 m_e}', why: 'No wavelength or slab size appears anywhere, so the frequency is the same for every wavelength in a cold plasma. Temperature changes that; see the Bohm–Gross relation in A5.' },
          ]}
        />
      </section>

      <section id="criteria">
        <h2>When is an ionized gas a plasma?</h2>
        <div className="grid three">
          <div className="card">
            <span className="pill ghost">1 · Size</span>
            <p style={{ marginTop: 10 }}><M>{'\\lambda_D \\ll L'}</M>. The system must be much bigger than the shielding length, or there is no "inside" to be quasi-neutral.</p>
          </div>
          <div className="card">
            <span className="pill ghost">2 · Crowd</span>
            <p style={{ marginTop: 10 }}><M>{'N_D \\gg 1'}</M>. Enough particles in each Debye sphere for shielding to be a collective, statistical effect.</p>
          </div>
          <div className="card">
            <span className="pill ghost">3 · Collisions</span>
            <p style={{ marginTop: 10 }}><M>{'\\omega_{pe}\\tau > 1'}</M>. Electrons must oscillate before a collision with neutral atoms interrupts them, or the gas just behaves like a gas.</p>
          </div>
        </div>
      </section>

      <section id="next">
        <h2>Where this goes</h2>
        <p>
          A2 and A3 follow single particles through electric and magnetic fields. The Boltzmann relation that built the shielding cloud
          returns in A4 as the electron response along B, and the plasma approximation <M>{'n_i \\approx n_e'}</M> is its large-scale
          limit. A5 adds pressure to the plasma oscillation and gets the Bohm–Gross waves. A6 shows why light below <M>{'\\omega_{pe}'}</M>
          cannot get in: it turns around at the critical density, which is where laser–plasma physics (Track B) begins. And A10 meets
          shielding again at a wall, as the sheath.
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'A1-p1', kind: 'numeric', concept: 'debye-length', prompt: 'A laboratory plasma has $n = 10^{18}\\ \\text{m}^{-3}$ and $T_e = 10$ eV. What is its Debye length, in micrometres?', answer: 23.5, tol: 0.03, unit: 'µm', hints: ['Use $\\lambda_D \\approx 7430\\sqrt{T_{eV}/n}$ m.', '$\\sqrt{10/10^{18}} = \\sqrt{10^{-17}} \\approx 3.16\\times10^{-9}$.'], solution: '$\\lambda_D = 7430 \\times 3.16\\times10^{-9} = 2.35\\times10^{-5}$ m $= 23.5$ µm.' },
    { id: 'A1-p2', kind: 'numeric', concept: 'plasma-frequency', prompt: 'What is the electron plasma frequency $f_{pe} = \\omega_{pe}/2\\pi$ of the same plasma ($n = 10^{18}\\ \\text{m}^{-3}$), in GHz?', answer: 8.98, tol: 0.03, unit: 'GHz', hints: ['$f_{pe} \\approx 8.98\\sqrt{n}$ Hz.', '$\\sqrt{10^{18}} = 10^9$.'], solution: '$f_{pe} = 8.98 \\times 10^9$ Hz $= 8.98$ GHz. That is microwave frequency: this plasma reflects microwaves below 9 GHz.' },
    { id: 'A1-p3', kind: 'numeric', concept: 'plasma-parameter', prompt: 'How many particles are in a Debye sphere for that plasma? (Give $N_D$; any value within 5% counts.)', answer: 5.44e4, tol: 0.05, unit: 'particles', hints: ['$N_D = \\tfrac{4}{3}\\pi n \\lambda_D^3$ with $\\lambda_D = 2.35\\times10^{-5}$ m.', '$\\lambda_D^3 \\approx 1.30\\times10^{-14}\\ \\text{m}^3$.'], solution: '$N_D = 4.19 \\times 10^{18} \\times 1.30\\times10^{-14} \\approx 5.4\\times10^{4}$. Much greater than 1, so it is a good plasma.' },
    { id: 'A1-p4', kind: 'mcq', concept: 'debye-length', prompt: 'You quadruple the electron temperature at fixed density. The Debye length…', options: ['halves', 'stays the same', 'doubles', 'quadruples'], correct: 2, hints: ['$\\lambda_D \\propto \\sqrt{T}$.'], solution: '$\\lambda_D \\propto \\sqrt{T_e}$, so ×4 in temperature gives ×2 in length.' },
    { id: 'A1-p5', kind: 'mcq', concept: 'plasma-frequency', prompt: 'Why is the plasma frequency set by the electrons rather than the ions?', options: ['Electrons carry more charge', 'Electrons are far lighter, so they respond much faster', 'Ions are not affected by electric fields', 'Electrons are always hotter'], correct: 1, hints: ['Look at where the mass appears in $\\omega_p$.'], solution: '$\\omega_p \\propto 1/\\sqrt{m}$. Electrons are 1836 times lighter than protons, so they oscillate about 43 times faster and dominate the fast response.' },
    { id: 'A1-p6', kind: 'numeric', concept: 'debye-length', prompt: 'A tokamak core has $n = 10^{20}\\ \\text{m}^{-3}$ and $T_e = 10$ keV. Estimate its Debye length in micrometres.', answer: 74.3, tol: 0.04, unit: 'µm', hints: ['10 keV = $10^4$ eV.', '$\\sqrt{10^4/10^{20}} = 10^{-8}$.'], solution: '$\\lambda_D = 7430 \\times 10^{-8} = 7.4\\times10^{-5}$ m ≈ 74 µm, tiny compared with a metre-scale machine.' },
  ],
  cards: [
    { id: 'A1-c1', front: 'Debye length formula', back: '$\\lambda_D = \\sqrt{\\varepsilon_0 kT_e/(n e^2)} \\approx 7430\\sqrt{T_{eV}/n}$ m' },
    { id: 'A1-c2', front: 'Plasma frequency, and its handy numeric form', back: '$\\omega_{pe} = \\sqrt{n e^2/(\\varepsilon_0 m_e)}$; $f_{pe} \\approx 8.98\\sqrt{n}$ Hz' },
    { id: 'A1-c3', front: 'The three criteria for a plasma', back: '$\\lambda_D \\ll L$, $N_D \\gg 1$, $\\omega_{pe}\\tau > 1$' },
    { id: 'A1-c4', front: 'Why do only electrons appear in the basic Debye length?', back: 'Ions are heavy and respond slowly, so on short timescales they act as a fixed background.' },
    { id: 'A1-c5', front: 'Potential of a shielded test charge', back: '$\\phi = \\dfrac{q}{4\\pi\\varepsilon_0 r} e^{-r/\\lambda_D}$' },
    { id: 'A1-c6', front: 'How does $N_D$ scale with $T$ and $n$?', back: '$N_D \\propto T^{3/2}/\\sqrt{n}$: hot, thin plasmas are most ideal.' },
  ],
}
