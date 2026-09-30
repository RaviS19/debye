// Everything the learner model and the tutor need to know about the subject lives here, so the core
// (learner/, tutor/) stays subject-agnostic (see plans/generalization-plan.md: this becomes subject.yaml).
export const SUBJECT = {
  name: 'plasma physics',
  tutorPersona:
    'You are the tutor inside Debye, an interactive app that teaches plasma physics. Track A follows F. F. Chen, Introduction to Plasma Physics and Controlled Fusion; later tracks follow Kruer (laser-plasma interactions) and Gibbon (short-pulse lasers).',
  tutorGuidance: 'SI units. State conventions when they matter (for example which thermal speed is meant, ω versus f).',
  generalAsks: ['What should I study next?', 'Quiz me on what I have learned', 'Explain the Debye length in one minute'],
  /** proper nouns and acronyms for turning concept tags into labels */
  properNouns: {
    debye: 'Debye', landau: 'Landau', bohm: 'Bohm', gross: 'Gross', alfven: 'Alfvén', larmor: 'Larmor', lawson: 'Lawson',
    spitzer: 'Spitzer', child: 'Child', langmuir: 'Langmuir', rayleigh: 'Rayleigh', taylor: 'Taylor', vlasov: 'Vlasov',
    boltzmann: 'Boltzmann', maxwellian: 'Maxwellian', sagdeev: 'Sagdeev', kdv: 'KdV', kruskal: 'Kruskal', shafranov: 'Shafranov',
    cma: 'CMA', faraday: 'Faraday', mach: 'Mach', coulomb: 'Coulomb', ohm: 'Ohm', exb: 'E×B', dt: 'D–T', icf: 'ICF',
    nif: 'NIF', mhd: 'MHD', pic: 'PIC', fdtd: 'FDTD', rt: 'Rayleigh–Taylor', em: 'EM', ecrh: 'ECRH', lh: 'lower hybrid', uh: 'upper hybrid',
    bosch: 'Bosch', hale: 'Hale', saha: 'Saha', poisson: 'Poisson', fick: 'Fick', einstein: 'Einstein',
  } as Record<string, string>,
  /** advice shown for a repeated power-of-ten slip */
  unitsAdvice: 'Check unit prefixes and cm⁻³ versus m⁻³ before you compute.',
}
