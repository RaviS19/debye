import { Eq } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { BeamBreakupSim } from '../sims/BeamBreakupSim'
import { TpdMapSim } from '../sims/TpdMapSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 22 }

function arrow(x1: number, y1: number, x2: number, y2: number, color: string, w = 4) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const hx = x2 - 16 * Math.cos(a)
  const hy = y2 - 16 * Math.sin(a)
  const px = 8 * Math.sin(a)
  const py = -8 * Math.cos(a)
  return (
    <g>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <path d={`M${x2},${y2} L${hx + px},${hy + py} L${hx - px},${hy - py} Z`} fill={color} />
    </g>
  )
}

/** Left: TPD as a decay triangle in k-space. Right: the filamentation feedback loop. */
function TwoInstabilities() {
  const loop = [
    { x: 515, y: 70, t: ['a bright stripe'] },
    { x: 610, y: 165, t: ['pushes plasma', 'out (B4)'] },
    { x: 515, y: 262, t: ['lower density:', 'higher index'] },
    { x: 418, y: 165, t: ['light bends', 'in: brighter'] },
  ]
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 690 330" style={{ width: '100%', maxWidth: 640, display: 'block', margin: '0 auto' }} role="img" aria-label="Left: a laser photon decays into two plasmons whose wavevectors add up to the laser's. Right: the feedback loop of filamentation, in which a bright region pushes plasma out, raising the refractive index, which focuses more light into it">
        <text x={20} y={30} fill="#e8eaf6" style={{ ...svgText, fontWeight: 700 }}>Two-plasmon decay</text>
        {arrow(40, 230, 260, 230, '#fbbf24')}
        {arrow(40, 230, 190, 95, '#22d3ee')}
        {arrow(190, 95, 260, 230, '#f472b6')}
        <text x={120} y={262} fill="#fbbf24" style={svgText}>k₀: laser, ω₀</text>
        <text x={36} y={150} fill="#22d3ee" style={svgText}>k₁</text>
        <text x={36} y={176} fill="#22d3ee" style={svgText}>≈ ω₀/2</text>
        <text x={236} y={150} fill="#f472b6" style={svgText}>k₂</text>
        <text x={236} y={176} fill="#f472b6" style={svgText}>≈ ω₀/2</text>
        <text x={20} y={300} fill="#9aa0c9" style={svgText}>one photon → two plasmons,</text>
        <text x={20} y={324} fill="#9aa0c9" style={svgText}>only near n = n_c/4</text>
        <line x1={335} y1={20} x2={335} y2={320} stroke="#2a3566" strokeWidth={2} />
        <text x={370} y={30} fill="#e8eaf6" style={{ ...svgText, fontWeight: 700 }}>Filamentation</text>
        <circle cx={515} cy={168} r={74} fill="none" stroke="#2a3566" strokeWidth={2} strokeDasharray="6 6" />
        {arrow(560, 108, 590, 132, '#22d3ee', 3)}
        {arrow(590, 205, 560, 229, '#22d3ee', 3)}
        {arrow(470, 229, 440, 205, '#22d3ee', 3)}
        {arrow(440, 132, 470, 108, '#22d3ee', 3)}
        {loop.map((b, i) => (
          <text key={i} x={b.x} y={b.y - (b.t.length - 1) * 12} fill={i === 0 ? '#fbbf24' : '#e8eaf6'} textAnchor="middle" style={svgText}>
            {b.t.map((line, j) => (
              <tspan key={j} x={b.x} dy={j ? 24 : 0}>
                {line}
              </tspan>
            ))}
          </text>
        ))}
        <text x={370} y={324} fill="#9aa0c9" style={svgText}>the beam makes its own lens</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        Two ways a laser goes wrong in the corona. Left: near quarter-critical density one laser photon can split into two electron plasma waves,
        each carrying about half its frequency, with wavevectors that close the triangle k₀ = k₁ + k₂. Right: a beam that is slightly brighter in
        one place pushes plasma out of it; the lower density has a higher refractive index, which bends more light in. The loop runs away.
      </figcaption>
    </figure>
  )
}

export const B7: Lesson = {
  id: 'B7',
  title: 'TPD & filamentation',
  subtitle: 'Two-plasmon decay at quarter-critical density, and the beam that focuses itself: filamentation and self-focusing',
  minutes: 55,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 7 (§7.4 the 2ω_pe instability) and Ch. 8 (§8.4 the filamentation instability); Ch. 11 (nonlinear features of underdense plasma instabilities)',
    'A. Simon, R. W. Short, E. A. Williams and T. Dewandre, Phys. Fluids 26, 3107 (1983): the absolute two-plasmon-decay threshold in a linear density profile',
    'R. Y. Chiao, E. Garmire and C. H. Townes, Phys. Rev. Lett. 13, 479 (1964): self-trapping of optical beams and the critical power',
    'Y. Kato et al., Phys. Rev. Lett. 53, 1057 (1984): random phase plates; S. Skupsky et al., J. Appl. Phys. 66, 3456 (1989): smoothing by spectral dispersion',
    'Michel, Introduction to Laser-Plasma Interactions (Springer 2023): two-plasmon decay, filamentation and beam smoothing',
    'Atzeni & Meyer-ter-Vehn, The Physics of Inertial Fusion (OUP 2004): laser–plasma instabilities in direct drive',
  ],
  objectives: [
    'Derive the two-plasmon-decay growth rate $\\gamma = \\frac{v_{os}}{4}|\\hat{\\mathbf e}\\cdot\\mathbf k_1|\\,|k_2^2 - k_1^2|/(k_1k_2)$ from the electron fluid, and show that its maximum $k_0v_{os}/4$ lies on a hyperbola in k-space',
    'Evaluate the TPD threshold $\\eta = I_{14}L_{\\mu m}\\lambda_{\\mu m}/(82\\,T_{\\rm keV})$ and recognise TPD by its signatures: $3\\omega_0/2$ and $\\omega_0/2$ light and hot electrons',
    'Derive the filamentation growth rate from the paraxial wave equation with a ponderomotive density response, estimate the critical power for self-focusing, and explain how beam smoothing suppresses both',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'tpd', label: 'Two plasmons' },
    { id: 'tpd-growth', label: 'TPD growth' },
    { id: 'tpd-sim', label: 'k-space map' },
    { id: 'tpd-threshold', label: 'Threshold' },
    { id: 'signatures', label: 'Signatures' },
    { id: 'filament', label: 'A self-made lens' },
    { id: 'filament-theory', label: 'Filament growth' },
    { id: 'sim', label: 'Simulation' },
    { id: 'selffocus', label: 'Critical power' },
    { id: 'smoothing', label: 'Smoothing' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          B6 followed light that the plasma scatters back. This lesson takes two instabilities that keep the light in the plasma but spoil it in
          other ways.
        </p>
        <p>
          The first happens at one particular density. Where the plasma frequency is half the laser frequency, at a quarter of the critical
          density, a laser photon can split into two electron plasma waves, each with about half its energy. This is <strong>two-plasmon decay</strong>
          (TPD), Kruer’s 2ω_pe instability. No light comes back; the energy goes into plasma waves fast enough to throw electrons forward at tens of
          keV, and those can preheat the fuel of a fusion capsule.
        </p>
        <p>
          The second happens anywhere below critical. Light pushes plasma out of bright regions (the ponderomotive force of B4), and plasma with
          less density bends light towards itself, because its refractive index √(1 − n/n_c) is higher. So a bright patch makes itself brighter. A wide
          beam breaks up into <strong>filaments</strong>; a narrow beam above a <strong>critical power</strong> squeezes itself to a fine, intense
          channel. That raises the local intensity, and with it every other instability.
        </p>
        <TwoInstabilities />
      </section>

      <section id="tpd">
        <h2>Two plasmons from one photon</h2>
        <p>
          The matching conditions of B5 apply as for any three-wave decay. Both daughters are plasma waves, and a plasma wave cannot have a
          frequency below ω_pe. Two of them add up to ω₀ only if ω_pe ≤ ω₀/2, so TPD lives at or below n_c/4. Thermal corrections push the
          resonance a little lower: plasmons with larger k have higher frequencies (Bohm–Gross), so they are matched where ω_pe is smaller.
        </p>
        <Eq
          title="Matching for two-plasmon decay"
          src="\begin{gathered}\s{w0}{\omega_0} = \s{w1}{\omega_1} + \s{w2}{\omega_2},\quad \s{k0}{\mathbf k_0} = \s{k1}{\mathbf k_1} + \s{k2}{\mathbf k_2} \\ \omega_j^2 = \s{wp}{\omega_{pe}}^2 + 3k_j^2\s{vte}{v_{te}}^2 \\ \dfrac{\s{n}{n}}{\s{nc}{n_c}} \approx \dfrac14 - \dfrac{3(k_1^2 + k_2^2)\,v_{te}^2}{2\,\omega_0^2}\end{gathered}"
          symbols={{
            w0: { name: 'ω₀, laser frequency', units: 'rad/s', note: '5.37×10¹⁵ s⁻¹ for 351 nm light.' },
            w1: { name: 'ω₁, first plasmon’s frequency', units: 'rad/s', note: 'About ω₀/2, a little more for larger k.' },
            w2: { name: 'ω₂, second plasmon’s frequency', units: 'rad/s', note: 'ω₀ − ω₁, also about ω₀/2. TPD splits the energy roughly evenly (Manley–Rowe, B5).' },
            k0: { name: 'k₀, laser wavevector', units: 'm⁻¹', note: 'At n_c/4 its length is (√3/2)ω₀/c.' },
            k1: { name: 'k₁, first plasmon’s wavevector', units: 'm⁻¹', note: 'Typically 1 to 2 times k₀, pointing at an angle to the laser.' },
            k2: { name: 'k₂ = k₀ − k₁, partner plasmon', units: 'm⁻¹', note: 'Closes the triangle. Its component across the laser is equal and opposite to that of k₁.' },
            wp: { name: 'ω_pe, electron plasma frequency', units: 'rad/s', note: 'Exactly ω₀/2 at n_c/4.' },
            vte: { name: 'v_te = √(T_e/m_e), electron thermal speed', units: 'm/s', note: 'Sets the Bohm–Gross shift 3k²v_te² and Landau damping. v_te/c = 0.063 at 2 keV.' },
            n: { name: 'n, electron density where the pair is resonant', units: 'm⁻³', note: 'A little below n_c/4: about 0.23 n_c at 2 keV for the pair k₁ = (1.6, 0.98)k₀, |k₁| ≈ 1.9k₀.' },
            nc: { name: 'n_c, critical density', units: 'm⁻³', note: '1.1×10²¹/λ²_µm cm⁻³: 9.0×10²¹ cm⁻³ at 351 nm.' },
          }}
          says="Each pair of plasmons is resonant at its own density, a little below quarter-critical; pairs with larger k sit lower. Landau damping removes plasmons with kλ_De above about 0.3, so in a hot plasma TPD is confined to a thin layer just below n_c/4."
        />
        <p>
          Unlike SRS, there is no single preferred direction. The geometry only requires that k₁ and k₂ add up to k₀, so the plasmons can point in
          a whole fan of directions on either side of the laser. Which of them grow is decided by the coupling, which comes next.
        </p>
      </section>

      <section id="tpd-growth">
        <h2>The TPD growth rate</h2>
        <p>
          The electrons quiver in the laser field with velocity v_q = eA/m_e (B4). A plasma wave moving through this quivering fluid is carried
          sideways with it, and its own velocity beats with the quiver. Both effects turn one plasma wave into its partner, and the loop closes.
        </p>
        <Derivation
          lessonId="B7"
          id="tpd-growth"
          title="The two-plasmon decay rate from the electron fluid"
          steps={[
            {
              text: 'Split the electron velocity into the quiver in the laser, v_q = eA/m_e, and the slow longitudinal velocity v of the plasma waves. The cold-fluid momentum equation, written for the canonical momentum (which has no curl), gives v one term that couples it to the laser: the gradient of the cross term in ½|v_q + v|².',
              math: '\\dfrac{\\partial \\mathbf v}{\\partial t} = \\dfrac{e}{m_e}\\nabla\\phi - \\nabla(\\mathbf v_q\\cdot\\mathbf v)',
              why: 'The term ½v_q² is the ponderomotive push on the background (B4). It does not involve the plasma waves, so we drop it here, along with terms of second order in v. Without the cross term this is a cold plasma oscillation.',
            },
            {
              text: 'Continuity has its own beat term, because the quiver carries the density ripple δn sideways: ∂δn/∂t + n₀∇·v + ∇·(δn v_q) = 0 (light is transverse, ∇·v_q = 0). Take ∂/∂t, use the momentum equation and Poisson’s equation ∇²φ = eδn/ε₀.',
              math: '\\begin{gathered}\\Big(\\dfrac{\\partial^2}{\\partial t^2} + \\omega_{pe}^2\\Big)\\delta n \\\\ = n_0\\nabla^2(\\mathbf v_q\\cdot\\mathbf v) - \\dfrac{\\partial}{\\partial t}\\nabla\\cdot(\\delta n\\,\\mathbf v_q)\\end{gathered}',
              why: 'Without the right side this is the plasma oscillation at ω_pe. We leave out the electron pressure in the coupling; it only shifts the frequencies to Bohm–Gross, which the matching conditions already include.',
            },
            {
              text: 'Take the pump v_q = v_os ê cos(k₀·x − ω₀t) and two plasma waves: δn₁ at (k₁, ω₁) and δn₂ at (k₂, ω₂) = (k₁ − k₀, ω₁ − ω₀). Continuity gives each wave’s velocity, v_j = (ω_j/n₀)(k_j/k_j²)δn_j. Because ê ⊥ k₀, ê·k₂ = ê·k₁.',
              math: '\\begin{gathered}(\\omega_1^2 - \\omega_{pe}^2)\\,\\delta n_1 = \\tfrac12 v_{os}(\\hat{\\mathbf e}\\cdot\\mathbf k_1)\\Big[\\omega_1 + \\dfrac{k_1^2}{k_2^2}\\,\\omega_2\\Big]\\delta n_2 \\\\ (\\omega_2^2 - \\omega_{pe}^2)\\,\\delta n_2 = \\tfrac12 v_{os}(\\hat{\\mathbf e}\\cdot\\mathbf k_1)\\Big[\\omega_2 + \\dfrac{k_2^2}{k_1^2}\\,\\omega_1\\Big]\\delta n_1\\end{gathered}',
              why: 'ω₂ = ω₁ − ω₀ is negative: this wave is the complex conjugate of the physical partner at (k₀ − k₁, ω₀ − ω₁). The first term in each bracket comes from the convected ripple, the second from the velocity beat.',
            },
            {
              text: 'Multiply the two equations so that δn₁δn₂ cancels. Near resonance both are plasma oscillations, ω₁ ≈ ω_pe and ω₂ ≈ −ω_pe, which needs ω₀ ≈ 2ω_pe. The brackets then simplify.',
              math: '\\begin{gathered}(\\omega_1^2 - \\omega_{pe}^2)(\\omega_2^2 - \\omega_{pe}^2) \\\\ = \\dfrac{v_{os}^2}{4}(\\hat{\\mathbf e}\\cdot\\mathbf k_1)^2\\,\\omega_{pe}^2\\,\\dfrac{(k_2^2 - k_1^2)^2}{k_1^2k_2^2}\\end{gathered}',
              why: 'The coupling vanishes if k₁ and k₂ have the same length (the two beat terms cancel) and if ê·k₁ = 0: plasmons along the laser axis, or in the plane perpendicular to the polarization, are not driven.',
            },
            {
              text: 'Put ω₁ = ω_pe + δ and ω₂ = −ω_pe + δ (exact matching). The left side is (2ω_pe δ)(−2ω_pe δ) = −4ω_pe²δ², so δ² < 0 and δ = iγ.',
              math: '\\gamma = \\dfrac{v_{os}}{4}\\,\\dfrac{|\\hat{\\mathbf e}\\cdot\\mathbf k_1|\\,|k_2^2 - k_1^2|}{k_1k_2}',
              why: 'As for every three-wave instability, γ ∝ v_os ∝ √I. Unlike SRS, neither daughter is light: both plasmons have small group velocities, so they stay near the layer where they are born.',
            },
            {
              text: 'Use components in the plane of polarization, k₁ = (k∥, k⊥) with k∥ along k₀ and k⊥ along ê. Then ê·k₁ = k⊥ and k₂² − k₁² = k₀(k₀ − 2k∥). On the hyperbola k⊥² = k∥(k∥ − k₀) the factors cancel to a constant, the largest value γ reaches.',
              math: '\\gamma_{\\max} = \\dfrac{k_0v_{os}}{4} \\approx 0.185\\,\\omega_0\\,\\lambda_{\\mu m}\\sqrt{\\dfrac{I}{10^{18}\\ \\text{W/cm}^2}}',
              why: 'On the hyperbola k₁²k₂² = k∥(k∥ − k₀)(2k∥ − k₀)², so γ² = (k₀v_os/4)² exactly. The practical form uses k₀ = (√3/2)ω₀/c at n_c/4 and v_os/c = 0.855λ_µm√(I/10¹⁸ W/cm²). At 351 nm and 10¹⁵ W/cm², γ_max = 11 ps⁻¹: an e-fold every 90 fs.',
            },
          ]}
        />
        <Eq
          title="Two-plasmon decay growth rate"
          src="\begin{gathered}\s{g}{\gamma} = \dfrac{\s{vos}{v_{os}}}{4}\,\dfrac{|\s{k1}{\mathbf k_1}\cdot\s{e}{\hat{\mathbf e}}|\,\big|\s{k2}{k_2}^2 - k_1^2\big|}{k_1\,k_2} \\ \gamma_{\max} = \dfrac{\s{k0}{k_0}\,v_{os}}{4}\ \ \text{on the hyperbola} \\ \s{kq}{k_\perp}^2 = \s{kp}{k_\parallel}(k_\parallel - k_0)\end{gathered}"
          symbols={{
            g: { name: 'γ, growth rate', units: 's⁻¹', note: 'Amplitude growth rate of both plasmons in a uniform plasma at exact matching, before damping.' },
            vos: { name: 'v_os = eE₀/(m_eω₀), peak quiver speed', units: 'm/s', note: 'v_os/c = 0.855 λ_µm √(I/10¹⁸ W/cm²), linear polarization: 0.0095 at 351 nm and 10¹⁵ W/cm².' },
            k1: { name: 'k₁, first plasmon’s wavevector', units: 'm⁻¹', note: 'Its component along the laser polarization is what the quiver can push.' },
            e: { name: 'ê, laser polarization direction', note: 'TPD plasmons grow fastest in the plane containing k₀ and ê.' },
            k2: { name: 'k₂ = |k₁ − k₀|, partner’s wavenumber', units: 'm⁻¹', note: 'Equal lengths kill the coupling, so the two plasmons always have different |k|.' },
            k0: { name: 'k₀, laser wavenumber at n_c/4', units: 'm⁻¹', note: '(√3/2)ω₀/c.' },
            kq: { name: 'k⊥, component along the polarization', units: 'm⁻¹', note: 'Perpendicular to the laser.' },
            kp: { name: 'k∥, component along the laser', units: 'm⁻¹', note: 'The hyperbola has branches for k∥ > k₀ and k∥ < 0; the two plasmons of a pair sit on opposite branches.' },
          }}
          says="The rate is zero along the laser and largest, k₀v_os/4, everywhere on a hyperbola in the plane of polarization. So the coupling alone does not pick one direction: matching and Landau damping do, by keeping only plasmons that are resonant at a density present in the plasma and that have kλ_De ≲ 0.3."
        />
      </section>

      <section id="tpd-sim">
        <h2>TPD in k-space</h2>
        <p>
          The map shows every possible plasmon k₁ in the plane of polarization, in units of the laser k₀, coloured by its growth rate. The violet
          circles mark where in density each pair is resonant, and the grey wash shows where one of the two plasmons is Landau damped. Tap a point
          to choose a decay and see its triangle.
        </p>
        <TpdMapSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The hyperbola.</strong> Tap anywhere on the dashed curve: γ/(k₀v_os/4) reads 1.000 to the last digit. Off it, the rate falls,
            reaching zero on the laser axis.
          </li>
          <li>
            <strong>Matching.</strong> The default decay, k₁ = (1.6, 0.98)k₀ at 2 keV, is resonant at 0.228 n_c with ω₁ = 0.510ω₀; the readout
            checks that ω₁ + ω₂ = ω₀. Move along the hyperbola: small pairs sit just under n_c/4, larger ones lower down.
          </li>
          <li>
            <strong>Temperature.</strong> Raise T_e from 1 to 3 keV. The circles spread (the Bohm–Gross shift grows) and the grey Landau region
            closes in, until only plasmons with k below about 2k₀ survive: hotter coronas confine TPD to a thinner layer.
          </li>
        </ul>
      </section>

      <section id="tpd-threshold">
        <h2>The threshold in a density gradient</h2>
        <p>
          A real corona is not uniform. A pair that is matched at one density drifts out of matching as the plasmons move, and the density they
          move into is different. The plasmons’ group velocities are thermal, 3kv_te²/ω, so they leave slowly, but the mismatch still limits the
          growth. B5’s Rosenbluth analysis applies: what matters is γ₀² against the rate |κ′v₁v₂| at which the gradient detunes the pair. For TPD
          that rate turns out to be (3/2)k₀v_te²/L, the same for every pair, where L is the density scale length at n_c/4.
        </p>
        <p>
          Some TPD pairs grow absolutely, standing in place and growing in time, once γ₀² is large enough compared with that rate. The threshold
          usually quoted is the one Simon and co-workers found for a linear profile (1983), written in practical units:
        </p>
        <Eq
          title="Two-plasmon decay threshold"
          src="\begin{gathered}\s{eta}{\eta} = \dfrac{\s{I}{I_{14}}\,\s{L}{L_{\mu m}}\,\s{lam}{\lambda_{\mu m}}}{82\,\s{T}{T_{\text{keV}}}} \gtrsim 1 \\ \eta = \dfrac{\s{Lam}{\Lambda}}{1.04},\quad \Lambda = \dfrac{\gamma_{\max}^2L}{k_0v_{te}^2} \\ = \dfrac{1}{16}\Big(\dfrac{v_{os}}{v_{te}}\Big)^2k_0L\end{gathered}"
          plot="b7-tpd-threshold"
          symbols={{
            eta: { name: 'η, threshold parameter', note: 'Above about 1, TPD grows absolutely; below, it is only a convective amplifier with a modest gain.' },
            I: { name: 'I₁₄, laser intensity at n_c/4', units: '10¹⁴ W/cm²', note: 'With many overlapping beams, beams that share a plasma wave drive it together, so to a first approximation the overlapped intensity is what counts.' },
            L: { name: 'L_µm, density scale length at n_c/4', units: 'µm', note: 'n/|dn/dx| there. Larger targets and longer pulses make longer coronas.' },
            lam: { name: 'λ_µm, laser wavelength', units: 'µm', note: 'At 351 nm the threshold reads I₁₄L_µm/T_keV ≈ 233.' },
            T: { name: 'T_keV, electron temperature', units: 'keV', note: 'Hotter plasma raises the threshold: the plasmons leave the resonance faster, and Landau damping removes the short ones.' },
            Lam: { name: 'Λ, the same in plasma variables', note: 'The homogeneous growth rate squared against the rate the gradient detunes the pair. The Rosenbluth gain of B5 is G = 2πγ₀²/|κ′v₁v₂| = (4π/3)Λ, about 4.4 at η = 1.' },
          }}
          says="Every factor has a reason: intensity drives the decay, a long scale length keeps the pair matched over a long distance, and a hot plasma lets the plasmons escape the resonance faster. At 351 nm with L = 150 µm and T_e = 2 keV, threshold is about 3×10¹⁴ W/cm² at quarter-critical, an intensity well within reach of fusion lasers."
        />
        <Plotter spec={plotById('b7-tpd-threshold')!} />
        <p>
          The conversion between the two forms is a useful check. With γ_max = k₀v_os/4 and v_te = √(T_e/m_e), Λ = 0.0127 I₁₄L_µmλ_µm/T_keV, so
          η = 1 is Λ = 1.04: TPD turns absolute when the homogeneous growth rate is about equal to the detuning rate, as one would guess.
        </p>
      </section>

      <section id="signatures">
        <h2>Signatures</h2>
        <p>The plasma waves of TPD stay inside the target, but they leave three kinds of evidence outside it.</p>
        <ul>
          <li>
            <strong>3ω₀/2 light.</strong> A laser photon can merge with a TPD plasmon (ω₀ + ω₀/2), making light at 3ω₀/2: 234 nm for a 351 nm
            laser. Its small offset from exactly 3/2 depends on the plasmon’s k and on T_e, so the spectrum carries information about both.
          </li>
          <li>
            <strong>ω₀/2 light.</strong> Near n_c/4, light of frequency ω₀/2 is right at its own cut-off, so a plasmon there can convert into an
            electromagnetic wave in the density gradient. Its signature is half-harmonic emission, 702 nm for a 351 nm laser.
          </li>
          <li>
            <strong>Hot electrons.</strong> TPD plasmons have frequency ω₀/2 and k between about k₀ and 2k₀, so phase velocities v_ph = ω/k of
            roughly 0.3c to 0.6c. Electrons caught by such waves can be thrown forward with up to a few hundred keV (B8) and form a hot tail with
            a temperature of tens of keV. In direct-drive experiments the hard x-ray signal from these electrons rises steeply with the overlapped
            intensity, along with the half-harmonic light.
          </li>
        </ul>
        <p>
          These hot electrons are why TPD matters for laser fusion. They are energetic enough to cross the ablator and deposit energy in the cold
          fuel before it is compressed, which is the subject of B8.
        </p>
      </section>

      <section id="filament">
        <h2>A lens made by the light</h2>
        <p>
          The refractive index of a plasma, √(1 − n/n_c), is larger where the density is lower. Light bends towards the higher index, as it does in
          the core of an optical fibre. Now let the light make the low-density region itself. In a bright patch the ponderomotive force pushes
          electrons out; they drag the ions with them, and after a few sound crossing times the plasma has settled into a density dip that exactly
          balances the light’s push against the plasma pressure.
        </p>
        <Eq
          title="Density in pressure balance with the light"
          src="\begin{gathered}\dfrac{\s{dn}{\delta n}}{\s{n0}{n_0}} \approx -\dfrac{\s{Up}{U_p}}{\s{Te}{T_e} + \s{Ti}{T_i}/\s{Z}{Z}} \\ U_p\,[\text{eV}] = 9.33\times10^{-14} \\ \times\,\s{I}{I}\,[\text{W/cm}^2]\;\s{lam}{\lambda_{\mu m}}^2\end{gathered}"
          symbols={{
            dn: { name: 'δn, density change', units: 'm⁻³', note: 'Negative where the light is bright. Exactly, n = n₀e^(−U_p/T*), which saturates at n → 0 for very bright light (cavitation).' },
            n0: { name: 'n₀, density without the light', units: 'm⁻³', note: 'The density far from the beam.' },
            Up: { name: 'U_p = m_ev_os²/4, ponderomotive potential', units: 'J (eV)', note: 'The cycle-averaged quiver energy of an electron (B4). 11.5 eV at 351 nm and 10¹⁵ W/cm².' },
            Te: { name: 'T_e, electron temperature', units: 'J (keV)', note: 'Electron pressure resists the push.' },
            Ti: { name: 'T_i, ion temperature', units: 'J (keV)', note: 'Ion pressure resists it too, through the ambipolar field that ties ions to electrons.' },
            Z: { name: 'Z, ion charge', note: 'Each ion brings Z electrons, so its pressure counts as T_i/Z per electron.' },
            I: { name: 'I, laser intensity', units: 'W/cm²', note: 'Local, cycle-averaged.' },
            lam: { name: 'λ_µm, laser wavelength', units: 'µm', note: 'Quiver energy ∝ Iλ², so infrared light digs deeper holes at the same intensity.' },
          }}
          says="The light digs a hole in proportion to its intensity, with the plasma pressure T* = T_e + T_i/Z resisting. U_p/T* is small in a fusion corona (0.006 at 10¹⁵ W/cm² and 2 keV for 351 nm light), but the hole extends along the beam for hundreds of wavelengths, so even a small index change refracts strongly."
        />
        <p>
          Heating can do the same job. Where the light is brighter, collisional absorption (B2) heats the plasma more, and the hotter plasma expands
          out of the bright region. This thermal filamentation is important in colder, more collisional plasmas and for long pulses. Either way
          there are two forms of the instability: a wide, nearly uniform beam breaks into many <strong>filaments</strong>, and a whole beam above a
          critical power <strong>self-focuses</strong>.
        </p>
      </section>

      <section id="filament-theory">
        <h2>Filament growth</h2>
        <p>
          Take a wide beam with a small transverse ripple in its intensity and ask how fast the ripple grows along the beam. In steady state this is a
          growth in space, not time.
        </p>
        <Derivation
          lessonId="B7"
          id="filament-growth"
          title="The filamentation growth rate"
          steps={[
            {
              text: 'Write the laser field as E = Re[a(x, z)e^{i(k₀z − ω₀t)}] with an envelope a that changes slowly over a wavelength. The wave equation with a density change δn, after dropping ∂²a/∂z², is the paraxial wave equation.',
              math: '2ik_0\\dfrac{\\partial a}{\\partial z} + \\nabla_\\perp^2 a - \\dfrac{\\omega_{pe}^2}{c^2}\\,\\dfrac{\\delta n}{n_0}\\,a = 0',
              why: 'It follows from (∂²/∂t² − c²∇² + ω_pe²(1 + δn/n₀))E = 0 and the dispersion relation ω₀² = ω_pe² + c²k₀². With δn = 0 it describes diffraction; the last term is refraction, and with δn < 0 it focuses.',
            },
            {
              text: 'The plasma answers. On times longer than the sound crossing time, the electron and ion pressures balance the ponderomotive force (B4) and the density is a Boltzmann factor in U_p.',
              math: '\\begin{gathered}\\dfrac{n}{n_0} = \\exp\\Big(-\\dfrac{U_p}{T^*}\\Big),\\quad U_p = \\dfrac{e^2|a|^2}{4m_e\\omega_0^2} \\\\ T^* = T_e + \\dfrac{T_i}{Z}\\end{gathered}',
              why: 'Electrons: T_e∇n_e = −n_e∇U_p − n_e eE_amb. Ions: T_i∇n_i = Zen_iE_amb. Eliminating the ambipolar field with n_e = Zn_i gives T*∇ln n = −∇U_p. For weak light δn/n₀ ≈ −U_p/T*.',
            },
            {
              text: 'Insert the linear response. The refraction term becomes a cubic nonlinearity with a positive strength β: the light makes its own lens. A uniform beam a₀ is an exact solution that only picks up a phase.',
              math: '\\begin{gathered}2ik_0\\dfrac{\\partial a}{\\partial z} + \\nabla_\\perp^2 a + \\beta|a|^2a = 0 \\\\ \\beta = \\dfrac{\\omega_{pe}^2}{c^2}\\,\\dfrac{e^2}{4m_e\\omega_0^2T^*}\\end{gathered}',
              why: 'This is the cubic nonlinear Schrödinger equation, with z playing the part of time. The same equation describes self-focusing in glass and the breakup of deep-water waves.',
            },
            {
              text: 'Perturb the uniform beam: a = a₀(1 + u + iw)e^{iβa₀²z/2k₀}, with u (amplitude) and w (phase) small and ∝ cos Kx. The real and imaginary parts give two coupled equations.',
              math: '2k_0\\dfrac{\\partial u}{\\partial z} = K^2w,\\qquad 2k_0\\dfrac{\\partial w}{\\partial z} = (2\\beta a_0^2 - K^2)\\,u',
              why: 'Read them as a loop. A phase ripple acts as a row of weak lenses and gathers light under its crests (first equation). An amplitude ripple deepens the density dip and builds up the phase ripple at the rate 2βa₀²u, while diffraction, −K²u, works against it (second).',
            },
            {
              text: 'Differentiate the first equation and use the second: u grows as e^{κz} with',
              math: '\\begin{gathered}\\kappa = \\dfrac{K}{2k_0}\\sqrt{K_c^2 - K^2} \\\\ K_c^2 = 2\\beta a_0^2 = \\dfrac{\\omega_{pe}^2}{c^2}\\,\\dfrac{v_{os}^2}{2v_e^2}\\end{gathered}',
              why: 'Here v_e = √(T*/m_e) and 2βa₀² = (ω_pe²/c²)(2U_p/T*) with U_p = m_ev_os²/4. Ripples longer than 2π/K_c grow. Shorter ones diffract faster than the plasma can focus them, and only oscillate.',
            },
            {
              text: 'Maximize over K. The fastest ripple has K = K_c/√2.',
              math: '\\kappa_{\\max} = \\dfrac{K_c^2}{4k_0} = \\dfrac18\\Big(\\dfrac{v_{os}}{v_e}\\Big)^2\\dfrac{\\omega_{pe}^2}{k_0c^2}',
              why: 'At 351 nm, 10¹⁵ W/cm², 2 keV and 0.1 n_c, U_p/T_e = 0.0058: the fastest ripple has a transverse wavelength of 15 µm and grows by e in 185 µm, comparable with the size of the corona. The plasma needs a sound crossing time of the ripple, tens of picoseconds here, to respond.',
            },
          ]}
        />
        <Eq
          title="Filamentation growth rate"
          src="\begin{gathered}\s{kap}{\kappa} = \dfrac{\s{K}{K}}{2\s{k0}{k_0}}\sqrt{\s{Kc}{K_c}^2 - K^2} \\ K_c^2 = \dfrac{\s{wp}{\omega_{pe}}^2}{c^2}\,\dfrac{\s{vos}{v_{os}}^2}{2\s{ve}{v_e}^2} \\ = \dfrac{\omega_{pe}^2}{c^2}\,\dfrac{2\s{Up}{U_p}}{\s{T}{T^*}}\end{gathered}"
          plot="b7-filamentation-growth"
          symbols={{
            kap: { name: 'κ, spatial growth rate', units: 'm⁻¹', note: 'The ripple’s amplitude grows as e^{κz} along the beam.' },
            K: { name: 'K, transverse wavenumber of the ripple', units: 'm⁻¹', note: 'Transverse wavelength 2π/K. The fastest is K_c/√2.' },
            k0: { name: 'k₀, laser wavenumber in the plasma', units: 'm⁻¹', note: '(ω₀/c)√(1 − n/n_c). Diffraction is weaker for shorter wavelengths.' },
            Kc: { name: 'K_c, cut-off wavenumber', units: 'm⁻¹', note: 'Ripples with K > K_c diffract faster than the plasma can focus them.' },
            wp: { name: 'ω_pe, plasma frequency', units: 'rad/s', note: 'More plasma, more refraction for the same fractional density dip: κ ∝ n.' },
            vos: { name: 'v_os, peak quiver speed', units: 'm/s', note: 'v_os² ∝ Iλ².' },
            ve: { name: 'v_e = √(T*/m_e)', units: 'm/s', note: 'With T* = T_e + T_i/Z, the pressure that resists the ponderomotive push.' },
            Up: { name: 'U_p, ponderomotive potential', units: 'J', note: 'm_ev_os²/4: the light’s push on an electron.' },
            T: { name: 'T*, effective temperature', units: 'J', note: 'T_e + T_i/Z.' },
          }}
          says="Diffraction (the −K² under the square root) fights the light’s self-made lens (K_c²). Long ripples barely refract, short ones diffract away, and in between a band grows; the fastest has κ_max = K_c²/4k₀, proportional to I, n and 1/T."
        />
        <Plotter spec={plotById('b7-filamentation-growth')!} />
      </section>

      <section id="sim">
        <h2>Simulation: a beam breaking up</h2>
        <p>
          The simulation solves the paraxial equation with the plasma in pressure balance, n = n₀e^(−U_p/T_e), for 351 nm light. It marches the
          beam forward in z and draws it as it goes. In the first mode a wide beam carries a small ripple; in the second, a single round beam is
          launched at a chosen power. The equation is solved without linearizing, so the saturation is in the picture too.
        </p>
        <BeamBreakupSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The benchmark.</strong> At the defaults (10¹⁵ W/cm², 0.1 n_c, 2 keV) the ripple at K = K_max grows at the measured rate printed
            under the picture, within a few percent of linear theory, 5.4 mm⁻¹. Then it saturates: the light collects into narrow filaments and the
            plasma between them is left almost undisturbed.
          </li>
          <li>
            <strong>Cut-off.</strong> Set K/K_max to 0.5 (slower growth), then to 1.5, just past the cut-off √2: the ripple only wobbles, as the
            square root in κ says.
          </li>
          <li>
            <strong>Density.</strong> Switch to the density view to see the channels the light has dug. Raise the density or lower the temperature:
            the filaments get thinner and grow faster.
          </li>
          <li>
            <strong>Self-focusing.</strong> In the single-beam mode, set P/P_c to 0.5: the beam still spreads, but its half-maximum width grows to
            about 1.6 times its start where vacuum diffraction would give 2.2. At P/P_c = 1.2 it pinches and the intensity on axis rises about
            eightyfold before the density response, which grows more slowly than U_p once U_p/T_e is no longer small, halts the collapse. Untick the nonlinearity to check the code against vacuum diffraction.
          </li>
        </ul>
      </section>

      <section id="selffocus">
        <h2>Self-focusing and the critical power</h2>
        <p>
          A whole beam of radius w spreads by diffraction at an angle of about 1/(k₀w). Its own density channel acts like the core of a fibre,
          which guides rays whose angle squared is below about its fractional change in refractive index. That index change is proportional to
          the intensity, so to P/w², and the diffraction angle squared goes as 1/w² too: w cancels. The balance is set by the <strong>power</strong>,
          not the intensity. Above a critical power the beam is guided more strongly than it diffracts, and since a narrower beam is more intense,
          it keeps narrowing.
        </p>
        <Eq
          title="Critical power for self-focusing"
          src="\begin{gathered}\s{Pc}{P_c} \approx 32\ \text{MW}\;\s{T}{T^*_{\text{keV}}}\,\dfrac{\s{nc}{n_c}}{\s{n}{n}}\sqrt{1 - \dfrac{n}{n_c}} \\ \s{Pr}{P_c^{\text{rel}}} \approx 16\ \text{GW}\;\dfrac{n_c}{n}\sqrt{1 - \dfrac{n}{n_c}}\end{gathered}"
          plot="b7-critical-power"
          symbols={{
            Pc: { name: 'P_c, ponderomotive critical power', units: 'W', note: 'From the Townes threshold of the two-dimensional cubic equation, P_c = N_cε₀cη/(2β) with N_c = 11.70 in the units where the equation reads iψ_Z + ∇²ψ + |ψ|²ψ = 0. A Gaussian beam begins to narrow at 4π/11.70 = 1.07 times this.' },
            T: { name: 'T* = T_e + T_i/Z', units: 'keV', note: 'Hotter plasma is stiffer and needs more power to channel.' },
            nc: { name: 'n_c, critical density', units: 'm⁻³', note: 'Refraction is weaker at low density, so P_c ∝ n_c/n.' },
            n: { name: 'n, electron density', units: 'm⁻³', note: 'The factor √(1 − n/n_c) is the refractive index η.' },
            Pr: { name: 'P_c^rel, relativistic critical power', units: 'W', note: 'The electron mass rises with the quiver energy, which also raises the index where the light is bright. It needs no ion motion, so it acts within femtoseconds: the self-focusing of short, intense pulses in Track C.' },
          }}
          says="The ponderomotive and relativistic critical powers differ by m_ec²/T*: in a 3 keV plasma at 0.1 n_c, a beam carrying about 0.9 GW self-focuses through the density channel, while relativistic self-focusing would need 170 times more. The ponderomotive channel takes ion motion, so it needs picoseconds; the relativistic one is instant."
        />
        <Plotter spec={plotById('b7-critical-power')!} />
        <p>
          In two transverse dimensions the cubic equation has no stable focus: above the critical power the width shrinks to zero at a finite
          distance. A real plasma stops this. The Boltzmann response saturates as the density in the channel approaches zero (cavitation), and the
          intense focus then drives other instabilities and heats the plasma. The simulation keeps the full exponential response, which is why its
          focus stops at a finite intensity.
        </p>
      </section>

      <section id="smoothing">
        <h2>Smoothing the beams</h2>
        <p>
          A fusion laser beam carries far more than the critical power: a 351 nm beam of a few terawatts is thousands of times P_c. What saves it is
          that it is not one beam but many small ones. A <strong>random phase plate</strong> (Kato and co-workers, 1984) breaks the focal spot into
          speckles, each about λF wide and roughly 7λF² long for an f-number F: 2.8 µm by about 160 µm for an f/8 beam at 351 nm. The intensity
          in a fully developed speckle pattern is exponentially distributed, so most speckles carry less than average power, and a speckle of
          average intensity carries P ≈ I(λF)², about 80 MW at 10¹⁵ W/cm². That is an eleventh of P_c at 0.1 n_c and 3 keV, and still about four
          times below it at n_c/4. Only the rare bright ones self-focus.
        </p>
        <p>
          Three further tricks make even those harmless:
        </p>
        <ul>
          <li>
            <strong>Smoothing by spectral dispersion (SSD)</strong> (Skupsky and co-workers, 1989) adds bandwidth and spreads the colours across the
            focal spot, so the speckle pattern changes in about the inverse bandwidth, a picosecond for a terahertz. The ions need a sound crossing
            time of a speckle, λF/c_s, about 9 ps at 2 keV in a plastic plasma, to dig a channel; they see the time average, which is much smoother.
          </li>
          <li>
            <strong>Polarization smoothing</strong> splits each beam into two orthogonal polarizations with different speckle patterns, which add
            without interfering and lower the contrast at once.
          </li>
          <li>
            <strong>Induced spatial incoherence (ISI)</strong>, used on krypton-fluoride lasers, does the same job with a broadband, incoherent beam.
          </li>
        </ul>
        <p>
          Smoothing works well against filamentation and SBS, which need ion motion. It does less against TPD and SRS: with growth times of a tenth
          of a picosecond they see a frozen speckle pattern. For them the levers are those in η: wavelength, intensity, scale length and temperature.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          TPD, SRS and resonance absorption (B3) all hand laser energy to plasma waves that move at a large fraction of the speed of light. B8
          follows what happens next: electrons trapped and thrown forward by those waves, the two-temperature distributions they form, how hot they
          are, and why they preheat fusion fuel. B9 then turns to the particle-in-cell simulations that capture all of these effects at once, and
          Track C takes self-focusing to the relativistic regime of intense short pulses.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B7-p1',
      kind: 'numeric',
      concept: 'tpd-growth-rate',
      prompt: 'Linearly polarized 351 nm light reaches the quarter-critical surface at $10^{15}$ W/cm². Find the maximum homogeneous TPD growth rate in ps⁻¹. Use the vacuum relation $v_{os}/c = 0.855\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}\\ \\text{W/cm}^2}$.',
      answer: 11.0,
      tol: 0.03,
      unit: 'ps⁻¹',
      hints: [
        '$\\gamma_{\\max} = k_0v_{os}/4$, with $k_0$ the laser wavenumber at $n_c/4$.',
        '$ck_0 = \\omega_0\\sqrt{1 - 1/4}$ and $\\omega_0 = 2\\pi c/\\lambda = 5.37\\times10^{15}$ s⁻¹.',
      ],
      solution: '$v_{os}/c = 0.855\\times0.351\\times\\sqrt{10^{-3}} = 9.49\\times10^{-3}$. Then $\\gamma_{\\max}/\\omega_0 = (\\sqrt3/2)\\times9.49\\times10^{-3}/4 = 2.05\\times10^{-3}$, and $\\gamma_{\\max} = 2.05\\times10^{-3}\\times5.37\\times10^{15} = 1.10\\times10^{13}$ s⁻¹ = 11.0 ps⁻¹. That is an e-fold every 91 fs: in a uniform plasma nothing would stop it within a nanosecond pulse, which is why the gradient threshold matters.',
    },
    {
      id: 'B7-p2',
      kind: 'numeric',
      concept: 'tpd-threshold',
      prompt: 'A 351 nm laser delivers $5\\times10^{14}$ W/cm² to the quarter-critical surface, where the density scale length is 300 µm and $T_e = 2.5$ keV. Evaluate the TPD threshold parameter η.',
      answer: 2.57,
      tol: 0.03,
      unit: '',
      hints: ['$\\eta = I_{14}L_{\\mu m}\\lambda_{\\mu m}/(82\\,T_{\\rm keV})$, with $I_{14}$ the intensity in units of $10^{14}$ W/cm².'],
      solution: '$\\eta = 5\\times300\\times0.351/(82\\times2.5) = 526.5/205 = 2.57$. The plasma is well above the absolute threshold. To get below it at this intensity, $T_e$ would have to exceed 6.4 keV or $L$ fall below 117 µm.',
    },
    {
      id: 'B7-p3',
      kind: 'numeric',
      concept: 'tpd-landau-cutoff',
      prompt: 'At $T_e = 3$ keV, TPD plasmons near $0.23\\,n_c$ are strongly Landau damped once $k\\lambda_{De} > 0.3$. What is the largest plasmon wavenumber that escapes damping, in units of the local laser wavenumber $k_0$? Take $\\lambda_{De} = v_{te}/\\omega_{pe}$ with $v_{te} = \\sqrt{T_e/m_e}$.',
      answer: 2.14,
      tol: 0.03,
      unit: '× k₀',
      hints: [
        'In units of $c/\\omega_0$: $\\lambda_{De} = (v_{te}/c)/\\sqrt{n/n_c}$, with $v_{te}^2/c^2 = T_e/m_ec^2$ and $m_ec^2 = 511$ keV.',
        'The laser wavenumber there is $ck_0/\\omega_0 = \\sqrt{1 - n/n_c}$.',
      ],
      solution: '$v_{te}/c = \\sqrt{3/511} = 0.0766$, so $\\lambda_{De} = 0.0766/\\sqrt{0.23} = 0.160\\,c/\\omega_0$ (8.9 nm at 351 nm). Then $k_{\\max} = 0.3/0.160 = 1.88\\,\\omega_0/c$, and with $k_0 = \\sqrt{0.77} = 0.877\\,\\omega_0/c$, $k_{\\max} = 2.14\\,k_0$. Only plasmons up to about twice the laser wavenumber survive, the part of the hyperbola near its vertices; hotter plasma squeezes TPD further.',
    },
    {
      id: 'B7-p4',
      kind: 'numeric',
      concept: 'filamentation-growth',
      prompt: '351 nm light at $2\\times10^{15}$ W/cm² crosses a plasma at $0.2\\,n_c$ with $T_e = 3$ keV and cold ions. Find the e-folding length $1/\\kappa_{\\max}$ of the fastest-growing filaments, in µm.',
      answer: 65.2,
      tol: 0.03,
      unit: 'µm',
      hints: [
        '$U_p = 9.33\\times10^{-14}I\\lambda_{\\mu m}^2$ eV, and $(v_{os}/v_e)^2 = 4U_p/T_e$.',
        'Rewrite $\\kappa_{\\max} = \\frac18(v_{os}/v_e)^2\\,\\omega_{pe}^2/(k_0c^2)$ as $\\dfrac{U_p}{2T_e}\\,\\dfrac{n/n_c}{\\sqrt{1 - n/n_c}}\\,\\dfrac{2\\pi}{\\lambda}$.',
      ],
      solution: '$U_p = 9.33\\times10^{-14}\\times2\\times10^{15}\\times0.351^2 = 23.0$ eV, so $U_p/T_e = 7.67\\times10^{-3}$. Then $\\kappa_{\\max} = 3.83\\times10^{-3}\\times(0.2/0.894)\\times(2\\pi/0.351\\ \\mu\\text{m}) = 0.0153$ µm⁻¹, an e-fold every 65 µm. The fastest ripple has $K = (\\omega_{pe}/c)\\sqrt{U_p/T_e} = 0.70$ µm⁻¹, a transverse wavelength of 9.0 µm.',
    },
    {
      id: 'B7-p5',
      kind: 'numeric',
      concept: 'speckle-self-focusing',
      prompt: 'A 351 nm beam smoothed by a phase plate and focused at f/8 has an average intensity of $10^{15}$ W/cm². Treat each speckle as a small beam of power $I(\\lambda F)^2$. In a plasma at $0.1\\,n_c$ with $T^* = 3$ keV, how many times brighter than average must a speckle be to exceed the ponderomotive critical power $P_c = 31.7\\ \\text{MW}\\times T^*_{\\rm keV}(n_c/n)\\sqrt{1 - n/n_c}$?',
      answer: 11.5,
      tol: 0.03,
      unit: '× average',
      hints: ['The speckle width is $\\lambda F = 2.81$ µm, so an average speckle carries $10^{15}\\ \\text{W/cm}^2\\times(2.81\\times10^{-4}\\ \\text{cm})^2$.'],
      solution: 'An average speckle carries $10^{15}\\times7.88\\times10^{-8} = 7.9\\times10^7$ W = 79 MW, and $P_c = 31.7\\times3\\times10\\times0.949 = 903$ MW. The ratio is 11.5. With exponential speckle statistics, the fraction of the volume that bright is about $e^{-11.5} \\approx 10^{-5}$, but a 1 mm spot holds about $10^5$ speckles in each plane, so a few do self-focus unless smoothing moves them on first.',
    },
    {
      id: 'B7-p6',
      kind: 'mcq',
      concept: 'tpd-signatures',
      prompt: 'In a 351 nm direct-drive experiment, spectrometers record light near 234 nm and near 702 nm, and a hard x-ray detector sees electrons of several tens of keV. Which process is the most likely source of all three?',
      options: [
        'Two-plasmon decay near n_c/4',
        'Raman backscatter from 0.05 n_c',
        'Stimulated Brillouin scattering',
        'Filamentation at 0.1 n_c',
      ],
      correct: 0,
      hints: ['Write the two wavelengths as fractions of the laser frequency: 351/234 and 351/702.'],
      solution: '234 nm is $3\\omega_0/2$, a laser photon plus a plasmon of $\\omega_0/2$, and 702 nm is $\\omega_0/2$, a plasmon converted into light where $\\omega_{pe} = \\omega_0/2$. Both point to plasmons at half the laser frequency, which only TPD and Raman scattering at $n_c/4$ make; the $3\\omega_0/2$ line needs plasmons, and their fast phase velocities explain the hot electrons. Raman backscatter from 0.05 n_c comes out between about 450 and 510 nm (depending on $T_e$), SBS light within a nanometre of 351 nm, and filamentation makes no new frequencies.',
    },
  ],
  cards: [
    { id: 'B7-c1', front: 'Two-plasmon decay: what decays into what, and where?', back: 'A laser photon into two electron plasma waves, $\\omega_0 = \\omega_1 + \\omega_2$ with $\\omega_{1,2} \\approx \\omega_0/2$: just below $n_c/4$ (lower for larger $k$ or hotter plasma). Landau damping limits the plasmons to $k\\lambda_{De} \\lesssim 0.3$' },
    { id: 'B7-c2', front: 'Maximum TPD growth rate, and where in k-space', back: '$\\gamma_{\\max} = k_0v_{os}/4$, on the hyperbola $k_\\perp^2 = k_\\parallel(k_\\parallel - k_0)$ in the plane of polarization; zero along the laser. About 11 ps⁻¹ at 351 nm and $10^{15}$ W/cm²' },
    { id: 'B7-c3', front: 'TPD threshold in a density gradient', back: '$\\eta = I_{14}L_{\\mu m}\\lambda_{\\mu m}/(82\\,T_{\\rm keV}) \\gtrsim 1$ for absolute growth (Simon et al. 1983). At 351 nm: $I_{14}L_{\\mu m}/T_{\\rm keV} \\gtrsim 233$' },
    { id: 'B7-c4', front: 'Signatures of TPD', back: '$3\\omega_0/2$ light (234 nm for a 351 nm laser) from laser photon + plasmon; $\\omega_0/2$ light (702 nm); hot electrons from plasmons with $v_{ph} \\approx 0.3$–$0.6c$' },
    { id: 'B7-c5', front: 'Fastest filamentation ripple and its spatial growth rate', back: '$K = K_c/\\sqrt2$ with $K_c^2 = (\\omega_{pe}^2/c^2)\\,v_{os}^2/2v_e^2$, $v_e^2 = (T_e + T_i/Z)/m_e$; $\\kappa_{\\max} = \\frac18(v_{os}/v_e)^2\\,\\omega_{pe}^2/k_0c^2$' },
    { id: 'B7-c6', front: 'Critical power for self-focusing, and why power rather than intensity', back: 'Ponderomotive $P_c \\approx 32\\,T^*_{\\rm keV}(n_c/n)$ MW; relativistic $\\approx 16(n_c/n)$ GW, larger by $m_ec^2/T^*$. Diffraction and self-refraction both scale as $1/w^2$, so the beam width cancels' },
  ],
}
