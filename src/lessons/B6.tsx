import { Eq } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { GrowthMapSim } from '../sims/GrowthMapSim'
import { ThreeWaveSim } from '../sims/ThreeWaveSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 25 }

function sine(x0: number, x1: number, y: number, wl: number, amp: number) {
  let d = ''
  const n = Math.round((x1 - x0) / 2)
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${(y + amp * Math.sin((2 * Math.PI * (x - x0)) / wl)).toFixed(1)} `
  }
  return d
}

function head(x: number, y: number, dir: 1 | -1, color: string) {
  return <path d={`M${x},${y} l${-14 * dir},-8 l0,16 Z`} fill={color} />
}

/** Backscatter as Bragg reflection from a moving grating: fast for SRS, slow for SBS. */
function MirrorDiagram() {
  const row = (y: number, label: string, wave: string, shift: string, speed: string, wlS: number, gratingColor: string) => (
    <g>
      <path d={sine(20, 250, y - 22, 28, 9)} fill="none" stroke="#fbbf24" strokeWidth={3.5} />
      {head(266, y - 22, 1, '#fbbf24')}
      <path d={sine(24, 250, y + 24, wlS, 9)} fill="none" stroke="#22d3ee" strokeWidth={3.5} />
      {head(10, y + 24, -1, '#22d3ee')}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={284 + i * 14} y={y - 38} width={7} height={76} fill={gratingColor} opacity={0.35 + 0.45 * Math.abs(Math.sin(i * 0.5))} rx={2} />
      ))}
      <line x1={290} y1={y + 54} x2={420} y2={y + 54} stroke={gratingColor} strokeWidth={3} />
      {head(434, y + 54, 1, gratingColor)}
      <text x={448} y={y + 62} fill={gratingColor} style={svgText}>
        {speed}
      </text>
      <text x={470} y={y - 22} fill="#e8eaf6" style={{ ...svgText, fontWeight: 700 }}>
        {label}
      </text>
      <text x={470} y={y + 6} fill="#9aa0c9" style={svgText}>
        {wave}
      </text>
      <text x={470} y={y + 34} fill="#9aa0c9" style={svgText}>
        {shift}
      </text>
    </g>
  )
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 680 370" style={{ width: '100%', maxWidth: 620, display: 'block', margin: '0 auto' }} role="img" aria-label="The laser reflects from a moving density grating: a fast electron plasma wave for SRS, giving a large red shift, and a slow ion acoustic wave for SBS, giving a tiny shift">
        <text x={20} y={30} fill="#fbbf24" style={svgText}>laser →</text>
        <text x={20} y={158} fill="#22d3ee" style={svgText}>← reflected</text>
        {row(92, 'SRS', 'plasma wave', '351 → 545 nm', '0.24c', 44, '#4ade80')}
        {row(278, 'SBS', 'ion sound wave', '351 → 351.9 nm', '0.001c', 28.1, '#f472b6')}
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        Backscatter as Bragg reflection. The beat of the laser (amber) and the reflected light (cyan) writes a density grating whose wavenumber is the sum
        of theirs (half the laser’s wavelength for SBS, a little longer for SRS), which reflects the laser straight back. The grating is a plasma wave, so it moves away from the laser (at the speed
        shown), and the reflected light is Doppler-shifted down by the wave’s frequency: a lot for the fast electron plasma wave of SRS (here at
        0.1 n_c and 2 keV), very little for the slow ion wave of SBS.
      </figcaption>
    </figure>
  )
}

export const B6: Lesson = {
  id: 'B6',
  title: 'SRS and SBS',
  subtitle: 'Stimulated Raman and Brillouin scattering: growth rates, damping, gain and reflectivity, and why laser fusion cares',
  minutes: 60,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 7 (stimulated Raman scattering: growth rates, backscatter and sidescatter, the absolute instability near n_c/4, convective gain in a density gradient) and Ch. 8 (stimulated Brillouin scattering: weak and strong coupling, ion damping, gain in a flowing plasma)',
    'Kruer Ch. 11 (nonlinear features of underdense plasma instabilities: saturation, pump depletion and particle trapping)',
    'C. L. Tang, J. Appl. Phys. 37, 2945 (1966): the steady state of a backscatter amplifier with pump depletion',
    'Michel, Introduction to Laser-Plasma Interactions (Springer 2023): SRS, SBS and crossed-beam energy transfer',
    'Lindl, Inertial Confinement Fusion (Springer 1998): laser–plasma instabilities in indirect drive',
  ],
  objectives: [
    'Derive the SRS backscatter growth rate $\\gamma_0 = (kv_{os}/4)\\,\\omega_{pe}/\\sqrt{\\omega_{ek}\\omega_s}$ and the SBS rates in weak and strong coupling, and evaluate them in SI and in practical units (W/cm², µm, keV)',
    'Explain how Landau damping (electrons for SRS once $k\\lambda_{De} \\gtrsim 0.3$, ions for SBS through $ZT_e/T_i$) and the absolute instability near $n_c/4$ decide where each instability lives',
    'Estimate convective gains in density and flow gradients and the reflectivity, from noise amplification $\\varepsilon e^G$ to pump depletion and the Manley–Rowe limit $\\omega_s/\\omega_0$',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'angles', label: 'Back, side, forward' },
    { id: 'srs', label: 'Raman growth' },
    { id: 'sbs', label: 'Brillouin growth' },
    { id: 'map', label: 'Growth map' },
    { id: 'damping', label: 'Damping' },
    { id: 'quarter', label: 'Near n_c/4' },
    { id: 'gain', label: 'Gain' },
    { id: 'reflectivity', label: 'Reflectivity' },
    { id: 'icf', label: 'Why fusion cares' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          Shine a laser into a plasma and some of the light comes back, at a longer wavelength. B5 explained the mechanism in general: the laser
          beats with a weak scattered wave, the beat pushes electrons with the ponderomotive force (B4), the density ripple it makes scatters more
          laser light, and the loop runs away. This lesson puts in the plasma physics for the two scattering instabilities that matter most for
          laser fusion.
        </p>
        <p>
          Picture the ripple as a mirror the light writes for itself. A density grating with half the laser’s wavelength reflects light straight
          back, like the layers of a Bragg mirror, and the reflected light beats with the incoming light to deepen that same grating. But the grating
          is a plasma wave, so it moves, and light reflected from a moving mirror comes back Doppler-shifted. The shift is the frequency of the wave.
        </p>
        <MirrorDiagram />
        <p>
          In <strong>stimulated Raman scattering (SRS)</strong> the grating is an electron plasma wave. Its frequency is at least ω_pe, so the
          light gives up a large slice of its frequency: 351 nm light scattered at 0.1 n_c comes back near 545 nm. The plasma wave is fast, with a
          phase speed of about a quarter of c, and when it is damped it hands its energy to electrons of tens of keV.
        </p>
        <p>
          In <strong>stimulated Brillouin scattering (SBS)</strong> the grating is an ion acoustic wave, moving at the sound speed, about a
          thousandth of c. The light comes back with almost its own colour (less than a nanometre of shift at 351 nm) and carries away nearly all
          the energy the laser lost. SBS can turn a plasma into a good mirror.
        </p>
      </section>

      <section id="angles">
        <h2>Back, side and forward</h2>
        <p>
          Scattered light can leave in any direction. The matching conditions (B5) then fix the wavevector of the driven wave, k = k₀ − k_s,
          and its length depends on the angle θ between the scattered and incident light. For SBS, where |k_s| ≈ k₀, k ≈ 2k₀ sin(θ/2). For SRS,
          k runs from about ω_pe/c for forward scatter to about k₀ + k_s for backscatter.
        </p>
        <p>
          The drive is the ponderomotive push of the beat. It is a gradient, so it is proportional to k, and it is proportional to ê₀·ê_s, the
          overlap of the two light polarizations. So in a given plasma <strong>backscatter grows fastest</strong>: it has the largest k. Light
          scattered at 90° within the plane of the laser’s polarization is not driven at all. In a density gradient, though, light scattered at
          nearly right angles to the gradient stays matched over a longer path, so sidescatter can out-gain backscatter; the width of the beam
          then limits it (Kruer Ch. 7).
        </p>
        <p>
          Forward SRS grows slowly, but its plasma wave has a phase velocity close to c and can accelerate electrons to very high energies, the
          seed of laser wakefield acceleration in Track C. The formulas below are for backscatter, the light that the detectors around a target
          chamber see first.
        </p>
      </section>

      <section id="srs">
        <h2>The Raman growth rate</h2>
        <p>
          B5’s oscillator model needs two couplings: how a density ripple scatters light, and how the beat of two light waves drives the ripple.
          Both come from the electron fluid. We work in SI units and describe the light by its vector potential A, so that E = −∂A/∂t.
        </p>
        <Derivation
          lessonId="B6"
          id="srs-growth"
          title="The SRS growth rate from the electron fluid"
          steps={[
            {
              text: 'An electron in a light wave quivers with velocity v = eA/m_e, so the current is j = −n e v = −(ne²/m_e)A. Put this into the wave equation. The density n = n₀ + δn multiplies A, so a density ripple δn modulates the plasma’s refractive index.',
              math: '\\begin{gathered}\\Big(\\dfrac{\\partial^2}{\\partial t^2} - c^2\\nabla^2 + \\omega_{pe}^2\\Big)\\mathbf A \\\\ = -\\omega_{pe}^2\\,\\dfrac{\\delta n}{n_0}\\,\\mathbf A\\end{gathered}',
              why: 'With δn = 0 this is the light wave of B1, ω² = ω_pe² + c²k². The right side is the current of the extra electrons in the ripple, quivering in the laser: it radiates the scattered light at the beat frequency.',
            },
            {
              text: 'The ripple is driven by the ponderomotive force of the light, −∇(e²A²/2m_e) (B4). In A² = (A₀ + A_s)², only the cross term 2A₀·A_s beats at the plasma wave’s k and ω. Add it to the electron fluid equations that give the Bohm–Gross wave (A4, A5).',
              math: '\\begin{gathered}\\Big(\\dfrac{\\partial^2}{\\partial t^2} - 3v_{te}^2\\nabla^2 + \\omega_{pe}^2\\Big)\\delta n \\\\ = \\dfrac{n_0e^2}{m_e^2}\\,\\nabla^2(\\mathbf A_0\\cdot\\mathbf A_s)\\end{gathered}',
              why: 'Here v_te² = T_e/m_e. The force pushes electrons out of the bright fringes of the beat into the dark ones; with continuity, ∂²δn/∂t² = −n₀∇·(F/m_e), which gives the sign.',
            },
            {
              text: 'Fourier analyse. Write the pump as A₀ cos(k₀·x − ω₀t), so that v_os = eA₀/m_e is its peak quiver speed. A ripple at (k, ω) times the pump makes light at (k − k₀, ω − ω₀), the Stokes wave, and at (k + k₀, ω + ω₀), the anti-Stokes wave. Eliminating both leaves one dispersion relation.',
              math: '\\begin{gathered}\\omega^2 - \\omega_{ek}^2 = \\dfrac{k^2v_{os}^2\\,\\omega_{pe}^2}{4} \\\\ \\times\\Big[\\dfrac{1}{D(\\omega - \\omega_0,\\,\\mathbf k - \\mathbf k_0)} \\\\ +\\ \\dfrac{1}{D(\\omega + \\omega_0,\\,\\mathbf k + \\mathbf k_0)}\\Big] \\\\ D(\\omega, \\mathbf k) = \\omega^2 - c^2k^2 - \\omega_{pe}^2\\end{gathered}',
              why: 'ω_ek² = ω_pe² + 3k²v_te². D = 0 is the light dispersion relation, so a small D means a resonantly driven light wave. This is the full relation that the growth-rate map below solves by Newton’s method as a check. For other angles multiply the right side by (ê₀·ê_s)².',
            },
            {
              text: 'Near the Stokes resonance only the first term matters. Put ω = ω_ek + δ. The matching conditions make D(ω_ek − ω₀, k − k₀) = 0, so expand both sides to first order in δ.',
              math: '\\begin{gathered}\\omega^2 - \\omega_{ek}^2 \\approx 2\\omega_{ek}\\,\\delta \\\\ D(\\omega - \\omega_0,\\,\\mathbf k - \\mathbf k_0) \\approx -2\\omega_s\\,\\delta\\end{gathered}',
              why: 'ω − ω₀ ≈ −ω_s with ω_s = ω₀ − ω_ek: the scattered light sits on the negative-frequency branch of its dispersion relation, hence the minus sign. The anti-Stokes term is off resonance by about 2ω₀ and only shifts the frequency slightly. This is B5’s expansion, with the two daughters ω_s and ω_ek.',
            },
            {
              text: 'Multiply out: 2ω_ek δ × (−2ω_s δ) = k²v_os²ω_pe²/4, so δ² is negative and δ = ±iγ₀.',
              math: '\\gamma_0 = \\dfrac{k\\,v_{os}}{4}\\,\\dfrac{\\omega_{pe}}{\\sqrt{\\omega_{ek}\\,\\omega_s}}',
              why: 'Growth needs ω_ek and ω_s both positive, that is, matching with two real waves: no SRS above n_c/4. γ₀ ∝ v_os ∝ √I, as for every three-wave instability, and ∝ k, so backscatter, with the largest k, grows fastest.',
            },
            {
              text: 'At low density, for backscatter: k ≈ 2k₀, ω_ek ≈ ω_pe and ω_s ≈ ω₀. Since k₀v_os ≈ eE₀/m_ec,',
              math: '\\begin{gathered}\\gamma_0 \\approx \\dfrac{k_0v_{os}}{2}\\sqrt{\\dfrac{\\omega_{pe}}{\\omega_0}} \\\\ = \\dfrac{eE_0}{2m_ec}\\Big(\\dfrac{n}{n_c}\\Big)^{1/4}\\end{gathered}',
              why: 'In absolute units the growth depends only on the laser field and n/n_c. Relative to the laser frequency, γ₀/ω₀ ∝ λ√I, so infrared light drives Raman harder per optical cycle. With exact matching at 0.1 n_c and 2 keV the rate is 11% below this estimate (7% below if k₀ = √(1 − n/n_c) ω₀/c is kept).',
            },
          ]}
        />
        <Eq
          title="SRS backscatter growth rate"
          src="\begin{gathered}\s{g}{\gamma_0} = \dfrac{\s{k}{k}\,\s{vos}{v_{os}}}{4}\,\dfrac{\s{wp}{\omega_{pe}}}{\sqrt{\s{wek}{\omega_{ek}}\,\s{ws}{\omega_s}}} \\ \dfrac{v_{os}}{c} \approx 0.855\,\s{lam}{\lambda_{\mu m}}\sqrt{\dfrac{\s{I}{I}}{10^{18}\,\text{W/cm}^2}}\end{gathered}"
          plot="b6-srs-growth"
          symbols={{
            g: { name: 'γ₀, growth rate', units: 's⁻¹', note: 'Amplitude growth rate of the scattered light and the plasma wave in a uniform plasma, before damping.' },
            k: { name: 'k, plasma-wave wavenumber', units: 'm⁻¹', note: 'From the matching conditions: k = k₀ + k_s for backscatter. It falls from 2k₀ at low density to k₀ at n_c/4 (1.6k₀ at 0.1 n_c).' },
            vos: { name: 'v_os = eE₀/m_eω₀, peak quiver speed', units: 'm/s', note: 'Linear polarization, I = ½ε₀cE₀². Kruer uses the same peak quiver speed (in Gaussian units).' },
            wp: { name: 'ω_pe, electron plasma frequency', units: 'rad/s', note: 'ω_pe/ω₀ = √(n/n_c), with n_c ≈ 1.1×10²¹/λ_µm² cm⁻³.' },
            wek: { name: 'ω_ek, plasma-wave frequency', units: 'rad/s', note: 'Bohm–Gross: ω_ek² = ω_pe² + 3k²v_te², v_te² = T_e/m_e.' },
            ws: { name: 'ω_s = ω₀ − ω_ek, scattered-light frequency', units: 'rad/s', note: 'The backscattered wavelength is λ₀ω₀/ω_s.' },
            lam: { name: 'λ_µm, laser wavelength in µm', note: '0.351 for the frequency-tripled Nd:glass lasers used for fusion, 1.053 for the fundamental.' },
            I: { name: 'I, laser intensity', units: 'W/cm²', note: 'Practical form of v_os from B1: v_os/c ≈ 0.0095 at 10¹⁵ W/cm² and 351 nm.' },
          }}
          says="Raman grows as fast as the laser can shake electrons (v_os), times the plasma wave’s wavenumber, times a factor that measures how much of the coupling goes into the plasma wave rather than the light. At 351 nm, 10¹⁵ W/cm², 0.1 n_c and 2 keV it gives γ₀ = 2.4×10⁻³ ω₀ = 12.7 ps⁻¹."
        />
        <p>
          The worked example used throughout this lesson: 351 nm light at 10¹⁵ W/cm² in a plasma at 0.1 n_c (9×10²⁰ cm⁻³) and T_e = 2 keV.
          There v_os/c = 0.0095, and exact matching with the Bohm–Gross wave (B5’s triangle builder) gives k = 1.51 ω₀/c (1.59 k₀), ω_ek = 0.356 ω₀ and
          ω_s = 0.644 ω₀. So γ₀ = 2.37×10⁻³ ω₀ = 1.27×10¹³ s⁻¹: the scattered light e-folds every 79 fs, thousands of times within a nanosecond
          laser pulse. Something other than the linear growth rate must decide how much light comes back: damping, gradients and saturation,
          the subjects of the rest of this lesson.
        </p>
        <Plotter spec={plotById('b6-srs-growth')!} />
      </section>

      <section id="sbs">
        <h2>The Brillouin growth rate</h2>
        <p>
          SBS has the same structure, with the ion acoustic wave in place of the plasma wave. The ponderomotive force still pushes only on the
          electrons, but the charge separation it creates drags the ions along, so the ripple moves at the sound speed c_s, with
          c_s² = (ZT_e + 3T_i)/M, and responds with the ion plasma frequency ω_pi in place of ω_pe. One new feature appears: the ion wave’s
          frequency is so low that a strong laser can drive the ripple faster than it would oscillate on its own.
        </p>
        <Derivation
          lessonId="B6"
          id="sbs-regimes"
          title="SBS in weak and strong coupling"
          steps={[
            {
              text: 'With the electrons in pressure balance and the ions carrying the inertia, the beat drives the ion acoustic equation. The coupling is the electron one multiplied by Zm_e/M.',
              math: '\\begin{gathered}\\Big(\\dfrac{\\partial^2}{\\partial t^2} - c_s^2\\nabla^2\\Big)\\delta n \\\\ = \\dfrac{Zm_e}{M}\\,\\dfrac{n_0e^2}{m_e^2}\\,\\nabla^2(\\mathbf A_0\\cdot\\mathbf A_s)\\end{gathered}',
              why: 'Zm_e/M = ω_pi²/ω_pe² for n_e = Zn_i. The push on the electrons is handed to ions that are M/Zm_e times heavier, so the ripple is much harder to move but, being slow, much easier to drive resonantly.',
            },
            {
              text: 'Combine it with the Stokes light exactly as for Raman. Keep the ion factor whole, because the growth can be as large as kc_s, and expand only the light: D(ω − ω₀, k − k₀) ≈ −2ω₀(ω − kc_s). The result is a cubic.',
              math: '\\begin{gathered}(\\omega^2 - k^2c_s^2)(\\omega - kc_s) \\\\ = -\\dfrac{k^2v_{os}^2\\,\\omega_{pi}^2}{8\\,\\omega_0}\\end{gathered}',
              why: 'ω_s = ω₀ − kc_s ≈ ω₀ to within a part in a thousand. The growth-rate map solves this cubic exactly (Cardano), and the tests check it against the full dispersion relation in both limits.',
            },
            {
              text: 'Weak coupling, γ ≪ kc_s: then ω² − k²c_s² ≈ 2kc_s(ω − kc_s) and the cubic becomes a quadratic in ω − kc_s.',
              math: '\\gamma_{\\rm w} = \\dfrac{k\\,v_{os}}{4}\\,\\dfrac{\\omega_{pi}}{\\sqrt{kc_s\\,\\omega_0}}',
              why: 'The Raman formula with ω_pe → ω_pi and ω_ek → kc_s. The small kc_s in the denominator is why SBS is strong: slow waves are easy to drive (B5’s 1/ω₂). For k = 2k₀ this is Kruer’s γ = k₀v_osω_pi/[2√2 √(ω₀k₀c_s)].',
            },
            {
              text: 'Strong coupling, γ ≫ kc_s: the sound speed drops out and ω³ = −k²v_os²ω_pi²/8ω₀. Take the cube root with a positive imaginary part.',
              math: '\\begin{gathered}\\omega = \\Big(\\dfrac{k^2v_{os}^2\\omega_{pi}^2}{8\\,\\omega_0}\\Big)^{1/3} \\\\ \\times\\Big(\\dfrac12 + i\\,\\dfrac{\\sqrt3}{2}\\Big) \\\\ \\gamma_{\\rm s} = \\dfrac{\\sqrt3}{4}\\Big(\\dfrac{k^2v_{os}^2\\,\\omega_{pi}^2}{\\omega_0}\\Big)^{1/3}\\end{gathered}',
              why: 'The ripple is no longer a free sound wave but a driven quasi-mode, with a frequency set by the pump. Growth now rises only as the cube root of I. The crossover, γ_w ≈ kc_s, comes at high intensity, low temperature and high density.',
            },
          ]}
        />
        <Eq
          title="SBS growth rates"
          src="\begin{gathered}\s{gw}{\gamma_{\rm w}} = \dfrac{\s{k}{k}\,\s{vos}{v_{os}}}{4}\,\dfrac{\s{wpi}{\omega_{pi}}}{\sqrt{k\s{cs}{c_s}\,\s{w0}{\omega_0}}} \\ \s{gs}{\gamma_{\rm s}} = \dfrac{\sqrt3}{4}\Big(\dfrac{k^2v_{os}^2\,\omega_{pi}^2}{\omega_0}\Big)^{1/3}\end{gathered}"
          plot="b6-sbs-growth"
          symbols={{
            gw: { name: 'γ_w, weak-coupling growth rate', units: 's⁻¹', note: 'Valid while γ_w ≪ kc_s. Proportional to √I.' },
            k: { name: 'k, ion-wave wavenumber', units: 'm⁻¹', note: 'k ≈ 2k₀ = 2(ω₀/c)√(1 − n/n_c) for backscatter.' },
            vos: { name: 'v_os, peak quiver speed', units: 'm/s', note: 'v_os/c ≈ 0.855 λ_µm √(I/10¹⁸ W/cm²).' },
            wpi: { name: 'ω_pi, ion plasma frequency', units: 'rad/s', note: 'ω_pi² = n_eZe²/(ε₀M) = ω_pe² Zm_e/M.' },
            cs: { name: 'c_s, ion sound speed', units: 'm/s', note: 'c_s² = (ZT_e + 3T_i)/M; about 3.9×10⁵ m/s in CH at T_e = 2 keV, T_i = 1 keV.' },
            w0: { name: 'ω₀, laser frequency', units: 'rad/s', note: 'Stands in for ω_s, which differs from it by kc_s, a part in a thousand.' },
            gs: { name: 'γ_s, strongly coupled growth rate', units: 's⁻¹', note: 'Valid when γ ≫ kc_s. Proportional to the cube root of I, and independent of the temperature.' },
          }}
          says="In weak coupling the ion wave is a real sound wave, and its low frequency kc_s makes it easy to drive. In strong coupling the laser drives the ions faster than sound can respond, and growth rises only as the cube root of the intensity."
        />
        <p>
          The worked example in a CH plasma (Z = 3.5, A = 6.5 on average) with T_i = 1 keV: k = 1.895 ω₀/c and c_s = 3.9×10⁵ m/s, so
          kc_s = 2.4×10⁻³ ω₀, the red shift of the light, 0.86 nm. The weak-coupling rate is γ = 5.0×10⁻⁴ ω₀ = 2.7 ps⁻¹, five times slower than
          Raman in the same plasma, and γ/kc_s = 0.20: weak coupling. SBS grows more slowly, but it can happen at any density below n_c, and its
          slow ion wave gives it a large convective gain, as we will see.
        </p>
        <Plotter spec={plotById('b6-sbs-growth')!} />
      </section>

      <section id="map">
        <h2>The growth-rate map</h2>
        <p>
          Where in a laser plasma does each instability live? The map evaluates the backscatter growth rate at every density and electron
          temperature for the laser you choose, solving the matching conditions exactly at each point. Overlaid are the line where Landau damping
          switches on for SRS (kλ_De = 0.3), the boundary of strong coupling for SBS, and the line where the convective gain over your chosen
          scale length reaches G*. Damping and gain are the subjects of the next sections; the map is here so you can come back to it.
        </p>
        <GrowthMapSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>The benchmark.</strong> The marked point is the worked example. It reads γ₀ = 12.7 ps⁻¹, and an independent Newton solution of
            the full dispersion relation (Stokes and anti-Stokes) agrees to better than 0.01%.
          </li>
          <li>
            <strong>Landau damping.</strong> Toggle damping for SRS. To the left of the cyan line the colour collapses: at low density and high
            temperature the plasma wave is damped faster than it can grow.
          </li>
          <li>
            <strong>Wavelength.</strong> At the same intensity, 1053 nm light has γ/ω₀ three times larger than 351 nm light, and the white gain
            contour moves far across the map. Gains scale as IλL.
          </li>
          <li>
            <strong>Strong coupling.</strong> Switch to SBS. The green line cuts off the cold, dense corner, where SBS is strongly coupled; raise the
            intensity and it sweeps across the map.
          </li>
        </ul>
      </section>

      <section id="damping">
        <h2>Damping: what holds them back</h2>
        <p>
          In a uniform plasma the scattered light is barely damped, so B5’s threshold γ₀² = Γ₁Γ₂ is very low and both instabilities grow at
          almost any intensity. Damping of the plasma or ion wave still matters a great deal. With the wave damped at ν ≫ γ₀, the growth rate
          falls from γ₀ to about γ₀²/ν (B5’s pumped oscillators with one heavily damped daughter), and the gain of a uniform slab of length L
          becomes 2γ₀²L/(νv_s), where v_s is the scattered light’s group velocity. The amplification simulation further down measures exactly this.
        </p>
        <p>
          <strong>Electron Landau damping limits SRS.</strong> A plasma wave is damped by electrons moving near its phase speed ω/k (A9). How
          many there are is set by kλ_De: for Maxwellian electrons the exact kinetic root gives ν/ω_pe = 0.013 at kλ_De = 0.3, 0.066 at 0.4 and
          0.15 at 0.5. Raman growth rates are of order 10⁻² ω_pe, so SRS is effectively switched off once kλ_De passes about 0.3. The backscatter k
          changes only slowly with density (between 2k₀ and k₀), while λ_De grows with T_e and falls with density, so SRS is confined to densities above a floor that rises
          with temperature: at 3 keV, kλ_De reaches 0.3 at about 0.13 n_c. In the worked example (kλ_De = 0.30), damping already cuts the growth
          from 12.7 to 6.0 ps⁻¹.
        </p>
        <p>
          The damped energy goes to electrons moving near the phase speed, about 0.24c at 0.1 n_c: SRS makes hot electrons of tens of keV, which
          B8 follows. A large plasma wave also traps the resonant electrons and flattens the distribution where they sit, which can reduce the
          damping and let SRS grow beyond what linear theory predicts (Kruer Ch. 11).
        </p>
        <Eq
          title="Ion Landau damping of the SBS ion wave"
          src="\begin{gathered}\dfrac{\s{nu}{\nu_i}}{\s{w}{kc_s}} \approx \sqrt{\dfrac{\pi}{8}}\Big[\sqrt{\dfrac{\s{Z}{Z}\,\s{me}{m_e}}{\s{M}{M}}} \\ +\ \Big(\s{R}{\dfrac{ZT_e}{T_i}}\Big)^{3/2}e^{-ZT_e/2T_i\, -\, 3/2}\Big]\end{gathered}"
          symbols={{
            nu: { name: 'ν_i, ion-wave damping rate', units: 's⁻¹', note: 'Amplitude damping rate, from electrons and ions moving near the phase speed c_s.' },
            w: { name: 'kc_s, ion-wave frequency', units: 'rad/s', note: 'c_s² = (ZT_e + 3T_i)/M.' },
            Z: { name: 'Z, ion charge', note: 'Gold in a hohlraum wall is ionized to Z of about 40–50; CH has an average of 3.5.' },
            me: { name: 'm_e, electron mass', units: 'kg', note: 'The first term is electron Landau damping: small, because electrons are so fast that few move as slowly as c_s.' },
            M: { name: 'M, ion mass', units: 'kg', note: 'A × 1.66×10⁻²⁷ kg.' },
            R: { name: 'ZT_e/T_i', note: 'The control parameter. Large (hot electrons, cold ions) means c_s far above the ion thermal speed and almost no ion damping. This small-damping formula for a single ion species is fair for ZT_e/T_i ≳ 3; below that the wave is heavily damped and needs the full kinetic root.' },
          }}
          says="An ion wave is damped by the particles that can surf it. Electrons contribute a small term set by the mass ratio. Ions contribute a term that is exponentially small when ZT_e ≫ T_i, because the wave then outruns almost every ion. In the CH example (ZT_e/T_i = 7) it gives ν_i/kc_s = 0.089; at 20 it is 0.011."
        />
        <p>
          <strong>Ion Landau damping limits SBS.</strong> This is why SBS is worst in high-Z plasmas such as a hohlraum’s gold wall: the electrons
          are hot, the ions comparatively cold and highly charged, ZT_e/T_i is large and almost nothing damps the ion wave. Mixtures help. In CH,
          the hydrogen ions are light, so at the same temperature their thermal speed sits much closer to the sound speed of the mixture, and they
          damp the ion wave far more strongly than the single-species formula above suggests. Adding a light species (hydrogen or helium) to a
          heavy plasma is a standard way to raise ion damping and so lower SBS.
        </p>
      </section>

      <section id="quarter">
        <h2>Near n_c/4: absolute Raman</h2>
        <p>
          At n_c/4 the backscattered Raman light is born at its own cut-off: ω_s = ω_pe, so k_s → 0 and its group velocity v_s = c²k_s/ω_s → 0.
          The cold gain formula below, which keeps only the plasma wave’s κ′, diverges there; more fundamentally, the scattered light no longer leaves
          the region where it is driven, so the convective picture behind Rosenbluth’s gain fails. The instability becomes <strong>absolute</strong>, growing in time at a fixed place until something nonlinear stops it. Kruer (Ch. 7) works out
          the threshold in a linear density profile. Its scaling is (v_os/c)² of order (k₀L)^(−4/3), which for a 300 µm scale length at 351 nm
          means intensities of order 10¹⁴ W/cm², easily exceeded. The same density hosts two-plasmon decay, where the laser decays into two
          plasma waves; it is B7’s subject.
        </p>
      </section>

      <section id="gain">
        <h2>Gain in real plasmas</h2>
        <p>
          A laser corona is not uniform. For SRS, the density gradient detunes the waves away from the matching point, and the Rosenbluth gain of
          B5 applies. The mismatch gradient κ′ is dominated by the plasma wave, whose wavenumber at fixed frequency is very sensitive to density.
          For SBS, the ion wave hardly cares about the density, but the corona flows outwards at about the sound speed, and a gradient in the
          flow Doppler-shifts the ion wave out of resonance. The same calculation, with the flow gradient in place of the density gradient, gives
          the SBS gain. Both are independent of the damping, as B5 showed.
        </p>
        <Eq
          title="Convective gains of SRS and SBS"
          src="\begin{gathered}\s{Gr}{G_{\rm SRS}} \approx \dfrac{\pi}{4}\,\dfrac{\s{k}{k}^2\s{vos}{v_{os}^2}}{\s{ks}{k_s}\,c^2}\,\s{L}{L} \\ \s{Gb}{G_{\rm SBS}} \approx \dfrac{\pi}{8}\,\dfrac{v_{os}^2}{\s{vte}{v_{te}^2}}\,\dfrac{\s{n}{n}}{n_c}\,\dfrac{\omega_0\s{Lu}{L_u}}{c} \\ \times\dfrac{1}{\sqrt{1 - n/n_c}\,(1 + 3T_i/ZT_e)}\end{gathered}"
          plot="b6-rosenbluth-gain"
          symbols={{
            Gr: { name: 'G_SRS, Raman gain exponent', note: 'Intensity gain exp(G) across the matching region in a linear density profile. This is the cold-plasma form, where the plasma wave dominates κ′; the plotter and map use the full κ′ (1.62 rather than 1.5 in the worked example).' },
            k: { name: 'k = k₀ + k_s, plasma-wave wavenumber', units: 'm⁻¹', note: 'From the matching conditions.' },
            vos: { name: 'v_os, peak quiver speed', units: 'm/s', note: 'v_os² ∝ Iλ².' },
            ks: { name: 'k_s, scattered-light wavenumber', units: 'm⁻¹', note: 'Goes to zero at n_c/4, where G_SRS blows up and the instability turns absolute.' },
            L: { name: 'L = n/(dn/dx), density scale length', units: 'm', note: 'Typically hundreds of µm in a laser fusion corona.' },
            Gb: { name: 'G_SBS, Brillouin gain exponent', note: 'For a linear flow profile u(x), the flow changing by c_s over L_u. Uses the weak-coupling growth rate.' },
            vte: { name: 'v_te = √(T_e/m_e), electron thermal speed', units: 'm/s', note: '(v_os/v_te)² is the ratio of quiver to thermal energy.' },
            n: { name: 'n, electron density at the matching point', units: 'm⁻³', note: 'n_c ≈ 1.1×10²¹/λ_µm² cm⁻³.' },
            Lu: { name: 'L_u = c_s/(du/dx), velocity scale length', units: 'm', note: 'The distance over which the flow speed changes by one sound speed.' },
          }}
          says="Both gains are proportional to Iλ² × (L/λ), that is, to IλL: longer wavelengths and longer plasmas make more scattering at the same intensity. In the worked example with L = L_u = 300 µm, G_SRS = 1.6 and G_SBS = 3.6 (CH, ZT_e/T_i = 7)."
        />
        <p>
          The same plasma at 1053 nm has three times the gain at the same intensity, and the plasmas of fusion targets are millimetres long, several
          times the 300 µm used here. That is why these instabilities are a design constraint rather than a curiosity.
        </p>
        <Plotter spec={plotById('b6-rosenbluth-gain')!} />
      </section>

      <section id="reflectivity">
        <h2>How much light comes back</h2>
        <p>
          A gain multiplies a seed. With no external seed, the seed is the thermal fluctuation level of the plasma: a tiny fraction ε of the laser
          is scattered by density fluctuations that are always there, and the reflectivity is r ≈ ε exp(G) while it stays small. But r cannot exceed
          what the laser supplies. As ε exp(G) approaches 1, the scattered light depletes the pump near the entrance, the gain the later light sees is
          reduced, and the reflectivity saturates. For a strongly damped plasma wave in a uniform slab this steady state has a closed form.
        </p>
        <Eq
          title="Reflectivity with pump depletion"
          src="\begin{gathered}\s{r}{r}\,(1 - r + \s{eps}{\varepsilon}) = \varepsilon\,e^{\s{G}{G}(1 - r)} \\ \s{RE}{R_E} = \dfrac{\s{ws}{\omega_s}}{\omega_0}\,r\end{gathered}"
          symbols={{
            r: { name: 'r, photon reflectivity', note: 'Backscattered photon flux as a fraction of the incident laser photon flux, at the entrance of the slab.' },
            eps: { name: 'ε, seed level', note: 'The scattered photon flux entering at the far side, relative to the laser. From noise, ε is very small.' },
            G: { name: 'G, small-signal gain exponent', note: 'For a uniform slab with a strongly damped daughter, G = 2γ₀²L/(νv_s). With a gradient, the Rosenbluth gain plays the same role.' },
            RE: { name: 'R_E, energy reflectivity', note: 'What a calorimeter measures.' },
            ws: { name: 'ω_s, scattered-light frequency', units: 'rad/s', note: 'Each reflected photon carries ħω_s; the rest of ħω₀ went into a plasmon or phonon (Manley–Rowe, B5). About 0.64 ω₀ for SRS at 0.1 n_c, and practically ω₀ for SBS.' },
          }}
          says="While r is small this is r = ε exp(G), exponential amplification of the seed. When ε exp(G) approaches 1 the pump is used up near the entrance and r saturates below 1, creeping towards 1 only slowly as G grows. For SRS at 0.1 n_c about a third of the energy the laser loses goes into plasma waves, not reflected light."
        />
        <ThreeWaveSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>Convective amplifier.</strong> The seed enters at the far side and grows as it crosses the slab. After a few transit times the
            reflectivity settles at ε exp(G) with G = 2γ₀²L/ν = 8; the measured gain agrees to better than 0.1%, and Manley–Rowe holds to about 10⁻⁹.
          </li>
          <li>
            <strong>Pump depletion.</strong> At γ₀ = 0.14 the small-signal estimate would reflect more than six times the incident light. Instead r
            settles at Tang’s 0.23, after a few relaxation oscillations, and the amber pump profile is eaten from the left.
          </li>
          <li>
            <strong>Less damping.</strong> Lower ν towards γ₀. The undepleted gain 2γ₀²L/ν soars, but the reflectivity stops settling and pulses
            instead.
          </li>
          <li>
            <strong>Temporal growth.</strong> In a periodic box nothing leaves, so the daughters grow in time at γ₀ (or −ν/2 + √(ν²/4 + γ₀²) with
            damping) until the pump is empty; then they hand the energy back, while |a₀|² + |a₁|² stays constant.
          </li>
          <li>
            <strong>Noise.</strong> A random seed gives the bursty, spiky reflectivity seen in experiments and in particle simulations.
          </li>
        </ul>
      </section>

      <section id="icf">
        <h2>Why laser fusion cares</h2>
        <ul>
          <li>
            <strong>Lost drive.</strong> Light scattered back out of a target, or out of a hohlraum’s laser entrance holes, heats nothing.
            Large laser facilities routinely measure the backscattered Raman and Brillouin light for this reason.
          </li>
          <li>
            <strong>Hot electrons.</strong> SRS plasma waves (and two-plasmon decay, B7) accelerate electrons to tens of keV. They can reach the cold
            fuel ahead of the compression and preheat it, which makes it harder to compress (B8).
          </li>
          <li>
            <strong>Wavelength.</strong> Growth rates in units of ω₀ scale as λ√I and gains as IλL, while collisional absorption improves at short
            wavelength (B2). This is a main reason fusion lasers convert their 1053 nm Nd:glass light to the third harmonic, 351 nm.
          </li>
          <li>
            <strong>Beam smoothing.</strong> Phase plates, smoothing by spectral dispersion and polarization smoothing break each beam into small
            speckles that change in time, so that no patch of the plasma is driven both hard enough and long enough to reach a large gain.
          </li>
          <li>
            <strong>Crossed-beam energy transfer (CBET).</strong> Where two beams cross in a flowing plasma, their beat drives an ion acoustic wave
            that moves energy from one beam to the other: SBS seeded by the second beam. At the National Ignition Facility, small wavelength offsets
            between beam cones use this on purpose to tune the symmetry of indirect-drive implosions (Michel and co-workers, 2009). In direct drive,
            CBET instead scatters light around the target and lowers the energy that reaches it.
          </li>
        </ul>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          B7 takes the other two instabilities of the underdense corona: two-plasmon decay, in which the laser decays into two plasma waves near
          n_c/4, and filamentation, in which the ponderomotive force and heating make a beam focus itself (Kruer §8.4). B8 follows the hot
          electrons that SRS and two-plasmon decay produce, and B9 the particle-in-cell simulations that capture all of these effects at once,
          including the nonlinear saturation that linear theory leaves out.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B6-p1',
      kind: 'numeric',
      concept: 'srs-growth-rate',
      prompt: 'A 1053 nm laser at $10^{14}$ W/cm² drives SRS backscatter at $n = 0.05\\,n_c$. Using cold-plasma matching ($\\omega_{ek} \\approx \\omega_{pe}$), find the growth rate $\\gamma_0$ in ps⁻¹.',
      answer: 3.71,
      tol: 0.03,
      unit: 'ps⁻¹',
      hints: [
        '$v_{os}/c = 0.855\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}} = 0.0090$. In units of $\\omega_0$: $\\omega_{pe} = \\sqrt{0.05} = 0.224$ and $\\omega_s = 0.776$.',
        'Get $ck_s$ from $\\omega_s^2 = \\omega_{pe}^2 + c^2k_s^2$ and $k = k_0 + k_s$ with $ck_0 = \\sqrt{0.95}\\,\\omega_0$. Then use $\\gamma_0 = (kv_{os}/4)\\,\\omega_{pe}/\\sqrt{\\omega_{ek}\\omega_s}$ and $\\omega_0 = 2\\pi c/\\lambda = 1.79\\times10^{15}$ s⁻¹.',
      ],
      solution: 'In units of $\\omega_0$ and $\\omega_0/c$: $k_s = \\sqrt{0.776^2 - 0.05} = 0.743$ and $k_0 = 0.975$, so $k = 1.718$. Then $\\gamma_0/\\omega_0 = (1.718\\times0.0090/4)\\times0.224/\\sqrt{0.224\\times0.776} = 3.87\\times10^{-3}\\times0.537 = 2.08\\times10^{-3}$, and $\\gamma_0 = 2.08\\times10^{-3}\\times1.79\\times10^{15} = 3.7\\times10^{12}$ s⁻¹ = 3.7 ps⁻¹. With $T_e = 1$ keV, the Bohm–Gross correction lowers it by 7%, to 3.5 ps⁻¹.',
    },
    {
      id: 'B6-p2',
      kind: 'numeric',
      concept: 'sbs-strong-coupling',
      prompt: 'SBS backscatter of 351 nm light in a helium plasma ($Z = 2$, $A = 4$) at $0.2\\,n_c$, with $T_e = 1$ keV and $T_i = 0.25$ keV. Above what intensity is it strongly coupled, i.e. the weak-coupling rate exceeds $kc_s$? Use $k \\approx 2k_0$, $\\omega_s \\approx \\omega_0$ and $c_s^2 = (ZT_e + 3T_i)/M$. Give the answer in units of $10^{15}$ W/cm².',
      answer: 3.67,
      tol: 0.03,
      unit: '×10¹⁵ W/cm²',
      hints: [
        'Set $\\gamma_{\\rm w} = kc_s$ in the weak-coupling formula: $v_{os}^2 = 16\\,k\\,c_s^3\\,\\omega_0/\\omega_{pi}^2$.',
        'In units of $\\omega_0$ and $c$: $\\omega_{pi}^2 = (n/n_c)\\,Zm_e/M$. Then invert $v_{os}/c = 0.855\\,\\lambda_{\\mu m}\\sqrt{I/10^{18}\\ \\text{W/cm}^2}$.',
      ],
      solution: '$c_s = \\sqrt{2.75\\ \\text{keV}/(4\\times1.66\\times10^{-27}\\ \\text{kg})} = 2.58\\times10^5$ m/s, so $c_s/c = 8.59\\times10^{-4}$. $k = 2\\sqrt{0.8} = 1.789\\,\\omega_0/c$ and $\\omega_{pi}^2/\\omega_0^2 = 0.2\\times2\\times5.49\\times10^{-4}/4 = 5.49\\times10^{-5}$. Then $(v_{os}/c)^2 = 16\\times1.789\\times(8.59\\times10^{-4})^3/5.49\\times10^{-5} = 3.31\\times10^{-4}$, $v_{os}/c = 0.0182$, and $I = 10^{18}\\times(0.0182/(0.855\\times0.351))^2 = 3.7\\times10^{15}$ W/cm². Above this the ion response is a driven quasi-mode and γ grows only as $I^{1/3}$.',
    },
    {
      id: 'B6-p3',
      kind: 'numeric',
      concept: 'convective-gain-scaling',
      prompt: 'In the worked example (351 nm, $10^{15}$ W/cm², $0.1\\,n_c$, 2 keV, $L = 300$ µm) the SRS Rosenbluth gain is $G = 1.62$. What is the gain for a 1053 nm laser at $5\\times10^{14}$ W/cm² in a plasma with the same $n/n_c$ and $T_e$ but $L = 500$ µm?',
      answer: 4.05,
      tol: 0.03,
      unit: '',
      hints: [
        'In units of $\\omega_0$ and $c/\\omega_0$, at fixed $n/n_c$ and $T_e$ the matching is unchanged; $\\gamma_0/\\omega_0 \\propto v_{os}/c$ and $\\kappa\' \\propto 1/L$, with $L$ measured in $c/\\omega_0 \\propto \\lambda$.',
        '$v_{os}^2 \\propto I\\lambda^2$, so $G \\propto I\\lambda^2 \\times L/\\lambda = I\\lambda L$.',
      ],
      solution: '$G \\propto I\\lambda L$, so $G = 1.62\\times0.5\\times3\\times(500/300) = 4.05$. The amplification $e^G$ goes from 5 to 57. This scaling, together with better absorption, is why fusion lasers use 351 nm light.',
    },
    {
      id: 'B6-p4',
      kind: 'numeric',
      concept: 'pump-depletion',
      prompt: 'A uniform slab with strongly damped plasma waves has small-signal SRS gain $G = 25$, and the noise entering at the far side is $\\varepsilon = 10^{-9}$ of the laser photon flux. The scattered light is SRS from $0.1\\,n_c$, with $\\omega_s = 0.644\\,\\omega_0$. Using Tang’s steady state, what percentage of the laser energy is reflected?',
      answer: 15.4,
      tol: 0.03,
      unit: '%',
      hints: [
        '$\\varepsilon e^G = 72 \\gg 1$, so the pump is depleted. Take logs of Tang’s equation and iterate $r \\leftarrow 1 - [\\ln r + \\ln(1 - r + \\varepsilon) - \\ln\\varepsilon]/G$, starting from $r = 0.5$.',
        'Energy reflectivity $= (\\omega_s/\\omega_0)\\times$ photon reflectivity (Manley–Rowe).',
      ],
      solution: 'The iteration gives 0.227, 0.241, 0.239 and converges to $r = 0.239$: about a quarter of the laser photons come back. Each carries 0.644 of a laser photon’s energy, so the energy reflectivity is $0.644\\times0.239 = 15.4\\%$. Another $0.356\\times0.239 = 8.5\\%$ of the laser energy went into plasma waves, and from them into hot electrons. The undepleted estimate, $\\varepsilon e^G = 72$, would be absurd.',
    },
    {
      id: 'B6-p5',
      kind: 'mcq',
      concept: 'ion-landau-damping',
      prompt: 'Which change most increases the ion Landau damping of SBS ion acoustic waves in a hohlraum’s gold wall plasma?',
      options: [
        'Raising the electron temperature while the ions stay cold',
        'Adding a light ion species such as helium or hydrogen',
        'Using a longer laser wavelength',
        'Making the density scale length longer',
      ],
      correct: 1,
      hints: ['Damping comes from ions moving at about the wave’s phase speed $c_s$. Compare $c_s$ with the thermal speed of gold ions and of light ions.'],
      solution: 'In gold, $ZT_e/T_i$ is large, so $c_s$ is far above the thermal speed of the heavy, cold gold ions and almost none resonate. A light species has a much higher thermal speed at the same temperature, close to the sound speed of the mixture, and damps the wave strongly. Raising $T_e$ at fixed $T_i$ increases $ZT_e/T_i$ and reduces the damping; the wavelength and the scale length change the gain, not the damping.',
    },
    {
      id: 'B6-p6',
      kind: 'mcq',
      concept: 'srs-landau-cutoff',
      prompt: 'A 351 nm laser heats a long underdense plasma to $T_e \\approx 3$ keV, with densities from $0.02\\,n_c$ up past $n_c/4$. The Raman backscatter spectrum runs from about 590 nm to 710 nm, with nothing at shorter wavelengths. Why is there no Raman light below 590 nm?',
      options: [
        'SRS backscatter cannot be matched below about 0.13 n_c',
        'Below about 0.13 n_c the plasma waves have kλ_De above 0.3 and are strongly Landau damped',
        'Raman light from low density is reabsorbed by inverse bremsstrahlung on the way out',
        'At low density the light is scattered by SBS instead',
      ],
      correct: 1,
      hints: ['Which density does 590 nm come from (B5’s wavelength plot)? Work out $k\\lambda_{De}$ there, with $k \\approx 1.5k_0$ and $v_{te}^2/c^2 = 3/511$.'],
      solution: 'Matching works at every density below $n_c/4$, and 590 nm comes from about $0.13\\,n_c$. At 3 keV that is exactly where $k\\lambda_{De}$ reaches 0.3. At lower densities the plasma wave’s k changes little while $\\lambda_{De}$ grows, so $k\\lambda_{De}$ rises (0.36 at $0.1\\,n_c$, 0.56 at $0.05\\,n_c$) and Landau damping stops the growth. The short-wavelength edge of a Raman spectrum is a thermometer for $T_e$. Absorption is weakest at low density, and SBS light comes back within a nanometre of 351 nm.',
    },
  ],
  cards: [
    { id: 'B6-c1', front: 'SRS and SBS: which wave is driven, and where can each occur?', back: 'SRS: an electron plasma wave, only for $n \\le n_c/4$, large red shift ($\\omega_s = \\omega_0 - \\omega_{ek}$). SBS: an ion acoustic wave, anywhere $n < n_c$, tiny shift $kc_s$' },
    { id: 'B6-c2', front: 'SRS backscatter growth rate (and a number)', back: '$\\gamma_0 = \\dfrac{kv_{os}}{4}\\dfrac{\\omega_{pe}}{\\sqrt{\\omega_{ek}\\omega_s}}$; about 12.7 ps⁻¹ at 351 nm, $10^{15}$ W/cm², $0.1\\,n_c$, 2 keV' },
    { id: 'B6-c3', front: 'SBS growth in weak and strong coupling', back: 'Weak ($\\gamma \\ll kc_s$): $\\gamma = \\dfrac{kv_{os}}{4}\\dfrac{\\omega_{pi}}{\\sqrt{kc_s\\omega_0}} \\propto \\sqrt I$. Strong: $\\gamma = \\dfrac{\\sqrt3}{4}\\Big(\\dfrac{k^2v_{os}^2\\omega_{pi}^2}{\\omega_0}\\Big)^{1/3} \\propto I^{1/3}$' },
    { id: 'B6-c4', front: 'When does Landau damping switch off SRS, and where does the energy go?', back: 'Once the plasma wave has $k\\lambda_{De} \\gtrsim 0.3$ ($\\nu/\\omega_{pe}$ = 0.013 at 0.3, 0.15 at 0.5): low density, high $T_e$. The damped wave’s energy goes to hot electrons of tens of keV' },
    { id: 'B6-c5', front: 'Convective gains of SRS and SBS and their scaling', back: 'Rosenbluth: $G = 2\\pi\\gamma_0^2/|\\kappa\'v_1v_2|$. SRS in a density gradient, $G \\approx \\frac{\\pi}{4}\\frac{k^2v_{os}^2}{k_sc^2}L$; SBS in a flow gradient. Both $\\propto I\\lambda L$ and independent of damping' },
    { id: 'B6-c6', front: 'Reflectivity: noise, pump depletion and Manley–Rowe', back: 'Small signal $r = \\varepsilon e^G$. Depleted (Tang): $r(1 - r + \\varepsilon) = \\varepsilon e^{G(1-r)}$. Energy reflectivity $= (\\omega_s/\\omega_0)\\,r$: at most 64% of the depleted energy for SRS at $0.1\\,n_c$, nearly all for SBS' },
  ],
}
