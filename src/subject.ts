// Everything the learner model and the tutor need to know about the subject lives here, so the core
// (learner/, tutor/) stays subject-agnostic (see plans/generalization-plan.md: this becomes subject.yaml).
export const SUBJECT = {
  name: 'plasma physics',
  tutorPersona:
    'You are the tutor inside Debye, an interactive app that teaches plasma physics. Track A (foundations) follows F. F. Chen, Introduction to Plasma Physics and Controlled Fusion; Track B (laser-plasma interactions) follows W. L. Kruer, The Physics of Laser Plasma Interactions. Track C, on short-pulse and relativistic laser plasmas with P. Gibbon, Short Pulse Laser Interactions with Matter, is coming later. Track L is a short laser-physics trial (L1 gain and threshold, L2 mode-locking, L3 ultrashort pulses) following W. T. Silfvast, Laser Fundamentals; U. Keller, Ultrafast Lasers; and A. M. Weiner, Ultrafast Optics.',
  tutorGuidance: 'SI units. State conventions when they matter (for example which thermal speed is meant, ω versus f).',
  generalAsks: ['What should I study next?', 'Quiz me on what I have learned', 'Explain the Debye length in one minute', 'Why does laser light stop at the critical density?'],
  /** proper nouns and acronyms for turning concept tags into labels */
  properNouns: {
    tau: 'τ', debye: 'Debye', landau: 'Landau', bohm: 'Bohm', gross: 'Gross', alfven: 'Alfvén', larmor: 'Larmor', lawson: 'Lawson',
    spitzer: 'Spitzer', child: 'Child', langmuir: 'Langmuir', rayleigh: 'Rayleigh', taylor: 'Taylor', vlasov: 'Vlasov',
    boltzmann: 'Boltzmann', maxwellian: 'Maxwellian', sagdeev: 'Sagdeev', kdv: 'KdV', kruskal: 'Kruskal', shafranov: 'Shafranov',
    cma: 'CMA', faraday: 'Faraday', mach: 'Mach', coulomb: 'Coulomb', ohm: 'Ohm', exb: 'E×B', dt: 'D–T', icf: 'ICF',
    nif: 'NIF', mhd: 'MHD', pic: 'PIC', fdtd: 'FDTD', rt: 'Rayleigh–Taylor', em: 'EM', ecrh: 'ECRH', lh: 'lower hybrid', uh: 'upper hybrid',
    bosch: 'Bosch', gdd: 'GDD', tod: 'TOD', fsr: 'FSR', silfvast: 'Silfvast', sellmeier: 'Sellmeier', fabry: 'Fabry', perot: 'Pérot', hale: 'Hale', saha: 'Saha', poisson: 'Poisson', fick: 'Fick', einstein: 'Einstein',
    // Track B (Kruer): laser-plasma interactions
    raman: 'Raman', brillouin: 'Brillouin', srs: 'SRS', sbs: 'SBS', tpd: 'TPD', wkb: 'WKB', airy: 'Airy', denisov: 'Denisov',
    ginzburg: 'Ginzburg', manley: 'Manley', rowe: 'Rowe', rosenbluth: 'Rosenbluth', mathieu: 'Mathieu', langdon: 'Langdon',
    kruer: 'Kruer', epw: 'EPW', iaw: 'IAW', cbet: 'CBET', ssd: 'SSD', cfl: 'CFL', fft: 'FFT', brunel: 'Brunel', snell: 'Snell',
  } as Record<string, string>,
  /** advice shown for a repeated power-of-ten slip */
  unitsAdvice: 'Check unit prefixes and cm⁻³ versus m⁻³ before you compute.',
}
