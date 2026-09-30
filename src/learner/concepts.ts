// Per-concept mastery with Bayesian Knowledge Tracing (Corbett & Anderson, 1995).
//
// Every problem carries a concept tag. Each answer is evidence about whether you know that concept:
// a clean correct answer raises the estimate, a wrong one lowers it, and a correct answer given after
// hints (or after reading the worked solution) counts as partial evidence. Between answers there is a small
// chance you learned the idea (T). Guessing (G) is likelier on multiple choice than on a numeric answer.
import type { Attempt, State } from '../store/store'
import type { Problem } from '../components/Learning'
import type { Lesson } from '../lessons/types'

export const BKT = { L0: 0.25, T: 0.12, S: 0.1, Gnum: 0.06 }

export function guessFor(p: Problem) {
  // People rarely guess blind on multiple choice; they eliminate options first, so use a bit below 1/options.
  return p.kind === 'mcq' ? Math.min(0.3, 0.6 / Math.max(2, p.options.length)) : BKT.Gnum
}

/** One BKT step: posterior after the observation, then the learning transition. */
export function bktStep(pL: number, correct: boolean, G: number, S = BKT.S, T = BKT.T) {
  const post = correct ? (pL * (1 - S)) / (pL * (1 - S) + (1 - pL) * G) : (pL * S) / (pL * S + (1 - pL) * (1 - G))
  return post + (1 - post) * T
}

/** A clean answer: right, with no hints and without having read the solution. */
export const cleanCorrect = (a: Attempt) => a[2] === 1 && a[3] === 0 && a[5] === 0

/** How much an answer says "known": 1 clean, 0.5 right after hints, 0.2 right after reading the solution, 0 wrong. */
export function evidence(a: Attempt) {
  if (a[2] === 0) return 0
  if (a[5] === 1) return 0.2
  return a[3] > 0 ? 0.5 : 1
}

/** BKT step with partial evidence: the posterior is the evidence-weighted mix of the two outcomes. */
export function bktSoft(pL: number, w: number, G: number) {
  if (w >= 1) return bktStep(pL, true, G)
  if (w <= 0) return bktStep(pL, false, G)
  const pc = (pL * (1 - BKT.S)) / (pL * (1 - BKT.S) + (1 - pL) * G)
  const pi = (pL * BKT.S) / (pL * BKT.S + (1 - pL) * (1 - G))
  const post = w * pc + (1 - w) * pi
  return post + (1 - post) * BKT.T
}

const PROPER: Record<string, string> = {
  debye: 'Debye', landau: 'Landau', bohm: 'Bohm', gross: 'Gross', alfven: 'Alfvén', larmor: 'Larmor', lawson: 'Lawson',
  spitzer: 'Spitzer', child: 'Child', langmuir: 'Langmuir', rayleigh: 'Rayleigh', taylor: 'Taylor', vlasov: 'Vlasov',
  boltzmann: 'Boltzmann', maxwellian: 'Maxwellian', sagdeev: 'Sagdeev', kdv: 'KdV', kruskal: 'Kruskal', shafranov: 'Shafranov',
  cma: 'CMA', faraday: 'Faraday', mach: 'Mach', coulomb: 'Coulomb', ohm: 'Ohm', exb: 'E×B', dt: 'D–T', icf: 'ICF',
  nif: 'NIF', mhd: 'MHD', pic: 'PIC', fdtd: 'FDTD', rt: 'Rayleigh–Taylor', em: 'EM', ecrh: 'ECRH', lh: 'lower hybrid', uh: 'upper hybrid',
  bosch: 'Bosch', hale: 'Hale', saha: 'Saha', poisson: 'Poisson', fick: 'Fick', einstein: 'Einstein', kinetic: 'kinetic',
}
export function conceptLabel(tag: string) {
  const words = tag.split('-').map((w) => PROPER[w] ?? w)
  const s = words.join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface ConceptInfo {
  id: string
  label: string
  lessons: string[]
  problems: string[]
}

/** Concept catalog built from the concept tags on every lesson's problems. */
export function conceptCatalog(lessons: Lesson[]) {
  const map = new Map<string, ConceptInfo>()
  const byProblem = new Map<string, { problem: Problem; lesson: Lesson; concept: string; index: number }>()
  for (const l of lessons) {
    l.problems.forEach((p, index) => {
      const c = p.concept ?? p.id
      if (!map.has(c)) map.set(c, { id: c, label: conceptLabel(c), lessons: [], problems: [] })
      const info = map.get(c)!
      if (!info.lessons.includes(l.id)) info.lessons.push(l.id)
      info.problems.push(p.id)
      byProblem.set(p.id, { problem: p, lesson: l, concept: c, index })
    })
  }
  return { concepts: map, byProblem }
}

export interface ConceptState {
  p: number
  /** answers seen */
  n: number
  /** clean correct answers */
  clean: number
  /** hints or solution used */
  helped: number
  last: number
}

/** Replays the attempt log through BKT. `until` limits the replay to answers before that time. */
export function conceptMastery(s: Pick<State, 'log'>, lessons: Lesson[], until = Infinity) {
  const { concepts, byProblem } = conceptCatalog(lessons)
  const st = new Map<string, ConceptState>()
  for (const a of s.log.attempts) {
    if (a[0] >= until) break
    const meta = byProblem.get(a[1])
    if (!meta) continue
    const cs = st.get(meta.concept) ?? { p: BKT.L0, n: 0, clean: 0, helped: 0, last: 0 }
    const ok = cleanCorrect(a)
    cs.p = bktSoft(cs.p, evidence(a), guessFor(meta.problem))
    cs.n += 1
    if (ok) cs.clean += 1
    if (a[3] > 0 || a[5] === 1) cs.helped += 1
    cs.last = a[0]
    st.set(meta.concept, cs)
  }
  return { concepts, byProblem, state: st }
}

export type MasteryBand = 'solid' | 'shaky' | 'weak' | 'untested'
export function band(cs: ConceptState | undefined): MasteryBand {
  if (!cs) return 'untested'
  if (cs.p >= 0.7) return 'solid'
  if (cs.p >= 0.45) return 'shaky'
  return 'weak'
}
