import { Eq } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { OrbitSim } from '../sims/OrbitSim'
import type { Lesson } from './types'

export const A2: Lesson = {
  id: 'A2',
  title: 'Single-particle motion',
  subtitle: 'Gyration, E×B, and the guiding-centre drifts',
  minutes: 55,
  refs: ['Chen (3rd ed.), Ch. 2, §2.1–2.3 (uniform fields; ∇B and curvature drifts)', 'Chen §2.7 for the summary table of drifts', 'Bellan, Ch. 3'],
  objectives: [
    'Compute the cyclotron frequency and Larmor radius of electrons and ions',
    'Derive the E×B drift and explain why it carries no current',
    'Predict the direction of ∇B and gravitational drifts for each species',
  ],
  sections: [
    { id: 'gyration', label: 'Gyration' },
    { id: 'sandbox', label: 'Sandbox' },
    { id: 'exb', label: 'E×B drift' },
    { id: 'general', label: 'Any force' },
    { id: 'gradb', label: '∇B drift' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="gyration">
        <h2>Gyration</h2>
        <p>
          A charged particle in a uniform magnetic field feels a force <em>perpendicular</em> to its velocity. That force can bend the
          path but never change the speed, so the particle circles the field line while sliding freely along it: a helix. Two numbers
          describe the circle: how fast it turns and how big it is.
        </p>
        <Eq
          title="Cyclotron frequency"
          src="\s{w}{\omega_c} = \dfrac{|\s{q}{q}|\, \s{B}{B}}{\s{m}{m}}"
          plot="cyclotron-frequency"
          symbols={{
            w: { name: 'ω_c, cyclotron (gyro) frequency', units: 'rad/s', note: 'How fast the particle circles. For electrons f_ce ≈ 28 GHz per tesla, which is why fusion experiments heat electrons with gyrotrons.' },
            q: { name: 'q, charge', units: 'C', note: 'The sign decides the sense of rotation: ions circle one way, electrons the other.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'Stronger field, tighter and faster circles.' },
            m: { name: 'm, mass', units: 'kg', note: 'Heavier particles turn more slowly: protons gyrate 1836 times slower than electrons.' },
          }}
          says="The turning rate depends only on charge-to-mass ratio and field strength, not on speed. Faster particles simply trace bigger circles in the same time."
        />
        <Eq
          title="Larmor radius"
          src="\s{r}{r_L} = \dfrac{\s{v}{v_\perp}}{\omega_c} = \dfrac{\s{m}{m}\, \s{v}{v_\perp}}{|\s{q}{q}|\, \s{B}{B}}"
          plot="larmor-radius"
          symbols={{
            r: { name: 'r_L, Larmor (gyro) radius', units: 'm', note: 'Radius of the circle. It sets the finest scale on which a magnetized particle can notice structure in the field.' },
            v: { name: 'v⊥, perpendicular speed', units: 'm/s', note: 'Only the velocity across B goes into the circle. Velocity along B is untouched.' },
            m: { name: 'm, mass', units: 'kg', note: 'At equal energy, r_L ∝ √m: ion orbits are about 43 times larger than electron orbits.' },
            q: { name: 'q, charge', units: 'C', note: 'Magnitude of the charge.' },
            B: { name: 'B, field strength', units: 'T', note: 'Doubling B halves the orbit.' },
          }}
          says="A strong field wraps particles into tiny circles around field lines. That is the whole idea of magnetic confinement."
        />
      </section>

      <section id="sandbox">
        <h2>Orbit sandbox</h2>
        <p>Start with pure gyration, then add fields one at a time with the preset buttons. Compare the measured drift with theory.</p>
        <OrbitSim />
      </section>

      <section id="exb">
        <h2>The E×B drift</h2>
        <p>
          Add an electric field across B. On the half of its orbit where the particle moves along E it speeds up and its circle widens.
          On the other half it slows and the circle tightens. The mismatch walks the orbit sideways, perpendicular to both E and B.
        </p>
        <Eq
          title="E×B drift"
          src="\s{v}{\mathbf{v}_E} = \dfrac{\s{E}{\mathbf{E}} \times \s{B}{\mathbf{B}}}{B^2}"
          plot="exb"
          symbols={{
            v: { name: 'v_E, E×B drift velocity', units: 'm/s', note: 'Velocity of the guiding centre, the centre of the gyration circle.' },
            E: { name: 'E, electric field', units: 'V/m', note: 'Only the part perpendicular to B causes this drift; E along B simply accelerates particles along the field.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'A stronger field gives a slower drift: v_E = E/B in magnitude.' },
          }}
          says="No charge, mass or energy appears. Ions and electrons drift together at the same speed, so the whole plasma moves and no current flows."
        />
        <Derivation
          lessonId="A2"
          id="exb"
          title="E×B drift from the equation of motion"
          steps={[
            { text: 'Start from the Lorentz force.', math: 'm\\dfrac{d\\mathbf{v}}{dt} = q(\\mathbf{E} + \\mathbf{v}\\times\\mathbf{B})' },
            { text: 'Split the motion into fast gyration plus a steady drift. Averaged over a gyro-period, the acceleration of the guiding centre is zero.', math: '\\mathbf{E} + \\mathbf{v}_E\\times\\mathbf{B} = 0', why: 'The gyration averages to zero over one turn, so only a constant drift can balance a constant E.' },
            { text: 'Take the cross product with B from the right.', math: '\\mathbf{E}\\times\\mathbf{B} = -(\\mathbf{v}_E\\times\\mathbf{B})\\times\\mathbf{B} = \\mathbf{v}_E B^2 - \\mathbf{B}(\\mathbf{v}_E\\cdot\\mathbf{B})', why: 'Use the vector identity (a×b)×c = b(a·c) − a(b·c).' },
            { text: 'The drift is perpendicular to B, so the last term vanishes.', math: '\\mathbf{v}_E = \\dfrac{\\mathbf{E}\\times\\mathbf{B}}{B^2}', why: 'q cancelled in step 2, which is the formal reason both species drift together.' },
          ]}
        />
      </section>

      <section id="general">
        <h2>Any force makes a drift</h2>
        <p>
          The same argument works for any steady force <strong>F</strong> across B: replace qE by F. The result depends on the sign of
          q, unless the force itself is proportional to q (as qE is).
        </p>
        <Eq
          title="General force drift"
          src="\s{v}{\mathbf{v}_F} = \dfrac{1}{\s{q}{q}}\dfrac{\s{F}{\mathbf{F}}\times\mathbf{B}}{B^2}"
          symbols={{
            v: { name: 'v_F, drift from force F', units: 'm/s', note: 'Guiding-centre velocity caused by any steady force.' },
            q: { name: 'q, charge', units: 'C', note: 'The 1/q is the whole story. A force that does not depend on charge, like gravity, pushes ions and electrons in opposite directions.' },
            F: { name: 'F, force', units: 'N', note: 'Gravity gives F = mg. An effective force from field-line curvature or a field gradient gives the drifts below.' },
          }}
          says="Opposite drifts for opposite charges mean current. Currents from gravitational and gradient drifts are what drive many plasma instabilities (Rayleigh–Taylor in A8)."
        />
      </section>

      <section id="gradb">
        <h2>The ∇B drift</h2>
        <p>
          If B is stronger on one side of the orbit, the circle is tighter there and looser on the other side. The orbit crawls sideways,
          perpendicular to both B and its gradient. Ions and electrons go opposite ways.
        </p>
        <Eq
          title="Grad-B drift"
          src="\s{v}{\mathbf{v}_{\nabla B}} = \pm\dfrac{1}{2}\, \s{vp}{v_\perp}\, \s{r}{r_L}\, \dfrac{\mathbf{B}\times\s{g}{\nabla B}}{B^2}"
          symbols={{
            v: { name: 'v_∇B, gradient drift', units: 'm/s', note: 'The ± is + for ions and − for electrons.' },
            vp: { name: 'v⊥, perpendicular speed', units: 'm/s', note: 'Together with r_L this makes the drift ∝ the perpendicular kinetic energy: hot particles drift faster.' },
            r: { name: 'r_L, Larmor radius', units: 'm', note: 'The drift is a finite-orbit effect: it only exists because the orbit samples different fields on each side.' },
            g: { name: '∇B, field gradient', units: 'T/m', note: 'Which way the field gets stronger. The drift is perpendicular to it.' },
          }}
          says="In a tokamak, the field is stronger on the inside of the torus. This drift, plus the curvature drift, separates charges vertically. That is why a tokamak also needs a twist in its field lines."
        />
      </section>
    </>
  ),
  problems: [
    { id: 'A2-p1', kind: 'numeric', prompt: 'What is the electron cyclotron frequency $f_{ce}$ in a 1 T field, in GHz?', answer: 27.99, tol: 0.02, unit: 'GHz', hints: ['$f_{ce} = eB/(2\\pi m_e)$.', '$e/m_e = 1.76\\times10^{11}$ C/kg.'], solution: '$f_{ce} = 1.76\\times10^{11}/(2\\pi) = 2.80\\times10^{10}$ Hz = 28.0 GHz.' },
    { id: 'A2-p2', kind: 'numeric', prompt: 'A proton moves at $v_\\perp = 10^5$ m/s across a 0.1 T field. What is its Larmor radius, in mm?', answer: 10.44, tol: 0.03, unit: 'mm', hints: ['$r_L = m v_\\perp/(eB)$ with $m_p = 1.67\\times10^{-27}$ kg.'], solution: '$r_L = 1.67\\times10^{-27}\\times10^5/(1.60\\times10^{-19}\\times0.1) = 1.04\\times10^{-2}$ m = 10.4 mm.' },
    { id: 'A2-p3', kind: 'numeric', prompt: 'Crossed fields: $E = 1000$ V/m perpendicular to $B = 0.1$ T. What is the E×B drift speed, in km/s?', answer: 10, tol: 0.02, unit: 'km/s', hints: ['$v_E = E/B$.'], solution: '$v_E = 1000/0.1 = 10^4$ m/s = 10 km/s, for ions and electrons alike.' },
    { id: 'A2-p4', kind: 'mcq', prompt: 'In crossed E and B fields, ions and electrons drift…', options: ['in opposite directions at the same speed', 'in the same direction at the same speed', 'in the same direction, electrons faster', 'not at all; they only gyrate'], correct: 1, hints: ['Look for $q$ and $m$ in $\\mathbf{v}_E$.'], solution: '$\\mathbf{v}_E = \\mathbf{E}\\times\\mathbf{B}/B^2$ contains neither $q$ nor $m$. Everything drifts together.' },
    { id: 'A2-p5', kind: 'mcq', prompt: 'Gravity acts on a magnetized plasma. What is the result?', options: ['Ions and electrons fall together', 'Ions and electrons drift horizontally in opposite directions, creating a current', 'Only electrons drift', 'Nothing: magnetic fields cancel gravity'], correct: 1, hints: ['Gravity does not depend on charge, so $1/q$ in the force-drift formula matters.'], solution: '$\\mathbf{v}_g = (m/q)\\,\\mathbf{g}\\times\\mathbf{B}/B^2$. The sign of $q$ flips the direction, and ions (heavier) drift much faster. Opposite drifts mean current.' },
    { id: 'A2-p6', kind: 'numeric', prompt: 'How long does one electron gyration take in a 0.1 T field, in nanoseconds?', answer: 0.357, tol: 0.03, unit: 'ns', hints: ['Period $= 2\\pi/\\omega_{ce}$, and $\\omega_{ce} = eB/m_e$.'], solution: '$\\omega_{ce} = 1.76\\times10^{10}$ rad/s, so $T = 2\\pi/\\omega_{ce} = 3.57\\times10^{-10}$ s = 0.357 ns.' },
  ],
  cards: [
    { id: 'A2-c1', front: 'Cyclotron frequency and its electron value per tesla', back: '$\\omega_c = |q|B/m$; $f_{ce} \\approx 28$ GHz/T' },
    { id: 'A2-c2', front: 'Larmor radius', back: '$r_L = m v_\\perp/(|q|B)$' },
    { id: 'A2-c3', front: 'E×B drift', back: '$\\mathbf{v}_E = \\mathbf{E}\\times\\mathbf{B}/B^2$, independent of $q$, $m$, energy' },
    { id: 'A2-c4', front: 'Drift from a general force $\\mathbf{F}$', back: '$\\mathbf{v}_F = \\dfrac{1}{q}\\dfrac{\\mathbf{F}\\times\\mathbf{B}}{B^2}$' },
    { id: 'A2-c5', front: 'Which drifts produce a current?', back: 'Those whose force does not scale with $q$: gravity, $\\nabla B$, curvature. E×B does not.' },
    { id: 'A2-c6', front: 'Why do tokamaks need twisted field lines?', back: 'In a purely toroidal field, ∇B and curvature drifts separate ions and electrons vertically; the resulting E field drives E×B outward.' },
  ],
}
