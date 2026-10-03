import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { ModeLockSim } from '../sims/ModeLockSim'
import { plotById } from './plots'
import type { Lesson } from './types'

export const L2: Lesson = {
  id: 'L2',
  title: 'From modes to pulses',
  subtitle: 'Longitudinal modes, the free spectral range, and how locking their phases makes a pulse train',
  minutes: 45,
  refs: [
    'Silfvast, Laser Fundamentals (2nd ed.): laser cavity modes, and special cavities (mode-locking)',
    'Keller, Ultrafast Lasers: the principles of active and passive mode-locking',
    'Weiner, Ultrafast Optics, Ch. 2: principles of mode-locking',
  ],
  objectives: [
    'Compute the mode spacing $\\Delta\\nu = c/2L$ of a cavity and count the modes under a gain curve',
    'Explain why locked phases give a pulse of width about $1/\\Delta\\nu_{gain}$ and peak power about N times the average',
    'Connect the pulse repetition rate to the cavity length and the pulse duration to the gain bandwidth',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'modes', label: 'Cavity modes' },
    { id: 'locking', label: 'Locking' },
    { id: 'derive', label: 'Derive the pulse' },
    { id: 'how', label: 'How lasers lock' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          A laser cavity is a resonator, like a guitar string. Only waves that fit a whole number of half wavelengths between the
          mirrors survive, so the laser can only oscillate at a comb of evenly spaced frequencies. If the gain curve is wide, many of
          these modes lase at once. Each is a steady sine wave, and what you see at the output depends entirely on how their phases
          line up.
        </p>
        <p>
          With random phases the modes beat against each other into noise. Force their phases to agree and, once every round trip,
          they all add up in step: a short, intense pulse. That is mode-locking, and it is how almost every femtosecond laser works.
        </p>
      </section>

      <section id="modes">
        <h2>Cavity modes</h2>
        <Eq
          title="Mode spacing (free spectral range)"
          src="\s{dn}{\Delta\nu_{FSR}} = \dfrac{\s{c}{c}}{2\,\s{n}{n}\,\s{L}{L}} = \dfrac{1}{\s{T}{T_R}}"
          plot="l2-airy"
          symbols={{
            dn: { name: 'Δν_FSR, mode spacing', units: 'Hz', note: 'Frequency gap between neighbouring longitudinal modes, also called the free spectral range.' },
            c: { name: 'c, speed of light', units: 'm/s', note: '2.998×10⁸ m/s.' },
            n: { name: 'n, refractive index', note: 'Of whatever fills the cavity; 1 for air. Strictly the group index for pulses.' },
            L: { name: 'L, cavity length', units: 'm', note: 'Mirror-to-mirror distance. Light travels 2L per round trip.' },
            T: { name: 'T_R, round-trip time', units: 's', note: 'Time for light to go there and back. A mode-locked laser emits one pulse per round trip.' },
          }}
          says="A 1.5 m cavity has modes 100 MHz apart, and a mode-locked laser of that length emits 100 million pulses per second."
        />
        <p>
          How many modes lase depends on the gain bandwidth. A 30 cm HeNe laser, with 500 MHz spacing and about 1.5 GHz of Doppler
          gain, runs on two or three modes. A Ti:sapphire laser has gain over more than 100 nm; with a 1.5 m cavity, hundreds of
          thousands of modes fit underneath.
        </p>
      </section>

      <section id="locking">
        <h2>Lock the phases</h2>
        <p>
          The simulation builds the output field as a sum of modes under a Gaussian gain curve, each with its own phase (the clock
          hands). Start unlocked, then slide the locking to 1.
        </p>
        <ModeLockSim />
        <p>
          Three things are worth noticing. The average power never changes: locking redistributes the same energy in time. The pulses
          repeat every round trip <M>{'T_R = 2L/c'}</M>. And the pulse duration is set by the bandwidth, not the cavity: for a Gaussian
          spectrum the locked pulse has <M>{'\\tau_p \\approx 0.441/\\Delta\\nu_{gain}'}</M>.
        </p>
        <Eq
          title="Mode-locked pulse duration"
          src="\s{tau}{\tau_p} \approx \dfrac{0.441}{\s{dg}{\Delta\nu_{gain}}} \approx \dfrac{\s{T}{T_R}}{\s{N}{N}}"
          plot="l2-pulse-width"
          symbols={{
            tau: { name: 'τ_p, pulse duration', units: 's', note: 'Full width at half maximum of the intensity.' },
            dg: { name: 'Δν_gain, locked bandwidth', units: 'Hz', note: 'Width of the band of modes that oscillate with locked phases. 0.441 is the time–bandwidth product of a Gaussian pulse (L3).' },
            T: { name: 'T_R, round-trip time', units: 's', note: 'Pulse-to-pulse spacing.' },
            N: { name: 'N, number of locked modes', note: 'N = Δν_gain / Δν_FSR. The pulse occupies about 1/N of each round trip, and its peak power is about N times the average.' },
          }}
          says="More locked modes means a shorter, brighter pulse at the same average power. The bandwidth sets the duration; the cavity sets the repetition rate."
        />
      </section>

      <section id="derive">
        <h2>Derive it yourself</h2>
        <Derivation
          lessonId="L2"
          id="mode-sum"
          title="N locked modes make a pulse"
          steps={[
            { text: 'Take N modes of equal amplitude, spaced by Δω = 2π/T_R, with the same phase. The field is a geometric series.', math: 'E(t) = E_0\\sum_{n=0}^{N-1} e^{i(\\omega_0 + n\\Delta\\omega)t}', why: 'Locked means every φ_n is equal, so it factors out of the sum and we can set it to zero.' },
            { text: 'Sum the series.', math: 'E(t) = E_0\\, e^{i\\omega_0 t}\\, \\dfrac{e^{iN\\Delta\\omega t} - 1}{e^{i\\Delta\\omega t} - 1}', why: 'Σ xⁿ = (x^N − 1)/(x − 1) with x = e^{iΔωt}.' },
            { text: 'Take |E|². The phase factors drop out and leave the familiar diffraction-grating pattern.', math: 'I(t) = I_0\\, \\dfrac{\\sin^2(N\\Delta\\omega t/2)}{\\sin^2(\\Delta\\omega t/2)}', why: '|e^{ix} − 1|² = 4 sin²(x/2). The same function describes N slits.' },
            { text: 'Peaks occur when the denominator vanishes, every round trip, with height N².', math: 't = m T_R,\\qquad I_{peak} = N^2 I_0', why: 'Near Δωt = 2πm both sines are small and their ratio tends to N.' },
            { text: 'The average over a round trip is just N I₀, so the pulse is N times brighter than average.', math: '\\langle I \\rangle = N I_0,\\qquad I_{peak}/\\langle I\\rangle = N', why: 'Cross terms between different modes average to zero; only the N self-terms survive.' },
            { text: 'The first zero after a peak sets the width: about one Nth of the round trip.', math: '\\tau_p \\approx \\dfrac{T_R}{N} = \\dfrac{1}{N\\Delta\\nu} = \\dfrac{1}{\\Delta\\nu_{gain}}', why: 'sin(NΔωt/2) = 0 first at t = T_R/N. Shaping the spectrum (a Gaussian instead of flat-top) changes the constant, giving 0.441.' },
          ]}
        />
      </section>

      <section id="how">
        <h2>How a laser locks itself</h2>
        <p>
          Something inside the cavity has to favour the locked state. In <strong>active</strong> mode-locking a modulator opens a time
          window once per round trip, so light that arrives as a pulse at the right moment loses least. In <strong>passive</strong>
          mode-locking a saturable absorber does the job automatically: it absorbs weak light but bleaches under intense light, so a
          noise spike that happens to be a little brighter loses less on every pass and grows into the pulse. Semiconductor saturable
          absorber mirrors (SESAMs) and the Kerr lens in Ti:sapphire are the workhorses, and they are where Keller's book spends much of
          its time.
        </p>
      </section>

      <section id="next">
        <h2>Where this goes</h2>
        <p>
          A locked pulse is only as short as its bandwidth allows if all the colours arrive together. L3 looks at a single pulse up
          close: how its spectrum and spectral phase set its shape, why glass stretches it, and how a compressor puts it back. In the
          full laser tracks, mode-locking gets lessons of its own (F5 and F6), and the relation between the comb of modes and the pulse
          train becomes the frequency comb (F9).
        </p>
      </section>
    </>
  ),
  problems: [
    { id: 'L2-p1', kind: 'numeric', concept: 'free-spectral-range', prompt: 'What is the mode spacing of a laser cavity 1.5 m long (in air), in MHz?', answer: 99.9, tol: 0.02, unit: 'MHz', hints: ['$\\Delta\\nu = c/2L$.'], solution: '$\\Delta\\nu = 2.998\\times10^8 / 3.0 \\approx 99.9$ MHz, the familiar "100 MHz" of a Ti:sapphire oscillator.' },
    { id: 'L2-p2', kind: 'numeric', concept: 'mode-count', prompt: 'A Ti:sapphire oscillator has 100 MHz mode spacing and 100 nm of locked bandwidth centred at 800 nm. About how many modes are locked?', answer: 4.68e5, tol: 0.03, unit: 'modes', hints: ['Convert bandwidth to frequency: $\\Delta\\nu = c\\Delta\\lambda/\\lambda^2$.', '$\\Delta\\nu \\approx 4.7\\times10^{13}$ Hz.'], solution: '$\\Delta\\nu = 2.998\\times10^8\\times10^{-7}/(8\\times10^{-7})^2 = 4.68\\times10^{13}$ Hz. Divided by $10^8$ Hz that is about $4.7\\times10^5$ modes.' },
    { id: 'L2-p3', kind: 'numeric', concept: 'peak-power', prompt: 'A mode-locked laser gives 1 W average power at 100 MHz in 100 fs pulses. Estimate the peak power as pulse energy divided by duration, in kW.', answer: 100, tol: 0.03, unit: 'kW', hints: ['Pulse energy = average power / repetition rate.', '10 nJ in 100 fs.'], solution: '$E = 1/10^8 = 10$ nJ; $P \\approx 10^{-8}/10^{-13} = 10^5$ W = 100 kW. (A Gaussian shape gives 0.94 times this.)' },
    { id: 'L2-p4', kind: 'numeric', concept: 'free-spectral-range', prompt: 'A 30 cm HeNe laser has about 1.5 GHz of gain bandwidth. What is its mode spacing in MHz? (Divide 1.5 GHz by it to see how many modes can lase.)', answer: 500, tol: 0.02, unit: 'MHz', hints: ['$c/2L$ with L = 0.3 m.'], solution: '$2.998\\times10^8/0.6 \\approx 500$ MHz, so about three modes fit under the gain curve.' },
    { id: 'L2-p5', kind: 'mcq', concept: 'mode-locking', prompt: 'You double the gain bandwidth of a mode-locked laser and keep the cavity the same. What changes?', options: ['The repetition rate doubles', 'The pulses get about half as long and the peak power about doubles', 'The average power doubles', 'Nothing: the cavity sets everything'], correct: 1, hints: ['$\\tau_p \\approx 0.441/\\Delta\\nu_{gain}$; $T_R = 2L/c$.'], solution: 'The cavity length still sets $T_R$. Twice the bandwidth locks twice as many modes, so the pulse is about half as long and, at the same average power, about twice as bright.' },
    { id: 'L2-p6', kind: 'mcq', concept: 'mode-locking', prompt: 'With all modes oscillating but their phases random, the output looks like…', options: ['A clean pulse train at the round-trip rate', 'Fluctuating noise with the same average power, repeating every round trip', 'Nothing: random phases cancel completely', 'A single frequency'], correct: 1, hints: ['Cross terms between modes average to zero over a round trip.'], solution: 'The average power is the sum of the mode powers whatever the phases. With random phases the intensity is a noisy pattern; it repeats every $T_R$ because every mode is periodic in $T_R$.' },
  ],
  cards: [
    { id: 'L2-c1', front: 'Mode spacing of a linear cavity', back: '$\\Delta\\nu_{FSR} = c/2nL = 1/T_R$' },
    { id: 'L2-c2', front: 'Mode-locked pulse duration', back: '$\\tau_p \\approx 0.441/\\Delta\\nu_{gain} \\approx T_R/N$ (Gaussian spectrum)' },
    { id: 'L2-c3', front: 'Peak-to-average power of N locked equal modes', back: '$N$ (peak $N^2 I_0$, average $N I_0$)' },
    { id: 'L2-c4', front: 'What sets the repetition rate, and what sets the pulse duration?', back: 'Cavity length sets the repetition rate ($c/2L$); gain bandwidth sets the shortest pulse.' },
    { id: 'L2-c5', front: 'How does a saturable absorber mode-lock a laser?', back: 'It absorbs weak light but bleaches under intense light, so the brightest spike loses least each pass and grows into a pulse.' },
    { id: 'L2-c6', front: 'Intensity of N locked modes vs time', back: '$I(t) = I_0\\,\\sin^2(N\\Delta\\omega t/2)/\\sin^2(\\Delta\\omega t/2)$' },
  ],
}
