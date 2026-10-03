import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { PulseSim } from '../sims/PulseSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const L3: Lesson = {
  id: 'L3',
  title: 'Anatomy of an ultrashort pulse',
  subtitle: 'The time–bandwidth product, spectral phase, chirp, and why glass stretches femtosecond pulses',
  minutes: 50,
  refs: [
    'Weiner, Ultrafast Optics, Ch. 1 (introduction and review) and Ch. 4 (dispersion and dispersion compensation)',
    'Keller, Ultrafast Lasers: linear pulse propagation',
    'Diels & Rudolph, Ultrashort Laser Pulse Phenomena (2nd ed.), Ch. 1–2',
  ],
  objectives: [
    'Find the shortest pulse a spectrum allows, using $\\Delta\\nu\\,\\tau \\ge 0.441$ for Gaussian pulses',
    'Explain what GDD and TOD do to a pulse in time, and which colour leads in a chirped pulse',
    'Estimate how much a slab of glass stretches a pulse, from its GDD and $\\tau \\!=\\! \\tau_0\\sqrt{1 + (4\\ln2\\,\\mathrm{GDD}/\\tau_0^2)^2}$',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'bandwidth', label: 'Bandwidth' },
    { id: 'phase', label: 'Spectral phase' },
    { id: 'playground', label: 'Playground' },
    { id: 'glass', label: 'Glass' },
    { id: 'derive', label: 'Derive it' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          A femtosecond pulse is light that lasts only a few optical cycles: at 800 nm one cycle takes 2.7 fs, so a 30 fs pulse holds
          about eleven. To be that short it must contain many colours, and they must arrive together. Two things describe it
          completely: its <strong>spectrum</strong> (how much of each colour) and its <strong>spectral phase</strong> (when each colour
          arrives). Everything else (duration, shape, chirp) follows from those two by a Fourier transform.
        </p>
      </section>

      <section id="bandwidth">
        <h2>Bandwidth sets the limit</h2>
        <Eq
          title="Time–bandwidth product"
          src="\s{dn}{\Delta\nu}\;\s{tau}{\tau} \ge \s{K}{K} = 0.441\ \text{(Gaussian)}"
          plot="l3-tbp"
          symbols={{
            dn: { name: 'Δν, spectral width', units: 'Hz', note: 'Intensity FWHM of the spectrum. From a width in wavelength: Δν = cΔλ/λ².' },
            tau: { name: 'τ, pulse duration', units: 's', note: 'Intensity FWHM in time.' },
            K: { name: 'K, time–bandwidth product', note: '0.441 for a Gaussian, 0.315 for a sech² pulse. The equality holds only when every colour arrives at once: a transform-limited pulse.' },
          }}
          says="A 30 nm spectrum at 800 nm can support a pulse no shorter than about 31 fs. To reach 10 fs you need almost 100 nm."
        />
        <Plotter spec={plotById('l3-tbp')!} />
      </section>

      <section id="phase">
        <h2>Spectral phase</h2>
        <p>
          Write the phase of each frequency component as a Taylor series around the centre frequency <M>{'\\omega_0'}</M>. Each term has
          a job.
        </p>
        <Eq
          title="Spectral phase expansion"
          src="\s{phi}{\varphi}(\omega) = \varphi_0 + \s{gd}{\varphi_1}\,\Omega + \tfrac{1}{2}\s{gdd}{\varphi_2}\,\Omega^2 + \tfrac{1}{6}\s{tod}{\varphi_3}\,\Omega^3,\quad \s{W}{\Omega} = \omega - \omega_0"
          plot="l3-gdd-broadening"
          symbols={{
            phi: { name: 'φ(ω), spectral phase', units: 'rad', note: 'The phase of each colour. A constant φ₀ only shifts the carrier under the envelope (the carrier–envelope phase).' },
            gd: { name: 'φ₁, group delay', units: 'fs', note: 'A linear phase just delays the whole pulse. It does not change its shape.' },
            gdd: { name: 'φ₂ = GDD, group-delay dispersion', units: 'fs²', note: 'Makes the delay depend linearly on colour: a linear chirp. Positive GDD (normal dispersion, as in glass) delays blue behind red.' },
            tod: { name: 'φ₃ = TOD, third-order dispersion', units: 'fs³', note: 'Delays both edges of the spectrum relative to the centre, or advances them. It leaves a main pulse with satellite pulses on one side.' },
            W: { name: 'Ω, frequency offset', units: 'rad/fs', note: 'Distance from the centre frequency ω₀.' },
          }}
          says="Only GDD and higher terms reshape the pulse. The group delay of each colour is dφ/dω; when it differs across the spectrum, the colours spread out in time."
        />
      </section>

      <section id="playground">
        <h2>Play with the phase</h2>
        <PulseSim />
        <p>
          Two lessons from the playground. A phase that changes the duration never changes the spectrum: the colours are all still
          there, just at different times. And positive GDD always puts red first, because in normal dispersion the longer wavelengths
          travel faster. That is the chirp of a pulse that has just come through glass.
        </p>
      </section>

      <section id="glass">
        <h2>Why glass matters</h2>
        <p>
          Glass has a refractive index that falls with wavelength, so it adds positive GDD: about 36 fs² per millimetre of fused silica
          at 800 nm, and about 45 fs²/mm of BK7. The plot shows why that is harmless for a 100 fs pulse and serious for a 10 fs one:
          the broadening depends on <M>{'\\mathrm{GDD}/\\tau_0^2'}</M>. Every lens, window and crystal in an ultrafast setup adds to the
          budget, and ultrafast lasers carry prism pairs, grating pairs or chirped mirrors to give it back with negative GDD.
        </p>
        <Plotter spec={plotById('l3-gdd-broadening')!} />
      </section>

      <section id="derive">
        <h2>Derive it yourself</h2>
        <Derivation
          lessonId="L3"
          id="gdd-broadening"
          title="A Gaussian pulse through GDD"
          steps={[
            { text: 'Start from a transform-limited Gaussian pulse. Its spectrum is Gaussian too.', math: 'E(t) \\propto e^{-t^2/2T^2}\\ \\Longleftrightarrow\\ \\tilde E(\\Omega) \\propto e^{-\\Omega^2T^2/2}', why: 'The Fourier transform of a Gaussian is a Gaussian. The intensity FWHM is τ₀ = 2√(ln2) T.' },
            { text: 'Dispersion multiplies the spectrum by a quadratic phase and leaves its magnitude alone.', math: '\\tilde E(\\Omega) \\to \\tilde E(\\Omega)\\, e^{\\,i\\,\\mathrm{GDD}\\,\\Omega^2/2}', why: 'Linear propagation only delays each colour; it never adds or removes any.' },
            { text: 'Combine the exponents into one Gaussian with a complex width.', math: 'e^{-\\Omega^2 (T^2 - i\\,\\mathrm{GDD})/2}', why: 'The pulse in time is again a Gaussian, now with a complex parameter: the imaginary part is the chirp.' },
            { text: 'Transform back. The new intensity width follows from the complex parameter.', math: 'T_{out}^2 = T^2 + \\dfrac{\\mathrm{GDD}^2}{T^2}', why: 'Inverting e^{−Ω²a/2} gives e^{−t²/2a}; the intensity |E|² has width set by Re(1/a)⁻¹ = (T⁴ + GDD²)/T².' },
            { text: 'Write it with FWHM durations, using τ₀ = 2√(ln2) T.', math: '\\tau = \\tau_0\\sqrt{1 + \\left(\\dfrac{4\\ln 2\\,\\mathrm{GDD}}{\\tau_0^2}\\right)^2}', why: 'GDD/T² = 4 ln2 · GDD/τ₀². For large GDD, τ ≈ 4 ln2 · GDD/τ₀: the shorter the input, the longer the output.' },
          ]}
        />
      </section>

      <section id="next">
        <h2>Where this goes</h2>
        <p>
          That is the end of the trial. In the full laser tracks this lesson opens Track F (ultrafast lasers): F2 and F3 take dispersion
          and compressors further, F4 adds the nonlinear phase a pulse picks up from its own intensity, and Track H shows how pulses like
          these are actually measured, with autocorrelators, FROG and SPIDER. The same chirp returns in plasma physics: Track C's
          wakefield and ion-acceleration lasers are chirped-pulse amplifiers, stretched by enormous GDD and compressed again.
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'L3-p1', kind: 'numeric', concept: 'time-bandwidth', prompt: 'What is the shortest Gaussian pulse supported by 30 nm of bandwidth centred at 800 nm, in fs?', answer: 31.4, tol: 0.03, unit: 'fs', hints: ['$\\Delta\\nu = c\\Delta\\lambda/\\lambda^2$.', '$\\tau = 0.441/\\Delta\\nu$.'], solution: '$\\Delta\\nu = 2.998\\times10^8\\times3\\times10^{-8}/(8\\times10^{-7})^2 = 1.41\\times10^{13}$ Hz, so $\\tau = 0.441/1.41\\times10^{13} \\approx 31$ fs.' },
    { id: 'L3-p2', kind: 'numeric', concept: 'time-bandwidth', prompt: 'How much bandwidth (in nm) does a 10 fs Gaussian pulse at 800 nm need?', answer: 94.2, tol: 0.03, unit: 'nm', hints: ['Rearrange: $\\Delta\\lambda = 0.441\\,\\lambda^2/(c\\tau)$.'], solution: '$\\Delta\\lambda = 0.441\\times(8\\times10^{-7})^2/(2.998\\times10^8\\times10^{-14}) \\approx 94$ nm.' },
    { id: 'L3-p3', kind: 'numeric', concept: 'material-gdd', prompt: 'Fused silica has a GVD of about 36.2 fs²/mm at 800 nm. How much GDD does a 10 mm window add, in fs²?', answer: 362, tol: 0.03, unit: 'fs²', hints: ['GDD = GVD × thickness.'], solution: '$36.2\\times10 \\approx 362$ fs².' },
    { id: 'L3-p4', kind: 'numeric', concept: 'gdd-broadening', prompt: 'A 20 fs transform-limited Gaussian pulse passes through that 10 mm window (362 fs²). What is its new FWHM, in fs?', answer: 54.0, tol: 0.03, unit: 'fs', hints: ['$\\tau = \\tau_0\\sqrt{1 + (4\\ln2\\,\\mathrm{GDD}/\\tau_0^2)^2}$.', '$4\\ln2\\times362/400 \\approx 2.51$.'], solution: '$\\tau = 20\\sqrt{1 + 2.51^2} \\approx 20\\times2.70 = 54$ fs. One window almost tripled it.' },
    { id: 'L3-p5', kind: 'mcq', concept: 'chirp', prompt: 'A transform-limited pulse goes through a thick piece of glass. Which statement is true afterwards?', options: ['Its spectrum got narrower', 'Its red components now lead and its blue components trail', 'Its blue components now lead', 'It is still transform limited, just delayed'], correct: 1, hints: ['Glass has normal dispersion: positive GDD.'], solution: 'Positive GDD makes the group delay grow with frequency, so blue arrives later. The spectrum is unchanged; the pulse is longer and up-chirped.' },
    { id: 'L3-p6', kind: 'mcq', concept: 'spectral-phase', prompt: 'Which spectral-phase term changes the arrival time of the pulse but not its shape?', options: ['The constant φ₀', 'The linear term φ₁ (group delay)', 'GDD', 'TOD'], correct: 1, hints: ['A delay t₀ multiplies the spectrum by $e^{-i\\omega t_0}$.'], solution: 'A linear spectral phase is a pure time shift. φ₀ shifts the carrier under the envelope (the carrier–envelope phase); GDD and TOD reshape the pulse.' },
  ],
  cards: [
    { id: 'L3-c1', front: 'Time–bandwidth products', back: 'Gaussian $0.441$, sech² $0.315$ (intensity FWHMs). Equality means transform limited.' },
    { id: 'L3-c2', front: 'Bandwidth in wavelength to frequency', back: '$\\Delta\\nu = c\\,\\Delta\\lambda/\\lambda^2$' },
    { id: 'L3-c3', front: 'What does GDD do to a pulse?', back: 'Makes group delay depend linearly on frequency: a linear chirp. Positive GDD puts red first and stretches the pulse.' },
    { id: 'L3-c4', front: 'Gaussian pulse broadening by GDD', back: '$\\tau = \\tau_0\\sqrt{1 + (4\\ln2\\,\\mathrm{GDD}/\\tau_0^2)^2}$' },
    { id: 'L3-c5', front: 'GVD of fused silica and BK7 at 800 nm', back: 'About 36 fs²/mm and 45 fs²/mm.' },
    { id: 'L3-c6', front: 'What does TOD do?', back: 'Delays (or advances) both spectral wings relative to the centre, leaving satellite pulses on one side of the main pulse.' },
  ],
}
