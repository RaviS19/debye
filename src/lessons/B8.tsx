import { Eq } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { HotTailSim } from '../sims/HotTailSim'
import { SurfSim } from '../sims/SurfSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 22 }

/** Where in the corona hot electrons are made, and where they go. */
function SourcesDiagram() {
  // density profile n(x): exponential ramp from the left (vacuum side) into the target on the right
  const X0 = 40
  const X1 = 560
  const yOf = (x: number) => 270 - 210 * Math.exp((x - 560) / 150)
  let d = ''
  for (let x = X0; x <= X1; x += 4) d += `${x === X0 ? 'M' : 'L'}${x},${yOf(x).toFixed(1)} `
  const xq = 560 + 150 * Math.log(0.25 * 0.8) // where the curve is a quarter of its value at the n_c mark
  const xc = 560 + 150 * Math.log(0.8)
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 680 330" style={{ width: '100%', maxWidth: 620, display: 'block', margin: '0 auto' }} role="img" aria-label="A density profile rising from the vacuum side into the target. Raman scattering acts below a quarter of the critical density, two-plasmon decay just below quarter-critical, and resonance absorption at the critical density. Hot electrons from all three stream into the target.">
        <rect x={560} y={40} width={110} height={232} fill="#1a2350" />
        <text x={615} y={68} fill="#9aa0c9" textAnchor="middle" style={svgText}>target</text>
        <path d={d} fill="none" stroke="#22d3ee" strokeWidth={3.5} />
        <line x1={X0} y1={272} x2={670} y2={272} stroke="#2a3566" strokeWidth={2} />
        <text x={X0} y={300} fill="#9aa0c9" style={svgText}>laser side</text>
        <text x={400} y={300} fill="#9aa0c9" style={svgText}>density n →</text>
        <line x1={20} y1={30} x2={150} y2={30} stroke="#fbbf24" strokeWidth={4} />
        <path d="M168,30 l-16,-8 l0,16 Z" fill="#fbbf24" />
        <text x={20} y={60} fill="#fbbf24" style={svgText}>laser</text>
        {[
          { x: xq, label: 'n_c/4', col: '#4ade80' },
          { x: xc, label: 'n_c', col: '#f472b6' },
        ].map((m) => (
          <g key={m.label}>
            <line x1={m.x} y1={yOf(m.x)} x2={m.x} y2={272} stroke={m.col} strokeWidth={2} strokeDasharray="6 5" />
            <text x={m.x} y={322} fill={m.col} textAnchor="middle" style={svgText}>{m.label}</text>
          </g>
        ))}
        <text x={xq - 210} y={150} fill="#22d3ee" style={svgText}>SRS (B6)</text>
        <text x={xq - 125} y={205} fill="#4ade80" style={svgText}>TPD (B7)</text>
        <text x={xc - 26} y={72} fill="#f472b6" textAnchor="end" style={svgText}>resonance</text>
        <text x={xc - 26} y={96} fill="#f472b6" textAnchor="end" style={svgText}>absorption (B3)</text>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line x1={590} y1={150 + i * 34} x2={648} y2={150 + i * 34} stroke="#fbbf24" strokeWidth={3} strokeDasharray="2 6" strokeLinecap="round" />
            <path d={`M664,${150 + i * 34} l-14,-7 l0,14 Z`} fill="#fbbf24" />
          </g>
        ))}
        <text x={615} y={258} fill="#fbbf24" textAnchor="middle" style={svgText}>hot e⁻</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        Where hot electrons come from. The laser climbs the density profile from the left. Raman scattering acts below n_c/4, two-plasmon decay just
        below it, and resonance absorption at the critical surface. All three put energy into plasma waves, and the electrons those waves
        accelerate stream on into the target, ahead of everything else.
      </figcaption>
    </figure>
  )
}

export const B8: Lesson = {
  id: 'B8',
  title: 'Hot electrons',
  subtitle: 'Trapping, wavebreaking and reflection by plasma waves; two-temperature distributions, their x-rays, and fuel preheat',
  minutes: 55,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 9 (heating by plasma waves: §9.3 trapping, §9.4 wavebreaking), Ch. 12 (electron energy transport) and Ch. 13 (§13.3 heated electron temperatures, §13.7 wavelength scaling)',
    'J. M. Dawson, Phys. Rev. 113, 383 (1959): nonlinear electron oscillations in a cold plasma and the wavebreaking limit',
    'T. P. Coffey, Phys. Fluids 14, 1402 (1971): wavebreaking of plasma waves in a warm plasma',
    'Lindl, Inertial Confinement Fusion (Springer 1998): the fuel adiabat and hot-electron preheat',
    'Atzeni & Meyer-ter-Vehn, The Physics of Inertial Fusion (OUP 2004): degenerate DT and the role of preheat',
  ],
  objectives: [
    'Derive the trapping width $2\\sqrt{e\\phi_0/m_e}$, the fastest trapped velocity and the bounce frequency of electrons in a plasma wave, and check them in a simulation',
    'Derive the cold wavebreaking field $m_e\\omega_{pe}v_{ph}/e$ and the energy $2\\beta^2\\gamma_{ph}^2m_ec^2$ of electrons reflected by a fast wave, and estimate hot-electron energies from SRS and TPD',
    'Describe a two-temperature distribution, read $T_{hot}$ from a bremsstrahlung slope, and estimate how much hot-electron energy raises the fuel adiabat',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'trapping', label: 'Surfing a wave' },
    { id: 'sim', label: 'Simulation' },
    { id: 'wavebreaking', label: 'Wavebreaking' },
    { id: 'reflection', label: 'Thrown forward' },
    { id: 'sources', label: 'Sources' },
    { id: 'two-temperature', label: 'Two temperatures' },
    { id: 'transport', label: 'Where they go' },
    { id: 'preheat', label: 'Preheat' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          SRS, two-plasmon decay and resonance absorption all end the same way: the laser’s energy sits in electron plasma waves, and those waves
          move fast, at a quarter to over half the speed of light. A thermal electron at 2 keV moves at about 0.06c. Almost all electrons are far
          too slow to keep up with such a wave; they just oscillate as it passes.
        </p>
        <p>
          A few, from the far tail of the distribution, move almost as fast as the wave. They see a nearly stationary row of potential hills and
          valleys and can be caught in a valley, like a surfer on a wave, and carried along at its speed. When the wave is strong enough to grab
          electrons straight out of the bulk, or breaks altogether, many more are thrown forward. The result is a small population of electrons
          with tens to hundreds of keV, ten to a hundred times the temperature of the rest: <strong>hot electrons</strong>.
        </p>
        <p>
          They are few, but they carry a large share of the absorbed energy, they cross the target far ahead of everything else, and they shine in
          hard x-rays. In laser fusion they are a menace: they heat the fuel before it is compressed.
        </p>
      </section>

      <section id="trapping">
        <h2>Surfing a plasma wave</h2>
        <p>
          A9 introduced trapping in a Landau-damped wave and its bounce frequency. Here we need the details of the orbits: how fast a trapped
          electron gets, and how much energy it picks up.
        </p>
        <Derivation
          lessonId="B8"
          id="trapping"
          title="Orbits of electrons in a plasma wave"
          steps={[
            {
              text: 'Take a plasma wave φ = φ₀cos(kx − ωt) moving at v_ph = ω/k. In the frame moving with it, the wave is a frozen row of potential wells. Use the phase ξ = kx − ωt and the velocity relative to the wave, u = v − v_ph.',
              math: '\\begin{gathered}m_e\\dfrac{du}{dt} = -ek\\phi_0\\sin\\xi \\\\ \\dfrac{d\\xi}{dt} = ku\\end{gathered}',
              why: 'The field is E = −∂φ/∂x = kφ₀ sin ξ and the force on an electron is −eE. Changing to a frame moving at constant speed leaves the force unchanged for non-relativistic electrons.',
            },
            {
              text: 'Multiply the first equation by u and use the second: the energy in the wave frame is conserved.',
              math: 'H = \\tfrac12 m_eu^2 - e\\phi_0\\cos\\xi = \\text{const}',
              why: 'In the lab frame the electron’s energy changes, because the wave moves; in the wave frame the potential is static. The potential energy −eφ is lowest at the crests of φ (ξ = 0), so that is where electrons collect.',
            },
            {
              text: 'An electron is trapped if it cannot climb over the hills at ξ = ±π, where −eφ = +eφ₀. The boundary orbit, the separatrix, has H = eφ₀.',
              math: 'u_{\\rm sep} = \\pm 2\\sqrt{\\dfrac{e\\phi_0}{m_e}}\\,\\Big|\\cos\\dfrac{\\xi}{2}\\Big|',
              why: '½m_eu² = eφ₀(1 + cos ξ) = 2eφ₀cos²(ξ/2). The trapped region is widest at the bottom of the well, where it spans the velocities v_ph ± 2√(eφ₀/m_e).',
            },
            {
              text: 'A trapped electron circulates around the bottom of its well. Half a turn takes it from the bottom of the band to the top, so the fastest trapped electron in the lab moves at',
              math: 'v_{\\max} = v_{ph} + 2\\sqrt{\\dfrac{e\\phi_0}{m_e}}',
              why: 'Electrons that start slower than the wave are carried up; those that start faster are slowed down. A Maxwellian has more slow electrons than fast ones near v_ph, so on balance the wave gives energy away: Landau damping, seen orbit by orbit (A9).',
            },
            {
              text: 'Near the bottom of the well sin ξ ≈ ξ and the motion is simple harmonic, at the bounce frequency.',
              math: '\\ddot\\xi = -\\dfrac{ek^2\\phi_0}{m_e}\\sin\\xi\\ \\Rightarrow\\ \\omega_B = k\\sqrt{\\dfrac{e\\phi_0}{m_e}} = \\sqrt{\\dfrac{ekE_0}{m_e}}',
              why: 'This is A9’s ω_B, with E₀ = kφ₀ the field amplitude. Orbits closer to the separatrix take longer; on the separatrix itself the period is infinite.',
            },
            {
              text: 'The energy gained by an electron carried from the bottom of the band to the top, with w = 2√(eφ₀/m_e), is ½m_e[(v_ph + w)² − (v_ph − w)²]:',
              math: '\\Delta\\varepsilon = 2m_ev_{ph}w = 4v_{ph}\\sqrt{m_ee\\phi_0}',
              why: 'The gain is v_ph times the square root of the wave’s potential. A fast wave makes energetic electrons even at a modest amplitude, which is why the fast plasma waves of SRS and TPD, not the slow ion waves of SBS, make hot electrons.',
            },
          ]}
        />
        <Eq
          title="Trapping in a plasma wave"
          src="\begin{gathered}\s{vmax}{v_{\max}} = \s{vph}{v_{ph}} + 2\sqrt{\dfrac{\s{e}{e}\,\s{phi}{\phi_0}}{\s{m}{m_e}}} \\ \s{wB}{\omega_B} = \s{k}{k}\sqrt{\dfrac{e\phi_0}{m_e}}\end{gathered}"
          symbols={{
            vmax: { name: 'v_max, fastest trapped electron', units: 'm/s', note: 'Reached half a bounce after starting at the bottom of the trapped band.' },
            vph: { name: 'v_ph = ω/k, phase velocity', units: 'm/s', note: 'About 0.2–0.4c for Raman plasma waves at 0.1–0.2 n_c, and 0.3–0.6c for TPD plasmons.' },
            e: { name: 'e, elementary charge', units: 'C', note: '1.602×10⁻¹⁹ C.' },
            phi: { name: 'φ₀, potential amplitude', units: 'V', note: 'E₀/k. The well depth, crest to trough, is 2eφ₀.' },
            m: { name: 'm_e, electron mass', units: 'kg', note: 'Non-relativistic here. For trapped electrons approaching c the band is narrower in velocity but wider in momentum.' },
            wB: { name: 'ω_B, bounce frequency', units: 'rad/s', note: 'For deeply trapped electrons. If ω_B exceeds the damping rate, trapping stops linear Landau damping (A9).' },
            k: { name: 'k, wavenumber', units: 'm⁻¹', note: 'For a given field, shorter waves have shallower wells: φ₀ = E₀/k.' },
          }}
          says="The trapped band has a half-width of 2√(eφ₀/m_e) around v_ph: a wave whose well depth is a few kT_e traps electrons from a band several thermal speeds wide. Whether that band reaches down into the thermal bulk decides how many electrons are caught."
        />
      </section>

      <section id="sim">
        <h2>Simulation: surfing electrons</h2>
        <p>
          Five thousand test electrons from a Maxwellian move in a prescribed wave, in units where v_te = √(kT_e/m_e) = 1 and k = 1. Each is pushed
          with a fourth-order symplectic integrator, so its wave-frame energy H stays constant to about 10⁻⁴ of the well depth. The top panel shows phase space with the
          separatrix; the bottom panel shows the distribution of electrons moving forward, against energy, on a log scale, so a Maxwellian is a
          straight line.
        </p>
        <SurfSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The benchmarks.</strong> In the default preset (v_ph = 3.5, eφ₀ = kT_e) the fastest trapped electron reaches 5.50 v_te within a
            couple of bounce periods, the white dot bounces with period 2π/ω_B = 6.28, and 2.6% of all electrons sit inside the separatrix, all as
            theory says.
          </li>
          <li>
            <strong>A plateau.</strong> In the small-wave preset the band is only ±0.45 v_te wide. The electrons inside it are mixed until f is flat
            across the band: the plateau of nonlinear Landau damping.
          </li>
          <li>
            <strong>A hot tail.</strong> In the fast, strong preset (v_ph = 6, eφ₀ = 4kT_e) the band runs from 2 to 10 v_te. Only 0.6% of the
            electrons are trapped, but the ones that are reach 50 kT_e, and the distribution grows a shoulder far above the initial Maxwellian.
          </li>
          <li>
            <strong>Too fast to catch.</strong> Now raise v_ph to 8 at the same amplitude. The band starts at 4 v_te, and the trapped share falls to a
            few millionths. A faster wave needs a larger amplitude before it catches anything, but what it catches is far more energetic.
          </li>
        </ul>
      </section>

      <section id="wavebreaking">
        <h2>Wavebreaking</h2>
        <p>
          How large can a plasma wave get? As its amplitude grows, the electron fluid sloshes faster, and at some point the fastest electrons move
          as fast as the wave itself. They are then no longer carried by the wave but overtake it, and the smooth wave turns into a stream of
          crossing electrons. Like an ocean wave whose crest outruns its base, the wave breaks.
        </p>
        <Derivation
          lessonId="B8"
          id="wavebreaking"
          title="The cold wavebreaking limit"
          steps={[
            {
              text: 'Picture the cold electron fluid as thin sheets over a uniform ion background, each sheet labelled by its rest position x₀. If a sheet moves by ξ and no sheet has passed another, Gauss’s law gives its field from the ion charge it has uncovered.',
              math: 'E = \\dfrac{en_0}{\\varepsilon_0}\\,\\xi',
              why: 'Moving the electrons between x₀ and x₀ + ξ out of the way exposes a slab of ion charge en₀ξ per unit area. The field at the sheet then depends only on its own displacement, whatever the other sheets do, as long as they keep their order.',
            },
            {
              text: 'So every sheet is a harmonic oscillator at ω_pe, exactly, at any amplitude.',
              math: 'm_e\\ddot\\xi = -eE = -\\dfrac{n_0e^2}{\\varepsilon_0}\\,\\xi = -m_e\\omega_{pe}^2\\,\\xi',
              why: 'This is A1’s plasma oscillation without any linearization. In one dimension the cold wave is nonlinear only through the possibility of sheets crossing.',
            },
            {
              text: 'Make a travelling wave by phasing the sheets: ξ = ξ₀ sin(kx₀ − ω_pe t), so v_ph = ω_pe/k. A sheet sits at x = x₀ + ξ, and the density is n₀ divided by how much the sheets have been stretched.',
              math: 'n = \\dfrac{n_0}{\\partial x/\\partial x_0} = \\dfrac{n_0}{1 + k\\xi_0\\cos(kx_0 - \\omega_{pe}t)}',
              why: 'The electrons that started between x₀ and x₀ + dx₀ now fill dx = (∂x/∂x₀)dx₀. Where the sheets are bunched, ∂x/∂x₀ is small and the density peaks: the crests grow sharp while the troughs stay broad.',
            },
            {
              text: 'When kξ₀ reaches 1, ∂x/∂x₀ touches zero: neighbouring sheets meet, the density spikes, and then they cross. At that moment the fastest sheets move at ω_peξ₀ = v_ph. The fluid has caught up with the wave.',
              math: 'k\\xi_0 = 1\\ \\Leftrightarrow\\ v_{\\max} = \\omega_{pe}\\xi_0 = v_{ph}',
              why: 'After crossing, the field at a sheet no longer depends on its own displacement alone, and the fluid description fails. The sheets that overtook the wave are the electrons it accelerates as it breaks.',
            },
            {
              text: 'The largest field the cold wave can carry follows from step 1 with ξ₀ = 1/k.',
              math: '\\begin{gathered}E_{\\rm wb} = \\dfrac{en_0}{\\varepsilon_0k} = \\dfrac{m_e\\omega_{pe}v_{ph}}{e} \\\\ \\approx 96\\,\\dfrac{v_{ph}}{c}\\sqrt{n\\,[\\text{cm}^{-3}]}\\ \\text{V/m}\\end{gathered}',
              why: 'At n_c/4 for 351 nm light (2.26×10²¹ cm⁻³), a wave with v_ph = c/√3 breaks at 2.6×10¹² V/m, thirty times the laser’s own peak field at 10¹⁵ W/cm². A warm plasma breaks at a lower field (Coffey 1971): thermal electrons already move at a good fraction of v_ph and need less help to catch up.',
            },
          ]}
        />
        <Eq
          title="Cold wavebreaking field"
          src="\begin{gathered}\s{E}{E_{\text{wb}}} = \dfrac{\s{m}{m_e}\,\s{wp}{\omega_{pe}}\,\s{vph}{v_{ph}}}{\s{e}{e}} \\ \approx 96\,\dfrac{v_{ph}}{\s{c}{c}}\sqrt{\s{n}{n}\,[\text{cm}^{-3}]}\ \ \text{V/m}\end{gathered}"
          plot="b8-wavebreaking"
          symbols={{
            E: { name: 'E_wb, wavebreaking field', units: 'V/m', note: 'The largest field of a cold, one-dimensional, non-relativistic plasma wave (Dawson 1959). Waves are often driven to a good fraction of it.' },
            m: { name: 'm_e, electron mass', units: 'kg', note: '9.109×10⁻³¹ kg.' },
            wp: { name: 'ω_pe, plasma frequency', units: 'rad/s', note: '5.64×10⁴ √(n[cm⁻³]) s⁻¹. Denser plasma supports larger fields.' },
            vph: { name: 'v_ph, phase velocity', units: 'm/s', note: 'The breaking condition is that the fluid velocity reaches v_ph, so slow waves break at small fields.' },
            e: { name: 'e, elementary charge', units: 'C', note: '1.602×10⁻¹⁹ C.' },
            c: { name: 'c, speed of light', units: 'm/s', note: 'For v_ph → c the non-relativistic limit is m_eω_pec/e; relativistic waves can exceed it (Track C).' },
            n: { name: 'n, electron density', units: 'cm⁻³', note: 'In the practical form, n in cm⁻³.' },
          }}
          says="A plasma wave can carry a field of order m_eω_pe v_ph/e and no more, and at that field it is pouring electrons forward at v_ph and beyond. The same formula with v_ph ≈ c gives the gigavolts per centimetre of laser wakefield accelerators in Track C."
        />
        <Plotter spec={plotById('b8-wavebreaking')!} />
      </section>

      <section id="reflection">
        <h2>Thrown forward</h2>
        <p>
          A large wave does not need to trap an electron to accelerate it. Seen from the wave, an electron at rest in the lab comes in at −v_ph.
          If the potential hill is higher than its kinetic energy in that frame, it bounces off and leaves at +v_ph. Back in the lab it moves at
          twice the phase velocity: a ball bouncing off the front of a moving truck. This is the simplest estimate of the energy of the electrons a
          strong or breaking wave throws forward.
        </p>
        <Eq
          title="Electron reflected by a moving wave"
          src="\begin{gathered}\s{v}{v} = \dfrac{2\s{vph}{v_{ph}}}{1 + \s{b}{\beta}^2} \\ \s{eps}{\varepsilon} = 2\beta^2\s{g}{\gamma_{ph}}^2\,\s{mc}{m_ec^2} \\ \approx 2m_ev_{ph}^2\ \ (\beta \ll 1)\end{gathered}"
          plot="b8-srs-electron-energy"
          symbols={{
            v: { name: 'v, velocity after reflection', units: 'm/s', note: 'Relativistic addition of +v_ph to +v_ph. It tends to 2v_ph for slow waves and to c for fast ones.' },
            vph: { name: 'v_ph, phase velocity of the plasma wave', units: 'm/s', note: 'For SRS backscatter set by the matching at each density: about 0.24c at 0.1 n_c and 2 keV, rising to c/√3 at n_c/4.' },
            b: { name: 'β = v_ph/c', note: 'The wave’s speed in units of c.' },
            eps: { name: 'ε, kinetic energy after reflection', units: 'J (keV)', note: '(γ − 1)m_ec² of the reflected electron, which works out to exactly 2β²γ_ph²m_ec².' },
            g: { name: 'γ_ph = 1/√(1 − β²)', note: 'The Lorentz factor of the wave frame.' },
            mc: { name: 'm_ec², electron rest energy', units: 'keV', note: '511 keV.' },
          }}
          says="Electrons thrown forward by a plasma wave get about 2m_ev_ph²: 60 keV for Raman scattering at 0.1 n_c and 2 keV, 185 keV at 0.2 n_c, and 511 keV for a cold wave at n_c/4. The highest-density Raman light and TPD make the most dangerous electrons."
        />
        <Plotter spec={plotById('b8-srs-electron-energy')!} />
        <p>
          Reflection needs a large amplitude: the hill, 2eφ₀ from trough to crest, must be higher than ½m_e v_ph² in the wave frame. For a sinusoidal wave that means eφ₀ ≳ m_ev_ph²/4, a field of at least a quarter of the cold wavebreaking field, so only large or breaking waves throw bulk electrons forward.
          In practice the energy spectrum of the electrons is broad, and what experiments measure is a hot temperature of a fraction of this
          maximum.
        </p>
      </section>

      <section id="sources">
        <h2>Where hot electrons come from</h2>
        <SourcesDiagram />
        <ul>
          <li>
            <strong>Raman scattering (B6).</strong> Its plasma waves are faster the higher the density at which they are driven, so the electron
            energy rises steeply towards n_c/4. The Raman spectrum is a map of where the electrons were made.
          </li>
          <li>
            <strong>Two-plasmon decay (B7).</strong> Plasmons with v_ph of 0.3 to 0.6c, a thin layer below n_c/4, and a threshold that is easy to
            cross in large direct-drive targets. With 351 nm light it is a leading source of hot electrons in direct drive.
          </li>
          <li>
            <strong>Resonance absorption (B3).</strong> The resonant field at the critical surface drives a plasma wave that is steep and strong
            enough to break, flinging electrons up and down the gradient. The hot temperature it makes rises slowly with Iλ², roughly as its cube
            root (Kruer Ch. 13).
          </li>
        </ul>
        <p>
          All three grow with Iλ², the quiver energy in the laser field. That is one reason fusion lasers use 351 nm light: at the same intensity,
          the quiver energy is nine times smaller than at 1053 nm, and collisional absorption at higher density takes more of the energy before
          these processes get it (Kruer §13.7).
        </p>
      </section>

      <section id="two-temperature">
        <h2>Two temperatures</h2>
        <p>
          The accelerated electrons collide rarely, so they do not rejoin the thermal bulk; they form a separate population. Measured electron
          distributions are often described as the sum of two Maxwellians, a cold one with the bulk of the electrons and a hot one with a small
          fraction α of them. On a logarithmic scale each is a straight line, and the hot line falls so slowly that, beyond a crossover energy, the
          few hot electrons outnumber the cold ones at every energy.
        </p>
        <Eq
          title="Two-temperature distribution and its x-rays"
          src="\begin{gathered}\s{f}{f(E)} \propto \dfrac{1 - \s{a}{\alpha}}{\s{Tc}{T_c}^{3/2}}\,e^{-\s{E}{E}/T_c} \\ +\ \dfrac{\alpha}{\s{Th}{T_h}^{3/2}}\,e^{-E/T_h} \\ \dfrac{dE_\gamma}{d(\s{hv}{h\nu})} \propto \dfrac{1 - \alpha}{\sqrt{T_c}}\,e^{-h\nu/T_c} \\ +\ \dfrac{\alpha}{\sqrt{T_h}}\,e^{-h\nu/T_h}\end{gathered}"
          plot="b8-bimaxwellian"
          symbols={{
            f: { name: 'f(E), distribution per unit velocity-space volume', note: 'At electron energy E = ½m_ev². The number per unit energy is this times √E.' },
            a: { name: 'α, hot fraction (by number)', note: 'Typically well below a percent to a few percent of the electrons.' },
            Tc: { name: 'T_c, cold (bulk) temperature', units: 'keV', note: 'A few keV in a laser corona.' },
            E: { name: 'E, electron kinetic energy', units: 'keV', note: 'Non-relativistic form; fine up to about 100 keV.' },
            Th: { name: 'T_h, hot temperature', units: 'keV', note: 'Tens of keV for SRS, TPD and resonance absorption at fusion intensities.' },
            hv: { name: 'hν, photon energy', units: 'keV', note: 'Bremsstrahlung photons up to the electron energy. Each Maxwellian gives a thin-target energy spectrum dE_γ/d(hν) ∝ T^(−1/2)e^(−hν/T), so far out its logarithmic slope is −1/T_h. The number of photons per keV has an extra factor 1/hν, so photon counts must be multiplied by hν before the slope is read.' },
          }}
          says="A hot fraction of 1% at 50 keV, in a 2 keV plasma, carries a fifth of all the electron energy and dominates every electron above about 20 keV. The energy spectrum of the hard x-rays they emit falls off as e^(−hν/T_h), so its slope is a thermometer for the hot electrons alone."
        />
        <Plotter spec={plotById('b8-bimaxwellian')!} />
        <p>
          The simulation below builds such a distribution and a detector that collects its bremsstrahlung photon by photon. The slope is fitted only
          in the window where the hot electrons dominate, and the readout compares the temperature it returns with the one you set.
        </p>
        <HotTailSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The benchmark.</strong> At the defaults (T_c = 2 keV, α = 1%, T_hot = 50 keV) the measured slope temperature settles within a
            few percent of 50 keV as the photons accumulate, its error bar shrinking as one over the square root of the number of photons.
          </li>
          <li>
            <strong>Few but powerful.</strong> The 1% of hot electrons carry 20% of the energy; above 100 keV there are only 0.26% of the electrons
            but 11% of the energy. Drop α to 10⁻⁴: the hot electrons vanish from the bulk of f(E) but still own the x-rays above the crossover.
          </li>
          <li>
            <strong>Fitting too low.</strong> Imagine fitting the x-ray slope near 20 keV instead: there both groups contribute, and the slope
            temperature lies between T_c and T_hot. Real analyses fit well above the crossover, which is what the shaded window does.
          </li>
        </ul>
        <p>
          Real detectors see a thick target, where each electron radiates as it slows down, and look through filters, so their response has to
          be unfolded. The logarithmic slope at high photon energy still follows T_hot closely, which is why hard x-ray spectrometers with several
          filtered channels are the standard hot-electron diagnostic.
        </p>
      </section>

      <section id="transport">
        <h2>Where they go</h2>
        <p>
          A fast electron loses energy and direction through Coulomb collisions, and the collision rate falls steeply with speed, as 1/v³ (A7, B2). The mean
          free path grows as the square of the energy: a 50 keV electron travels (50/2)² = 625 times farther than a 2 keV thermal electron in the
          same plasma before it is deflected. A 100 keV electron goes of order a tenth of a millimetre through solid plastic before it stops,
          comparable with the thickness of a capsule’s ablator.
        </p>
        <p>
          So hot electrons are effectively collisionless in the corona and cross the target ahead of the heat front. Even the thermal heat flow is
          affected (Kruer Ch. 12): the electrons that carry most of the heat have three to four times the thermal speed and long mean free paths, so the
          classical, local heat flux overestimates what the plasma can carry in steep gradients. Fluid codes cap the flux at a fraction f of the
          free-streaming value n_eT_ev_te, with f of a few hundredths to a tenth, chosen to match experiments.
        </p>
      </section>

      <section id="preheat">
        <h2>Preheat</h2>
        <p>
          A fusion capsule works by compressing cold fuel. The pressure needed to squeeze it is least when the fuel is as cold as quantum mechanics
          allows, held up only by the degeneracy pressure of its electrons. Designers measure how far above that minimum the fuel is with its
          adiabat, the ratio of the actual pressure to the Fermi pressure at the same density. Every bit of energy deposited in the fuel before it
          is compressed raises the adiabat, and with it the pressure, and so the energy, needed to compress it.
        </p>
        <Eq
          title="The adiabat and preheat"
          src="\begin{gathered}\s{al}{\alpha_{\rm ad}} = \dfrac{\s{P}{P}}{\s{PF}{P_F}} \\ P_F \approx 2.2\,\s{rho}{\rho}^{5/3}\ \text{Mbar} \\ \Delta\alpha_{\rm ad} \approx \dfrac{\s{de}{\Delta\varepsilon}}{\s{eF}{\varepsilon_F}} \\ \varepsilon_F \approx 3.2\times10^{5}\,\rho^{2/3}\ \text{J/g}\end{gathered}"
          symbols={{
            al: { name: 'α_ad, adiabat', note: 'Ignition designs keep it low, roughly 1.5 to 4 in the main fuel. (Not the hot fraction α of the previous section.)' },
            P: { name: 'P, fuel pressure', units: 'Mbar', note: '1 Mbar = 10¹¹ Pa.' },
            PF: { name: 'P_F, Fermi pressure of DT', units: 'Mbar', note: 'Of fully degenerate electrons at the same density: (2/5)n_eE_F, with one electron per 2.5 u of DT.' },
            rho: { name: 'ρ, fuel density', units: 'g/cm³', note: '0.25 g/cm³ for DT ice; hundreds of g/cm³ at stagnation.' },
            de: { name: 'Δε, energy deposited per unit mass', units: 'J/g', note: 'From hot electrons, x-rays or shocks arriving early.' },
            eF: { name: 'ε_F, Fermi energy per unit mass', units: 'J/g', note: '(3/2)P_F/ρ. Both the Fermi and the actual pressure are (2/3)ρε for this gas, so the adiabat is also ε/ε_F.' },
          }}
          says="Deposit one Fermi energy per gram and the adiabat rises by one. For DT ice that is about 130 J per milligram, so a few tens of joules of hot electrons reaching the fuel of a fusion capsule, out of a megajoule laser pulse, can double its adiabat."
        />
        <p>
          Not every hot electron reaches the fuel. Those made early, while the target is still cold and thin, are the most dangerous; those
          made late, or with energies too low to cross the ablator, do little. Which is why experiments measure both the hot-electron energy and its
          timing, and why designs try to keep TPD and SRS below threshold during the parts of the pulse that matter most.
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Every lesson in this track has ended with a nonlinear effect that the formulas can only estimate: saturation, trapping, wavebreaking,
          hot tails. B9 introduces the tool that captures all of them, the particle-in-cell simulation, in which trapped and reflected electrons
          appear on their own. Track C pushes the same physics to relativistic intensities, where the laser itself accelerates electrons to MeV
          energies and hot electrons become the goal rather than the problem, as in fast ignition and laser-driven particle sources.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B8-p1',
      kind: 'numeric',
      concept: 'trapping-width',
      prompt: 'An electron plasma wave has wavenumber $k = 1.0\\times10^7$ m⁻¹, field amplitude $E_0 = 1.0\\times10^{10}$ V/m and phase velocity $0.20c$. Treating the electrons non-relativistically, what is the fastest velocity a trapped electron reaches, in units of $c$?',
      answer: 0.288,
      tol: 0.03,
      unit: 'c',
      hints: [
        'The potential amplitude is $\\phi_0 = E_0/k$.',
        'The trapped band is $v_{ph} \\pm 2\\sqrt{e\\phi_0/m_e}$, and $\\sqrt{e\\phi_0/m_e}/c = \\sqrt{e\\phi_0/m_ec^2}$ with $m_ec^2 = 511$ keV.',
      ],
      solution: '$\\phi_0 = 10^{10}/10^7 = 1000$ V, so $e\\phi_0 = 1$ keV and $\\sqrt{e\\phi_0/m_ec^2} = \\sqrt{1/511} = 0.0442$. The fastest trapped electron moves at $0.20c + 2\\times0.0442c = 0.288c$, a kinetic energy of about 21 keV (23 keV relativistically). The bounce period of a deeply trapped electron is $2\\pi/(k\\sqrt{e\\phi_0/m_e}) = 47$ fs.',
    },
    {
      id: 'B8-p2',
      kind: 'numeric',
      concept: 'wavebreaking-field',
      prompt: 'Find the cold wavebreaking field of a plasma wave at quarter-critical density for 351 nm light ($n = 2.26\\times10^{21}$ cm⁻³), with phase velocity $c/\\sqrt3$, as for the plasma waves of TPD and Raman scattering there. Give it in units of $10^{12}$ V/m.',
      answer: 2.64,
      tol: 0.03,
      unit: '×10¹² V/m',
      hints: ['$E_{\\rm wb} = m_e\\omega_{pe}v_{ph}/e$, with $\\omega_{pe} = 5.64\\times10^4\\sqrt{n\\,[\\text{cm}^{-3}]}$ s⁻¹.'],
      solution: '$\\omega_{pe} = 5.64\\times10^4\\times\\sqrt{2.26\\times10^{21}} = 2.68\\times10^{15}$ s⁻¹, half of $\\omega_0 = 5.37\\times10^{15}$ s⁻¹, as it must be at $n_c/4$. Then $E_{\\rm wb} = 9.11\\times10^{-31}\\times2.68\\times10^{15}\\times1.73\\times10^8/1.60\\times10^{-19} = 2.64\\times10^{12}$ V/m, about 30 times the peak laser field at $10^{15}$ W/cm².',
    },
    {
      id: 'B8-p3',
      kind: 'numeric',
      concept: 'wave-reflection-energy',
      prompt: 'Raman backscatter of 351 nm light at $0.2\\,n_c$ in a 2 keV plasma drives a plasma wave with phase velocity $0.392c$. An electron initially at rest is reflected by this wave. Find its kinetic energy in keV, relativistically.',
      answer: 185,
      tol: 0.03,
      unit: 'keV',
      hints: [
        'In the wave frame the electron comes in at $-v_{ph}$ and leaves at $+v_{ph}$; in the lab it leaves at $2v_{ph}/(1 + \\beta^2)$.',
        'This works out to a kinetic energy $2\\beta^2\\gamma_{ph}^2m_ec^2$, with $\\gamma_{ph}^2 = 1/(1 - \\beta^2)$.',
      ],
      solution: '$\\beta^2 = 0.154$ and $\\gamma_{ph}^2 = 1/0.846 = 1.18$, so $\\varepsilon = 2\\times0.154\\times1.18\\times511 = 185$ keV. Check: the electron leaves at $0.784c/1.154 = 0.680c$, with $\\gamma = 1.363$ and kinetic energy $0.363\\times511 = 185$ keV. The non-relativistic $2m_ev_{ph}^2 = 157$ keV is 15% low.',
    },
    {
      id: 'B8-p4',
      kind: 'numeric',
      concept: 'bremsstrahlung-slope',
      prompt: 'The unfolded hard x-ray energy spectrum $dE_\\gamma/d(h\\nu)$ (x-ray energy per keV of photon energy) is $4.4\\times10^3$ at 60 keV and $2.0\\times10^3$ at 100 keV, in the same arbitrary units, where the hot electrons dominate. Taking the thin-target form $dE_\\gamma/d(h\\nu) \\propto e^{-h\\nu/T_h}$, what is $T_h$ in keV?',
      answer: 50.7,
      tol: 0.03,
      unit: 'keV',
      hints: ['The ratio of the two counts is $e^{(100 - 60)/T_h}$.'],
      solution: '$4400/2000 = 2.2 = e^{40/T_h}$, so $T_h = 40/\\ln2.2 = 40/0.788 = 50.7$ keV. The prefactor $T_h^{-1/2}$ is the same at both energies and drops out. Two traps: raw photon counts per keV fall faster by an extra factor $1/h\\nu$ (here they would fall by a factor 3.67 rather than 2.2, and a fit to them would give 31 keV instead of 51), so they must be multiplied by $h\\nu$ first; and a slope taken lower, where cold electrons still contribute, gives a temperature between $T_c$ and $T_h$.',
    },
    {
      id: 'B8-p5',
      kind: 'numeric',
      concept: 'preheat-adiabat',
      prompt: 'A capsule holds 0.15 mg of DT fuel, still at about the density of DT ice, $\\rho = 0.25$ g/cm³, when hot electrons arrive. How much hot-electron energy deposited in the fuel raises its adiabat by $\\Delta\\alpha_{\\rm ad} = 1$? Use $\\varepsilon_F = 3.24\\times10^5\\,\\rho^{2/3}$ J/g with $\\rho$ in g/cm³.',
      answer: 19.3,
      tol: 0.03,
      unit: 'J',
      hints: ['Both the actual and the Fermi pressure are $\\frac23\\rho\\varepsilon$, so $\\Delta\\alpha_{\\rm ad} = \\Delta\\varepsilon/\\varepsilon_F(\\rho)$ per unit mass.'],
      solution: '$\\varepsilon_F = 3.24\\times10^5\\times0.25^{2/3} = 1.29\\times10^5$ J/g, or 129 J/mg. For 0.15 mg and $\\Delta\\alpha_{\\rm ad} = 1$: $129\\times0.15 = 19.3$ J. If 1% of a 1 MJ laser pulse went into hot electrons, 0.2% of those reaching the fuel would be enough.',
    },
    {
      id: 'B8-p6',
      kind: 'mcq',
      concept: 'trapped-fraction',
      prompt: 'Two plasma waves in the same plasma have the same amplitude, $e\\phi_0 = 2kT_e$. One has $v_{ph} = 3v_{te}$, the other $v_{ph} = 8v_{te}$, with $v_{te} = \\sqrt{kT_e/m_e}$. Which statement is right?',
      options: [
        'The slow wave traps about a fifth of the electrons and the fast one almost none, but the few the fast wave traps reach several times higher energies',
        'Both trap the same fraction, because the width of the trapped band depends only on φ₀',
        'The fast wave traps more electrons, because its wells move faster',
        'Neither traps any electrons, because eφ₀ is only 2kT_e',
      ],
      correct: 0,
      hints: ['The trapped band is $v_{ph} \\pm 2\\sqrt{e\\phi_0/m_e} = v_{ph} \\pm 2.83\\,v_{te}$. Where does each band sit in the Maxwellian?'],
      solution: 'The slow wave’s band, 0.17 to 5.83 $v_{te}$, covers much of the thermal bulk: about 19% of all electrons start inside its separatrix. The fast wave’s band, 5.2 to 10.8 $v_{te}$, lies far out in the tail, where only about $2\\times10^{-8}$ of the electrons are. But its fastest trapped electrons reach $\\frac12m_e(10.8\\,v_{te})^2 = 59\\,kT_e$, against $17\\,kT_e$ for the slow wave. The band width is the same for both; what differs is how many electrons it contains.',
    },
  ],
  cards: [
    { id: 'B8-c1', front: 'Trapping in a plasma wave: band and bounce frequency', back: 'Trapped velocities $v_{ph} \\pm 2\\sqrt{e\\phi_0/m_e}$ (widest at the bottom of the well); $\\omega_B = k\\sqrt{e\\phi_0/m_e} = \\sqrt{ekE_0/m_e}$' },
    { id: 'B8-c2', front: 'Energy gained by a trapped electron', back: 'Up to $4v_{ph}\\sqrt{m_ee\\phi_0}$ from the bottom of the band to the top; the fastest reaches $v_{ph} + 2\\sqrt{e\\phi_0/m_e}$. Fast waves make energetic electrons even at modest amplitude' },
    { id: 'B8-c3', front: 'Cold wavebreaking field', back: '$E_{\\rm wb} = m_e\\omega_{pe}v_{ph}/e \\approx 96\\,(v_{ph}/c)\\sqrt{n\\,[\\text{cm}^{-3}]}$ V/m: the fluid velocity reaches $v_{ph}$ and sheets cross (Dawson 1959). Warm waves break earlier' },
    { id: 'B8-c4', front: 'Electron reflected by a fast plasma wave', back: 'Leaves at $2v_{ph}/(1 + \\beta^2)$ with $\\varepsilon = 2\\beta^2\\gamma_{ph}^2m_ec^2 \\approx 2m_ev_{ph}^2$: about 60 keV for Raman at $0.1\\,n_c$ and 2 keV, 511 keV for a cold wave at $n_c/4$' },
    { id: 'B8-c5', front: 'Two-temperature distribution and its x-ray signature', back: '$f \\propto (1-\\alpha)T_c^{-3/2}e^{-E/T_c} + \\alpha T_h^{-3/2}e^{-E/T_h}$. 1% at 50 keV in a 2 keV plasma carries 20% of the energy. Thin-target bremsstrahlung energy spectrum $\\propto T^{-1/2}e^{-h\\nu/T}$: its high-energy slope gives $T_h$' },
    { id: 'B8-c6', front: 'Preheat and the adiabat', back: '$\\alpha_{\\rm ad} = P/P_F$, $P_F \\approx 2.2\\rho^{5/3}$ Mbar for DT. Depositing $\\Delta\\varepsilon$ per gram raises it by $\\Delta\\varepsilon/\\varepsilon_F$, $\\varepsilon_F \\approx 3.2\\times10^5\\rho^{2/3}$ J/g: about 20 J per unit of adiabat for 0.15 mg of DT ice' },
  ],
}
