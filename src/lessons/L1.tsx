import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { LaserRateSim } from '../sims/LaserRateSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const L1: Lesson = {
  id: 'L1',
  title: 'How a laser makes light',
  subtitle: 'Stimulated emission, population inversion, gain and the laser threshold',
  minutes: 45,
  refs: [
    'Silfvast, Laser Fundamentals (2nd ed.): the chapters on absorption and stimulated emission, population inversion, gain saturation and oscillation above threshold',
    'Keller, Ultrafast Lasers: the laser rate equations and relaxation oscillations',
    'Siegman, Lasers, for depth on rate equations and laser dynamics',
  ],
  objectives: [
    'Explain why stimulated emission makes identical photons, and why amplification needs more atoms up than down',
    'Write the threshold condition $R_1R_2e^{2(g-\\alpha)L} = 1$ and use it to find the gain a laser needs',
    'Predict what the inversion and output do above threshold: clamping, $P_{out} \\propto (r-1)$ and relaxation oscillations',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'gain', label: 'Gain' },
    { id: 'inversion', label: 'Inversion' },
    { id: 'threshold', label: 'Threshold' },
    { id: 'switch-on', label: 'Switch it on' },
    { id: 'derive', label: 'Derive threshold' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          An atom in an excited state can drop to a lower state and emit a photon on its own. That is spontaneous emission: random
          direction, random phase, the light of a lamp. Einstein noticed a second route. A passing photon of the right frequency can
          <strong> stimulate</strong> the drop, and the new photon is a copy of the one that triggered it: same frequency, direction,
          phase and polarization.
        </p>
        <p>
          A laser is built around that copy machine. Get more atoms into the upper state than the lower one, so a photon is more likely
          to make a copy than to be absorbed. Put the atoms between two mirrors so the copies pass through again and again. Once the
          gain per round trip beats the losses, one stray photon grows into a beam. Laser stands for light amplification by stimulated
          emission of radiation, and this lesson builds each of those words.
        </p>
      </section>

      <section id="gain">
        <h2>Gain</h2>
        <p>
          Send a beam through a medium. Each atom in the lower level can absorb a photon, and each atom in the upper level can be
          stimulated to emit one. Both processes have the same cross-section σ (for equal degeneracies), so only the difference in
          population matters.
        </p>
        <Eq
          title="Gain coefficient"
          src="\s{g}{g} = \s{sig}{\sigma}\,(\s{N2}{N_2} - \s{N1}{N_1}),\qquad I(z) = I_0\, e^{\s{g}{g} z}"
          symbols={{
            g: { name: 'g, gain coefficient', units: 'm⁻¹', note: 'Fractional growth of intensity per metre. Negative g is ordinary absorption (Beer–Lambert); positive g is amplification.' },
            sig: { name: 'σ, transition cross-section', units: 'm²', note: 'The effective target area an atom presents to a photon at the line centre. Nd:YAG at 1064 nm has σ ≈ 2.8×10⁻²³ m² (2.8×10⁻¹⁹ cm²).' },
            N2: { name: 'N₂, upper-level density', units: 'm⁻³', note: 'Atoms per cubic metre that can be stimulated to emit.' },
            N1: { name: 'N₁, lower-level density', units: 'm⁻³', note: 'Atoms per cubic metre that can absorb. With unequal degeneracies, N₁ is weighted by g₂/g₁.' },
          }}
          says="Light grows exponentially when there are more atoms up than down. The same equation with N₂ < N₁ is why a glass of coloured water absorbs."
        />
      </section>

      <section id="inversion">
        <h2>Population inversion</h2>
        <p>
          In thermal equilibrium the upper level is always the emptier one. Boltzmann statistics give
          <M>{'N_2/N_1 = e^{-h\\nu/k_BT}'}</M>, and for a visible transition at room temperature that ratio is about 10⁻³³. Heating
          does not rescue you: even at infinite temperature the ratio only reaches 1. Gain needs a population that is not thermal.
        </p>
        <Plotter spec={plotById('l1-boltzmann')!} />
        <p>
          Pumping with light in a two-level system fails too. As the populations approach each other, the pump light is stimulated
          back down as often as it is absorbed, and the best you get is transparency. Real lasers use more levels. In a
          <strong> four-level</strong> laser such as Nd:YAG, the pump lifts atoms to a high band, they relax quickly to the long-lived
          upper laser level, emit down to a lower laser level, and that level empties fast to the ground state. The lower laser level
          stays nearly empty, so even a small upper population is an inversion. Ruby, the first laser, was a three-level system that
          had to pump more than half its ions out of the ground state.
        </p>
      </section>

      <section id="threshold">
        <h2>The threshold</h2>
        <p>
          Put the gain medium, length L, between mirrors of reflectivity <M>{'R_1'}</M> and <M>{'R_2'}</M>. On one round trip a
          photon passes the medium twice, gains <M>{'e^{2gL}'}</M>, loses some to scattering and absorption, and loses a fraction at
          each mirror. Lasing starts when the round trip just breaks even.
        </p>
        <Eq
          title="Threshold condition"
          src="\s{R1}{R_1}\,\s{R2}{R_2}\; e^{2(\s{g}{g_{th}} - \s{a}{\alpha})\s{L}{L}} = 1"
          plot="l1-power-curve"
          symbols={{
            R1: { name: 'R₁, back-mirror reflectivity', note: 'Usually as close to 1 as possible, 99.9% or better.' },
            R2: { name: 'R₂, output-coupler reflectivity', note: 'Deliberately less than 1: the transmitted fraction 1 − R₂ is the laser beam.' },
            g: { name: 'g_th, threshold gain', units: 'm⁻¹', note: 'The gain coefficient the medium must reach before the laser turns on.' },
            a: { name: 'α, distributed loss', units: 'm⁻¹', note: 'Scattering and parasitic absorption inside the cavity, per metre of gain medium.' },
            L: { name: 'L, gain-medium length', units: 'm', note: 'Light crosses it twice per round trip, hence the 2L.' },
          }}
          says="g_th = α + (1/2L) ln(1/R₁R₂). Leakier mirrors or lossier media need more gain, so a higher pump, before anything comes out."
        />
        <p>
          Above threshold something surprising happens: the gain stops rising. Any extra pumping is converted straight into photons,
          which deplete the inversion back to exactly the threshold value. This is <strong>gain clamping</strong>, and it is why output
          power grows linearly with pump above threshold. The plot shows the trade-off in choosing the output coupler: more
          transmission lets more light out, but raises the threshold.
        </p>
      </section>

      <section id="switch-on">
        <h2>Switch it on</h2>
        <p>
          The simulation solves the rate equations for a four-level laser: the inversion is fed by the pump and drained by spontaneous
          decay and stimulated emission; the photons are fed by stimulated emission and drained by the cavity. Pump ratio
          <M>{'r = R/R_{th}'}</M> measures how far above threshold you are.
        </p>
        <LaserRateSim />
        <p>
          When a laser is switched on, the inversion overshoots the threshold before any light has built up. The light then arrives
          as a spike that drives the inversion below threshold, and the two trade energy back and forth until they settle. These
          <strong> relaxation oscillations</strong> ring at roughly <M>{'\\omega_R \\approx \\sqrt{(r-1)/\\tau\\tau_c}'}</M>, where τ is
          the upper-level lifetime and <M>{'\\tau_c'}</M> the photon lifetime in the cavity. They are strong in solid-state lasers, whose
          upper levels live for hundreds of microseconds, and they are the first sign of the dynamics that Q-switching and mode-locking
          exploit.
        </p>
      </section>

      <section id="derive">
        <h2>Derive it yourself</h2>
        <Derivation
          lessonId="L1"
          id="threshold"
          title="Threshold and clamping from a round trip"
          steps={[
            { text: 'Follow an intensity I around the cavity. Two passes through the medium multiply it by the single-pass gain twice.', math: 'I \\to I\\, e^{2(g-\\alpha)L}', why: 'Each pass through length L grows the intensity by e^{(g−α)L}: g from stimulated emission, α from losses spread through the medium.' },
            { text: 'Each mirror keeps only the reflected fraction.', math: 'I \\to I\\, R_1 R_2\\, e^{2(g-\\alpha)L}', why: 'Light reflected by R₂ goes round again; the transmitted 1 − R₂ is the useful output.' },
            { text: 'In steady state the intensity after one round trip must equal what you started with.', math: 'R_1 R_2\\, e^{2(g_{th}-\\alpha)L} = 1', why: 'If the product were above 1 the light would keep growing; below 1 it would die away. A steady laser sits exactly on 1.' },
            { text: 'Solve for the gain.', math: 'g_{th} = \\alpha + \\dfrac{1}{2L}\\ln\\dfrac{1}{R_1R_2}', why: 'Take the logarithm of both sides and divide by 2L.' },
            { text: 'The gain is set by the inversion, so the inversion is fixed too, however hard you pump.', math: '\\sigma\\,(N_2 - N_1)_{th} = g_{th}', why: 'This is gain clamping. Extra pump makes extra photons, and stimulated emission pulls the inversion back to this value.' },
          ]}
        />
      </section>

      <section id="next">
        <h2>Where this goes</h2>
        <p>
          The cavity that sets the threshold also sets which frequencies can lase: only those that fit a whole number of half
          wavelengths between the mirrors. L2 counts those modes and shows how locking their phases turns a steady beam into a train of
          short pulses. In the full laser tracks this lesson opens Track E (Silfvast); the relaxation oscillations here return when
          Q-switching and mode-locking stability are studied with Keller.
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'L1-p1', kind: 'numeric', concept: 'boltzmann-populations', prompt: 'For the 632.8 nm HeNe transition at $T = 300$ K, what is $\\Delta E / k_BT$? (The thermal ratio $N_2/N_1$ is $e^{-\\Delta E/k_BT}$.)', answer: 75.8, tol: 0.02, unit: '', hints: ['$\\Delta E = hc/\\lambda$, about 1.96 eV.', '$k_BT$ at 300 K is about 0.0259 eV.'], solution: '$\\Delta E/k_BT = 1.96/0.0259 \\approx 75.8$, so $N_2/N_1 \\approx e^{-75.8} \\approx 10^{-33}$. Thermal populations are hopeless for visible light.' },
    { id: 'L1-p2', kind: 'numeric', concept: 'small-signal-gain', prompt: 'Nd:YAG has $\\sigma = 2.8\\times10^{-23}\\ \\text{m}^2$. With an inversion of $10^{23}\\ \\text{m}^{-3}$, what is the single-pass gain $I_{out}/I_{in}$ through a 10 cm rod?', answer: 1.323, tol: 0.02, unit: '', hints: ['$g = \\sigma\\,\\Delta N$.', '$G = e^{gL}$ with L = 0.1 m.'], solution: '$g = 2.8\\times10^{-23}\\times10^{23} = 2.8\\ \\text{m}^{-1}$, so $G = e^{0.28} \\approx 1.32$: 32% more light per pass.' },
    { id: 'L1-p3', kind: 'numeric', concept: 'threshold-gain', prompt: 'A cavity has a 10 cm gain medium, $R_1 = 1$, $R_2 = 0.95$ and no internal loss. What threshold gain $g_{th}$ does it need, in $\\text{m}^{-1}$?', answer: 0.256, tol: 0.03, unit: 'm⁻¹', hints: ['$g_{th} = \\alpha + \\frac{1}{2L}\\ln\\frac{1}{R_1R_2}$.', '$\\ln(1/0.95) \\approx 0.0513$.'], solution: '$g_{th} = \\frac{1}{0.2}\\times 0.0513 \\approx 0.256\\ \\text{m}^{-1}$.' },
    { id: 'L1-p4', kind: 'numeric', concept: 'quantum-defect', prompt: 'Yb:YAG is pumped at 940 nm and lases at 1030 nm. What percentage of each absorbed pump photon’s energy becomes heat at minimum (the quantum defect)?', answer: 8.74, tol: 0.03, unit: '%', hints: ['Photon energy is proportional to $1/\\lambda$.', 'Heat fraction $= 1 - \\lambda_p/\\lambda_L$.'], solution: '$1 - 940/1030 = 0.0874$, about 8.7%. That small defect is why Yb lasers scale to very high power.' },
    { id: 'L1-p5', kind: 'mcq', concept: 'population-inversion', prompt: 'Why can you not make a laser by optically pumping a simple two-level system?', options: ['Two-level atoms do not emit light', 'As the populations equalize, the pump stimulates emission as often as absorption, so you reach transparency at best', 'The pump photons have the wrong polarization', 'Spontaneous emission is forbidden in two-level systems'], correct: 1, hints: ['Absorption and stimulated emission have the same cross-section.'], solution: 'Absorption scales with $N_1$ and stimulated emission with $N_2$, with the same σ. The pump can push the system towards $N_2 = N_1$ but never past it, which is zero gain.' },
    { id: 'L1-p6', kind: 'mcq', concept: 'gain-clamping', prompt: 'A laser runs at twice its threshold pump. You double the pump again. What happens to the inversion and the output?', options: ['Inversion doubles, output doubles', 'Inversion stays at threshold, output roughly triples', 'Inversion stays at threshold, output stays the same', 'Inversion halves, output quadruples'], correct: 1, hints: ['Above threshold the gain is clamped.', 'Output ∝ r − 1.'], solution: 'The inversion is clamped at its threshold value. The output goes as $r - 1$: from $2-1 = 1$ to $4-1 = 3$, three times as much.' },
  ],
  cards: [
    { id: 'L1-c1', front: 'What makes a stimulated photon special?', back: 'It copies the stimulating photon: same frequency, direction, phase and polarization.' },
    { id: 'L1-c2', front: 'Gain coefficient (equal degeneracies)', back: '$g = \\sigma(N_2 - N_1)$, and $I(z) = I_0 e^{gz}$' },
    { id: 'L1-c3', front: 'Threshold condition for a laser', back: '$R_1R_2e^{2(g_{th}-\\alpha)L} = 1$, so $g_{th} = \\alpha + \\frac{1}{2L}\\ln\\frac{1}{R_1R_2}$' },
    { id: 'L1-c4', front: 'Why a four-level laser inverts easily', back: 'Its lower laser level empties quickly, so almost any upper-level population is an inversion.' },
    { id: 'L1-c5', front: 'Gain clamping', back: 'Above threshold the inversion stays at its threshold value; extra pump becomes extra photons, so $P_{out} \\propto (r - 1)$.' },
    { id: 'L1-c6', front: 'Relaxation-oscillation frequency', back: '$\\omega_R \\approx \\sqrt{(r-1)/(\\tau\\tau_c)}$: upper-level lifetime τ, photon lifetime $\\tau_c$, pump ratio r.' },
  ],
}
