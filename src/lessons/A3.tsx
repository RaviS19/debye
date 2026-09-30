import { Eq } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { MirrorSim } from '../sims/MirrorSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A3: Lesson = {
  id: 'A3',
  title: 'Adiabatic invariants',
  subtitle: 'The magnetic moment, magnetic mirrors and the loss cone',
  minutes: 50,
  refs: ['Chen (3rd ed.), Ch. 2, §2.3.3 (∇B ∥ B: magnetic mirrors)', 'Chen §2.8 (adiabatic invariants μ, J, Φ)', 'Goldston & Rutherford, Ch. 3'],
  objectives: [
    'Explain why $\\mu = mv_\\perp^2/2B$ is conserved when B changes slowly',
    'Derive the loss-cone condition $\\sin^2\\theta_m = 1/R$',
    'Estimate how many particles a mirror loses and why collisions matter',
  ],
  sections: [
    { id: 'mu', label: 'Magnetic moment' },
    { id: 'mirror', label: 'Mirror' },
    { id: 'derive', label: 'Loss cone' },
    { id: 'invariants', label: 'J and Φ' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="mu">
        <h2>The magnetic moment</h2>
        <p>
          A gyrating particle is a tiny current loop. Its magnetic moment is the current times the loop area. When the field it sits in
          changes slowly (over many gyrations and over distances much larger than r_L), this moment barely changes. It is an
          <strong> adiabatic invariant</strong>: not exactly conserved, but conserved to an accuracy that improves the slower the change.
        </p>
        <Eq
          title="Magnetic moment"
          src="\s{mu}{\mu} = \dfrac{\tfrac{1}{2}\, \s{m}{m}\, \s{v}{v_\perp}^2}{\s{B}{B}}"
          plot="mirror-profile"
          symbols={{
            mu: { name: 'μ, magnetic moment', units: 'J/T', note: 'Current × area of the gyration loop. Equivalently, perpendicular kinetic energy per unit field.' },
            m: { name: 'm, mass', units: 'kg', note: 'Particle mass.' },
            v: { name: 'v⊥, perpendicular speed', units: 'm/s', note: 'Speed around the field line. Along the field (v∥) does not enter.' },
            B: { name: 'B, local field strength', units: 'T', note: 'As B rises, v⊥² must rise in proportion to keep μ fixed.' },
          }}
          says="If a particle moves into a stronger field, its perpendicular energy must grow. The magnetic flux through its orbit stays the same."
        />
      </section>

      <section id="mirror">
        <h2>The magnetic mirror</h2>
        <p>
          Squeeze the field lines together at both ends of a tube. A particle drifting toward an end sees B rise. Keeping μ constant
          forces v⊥ up, but a magnetic field does no work, so the total energy is fixed and v∥ has to fall. If B rises enough, v∥ reaches
          zero and the particle is reflected. Particles bounce back and forth between the two ends. The Van Allen belts are a natural
          mirror: Earth's dipole field is strongest near the poles, where particles bounce back.
        </p>
        <MirrorSim />
      </section>

      <section id="derive">
        <h2>The loss cone</h2>
        <Derivation
          lessonId="A3"
          id="losscone"
          title="Which particles are trapped?"
          steps={[
            { text: 'Launch a particle at the midplane, where the field is B₀, with speed v and pitch angle θ₀ between v and B.', math: 'v_{\\perp 0} = v\\sin\\theta_0, \\qquad v_{\\parallel 0} = v\\cos\\theta_0' },
            { text: 'The magnetic field does no work, so the speed stays v everywhere.', math: 'v_\\perp^2 + v_\\parallel^2 = v^2' },
            { text: 'μ is conserved, so v⊥² grows in proportion to B.', math: '\\dfrac{v_\\perp^2}{B} = \\dfrac{v^2\\sin^2\\theta_0}{B_0}' },
            { text: 'The particle turns around where all its speed is perpendicular: v⊥ = v.', math: 'B_{\\text{turn}} = \\dfrac{B_0}{\\sin^2\\theta_0}', why: 'Setting v∥ = 0 means v⊥² = v². Substitute into the previous line and solve for B.' },
            { text: 'It is trapped only if that turning point exists, i.e. B_turn is below the maximum field B_m. Define the mirror ratio R = B_m/B₀.', math: '\\sin^2\\theta_0 > \\dfrac{B_0}{B_m} = \\dfrac{1}{R}' },
            { text: 'Particles with smaller pitch angles, inside the cone θ₀ < θ_m, escape. For an isotropic plasma the lost fraction is the solid angle of the two cones.', math: '\\sin^2\\theta_m = \\dfrac{1}{R}, \\qquad f_{\\text{lost}} = 1 - \\cos\\theta_m', why: 'Each cone subtends 2π(1 − cos θ_m) steradians. Two cones out of 4π total gives 1 − cos θ_m.' },
          ]}
        />
        <Eq
          title="Loss-cone condition"
          src="\sin^2\s{th}{\theta_m} = \dfrac{1}{\s{R}{R}} = \dfrac{\s{B0}{B_0}}{\s{Bm}{B_m}}"
          plot="loss-cone"
          symbols={{
            th: { name: 'θ_m, loss-cone half-angle', units: 'rad', note: 'Particles whose velocity at the midplane is closer than θ_m to the field direction escape.' },
            R: { name: 'R, mirror ratio', note: 'How much stronger the field is at the throat than at the centre.' },
            B0: { name: 'B₀, midplane field', units: 'T', note: 'The weakest field, in the middle of the trap.' },
            Bm: { name: 'B_m, peak field', units: 'T', note: 'The field at the mirror throats (at the coils).' },
          }}
          says="The loss cone does not depend on charge, mass or energy, only on the field geometry. Collisions keep scattering trapped particles into the cone, which is why simple mirrors leak and fusion research moved to closed toroidal fields."
        />
        <Plotter spec={plotById('loss-cone')!} />
      </section>

      <section id="invariants">
        <h2>Three invariants, three timescales</h2>
        <div className="grid three">
          <div className="card">
            <span className="pill">μ · gyration</span>
            <p style={{ marginTop: 10 }}>Conserved when B changes slowly compared with the gyro-period. The fastest motion, the most robust invariant.</p>
          </div>
          <div className="card">
            <span className="pill">J · bounce</span>
            <p style={{ marginTop: 10 }}>The longitudinal invariant J = ∮ v∥ ds over one bounce. Conserved if the mirror changes slowly compared with the bounce time. It explains Fermi acceleration between moving mirrors.</p>
          </div>
          <div className="card">
            <span className="pill">Φ · drift</span>
            <p style={{ marginTop: 10 }}>The flux enclosed by the slow drift orbit around, say, Earth. Broken most easily, because the drift is the slowest motion.</p>
          </div>
        </div>
      </section>
    </>
  ),
  problems: [
    { id: 'A3-p1', kind: 'numeric', prompt: 'A mirror has $R = 4$. What is the loss-cone half-angle, in degrees?', answer: 30, tol: 0.01, unit: '°', hints: ['$\\sin^2\\theta_m = 1/R$.'], solution: '$\\sin\\theta_m = 1/\\sqrt{4} = 0.5$, so $\\theta_m = 30°$.' },
    { id: 'A3-p2', kind: 'numeric', prompt: 'For that $R = 4$ mirror, what percentage of an isotropic plasma is lost immediately?', answer: 13.4, tol: 0.03, unit: '%', hints: ['$f = 1 - \\cos\\theta_m$.', '$\\cos 30° = 0.866$.'], solution: '$f = 1 - 0.866 = 0.134$, i.e. 13.4%. Fire 400 particles in the simulation to check.' },
    { id: 'A3-p3', kind: 'numeric', prompt: 'A particle has $v_\\perp = 10^5$ m/s where $B = 0.5$ T and total speed $3\\times10^5$ m/s. It moves slowly into a region with $B = 2$ T. What is its new $v_\\perp$, in km/s?', answer: 200, tol: 0.02, unit: 'km/s', hints: ['$\\mu$ conserved: $v_\\perp^2 \\propto B$.', 'The field went up by 4, so $v_\\perp$ goes up by $\\sqrt{4}$.'], solution: '$v_\\perp = 10^5\\sqrt{2/0.5} = 2\\times10^5$ m/s = 200 km/s. It is still below the total speed, so the particle has not reflected yet.' },
    { id: 'A3-p4', kind: 'numeric', prompt: 'You want to trap every particle with a midplane pitch angle above 20°. What is the minimum mirror ratio?', answer: 8.55, tol: 0.02, unit: '', hints: ['$R = 1/\\sin^2\\theta_m$.', '$\\sin 20° = 0.342$.'], solution: '$R = 1/0.342^2 = 8.55$.' },
    { id: 'A3-p5', kind: 'mcq', prompt: 'Why does a mirror machine keep losing plasma even though most particles start outside the loss cone?', options: ['μ is not really conserved', 'Collisions scatter particles into the loss cone', 'Ions and electrons have different loss cones', 'The E×B drift carries them out'], correct: 1, hints: ['What changes a particle’s pitch angle over time?'], solution: 'Coulomb collisions randomize pitch angles and continually refill the loss cone, so particles leak out on roughly the collision time.' },
    { id: 'A3-p6', kind: 'mcq', prompt: 'A particle moves into a stronger field region, conserving μ. What happens to its total kinetic energy?', options: ['It increases', 'It decreases', 'It stays the same; energy moves from v∥ to v⊥', 'It depends on the charge'], correct: 2, hints: ['Does a static magnetic field do work?'], solution: 'Magnetic forces are perpendicular to velocity, so they do no work. v⊥ grows and v∥ shrinks by exactly the same energy.' },
  ],
  cards: [
    { id: 'A3-c1', front: 'Magnetic moment μ', back: '$\\mu = \\tfrac{1}{2}mv_\\perp^2/B$, conserved when B changes slowly' },
    { id: 'A3-c2', front: 'Loss-cone condition', back: '$\\sin^2\\theta_m = 1/R = B_0/B_m$' },
    { id: 'A3-c3', front: 'Fraction of an isotropic plasma inside the loss cones', back: '$1 - \\cos\\theta_m$' },
    { id: 'A3-c4', front: 'Where does a mirrored particle turn around?', back: 'Where $B = B_0/\\sin^2\\theta_0$' },
    { id: 'A3-c5', front: 'The three adiabatic invariants and their motions', back: '$\\mu$: gyration; $J$: bounce; $\\Phi$: drift' },
    { id: 'A3-c6', front: 'Why do simple mirrors leak?', back: 'Collisions scatter particles into the loss cone.' },
  ],
}
