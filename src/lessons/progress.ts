// Rule-based mastery and next-step suggestions (Phase 1 of the adaptive-learning plan).
import type { State } from '../store/store'
import { LESSONS, MODULES } from './index'
import type { Lesson } from './types'

export function mastery(s: State, l: Lesson): number {
  const solved = l.problems.filter((p) => s.problems[p.id]?.solved).length
  return solved / l.problems.length
}

export const MASTERY_THRESHOLD = 0.8

export function status(s: State, id: string): 'mastered' | 'started' | 'available' | 'locked' | 'coming' {
  const lesson = LESSONS.find((l) => l.id === id)
  if (!lesson) return 'coming'
  if (s.lessons[id]?.completed) return 'mastered'
  if (s.lessons[id]) return 'started'
  const mod = MODULES.find((m) => m.id === id)!
  // Nothing is hard-locked; unmet prerequisites are only flagged.
  return mod.prereqs.every((p) => s.lessons[p]?.completed) ? 'available' : 'locked'
}

export interface Suggestion {
  lessonId: string
  reason: string
}

export function nextSuggestion(s: State): Suggestion | null {
  for (const l of LESSONS) {
    const st = status(s, l.id)
    if (st === 'started') {
      const left = l.problems.filter((p) => !s.problems[p.id]?.solved).length
      return { lessonId: l.id, reason: `You started this. ${left} problem${left === 1 ? '' : 's'} left to master it.` }
    }
  }
  for (const l of LESSONS) {
    const st = status(s, l.id)
    if (st === 'available') return { lessonId: l.id, reason: 'Its prerequisites are mastered. You are ready.' }
  }
  for (const l of LESSONS) {
    if (status(s, l.id) === 'locked') return { lessonId: l.id, reason: 'Open it any time; mastering the earlier lesson first will make it easier.' }
  }
  return null
}
