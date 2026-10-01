// Predictive gap filling (Phase 4 of the adaptive-learning plan): before a lesson, look back at the lessons it
// builds on and pick out the ideas the learner model (BKT, concepts.ts) still rates weak or shaky, so the learner
// can refresh them first. Pure functions; the lesson page renders the result.
import type { State } from '../store/store'
import type { Lesson, ModuleInfo } from '../lessons/types'
import { band, conceptMastery } from './concepts'

export interface PrepItem {
  concept: string
  label: string
  /** the prerequisite lesson whose problems practise this concept */
  lessonId: string
  band: 'weak' | 'shaky'
  /** estimated mastery */
  p: number
}

/**
 * The prerequisite lessons worth checking: the direct prerequisites of `lessonId` and, `depth` levels down, theirs.
 * Only mastered lessons count, and the walk does not go through one that is not mastered: the lesson page already
 * flags an unmastered direct prerequisite, so repeating it here would only add noise.
 */
export function masteredPrereqs(s: Pick<State, 'lessons'>, lessonId: string, modules: ModuleInfo[], depth = 2): string[] {
  const out: string[] = []
  let frontier = [lessonId]
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const p of modules.find((m) => m.id === id)?.prereqs ?? []) {
        if (p === lessonId || out.includes(p) || !s.lessons[p]?.completed) continue
        out.push(p)
        next.push(p)
      }
    }
    frontier = next
  }
  return out
}

/**
 * Up to `limit` concepts from the lesson's mastered prerequisites that the learner model rates weak or shaky,
 * weakest first. Untested concepts are left out (no evidence either way), and so is everything once the learner
 * has started on this lesson's own problems or mastered it: the check is for before you start.
 */
export function prepCheck(
  s: Pick<State, 'log' | 'lessons' | 'problems'>,
  lessonId: string,
  lessons: Lesson[],
  modules: ModuleInfo[],
  { limit = 3, depth = 2 } = {},
): PrepItem[] {
  const lesson = lessons.find((l) => l.id === lessonId)
  if (!lesson || s.lessons[lessonId]?.completed) return []
  if (lesson.problems.some((p) => s.problems[p.id]?.solved)) return []
  const pre = masteredPrereqs(s, lessonId, modules, depth)
  if (!pre.length) return []
  const { concepts, state } = conceptMastery(s, lessons)
  const seen = new Set<string>()
  const out: PrepItem[] = []
  for (const id of pre) {
    const l = lessons.find((x) => x.id === id)
    if (!l) continue
    for (const p of l.problems) {
      const c = p.concept ?? p.id
      if (seen.has(c)) continue
      seen.add(c)
      const cs = state.get(c)
      const b = band(cs)
      if (cs && (b === 'weak' || b === 'shaky')) out.push({ concept: c, label: concepts.get(c)?.label ?? c, lessonId: id, band: b, p: cs.p })
    }
  }
  return out.sort((a, b) => a.p - b.p).slice(0, limit)
}
