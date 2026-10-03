import type { State } from './store'

export interface Badge {
  id: string
  name: string
  blurb: string
  glyph: string // short symbol drawn inside the badge; 'n_c' draws c as a subscript
  test: (s: State) => boolean
}

const solved = (s: State) => Object.values(s.problems).filter((p) => p.solved).length
const firstTry = (s: State) => Object.values(s.problems).filter((p) => p.firstTry).length
const derivs = (s: State) => Object.values(s.lessons).reduce((n, l) => n + l.derivations.length, 0)
const mastered = (id: string) => (s: State) => !!s.lessons[id]?.completed
export const TRACK_A = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11']
export const TRACK_B = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']
export const TRACK_L = ['L1', 'L2', 'L3']

export const BADGES: Badge[] = [
  { id: 'first-light', name: 'First Light', blurb: 'Earned your first XP. The discharge has struck.', glyph: '✦', test: (s) => s.xp > 0 },
  { id: 'lasing', name: 'Above Threshold', blurb: 'Mastered L1: gain, inversion and the laser threshold.', glyph: 'hν', test: mastered('L1') },
  { id: 'mode-locker', name: 'Mode Locker', blurb: 'Mastered L2: locked modes become a pulse train.', glyph: 'Δν', test: mastered('L2') },
  { id: 'track-l', name: 'Laser Trial Complete', blurb: 'Mastered all three laser trial lessons, down to the femtosecond.', glyph: 'fs', test: (s) => TRACK_L.every((id) => s.lessons[id]?.completed) },
  { id: 'shielded', name: 'Debye Shielded', blurb: 'Mastered A1: what makes a gas a plasma.', glyph: 'λ', test: mastered('A1') },
  { id: 'drifter', name: 'Master of Drifts', blurb: 'Mastered A2: gyration and guiding-centre drifts.', glyph: '⟳', test: mastered('A2') },
  { id: 'trapped', name: 'Mirror Trapped', blurb: 'Mastered A3: adiabatic invariants and magnetic mirrors.', glyph: 'μ', test: mastered('A3') },
  { id: 'fluid', name: 'Fluid Thinker', blurb: 'Mastered A4: the plasma as two interpenetrating fluids.', glyph: '∇p', test: mastered('A4') },
  { id: 'wave-rider', name: 'Wave Rider', blurb: 'Mastered A5: electron plasma and ion acoustic waves.', glyph: 'ω', test: mastered('A5') },
  { id: 'cutoff', name: 'Past the Cutoff', blurb: 'Mastered A6: light, cutoffs and resonances in a plasma.', glyph: 'k', test: mastered('A6') },
  { id: 'random-walker', name: 'Random Walker', blurb: 'Mastered A7: diffusion across fields and resistivity.', glyph: 'D', test: mastered('A7') },
  { id: 'equilibrium', name: 'Held in Balance', blurb: 'Mastered A8: equilibrium, β and the first instabilities.', glyph: 'β', test: mastered('A8') },
  { id: 'landau', name: 'Derived Landau', blurb: 'Mastered A9: kinetic theory and Landau damping.', glyph: 'γ', test: mastered('A9') },
  { id: 'sheath', name: 'Sheath Crosser', blurb: 'Mastered A10: sheaths, solitons and the ponderomotive force.', glyph: 'φ', test: mastered('A10') },
  { id: 'lawson', name: 'Lawson Crossed', blurb: 'Mastered A11: the physics of controlled fusion.', glyph: 'Q', test: mastered('A11') },
  { id: 'track-a', name: 'Foundations Complete', blurb: 'Mastered every lesson of Track A. Laser plasmas with Kruer are next.', glyph: 'A', test: (s) => TRACK_A.every((id) => s.lessons[id]?.completed) },
  { id: 'turning-point', name: 'Turning Point', blurb: 'Mastered B1: light climbing a density ramp to its turning point.', glyph: 'n_c', test: mastered('B1') },
  { id: 'collision-course', name: 'Collision Course', blurb: 'Mastered B2: inverse bremsstrahlung, collisions turning light into heat.', glyph: 'ν_ei', test: mastered('B2') },
  { id: 'in-resonance', name: 'In Resonance', blurb: 'Mastered B3: p-polarized light driving a plasma wave at the critical surface.', glyph: 'ε=0', test: mastered('B3') },
  { id: 'pushed-by-light', name: 'Pushed by Light', blurb: 'Mastered B4: the ponderomotive force, the push of an intensity gradient.', glyph: 'F_p', test: mastered('B4') },
  { id: 'three-wave', name: 'Three-Wave Mixer', blurb: 'Mastered B5: parametric decay, one wave feeding two above threshold.', glyph: 'ω_0', test: mastered('B5') },
  { id: 'backscatter', name: 'Backscattered', blurb: 'Mastered B6: stimulated Raman and Brillouin scattering.', glyph: '↩', test: mastered('B6') },
  { id: 'quarter-critical', name: 'Quarter-Critical', blurb: 'Mastered B7: two-plasmon decay at quarter-critical, and filamentation.', glyph: '¼', test: mastered('B7') },
  { id: 'superthermal', name: 'Superthermal', blurb: 'Mastered B8: hot electrons, and why a target fears them.', glyph: 'T_h', test: mastered('B8') },
  { id: 'particle-pusher', name: 'Particle Pusher', blurb: 'Mastered B9: particle-in-cell and the other simulation methods.', glyph: 'PIC', test: mastered('B9') },
  { id: 'track-b', name: 'Laser–Plasma Complete', blurb: 'Mastered every lesson of Track B. Track C, short-pulse plasmas with Gibbon, is next.', glyph: 'B', test: (s) => TRACK_B.every((id) => s.lessons[id]?.completed) },
  { id: 'sharpshooter', name: 'Sharpshooter', blurb: 'Five problems solved on the first try.', glyph: '◎', test: (s) => firstTry(s) >= 5 },
  { id: 'solver-15', name: 'Problem Crusher', blurb: 'Fifteen problems solved.', glyph: '∑', test: (s) => solved(s) >= 15 },
  { id: 'deriver', name: 'From First Principles', blurb: 'Worked through three derivations.', glyph: '∂', test: (s) => derivs(s) >= 3 },
  { id: 'tinkerer', name: 'Lab Rat', blurb: 'Ran the first four simulations: shielding, oscillation, orbits and the mirror.', glyph: '⚛', test: (s) => ['debye', 'plasma-osc', 'orbit', 'mirror'].every((k) => s.simsUsed[k]) },
  { id: 'experimentalist', name: 'Experimentalist', blurb: 'Ran twelve different simulations.', glyph: '12', test: (s) => Object.keys(s.simsUsed).length >= 12 },
  { id: 'streak-3', name: 'Sustained Discharge', blurb: 'Studied three days in a row.', glyph: '3', test: (s) => s.streak.best >= 3 },
  { id: 'streak-7', name: 'Steady State', blurb: 'A seven-day streak. You earned a streak freeze.', glyph: '7', test: (s) => s.streak.best >= 7 },
  { id: 'reviewer', name: 'Long-Term Memory', blurb: 'Twenty flashcard reviews.', glyph: '↻', test: (s) => s.reviews >= 20 },
  { id: 'memory-200', name: 'Deep Memory', blurb: 'Two hundred flashcard reviews. Your memory curve is now truly your own.', glyph: '∞', test: (s) => s.reviews >= 200 },
  { id: 'curious', name: 'Curious Mind', blurb: 'Asked the tutor five questions.', glyph: '?', test: (s) => (s.log?.tutor.length ?? 0) >= 5 },
]

export const badgeById = (id: string) => BADGES.find((b) => b.id === id)
