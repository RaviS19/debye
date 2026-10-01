import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { AirySwellingSim } from '../sims/AirySwellingSim'
import { RayRampSim } from '../sims/RayRampSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram: anatomy of a laser-produced plasma ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 19 }

function AnatomyDiagram() {
  // log10(n/n_c) against position; laser from the left, solid target on the right
  const xq = 228 // n_c/4
  const xc = 330 // n_c
  const xa = 452 // ablation front
  const Y = (lg: number) => 236 - 46 * (lg + 1.7) // lg = log10(n/n_c)
  const lgAt = (x: number) => (x <= xc ? -1.7 + (1.7 * (x - 40)) / (xc - 40) : x <= xa - 8 ? (x - xc) / (xa - 8 - xc) : x <= xa + 10 ? 1 + (1.6 * (x - xa + 8)) / 18 : 2.6)
  let dens = ''
  for (let x = 40; x <= 570; x += 2) dens += `${x === 40 ? 'M' : 'L'}${x},${Y(lgAt(x)).toFixed(1)} `
  // electron temperature: hot and flat in the corona, falling through the conduction zone
  const T = (x: number) => (x <= xc ? 62 : x <= xa ? 62 + (200 * (x - xc)) / (xa - xc) : 262)
  let temp = ''
  for (let x = 40; x <= 570; x += 2) temp += `${x === 40 ? 'M' : 'L'}${x},${T(x).toFixed(1)} `
  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const h = 10
    return (
      <g stroke={color} fill={color} strokeWidth={3}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <path d={`M${x2},${y2} L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)} Z`} stroke="none" />
      </g>
    )
  }
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 600 340" style={{ width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' }} role="img" aria-label="Density and temperature profile of a laser-produced plasma">
        <rect x={xa} y={20} width={600 - xa} height={268} fill="rgba(160,111,214,0.18)" />
        <rect x={xc} y={20} width={xa - xc} height={268} fill="rgba(251,191,36,0.06)" />
        {[xq, xc, xa].map((x, i) => (
          <line key={i} x1={x} y1={22} x2={x} y2={288} stroke={['#f472b6', '#fbbf24', '#a06fd6'][i]} strokeWidth={2} strokeDasharray={i === 2 ? '' : '6 5'} />
        ))}
        <line x1={40} y1={288} x2={590} y2={288} stroke="#9aa0c9" strokeWidth={1.5} />
        <path d={temp} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="8 6" />
        <path d={dens} fill="none" stroke="#22d3ee" strokeWidth={3} />
        {arrow(4, 120, 70, 120, '#f472b6')}
        <text x={6} y={108} fill="#f472b6" style={svgText}>laser</text>
        {arrow(200, 270, 120, 270, '#9aa0c9')}
        <text x={58} y={262} fill="#9aa0c9" style={{ ...svgText, fontSize: 17 }}>plasma flows out</text>
        {arrow(xc + 18, 200, xa - 16, 200, '#fbbf24')}
        <text x={xc + 14} y={190} fill="#fbbf24" style={{ ...svgText, fontSize: 17 }}>heat flows in</text>
        <text x={90} y={52} fill="#fbbf24" style={{ ...svgText, fontSize: 17 }}>T_e: hot, nearly flat</text>
        <text x={120} y={170} fill="#22d3ee" style={{ ...svgText, fontSize: 17 }}>n_e (log scale)</text>
        <text x={xq - 4} y={16} fill="#f472b6" style={svgText} textAnchor="middle">n_c/4</text>
        <text x={xc + 2} y={16} fill="#fbbf24" style={svgText} textAnchor="middle">n_c</text>
        <text x={xa + 6} y={16} fill="#c4a5f0" style={svgText} textAnchor="middle">ablation front</text>
        <text x={135} y={310} fill="#e8eaf6" style={svgText} textAnchor="middle">underdense corona</text>
        <text x={135} y={330} fill="#9aa0c9" style={{ ...svgText, fontSize: 16 }} textAnchor="middle">light travels and is absorbed</text>
        <text x={(xc + xa) / 2} y={310} fill="#e8eaf6" style={svgText} textAnchor="middle">overdense</text>
        <text x={(xc + xa) / 2} y={330} fill="#9aa0c9" style={{ ...svgText, fontSize: 16 }} textAnchor="middle">conduction zone</text>
        <text x={528} y={310} fill="#e8eaf6" style={svgText} textAnchor="middle">dense target</text>
        <text x={528} y={330} fill="#9aa0c9" style={{ ...svgText, fontSize: 16 }} textAnchor="middle">pushed inward</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        A laser hits a solid target from the left. The heated surface blows off as a plasma whose density (cyan, on a log scale) rises from
        nearly zero far out to solid density at the ablation front. The light can only travel where n_e &lt; n_c. Near n_c/4 it can decay into
        plasma waves (B5–B7); at n_c it turns around, and that is also where p-polarized light drives resonance absorption (B3); on the way in
        and out, collisions absorb it (B2). Electrons carry the deposited energy inward through the overdense conduction zone to the ablation
        front, where the outflowing plasma acts like a rocket exhaust and drives the target inward.
      </figcaption>
    </figure>
  )
}

export const B1: Lesson = {
  id: 'B1',
  title: 'Light in plasma',
  subtitle: 'Critical density, slowing and swelling, rays in a density ramp, WKB and the Airy turning point',
  minutes: 55,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 3 (electromagnetic wave propagation in plasmas: 3.2 the WKB solution, 3.3 the constant density gradient and the Airy function) and Ch. 4.1 (obliquely incident s-polarized light)',
    'Atzeni & Meyer-ter-Vehn, The Physics of Inertial Fusion: the chapter on laser–plasma interaction (critical density, ray propagation, the structure of an ablating plasma)',
    'Michel, Introduction to Laser-Plasma Interactions (Springer 2023): light propagation in inhomogeneous plasmas and geometrical optics',
  ],
  objectives: [
    'Sketch the density and temperature profile of a laser-produced plasma, and say where $n_c/4$, $n_c$ and the ablation front sit and what happens at each',
    'Derive the WKB field $E \\propto \\eta^{-1/2}\\exp(ik_0\\!\\int\\eta\\,dx)$, the Airy solution of a linear ramp and its peak swelling $3.6\\,(\\omega L/c)^{1/3}$, and say where each is valid',
    'Use the ray equations and Snell’s law to show that light at angle $\\theta$ turns at $n_c\\cos^2\\theta$, and convert Kruer’s Gaussian and practical units to SI',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'index', label: 'Slowing down' },
    { id: 'rays', label: 'Rays' },
    { id: 'wkb', label: 'WKB' },
    { id: 'airy', label: 'Airy layer' },
    { id: 'units', label: 'Practical units' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          Point a powerful laser at a solid. Within a fraction of a nanosecond the surface is a plasma, and that plasma streams back toward the
          laser. From then on the light never touches the solid. It has to travel up a <strong>density ramp</strong>: from nearly empty space,
          through ever denser plasma, toward the target. Everything in Track B happens somewhere on that ramp.
        </p>
        <AnatomyDiagram />
        <p>
          A6 showed the one fact that organizes the picture: light of frequency ω cannot enter plasma denser than the critical density
          n_c, where the plasma frequency equals ω. This lesson follows the light up the ramp. On the way it slows down, its field grows,
          it bends away from the density gradient, and it turns around, at n_c if it comes straight in and earlier if it comes in at an angle.
          The swelling and the turning point decide where the laser can deposit its energy, which is the subject of B2 and B3.
        </p>
        <p>
          A6 already has the dispersion relation and a Maxwell solver that shows light reflecting at n_c. Here we go further: rays in two
          dimensions, the WKB solution, and the exact field at the turning point.
        </p>
      </section>

      <section id="index">
        <h2>Slowing down and piling up</h2>
        <p>
          In a uniform plasma, light obeys <M>{'\\omega^2 = \\omega_{pe}^2 + c^2k^2'}</M> (A6). Since <M>{'\\omega_{pe}^2 \\propto n_e'}</M>, the
          ratio ω_pe²/ω² is simply n_e/n_c, and the refractive index depends on that one number.
        </p>
        <Eq
          title="Refractive index and critical density"
          src="\begin{gathered}\s{eta}{\eta} = \dfrac{ck}{\omega} = \sqrt{1 - \dfrac{\s{ne}{n_e}}{\s{nc}{n_c}}} \\ \s{nc}{n_c} = \dfrac{\s{eps}{\varepsilon_0}\,\s{m}{m_e}\,\s{w}{\omega}^2}{\s{e}{e}^2} \approx \dfrac{1.1\times10^{21}}{\s{lam}{\lambda_{\mu m}}^2}\ \text{cm}^{-3}\end{gathered}"
          plot="b1-index-group"
          symbols={{
            eta: { name: 'η, refractive index', note: 'c/v_φ. Below 1 in a plasma: the wavelength λ/η is longer than in vacuum. It reaches 0 at n_c.' },
            ne: { name: 'n_e, local electron density', units: 'cm⁻³ (laser practice) or m⁻³', note: 'Varies along the ramp; the light only cares about n_e/n_c.' },
            nc: { name: 'n_c, critical density', units: 'cm⁻³', note: 'The density where ω_pe = ω. About 1.0×10²¹ cm⁻³ for 1053 nm light and 9.0×10²¹ cm⁻³ for 351 nm. (A6 quotes the same numbers in m⁻³.)' },
            eps: { name: 'ε₀, vacuum permittivity', units: 'F/m', note: 'In Kruer’s Gaussian units the same formula reads n_c = m ω²/(4π e²).' },
            m: { name: 'm_e, electron mass', units: 'kg', note: 'Only electrons respond at optical frequencies.' },
            w: { name: 'ω, laser frequency', units: 'rad/s', note: 'Fixed by the laser. It stays the same everywhere on a ramp that does not change in time; k changes instead.' },
            e: { name: 'e, elementary charge', units: 'C', note: '1.602×10⁻¹⁹ C.' },
            lam: { name: 'λ_µm, vacuum wavelength in µm', units: 'µm', note: 'n_c ∝ 1/λ²: tripling the frequency of a 1053 nm laser to 351 nm lets the light reach nine times denser plasma.' },
          }}
          says="One number, n_e/n_c, sets everything about the light’s propagation. At quarter-critical the wavelength is only 15% longer than in vacuum; the drama is concentrated close to n_c."
        />
        <p>
          The energy of a light pulse moves at the group velocity, <M>{'v_g = d\\omega/dk = c^2k/\\omega = c\\,\\eta'}</M>. For light in a plasma
          that is the same function as the refractive index: at quarter-critical v_g = 0.87c, at 0.99 n_c it is 0.1c, and at n_c it is zero.
          A steady beam carries a fixed energy flux, roughly <M>{'v_g \\times'}</M> (energy density). If v_g drops, the energy density must rise
          to carry the same flux: the light <strong>piles up</strong>, like cars bunching where a motorway narrows. The time-averaged intensity
          therefore swells as 1/η, and the electric field as <M>{'\\eta^{-1/2}'}</M>. A round trip through a linear ramp of length L takes
          <M>{'\\ 2\\int_0^L dx/(c\\eta) = 4L/c'}</M>, twice the vacuum time: for L = 100 µm, 1.3 ps instead of 0.67 ps.
        </p>
        <Plotter spec={plotById('b1-index-group')!} />
      </section>

      <section id="rays">
        <h2>Rays in a density ramp</h2>
        <p>
          When the wavelength is much smaller than the scale length of the plasma, light travels along <strong>rays</strong>, like a stream of
          particles. The dispersion relation plays the role of the particle’s energy, the wavevector plays the role of its momentum, and
          Hamilton’s equations tell you how the ray moves. The plasma acts on the light like a hill acts on a ball: the light is pushed down the
          density gradient.
        </p>
        <Eq
          title="Ray equations"
          src="\begin{gathered}\dfrac{d\s{x}{\mathbf{x}}}{dt} = \dfrac{\partial \s{w}{\omega}}{\partial \s{k}{\mathbf{k}}} = \dfrac{c^2\mathbf{k}}{\omega} \\ \dfrac{d\mathbf{k}}{dt} = -\dfrac{\partial\omega}{\partial\mathbf{x}} = -\dfrac{\nabla \s{wp}{\omega_{pe}^2}}{2\omega}\end{gathered}"
          symbols={{
            x: { name: 'x, position on the ray', units: 'm', note: 'Where a short piece of the beam (a wave packet) is at time t. It moves at the group velocity.' },
            w: { name: 'ω(x, k), the dispersion relation', units: 'rad/s', note: '√(ω_pe²(x) + c²k²), used as a Hamiltonian. Its value is conserved along the ray when the plasma does not change in time.' },
            k: { name: 'k, wavevector', units: 'rad/m', note: 'Plays the role of momentum. Its size shrinks as the ray climbs into denser plasma, because ck = ω η.' },
            wp: { name: 'ω_pe²(x), local plasma frequency squared', units: 'rad²/s²', note: 'Proportional to n_e(x). Its gradient is the "force" that bends rays toward lower density.' },
          }}
          says="Rays bend away from dense plasma. Light travelling up the gradient is slowed; light travelling across it is turned. In a plasma that varies only along x, the component of k along y never changes."
        />
        <Derivation
          lessonId="B1"
          id="rays"
          title="Snell’s law, the turning density and the parabolic ray"
          steps={[
            { text: 'Let the density vary only along x. Then nothing depends on y, so the y-component of the force vanishes and k_y is constant on every ray.', math: '\\dfrac{dk_y}{dt} = -\\dfrac{\\partial\\omega}{\\partial y} = 0', why: 'This is conservation of momentum along a symmetry direction, exactly as for a particle in a potential V(x).' },
            { text: 'In vacuum the ray makes angle θ with the gradient and k = ω/c, so k_y = (ω/c) sin θ forever after. This is Snell’s law.', math: '\\begin{gathered}k_y = \\dfrac{\\omega}{c}\\sin\\theta \\\\ \\Longleftrightarrow\\; \\eta(x)\\sin\\theta(x) = \\sin\\theta\\end{gathered}', why: 'The local angle obeys sin θ(x) = k_y/k = sin θ/η(x). Since η < 1 in plasma, the ray tilts further from the gradient as it climbs.' },
            { text: 'ω is also conserved (the plasma is steady). The dispersion relation then gives k_x everywhere.', math: '\\begin{gathered}c^2k_x^2 = \\omega^2 - \\omega_{pe}^2(x) - c^2k_y^2 \\\\ = \\omega^2\\left(\\cos^2\\theta - \\dfrac{n_e}{n_c}\\right)\\end{gathered}', why: 'ω_pe²/ω² = n_e/n_c, and 1 − sin²θ = cos²θ.' },
            { text: 'The ray moves deeper only while k_x² > 0. It turns where k_x = 0, which is before the critical density for any θ > 0.', math: 'n_{\\rm turn} = n_c\\cos^2\\theta', why: 'At the turning point all of the remaining wavenumber is sideways, k = k_y. At 30° the light turns at 0.75 n_c, at 60° at only 0.25 n_c.' },
            { text: 'For a linear ramp n_e = n_c x/L the force on k is constant, dk_x/dt = −ω/2L. The ray is a parabola, like a ball thrown in uniform gravity.', math: '\\begin{gathered}x = y\\cot\\theta - \\dfrac{y^2}{4L\\sin^2\\theta} \\\\ x_{\\max} = L\\cos^2\\theta\\end{gathered}', why: 'With dx/dt = c²k_x/ω and dy/dt = c sin θ: x(t) = c t cos θ − c²t²/4L and y = c t sin θ. Eliminate t. The ray leaves the ramp at y = 2L sin 2θ, at the mirror angle.' },
          ]}
        />
        <Eq
          title="Where oblique light turns"
          src="\begin{gathered}\s{nt}{n_{\rm turn}} = \s{nc}{n_c}\cos^2\s{th}{\theta} \\ x_{\rm turn} = \s{L}{L}\cos^2\theta\ \ (\text{linear ramp})\end{gathered}"
          plot="b1-index-group"
          symbols={{
            nt: { name: 'n_turn, turning density', units: 'cm⁻³', note: 'Where the ray’s motion along the gradient stops. The light never reaches n_c unless θ = 0.' },
            nc: { name: 'n_c, critical density', units: 'cm⁻³', note: '1.1×10²¹/λ_µm² cm⁻³.' },
            th: { name: 'θ, angle of incidence in vacuum', note: 'Measured from the density gradient (the target normal). In an exponential ramp n_e = n_c e^(x/L) the ray turns a distance L ln(1/cos²θ) below n_c.' },
            L: { name: 'L, density scale length', units: 'µm', note: 'For a linear ramp, the distance from the plasma edge to n_c. Ray paths depend only on x/L; the wavelength enters only through how good the ray picture is.' },
          }}
          says="Oblique light turns early, in plasma that is less dense than n_c. That matters a great deal for absorption: collisional absorption is strongest in the densest plasma the light reaches (B2), and resonance absorption needs field that tunnels from the turning point to n_c (B3)."
        />
        <p>
          The simulation traces a focused beam through a linear or exponential ramp. Every ray conserves its own k_y, so each turns at its own
          n_c cos²θ: a fast beam turns over a whole band of densities. Notice that ray paths have no wavelength in them. Change L/λ and the
          picture just rescales. The wavelength only decides where the ray picture is trustworthy, which is the next section.
        </p>
        <RayRampSim />
      </section>

      <section id="wkb">
        <h2>The WKB solution</h2>
        <p>
          Rays say where the light goes; they do not say how strong the field is. For that, solve the wave equation itself in a slowly varying
          plasma. At normal incidence (or for s-polarized light, with the field along the contours of density) it is a one-dimensional
          equation, and when the plasma changes little over a wavelength it has an approximate solution named after Wentzel, Kramers and
          Brillouin.
        </p>
        <Derivation
          lessonId="B1"
          id="wkb"
          title="WKB: a wave that adapts to the local plasma"
          steps={[
            { text: 'At normal incidence the field E(x)e^(−iωt) of a wave in a plasma whose density varies along x obeys', math: '\\begin{gathered}\\dfrac{d^2E}{dx^2} + k_0^2\\,\\eta^2(x)\\,E = 0 \\\\ k_0 = \\dfrac{\\omega}{c}\\end{gathered}', why: 'This is A6’s wave equation with ε = η² = 1 − n_e(x)/n_c. For a transverse field along the density contours ∇·E = 0, so it holds exactly in 1D; only the slow variation is new.' },
            { text: 'Try a wave whose amplitude and wavenumber change slowly: E = A(x)e^(iψ(x)). Substituting gives', math: '\\begin{gathered}A^{\\prime\\prime} + i\\,(2A^\\prime\\psi^\\prime + A\\psi^{\\prime\\prime}) \\\\ +\\, A\\,(k_0^2\\eta^2 - \\psi^{\\prime 2}) = 0\\end{gathered}', why: 'E′ = (A′ + iAψ′)e^(iψ) and E″ = (A″ + 2iA′ψ′ + iAψ″ − Aψ′²)e^(iψ).' },
            { text: 'Order the terms by powers of k₀ (large when the wavelength is short). The biggest terms, of order k₀², must cancel on their own: the phase advances at the local wavenumber.', math: '\\psi^\\prime = \\pm k_0\\eta \\;\\Rightarrow\\; \\psi = \\pm k_0\\!\\int^x \\eta\\,dx^\\prime', why: 'This is the eikonal equation. It is the same as the ray picture: the local wavenumber k(x) = k₀η(x) follows from ω² = ω_pe² + c²k².' },
            { text: 'The terms of order k₀ (the imaginary part) fix the amplitude.', math: '\\begin{gathered}2A^\\prime\\psi^\\prime + A\\psi^{\\prime\\prime} = \\dfrac{(A^2\\psi^\\prime)^\\prime}{A} = 0 \\\\ \\Rightarrow\\; A \\propto \\eta^{-1/2}\\end{gathered}', why: 'A²ψ′ ∝ |E|²η is the energy flux, |E|² times the group velocity cη. Constant flux with falling group velocity means rising field.' },
            { text: 'So, for each direction of travel,', math: '\\begin{gathered}E(x) \\approx \\dfrac{E_0}{\\sqrt{\\eta(x)}} \\\\ \\times\\exp\\!\\Big(\\pm i k_0\\!\\int^x \\eta\\,dx^\\prime\\Big)\\end{gathered}', why: 'The two signs are the incoming and the reflected wave. Each keeps its own energy flux; no reflection happens while WKB holds, however much the density changes in total.' },
            { text: 'The neglected term A″ is small only if the local wavelength changes little over one wavelength. For a linear ramp η² = 1 − x/L this fails within a distance δ of the turning point.', math: '\\begin{gathered}\\left|\\dfrac{d}{dx}\\dfrac{1}{k_0\\eta}\\right| = \\dfrac{1}{2k_0L\\,\\eta^3} \\ll 1 \\\\ \\Rightarrow\\; L - x \\gg \\delta = \\left(\\dfrac{c^2L}{\\omega^2}\\right)^{1/3}\\end{gathered}', why: 'For a linear ramp η′ = −1/(2Lη), so d(1/k₀η)/dx = 1/(2k₀Lη³). With η² = (L − x)/L the condition 2k₀Lη³ ≫ 1 becomes L − x ≫ 2^(−2/3) (L/k₀²)^(1/3) ≈ 0.6δ: WKB needs to stay several δ away from the turning point. For L = 100 µm and 351 nm light, δ ≈ 0.7 µm, about two wavelengths.' },
          ]}
        />
        <Eq
          title="WKB field"
          src="\s{E}{E}(x) \approx \dfrac{\s{E0}{E_0}}{\sqrt{\s{eta}{\eta}(x)}}\,\exp\!\Big(\pm i\s{k0}{k_0}\!\int^x \eta\,dx^\prime\Big)"
          plot="b1-airy-standing-wave"
          symbols={{
            E: { name: 'E(x), electric field amplitude', units: 'V/m', note: 'Multiply by e^(−iωt) and take the real part for the field you would measure.' },
            E0: { name: 'E₀, vacuum amplitude', units: 'V/m', note: 'The field of the incident wave before it enters the plasma, where η = 1.' },
            eta: { name: 'η(x), local refractive index', note: '√(1 − n_e(x)/n_c). Equal to v_g/c, so 1/η is how much the light has slowed down.' },
            k0: { name: 'k₀ = ω/c, vacuum wavenumber', units: 'rad/m', note: 'k₀η is the local wavenumber; the phase is the running total of it.' },
          }}
          says="The wave keeps its frequency, stretches its wavelength to the local value, and raises its amplitude as η^(−1/2) to keep the energy flux constant. It needs a ramp that is long compared with the wavelength, and it predicts an infinite field at n_c, so it must fail there."
        />
        <p>
          With the incident and reflected waves added, the WKB standing wave has peaks of <M>{'|E|^2 = 4|E_{\\rm vac}|^2/\\eta'}</M> (amplitudes add),
          nodes in between, and a time average of 2|E_vac|²/η. The plot shows this envelope against the exact solution of the next section.
        </p>
        <Plotter spec={plotById('b1-airy-standing-wave')!} />
      </section>

      <section id="airy">
        <h2>The Airy layer</h2>
        <p>
          Near the turning point the wavelength stretches without limit and WKB breaks down. For a linear ramp the wave equation can be
          solved exactly instead. The solution is the Airy function: a standing wave that grows toward n_c, peaks just before it, and
          decays smoothly into the overdense plasma. No infinity, and no ambiguity about what the reflected wave does.
        </p>
        <Derivation
          lessonId="B1"
          id="airy"
          title="The exact field at a linear turning point"
          steps={[
            { text: 'Take the linear ramp n_e = n_c x/L, so η² = 1 − x/L. The wave equation becomes', math: '\\dfrac{d^2E}{dx^2} + k_0^2\\left(1 - \\dfrac{x}{L}\\right)E = 0' },
            { text: 'Measure distance from the critical surface in units of the Airy width δ. The equation becomes Airy’s equation, with no parameters left.', math: '\\begin{gathered}\\zeta = \\dfrac{x - L}{\\delta},\\quad \\delta = \\left(\\dfrac{L}{k_0^2}\\right)^{1/3} \\\\ \\Rightarrow\\; \\dfrac{d^2E}{d\\zeta^2} = \\zeta\\,E\\end{gathered}', why: 'd²/dx² = δ⁻² d²/dζ² and k₀²(1 − x/L) = −k₀²δζ/L. Multiply by δ²: k₀²δ³/L = 1 by the choice of δ. Every linear turning point looks the same in these units.' },
            { text: 'Airy’s equation has two solutions, Ai and Bi. Bi grows exponentially into the overdense plasma (ζ > 0), where nothing feeds it, so only Ai is allowed.', math: 'E = C\\,\\mathrm{Ai}(\\zeta)', why: 'Beyond n_c the field is evanescent; Ai(ζ) decays as exp(−⅔ζ^(3/2)). This is the tail that A6’s simulation showed.' },
            { text: 'Far below the turning point (ζ → −∞) the Airy function becomes a WKB standing wave.', math: '\\begin{gathered}\\mathrm{Ai}(-z) \\approx \\dfrac{\\sin\\!\\big(\\tfrac23 z^{3/2} + \\tfrac{\\pi}{4}\\big)}{\\sqrt{\\pi}\\,z^{1/4}} \\\\ z = (k_0L)^{2/3}\\eta^2\\end{gathered}', why: 'z^(−1/4) ∝ η^(−1/2), the WKB amplitude; and ⅔z^(3/2) = k₀∫ η dx from x to L, the WKB phase measured from the turning point. Writing the sine as two exponentials gives the incoming and reflected waves, with |r| = 1 and r = exp[i(4ωL/3c − π/2)] at the plasma edge.' },
            { text: 'Match the envelopes. The WKB standing wave has peak intensity 4|E_vac|²/η; the Airy envelope is C²/(π z^(1/2)) = C²/(π(k₀L)^(1/3) η).', math: 'C^2 = 4\\pi\\,(k_0L)^{1/3}\\,|E_{\\rm vac}|^2', why: 'The η dependence matches automatically, which is the check that the Airy solution really is the continuation of WKB through the turning point.' },
            { text: 'The largest maximum of Ai is 0.5357 at ζ = −1.019, just before n_c. That gives the peak swelling.', math: '\\begin{gathered}\\dfrac{|E_{\\max}|^2}{|E_{\\rm vac}|^2} \\\\ = 4\\pi(0.5357)^2\\Big(\\dfrac{\\omega L}{c}\\Big)^{1/3} \\\\ = 3.61\\Big(\\dfrac{\\omega L}{c}\\Big)^{1/3}\\end{gathered}', why: '4π × 0.28695 = 3.6056. Checked numerically: the simulation below solves the wave equation directly and finds the same peak to better than 1% for ωL/c from about 50 up.' },
          ]}
        />
        <Eq
          title="Field swelling at the turning point"
          src="\begin{gathered}\dfrac{|\s{Em}{E_{\max}}|^2}{|\s{Ev}{E_{\rm vac}}|^2} = 4\pi\,\s{Ai}{\mathrm{Ai}_{\max}^2}\left(\dfrac{\s{w}{\omega}\s{L}{L}}{c}\right)^{1/3}\cos\s{th}{\theta} \\ \approx 3.6\left(\dfrac{\omega L}{c}\right)^{1/3}\cos\theta\end{gathered}"
          plot="b1-swelling-factor"
          symbols={{
            Em: { name: 'E_max, peak field', units: 'V/m', note: 'At the last antinode, about 1.02 δ before the turning point.' },
            Ev: { name: 'E_vac, incident field in vacuum', units: 'V/m', note: 'The intensity ratio is the same as |E_max|²/|E_vac|².' },
            Ai: { name: 'Ai_max = 0.5357', note: 'The largest value of the Airy function, at ζ = −1.0188. 4π Ai_max² = 3.606.' },
            w: { name: 'ω, laser frequency', units: 'rad/s', note: 'ωL/c = 2πL/λ: the scale length in units of the reduced wavelength.' },
            L: { name: 'L, scale length of the linear ramp', units: 'µm', note: 'Swelling grows only as L^(1/3): ten times longer gives 2.15 times more.' },
            th: { name: 'θ, angle of incidence (s-polarized)', note: 'Oblique s-polarized light swells a factor cos θ less, and peaks before n_c cos²θ instead of n_c.' },
          }}
          says="For 351 nm light on a 100 µm ramp the intensity just below n_c is about 44 times the vacuum intensity. Instabilities and the ponderomotive force feel this swelled field, not the incident one."
        />
        <AirySwellingSim />
        <p>
          The same Airy layer appears at oblique incidence. For s-polarized light (field along the density contours), replace 1 by cos²θ in the
          wave equation: the turning point moves to L cos²θ, the Airy width stays the same, the WKB envelope becomes 4 cos θ/√(cos²θ − x/L), so
          the peak swelling is a factor cos θ smaller, and the reflection phase becomes (4ωL/3c) cos³θ − π/2. Try the angle slider. P-polarized light has a field component along the
          gradient that can drive charge oscillations at n_c; that is resonance absorption, lesson B3.
        </p>
        <Plotter spec={plotById('b1-swelling-factor')!} />
      </section>

      <section id="units">
        <h2>Practical units</h2>
        <p>
          Kruer, like most of the laser–plasma literature, writes formulas in Gaussian units and quotes numbers in a mixed practical system:
          intensity in W/cm², wavelength in µm, density in cm⁻³, temperature in keV (in energy units, with Boltzmann’s k set to 1). This app
          uses SI in its formulas, and gives the practical form next to them. The translations below are the ones the rest of Track B relies on;
          each was checked numerically.
        </p>
        <div className="grid two">
          <div className="card">
            <span className="pill ghost">Charges and fields</span>
            <p style={{ marginTop: 10 }}>
              Gaussian → SI: replace e² by <M>{'e^2/4\\pi\\varepsilon_0'}</M> wherever two charges interact (ω_pe², n_c, collision rates), and the
              field energy E²/8π by ε₀E²/2. A force eE keeps its form, so <M>{'v_{os} = eE_0/m\\omega_0'}</M> reads the same in both systems.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">Critical density</span>
            <p style={{ marginTop: 10 }}>
              <M>{'n_c = \\varepsilon_0 m_e\\omega^2/e^2'}</M> (SI) <M>{'= m\\omega^2/4\\pi e^2'}</M> (Gaussian) <M>{'\\approx 1.1\\times10^{21}\\lambda_{\\mu m}^{-2}'}</M> cm⁻³.
              Plasma frequency: <M>{'\\omega_{pe} \\approx 5.64\\times10^4\\sqrt{n_e[\\text{cm}^{-3}]}'}</M> rad/s.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">Intensity and field</span>
            <p style={{ marginTop: 10 }}>
              For a linearly polarized beam with peak field E₀: <M>{'I = \\tfrac12\\varepsilon_0 cE_0^2'}</M> (SI) <M>{'= cE_0^2/8\\pi'}</M> (Gaussian), so{' '}
              <M>{'E_0 \\approx 2.7\\times10^{10}\\sqrt{I/10^{14}\\,\\text{W cm}^{-2}}'}</M> V/m.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">Quiver velocity and Iλ²</span>
            <p style={{ marginTop: 10 }}>
              <M>{'v_{os}/c = eE_0/m_e\\omega c \\approx 0.855\\,\\big(I\\lambda_{\\mu m}^2/10^{18}\\,\\text{W cm}^{-2}\\big)^{1/2}'}</M>. Only the product Iλ² appears, which is
              why the field compares lasers by Iλ². The cycle-averaged quiver energy is <M>{'\\tfrac14 m_ev_{os}^2 \\approx 9.3\\times10^{-14}I\\lambda_{\\mu m}^2'}</M> eV (A10).
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">Temperature</span>
            <p style={{ marginTop: 10 }}>
              T_e in keV: 1 keV ≈ 1.16×10⁷ K. Kruer’s thermal speed is <M>{'v_e = (T_e/m)^{1/2}'}</M>, i.e. <M>{'\\sqrt{kT_e/m_e}'}</M> in SI ={' '}
              <M>{'1.33\\times10^7\\sqrt{T_{keV}}'}</M> m/s = 0.044c √T_keV. Some books use √(2kT/m); this track does not.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">A worked example</span>
            <p style={{ marginTop: 10 }}>
              10¹⁵ W/cm² of 351 nm light: Iλ² = 1.2×10¹⁴ W µm²/cm², E₀ = 8.7×10¹⁰ V/m, v_os = 0.0095c. In a 2 keV plasma v_te = 0.063c,
              so v_os/v_te ≈ 0.15: the electrons quiver much more slowly than they move thermally.
            </p>
          </div>
        </div>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          So far the plasma is a perfect, lossless medium: every bit of light that goes in comes back out. Real coronas are collisional, and
          the light is absorbed most strongly exactly where this lesson says it lingers, close to its turning point, where it is slow and
          the plasma is dense. B2 adds collisions to the same wave equation and the same ramps, and turns the swelling and the turning density
          into an absorption fraction. B3 then takes the p-polarized case, where the field that tunnels from n_c cos²θ to n_c drives a plasma
          resonance. The swelled field near n_c returns in B4–B7, where it pushes the plasma around and drives instabilities.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B1-p1',
      kind: 'numeric',
      concept: 'oblique-turning-density',
      prompt: 'Frequency-doubled Nd:glass light ($\\lambda = 527$ nm) hits a plasma at $30^\\circ$ from the target normal. At what electron density does it turn around? Give it in units of $10^{21}\\ \\text{cm}^{-3}$.',
      answer: 3.01,
      tol: 0.03,
      unit: '×10²¹ cm⁻³',
      hints: ['$n_c \\approx 1.115\\times10^{21}/\\lambda_{\\mu m}^2$ cm⁻³.', 'Oblique light turns at $n_c\\cos^2\\theta$.'],
      solution: '$n_c = 1.115\\times10^{21}/0.527^2 = 4.01\\times10^{21}$ cm⁻³. With $\\cos^2 30^\\circ = 0.75$, the light turns at $3.01\\times10^{21}$ cm⁻³, three quarters of the critical density.',
    },
    {
      id: 'B1-p2',
      kind: 'numeric',
      concept: 'airy-swelling',
      prompt: '351 nm light falls at normal incidence on a linear density ramp with $L = 100$ µm. By what factor does the intensity at the last standing-wave peak exceed the incident vacuum intensity?',
      answer: 43.8,
      tol: 0.03,
      unit: '',
      hints: ['$|E_{\\max}|^2/|E_{\\rm vac}|^2 = 3.606\\,(\\omega L/c)^{1/3}$.', '$\\omega L/c = 2\\pi L/\\lambda = 2\\pi\\times100/0.351$.'],
      solution: '$\\omega L/c = 2\\pi\\times100/0.351 = 1790$, whose cube root is 12.14. The swelling is $3.606\\times12.14 = 43.8$. For 1053 nm light on the same ramp it would be 30.4: longer wavelengths swell less, but only as $\\lambda^{-1/3}$.',
    },
    {
      id: 'B1-p3',
      kind: 'numeric',
      concept: 'exponential-ramp-turning',
      prompt: 'A corona has an exponential profile $n_e = n_c\\,e^{x/L}$ with $L = 150$ µm. Light arrives at $20^\\circ$. How far below the critical surface does it turn, in µm?',
      answer: 18.7,
      tol: 0.03,
      unit: 'µm',
      hints: ['It turns where $n_e = n_c\\cos^2\\theta$.', 'Solve $e^{x/L} = \\cos^2\\theta$: $x = L\\ln\\cos^2\\theta$.'],
      solution: '$\\cos^2 20^\\circ = 0.883$, and $L\\ln(1/0.883) = 150\\times0.1244 = 18.7$ µm. In a linear ramp of the same $L$ (measured from the edge to $n_c$) it would turn $L\\sin^2\\theta = 17.5$ µm before $n_c$.',
    },
    {
      id: 'B1-p4',
      kind: 'numeric',
      concept: 'practical-units',
      prompt: 'A 351 nm beam at $10^{15}$ W/cm² heats a corona to $T_e = 2$ keV. What is the ratio of the electron quiver speed $v_{os} = eE_0/m_e\\omega$ to the thermal speed $v_{te} = \\sqrt{kT_e/m_e}$?',
      answer: 0.152,
      tol: 0.03,
      unit: '',
      hints: ['$v_{os}/c \\approx 0.855\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}}$ with $I$ in W/cm².', '$v_{te}/c = \\sqrt{T/m_ec^2} = \\sqrt{2/511}$.'],
      solution: '$v_{os}/c = 0.855\\times0.351\\times\\sqrt{10^{-3}} = 0.00949$, and $v_{te}/c = \\sqrt{2/511} = 0.0626$. The ratio is 0.152. Collision rates and many instability thresholds compare these two speeds; B2 uses this one.',
    },
    {
      id: 'B1-p5',
      kind: 'mcq',
      concept: 'wkb-validity',
      prompt: 'The WKB field $E \\propto \\eta^{-1/2}$ becomes infinite at the critical density. What actually happens there?',
      options: [
        'Collisions always absorb the light before it gets close enough for the field to grow large',
        'WKB assumes the wavelength changes little over a wavelength; within about $\\delta = (c^2L/\\omega^2)^{1/3}$ of the turning point that fails, and the exact (Airy) field stays finite, peaking at $3.6(\\omega L/c)^{1/3}$ times the vacuum intensity',
        'The light tunnels through the critical surface and the field spreads out over the overdense plasma',
        'The swelling is real and unbounded; it is limited only by relativistic effects',
      ],
      correct: 1,
      hints: ['What does the local wavelength $\\lambda/\\eta$ do as $\\eta \\to 0$?'],
      solution: 'As $\\eta \\to 0$ the local wavelength $\\lambda/\\eta$ grows without limit, so it cannot be small compared with the distance over which it changes. The WKB condition $1/(2k_0L\\eta^3) \\ll 1$ fails within about $\\delta$ of the turning point. The exact solution of the linear ramp, $E \\propto \\mathrm{Ai}(\\zeta)$, is finite everywhere: it peaks $1.02\\delta$ before $n_c$ and decays beyond it.',
    },
    {
      id: 'B1-p6',
      kind: 'mcq',
      concept: 'snell-law-plasma',
      prompt: 's-polarized light enters a planar density ramp at $40^\\circ$ to the gradient. Which statement is right?',
      options: [
        'It reaches $n_c$, because a steady plasma cannot change the light’s frequency',
        'It turns at $n_c\\sin^2 40^\\circ \\approx 0.41\\,n_c$, because $k_x$ is conserved',
        'It turns at $n_c\\cos^2 40^\\circ \\approx 0.59\\,n_c$, because $\\omega$ and the component of $\\mathbf{k}$ along the density contours are both conserved',
        'It turns at $n_c\\cos 40^\\circ \\approx 0.77\\,n_c$, from Snell’s law $\\eta\\sin\\theta = $ const',
      ],
      correct: 2,
      hints: ['Which component of the force $-\\partial\\omega/\\partial\\mathbf{x}$ vanishes in a planar ramp?', 'Put $k_x = 0$ into $\\omega^2 = \\omega_{pe}^2 + c^2(k_x^2 + k_y^2)$.'],
      solution: 'The ramp varies only along $x$, so $k_y = (\\omega/c)\\sin\\theta$ is conserved, and so is $\\omega$. Then $c^2k_x^2 = \\omega^2(\\cos^2\\theta - n_e/n_c)$, which vanishes at $n_e = n_c\\cos^2\\theta = 0.587\\,n_c$. Snell’s law $\\eta\\sin\\theta(x) = \\sin\\theta$ says the same thing: the ray is parallel to the contours when $\\eta = \\sin\\theta$, i.e. $1 - n_e/n_c = \\sin^2\\theta$.',
    },
  ],
  cards: [
    { id: 'B1-c1', front: 'Refractive index of a plasma, and the critical density in practical units', back: '$\\eta = \\sqrt{1 - n_e/n_c} = v_g/c$; $n_c = \\varepsilon_0 m_e\\omega^2/e^2 \\approx 1.1\\times10^{21}/\\lambda_{\\mu m}^2$ cm⁻³' },
    { id: 'B1-c2', front: 'Why does the field grow as light approaches $n_c$?', back: 'The group velocity $c\\eta$ falls to zero; a constant energy flux $\\propto |E|^2\\eta$ then needs $|E|^2 \\propto 1/\\eta$ (WKB)' },
    { id: 'B1-c3', front: 'WKB solution and when it holds', back: '$E \\approx E_0\\eta^{-1/2}\\exp(\\pm ik_0\\!\\int\\eta\\,dx)$, valid if $|d(1/k_0\\eta)/dx| \\ll 1$; it fails within $\\delta = (c^2L/\\omega^2)^{1/3}$ of the turning point' },
    { id: 'B1-c4', front: 'Peak intensity swelling in a linear ramp, and where the peak sits', back: '$|E_{\\max}|^2/|E_{\\rm vac}|^2 = 4\\pi\\mathrm{Ai}_{\\max}^2(\\omega L/c)^{1/3} \\approx 3.6(\\omega L/c)^{1/3}$, at $\\zeta = -1.02$, i.e. $1.02\\delta$ before $n_c$' },
    { id: 'B1-c5', front: 'Ray equations, and where obliquely incident light turns', back: '$d\\mathbf{x}/dt = \\partial\\omega/\\partial\\mathbf{k}$, $d\\mathbf{k}/dt = -\\partial\\omega/\\partial\\mathbf{x}$; with $k_y$ conserved it turns at $n_c\\cos^2\\theta$ ($x = L\\cos^2\\theta$ in a linear ramp)' },
    { id: 'B1-c6', front: 'Quiver velocity in practical units', back: '$v_{os} = eE_0/m_e\\omega$ (same in SI and Gaussian); $v_{os}/c \\approx 0.855\\,(I\\lambda_{\\mu m}^2/10^{18}\\,\\text{W cm}^{-2})^{1/2}$' },
  ],
}
