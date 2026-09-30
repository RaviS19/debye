import { A1 } from './A1'
import { A2 } from './A2'
import { A3 } from './A3'
import type { Lesson, ModuleInfo } from './types'

export const LESSONS: Lesson[] = [A1, A2, A3]
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)

export const TRACKS = {
  A: { name: 'Foundations', book: 'Chen' },
  B: { name: 'Laser–Plasma', book: 'Kruer' },
  C: { name: 'Short-Pulse & Relativistic', book: 'Gibbon' },
} as const

// The full curriculum from the plan. Modules without a Lesson are shown as "coming".
export const MODULES: ModuleInfo[] = [
  { id: 'A1', track: 'A', title: 'What is a plasma', prereqs: [] },
  { id: 'A2', track: 'A', title: 'Single-particle motion', prereqs: ['A1'] },
  { id: 'A3', track: 'A', title: 'Adiabatic invariants', prereqs: ['A2'] },
  { id: 'A4', track: 'A', title: 'Plasmas as fluids', prereqs: ['A2'] },
  { id: 'A5', track: 'A', title: 'Electrostatic waves', prereqs: ['A4'] },
  { id: 'A6', track: 'A', title: 'EM waves', prereqs: ['A5'] },
  { id: 'A7', track: 'A', title: 'Diffusion & resistivity', prereqs: ['A6'] },
  { id: 'A8', track: 'A', title: 'Equilibrium & stability', prereqs: ['A7'] },
  { id: 'A9', track: 'A', title: 'Kinetic theory', prereqs: ['A8'] },
  { id: 'A10', track: 'A', title: 'Nonlinear effects', prereqs: ['A9'] },
  { id: 'A11', track: 'A', title: 'Controlled fusion', prereqs: ['A10'] },
  { id: 'B1', track: 'B', title: 'Light in plasma', prereqs: ['A6'] },
  { id: 'B2', track: 'B', title: 'Collisional absorption', prereqs: ['B1'] },
  { id: 'B3', track: 'B', title: 'Resonance absorption', prereqs: ['B2'] },
  { id: 'B4', track: 'B', title: 'Ponderomotive force', prereqs: ['B3', 'A10'] },
  { id: 'B5', track: 'B', title: 'Parametric instabilities', prereqs: ['B4', 'A9'] },
  { id: 'B6', track: 'B', title: 'SRS and SBS', prereqs: ['B5'] },
  { id: 'B7', track: 'B', title: 'TPD & filamentation', prereqs: ['B6'] },
  { id: 'B8', track: 'B', title: 'Hot electrons', prereqs: ['B7'] },
  { id: 'B9', track: 'B', title: 'Simulation methods', prereqs: ['B8'] },
  { id: 'C1', track: 'C', title: 'Intense fields', prereqs: ['B4'] },
  { id: 'C2', track: 'C', title: 'Ionization', prereqs: ['C1'] },
  { id: 'C3', track: 'C', title: 'Relativistic propagation', prereqs: ['C2', 'B1'] },
  { id: 'C4', track: 'C', title: 'Wakefield acceleration', prereqs: ['C3'] },
  { id: 'C5', track: 'C', title: 'Solid-target absorption', prereqs: ['C4'] },
  { id: 'C6', track: 'C', title: 'Surface harmonics', prereqs: ['C5'] },
  { id: 'C7', track: 'C', title: 'Ion acceleration', prereqs: ['C6'] },
  { id: 'C8', track: 'C', title: 'PIC in practice', prereqs: ['C7', 'B9'] },
]
