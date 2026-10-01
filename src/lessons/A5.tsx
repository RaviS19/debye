import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { DispersionSim } from '../sims/DispersionSim'
import { WavePacketSim } from '../sims/WavePacketSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const A5: Lesson = {
  id: 'A5',
  title: 'Electrostatic waves',
  subtitle: 'Electron plasma waves, ion acoustic waves and the hybrid frequencies',
  minutes: 55,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 4, first half (representation of waves, group velocity, electron plasma waves, ion waves, electrostatic waves perpendicular to B)',
    'Bellan, Fundamentals of Plasma Physics, Ch. 4 (elementary plasma waves)',
    'Stix, Waves in Plasmas, for the cold-plasma hybrid resonances',
  ],
  objectives: [
    'Tell phase velocity from group velocity and compute both from a dispersion relation $\\omega(k)$',
    'Derive the Bohm–Gross and ion acoustic dispersion relations from the two-fluid equations',
    'Estimate the upper hybrid, lower hybrid and ion cyclotron frequencies of a magnetized plasma',
  ],
  sections: [
    { id: 'waves', label: 'Describing waves' },
    { id: 'epw', label: 'Electron plasma waves' },
    { id: 'ion', label: 'Ion acoustic waves' },
    { id: 'explorer', label: 'Dispersion explorer' },
    { id: 'perp', label: 'Across B' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="waves">
        <h2>Describing waves</h2>
        <p>
          Any small disturbance of a uniform plasma can be split into sinusoids, <M>{'e^{i(kx - \\omega t)}'}</M>. For each wavenumber{' '}
          <M>{'k'}</M> the plasma allows only certain frequencies <M>{'\\omega'}</M>. That rule, <M>{'\\omega(k)'}</M>, is the{' '}
          <strong>dispersion relation</strong>, the plasma’s fingerprint. This whole lesson is about finding dispersion relations and
          reading them.
        </p>
        <p>
          Two speeds come out of <M>{'\\omega(k)'}</M>. The crests of a single sinusoid move at the phase velocity. A pulse is a
          group of sinusoids with nearby <M>{'k'}</M>; where their crests line up they add, and that bright spot moves at the group velocity.
          Energy and information travel with the group.
        </p>
        <Eq
          title="Phase and group velocity"
          src="\s{vp}{v_\varphi} = \dfrac{\s{w}{\omega}}{\s{k}{k}}, \qquad \s{vg}{v_g} = \dfrac{d\s{w}{\omega}}{d\s{k}{k}}"
          symbols={{
            vp: { name: 'v_φ, phase velocity', units: 'm/s', note: 'Speed of a crest. It can be larger than c (light in a plasma, A6) without breaking relativity, because a crest carries no information.' },
            w: { name: 'ω, angular frequency', units: 'rad/s', note: 'How fast the phase advances at a fixed point.' },
            k: { name: 'k, wavenumber', units: 'rad/m', note: 'k = 2π/wavelength.' },
            vg: { name: 'v_g, group velocity', units: 'm/s', note: 'Speed of the envelope of a packet, and of the energy it carries. It is the slope of the ω(k) curve.' },
          }}
          says="On a plot of ω against k, the phase velocity is the slope of the line from the origin to the point, and the group velocity is the slope of the curve itself. They are equal at every k only when ω is proportional to k, that is, when there is no dispersion."
        />
        <WavePacketSim />
        <p>
          The cold plasma oscillation of A1 is the extreme case. Every wavelength rings at <M>{'\\omega_{pe}'}</M>, so{' '}
          <M>{'d\\omega/dk = 0'}</M>: crests race along, but the disturbance itself stays where it started. To make it travel you need
          something that couples neighbouring regions. In a plasma that something is pressure.
        </p>
      </section>

      <section id="epw">
        <h2>Electron plasma waves</h2>
        <p>
          Give the electrons a temperature. Electrons streaming out of a compressed region carry the disturbance into the neighbouring
          region, and the pressure adds to the electric restoring force. The shorter the wavelength, the steeper the pressure gradient,
          so short waves ring faster. The oscillation becomes a travelling wave.
        </p>
        <Derivation
          lessonId="A5"
          id="bohm-gross"
          title="Bohm–Gross from the electron fluid equations"
          steps={[
            {
              text: 'Ions are too heavy to follow a fast oscillation, so they form a fixed background of density n₀. Write the electron quantities as equilibrium plus a small wave.',
              math: '\\begin{gathered} n_e = n_0 + n_1 e^{i(kx-\\omega t)} \\\\ u = u_1 e^{i(kx-\\omega t)} \\\\ E = E_1 e^{i(kx-\\omega t)} \\end{gathered}',
              why: 'Products of two small quantities (like n₁u₁) are dropped: that is linearization. Then every ∂/∂t becomes −iω and every ∂/∂x becomes ik.',
            },
            {
              text: 'Continuity, linearized.',
              math: '\\begin{gathered} -i\\omega n_1 + i k n_0 u_1 = 0 \\\\ \\Rightarrow\\; u_1 = \\dfrac{\\omega}{k}\\,\\dfrac{n_1}{n_0} \\end{gathered}',
            },
            {
              text: 'Momentum, with adiabatic pressure p ∝ n^γ so that ∇p = γ_e kT_e ∇n.',
              math: '\\begin{aligned} -i\\omega\\, m n_0 u_1 &= -e n_0 E_1 \\\\ &\\quad - \\gamma_e kT_e\\, (ik n_1) \\end{aligned}',
              why: 'The electrons oscillate too fast for heat to flow, and the wave squeezes them along one direction only. One compressed degree of freedom: γ_e = (N + 2)/N = 3.',
            },
            {
              text: 'Poisson’s equation closes the loop: the displaced electrons make the field.',
              math: 'ik\\varepsilon_0 E_1 = -e n_1',
            },
            {
              text: 'Substitute u₁ and E₁ into the momentum equation and multiply through by ik/(mn₁).',
              math: '\\begin{aligned} \\omega^2 &= \\dfrac{n_0 e^2}{\\varepsilon_0 m} + \\dfrac{3kT_e}{m}\\,k^2 \\\\ &= \\omega_{pe}^2 + 3k^2 v_{th}^2 \\end{aligned}',
              why: 'The electric term reproduces the plasma frequency of A1; the pressure term adds 3k²kT_e/m. Here v_th² = kT_e/m. Chen writes (3/2)k²v_th² with v_th² = 2kT_e/m: the same physics, a different thermal speed. Always check which one a formula uses.',
            },
          ]}
        />
        <Eq
          title="Bohm–Gross dispersion relation"
          src="\s{w}{\omega}^2 = \s{wp}{\omega_{pe}}^2 + 3\,\s{k}{k}^2\,\s{vth}{v_{th}}^2"
          plot="a5-bohm-gross"
          symbols={{
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'Always at least ω_pe: electron plasma waves cannot exist below the plasma frequency.' },
            wp: { name: 'ω_pe, electron plasma frequency', units: 'rad/s', note: '√(ne²/ε₀m). The cold-plasma limit.' },
            k: { name: 'k, wavenumber', units: 'rad/m', note: 'In the natural units, kλ_D compares the wavelength with the Debye length: 3k²v_th² = 3(kλ_D)² ω_pe².' },
            vth: { name: 'v_th, electron thermal speed', units: 'm/s', note: 'Here v_th = √(kT_e/m). The factor 3 is γ_e for one-dimensional adiabatic compression.' },
          }}
          says="Long waves (kλ_D ≪ 1) oscillate at essentially ω_pe. Shorter waves ring faster and travel, with group velocity v_g = 3k v_th²/ω, so v_φ v_g = 3 v_th²."
        />
        <Plotter spec={plotById('a5-bohm-gross')!} />
        <p>
          Why not arbitrarily short waves? When <M>{'k\\lambda_D'}</M> approaches a few tenths, the phase velocity drops to a few{' '}
          <M>{'v_{th}'}</M>. Then many electrons travel along with the wave and trade energy with it, and the wave is damped even without
          collisions: Landau damping (A9). Beyond <M>{'k\\lambda_D \\approx 0.4'}</M> its amplitude falls by a factor e in about three periods or less, so it barely survives as a wave.
        </p>
      </section>

      <section id="ion">
        <h2>Ion acoustic waves</h2>
        <p>
          Sound in air needs collisions to pass momentum from molecule to molecule. A plasma can carry sound without collisions, because
          the electric field couples the particles. Let the ions bunch up. The hot, nimble electrons crowd in to shield each bunch, but
          their thermal motion stops them from shielding it perfectly. The leftover potential, <M>{'e\\phi \\approx kT_e\\,n_1/n_0'}</M>, pushes the ions
          apart again. The electrons supply the spring; the ions supply the mass.
        </p>
        <Derivation
          lessonId="A5"
          id="ion-acoustic"
          title="The ion acoustic wave"
          steps={[
            {
              text: 'At these low frequencies the electrons have time to reach force balance: they follow the Boltzmann relation of A4, linearized.',
              math: 'n_{e1} = n_0\\,\\dfrac{e\\phi_1}{kT_e}',
            },
            {
              text: 'Ion momentum and continuity, linearized, with ion pressure γ_i kT_i ∇n.',
              math: '\\begin{aligned} -i\\omega M n_0 u_{i1} &= -ik e n_0 \\phi_1 \\\\ &\\quad - ik\\,\\gamma_i kT_i\\, n_{i1} \\\\ n_{i1} &= \\dfrac{k}{\\omega}\\,n_0 u_{i1} \\end{aligned}',
              why: 'E = −∇φ becomes −ikφ₁. The ions are compressed along k only, so γ_i = 3 when they have no time to share energy among directions.',
            },
            {
              text: 'Use the plasma approximation n_i1 = n_e1 (valid for kλ_D ≪ 1) to eliminate φ₁.',
              math: 'e\\phi_1 = kT_e\\,\\dfrac{n_{i1}}{n_0}',
            },
            {
              text: 'Combine. The wave travels at the ion sound speed.',
              math: '\\dfrac{\\omega^2}{k^2} = \\dfrac{kT_e + \\gamma_i kT_i}{M} \\equiv c_s^2',
              why: 'The electron temperature appears with the ion mass: electron pressure, ion inertia. With T_i → 0 the wave still exists, unlike ordinary sound, which needs a hot gas of the same particles that carry the mass.',
            },
            {
              text: 'Now keep Poisson’s equation instead of the plasma approximation: k²ε₀φ₁ = e(n_i1 − n_e1).',
              math: '\\begin{aligned} \\omega^2 = k^2\\Big[&\\dfrac{kT_e}{M\\,(1 + k^2\\lambda_D^2)} \\\\ &+ \\dfrac{\\gamma_i kT_i}{M}\\Big] \\end{aligned}',
              why: 'Solve Poisson for n_i1 = (n₀eφ₁/kT_e)(1 + k²λ_D²). For kλ_D ≫ 1 and cold ions, ω² → k²(kT_e/M)/(k²λ_D²) = n₀e²/(ε₀M) = ω_pi²: the electrons can no longer shield such short bunches, and the ions just oscillate at their own plasma frequency.',
            },
          ]}
        />
        <Eq
          title="Ion acoustic dispersion (with the Debye correction)"
          src="\s{w}{\omega}^2 = \s{k}{k}^2\left[\dfrac{\s{Te}{kT_e}}{\s{M}{M}\,(1 + \s{k}{k}^2\s{lam}{\lambda_D}^2)} + \dfrac{\s{g}{\gamma_i}\,\s{Ti}{kT_i}}{\s{M}{M}}\right]"
          plot="a5-ion-acoustic"
          symbols={{
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'At long wavelength ω = k c_s; at short wavelength (cold ions) it saturates at ω_pi.' },
            k: { name: 'k, wavenumber', units: 'rad/m', note: 'The Debye correction matters once kλ_D is not small.' },
            Te: { name: 'kT_e, electron temperature', units: 'J', note: 'The spring. Hot electrons shield poorly and push the ion bunches apart hard.' },
            M: { name: 'M, ion mass', units: 'kg', note: 'The inertia. Heavier ions give slower sound: c_s ∝ 1/√M.' },
            lam: { name: 'λ_D, electron Debye length', units: 'm', note: '√(ε₀kT_e/ne²). Below this scale the electrons cannot neutralize the ion bunches.' },
            g: { name: 'γ_i, ion adiabatic index', note: 'Usually 3 (one-dimensional compression).' },
            Ti: { name: 'kT_i, ion temperature', units: 'J', note: 'Adds a little speed, but also lets ions resonate with the wave and damp it.' },
          }}
          says="Sound driven by electron pressure and carried by ion mass. For long waves ω = k c_s with c_s = √((kT_e + γ_i kT_i)/M); for short waves the frequency levels off at the ion plasma frequency ω_pi."
        />
        <Plotter spec={plotById('a5-ion-acoustic')!} />
        <p>
          Ion acoustic waves are only weakly damped when <M>{'T_e \\gg T_i'}</M>. If the two temperatures are similar, <M>{'c_s'}</M> is only about
          twice the ion thermal speed, so plenty of ions move at the wave’s own speed and soak up its energy: ion Landau damping (A9).
          With hot electrons and cold ions the wave outruns almost every ion. Laser-produced plasmas often have <M>{'T_e'}</M> several
          times <M>{'T_i'}</M>, and there ion acoustic waves are the waves that stimulated Brillouin scattering grows on (B6).
        </p>
        <div className="grid two">
          <div className="card">
            <span className="pill">Electron plasma wave</span>
            <p style={{ marginTop: 10 }}>
              Ions sit still; electrons provide both inertia and pressure. <M>{'\\omega \\ge \\omega_{pe}'}</M>, and the group velocity is at
              most <M>{'\\sqrt{3}\\,v_{th}'}</M>.
            </p>
          </div>
          <div className="card">
            <span className="pill violet">Ion acoustic wave</span>
            <p style={{ marginTop: 10 }}>
              Electrons follow Boltzmann and provide the pressure; ions provide the inertia. <M>{'\\omega \\le \\omega_{pi}'}</M> for cold
              ions, and <M>{'\\omega/k \\approx c_s'}</M> for long waves.
            </p>
          </div>
        </div>
      </section>

      <section id="explorer">
        <h2>Dispersion explorer</h2>
        <p>
          All the branches of this lesson on one chart. In the natural units <M>{'k\\lambda_{De}'}</M> and <M>{'\\omega/\\omega_{pe}'}</M> the
          unmagnetized branches do not depend on the density or temperature at all; only the ratios <M>{'T_i/T_e'}</M>,{' '}
          <M>{'\\omega_{ce}/\\omega_{pe}'}</M> and <M>{'m_e/M'}</M> move them. The readouts turn the chart back into metres, hertz and
          metres per second for your plasma.
        </p>
        <DispersionSim />
        <p>
          Measure a few points with the particle-in-cell code at <M>{'k\\lambda_D'}</M> between 0.1 and 0.35. They land on the Bohm–Gross
          curve to within a few percent, creeping above it as <M>{'k\\lambda_D'}</M> grows. That drift is real. The full kinetic theory (A9)
          gives, for example, <M>{'\\omega \\approx 1.16\\,\\omega_{pe}'}</M> at <M>{'k\\lambda_D = 0.3'}</M> against 1.13 from Bohm–Gross, and
          it also predicts the damping you see in the PIC trace at larger <M>{'k'}</M>.
        </p>
      </section>

      <section id="perp">
        <h2>Electrostatic waves across B</h2>
        <p>
          Add a uniform magnetic field and send the wave straight across it, <M>{'\\mathbf{k}\\perp\\mathbf{B}'}</M>. An electron pushed by the
          wave field now feels two restoring forces: the electric field of the charge it left behind, and the Lorentz force that curls its
          motion. Both act on the same electron, so the squares of their frequencies add.
        </p>
        <Derivation
          lessonId="A5"
          id="upper-hybrid"
          title="The upper hybrid frequency"
          steps={[
            {
              text: 'Cold electrons, fixed ions, B = B ẑ, and a longitudinal wave with k and E along x.',
              math: '\\mathbf{k} = k\\hat{x}, \\quad \\mathbf{E} = E_1\\hat{x}\\,e^{i(kx - \\omega t)}',
            },
            {
              text: 'Electron equation of motion, linearized. The Lorentz force couples the x and y velocities.',
              math: '\\begin{gathered} -i\\omega m v_x = -eE_1 - e v_y B \\\\ -i\\omega m v_y = e v_x B \\end{gathered}',
              why: 'For an electron F = −e(E + v×B), and v×B = (v_yB, −v_xB, 0) for B along z.',
            },
            {
              text: 'Eliminate v_y using v_y = iω_c v_x/ω, with ω_c = eB/m.',
              math: 'v_x = \\dfrac{-i\\omega}{\\omega^2 - \\omega_c^2}\\,\\dfrac{eE_1}{m}',
              why: 'Without B this is the cold-plasma response of A1. The field stiffens the electron: it resonates at ω_c instead of at zero frequency.',
            },
            {
              text: 'Continuity (n₁ = n₀kv_x/ω) and Poisson (ikε₀E₁ = −en₁) then give the dispersion relation.',
              math: '\\omega^2 = \\omega_{pe}^2 + \\omega_{ce}^2 \\equiv \\omega_h^2',
              why: 'Substituting gives ε₀ = (n₀e²/m)/(ω² − ω_c²). No k survives: like the cold plasma oscillation, the upper hybrid oscillation does not propagate unless the electrons are warm.',
            },
          ]}
        />
        <Eq
          title="Upper hybrid frequency"
          src="\s{wh}{\omega_h}^2 = \s{wp}{\omega_{pe}}^2 + \s{wc}{\omega_{ce}}^2"
          plot="a5-upper-hybrid"
          symbols={{
            wh: { name: 'ω_h, upper hybrid frequency', units: 'rad/s', note: 'Frequency of electron oscillations across B. With warm electrons it becomes a wave, ω² = ω_h² + 3k²v_th² in the fluid picture.' },
            wp: { name: 'ω_pe, electron plasma frequency', units: 'rad/s', note: 'The electric restoring force.' },
            wc: { name: 'ω_ce, electron cyclotron frequency', units: 'rad/s', note: 'eB/m_e. As an ordinary frequency, f_ce ≈ 28 GHz per tesla.' },
          }}
          says="Two springs on the same mass: the frequencies add in quadrature. An electromagnetic wave sent across B (the extraordinary wave of A6) has a resonance where its frequency matches ω_h."
        />
        <p>
          The ions have the same story at lower frequency. If <M>{'\\mathbf{k}'}</M> has a small component along <M>{'\\mathbf{B}'}</M>, the
          electrons can still stream along the field and stay Boltzmann, and the ion acoustic wave gets the ion cyclotron frequency added
          in quadrature: the <strong>electrostatic ion cyclotron wave</strong>, <M>{'\\omega^2 = \\Omega_{ci}^2 + k^2c_s^2'}</M>. If{' '}
          <M>{'\\mathbf{k}'}</M> is so close to perpendicular (within roughly <M>{'\\sqrt{m_e/M}'}</M> radians) that the electrons cannot move along{' '}
          <M>{'\\mathbf{B}'}</M> fast enough to shield, both species oscillate across the field at the <strong>lower hybrid</strong> frequency.
        </p>
        <Eq
          title="Lower hybrid frequency"
          src="\dfrac{1}{\s{wl}{\omega_{LH}}^2} = \dfrac{1}{\s{wce}{\omega_{ce}}\,\s{wci}{\Omega_{ci}}} + \dfrac{1}{\s{wpi}{\omega_{pi}}^2 + \s{wci}{\Omega_{ci}}^2}"
          plot="a5-lower-hybrid"
          symbols={{
            wl: { name: 'ω_LH, lower hybrid frequency', units: 'rad/s', note: 'Between the ion and electron cyclotron frequencies. In a dense plasma it is simply √(ω_ce Ω_ci).' },
            wce: { name: 'ω_ce, electron cyclotron frequency', units: 'rad/s', note: 'eB/m_e.' },
            wci: { name: 'Ω_ci, ion cyclotron frequency', units: 'rad/s', note: 'eB/M, smaller than ω_ce by the mass ratio (1836 for hydrogen).' },
            wpi: { name: 'ω_pi, ion plasma frequency', units: 'rad/s', note: '√(ne²/ε₀M).' },
          }}
          says="In a dense plasma (ω_pi² ≫ ω_ce Ω_ci) the second term drops out and ω_LH ≈ √(ω_ce Ω_ci), the geometric mean of the two cyclotron frequencies, independent of density."
        />
        <Plotter spec={plotById('a5-upper-hybrid')!} />
      </section>

      <section id="next">
        <h2>Where this goes</h2>
        <p>
          All the waves here are <em>electrostatic</em>: <M>{'\\mathbf{k}\\parallel\\mathbf{E}'}</M> and no oscillating magnetic field. A6
          adds the electromagnetic waves, where light meets the plasma frequency. A9 explains the damping you saw hints of here, and why
          the PIC points sit slightly above Bohm–Gross. In Track B these two branches return as the daughters of laser instabilities:
          stimulated Raman scattering drives electron plasma waves and stimulated Brillouin scattering drives ion acoustic waves.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'A5-p1',
      kind: 'numeric',
      prompt: 'A plasma has $n = 10^{18}\\ \\text{m}^{-3}$ and $T_e = 10$ eV. What is the frequency $f = \\omega/2\\pi$ of an electron plasma wave with wavelength 1 mm, in GHz?',
      answer: 9.27,
      tol: 0.02,
      unit: 'GHz',
      hints: ['$\\omega^2 = \\omega_{pe}^2(1 + 3k^2\\lambda_D^2)$, since $v_{th}/\\omega_{pe} = \\lambda_D$.', '$f_{pe} = 8.98$ GHz, $\\lambda_D = 23.5$ µm, $k = 2\\pi/1\\ \\text{mm} = 6283\\ \\text{m}^{-1}$.'],
      solution: '$k\\lambda_D = 6283 \\times 2.35\\times10^{-5} = 0.148$, so $f = 8.98\\ \\text{GHz}\\times\\sqrt{1 + 3\\times0.148^2} = 8.98\\times1.032 = 9.27$ GHz. The thermal correction is about 3%.',
      concept: 'bohm-gross',
    },
    {
      id: 'A5-p2',
      kind: 'numeric',
      prompt: 'A hydrogen plasma has $T_e = 20$ eV and $T_i = 2$ eV. Using $\\gamma_i = 3$, what is the ion sound speed $c_s$, in km/s?',
      answer: 49.9,
      tol: 0.02,
      unit: 'km/s',
      hints: ['$c_s = \\sqrt{(kT_e + 3kT_i)/M}$.', '$kT_e + 3kT_i = 26$ eV $= 4.17\\times10^{-18}$ J; $M = 1.673\\times10^{-27}$ kg.'],
      solution: '$c_s = \\sqrt{4.17\\times10^{-18}/1.673\\times10^{-27}} = 4.99\\times10^4$ m/s $\\approx 49.9$ km/s. Without the ions it would be 43.8 km/s. Since $T_e/T_i = 10$, the wave outruns most ions and is only weakly damped.',
      concept: 'ion-acoustic-speed',
    },
    {
      id: 'A5-p3',
      kind: 'numeric',
      prompt: 'What is the upper hybrid frequency $f_h$ of a plasma with $n = 10^{19}\\ \\text{m}^{-3}$ in a 1 T field, in GHz?',
      answer: 39.9,
      tol: 0.02,
      unit: 'GHz',
      hints: ['$f_{pe} \\approx 8.98\\sqrt{n}$ Hz and $f_{ce} \\approx 28.0$ GHz per tesla.', '$f_h = \\sqrt{f_{pe}^2 + f_{ce}^2}$.'],
      solution: '$f_{pe} = 8.98\\times\\sqrt{10^{19}} = 28.4$ GHz and $f_{ce} = 28.0$ GHz, so $f_h = \\sqrt{28.4^2 + 28.0^2} = 39.9$ GHz, about $\\sqrt{2}$ times either one because they happen to be nearly equal.',
      concept: 'upper-hybrid',
    },
    {
      id: 'A5-p4',
      kind: 'numeric',
      prompt: 'An electron plasma wave has $k\\lambda_D = 0.3$. What is its group velocity in units of the electron thermal speed $v_{th} = \\sqrt{kT_e/m}$?',
      answer: 0.799,
      tol: 0.02,
      unit: '× v_th',
      hints: ['Differentiate $\\omega^2 = \\omega_{pe}^2 + 3k^2v_{th}^2$: $2\\omega\\,d\\omega = 6k v_{th}^2\\,dk$.', 'So $v_g/v_{th} = 3k\\lambda_D/(\\omega/\\omega_{pe})$ with $\\omega/\\omega_{pe} = \\sqrt{1.27}$.'],
      solution: '$\\omega/\\omega_{pe} = \\sqrt{1 + 0.27} = 1.127$, so $v_g = 3\\times0.3/1.127\\ v_{th} = 0.80\\,v_{th}$. The phase velocity is $1.127/0.3 = 3.76\\,v_{th}$, and indeed $v_\\varphi v_g = 3v_{th}^2$.',
      concept: 'group-velocity',
    },
    {
      id: 'A5-p5',
      kind: 'mcq',
      prompt: 'Why do ion acoustic waves need $T_e \\gg T_i$ to propagate with little damping?',
      options: [
        'Otherwise the electrons cannot keep up with the ions',
        'Otherwise many ions move at about the wave speed and absorb its energy (ion Landau damping)',
        'Hot ions make the plasma approximation fail',
        'The wave speed would exceed the electron thermal speed',
      ],
      correct: 1,
      hints: ['Compare $c_s$ with the ion thermal speed $\\sqrt{kT_i/M}$ when $T_e = T_i$.'],
      solution: 'With $T_e = T_i$, $c_s = \\sqrt{4kT_i/M}$, only twice the ion thermal speed. Many ions then travel with the wave and exchange energy with it, which damps it strongly. With $T_e \\gg T_i$ the wave is much faster than almost all ions.',
      concept: 'ion-landau-damping',
    },
    {
      id: 'A5-p6',
      kind: 'mcq',
      prompt: 'With cold ions, what happens to the ion acoustic frequency when the wavelength becomes much shorter than the Debye length?',
      options: ['It keeps rising as $\\omega = kc_s$', 'It levels off at the ion plasma frequency $\\omega_{pi}$', 'It falls to zero', 'It levels off at $\\omega_{pe}$'],
      correct: 1,
      hints: ['Look at the factor $1/(1 + k^2\\lambda_D^2)$ for $k\\lambda_D \\gg 1$.'],
      solution: 'For $k\\lambda_D \\gg 1$, $\\omega^2 \\to (kT_e/M)/\\lambda_D^2 = ne^2/(\\varepsilon_0 M) = \\omega_{pi}^2$. The electrons can no longer shield bunches that small, so the ions just oscillate at their own plasma frequency.',
      concept: 'ion-acoustic-dispersion',
    },
  ],
  cards: [
    { id: 'A5-c1', front: 'Phase and group velocity', back: '$v_\\varphi = \\omega/k$ (crests); $v_g = d\\omega/dk$ (envelope and energy)' },
    { id: 'A5-c2', front: 'Bohm–Gross relation (state the thermal speed)', back: '$\\omega^2 = \\omega_{pe}^2 + 3k^2v_{th}^2$ with $v_{th}^2 = kT_e/m$; the 3 is $\\gamma_e$ for 1D compression' },
    { id: 'A5-c3', front: 'Ion sound speed', back: '$c_s = \\sqrt{(kT_e + \\gamma_i kT_i)/M}$, usually $\\gamma_i = 3$' },
    { id: 'A5-c4', front: 'Ion acoustic wave at short wavelength', back: '$\\omega^2 = k^2 c_s^2/(1 + k^2\\lambda_D^2) \\to \\omega_{pi}^2$ for cold ions and $k\\lambda_D \\gg 1$' },
    { id: 'A5-c5', front: 'Upper hybrid frequency', back: '$\\omega_h^2 = \\omega_{pe}^2 + \\omega_{ce}^2$ (electron oscillation across B)' },
    { id: 'A5-c6', front: 'Lower hybrid frequency in a dense plasma', back: '$\\omega_{LH} \\approx \\sqrt{\\omega_{ce}\\Omega_{ci}}$' },
  ],
}
