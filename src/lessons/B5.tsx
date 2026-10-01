import { Eq } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { MatchingTriangleSim } from '../sims/MatchingTriangleSim'
import { PumpedOscillatorsSim } from '../sims/PumpedOscillatorsSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagrams ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 19 }

function arrow(x1: number, y1: number, x2: number, y2: number, color: string, w = 2.5) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const h = 11
  return (
    <g stroke={color} fill={color} strokeWidth={w}>
      <line x1={x1} y1={y1} x2={x2 - 0.6 * h * Math.cos(a)} y2={y2 - 0.6 * h * Math.sin(a)} />
      <path d={`M${x2},${y2} L${x2 - h * Math.cos(a - 0.42)},${y2 - h * Math.sin(a - 0.42)} L${x2 - h * Math.cos(a + 0.42)},${y2 - h * Math.sin(a + 0.42)} Z`} stroke="none" />
    </g>
  )
}

/** The feedback loop of a parametric instability, drawn for stimulated Raman scattering. */
function LoopDiagram() {
  let ripple = ''
  for (let i = 0; i <= 80; i++) {
    const x = 30 + i * 2.15
    ripple += `${i ? 'L' : 'M'}${x.toFixed(1)},${(84 + 14 * Math.sin(i * 0.47)).toFixed(1)} `
  }
  let wave = ''
  for (let i = 0; i <= 80; i++) {
    const x = 400 + i * 2.15
    wave += `${i ? 'L' : 'M'}${x.toFixed(1)},${(84 + 14 * Math.sin(-i * 0.3)).toFixed(1)} `
  }
  const big = { ...svgText, fontSize: 25 }
  const mid = { ...svgText, fontSize: 22 }
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 600 340" style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto' }} role="img" aria-label="Feedback loop: the pump scatters off a density ripple, and the scattered light beats with the pump to deepen the ripple">
        <path d={ripple} fill="none" stroke="#4ade80" strokeWidth={3.5} />
        <text x={30} y={40} fill="#4ade80" style={big}>density ripple</text>
        <text x={30} y={134} fill="#9aa0c9" style={mid}>a plasma wave</text>
        <path d={wave} fill="none" stroke="#22d3ee" strokeWidth={3.5} />
        <text x={400} y={40} fill="#22d3ee" style={big}>scattered light</text>
        <text x={400} y={134} fill="#9aa0c9" style={mid}>ω₀ − ω, k₀ − k</text>
        {arrow(218, 84, 388, 84, '#e8eaf6')}
        <text x={303} y={68} fill="#e8eaf6" style={mid} textAnchor="middle">1 · pump × ripple</text>
        <text x={303} y={112} fill="#e8eaf6" style={mid} textAnchor="middle">radiates</text>
        <rect x={205} y={196} width={190} height={66} rx={12} fill="rgba(251,191,36,0.12)" stroke="#fbbf24" strokeWidth={2} />
        <text x={300} y={225} fill="#fbbf24" style={big} textAnchor="middle">pump laser</text>
        <text x={300} y={252} fill="#fbbf24" style={mid} textAnchor="middle">ω₀, k₀</text>
        <path d="M485,146 C485,190 440,222 397,228" fill="none" stroke="#e8eaf6" strokeWidth={2.5} />
        <path d="M203,228 C150,222 115,190 112,160" fill="none" stroke="#e8eaf6" strokeWidth={2.5} />
        {arrow(112, 168, 110, 146, '#e8eaf6')}
        <text x={592} y={300} fill="#e8eaf6" style={mid} textAnchor="end">2 · pump × scattered</text>
        <text x={592} y={328} fill="#e8eaf6" style={mid} textAnchor="end">light beat at ω, k</text>
        <text x={8} y={300} fill="#e8eaf6" style={mid}>3 · ponderomotive</text>
        <text x={8} y={328} fill="#e8eaf6" style={mid}>force deepens it</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        The loop behind every three-wave instability, drawn for stimulated Raman scattering. Electrons quiver in the pump at v_os; where a
        density ripple makes more of them, the quiver current is larger, and that modulated current radiates light at the difference
        frequency and wavenumber. The scattered light and the pump beat together, and the ponderomotive force of the beat (B4) pushes
        electrons with exactly the ripple’s k and ω, so the ripple grows, which scatters more light. Each turn of the loop multiplies both
        daughters by the same factor: exponential growth.
      </figcaption>
    </figure>
  )
}

/** Where along the density profile each process can happen. */
function DensityMap() {
  const X = (n: number) => 30 + 540 * n
  const t = { ...svgText, fontSize: 22 }
  const band = (n0: number, n1: number, y: number, color: string, inside: string, outside: string, side: 'right' | 'left') => (
    <g>
      <rect x={X(n0)} y={y} width={X(n1) - X(n0)} height={34} rx={6} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.8} />
      {inside && (
        <text x={X(n0) + 8} y={y + 25} fill="#e8eaf6" style={t}>
          {inside}
        </text>
      )}
      {outside && (
        <text x={side === 'right' ? X(n1) + 10 : X(n0) - 10} y={y + 25} fill="#9aa0c9" style={t} textAnchor={side === 'right' ? 'start' : 'end'}>
          {outside}
        </text>
      )}
    </g>
  )
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 600 320" style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto' }} role="img" aria-label="Density ranges where SRS, SBS, two-plasmon decay, ion-acoustic decay and the oscillating two-stream instability can occur">
        {arrow(X(0), 266, X(1.04), 266, '#9aa0c9', 2)}
        <text x={X(1.0)} y={300} fill="#9aa0c9" style={t} textAnchor="middle">n_c</text>
        <text x={X(0.25)} y={300} fill="#9aa0c9" style={t} textAnchor="middle">n_c/4</text>
        <text x={X(0)} y={300} fill="#9aa0c9" style={t} textAnchor="middle">0</text>
        <text x={X(0.6)} y={300} fill="#9aa0c9" style={t} textAnchor="middle">density →</text>
        <line x1={X(0.25)} y1={12} x2={X(0.25)} y2={268} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={1.5} />
        <line x1={X(1)} y1={12} x2={X(1)} y2={268} stroke="#fb5f5f" strokeDasharray="5 5" strokeWidth={1.5} />
        {band(0, 0.25, 16, '#22d3ee', 'SRS', 'light + plasma wave', 'right')}
        {band(0.19, 0.25, 64, '#4ade80', '', 'TPD: two plasma waves', 'right')}
        {band(0, 1, 112, '#f472b6', 'SBS: light + ion acoustic wave', '', 'right')}
        {band(0.86, 1, 160, '#fbbf24', 'IAD', 'plasma wave + ion wave', 'left')}
        {band(0.88, 1.0, 208, '#a06fd6', 'OTSI', 'purely growing', 'left')}
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        The laser enters from the left and travels up the density ramp. SRS needs two waves of at least ω_pe each, so it stops at n_c/4.
        Two-plasmon decay (TPD) needs two plasma waves of about ω₀/2 that are not Landau damped, which happens only just below n_c/4.
        SBS needs only an ion wave and can happen wherever the light goes. Ion-acoustic decay (IAD) and the oscillating two-stream
        instability (OTSI) need a plasma wave of nearly the laser frequency, so they live just below n_c.
      </figcaption>
    </figure>
  )
}

export const B5: Lesson = {
  id: 'B5',
  title: 'Parametric instabilities',
  subtitle: 'How a strong wave decays into two: the pumped oscillator, matching, Manley–Rowe, thresholds and convective gain',
  minutes: 55,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 6 (parametric excitation of electron and ion waves: the coupled-oscillator model, frequency matching, decay and purely growing instabilities, damping thresholds; §6.6 threshold due to inhomogeneity)',
    'Kruer Ch. 7 (stimulated Raman scattering, with §7.4 on the 2ω_pe instability) and Ch. 8 (stimulated Brillouin scattering), for the processes catalogued here',
    'Landau & Lifshitz, Mechanics, §27 (parametric resonance): the pumped oscillator and its growth rate',
    'M. N. Rosenbluth, Parametric instabilities in inhomogeneous media, Phys. Rev. Lett. 29, 565 (1972)',
    'Michel, Introduction to Laser-Plasma Interactions (Springer 2023): the chapters on three-wave coupling',
  ],
  objectives: [
    'Explain the feedback loop of a parametric instability and derive the growth rate $\\gamma_0^2 = c_1c_2E_0^2/4\\omega_1\\omega_2$, with mismatch $\\sqrt{\\gamma_0^2 - \\Delta^2/4}$ and damping threshold $\\gamma_0^2 = \\Gamma_1\\Gamma_2$',
    'Solve the matching conditions $\\omega_0 = \\omega_1 + \\omega_2$, $\\mathbf k_0 = \\mathbf k_1 + \\mathbf k_2$ with real dispersion relations, and say where SRS, SBS, TPD, ion-acoustic decay and OTSI can occur',
    'Use the Manley–Rowe relations to split energy between daughters, and the Rosenbluth gain $G = 2\\pi\\gamma_0^2/|\\kappa\' v_1v_2|$ for growth in an inhomogeneous plasma',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'swing', label: 'Pumped swing' },
    { id: 'coupled', label: 'Coupled modes' },
    { id: 'matching', label: 'Matching' },
    { id: 'manley', label: 'Manley–Rowe' },
    { id: 'growing', label: 'Purely growing' },
    { id: 'catalogue', label: 'Catalogue' },
    { id: 'inhomogeneous', label: 'Inhomogeneity' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          A laser beam crossing a plasma is a very large, very regular wave. The plasma is full of small, random ones: thermal density
          ripples, faint scattered light. Normally they stay small. But a strong enough pump can feed one particular pair of them, and then
          they grow exponentially, taking their energy from the laser. That is a <strong>parametric instability</strong>.
        </p>
        <p>
          The mechanism is a loop. The pump scatters off a ripple, which makes a new wave. The new wave beats with the pump, and the beat
          pushes on the plasma in exactly the pattern of the ripple, which makes the ripple bigger. The bigger ripple scatters more. Neither
          daughter wave can grow alone; together, with the pump in the middle, they amplify each other.
        </p>
        <LoopDiagram />
        <p>
          Two conditions decide whether the loop closes. The beat must have the right frequency and wavelength to drive the ripple, which
          gives the <strong>matching conditions</strong> A10 introduced. And each turn of the loop must add more than the daughters lose to
          damping, which gives a <strong>threshold</strong>. This lesson builds both from the simplest possible model, a pair of pumped
          oscillators, and then applies them to the instabilities that limit every laser fusion design.
        </p>
      </section>

      <section id="swing">
        <h2>The pumped swing</h2>
        <p>
          A child on a swing can get going without anyone pushing. She stands up at the bottom of each arc and crouches at the ends: her
          centre of mass rises and falls twice per swing. Raising her weight against the extra centrifugal load at the bottom and lowering
          it at the ends where that load is smallest, she puts in a little more work than she gets back, every half cycle. The swing’s
          natural frequency is being modulated at twice itself, and the amplitude grows. Nothing pushes sideways; the energy enters through
          a <em>parameter</em> of the oscillator, which is where the name comes from.
        </p>
        <Eq
          title="Pumped oscillator (Mathieu equation)"
          src="\dfrac{d^2\s{x}{x}}{dt^2} + \s{w}{\omega}^2\left[1 + \s{h}{h}\cos(\s{wp}{\omega_p}\, t)\right]x = 0"
          symbols={{
            x: { name: 'x, displacement', note: 'The swing angle, or the amplitude of any oscillator whose spring constant is being modulated.' },
            w: { name: 'ω, natural frequency', units: 'rad/s', note: 'The frequency the oscillator rings at when left alone.' },
            h: { name: 'h, pump depth', note: 'The fractional modulation of the spring constant ω². Small: h ≪ 1.' },
            wp: { name: 'ω_p, pump frequency', units: 'rad/s', note: 'Resonance when ω_p ≈ 2ω: the stiffness must change twice per oscillation, once per half swing.' },
          }}
          says="Pump the stiffness at twice the natural frequency and any small oscillation grows as e^(γt) with γ = hω/4. Off tune by δ = ω_p − 2ω, the rate drops to √((hω/4)² − δ²/4), and the pump must beat the detuning: no growth if |δ| > hω/2."
        />
        <p>
          The swing is a parametric instability with one oscillator playing both daughters: the pump at 2ω decays into two quanta of ω.
          In a plasma the two daughters are usually different waves, and the pump can make them only if its frequency and wavevector add
          up. The next section generalizes the swing to that case.
        </p>
      </section>

      <section id="coupled">
        <h2>Two oscillators and a pump</h2>
        <p>
          Kruer’s model of every parametric instability is two oscillators, each a natural mode of the plasma, coupled only through the
          pump. Neither oscillator drives the other on its own; the pump multiplies each one’s displacement and the product drives the
          other. In SRS, x₁ is the scattered light, x₂ the density ripple, and the pump is the laser field.
        </p>
        <Eq
          title="Coupled-mode equations"
          src="\begin{gathered}\ddot x_1 + 2\s{G1}{\Gamma_1}\dot x_1 + \s{w1}{\omega_1^2}\s{x1}{x_1} \\ = \s{c1}{c_1}\,\s{E}{E}(t)\,\s{x2}{x_2} \\ \ddot x_2 + 2\s{G2}{\Gamma_2}\dot x_2 + \s{w2}{\omega_2^2}x_2 \\ = \s{c2}{c_2}\,E(t)\,x_1 \\ E(t) = 2\s{E0}{E_0}\cos \s{w0}{\omega_0}t\end{gathered}"
          symbols={{
            x1: { name: 'x₁, first daughter', note: 'For SRS, the scattered light wave; for SBS, also the scattered light.' },
            x2: { name: 'x₂, second daughter', note: 'For SRS, the electron plasma wave; for SBS, the ion acoustic wave. Usually a density fluctuation.' },
            w1: { name: 'ω₁, natural frequency of daughter 1', units: 'rad/s', note: 'Set by its dispersion relation at the wavenumber the pump selects.' },
            w2: { name: 'ω₂, natural frequency of daughter 2', units: 'rad/s', note: 'Likewise for the second wave.' },
            G1: { name: 'Γ₁, damping of daughter 1', units: 's⁻¹', note: 'Amplitude damping rate: alone, x₁ would decay as e^(−Γ₁t). For light, collisional absorption (B2) or escape from the plasma.' },
            G2: { name: 'Γ₂, damping of daughter 2', units: 's⁻¹', note: 'For plasma and ion waves, usually Landau damping (A9).' },
            c1: { name: 'c₁, coupling coefficient', note: 'How strongly the pump times x₂ drives x₁. Comes from the plasma physics (current, ponderomotive force).' },
            c2: { name: 'c₂, coupling coefficient', note: 'How strongly the pump times x₁ drives x₂. A decay instability needs c₁c₂ > 0 in this sign convention.' },
            E: { name: 'E(t), pump field', units: 'V/m', note: 'The strong wave, treated as given (no pump depletion).' },
            E0: { name: 'E₀, pump amplitude', units: 'V/m', note: 'Written with the factor 2 so that E = E₀e^(−iω₀t) + c.c.: each sideband of the product E·x is driven by E₀.' },
            w0: { name: 'ω₀, pump frequency', units: 'rad/s', note: 'The laser frequency for SRS and SBS.' },
          }}
          says="Each daughter is a damped oscillator driven by the product of the pump and the other daughter. A product of two oscillations contains the sum and difference frequencies, so x₂ at ω₂ times the pump at ω₀ drives x₁ at ω₀ − ω₂. If that equals ω₁, the drive is resonant."
        />
        <Derivation
          lessonId="B5"
          id="coupled-growth"
          title="Growth rate of two pumped oscillators"
          steps={[
            {
              text: 'Look for solutions in which x₁ oscillates as e^(−iωt), with ω complex, and write the pump as E₀(e^(−iω₀t) + e^(iω₀t)). The product E·x₂ contains x₂’s components at ω − ω₀ and ω + ω₀. Leave out damping for now.',
              math: '\\begin{gathered}(\\omega_1^2 - \\omega^2)\\,\\hat x_1(\\omega) \\\\ = c_1E_0\\big[\\hat x_2(\\omega - \\omega_0) \\\\ +\\, \\hat x_2(\\omega + \\omega_0)\\big]\\end{gathered}',
              why: 'd²/dt² → −ω² for each Fourier component. The pump shifts frequencies up and down by ω₀, like the sidebands of an AM radio signal.',
            },
            {
              text: 'Daughter 2 is driven at ω − ω₀ by the pump times x₁. Keep only this sideband: it is the one near a natural frequency of x₂ when ω ≈ ω₁ and ω₀ ≈ ω₁ + ω₂.',
              math: '\\begin{gathered}\\big[\\omega_2^2 - (\\omega - \\omega_0)^2\\big]\\,\\hat x_2(\\omega - \\omega_0) \\\\ = c_2E_0\\,\\hat x_1(\\omega)\\end{gathered}',
              why: 'The other sideband, x₂ at ω + ω₀ ≈ 2ω₁ + ω₂, is far from ±ω₂ and responds only weakly. It adds a small frequency shift of relative order γ₀/ω, which the simulation includes and the theory leaves out.',
            },
            {
              text: 'Eliminate x₂. The amplitudes cancel, leaving a dispersion relation for ω.',
              math: '\\begin{gathered}(\\omega^2 - \\omega_1^2)\\big[(\\omega - \\omega_0)^2 - \\omega_2^2\\big] \\\\ = c_1c_2E_0^2\\end{gathered}',
              why: 'With no pump the roots are the free oscillations ω = ±ω₁ and ω = ω₀ ± ω₂. The pump couples them, and it matters most where two of them coincide: ω₁ = ω₀ − ω₂.',
            },
            {
              text: 'Expand near the resonance. Put ω = ω₁ + δ and ω₀ = ω₁ + ω₂ + Δ, so that ω − ω₀ = −ω₂ + δ − Δ, with δ and Δ small compared with ω₁ and ω₂.',
              math: '\\begin{gathered}\\omega^2 - \\omega_1^2 \\approx 2\\omega_1\\delta \\\\ (\\omega - \\omega_0)^2 - \\omega_2^2 \\\\ \\approx -2\\omega_2(\\delta - \\Delta)\\end{gathered}',
              why: 'a² − b² = (a − b)(a + b) and a + b ≈ 2b when a ≈ b. The second factor is negative because ω − ω₀ sits near −ω₂: daughter 2 oscillates at the difference frequency, with the opposite sign of phase.',
            },
            {
              text: 'Substitute. The dispersion relation becomes a quadratic for δ.',
              math: '\\begin{gathered}\\delta\\,(\\delta - \\Delta) = -\\gamma_0^2 \\\\ \\gamma_0^2 = \\dfrac{c_1c_2E_0^2}{4\\omega_1\\omega_2}\\end{gathered}',
              why: 'γ₀ grows linearly with the pump amplitude, so the growth rate scales as √I. And it is larger for low-frequency daughters: the 1/ω₂ is why slow ion waves are so easy to drive.',
            },
            {
              text: 'Solve. When the roots are complex, one of them grows.',
              math: '\\delta = \\dfrac{\\Delta}{2} \\pm i\\sqrt{\\gamma_0^2 - \\dfrac{\\Delta^2}{4}}',
              why: 'At perfect matching both daughters grow at γ₀. A mismatch Δ slows the growth and stops it when |Δ| > 2γ₀; the real part Δ/2 means the daughters share the mismatch and both oscillate a little off their natural frequencies. If c₁c₂ < 0 the roots are real and nothing grows.',
            },
            {
              text: 'Restore damping: ω_j² − ω² becomes ω_j² − ω² − 2iΓ_jω, which shifts δ → δ + iΓ₁ in the first factor and δ − Δ → δ − Δ + iΓ₂ in the second. At Δ = 0, put δ = iγ.',
              math: '\\begin{gathered}(\\gamma + \\Gamma_1)(\\gamma + \\Gamma_2) = \\gamma_0^2 \\\\ \\Rightarrow\\ \\text{threshold: } \\gamma_0^2 = \\Gamma_1\\Gamma_2\\end{gathered}',
              why: 'The geometric mean of the two damping rates sets the threshold. One heavily damped wave (a Landau-damped plasma wave) can still be driven if its partner (the scattered light) is lightly damped. With Γ₁ = Γ₂ = Γ, the growth is simply γ₀ − Γ.',
            },
          ]}
        />
        <PumpedOscillatorsSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The benchmark.</strong> In the decay preset at Δ = 0, the measured growth matches γ₀ to within about 1%. The small
            difference comes from the non-resonant sideband left out in step 2 and from fitting a finite stretch of the curve.
          </li>
          <li>
            <strong>Detuning.</strong> Set Δ = γ₀ (about 0.02): the theory gives √(γ₀² − γ₀²/4) = 0.87γ₀. Push |Δ| beyond 2γ₀ and the
            log plot turns into a bounded, slowly beating wiggle.
          </li>
          <li>
            <strong>Threshold.</strong> Add damping Γ and lower the pump until γ₀ &lt; Γ: the amplitude decays, however long you wait.
          </li>
          <li>
            <strong>The swing.</strong> One oscillator pumped at 2ω grows at hω/4 with h = 2c₁E₀/ω². The pendulum’s string is shortened
            and lengthened twice per swing.
          </li>
        </ul>
        <Eq
          title="Growth rate with mismatch and damping"
          src="\begin{gathered}\s{g}{\gamma} = \sqrt{\s{g0}{\gamma_0^2} - \dfrac{\s{D}{\Delta}^2}{4}} - \s{G}{\Gamma} \\ \gamma_0^2 = \dfrac{\s{c}{c_1c_2}\,\s{E0}{E_0^2}}{4\,\s{w}{\omega_1\omega_2}}\end{gathered}"
          plot="b5-growth-mismatch"
          symbols={{
            g: { name: 'γ, growth rate', units: 's⁻¹', note: 'Both daughters grow as e^(γt) once the fastest mode dominates. Negative means the pump is below threshold.' },
            g0: { name: 'γ₀, undamped, matched growth rate', units: 's⁻¹', note: 'The figure of merit of an instability. Proportional to the pump amplitude, so to √I.' },
            D: { name: 'Δ = ω₀ − ω₁ − ω₂, frequency mismatch', units: 's⁻¹', note: 'In a uniform plasma the daughters can always choose their k to make Δ = 0; mismatch matters when the plasma varies in space (below) or the pump has a spread of frequencies.' },
            G: { name: 'Γ, damping rate (equal for both daughters)', units: 's⁻¹', note: 'For unequal rates use (δ + iΓ₁)(δ − Δ + iΓ₂) = −γ₀²; the threshold at Δ = 0 is γ₀² = Γ₁Γ₂.' },
            c: { name: 'c₁c₂, product of the couplings', note: 'Positive for a decay instability.' },
            E0: { name: 'E₀, pump amplitude', units: 'V/m', note: 'Laser intensity I ∝ E₀², so γ₀ ∝ √I.' },
            w: { name: 'ω₁ω₂, product of the daughter frequencies', units: 's⁻²', note: 'Low-frequency daughters respond more strongly to the same force.' },
          }}
          says="Growth needs the pump to beat both the mismatch and the damping: γ₀ > |Δ|/2 with no damping, γ₀ > Γ with no mismatch. Raising the laser intensity raises γ₀ as √I, so every parametric instability has a threshold intensity."
        />
        <Plotter spec={plotById('b5-growth-mismatch')!} />
      </section>

      <section id="matching">
        <h2>Matching conditions</h2>
        <p>
          The oscillator model hides where ω₁ and ω₂ come from. In a plasma, each daughter is a wave with its own dispersion relation,
          and the pump selects the wavevector. The beat of the pump with daughter 1 has wavevector k₀ − k₁ and frequency ω₀ − ω₁; it
          can drive daughter 2 resonantly only if that pair lies on daughter 2’s dispersion curve. Hence the two matching conditions,
          ω₀ = ω₁ + ω₂ and k₀ = k₁ + k₂, which A10 read as conservation of energy and momentum when one laser photon decays into two
          quanta. Three dispersion relations cover all the waves in this lesson.
        </p>
        <Eq
          title="The three waves of an unmagnetized plasma"
          src="\begin{gathered}\text{light: } \s{w}{\omega}^2 = \s{wp}{\omega_{pe}^2} + \s{c}{c}^2\s{k}{k}^2 \\ \text{plasma: } \omega^2 = \omega_{pe}^2 + 3k^2\s{vte}{v_{te}^2} \\ \text{ion wave: } \omega = k\,\s{cs}{c_s}\end{gathered}"
          plot="b5-srs-wavelength"
          symbols={{
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'Light and plasma waves never go below ω_pe; ion waves are far slower, ω ≈ 10⁻³ ω₀ in a laser plasma.' },
            wp: { name: 'ω_pe, electron plasma frequency', units: 'rad/s', note: 'ω_pe² = ω₀² n/n_c, with n_c ≈ 1.1×10²¹/λ_µm² cm⁻³ (B1).' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'Light in a plasma has group velocity c²k/ω < c.' },
            k: { name: 'k, wavenumber', units: 'm⁻¹', note: 'Magnitude of the wavevector. The matching conditions fix it for each daughter.' },
            vte: { name: 'v_te, electron thermal speed', units: 'm/s', note: '√(kT_e/m_e), the convention of A5 (Bohm–Gross). Kruer uses the same v_e.' },
            cs: { name: 'c_s, ion sound speed', units: 'm/s', note: '√((ZkT_e + 3kT_i)/M). About 3.9×10⁵ m/s in CH at T_e = 2 keV, T_i = 1 keV, about a thousandth of c. The simulation ignores the Debye correction 1/(1 + k²λ_De²), which lowers it by a few % at kλ_De ≈ 0.3.' },
          }}
          says="Each daughter must sit on one of these curves. For SRS, the scattered light needs ω ≥ ω_pe and so does the plasma wave, so ω₀ ≥ 2ω_pe: SRS exists only below n_c/4. For SBS, the ion wave takes almost no energy, so the scattered light has almost the laser frequency."
        />
        <p>
          The standard graphical way to solve them, used in the simulation’s right panel, is to hang daughter 2’s dispersion curve
          upside down from the pump point (k₀, ω₀): the curve ω₀ − ω₂(k₀ − k). Wherever it crosses daughter 1’s curve, both daughters are
          real waves and their sum is the pump. The left panel shows the same solution as a triangle of wavevectors.
        </p>
        <MatchingTriangleSim />
        <p>
          The benchmark: SRS backscatter of 351 nm light at 0.1 n_c and T_e = 2 keV gives a plasma wave with k = 1.59 k₀ and ω = 0.356 ω₀,
          and scattered light at 545 nm, in the green, where a spectrometer would see it. The cold estimate λ₀/(1 − √(n/n_c)) gives 513 nm;
          the 32 nm difference is the Bohm–Gross term, which is a direct thermometer of the plasma. This plasma wave also has kλ_De = 0.30,
          right where Landau damping (A9) begins to matter. The plot shows the whole SRS spectrum: backscatter from low density is only
          slightly red-shifted, from near n_c/4 it approaches 2λ₀.
        </p>
        <Plotter spec={plotById('b5-srs-wavelength')!} />
        <p>
          Two directions are special. <strong>Backscatter</strong> (θ = 180°) makes the largest k₂, and since coupling grows with k (the
          ponderomotive force is a gradient), it usually grows fastest. <strong>Forward scatter</strong> (θ = 0°) makes a plasma wave with
          k ≈ ω_pe/c and phase velocity close to c, which is the seed of laser wakefield acceleration in Track C. Everything in between is
          sidescatter.
        </p>
      </section>

      <section id="manley">
        <h2>Manley–Rowe relations</h2>
        <p>
          If a laser photon really splits into two quanta, the bookkeeping is fixed: for every pump quantum destroyed, one quantum of each
          daughter is created. The number of quanta in a wave of energy W and frequency ω is W/ħω (the wave action), so the three actions
          change in lockstep. These are the Manley–Rowe relations, first found for nonlinear electrical circuits in the 1950s; they follow
          from the coupled-mode equations without any quantum mechanics.
        </p>
        <Eq
          title="Manley–Rowe relations"
          src="\dfrac{d}{dt}\dfrac{\s{W1}{W_1}}{\s{w1}{\omega_1}} = \dfrac{d}{dt}\dfrac{\s{W2}{W_2}}{\s{w2}{\omega_2}} = -\dfrac{d}{dt}\dfrac{\s{W0}{W_0}}{\s{w0}{\omega_0}}"
          symbols={{
            W0: { name: 'W₀, pump wave energy', units: 'J/m³', note: 'Energy density of the laser in the interaction region.' },
            W1: { name: 'W₁, energy of daughter 1', units: 'J/m³', note: 'For SRS and SBS, the scattered light.' },
            W2: { name: 'W₂, energy of daughter 2', units: 'J/m³', note: 'The plasma or ion wave. Once damped, this energy heats the plasma.' },
            w0: { name: 'ω₀, pump frequency', units: 'rad/s', note: 'W/ω is the action density, proportional to the number of quanta.' },
            w1: { name: 'ω₁, frequency of daughter 1', units: 'rad/s', note: 'Gets the share ω₁/ω₀ of the pump energy lost.' },
            w2: { name: 'ω₂, frequency of daughter 2', units: 'rad/s', note: 'Gets ω₂/ω₀. Small for an ion wave.' },
          }}
          says="Of each joule the pump loses, ω₁/ω₀ goes to daughter 1 and ω₂/ω₀ to daughter 2. SRS at 0.1 n_c sends 64% to scattered light and 36% to the plasma wave; SBS sends 99.8% to the scattered light; two-plasmon decay splits it about evenly. The reflectivity of a scattering instability can never exceed ω₁/ω₀, even with total pump depletion."
        />
        <p>
          The energy given to the plasma wave in SRS is not lost from the target: Landau damping hands it to a few fast electrons. That is
          why SRS is a source of the hot electrons of B8, and why measuring the Raman light also tells you how much energy went into them.
        </p>
      </section>

      <section id="growing">
        <h2>Decay or purely growing</h2>
        <p>
          Everything so far was a <strong>decay instability</strong>: both daughters oscillate at their own frequencies and grow. There is a
          second kind. Suppose daughter 2 has almost no natural frequency (ω₂ ≈ 0: a density perturbation that does not propagate on the time
          scale of growth) and the pump frequency sits just <em>below</em> ω₁. Then daughter 2 couples to both sidebands of x₁, at ω₀ − ω and
          ω₀ + ω, and a mode appears that grows without oscillating at all.
        </p>
        <p>
          The physics is a self-reinforcing hole. Where the density dips, ω_pe drops slightly, moving the plasma’s natural frequency closer
          to the pump frequency (which is below it). The electrons there respond more strongly, the oscillating field is larger, and the
          ponderomotive force of that larger field pushes plasma out of the dip, deepening it. This is the <strong>oscillating two-stream
          instability</strong> (OTSI), named because the electrons and ions oscillate against each other like two streams. In the simulation’s
          purely growing preset, x₂ grows monotonically, and the measured rate matches the root of the two-sideband dispersion relation.
          Moving the pump above ω₁ kills it. A pump just above ω₁ + ω₂ gives the decay instability instead: for an electron plasma wave and
          an ion wave, that is ion-acoustic decay.
        </p>
      </section>

      <section id="catalogue">
        <h2>The laser–plasma catalogue</h2>
        <p>
          With three wave types, the matching conditions allow only a handful of decays of a light wave, and each one is confined to a range
          of density.
        </p>
        <div className="grid three">
          <div className="card">
            <span className="pill ghost">SRS</span>
            <p style={{ marginTop: 10 }}>
              Stimulated Raman scattering: light → light + electron plasma wave. Below n_c/4. Reflects light at typically 1.3–2λ₀ and makes hot
              electrons. B6.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">SBS</span>
            <p style={{ marginTop: 10 }}>
              Stimulated Brillouin scattering: light → light + ion acoustic wave. Anywhere below n_c. Can reflect a large fraction of the
              laser almost unshifted. B6.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">TPD</span>
            <p style={{ marginTop: 10 }}>
              Two-plasmon decay: light → two electron plasma waves, just below n_c/4. Kruer calls it the 2ω_pe instability. A strong hot-electron source. B7.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">IAD</span>
            <p style={{ marginTop: 10 }}>
              Ion-acoustic decay: light → electron plasma wave + ion acoustic wave, just below n_c, where ω_pe ≈ ω₀.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">OTSI</span>
            <p style={{ marginTop: 10 }}>
              Oscillating two-stream: a purely growing density hole plus plasma waves on both sidebands, with ω₀ just below the plasma wave frequency, near n_c.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">Filamentation</span>
            <p style={{ marginTop: 10 }}>
              Not a decay but the same loop in space: a bright stripe pushes plasma out, the lower density focuses the light further. B7.
            </p>
          </div>
        </div>
        <DensityMap />
        <p>
          Try each process in the triangle builder. TPD finds solutions only below about n_c/4, and its plasma waves have kλ_De ≪ 0.3 only
          just below that density. Ion-acoustic decay at 0.9 n_c needs a plasma wave with k several times k₀, travelling against an ion wave
          of almost the same |k|.
        </p>
      </section>

      <section id="inhomogeneous">
        <h2>Growth in an inhomogeneous plasma</h2>
        <p>
          A real laser plasma is a density ramp. The frequencies of all three waves are fixed by the laser and by the daughters’ time
          dependence, but their wavenumbers change with position as n(x) changes. So the wavenumbers can match at only one place, x = 0
          say, and the mismatch grows linearly away from it: κ(x) = k₀ − k₁ − k₂ ≈ κ′x. The daughters stay in step only within a finite
          region around the matching point. They grow while they cross it, then leave. The instability is <strong>convective</strong>: it
          amplifies a signal passing through, by a finite factor, rather than growing forever in place.
        </p>
        <Derivation
          lessonId="B5"
          id="rosenbluth"
          title="The Rosenbluth gain, from a strongly damped daughter"
          steps={[
            {
              text: 'Describe the daughters by slowly varying amplitudes a₁ (moving at group velocity v₁) and a₂ (velocity v₂, damping Γ₂), in a steady state, with the mismatch as a phase ψ(x) = ∫κ dx in the coupling.',
              math: '\\begin{gathered}v_1\\dfrac{da_1}{dx} = \\gamma_0\\,a_2^*\\,e^{i\\psi} \\\\ v_2\\dfrac{da_2}{dx} + \\Gamma_2a_2 = \\gamma_0\\,a_1^*\\,e^{i\\psi}\\end{gathered}',
              why: 'These are the coupled-mode equations of the previous section, rewritten for waves that move. Both carry the same phase, because each daughter is driven by the pump times the other’s conjugate, with wavenumber k₀ − k₂ or k₀ − k₁; the mismatch with its own k is κ either way. With the pump amplitude scaled into γ₀, a uniform plasma (ψ = 0) and no transport, they give growth at γ₀ in time.',
            },
            {
              text: 'Let daughter 2 be strongly damped, so that it follows its drive locally. Writing a₂ = A₂e^(iψ), the v₂ d/dx acting on the phase turns the spatial mismatch into a frequency mismatch κv₂.',
              math: 'A_2 = \\dfrac{\\gamma_0\\,a_1^*}{\\Gamma_2 + i\\kappa(x)\\,v_2}',
              why: 'A strongly damped wave forgets its past within a distance |v₂|/Γ₂. It is like a damped oscillator driven slightly off resonance: the off-resonance is κv₂.',
            },
            {
              text: 'Substitute into the equation for a₁: a₂*e^(iψ) = A₂*, so the phase drops out and daughter 1 grows in space at a local rate that depends on the mismatch.',
              math: '\\dfrac{d\\ln|a_1|^2}{dx} = \\dfrac{2\\gamma_0^2}{|v_1|}\\,\\dfrac{\\Gamma_2}{\\Gamma_2^2 + \\kappa^2v_2^2}',
              why: 'At κ = 0 this is the spatial gain rate of a uniform plasma with a damped daughter, 2γ₀²/(Γ₂|v₁|); B6’s envelope simulation measures exactly that. Away from matching it falls off as a Lorentzian.',
            },
            {
              text: 'Add up the gain through the whole resonance, with κ = κ′x.',
              math: '\\int_{-\\infty}^{\\infty}\\dfrac{\\Gamma_2\\,dx}{\\Gamma_2^2 + \\kappa\'^2v_2^2x^2} = \\dfrac{\\pi}{|\\kappa\'v_2|}',
              why: '∫ a dx/(a² + b²x²) = π/b. The width of the gain region is Γ₂/|κ′v₂|: the distance over which the mismatch frequency κv₂ grows to the damping rate.',
            },
            {
              text: 'The total intensity gain exponent is the Rosenbluth gain. The damping has cancelled.',
              math: 'G = \\ln\\dfrac{I_{\\text{out}}}{I_{\\text{in}}} = \\dfrac{2\\pi\\gamma_0^2}{|\\kappa\'\\,v_1v_2|}',
              why: 'Stronger damping lowers the peak gain rate and widens the region, by the same factor. Rosenbluth’s full solution (1972), with no assumption about the damping, gives the same G; the tests check it against a direct integration. Equivalently the amplitude grows by e^(πγ₀²/|κ′v₁v₂|).',
            },
          ]}
        />
        <Eq
          title="Rosenbluth gain"
          src="\begin{gathered}\s{G}{G} = \dfrac{2\pi\,\s{g0}{\gamma_0^2}}{|\s{kp}{\kappa'}\,\s{v1}{v_1}\,\s{v2}{v_2}|} \\ \kappa(x) = \s{k0}{k_0} - k_1 - k_2 \approx \kappa' x\end{gathered}"
          symbols={{
            G: { name: 'G, gain exponent', note: 'The intensity of daughter 1 is amplified by e^G as it crosses the matching region. A noise level of thermal fluctuations needs G of order 10 or more to reach a significant reflectivity.' },
            g0: { name: 'γ₀, homogeneous growth rate', units: 's⁻¹', note: 'Evaluated at the matching point. G ∝ γ₀² ∝ laser intensity.' },
            kp: { name: 'κ′, gradient of the wavenumber mismatch', units: 'm⁻²', note: 'From each wave’s dispersion relation at fixed frequency: for SRS in a density gradient it is dominated by the plasma wave, κ′ ≈ (ω_pe²/L)/(6kv_te²) for scale length L. Steeper gradients give smaller gain.' },
            v1: { name: 'v₁, group velocity of daughter 1', units: 'm/s', note: 'Signed components along the gradient; only the product’s magnitude enters.' },
            v2: { name: 'v₂, group velocity of daughter 2', units: 'm/s', note: 'Slow daughters (plasma waves, ion waves) linger in the gain region and gain more.' },
            k0: { name: 'k₀ − k₁ − k₂, local mismatch', units: 'm⁻¹', note: 'Components along the density gradient, each at its own fixed frequency. Zero at the matching point.' },
          }}
          says="The gain is set by how fast the plasma detunes the waves (κ′), not by how strongly the daughters are damped. Gentle gradients, long plasmas and slow daughters make large gains. Where κ′ → 0 or a group velocity → 0, the formula promises unlimited gain: the convective picture fails there, and the instability can become absolute, as SRS does near n_c/4 (B6)."
        />
        <p>
          Kruer’s §6.6 gives the same picture as a threshold: in a gradient, the pump must make γ₀²/|κ′v₁v₂| of order one before
          inhomogeneity stops limiting growth. B6 evaluates G for SRS in a density gradient and for SBS in a flow gradient, the two numbers
          that design work actually tracks.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          You now have the toolkit: the feedback loop, matching, γ₀, the damping threshold, Manley–Rowe and the Rosenbluth gain. B6 puts in
          the plasma physics for the two scattering instabilities, stimulated Raman and Brillouin scattering: their growth rates in SI and
          practical units, how Landau damping limits them, how much light they reflect, and why they matter for laser fusion. B7 does the same
          for two-plasmon decay and filamentation, and B8 follows the hot electrons that the damped plasma waves leave behind.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B5-p1',
      kind: 'numeric',
      concept: 'parametric-resonance',
      prompt: 'A swing has a natural period of 3 s. A child modulates its stiffness by $h = 0.1$ at exactly twice its natural frequency. How long does the amplitude take to grow by a factor $e$, in seconds?',
      answer: 19.1,
      tol: 0.03,
      unit: 's',
      hints: ['$\\omega = 2\\pi/T$ and the growth rate is $\\gamma = h\\omega/4$.'],
      solution: '$\\omega = 2\\pi/3 = 2.094$ rad/s, so $\\gamma = 0.1\\times2.094/4 = 0.0524$ s⁻¹ and the e-folding time is $1/\\gamma = 19.1$ s, about six swings. The same physics with ω in the 10¹⁵ s⁻¹ range and h set by the laser makes plasma waves grow in picoseconds.',
    },
    {
      id: 'B5-p2',
      kind: 'numeric',
      concept: 'parametric-threshold',
      prompt: 'At $10^{15}$ W/cm², a decay instability has undamped growth rate $\\gamma_0 = 2.0\\times10^{12}$ s⁻¹. Its plasma wave is damped at $\\Gamma_2 = 4.0\\times10^{12}$ s⁻¹ and its scattered light at $\\Gamma_1 = 2.5\\times10^{11}$ s⁻¹ (amplitude rates). Above what intensity does it grow? Give the answer in units of $10^{14}$ W/cm².',
      answer: 2.5,
      tol: 0.03,
      unit: '×10¹⁴ W/cm²',
      hints: ['Threshold: $\\gamma_0^2 = \\Gamma_1\\Gamma_2$.', '$\\gamma_0 \\propto E_0 \\propto \\sqrt I$, so $\\gamma_0^2 \\propto I$.'],
      solution: '$\\Gamma_1\\Gamma_2 = 10^{24}$ s⁻², while $\\gamma_0^2 = 4\\times10^{24}$ s⁻² at $10^{15}$ W/cm². Since $\\gamma_0^2 \\propto I$, the threshold is $I = 10^{15}\\times(1/4) = 2.5\\times10^{14}$ W/cm². Note that the plasma wave alone is damped faster than the instability would grow ($\\Gamma_2 > \\gamma_0$); it is the lightly damped scattered light that lets the pair grow.',
    },
    {
      id: 'B5-p3',
      kind: 'numeric',
      concept: 'srs-matching',
      prompt: 'A 351 nm laser drives SRS backscatter at $n = 0.15\\,n_c$ in a plasma with $T_e = 1$ keV. Including the thermal (Bohm–Gross) correction to the plasma-wave frequency, at what wavelength does the scattered light come out, in nm?',
      answer: 586.4,
      tol: 0.02,
      unit: 'nm',
      hints: [
        'Start cold: $\\omega_{ek} \\approx \\omega_{pe} = 0.387\\,\\omega_0$, so $\\omega_s = 0.613\\,\\omega_0$ and $ck_s = \\sqrt{\\omega_s^2 - \\omega_{pe}^2} = 0.475\\,\\omega_0$.',
        'Then $k = k_0 + k_s$ with $ck_0 = \\sqrt{0.85}\\,\\omega_0$, and $\\omega_{ek}^2 = \\omega_{pe}^2 + 3k^2v_{te}^2$ with $v_{te}^2/c^2 = 1/511$. One correction is enough.',
      ],
      solution: 'In units of $\\omega_0$ and $\\omega_0/c$: $k = 0.922 + 0.475 = 1.397$, so $3k^2v_{te}^2/c^2 = 3\\times1.951/511 = 0.0115$ and $\\omega_{ek} = \\sqrt{0.15 + 0.0115} = 0.402$. Then $\\omega_s = 0.598$ and $\\lambda_s = 351/0.598 = 587$ nm; iterating to convergence gives 586.4 nm. The cold estimate $351/(1 - \\sqrt{0.15}) = 573$ nm is 2% short; the shift measures $T_e$.',
    },
    {
      id: 'B5-p4',
      kind: 'numeric',
      concept: 'manley-rowe',
      prompt: 'SRS backscatter at $0.1\\,n_c$ in a 2 keV plasma has $\\omega_s = 0.644\\,\\omega_0$ and $\\omega_{ek} = 0.356\\,\\omega_0$. A detector measures that 8% of the laser energy comes back as Raman light. What percentage of the laser energy went into plasma waves?',
      answer: 4.42,
      tol: 0.03,
      unit: '%',
      hints: ['Each pump photon lost makes one scattered photon and one plasmon.', 'Energy in plasma waves / energy in scattered light $= \\omega_{ek}/\\omega_s$.'],
      solution: 'The number of plasmons equals the number of scattered photons, so the energies are in the ratio $0.356/0.644 = 0.553$. The plasma waves got $8\\%\\times0.553 = 4.4\\%$ of the laser energy, and the pump lost 12.4% in all. Damped plasma waves give their energy to fast electrons (B8).',
    },
    {
      id: 'B5-p5',
      kind: 'numeric',
      concept: 'rosenbluth-gain',
      prompt: 'In normalized units ($\\omega_0 = c = 1$), a backscatter instability in a density gradient has $\\gamma_0 = 0.003$, $\\kappa\' = 2\\times10^{-4}$, and daughter group velocities $v_1 = -0.8$ and $v_2 = 0.05$. What is the Rosenbluth gain exponent $G$?',
      answer: 7.07,
      tol: 0.03,
      unit: '',
      hints: ['$G = 2\\pi\\gamma_0^2/|\\kappa\' v_1 v_2|$.'],
      solution: '$G = 2\\pi\\times9\\times10^{-6}/(2\\times10^{-4}\\times0.8\\times0.05) = 5.65\\times10^{-5}/8\\times10^{-6} = 7.07$. The scattered intensity is amplified by $e^{7.07} \\approx 1200$, which turns thermal noise into a small but measurable signal. Halving the scale length doubles κ′ and takes the gain to 3.5.',
    },
    {
      id: 'B5-p6',
      kind: 'mcq',
      concept: 'instability-densities',
      prompt: 'Which of these three-wave decays of the laser can occur at $n = 0.5\\,n_c$?',
      options: ['SRS and SBS', 'SBS only', 'Two-plasmon decay and SBS', 'All three: SRS, SBS and two-plasmon decay'],
      correct: 1,
      hints: ['What is the lowest frequency a light wave or a plasma wave can have? Compare twice that with $\\omega_0$ at $0.5\\,n_c$.'],
      solution: 'At $0.5\\,n_c$, $\\omega_{pe} = 0.71\\,\\omega_0$. SRS needs two waves of at least $\\omega_{pe}$ each (scattered light and plasma wave), which would add up to more than $\\omega_0$; TPD needs two plasma waves, the same problem. Only SBS, whose ion wave costs almost no frequency, can match. SRS and TPD both need $n \\le n_c/4$; SBS works up to $n_c$.',
    },
  ],
  cards: [
    { id: 'B5-c1', front: 'The feedback loop of a parametric instability (SRS)', back: 'The pump scatters off a density ripple and makes a scattered wave; the scattered wave beats with the pump, and the ponderomotive force of the beat deepens the ripple' },
    { id: 'B5-c2', front: 'Pumped oscillator (Mathieu): resonance and growth', back: '$x\'\' + \\omega^2[1 + h\\cos\\omega_pt]x = 0$ grows when $\\omega_p \\approx 2\\omega$, at $\\gamma = h\\omega/4$; no growth if $|\\omega_p - 2\\omega| > h\\omega/2$' },
    { id: 'B5-c3', front: 'Coupled-mode growth rate, mismatch and threshold', back: '$\\gamma_0^2 = c_1c_2E_0^2/4\\omega_1\\omega_2$; undamped with mismatch $\\gamma = \\sqrt{\\gamma_0^2 - \\Delta^2/4}$; threshold $\\gamma_0^2 = \\Gamma_1\\Gamma_2$ (amplitude damping rates)' },
    { id: 'B5-c4', front: 'Manley–Rowe relations', back: 'One quantum of each daughter per pump quantum: $\\dot W_1/\\omega_1 = \\dot W_2/\\omega_2 = -\\dot W_0/\\omega_0$. Daughter $j$ gets the fraction $\\omega_j/\\omega_0$ of the energy' },
    { id: 'B5-c5', front: 'Where do SRS, TPD, SBS, ion-acoustic decay and OTSI occur?', back: 'SRS: $n \\le n_c/4$. TPD: just below $n_c/4$. SBS: anywhere $n < n_c$. Ion-acoustic decay and OTSI: just below $n_c$' },
    { id: 'B5-c6', front: 'Rosenbluth gain in an inhomogeneous plasma', back: '$G = \\ln(I_{out}/I_{in}) = 2\\pi\\gamma_0^2/|\\kappa\'v_1v_2|$, $\\kappa = k_0 - k_1 - k_2 \\approx \\kappa\'x$; independent of the daughters’ damping' },
  ],
}
