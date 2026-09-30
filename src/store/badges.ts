import type { State } from './store'

export interface Badge {
  id: string
  name: string
  blurb: string
  glyph: string // short symbol drawn inside the badge
  test: (s: State) => boolean
}

const solved = (s: State) => Object.values(s.problems).filter((p) => p.solved).length
const firstTry = (s: State) => Object.values(s.problems).filter((p) => p.firstTry).length
const derivs = (s: State) => Object.values(s.lessons).reduce((n, l) => n + l.derivations.length, 0)
const mastered = (id: string) => (s: State) => !!s.lessons[id]?.completed
export const TRACK_A = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11']

export const BADGES: Badge[] = [
  { id: 'first-light', name: 'First Light', blurb: 'Earned your first XP. The discharge has struck.', glyph: '✦', test: (s) => s.xp > 0 },
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
