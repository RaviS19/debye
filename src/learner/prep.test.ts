// The "Refresh before you start" check: which concepts from earlier lessons to suggest before a new one.
import { describe, expect, it } from 'vitest'
import { masteredPrereqs, prepCheck } from './prep'
import type { Attempt, State } from '../store/store'
import type { Lesson, ModuleInfo } from '../lessons/types'

// Problems alternate numeric (even index) and multiple choice (odd index), each tagged with a concept.
const mkLesson = (id: string, concepts: string[]): Lesson => ({
  id,
  title: id,
  subtitle: '',
  minutes: 40,
  refs: [],
  objectives: [],
  sections: [],
  body: () => null,
  cards: [],
  problems: concepts.map((c, i) =>
    i % 2
      ? { id: `${id}-p${i + 1}`, kind: 'mcq' as const, prompt: '', options: ['a', 'b', 'c', 'd'], correct: 0, hints: [], solution: '', concept: c }
      : { id: `${id}-p${i + 1}`, kind: 'numeric' as const, prompt: '', answer: 1, tol: 0.03, unit: '', hints: ['h'], solution: '', concept: c },
  ),
})
// A5 -> A6 -> B1 -> B2, and B4 needs B3 and A10 (as in the real curriculum).
const L = [
  mkLesson('A5', ['epw', 'iaw', 'bohm-gross', 'q', 'r', 's']),
  mkLesson('A6', ['cutoff', 'cutoff', 'em-dispersion', 'x', 'critical-density', 'y']),
  mkLesson('A10', ['ponderomotive', 'sheath', 'soliton', 'u', 'v', 'w']),
  mkLesson('B1', ['wkb', 'airy', 'critical-density', 'k1', 'k2', 'k3']),
  mkLesson('B2', ['ib', 'ib', 'j1', 'j2', 'j3', 'j4']),
  mkLesson('B3', ['res', 'res', 'h1', 'h2', 'h3', 'h4']),
  mkLesson('B4', ['pf', 'pf', 'g1', 'g2', 'g3', 'g4']),
]
const MODS: ModuleInfo[] = [
  { id: 'A5', track: 'A', title: '', prereqs: [] },
  { id: 'A6', track: 'A', title: '', prereqs: ['A5'] },
  { id: 'A10', track: 'A', title: '', prereqs: [] },
  { id: 'B1', track: 'B', title: '', prereqs: ['A6'] },
  { id: 'B2', track: 'B', title: '', prereqs: ['B1'] },
  { id: 'B3', track: 'B', title: '', prereqs: ['B2'] },
  { id: 'B4', track: 'B', title: '', prereqs: ['B3', 'A10'] },
]

const T0 = 1.7e12
const wrong = (id: string, t: number): Attempt => [t, id, 0, 0, '', 0]
const clean = (id: string, t: number): Attempt => [t, id, 1, 0, '', 0]
const hinted = (id: string, t: number): Attempt => [t, id, 1, 1, '', 0]

function learner(attempts: Attempt[], mastered: string[], solved: string[] = []): Pick<State, 'log' | 'lessons' | 'problems'> {
  return {
    log: { xp: [], attempts: attempts.map((a, i) => [T0 + i * 60000, ...a.slice(1)] as Attempt), reviews: [], tutor: [] },
    lessons: Object.fromEntries(mastered.map((id) => [id, { opened: '2026-01-01', derivations: [], completed: '2026-01-02' }])),
    problems: Object.fromEntries(solved.map((id) => [id, { attempts: 1, solved: true, firstTry: true }])),
  }
}

describe('prerequisites for the prep check', () => {
  it('walks one level past the direct prerequisites, through mastered lessons only', () => {
    expect(masteredPrereqs(learner([], ['A6', 'A5']), 'B1', MODS)).toEqual(['A6', 'A5'])
    expect(masteredPrereqs(learner([], ['A6', 'A5']), 'B1', MODS, 1)).toEqual(['A6'])
    // A6 is not mastered: the lesson page's own banner covers it, and the walk stops there.
    expect(masteredPrereqs(learner([], ['A5']), 'B1', MODS)).toEqual([])
    expect(masteredPrereqs(learner([], ['B3', 'A10', 'B2']), 'B4', MODS)).toEqual(['B3', 'A10', 'B2'])
  })
})

describe('prep check before a lesson', () => {
  it('shows nothing without evidence: untested concepts are not gaps', () => {
    expect(prepCheck(learner([], ['A6', 'A5']), 'B1', L, MODS)).toEqual([])
  })

  it('shows nothing when every practised concept is solid', () => {
    const s = learner([clean('A6-p1', 0), clean('A6-p3', 0), clean('A5-p1', 0)], ['A6', 'A5'])
    expect(prepCheck(s, 'B1', L, MODS)).toEqual([])
  })

  it('lists weak and shaky concepts from mastered prerequisites, weakest first', () => {
    const s = learner(
      [
        wrong('A6-p1', 0), // cutoff: a miss -> weak
        hinted('A6-p3', 0), // em-dispersion: right only after a hint -> shaky
        clean('A6-p5', 0), // critical-density: clean -> solid, left out
        hinted('A5-p3', 0), // bohm-gross (A5, one level further back): shaky
      ],
      ['A6', 'A5'],
    )
    const out = prepCheck(s, 'B1', L, MODS)
    expect(out.map((x) => [x.concept, x.lessonId, x.band])).toEqual([
      ['cutoff', 'A6', 'weak'],
      ['em-dispersion', 'A6', 'shaky'],
      ['bohm-gross', 'A5', 'shaky'],
    ])
    expect(out[0].p).toBeLessThan(out[1].p)
    expect(out[0].label).toBe('Cutoff')
  })

  it('keeps at most three, the weakest', () => {
    const s = learner([wrong('A6-p1', 0), wrong('A6-p1', 0), hinted('A6-p3', 0), wrong('A6-p4', 0), wrong('A6-p6', 0), hinted('A5-p1', 0)], ['A6', 'A5'])
    const out = prepCheck(s, 'B1', L, MODS)
    expect(out).toHaveLength(3)
    expect(out.every((x) => x.band === 'weak')).toBe(true)
    expect(out[0].concept).toBe('cutoff') // missed twice
  })

  it('leaves unmastered prerequisites to the existing banner', () => {
    const s = learner([wrong('A6-p1', 0), wrong('A5-p1', 0)], ['A5'])
    expect(prepCheck(s, 'B1', L, MODS)).toEqual([])
  })

  it('looks at every mastered prerequisite, across tracks', () => {
    const s = learner([wrong('A10-p1', 0), hinted('B3-p1', 0)], ['B3', 'A10'])
    expect(prepCheck(s, 'B4', L, MODS).map((x) => `${x.concept}@${x.lessonId}`)).toEqual(['ponderomotive@A10', 'res@B3'])
  })

  it('lists a concept shared by two prerequisites once', () => {
    // critical-density is practised in A6 and B1; B2 builds on B1 and (one level back) on A6.
    const s = learner([wrong('B1-p3', 0)], ['B1', 'A6'])
    const out = prepCheck(s, 'B2', L, MODS)
    expect(out.map((x) => [x.concept, x.lessonId])).toEqual([['critical-density', 'B1']])
  })

  it('goes quiet once the lesson is started or mastered', () => {
    const atts = [wrong('A6-p1', 0)]
    expect(prepCheck(learner(atts, ['A6']), 'B1', L, MODS)).toHaveLength(1)
    expect(prepCheck(learner(atts, ['A6'], ['B1-p1']), 'B1', L, MODS)).toEqual([])
    expect(prepCheck(learner(atts, ['A6', 'B1']), 'B1', L, MODS)).toEqual([])
  })

  it('handles a lesson with no prerequisites or an unknown id', () => {
    const s = learner([wrong('A5-p1', 0)], ['A5'])
    expect(prepCheck(s, 'A5', L, MODS)).toEqual([])
    expect(prepCheck(s, 'Z9', L, MODS)).toEqual([])
  })
})
