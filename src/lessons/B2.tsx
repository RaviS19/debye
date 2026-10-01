import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { AbsorptionRampSim } from '../sims/AbsorptionRampSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram: quiver, collide, heat ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 21 }

function QuiverDiagram() {
  // three panels: an electron quivering in the laser field, a collision with an ion, random (thermal) motion after
  let wiggle = ''
  for (let k = 0; k <= 120; k++) {
    const x = 30 + k * 1.2
    wiggle += `${k === 0 ? 'M' : 'L'}${(100 + 38 * Math.sin((k / 120) * 4 * Math.PI)).toFixed(1)},${(40 + x).toFixed(1)} `
  }
  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, w = 2.5) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const h = 9
    return (
      <g stroke={color} fill={color} strokeWidth={w}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <path d={`M${x2},${y2} L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)} Z`} stroke="none" />
      </g>
    )
  }
  const rnd = [
    [0.3, 34],
    [1.5, 22],
    [2.4, 40],
    [3.4, 28],
    [4.3, 36],
    [5.3, 24],
  ]
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 600 250" style={{ width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' }} role="img" aria-label="An electron quivering in the laser field, colliding with an ion, and ending up with random thermal motion">
        {/* panel 1: quiver */}
        {arrow(40, 220, 160, 220, '#f472b6')}
        <text x={30} y={244} fill="#f472b6" style={{ ...svgText, fontSize: 18 }}>laser field E cos ωt</text>
        <path d={wiggle} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
        <circle cx={100} cy={70} r={7} fill="#22d3ee" />
        {arrow(70, 40, 130, 40, '#22d3ee', 2)}
        {arrow(130, 40, 70, 40, '#22d3ee', 2)}
        <text x={100} y={24} fill="#e8eaf6" style={svgText} textAnchor="middle">1 · quiver</text>
        {/* panel 2: collision */}
        <circle cx={300} cy={120} r={13} fill="rgba(251,191,36,0.25)" stroke="#fbbf24" strokeWidth={2} />
        <text x={300} y={126} fill="#fbbf24" style={{ ...svgText, fontSize: 18 }} textAnchor="middle">+</text>
        <path d="M230,70 C270,85 285,95 290,108 C295,122 285,140 250,185" fill="none" stroke="#22d3ee" strokeWidth={2.5} />
        <circle cx={250} cy={185} r={7} fill="#22d3ee" />
        {arrow(226, 66, 232, 70, '#22d3ee', 2)}
        <text x={300} y={24} fill="#e8eaf6" style={svgText} textAnchor="middle">2 · collision</text>
        <text x={322} y={160} fill="#fbbf24" style={{ ...svgText, fontSize: 18 }}>ion, Ze</text>
        {/* panel 3: heat */}
        <circle cx={500} cy={120} r={7} fill="#22d3ee" />
        {rnd.map(([a, r], i) => (
          <g key={i}>{arrow(500, 120, 500 + r * 1.6 * Math.cos(a), 120 + r * 1.6 * Math.sin(a), 'rgba(34,211,238,0.75)', 2)}</g>
        ))}
        <text x={500} y={24} fill="#e8eaf6" style={svgText} textAnchor="middle">3 · heat</text>
        {arrow(178, 120, 222, 120, '#9aa0c9', 2)}
        {arrow(378, 120, 422, 120, '#9aa0c9', 2)}
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        In the laser field an electron oscillates back and forth at ω, in step with all its neighbours: ordered motion that gives its energy
        back to the wave every half cycle. A close pass by an ion turns the electron’s velocity in a random direction. The phase relation with
        the wave is lost, the quiver energy becomes random thermal energy, and the wave has to supply a fresh quiver. That is inverse
        bremsstrahlung: in a collision the electron absorbs a photon instead of emitting one.
      </figcaption>
    </figure>
  )
}

export const B2: Lesson = {
  id: 'B2',
  title: 'Collisional absorption',
  subtitle: 'Inverse bremsstrahlung: the damping of light by electron–ion collisions, and how much of a laser a density ramp absorbs',
  minutes: 55,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 5 (collisional absorption of electromagnetic waves: the damping rate, absorption in a density ramp, oblique incidence) and Sec. 13.7 (wavelength scaling)',
    'A. B. Langdon, Nonlinear inverse bremsstrahlung and heated-electron distributions, Phys. Rev. Lett. 44, 575 (1980)',
    'J. P. Matte et al., Non-Maxwellian electron distributions and continuum X-ray emission in inverse bremsstrahlung heated plasmas, Plasma Phys. Control. Fusion 30, 1665 (1988)',
    'NRL Plasma Formulary (Coulomb logarithm, collision rates), as in A7',
  ],
  objectives: [
    'Add electron–ion friction to the cold-plasma response, get $\\varepsilon = 1 - \\omega_{pe}^2/\\omega(\\omega + i\\nu_{ei})$, and derive the temporal and spatial damping rates of light',
    'Evaluate $\\nu_{ei}$ in SI and practical units and derive the absorbed fraction $1 - \\exp(-32\\nu_cL/15c)$ of a linear ramp, with its $\\cos^5\\theta$ and exponential-ramp variants',
    'Explain why absorption is concentrated near $n_c$, why it improves at short wavelength and low temperature, and why it drops at high intensity (the Langdon effect)',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'damping', label: 'Damping rates' },
    { id: 'collisions', label: 'Collision frequency' },
    { id: 'ramp', label: 'Absorption in a ramp' },
    { id: 'scaling', label: 'Wavelength' },
    { id: 'intense', label: 'High intensity' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          In B1 the plasma was a perfect mirror: everything that went up the ramp came back down. The electrons quiver in the laser field, but
          the quiver is <em>reversible</em>. An electron takes energy from the wave during one quarter cycle and hands it back in the next,
          exactly as a mass on a spring does. Something has to break that rhythm for the plasma to keep any of the energy.
        </p>
        <QuiverDiagram />
        <p>
          Collisions with ions do it. Each close encounter knocks the electron off its oscillation, and the energy of the quiver ends up as
          random thermal motion. The heating rate per unit volume is <M>{'n_e\\nu_{ei}m_ev_{os}^2/2'}</M>: roughly, every collision cashes in the
          quiver energy of the electron that suffers it. This is <strong>inverse bremsstrahlung</strong>, the main way long-pulse lasers heat
          the coronas of fusion targets.
        </p>
        <p>
          Two things from B1 decide where the energy goes. The collision rate is proportional to the density, so it is largest near n_c. And
          the light slows down near its turning point (v_g = cη), so it spends a long time there. Both effects pile the absorption into the last
          stretch before the turning point. In a linear ramp, nearly three quarters of the optical depth lies above 0.8 n_c.
        </p>
      </section>

      <section id="damping">
        <h2>Collisions in the dielectric function</h2>
        <p>
          The simplest model of collisions is a friction force on the electron fluid, <M>{'-m_e\\nu_{ei}\\mathbf{v}'}</M>: on average, each
          collision destroys the electron’s ordered momentum. (A7 used the same model for resistivity.) Putting it into the response of the
          electrons gives a permittivity with an imaginary part, and an imaginary part means damping.
        </p>
        <Eq
          title="Permittivity of a collisional plasma"
          src="\begin{gathered}\s{eps}{\varepsilon}(\omega) = 1 - \dfrac{\s{wp}{\omega_{pe}^2}}{\s{w}{\omega}(\omega + i\s{nu}{\nu_{ei}})} \\ \approx 1 - \dfrac{\s{n}{n_e}}{\s{nc}{n_c}} + i\,\dfrac{\nu_{ei}}{\omega}\dfrac{n_e}{n_c}\end{gathered}"
          symbols={{
            eps: { name: 'ε(ω), relative permittivity', note: 'For fields varying as e^(−iωt). Its real part sets the wavelength (η² in B1); a positive imaginary part means the medium takes energy from the wave.' },
            wp: { name: 'ω_pe², plasma frequency squared', units: 'rad²/s²', note: 'n_e e²/(ε₀m_e). ω_pe²/ω² = n_e/n_c.' },
            w: { name: 'ω, laser frequency', units: 'rad/s', note: 'About 1.8×10¹⁵ rad/s at 1053 nm and 5.4×10¹⁵ rad/s at 351 nm.' },
            nu: { name: 'ν_ei, electron–ion collision frequency', units: 's⁻¹', note: 'The rate at which collisions destroy an electron’s ordered momentum. In laser coronas ν_ei/ω is 10⁻⁴ to 10⁻², so the approximate form on the right is excellent.' },
            n: { name: 'n_e, electron density', units: 'cm⁻³', note: 'Varies along the ramp.' },
            nc: { name: 'n_c, critical density', units: 'cm⁻³', note: '1.1×10²¹/λ_µm² cm⁻³ (B1).' },
          }}
          says="Collisions add a small imaginary part to ε, proportional to ν_ei/ω and to n_e/n_c. Light is damped most where the plasma is dense, and the damping is weak per wavelength (ν ≪ ω) but adds up over a long ramp."
        />
        <Derivation
          lessonId="B2"
          id="damping"
          title="From friction to the damping rates of light"
          steps={[
            { text: 'The electron fluid in the laser field, with friction, for fields varying as e^(−iωt):', math: '\\begin{gathered}-i\\omega m_e\\mathbf{v} = -e\\mathbf{E} - m_e\\nu_{ei}\\mathbf{v} \\\\ \\Rightarrow\\; \\mathbf{v} = \\dfrac{-ie\\mathbf{E}}{m_e(\\omega + i\\nu_{ei})}\\end{gathered}', why: 'The ions are too heavy to follow the light. Without ν this is the quiver velocity v_os = eE/m_eω of B1, 90° out of phase with E, which is why it does no net work.' },
            { text: 'The current is j = −n_e e v, and Maxwell’s equations combine the vacuum and electron currents into one permittivity.', math: '\\begin{gathered}\\sigma = \\dfrac{i n_e e^2}{m_e(\\omega + i\\nu_{ei})} \\\\ \\varepsilon = 1 + \\dfrac{i\\sigma}{\\varepsilon_0\\omega} \\\\ = 1 - \\dfrac{\\omega_{pe}^2}{\\omega(\\omega + i\\nu_{ei})}\\end{gathered}', why: 'Same steps as A6, with ω replaced by ω + iν in the electron response. The friction gives j a part in phase with E, and only that part, ½Re(j·E*), absorbs energy.' },
            { text: 'Expand for ν_ei ≪ ω. The imaginary part is small.', math: '\\varepsilon \\approx 1 - \\dfrac{\\omega_{pe}^2}{\\omega^2} + i\\,\\dfrac{\\nu_{ei}}{\\omega}\\,\\dfrac{\\omega_{pe}^2}{\\omega^2}', why: '1/(ω + iν) ≈ (1 − iν/ω)/ω. The real part is B1’s η²; the correction to it is of order (ν/ω)², negligible.' },
            { text: 'Temporal damping: take a uniform plasma and real k. The dispersion relation ω²ε(ω) = c²k² gives a complex ω.', math: '\\begin{gathered}\\omega^2 \\approx \\omega_{pe}^2 + c^2k^2 - i\\nu_{ei}\\dfrac{\\omega_{pe}^2}{\\omega} \\\\ \\Rightarrow\\; \\mathrm{Im}\\,\\omega = -\\dfrac{\\nu_{ei}}{2}\\dfrac{\\omega_{pe}^2}{\\omega^2}\\end{gathered}', why: 'Write ω = ω_r + δω with ω_r² = ω_pe² + c²k²; then 2ω_r δω = −iνω_pe²/ω. The amplitude decays at half the energy rate.' },
            { text: 'So the energy of the light decays at', math: '\\nu_{ib} = \\nu_{ei}\\,\\dfrac{n_e}{n_c}', why: 'Physically: only the electrons carry quiver energy, and their share of the wave energy is ω_pe²/ω² = n_e/n_c. Collisions remove that share at the rate ν_ei.' },
            { text: 'Spatial damping: a steady beam has real ω, and its energy flux travels at v_g = cη. Energy lost per unit time divided by speed gives the loss per unit length.', math: '\\kappa_{ib} = \\dfrac{\\nu_{ib}}{v_g} = \\dfrac{\\nu_{ei}}{c}\\,\\dfrac{n_e/n_c}{\\sqrt{1 - n_e/n_c}}', why: 'The same result comes from k = (ω/c)√ε: 2 Im k = (ω/c) Im ε/√(Re ε). The 1/η factor is B1’s slowing down: near n_c the light lingers and is absorbed hard.' },
          ]}
        />
        <Eq
          title="Damping rates of light (energy)"
          src="\begin{gathered}\s{nib}{\nu_{ib}} = \s{nu}{\nu_{ei}}\,\dfrac{\s{n}{n_e}}{\s{nc}{n_c}} \\ \s{k}{\kappa_{ib}} = \dfrac{\nu_{ei}}{\s{c}{c}}\,\dfrac{n_e/n_c}{\sqrt{1 - n_e/n_c}}\end{gathered}"
          symbols={{
            nib: { name: 'ν_ib, temporal energy damping rate', units: 's⁻¹', note: 'How fast the light energy in a uniform plasma decays. Always smaller than ν_ei, by the electrons’ share n_e/n_c of the wave energy.' },
            nu: { name: 'ν_ei, electron–ion collision frequency', units: 's⁻¹', note: 'Itself proportional to n_e, so ν_ib ∝ n_e².' },
            n: { name: 'n_e, electron density', units: 'cm⁻³', note: 'Local density on the ramp.' },
            nc: { name: 'n_c, critical density', units: 'cm⁻³', note: 'n_e/n_c is the electrons’ share of the wave energy.' },
            k: { name: 'κ_ib, spatial energy damping rate', units: 'm⁻¹', note: 'The intensity of a beam falls as exp(−∫κ_ib ds) along its path. It diverges, integrably, at n_c.' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'cη is the group velocity; ν_ei/c is the damping per unit length a wave at speed c would see.' },
          }}
          says="Per unit length, light is absorbed in proportion to ν_ei (∝ n_e), to the electrons’ share n_e/n_c, and to the time it spends there, 1/v_g. All three grow toward the critical density."
        />
      </section>

      <section id="collisions">
        <h2>How often electrons hit ions</h2>
        <p>
          The friction coefficient is the electron–ion collision frequency of A7: the rate at which small-angle Coulomb deflections add up to
          turning an electron’s momentum around. Slow electrons are deflected much more easily than fast ones (the cross-section falls as
          1/v⁴), so ν_ei falls steeply with temperature.
        </p>
        <Eq
          title="Electron–ion collision frequency"
          src="\begin{gathered}\s{nu}{\nu_{ei}} = \dfrac{4\sqrt{2\pi}\,\s{Z}{Z}\,\s{e}{e}^4\,\s{n}{n_e}\,\s{lnL}{\ln\Lambda}}{3\,(4\pi\s{eps}{\varepsilon_0})^2\sqrt{\s{m}{m_e}}\,(k\s{T}{T_e})^{3/2}} \\ \approx 2.91\times10^{-6}\,\dfrac{Z\,n_e[\text{cm}^{-3}]\,\ln\Lambda}{T_{eV}^{3/2}}\ \text{s}^{-1}\end{gathered}"
          plot="b2-collision-frequency"
          symbols={{
            nu: { name: 'ν_ei, electron–ion collision frequency', units: 's⁻¹', note: 'Kruer’s definition, the same as 1/τ_e of Braginskii in A7 (for Z = 1). In Gaussian units drop the (4πε₀)².' },
            Z: { name: 'Z, ion charge state', note: 'For a mixture use Z_eff = ⟨Z²⟩/⟨Z⟩, since ν ∝ Σ n_i Z_i² = n_e⟨Z²⟩/⟨Z⟩. For fully ionized CH plastic that is 18.5/3.5 = 5.3, not 3.5.' },
            e: { name: 'e, elementary charge', units: 'C', note: 'Enters as e⁴: two charges in the Coulomb force, squared because the cross-section goes as the force squared.' },
            n: { name: 'n_e, electron density', units: 'm⁻³ (SI form) or cm⁻³ (practical form)', note: 'At the critical density of 351 nm light, 9.05×10²¹ cm⁻³.' },
            lnL: { name: 'lnΛ, Coulomb logarithm', note: 'The log of the ratio of the largest to smallest impact parameters. About 6–8 in laser coronas, much smaller than in tokamaks (15–20) because the plasma is so dense. This app uses the NRL formula, as in A7.' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: 'Each e² of the Gaussian formula becomes e²/4πε₀ in SI.' },
            m: { name: 'm_e, electron mass', units: 'kg', note: 'Light electrons are deflected easily; ions barely move and act as fixed scatterers.' },
            T: { name: 'T_e, electron temperature', units: 'eV (practical form)', note: 'kT_e in joules in the SI form. Coronas run at 1–5 keV.' },
          }}
          says="ν_ei ∝ Z n_e lnΛ / T_e^(3/2). At the critical density of 351 nm light, with Z = 5 and T_e = 3 keV (lnΛ = 6.7), it is 5.4×10¹² s⁻¹: a thousandth of the laser frequency."
        />
        <p>
          Because ν_ei ∝ n_e, the collision rate at the turning point is set by n_c, and so by the wavelength: ν_c ≡ ν_ei(n_c) ∝ 1/λ². The plot
          shows ν_c against temperature for a few materials, next to one thousandth of the laser frequency. Even for gold, ν_c/ω stays below a
          few percent above a keV, so the light is always weakly damped per cycle, and all of the absorption comes from adding up many
          wavelengths of path.
        </p>
        <Plotter spec={plotById('b2-collision-frequency')!} />
      </section>

      <section id="ramp">
        <h2>Absorption in a density ramp</h2>
        <p>
          Now send the light up a ramp, as in B1, with ν_ei = ν_c n_e/n_c (temperature, Z and lnΛ held fixed along the ramp). WKB says the
          intensity falls as exp(−∫κ_ib dx) on the way in, and again on the way out. Whatever is not absorbed comes back as reflected light.
        </p>
        <Derivation
          lessonId="B2"
          id="ramp"
          title="How much a linear ramp absorbs"
          steps={[
            { text: 'The light goes up to the turning point x_t and back. Each leg attenuates the energy flux by the same factor.', math: '\\begin{gathered}A = 1 - |r|^2 \\\\ = 1 - \\exp\\!\\Big(-2\\int_0^{x_t}\\kappa_{ib}\\,dx\\Big)\\end{gathered}', why: 'WKB keeps the incoming and outgoing waves separate, each with its own flux. The Airy layer at the turning point is only δ = (c²L/ω²)^(1/3) thick, too thin to change the integral, as long as ν_c ≪ ω.' },
            { text: 'With ν_ei = ν_c n_e/n_c the damping rate depends on density alone.', math: '\\kappa_{ib} = \\dfrac{\\nu_c}{c}\\,\\dfrac{(n_e/n_c)^2}{\\sqrt{1 - n_e/n_c}}', why: 'One factor n_e/n_c from ν_ei ∝ n_e and one from the electrons’ share of the wave energy.' },
            { text: 'In the linear ramp n_e/n_c = x/L, put u = x/L. The light turns at u = 1.', math: '2\\int_0^L\\kappa_{ib}\\,dx = \\dfrac{2\\nu_cL}{c}\\int_0^1\\dfrac{u^2\\,du}{\\sqrt{1-u}}', why: 'Everything about the plasma is now in one number, ν_cL/c: the collision rate at n_c times the light-crossing time of the ramp.' },
            { text: 'The integral is finite even though κ_ib diverges at n_c. With s = 1 − u:', math: '\\begin{gathered}\\int_0^1\\dfrac{(1-s)^2}{\\sqrt{s}}\\,ds \\\\ = 2 - \\dfrac43 + \\dfrac25 = \\dfrac{16}{15} \\\\ \\Rightarrow\\; A = 1 - \\exp\\!\\Big(-\\dfrac{32}{15}\\dfrac{\\nu_cL}{c}\\Big)\\end{gathered}', why: 'The integrand is largest near u = 1: 73% of it comes from u > 0.8 and 95% from u > 0.5. Most of the absorption happens in the densest fifth of the ramp.' },
            { text: 'Oblique s-polarized light turns at u = cos²θ and moves along the gradient at c√(cos²θ − u). The energy decays at ν_ib = ν_c u² per unit time.', math: '\\begin{gathered}2\\int\\dfrac{\\nu_cu^2\\,dx}{c\\sqrt{\\cos^2\\theta - u}} \\\\ = \\dfrac{2\\nu_cL}{c}\\cos^5\\theta\\int_0^1\\dfrac{s^2\\,ds}{\\sqrt{1-s}} \\\\ = \\dfrac{32}{15}\\dfrac{\\nu_cL}{c}\\cos^5\\theta\\end{gathered}', why: 'Substitute u = s cos²θ: u² gives cos⁴θ, du gives cos²θ, and the square root gives 1/cos θ. Oblique light turns in less dense, less collisional plasma, so it is absorbed less.' },
            { text: 'For an exponential profile n_e = n_c e^(x/L), dx = L du/u, so one power of u cancels.', math: 'A = 1 - \\exp\\!\\Big(-\\dfrac{8}{3}\\dfrac{\\nu_cL}{c}\\cos^3\\theta\\Big)', why: '2∫₀¹ s/√(1 − s) ds = 2 × 4/3 = 8/3, and the substitution now gives cos³θ. Here L is the local scale length n_e/(dn_e/dx) at n_c, which is what hydrodynamic codes and experiments usually quote.' },
          ]}
        />
        <Eq
          title="Collisional absorption in a ramp"
          src="\begin{gathered}\text{linear ramp:} \\ \s{A}{A} = 1 - \exp\!\Big(-\dfrac{32}{15}\,\dfrac{\s{nuc}{\nu_c}\s{L}{L}}{c}\cos^5\s{th}{\theta}\Big) \\ \text{exponential ramp:} \\ A = 1 - \exp\!\Big(-\dfrac{8}{3}\,\dfrac{\nu_cL}{c}\cos^3\theta\Big)\end{gathered}"
          plot="b2-absorption-vs-scale-length"
          symbols={{
            A: { name: 'A, absorbed fraction', note: '1 − |r|², the fraction of the incident power that stays in the plasma as heat. The rest is reflected.' },
            nuc: { name: 'ν_c, collision frequency at the critical density', units: 's⁻¹', note: 'ν_ei evaluated at n_c, with T_e, Z and lnΛ of the corona. Assumed ≪ ω.' },
            L: { name: 'L, density scale length', units: 'µm', note: 'Linear ramp: distance from the plasma edge to n_c. Exponential: n_e/(dn_e/dx). ν_cL/c ≈ 3.4×10⁻⁴ Z lnΛ L_µm/(λ_µm² T_keV^(3/2)).' },
            th: { name: 'θ, angle of incidence (s-polarized)', note: 'Oblique light turns early at n_c cos²θ and is absorbed less. p-polarized light also has resonance absorption (B3).' },
          }}
          says="The whole plasma enters through one number, ν_cL/c. When it is above about 1 the ramp absorbs nearly everything; when it is small the absorption is 2.1ν_cL/c. Long, cool, high-Z, short-wavelength plasmas absorb best."
        />
        <p>
          The simulation does not use the formula. It solves the full wave equation E″ + k₀²(ε − sin²θ)E = 0 with the collisional ε through the
          whole ramp and the Airy layer, splits the field in vacuum into an incident and a reflected wave, and measures 1 − |r|². It also adds up
          the local heating rate k₀ Im ε |E|² over the ramp, which must give the same number by energy conservation. Watch where the amber
          heating profile sits: just in front of the turning point, in the standing-wave peaks where |E|² is swelled.
        </p>
        <AbsorptionRampSim />
        <p>
          Some things to try. At 1053 nm with the default plasma, ν_cL/c = 0.40 and the ramp absorbs 58%; switch to 351 nm and it absorbs 99.9%.
          Double T_e and the absorption length grows by 2^(3/2) = 2.8. Tilt the beam: at 40° the absorption exponent of a linear ramp is multiplied by
          cos⁵40° = 0.26. Over the whole slider range the full wave and the formula agree within 3%, and usually within a fraction of a percent. The
          largest differences come with 1053 nm light on a 10 µm ramp at large angles: the ramp is then only ten wavelengths long, the Airy
          layer is a sizeable part of it, and WKB is no longer a good description.
        </p>
        <Plotter spec={plotById('b2-absorption-vs-scale-length')!} />
      </section>

      <section id="scaling">
        <h2>Why fusion lasers went to short wavelengths</h2>
        <p>
          Put the practical numbers into ν_cL/c. The critical density brings in 1/λ², and the collision rate brings in Z lnΛ/T_e^(3/2):
        </p>
        <p style={{ textAlign: 'center' }}>
          <M>{'\\dfrac{\\nu_cL}{c} \\approx 3.4\\times10^{-4}\\,\\dfrac{Z\\,\\ln\\Lambda\\,L_{\\mu m}}{\\lambda_{\\mu m}^2\\,T_{keV}^{3/2}}'}</M>
        </p>
        <p>
          For a CH corona (Z_eff ≈ 5) at 2 keV with L = 100 µm: ν_cL/c = 0.40 at 1053 nm (A = 0.58), 1.46 at 527 nm (A = 0.96) and 3.1 at 351
          nm (A = 0.999). Experiments in the late 1970s and 1980s saw exactly this trend: short-wavelength light was absorbed far better, and
          mostly by inverse bremsstrahlung, while at 1 µm much of the absorption came from resonance absorption and instabilities that make
          hot electrons (B3, B5–B8). That is why the big fusion lasers convert their 1053 nm light to 351 nm. Hotter coronas (higher intensity)
          and lower-Z ablators push the other way.
        </p>
        <Plotter spec={plotById('b2-absorption-vs-wavelength')!} />
      </section>

      <section id="intense">
        <h2>High intensity: the Langdon effect</h2>
        <p>
          The formulas above assume the laser is a gentle perturbation on a Maxwellian plasma. Two things change as the intensity rises.
        </p>
        <p>
          First, the electrons’ quiver speed v_os = eE₀/m_eω grows. Coulomb collisions depend on the relative electron–ion speed, so once
          v_os approaches the thermal speed v_te = √(kT_e/m_e), the quiver itself makes collisions rarer and ν_ei drops further. For 351 nm
          light at 10¹⁵ W/cm² and 2 keV, v_os/v_te = 0.15 (B1), so this effect only starts to matter around 10¹⁶ W/cm².
        </p>
        <p>
          Second, and earlier, the shape of the electron distribution changes. Inverse bremsstrahlung heats slow electrons most, because they
          collide most (ν ∝ 1/v³). If it heats them faster than electron–electron collisions can share the energy out, the distribution
          loses its slow electrons and flattens into a super-Gaussian, f ∝ exp(−(v/v_m)^m) with m between 2 (Maxwellian) and 5. Fewer slow
          electrons means fewer of the collisions that absorb: in the weak-field limit the absorption rate is proportional to f(v = 0). Langdon
          (1980) showed that the controlling parameter is the ratio of the heating rate to the electron–electron collision rate:
        </p>
        <Eq
          title="Langdon parameter and absorption reduction"
          src="\begin{gathered}\s{al}{\alpha} = \s{Z}{Z}\,\dfrac{\s{vos}{v_{os}}^2}{\s{vte}{v_{te}}^2} \\ \dfrac{\nu_{\rm eff}}{\nu_{ei}} = \s{fL}{f_L} \approx 1 - \dfrac{0.553}{1 + (0.27/\alpha)^{0.75}}\end{gathered}"
          symbols={{
            al: { name: 'α, Langdon parameter', note: 'Inverse bremsstrahlung heating rate over the electron–electron equilibration rate. Small α: the distribution stays Maxwellian. α ≳ 1: strongly super-Gaussian.' },
            Z: { name: 'Z, ion charge', note: 'High Z makes electron–ion collisions (the heating) faster relative to electron–electron collisions (the re-Maxwellization), so gold coronas feel this effect much more than plastic ones.' },
            vos: { name: 'v_os = eE₀/m_eω, quiver velocity', units: 'm/s', note: 'v_os/c ≈ 0.855 λ_µm √(I/10¹⁸ W cm⁻²) (B1).' },
            vte: { name: 'v_te = √(kT_e/m_e), thermal speed', units: 'm/s', note: 'Kruer’s convention, 0.044c √T_keV.' },
            fL: { name: 'f_L, absorption reduction factor', note: 'The fit of Matte et al. (1988) to Fokker–Planck simulations; it goes from 1 at α → 0 to 0.447 at α → ∞. Their fitted super-Gaussian order m = 2 + 3/(1 + 1.66 α^(−0.724)) gives the same reduction through f(0), within 0.5%, which is how this app checks the fit.' },
          }}
          says="Absorption at high intensity is lower than the classical formula, by up to a factor of about 2, and most for high-Z plasmas. The fix used in design codes is to multiply ν_ei by f_L(α)."
        />
        <p>
          Switch the simulation to <strong>A vs intensity</strong>. The dashed lines are the classical result for each wavelength, which at
          fixed T_e does not depend on intensity at all. The solid lines include the Langdon factor; the open dots are full-wave solutions
          at the chosen wavelength (with the reduced ν when the Langdon button is on), filled in a few per second. The ticks along the bottom mark α = 1 for each wavelength:
          1053 nm light reaches it at a nine times lower intensity than 351 nm light, since α ∝ Iλ². Raise Z to 40 to see a gold corona. The
          simulation evaluates α with the incident vacuum intensity, a simplification: near the turning point the swelled field of B1 makes the
          local α larger.
        </p>
        <p>
          In a real experiment the corona also gets hotter as the intensity rises, which cuts ν_ei as T_e^(−3/2). Both effects make
          collisional absorption fall at high intensity, which is where the collisionless mechanisms of the next lessons take over.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Collisional absorption fails when the plasma is hot, the scale length is short, or the light comes in at an angle and turns well below
          n_c. In exactly those conditions, p-polarized light finds another way to deposit its energy. Its electric field has a component along
          the density gradient, and the part of it that tunnels from the turning point n_c cos²θ to the critical surface drives the electrons
          at their own plasma frequency, a resonance at n_c. That is <strong>resonance absorption</strong>, lesson B3: it needs no collisions,
          has an optimum angle set by (ωL/c)^(1/3), the same Airy width as in B1, and makes hot electrons.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B2-p1',
      kind: 'numeric',
      concept: 'collision-frequency',
      prompt: 'Evaluate the electron–ion collision frequency at the critical density of 351 nm light in a corona with $T_e = 3$ keV, $Z = 5$ and $\\ln\\Lambda = 7$. Give it in units of $10^{12}\\ \\text{s}^{-1}$.',
      answer: 5.6,
      tol: 0.03,
      unit: '×10¹² s⁻¹',
      hints: ['$n_c \\approx 1.115\\times10^{21}/\\lambda_{\\mu m}^2$ cm⁻³.', '$\\nu_{ei} \\approx 2.91\\times10^{-6}\\,Z\\,n_e[\\text{cm}^{-3}]\\ln\\Lambda/T_{eV}^{3/2}$ s⁻¹, with $T_{eV} = 3000$.'],
      solution: '$n_c = 1.115\\times10^{21}/0.351^2 = 9.05\\times10^{21}$ cm⁻³ and $3000^{3/2} = 1.64\\times10^5$. So $\\nu_{ei} = 2.91\\times10^{-6}\\times5\\times9.05\\times10^{21}\\times7/1.64\\times10^5 = 5.6\\times10^{12}$ s⁻¹. With $\\omega = 2\\pi c/\\lambda = 5.37\\times10^{15}$ s⁻¹, $\\nu_{ei}/\\omega = 1.0\\times10^{-3}$: weak damping per cycle, as the formulas assume.',
    },
    {
      id: 'B2-p2',
      kind: 'numeric',
      concept: 'linear-ramp-absorption',
      prompt: 'A 1053 nm beam falls at normal incidence on a linear density ramp with $L = 100$ µm, $T_e = 2$ keV, $Z = 5$ and $\\ln\\Lambda = 8$. What fraction of it is absorbed by inverse bremsstrahlung?',
      answer: 0.605,
      tol: 0.03,
      unit: '',
      hints: ['First $\\nu_c = \\nu_{ei}(n_c)$ with $n_c = 1.005\\times10^{21}$ cm⁻³.', '$A = 1 - \\exp(-\\tfrac{32}{15}\\nu_cL/c)$.'],
      solution: '$\\nu_c = 2.91\\times10^{-6}\\times5\\times1.005\\times10^{21}\\times8/2000^{3/2} = 1.31\\times10^{12}$ s⁻¹. Then $\\nu_cL/c = 1.31\\times10^{12}\\times10^{-4}/3.0\\times10^8 = 0.436$, the exponent is $\\tfrac{32}{15}\\times0.436 = 0.930$, and $A = 1 - e^{-0.930} = 0.605$. About 40% is reflected.',
    },
    {
      id: 'B2-p3',
      kind: 'numeric',
      concept: 'wavelength-scaling',
      prompt: 'A linear ramp absorbs 40% of a 1053 nm beam by inverse bremsstrahlung. The laser is frequency-tripled to 351 nm, with the same plasma (same $L$, $T_e$, $Z$; ignore the change in $\\ln\\Lambda$). What fraction is absorbed now?',
      answer: 0.990,
      tol: 0.005,
      unit: '',
      hints: ['$\\nu_cL/c \\propto n_c \\propto 1/\\lambda^2$.', '$1 - A = \\exp(-\\tfrac{32}{15}\\nu_cL/c)$, so the reflected fraction is raised to the power of the ratio.'],
      solution: 'The exponent scales as $(1053/351)^2 = 9$. The reflected fraction was $0.6$, so it becomes $0.6^9 = 0.010$, and $A = 0.990$. Including the smaller Coulomb logarithm of the denser plasma (a factor of about 0.85) the exponent ratio is 7.7 and $A = 0.980$: the conclusion does not change.',
    },
    {
      id: 'B2-p4',
      kind: 'numeric',
      concept: 'oblique-collisional-absorption',
      prompt: 'A linear ramp has $\\nu_cL/c = 0.5$. It absorbs 66% of normally incident light. What fraction does it absorb of s-polarized light arriving at $30^\\circ$?',
      answer: 0.405,
      tol: 0.03,
      unit: '',
      hints: ['The exponent picks up a factor $\\cos^5\\theta$.', '$\\cos^5 30^\\circ = 0.487$.'],
      solution: '$A = 1 - \\exp(-\\tfrac{32}{15}\\times0.5\\times0.487) = 1 - e^{-0.519} = 0.405$. The light turns at $0.75\\,n_c$, where collisions are rarer and it slows down less, so it misses the most absorbing part of the ramp.',
    },
    {
      id: 'B2-p5',
      kind: 'numeric',
      concept: 'langdon-effect',
      prompt: '351 nm light at $10^{15}$ W/cm² heats a $Z = 5$ corona at $T_e = 2$ keV (B1 problem 4: $v_{os}/v_{te} = 0.152$ there). By what factor does the Langdon effect reduce the inverse-bremsstrahlung absorption rate?',
      answer: 0.809,
      tol: 0.03,
      unit: '',
      hints: ['$\\alpha = Z v_{os}^2/v_{te}^2$.', '$f_L = 1 - 0.553/(1 + (0.27/\\alpha)^{0.75})$.'],
      solution: '$\\alpha = 5\\times0.152^2 = 0.115$. Then $(0.27/0.115)^{0.75} = 1.90$ and $f_L = 1 - 0.553/2.90 = 0.81$: a 19% cut in $\\nu_{ei}$ at an intensity where $v_{os}$ is still only 15% of $v_{te}$. In a gold corona ($Z \\approx 40$) $\\alpha = 0.92$ and $f_L = 0.60$.',
    },
    {
      id: 'B2-p6',
      kind: 'mcq',
      concept: 'where-collisional-absorption-happens',
      prompt: 'Light travels up a long linear density ramp to $n_c$ and back. Where is most of the inverse-bremsstrahlung absorption?',
      options: [
        'Spread evenly along the ramp, since the light crosses every part of it twice',
        'Near the plasma edge, because the light meets that plasma first',
        'In the densest part, just before the turning point: ν_ei ∝ n_e, the electrons’ share of the wave energy ∝ n_e, and the light slows down there',
        'Beyond the turning point, in the evanescent region where the field decays',
      ],
      correct: 2,
      hints: ['How does $\\kappa_{ib}$ depend on $n_e/n_c$?'],
      solution: '$\\kappa_{ib} \\propto (n_e/n_c)^2/\\sqrt{1 - n_e/n_c}$: two powers of density and the slowing-down factor. In a linear ramp 73% of the optical depth lies above $0.8\\,n_c$ and 95% above $0.5\\,n_c$. The evanescent region is only about one Airy width deep and contributes little. The simulation’s amber heating profile shows this directly.',
    },
  ],
  cards: [
    { id: 'B2-c1', front: 'Permittivity of a plasma with electron–ion collisions', back: '$\\varepsilon = 1 - \\omega_{pe}^2/\\omega(\\omega + i\\nu_{ei}) \\approx 1 - n_e/n_c + i(\\nu_{ei}/\\omega)(n_e/n_c)$; friction puts part of the current in phase with E' },
    { id: 'B2-c2', front: 'Temporal and spatial energy damping rates of light by collisions', back: '$\\nu_{ib} = \\nu_{ei}n_e/n_c$; $\\kappa_{ib} = \\nu_{ib}/v_g = (\\nu_{ei}/c)(n_e/n_c)/\\sqrt{1 - n_e/n_c}$' },
    { id: 'B2-c3', front: 'Electron–ion collision frequency in practical units, and Z for a mixture', back: '$\\nu_{ei} \\approx 2.91\\times10^{-6}\\,Z n_e[\\text{cm}^{-3}]\\ln\\Lambda/T_{eV}^{3/2}$ s⁻¹, with $Z \\to \\langle Z^2\\rangle/\\langle Z\\rangle$ (5.3 for CH)' },
    { id: 'B2-c4', front: 'Absorbed fraction of a linear and an exponential ramp (s-polarized, angle θ)', back: 'Linear: $1 - \\exp(-\\tfrac{32}{15}\\tfrac{\\nu_cL}{c}\\cos^5\\theta)$. Exponential: $1 - \\exp(-\\tfrac83\\tfrac{\\nu_cL}{c}\\cos^3\\theta)$. $\\nu_c = \\nu_{ei}(n_c)$' },
    { id: 'B2-c5', front: 'How does collisional absorption scale with wavelength, temperature, Z and scale length?', back: '$\\nu_cL/c \\approx 3.4\\times10^{-4}\\,Z\\ln\\Lambda L_{\\mu m}/(\\lambda_{\\mu m}^2T_{keV}^{3/2})$: short λ, cool, high-Z, long plasmas absorb best' },
    { id: 'B2-c6', front: 'The Langdon effect', back: 'Strong IB heating depletes slow electrons (super-Gaussian f), cutting absorption by $f_L \\approx 1 - 0.553/(1 + (0.27/\\alpha)^{0.75})$, $\\alpha = Zv_{os}^2/v_{te}^2$; down to 0.45 for $\\alpha \\gg 1$' },
  ],
}
