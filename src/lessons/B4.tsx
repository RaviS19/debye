import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { FocusSim } from '../sims/FocusSim'
import { SteepeningSim } from '../sims/SteepeningSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 21 }

/** The quiver energy as a potential hill: an electron set down on the slope of a focus rolls off and leaves with
 *  the height it started at. */
function HillDiagram() {
  const X = (r: number) => 236 + r * 100 // r in units of w
  const Y = (U: number) => 262 - U * 180
  const U = (r: number) => Math.exp(-2 * r * r)
  let hill = ''
  for (let r = -2.3; r <= 2.301; r += 0.04) hill += `${hill ? 'L' : 'M'}${X(r).toFixed(1)},${Y(U(r)).toFixed(1)} `
  const r0 = 0.6
  const ex = X(r0)
  const ey = Y(U(r0))
  // a short zigzag above the electron: its quiver
  let zig = ''
  for (let k = 0; k <= 8; k++) zig += `${k ? 'L' : 'M'}${(ex - 16 + 4 * k).toFixed(1)},${(ey - 20 + (k % 2 ? -6 : 6)).toFixed(1)} `
  const slope = -4 * r0 * U(r0) // dU/dr in units of the peak per w
  const ang = Math.atan2(-slope * 180, 100) // screen angle of the downhill direction
  const ax2 = ex + 64 * Math.cos(ang)
  const ay2 = ey + 64 * Math.sin(ang)
  const xr = 606 // the energy bar on the right
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 640 310" style={{ width: '100%', maxWidth: 660, display: 'block', margin: '0 auto' }} role="img" aria-label="The ponderomotive potential of a focus as a hill; an electron on its slope rolls off and leaves with the height it started at">
        <defs>
          <linearGradient id="b4-hill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="rgba(34,211,238,0.02)" />
            <stop offset="1" stopColor="rgba(34,211,238,0.35)" />
          </linearGradient>
          <marker id="b4-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#fbbf24" />
          </marker>
          <marker id="b4-arrm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#f472b6" />
          </marker>
        </defs>
        <path d={`${hill} L${X(2.3)},262 L${X(-2.3)},262 Z`} fill="url(#b4-hill)" />
        <path d={hill} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
        <line x1={X(-2.3)} y1={262} x2={xr + 14} y2={262} stroke="#314c72" strokeWidth={1.5} />
        <line x1={ex + 10} y1={ey} x2={xr} y2={ey} stroke="#f472b6" strokeWidth={1.5} strokeDasharray="6 5" />
        <line x1={xr} y1={262} x2={xr} y2={ey + 4} stroke="#f472b6" strokeWidth={2.2} markerEnd="url(#b4-arrm)" />
        <path d={zig} fill="none" stroke="#e8eaf6" strokeWidth={1.6} />
        <line x1={ex} y1={ey} x2={ax2} y2={ay2} stroke="#fbbf24" strokeWidth={2.5} markerEnd="url(#b4-arr)" />
        <circle cx={ex} cy={ey} r={7} fill="#fff" stroke="#f472b6" strokeWidth={2.5} />
        <text x={X(0)} y={Y(1) - 14} fill="#22d3ee" textAnchor="middle" style={svgText}>
          U_p(r) ∝ intensity
        </text>
        <text x={ex + 24} y={ey - 22} fill="#e8eaf6" style={svgText}>
          quiver
        </text>
        <text x={ax2 + 12} y={ay2 - 6} fill="#fbbf24" style={svgText}>
          −∇U_p
        </text>
        <text x={xr - 4} y={ey - 40} fill="#f472b6" textAnchor="end" style={svgText}>
          drift energy far away
        </text>
        <text x={xr - 4} y={ey - 14} fill="#f472b6" textAnchor="end" style={svgText}>
          = U_p(r₀)
        </text>
        <line x1={ex} y1={262} x2={ex} y2={270} stroke="#f472b6" strokeWidth={2} />
        <line x1={X(0)} y1={262} x2={X(0)} y2={270} stroke="#9aa0c9" strokeWidth={2} />
        <text x={X(0)} y={292} fill="#9aa0c9" textAnchor="middle" style={svgText}>
          r = 0
        </text>
        <text x={ex} y={292} fill="#f472b6" textAnchor="middle" style={svgText}>
          r₀
        </text>
      </svg>
      <figcaption className="small dim" style={{ textAlign: 'center' }}>
        The ponderomotive potential of a focal spot. An electron that starts at rest at r₀ rolls off the hill and keeps, as steady drift, the
        height it started at.
      </figcaption>
    </figure>
  )
}

export const B4: Lesson = {
  id: 'B4',
  title: 'Ponderomotive force',
  subtitle: 'Quiver energy as a potential: electrons pushed out of bright light, a₀ and U_p in laser units, light pressure and profile steepening',
  minutes: 55,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 6 (6.2 the ponderomotive force) and Ch. 10 (density profile modification; 10.2 steepening)',
    'Gibbon, Short Pulse Laser Interactions with Matter: the chapter on single electrons in intense fields (figure-of-eight orbits, the relativistic ponderomotive force)',
    'Eliezer, The Interaction of High-Power Lasers with Plasmas: the ponderomotive force and its effect on the density profile',
    'Chen, Introduction to Plasma Physics (3rd ed.), Ch. 8: the one-dimensional derivation recalled in A10',
  ],
  objectives: [
    'Convert intensity into field strength with the polarization stated: $a_0 = eE_0/(m_e\\omega c) \\approx 0.855\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}\\,\\text{W cm}^{-2}}$ (linear), and $U_p = e^2\\langle E^2\\rangle/(2m_e\\omega^2) \\approx 9.34\\times10^{-14}\\,I\\lambda^2$ eV',
    'Derive the ponderomotive force in three dimensions, including the magnetic force, and use energy conservation to predict the drift energy of an electron leaving a focus',
    'Explain how the force reaches the ions, why light pushes a reflecting plasma with $2I/c$, and how pressure balance $n = n_0e^{-U_p/kT}$ steepens the density profile at the critical surface',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'units', label: 'a₀ and U_p' },
    { id: 'derivation', label: 'In 3D' },
    { id: 'focus', label: 'A focal spot' },
    { id: 'validity', label: 'When it holds' },
    { id: 'plasma', label: 'Pushing plasma' },
    { id: 'pressure', label: 'Light pressure' },
    { id: 'steepening', label: 'Steepening' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          An electron in a light wave has no choice but to quiver, and its quiver carries kinetic energy. Averaged over a cycle that energy is
          U_p, the ponderomotive potential, and it is proportional to the local intensity. Now ask what it costs to move the electron into a
          brighter spot: it must quiver harder there, so something has to supply the extra quiver energy. The field does, by pushing back. The
          quiver energy acts exactly like a potential energy, and the force is minus its gradient.
        </p>
        <p>
          A focal spot is therefore a hill of potential energy for electrons, highest at the centre. An electron set down on the slope rolls
          off. If the light stays on while it leaves, it ends up with exactly the height it started at, now as steady drift: quiver energy turned
          into directed motion. A10 found the force for a field varying along one line; this lesson follows it into three dimensions, into laser
          units, and into the plasma, where the same push becomes the light’s pressure and reshapes the density near the critical surface.
        </p>
        <HillDiagram />
        <p>
          Two features stand out. The force depends on the square of the charge, so electrons and positrons are both pushed out of bright light.
          And it scales as 1/m, so for ions it is thousands of times weaker; the plasma moves anyway, because the electrons drag the ions with
          the electric field they leave behind.
        </p>
      </section>

      <section id="units">
        <h2>a₀ and U_p</h2>
        <p>
          Two numbers describe an electron in a laser field. The <strong>normalized amplitude</strong> a₀ is the peak quiver speed in units of c;
          it says whether the motion is relativistic. The <strong>ponderomotive potential</strong> U_p is the mean quiver kinetic energy; it sets
          the force. The polarization matters for a₀ but not for U_p at a given intensity, because U_p depends only on the mean square field
          ⟨E²⟩ = I/(ε₀c).
        </p>
        <Eq
          title="Quiver strength and quiver energy"
          src="\begin{gathered}\s{a0}{a_0} = \dfrac{\s{e}{e}\,\s{E0}{E_0}}{\s{m}{m_e}\,\s{w}{\omega}\,\s{c}{c}} \\ \s{Up}{U_p} = \dfrac{e^2\langle \s{E2}{E^2}\rangle}{2m_e\omega^2} = \dfrac{e^2\,\s{I}{I}}{2\varepsilon_0 c\,m_e\omega^2}\end{gathered}"
          plot="b4-a0"
          symbols={{
            a0: { name: 'a₀, normalized amplitude', note: 'a₀ = v_os/c. Practical units: a₀ ≈ 0.855 λ_µm √(I/10¹⁸ W cm⁻²) for linear polarization, 0.604 λ_µm √(I/10¹⁸) for circular (amplitude of each of the two components). a₀ = 1 at Iλ² = 1.37×10¹⁸ W cm⁻² µm² (linear).' },
            e: { name: 'e, elementary charge', units: 'C', note: 'Enters squared in U_p: the push is the same for either sign of charge.' },
            E0: { name: 'E₀, field amplitude', units: 'V/m', note: 'Peak field. Linear: I = ½ε₀cE₀². Circular: E₀ is the amplitude of each component, |E| = E₀ at all times and I = ε₀cE₀².' },
            m: { name: 'm_e, electron mass', units: 'kg', note: 'U_p ∝ 1/m: for a proton it is 1836 times smaller.' },
            w: { name: 'ω = 2πc/λ, laser frequency', units: 'rad/s', note: 'A slower field gives the electron more time to pick up speed each half cycle, so U_p ∝ 1/ω² ∝ λ².' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'a₀ ≥ 1 means the non-relativistic quiver would exceed c: the motion is then relativistic.' },
            Up: { name: 'U_p, ponderomotive potential', units: 'J (or eV)', note: 'U_p = ½m⟨v²⟩, the mean quiver kinetic energy. Practical units: U_p ≈ 9.34×10⁻¹⁴ I[W/cm²] λ²[µm²] eV for either polarization. Linear: U_p = m v_os²/4 = a₀² m c²/4.' },
            E2: { name: '⟨E²⟩, mean square field', units: 'V²/m²', note: 'Averaged over a period: E₀²/2 for linear, E₀² for circular polarization.' },
            I: { name: 'I, intensity', units: 'W/m² (practical: W/cm²)', note: 'I = ε₀c⟨E²⟩ for a single travelling wave.' },
          }}
          says="a₀ compares the quiver speed with c, U_p measures the quiver energy. At the same intensity, U_p grows as λ²: long-wavelength light shakes electrons much harder."
        />
        <p>
          Some numbers. Frequency-tripled light (0.351 µm) at 10¹⁵ W/cm² gives U_p ≈ 11.5 eV and a₀ ≈ 0.01: a small energy compared with a
          keV plasma, but not near the critical surface, where the field swells. The same intensity at 1.053 µm gives 104 eV, and CO₂ light
          (10.6 µm) reaches that already at 10¹³ W/cm². At Iλ² = 1.37×10¹⁸ W cm⁻² µm², a₀ = 1 and the formula would give U_p = mc²/4 ≈ 128 keV;
          by then the quiver is relativistic and the formula needs replacing (C1).
        </p>
        <Plotter spec={plotById('b4-a0')!} />
      </section>

      <section id="derivation">
        <h2>In three dimensions</h2>
        <p>
          A10’s derivation used a field pointing along the direction in which its amplitude varies. In a focus the amplitude also varies
          across the field direction, and then the electric force alone gets the answer wrong: the push sideways comes from the wave’s magnetic
          field. The calculation below keeps both, in complex notation so that it covers any polarization at once. Write the field as
          <M>{'\\mathbf E = {\\rm Re}[\\tilde{\\mathbf E}(\\mathbf r)e^{-i\\omega t}]'}</M> with a slowly varying complex amplitude, and the electron’s
          position as a slow part R plus a fast quiver r₁.
        </p>
        <Derivation
          lessonId="B4"
          id="ponderomotive-3d"
          title="The ponderomotive force with the magnetic force included"
          steps={[
            {
              text: 'First order: the electron (charge −e) quivers in the field evaluated at its slow position R.',
              math: '\\begin{gathered}\\tilde{\\mathbf v}_1 = -\\dfrac{ie}{m\\omega}\\tilde{\\mathbf E}(\\mathbf R) \\\\ \\tilde{\\mathbf r}_1 = \\dfrac{e}{m\\omega^2}\\tilde{\\mathbf E}(\\mathbf R)\\end{gathered}',
              why: 'm dv₁/dt = −eE with every quantity ∝ exp(−iωt), so −iωm ṽ₁ = −eẼ, and r̃₁ = ṽ₁/(−iω). The displacement is in phase with E: at the moment E points along +x the electron is at the +x end of its swing, being pulled back.',
            },
            {
              text: 'The magnetic field follows from Faraday’s law. A field whose amplitude varies across the beam must carry a magnetic field, whatever else is present.',
              math: '\\nabla\\times\\mathbf E = -\\dfrac{\\partial\\mathbf B}{\\partial t}\\;\\Rightarrow\\;\\tilde{\\mathbf B} = \\dfrac{\\nabla\\times\\tilde{\\mathbf E}}{i\\omega}',
              why: 'In a plane wave this is the familiar |B| = |E|/c. In a focus, or a standing wave at an antinode of E, the part that matters here comes from the transverse gradient of the amplitude.',
            },
            {
              text: 'Second order: the electron feels the field at its displaced position, and the magnetic force on its quiver velocity.',
              math: 'm\\dfrac{d\\mathbf v_2}{dt} = -e\\left[(\\mathbf r_1\\cdot\\nabla)\\mathbf E + \\mathbf v_1\\times\\mathbf B\\right]',
              why: 'Taylor-expand E(R + r₁) ≈ E(R) + (r₁·∇)E; the first term drives the quiver of step 1. v₁ and B are both first order in the field, so their product is second order, the same order as the expansion term.',
            },
            {
              text: 'Average over a period. For two oscillations Re[a exp(−iωt)] and Re[b exp(−iωt)], the mean of their product is ½ Re[a b*].',
              math: 'm\\ddot{\\mathbf R} = -\\dfrac{e^2}{2m\\omega^2}\\,{\\rm Re}\\!\\left[(\\tilde{\\mathbf E}\\cdot\\nabla)\\tilde{\\mathbf E}^* + \\tilde{\\mathbf E}\\times(\\nabla\\times\\tilde{\\mathbf E}^*)\\right]',
              why: 'Electric term: −e·½Re[(r̃₁·∇)Ẽ*] with r̃₁ = eẼ/(mω²). Magnetic term: ṽ₁ × B̃* = (−ieẼ/mω) × (∇×Ẽ*)/(−iω) = (e/mω²) Ẽ × (∇×Ẽ*). Both carry e²/(mω²).',
            },
            {
              text: 'The vector identity ∇(A·B) = (A·∇)B + (B·∇)A + A×(∇×B) + B×(∇×A), with A = Ẽ and B = Ẽ*, turns the bracket into a gradient.',
              math: 'm\\ddot{\\mathbf R} = -\\nabla U_p,\\qquad U_p = \\dfrac{e^2|\\tilde{\\mathbf E}|^2}{4m\\omega^2} = \\dfrac{e^2\\langle E^2\\rangle}{2m\\omega^2}',
              why: 'The identity gives ∇|Ẽ|² = 2Re[(Ẽ·∇)Ẽ* + Ẽ×(∇×Ẽ*)]. The magnetic term is exactly what makes the force a gradient. The electric term alone pushes only along the field direction for linear polarization, and gives half the push for circular.',
            },
            {
              text: 'A gradient force conserves energy. With an envelope that does not change in time, the slow motion keeps ½mṘ² + U_p constant: an electron that starts at rest at R₀ leaves the light with the drift energy U_p(R₀).',
              math: '\\tfrac12 m\\dot R_\\infty^2 = U_p(\\mathbf R_0),\\qquad U_p = \\tfrac12 m\\langle v_1^2\\rangle',
              why: 'U_p is a real kinetic energy, the quiver’s. As the electron leaves, its quiver dies away and that energy reappears as drift. If instead the pulse ends while the electron is still inside, the quiver energy goes back to the light, and the electron keeps only the drift it has gained so far.',
            },
          ]}
        />
        <Eq
          title="The ponderomotive force on an electron"
          src="\begin{gathered}\s{F}{\mathbf F_p} = -\nabla \s{Up}{U_p} \\ = -\dfrac{\s{e}{e}^2}{\s{m}{m_e}\s{w}{\omega}^2}\Big[\underbrace{\langle(\s{E}{\mathbf E}\cdot\nabla)\mathbf E\rangle}_{\text{electric}} \\ +\ \underbrace{\langle\mathbf E\times(\nabla\times\mathbf E)\rangle}_{\text{magnetic}}\Big]\end{gathered}"
          symbols={{
            F: { name: 'F_p, ponderomotive force', units: 'N', note: 'The force on the guiding centre of the quiver, averaged over a period. It points down the gradient of ⟨E²⟩.' },
            Up: { name: 'U_p, ponderomotive potential', units: 'J', note: 'e²⟨E²⟩/(2m_eω²), the mean quiver kinetic energy.' },
            e: { name: 'e, elementary charge', units: 'C', note: 'Squared: the force does not depend on the sign of the charge.' },
            m: { name: 'm_e, particle mass', units: 'kg', note: 'For an ion of charge Ze and mass M, replace e²/m_e by Z²e²/M.' },
            w: { name: 'ω, laser frequency', units: 'rad/s', note: 'The field must change slowly on the time scale 1/ω, so the cycle average is well defined.' },
            E: { name: 'E, real electric field', units: 'V/m', note: 'Averages ⟨ ⟩ are over one period. The two averaged terms add up to ½∇⟨E²⟩.' },
          }}
          says="The electric term pushes along the field, the magnetic term across it, and together they make a gradient: in a focus the electron is pushed straight down the intensity hill, whatever the polarization."
        />
      </section>

      <section id="focus">
        <h2>A focal spot</h2>
        <p>
          The simulation follows a cloud of electrons, initially at rest, in the focal plane of a laser spot with field amplitude
          ∝ exp(−r²/w²). The field is derived from a vector potential, so it carries exactly the magnetic field that Faraday’s law requires;
          it is the focal plane of two counter-propagating beams at an antinode of E, which removes the large magnetic field of a single
          travelling wave and leaves the push of the transverse gradient alone. Orbits are computed from the full Lorentz force with a
          fourth-order Runge–Kutta step, 32 per period, in units where lengths are c/ω = λ/2π and fields are a₀. Next to the exact
          period-averaged path (magenta), the amber line integrates the guiding-centre equation <M>{'m\\ddot{\\mathbf R} = -\\nabla U_p'}</M> alone.
        </p>
        <FocusSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The energy bookkeeping.</strong> With the defaults the tracer starts at w/2, where U_p is e<sup>−1/2</sup> = 61% of its
            central value. In the energy panel the drift energy (cyan) rises as U_p at the electron (violet) falls, and their sum (white) stays
            flat. The final drift energy is U_p(start) to within 0.1%.
          </li>
          <li>
            <strong>The quiver.</strong> The zoom shows the last two periods of the tracer’s motion with the slow drift removed: a line along E
            for linear polarization, a circle for circular. Its size matches eE(r̄)/mω² and shrinks as the electron leaves the beam.
          </li>
          <li>
            <strong>Switch the magnetic force off.</strong> With linear polarization, electrons then move only along E: the push across the
            field came entirely from v × B. With circular polarization they leave with only half of U_p. The orbits no longer follow the amber
            prediction, because without the magnetic force the push is not −∇U_p: for linear polarization it is not a gradient at all, and
            for circular polarization it is half of one.
          </li>
          <li>
            <strong>Break the approximation.</strong> Set a₀ = 0.25 and ωw/c = 10. The electron now leaves the spot within a few dozen periods and its
            excursion is a few percent of w; the agreement degrades to the percent level (circular polarization shows it most), as expected for an
            expansion in x_os/w and in 1/(ω × transit time).
          </li>
        </ul>
        <p>
          The cloud empties the centre of the spot within a few hundred periods. In a plasma this cannot go far: the expelled electrons leave the
          ions behind, and their electric field holds the electrons back, which is the subject of the next sections.
        </p>
      </section>

      <section id="validity">
        <h2>When it holds</h2>
        <p>
          The derivation is an expansion in small quantities, and each one has a physical meaning.
        </p>
        <ul>
          <li>
            <strong>Small excursion.</strong> The quiver amplitude x_os = eE₀/(mω²) = a₀λ/2π must be small compared with the scale of the
            intensity variation (spot size, density scale length, the λ/4 spacing of a standing wave). At 10¹⁶ W/cm² and 1.053 µm it is
            15 nm.
          </li>
          <li>
            <strong>Slow envelope.</strong> The intensity seen by the electron must change little in one period, through the pulse shape or the
            electron’s motion. Then the quiver follows adiabatically and the averaging is clean; that is why the simulation switches the light
            on over five periods.
          </li>
          <li>
            <strong>Non-relativistic quiver.</strong> a₀ ≪ 1. In a single travelling wave, the magnetic force also shakes the electron along the
            propagation direction at 2ω with amplitude <M>{'a_0^2/8'}</M> in units of c/ω, the start of the figure-of-eight orbit. For a₀ ≳ 1
            the electron’s mass grows during the cycle and U_p becomes <M>{'(\\bar\\gamma - 1)m_ec^2'}</M> with
            <M>{'\\bar\\gamma = \\sqrt{1 + a_0^2/2}'}</M> for linear polarization (C1).
          </li>
          <li>
            <strong>Rare collisions.</strong> A collision during the cycle randomizes the quiver velocity; that is collisional absorption (B2),
            and it is slow when ν_ei ≪ ω.
          </li>
        </ul>
      </section>

      <section id="plasma">
        <h2>From electrons to plasma</h2>
        <p>
          Multiply the force on one electron by the electron density and use <M>{'\\omega_{pe}^2 = ne^2/(\\varepsilon_0 m_e)'}</M>: the force per
          unit volume is <M>{'\\mathbf f = -(\\omega_{pe}^2/\\omega^2)\\nabla(\\varepsilon_0\\langle E^2\\rangle/2)'}</M>, the fluid form already met in
          A10, now with the three-dimensional justification. In Kruer’s Gaussian units ε₀⟨E²⟩/2 reads ⟨E²⟩/8π.
        </p>
        <p>
          This force acts on the electrons. The ion version is Z²m_e/M smaller (1/1836 for protons), yet the ions move too. As soon as the
          electrons are displaced, the charge separation sets up an electrostatic field that pulls the ions after them and holds the electrons
          back. On time scales longer than the ion response (a sound crossing time), the two balance: adding the electron and ion force balances,
          the electrostatic field cancels and only the pressures remain.
        </p>
        <Eq
          title="Pressure balance with the light"
          src="\s{n}{n} = \s{n0}{n_0}\,\exp\!\left[-\dfrac{\s{Up}{U_p}}{k(\s{Te}{T_e} + \s{Ti}{T_i}/\s{Z}{Z})}\right]"
          symbols={{
            n: { name: 'n, electron density with the light on', units: 'm⁻³', note: 'Quasineutral: the ion density is n/Z.' },
            n0: { name: 'n₀, density without the light', units: 'm⁻³', note: 'Whatever holds the plasma up without the light (a flow, a wall) is assumed unchanged.' },
            Up: { name: 'U_p, ponderomotive potential', units: 'J', note: 'Proportional to the local ⟨E²⟩, which itself depends on n near n_c, so the problem is nonlinear.' },
            Te: { name: 'T_e, electron temperature', units: 'K (or keV)', note: 'Isothermal: thermal conduction keeps T_e uniform across the small region involved.' },
            Ti: { name: 'T_i, ion temperature', units: 'K', note: 'The ions contribute their pressure n kT_i/Z.' },
            Z: { name: 'Z, ion charge state', note: 'Electron force balance −∇p_e − n∇U_p − enE_s = 0 plus ion force balance −∇p_i + ZenᵢE_s = 0 eliminates the charge-separation field E_s.' },
          }}
          says="The plasma behaves like a gas sitting in the potential U_p: where the light is bright, the density drops by the Boltzmann factor. With U_p comparable to kT, the light digs a hole."
        />
        <p>
          In a beam this makes a density channel, which acts as a lens and focuses the light further: self-focusing and filamentation (B7). At
          the critical surface, where the light is reflected and its field swells, it makes a step in the density.
        </p>
      </section>

      <section id="pressure">
        <h2>Light pressure</h2>
        <p>
          Add up the force density over a whole plasma that reflects the light at normal incidence, and a clean result appears: the total push
          is the momentum the light delivers, 2I/c for a perfect reflector. It does not depend on the density profile.
        </p>
        <Derivation
          lessonId="B4"
          id="light-pressure"
          title="The total ponderomotive push equals 2I/c"
          steps={[
            {
              text: 'Light at normal incidence makes a standing wave E(x) cos ωt along the gradient. With ε = 1 − ω_pe²/ω², the force density is',
              math: 'f = -(1-\\varepsilon)\\,\\dfrac{d}{dx}\\!\\left(\\dfrac{\\varepsilon_0E^2}{4}\\right)',
              why: 'ω_pe²/ω² = 1 − ε, and ⟨E²⟩ = E²/2 for a real standing-wave amplitude E(x).',
            },
            {
              text: 'Multiply the wave equation E″ + k₀²εE = 0 by E′.',
              math: '\\varepsilon\\,\\dfrac{d(E^2)}{dx} = -\\dfrac{1}{k_0^2}\\dfrac{d(E\'^2)}{dx}',
              why: 'E′E″ = ½(E′²)′ and EE′ = ½(E²)′. This is the only place the plasma enters, and it holds for any profile ε(x).',
            },
            {
              text: 'Substitute: the force density is minus the gradient of one quantity, the period-averaged electromagnetic pressure.',
              math: 'f = -\\dfrac{dT}{dx},\\qquad T = \\dfrac{\\varepsilon_0}{4}\\left(E^2 + \\dfrac{E\'^2}{k_0^2}\\right) = \\dfrac{\\varepsilon_0\\langle E^2\\rangle}{2} + \\dfrac{\\langle B^2\\rangle}{2\\mu_0}',
              why: 'Faraday’s law gives B = −(E′/ω) sin ωt, so ⟨B²⟩/2μ₀ = ε₀E′²/(4k₀²). T is the electric plus magnetic energy density, which for these fields is the momentum flux.',
            },
            {
              text: 'Integrate from the vacuum, where the standing wave of a perfect reflector is 2E₀ sin(k₀x + φ), to deep inside, where the field has died.',
              math: '\\int f\\,dx = T_{\\rm vac} = \\varepsilon_0E_0^2 = \\dfrac{2I}{c}',
              why: 'In the vacuum E² + E′²/k₀² = 4E₀² everywhere, so T is constant there, and I = ½ε₀cE₀². With reflectivity R the result is (1 + R)I/c: I/c for a perfect absorber.',
            },
          ]}
        />
        <Eq
          title="Light pressure against plasma pressure"
          src="\begin{gathered}\s{T}{T_{EM}} = \dfrac{\s{eps}{\varepsilon_0}\langle \s{E}{E^2}\rangle}{2} + \dfrac{\langle \s{B}{B^2}\rangle}{2\mu_0} \\ \xrightarrow{\ \text{vacuum}\ }\;(1+\s{R}{R})\,\dfrac{\s{I}{I}}{\s{c}{c}}\ \ \text{vs}\ \ \s{nc}{n_c}\,k\s{T2}{T}\end{gathered}"
          plot="b4-pressures"
          symbols={{
            T: { name: 'T_EM, electromagnetic pressure', units: 'Pa', note: 'The period-averaged momentum flux of the light along the gradient. It falls from the vacuum value to zero inside the plasma, and its drop is the push.' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: 'In Kruer’s Gaussian units ε₀⟨E²⟩/2 becomes ⟨E²⟩/8π.' },
            E: { name: '⟨E²⟩, mean square electric field', units: 'V²/m²', note: 'Largest at the last antinode before the reflection, where it is swollen by about 3.6∛(k₀L) over the incident wave (B1).' },
            B: { name: '⟨B²⟩, mean square magnetic field', units: 'T²', note: 'Largest at the nodes of E. In vacuum the electric and magnetic parts trade places but their sum is constant.' },
            R: { name: 'R, reflectivity', note: 'R = 1 for a perfect reflector (push 2I/c), R = 0 for a perfect absorber (I/c).' },
            I: { name: 'I, incident intensity', units: 'W/m²', note: 'At 10¹⁵ W/cm², I/c ≈ 0.33 Mbar (3.3×10¹⁰ Pa).' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'I/c is the momentum flux of the incident light.' },
            nc: { name: 'n_c, critical density', units: 'm⁻³', note: 'n_c ≈ 1.1×10²¹/λ²_µm cm⁻³: 1.0×10²¹ cm⁻³ at 1.053 µm.' },
            T2: { name: 'T, temperature', units: 'K (or keV)', note: 'In pressure balance the relevant temperature is T_e + T_i/Z.' },
          }}
          says="The ratio P = (I/c)/(n_c kT) measures how hard the light leans on the plasma at the critical surface; because the field swells there, even P ≈ 0.1 reshapes the profile."
        />
        <p>
          At 1.053 µm and k(T_e + T_i/Z) = 1 keV, n_c kT ≈ 1.6 Mbar, so P = 0.1 is reached at I ≈ 4.8×10¹⁴ W/cm². For 0.351 µm the critical
          density is nine times higher, and the same P needs about 4.3×10¹⁵ W/cm². Long wavelengths are pushed around far more easily.
        </p>
        <Plotter spec={plotById('b4-pressures')!} />
      </section>

      <section id="steepening">
        <h2>Steepening the profile</h2>
        <p>
          Put the two halves together at the critical surface. The light reflected from a density ramp makes a standing wave whose last
          antinode, just below n_c, is the brightest point (B1). The ponderomotive force pushes plasma out of it on both sides: down the ramp,
          lowering the density below n_c, and up the ramp, piling it up above. The light then reflects from a steeper profile, which changes the
          field, which changes the push. The simulation solves this self-consistently: the density is held in pressure balance with the light,
          <M>{'n = n_0\\exp(-U_p/kT)'}</M>, while the light is solved in the profile it creates. Kruer treats the same steepening in an expanding
          plasma, where the flow matters as well (Ch. 10); the static version here shows the mechanism in its simplest form.
        </p>
        <SteepeningSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>Turn up the light</strong> at L = 10 λ. By P = 0.1 the density below the step has fallen to about 0.69 n_c and above it has
            risen to 1.41 n_c, across a fraction of a wavelength. The local scale length at n_c drops from 10 λ to about 0.57 λ.
          </li>
          <li>
            <strong>The step’s height</strong> is set by the light pressure at the last antinode, which the plasma pressure must balance. The
            readout does the bookkeeping: the jump in n kT equals that light pressure, plus the small force that holds the original ramp up
            over the step. In the zoom, the white line (plasma plus light pressure) runs smoothly through the step.
          </li>
          <li>
            <strong>Change L.</strong> At P = 0.1 the step goes from about 0.7 to 1.4 n_c for every ramp from 5 λ to 20 λ: the swelling
            that would grow with L is undone by the steepening itself.
          </li>
          <li>
            <strong>The total push</strong> on the plasma, integrated over the whole profile, equals 2I/c to within about 0.1%: the momentum
            balance of the derivation above.
          </li>
        </ul>
        <p>
          A steepened profile changes the other absorption processes. Resonance absorption (B3) depends on τ = (k₀L)<sup>1/3</sup> sin θ with the local
          scale length at n_c, so a step 0.57 λ long moves its best angle from about 10° to much larger angles (formally 26°, although at
          k₀L ≈ 4 the Denisov curve is only a rough guide). Collisional absorption (B2), which is strongest in the near-critical plasma where
          the light slows down, loses much of that plasma: the light now turns at a sharp step instead of crawling up a long ramp.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          The ponderomotive force is the main way light reshapes a plasma, and it returns throughout Track B. Two light waves that beat together
          exert a ponderomotive force at their difference frequency, which can drive a density wave that scatters more light: the coupling of
          the parametric instabilities in B5, and of stimulated Brillouin scattering in B6. A beam that digs a density channel focuses itself and
          breaks into filaments (B7). In Track C, a₀ reaches and passes 1: the quiver becomes relativistic (C1), and the ponderomotive force of
          a short intense pulse blows out a bubble of electrons behind it, the engine of wakefield acceleration (C4).
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B4-p1',
      kind: 'numeric',
      concept: 'normalized-amplitude',
      prompt: 'A Ti:sapphire laser ($\\lambda = 0.8$ µm), linearly polarized, is focused to $I = 2\\times10^{17}$ W/cm². What is the normalized amplitude $a_0$?',
      answer: 0.306,
      tol: 0.02,
      unit: '',
      hints: ['$a_0 \\approx 0.855\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}\\,\\text{W cm}^{-2}}$ for linear polarization.'],
      solution: '$a_0 = 0.855\\times0.8\\times\\sqrt{0.2} = 0.306$. The peak quiver speed is $0.31c \\approx 9.2\\times10^7$ m/s, and $U_p = a_0^2m_ec^2/4 = 9.34\\times10^{-14}\\times2\\times10^{17}\\times0.64 \\approx 12$ keV. The non-relativistic formulas are still good to a few percent, but not for much longer.',
    },
    {
      id: 'B4-p2',
      kind: 'numeric',
      concept: 'ponderomotive-drift-energy',
      prompt: 'A laser focus has field amplitude $\\propto e^{-r^2/w^2}$ and ponderomotive potential 1 keV at its centre. An electron starts at rest at $r = w/2$ and the light stays on until it has left. With what kinetic energy does it leave, in eV?',
      answer: 606.5,
      tol: 0.03,
      unit: 'eV',
      hints: ['$U_p \\propto E^2 \\propto e^{-2r^2/w^2}$.', 'Drift energy plus $U_p$ is conserved along the slow motion.'],
      solution: '$U_p(w/2) = 1\\,\\text{keV}\\times e^{-2\\times1/4} = e^{-1/2}$ keV $= 607$ eV. Energy conservation for the guiding centre, $\\tfrac12 m\\dot R^2 + U_p(R) = $ const, gives a final drift energy equal to $U_p$ at the start: 607 eV. The focal-spot simulation reproduces this to 0.1%.',
    },
    {
      id: 'B4-p3',
      kind: 'numeric',
      concept: 'light-pressure',
      prompt: 'Light at 1.053 µm ($n_c = 1.005\\times10^{21}$ cm⁻³) with $I = 10^{15}$ W/cm² is reflected near the critical surface of a plasma with $k(T_e + T_i/Z) = 1$ keV. What is the pressure ratio $P = (I/c)/(n_ckT)$?',
      answer: 0.207,
      tol: 0.03,
      unit: '',
      hints: ['Convert to SI: $I = 10^{19}$ W/m², $n_c = 1.005\\times10^{27}$ m⁻³, $kT = 1.602\\times10^{-16}$ J.'],
      solution: '$I/c = 10^{19}/2.998\\times10^8 = 3.34\\times10^{10}$ Pa (0.33 Mbar). $n_ckT = 1.005\\times10^{27}\\times1.602\\times10^{-16} = 1.61\\times10^{11}$ Pa (1.6 Mbar). $P = 0.207$. Because the field swells near $n_c$, this is enough for a strong step: in the steepening simulation, P = 0.2 makes the density jump from about 0.53 to 1.69 $n_c$.',
    },
    {
      id: 'B4-p4',
      kind: 'numeric',
      concept: 'quiver-excursion',
      prompt: 'How far does an electron swing (amplitude $x_{os} = eE_0/m_e\\omega^2$) in linearly polarized 1.053 µm light at $10^{16}$ W/cm²? Give the answer in nm.',
      answer: 15.1,
      tol: 0.03,
      unit: 'nm',
      hints: ['$x_{os} = a_0\\,c/\\omega = a_0\\lambda/2\\pi$.', '$a_0 = 0.855\\times1.053\\times\\sqrt{0.01} = 0.090$.'],
      solution: '$a_0 = 0.0900$, so $x_{os} = 0.0900\\times1.053\\,\\mu\\text{m}/2\\pi = 0.0151$ µm $= 15.1$ nm. That is far smaller than a focal spot of several µm, or the quarter-wavelength spacing of a standing wave (0.26 µm): the expansion behind the ponderomotive force is excellent here.',
    },
    {
      id: 'B4-p5',
      kind: 'mcq',
      concept: 'ponderomotive-magnetic-force',
      prompt: 'In a linearly polarized focus with E along x, an electron starts on the y axis, where the intensity falls off along y. What pushes it outward along y?',
      options: [
        'The electric force: the field is weaker on the outer side of its swing',
        'The magnetic force $-e\\mathbf v\\times\\mathbf B$ on its quiver velocity, with B the field that Faraday’s law requires of a field varying across the beam',
        'Nothing: the electron only moves along the field direction',
        'Radiation pressure along the beam axis',
      ],
      correct: 1,
      hints: ['The electron quivers along x. Does the electric field change along x where it sits?'],
      solution: 'The electron quivers along x, and along x the field is at its maximum on the y axis, so the electric term $(\\mathbf r_1\\cdot\\nabla)\\mathbf E$ gives nothing. The amplitude varies along y, so $\\nabla\\times\\mathbf E$ has a z component and the wave carries $B_z$; the force $-e\\mathbf v_1\\times\\mathbf B$ then points along y and averages to $-\\partial U_p/\\partial y$. In the simulation, switch v × B off and start the tracer at 90°: it gets no push along y at all.',
    },
    {
      id: 'B4-p6',
      kind: 'mcq',
      concept: 'ponderomotive-ions',
      prompt: 'The ponderomotive force on a proton is 1836 times smaller than on an electron. How does the plasma as a whole get pushed out of an intense beam?',
      options: [
        'It does not: only the electrons leave, and a positive ion column remains indefinitely',
        'The ions are pushed directly with the same force as the electrons, since the force depends on $q^2$',
        'The electrons are pushed first; the charge separation creates an electric field that pulls the ions along, and in steady state the plasma pressure balances the force on the electrons',
        'The light’s momentum is absorbed by the ions through collisions with photons',
      ],
      correct: 2,
      hints: ['What happens to quasineutrality when the electrons move and the ions do not?'],
      solution: 'A tiny charge separation produces a large electrostatic field, which holds the electrons back and pulls the ions forward. Adding the two force balances eliminates that field: $\\nabla(p_e + p_i) = -n\\nabla U_p$, so in steady state $n = n_0e^{-U_p/k(T_e + T_i/Z)}$. The ions follow on the ion-acoustic time scale.',
    },
  ],
  cards: [
    { id: 'B4-c1', front: 'Normalized amplitude $a_0$ in practical units, by polarization', back: '$a_0 = eE_0/(m_e\\omega c) \\approx 0.855\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}\\,\\text{W cm}^{-2}}$ (linear), $0.604\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}}$ per component (circular); $a_0 = 1$ at $I\\lambda^2 = 1.37\\times10^{18}$ (linear)' },
    { id: 'B4-c2', front: 'Ponderomotive potential $U_p$, three ways', back: '$U_p = e^2\\langle E^2\\rangle/(2m_e\\omega^2) = \\tfrac12m_e\\langle v^2\\rangle \\approx 9.34\\times10^{-14}\\,I\\lambda^2$ eV (W/cm², µm), for either polarization at fixed intensity. Linear: $m_ev_{os}^2/4$' },
    { id: 'B4-c3', front: 'Ponderomotive force in three dimensions: which terms?', back: '$\\mathbf F_p = -(e^2/m_e\\omega^2)\\langle(\\mathbf E\\cdot\\nabla)\\mathbf E + \\mathbf E\\times(\\nabla\\times\\mathbf E)\\rangle = -\\nabla U_p$. The magnetic term pushes across the field direction and makes the force a gradient' },
    { id: 'B4-c4', front: 'Drift energy of an electron that leaves a steady focus from rest at $\\mathbf R_0$', back: '$\\tfrac12m\\dot R_\\infty^2 = U_p(\\mathbf R_0)$: quiver energy turned into drift, since $\\tfrac12m\\dot R^2 + U_p$ is conserved' },
    { id: 'B4-c5', front: 'Total ponderomotive push of light on a plasma at normal incidence', back: '$(1 + R)I/c$: $2I/c$ for a perfect reflector, $I/c$ for a perfect absorber, independent of the profile. $I/c \\approx 0.33$ Mbar at $10^{15}$ W/cm²' },
    { id: 'B4-c6', front: 'Ponderomotive profile steepening: the pressure balance', back: '$n = n_0e^{-U_p/k(T_e + T_i/Z)}$ with the light solved in that profile; already at $P = (I/c)/(n_ckT) \\approx 0.02$ the scale length at $n_c$ shrinks several-fold, because the field swells there; by $P \\approx 0.1$ the density jumps across $n_c$ in a fraction of λ' },
  ],
}
