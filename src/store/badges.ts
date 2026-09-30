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

export const BADGES: Badge[] = [
  { id: 'first-light', name: 'First Light', blurb: 'Earned your first XP. The discharge has struck.', glyph: '✦', test: (s) => s.xp > 0 },
  { id: 'shielded', name: 'Debye Shielded', blurb: 'Mastered A1: what makes a gas a plasma.', glyph: 'λ', test: (s) => !!s.lessons.A1?.completed },
  { id: 'drifter', name: 'Master of Drifts', blurb: 'Mastered A2: gyration and guiding-centre drifts.', glyph: '⟳', test: (s) => !!s.lessons.A2?.completed },
  { id: 'trapped', name: 'Mirror Trapped', blurb: 'Mastered A3: adiabatic invariants and magnetic mirrors.', glyph: 'μ', test: (s) => !!s.lessons.A3?.completed },
  { id: 'sharpshooter', name: 'Sharpshooter', blurb: 'Five problems solved on the first try.', glyph: '◎', test: (s) => firstTry(s) >= 5 },
  { id: 'solver-15', name: 'Problem Crusher', blurb: 'Fifteen problems solved.', glyph: '∑', test: (s) => solved(s) >= 15 },
  { id: 'deriver', name: 'From First Principles', blurb: 'Worked through three derivations.', glyph: '∂', test: (s) => derivs(s) >= 3 },
  { id: 'tinkerer', name: 'Lab Rat', blurb: 'Ran every simulation in Phase 1.', glyph: '⚛', test: (s) => ['debye', 'plasma-osc', 'orbit', 'mirror'].every((k) => s.simsUsed[k]) },
  { id: 'streak-3', name: 'Sustained Discharge', blurb: 'Studied three days in a row.', glyph: '3', test: (s) => s.streak.best >= 3 },
  { id: 'streak-7', name: 'Steady State', blurb: 'A seven-day streak. You earned a streak freeze.', glyph: '7', test: (s) => s.streak.best >= 7 },
  { id: 'reviewer', name: 'Long-Term Memory', blurb: 'Twenty flashcard reviews.', glyph: '↻', test: (s) => s.reviews >= 20 },
]

export const badgeById = (id: string) => BADGES.find((b) => b.id === id)
