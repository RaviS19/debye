// Benchmarks for the learner model, memory curve, sync merge and tutor rendering.
import { describe, expect, it } from 'vitest'
import { createEmptyCard, forgetting_curve, fsrs } from 'ts-fsrs'
import { bktStep, BKT, conceptMastery, band } from './concepts'
import { fit, examples, predictModel, PRIOR_W } from './predict'
import { fitK, memoryModel, shiftedRetention } from './memory'
import { rhythm, sessions, suggestions, weakSpots } from './digest'
import { fresh, type Attempt, type ReviewEntry, type State } from '../store/store'
import { canon, mergeState, payload } from '../store/merge'
import type { Lesson, ModuleInfo } from '../lessons/types'

// Deterministic RNG (mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mkLesson = (id: string, concepts: string[]): Lesson => ({
  id,
  title: id,
  subtitle: '',
  minutes: 40,
  refs: [],
  objectives: [],
  sections: [],
  body: () => null,
  cards: [1, 2, 3].map((i) => ({ id: `${id}-c${i}`, front: '', back: '' })),
  problems: concepts.map((c, i) =>
    i % 2
      ? { id: `${id}-p${i + 1}`, kind: 'mcq' as const, prompt: '', options: ['a', 'b', 'c', 'd'], correct: 0, hints: [], solution: '', concept: c }
      : { id: `${id}-p${i + 1}`, kind: 'numeric' as const, prompt: '', answer: 1, tol: 0.03, unit: '', hints: ['h'], solution: '', concept: c },
  ),
})
const L = [mkLesson('A1', ['a', 'a', 'b', 'c', 'c', 'd']), mkLesson('A2', ['e', 'f', 'f', 'g', 'h', 'h']), mkLesson('A3', ['i', 'j', 'k', 'k', 'l', 'm'])]
const MODS: ModuleInfo[] = [
  { id: 'A1', track: 'A', title: '', prereqs: [] },
  { id: 'A2', track: 'A', title: '', prereqs: ['A1'] },
  { id: 'A3', track: 'A', title: '', prereqs: ['A2'] },
]

describe('Bayesian knowledge tracing', () => {
  it('matches the closed-form update', () => {
    // correct numeric answer from the prior: 0.25*0.9 / (0.25*0.9 + 0.75*0.06) = 0.8333, then + (1-0.8333)*0.12
    expect(bktStep(BKT.L0, true, BKT.Gnum)).toBeCloseTo(0.8333 + 0.1667 * 0.12, 3)
    // wrong answer: 0.25*0.1 / (0.025 + 0.75*0.94) = 0.03425, then learning
    expect(bktStep(BKT.L0, false, BKT.Gnum)).toBeCloseTo(0.03425 + (1 - 0.03425) * 0.12, 3)
  })
  it('counts an answer given after hints as partial evidence', () => {
    const t0 = 1e12
    const clean: Attempt[] = [[t0, 'A1-p1', 1, 0, '', 0]]
    const hinted: Attempt[] = [[t0, 'A1-p1', 1, 1, '', 0]]
    const a = conceptMastery({ log: { xp: [], attempts: clean, reviews: [], tutor: [] } }, L).state.get('a')!
    const b = conceptMastery({ log: { xp: [], attempts: hinted, reviews: [], tutor: [] } }, L).state.get('a')!
    expect(band(a)).toBe('solid')
    expect(band(b)).toBe('shaky')
    expect(b.p).toBeLessThan(a.p - 0.25)
  })
})

describe('struggle predictor (MAP logistic regression)', () => {
  it('recovers known weights from synthetic data', () => {
    const r = rng(7)
    const wTrue = [0.5, 1.2, 0.8, -0.6, 1.8, 0.3, -1.4, -0.4]
    const data = Array.from({ length: 3000 }, (_, i) => {
      const x = [1, r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5, r() < 0.5 ? 1 : 0, r() - 0.5, r()]
      const p = 1 / (1 + Math.exp(-x.reduce((s, xi, j) => s + xi * wTrue[j], 0)))
      return { x, y: (r() < p ? 1 : 0) as 0 | 1, t: i, problem: '' }
    })
    const w = fit(data, PRIOR_W, 0.01)
    const err = Math.max(...w.map((wi, i) => Math.abs(wi - wTrue[i])))
    expect(err, `fitted ${w.map((x) => x.toFixed(2)).join(', ')}`).toBeLessThan(0.35)
  })
  it('stays at the prior with no data and predicts lower for a learner who struggles', () => {
    expect(fit([])).toEqual(PRIOR_W)
    const good: State = fresh()
    const bad: State = fresh()
    let t = 1e12
    for (const l of L.slice(0, 2))
      for (const p of l.problems) {
        good.log.attempts.push([t++, p.id, 1, 0, '', 0])
        bad.log.attempts.push([t++, p.id, 0, 1, 'high', 0], [t++, p.id, 1, 2, '', 1])
      }
    for (const l of L.slice(0, 2)) {
      good.lessons[l.id] = { opened: '', derivations: [], completed: 'x' }
      bad.lessons[l.id] = { opened: '', derivations: [] }
    }
    for (const l of L.slice(0, 2)) for (const p of l.problems) {
      good.problems[p.id] = { attempts: 1, solved: true, firstTry: true }
      bad.problems[p.id] = { attempts: 2, solved: true, firstTry: false }
    }
    expect(examples(good, L, MODS)).toHaveLength(12)
    const pg = predictModel(good, L, MODS).predictions.find((p) => p.lessonId === 'A3')!
    const pb = predictModel(bad, L, MODS).predictions.find((p) => p.lessonId === 'A3')!
    expect(pg.p).toBeGreaterThan(0.6)
    expect(pb.p).toBeLessThan(0.4)
    expect(weakSpots(bad, L).length).toBeGreaterThan(0)
    expect(suggestions(bad, L, MODS).length).toBeGreaterThan(0)
  })
})

describe('personal memory curve', () => {
  const w = fsrs({}).parameters.w
  it('leaves the target alone for an average learner', () => {
    expect(shiftedRetention(0.9, 1, w)).toBeCloseTo(0.9, 6)
    expect(shiftedRetention(0.9, 2, w)).toBeLessThan(0.9)
    expect(shiftedRetention(0.9, 0.5, w)).toBeGreaterThan(0.9)
  })
  it('recovers a learner whose memory lasts twice as long', () => {
    const r = rng(11)
    const log: ReviewEntry[] = []
    for (let i = 0; i < 800; i++) {
      const S = 1 + r() * 30
      const t = 0.5 + r() * 60
      const recalled = r() < forgetting_curve(w, t, 2 * S)
      log.push([i, 'c', recalled ? 3 : 1, t, S, forgetting_curve(w, t, S), 2])
    }
    expect(fitK(log.map((e) => ({ t: e[3], S: e[4], ok: e[2] > 1 })), w)).toBeGreaterThan(1.7)
    expect(fitK(log.map((e) => ({ t: e[3], S: e[4], ok: e[2] > 1 })), w)).toBeLessThan(2.4)
    const m = memoryModel(log, 0.9, w)
    expect(m.personal).toBe(true)
    // With k = 2 the same 90% recall is reached later, so the default model is asked for less.
    expect(m.effectiveRetention).toBeLessThan(0.9)
  })
  it('needs a dozen usable reviews before it personalizes', () => {
    expect(memoryModel([[1, 'c', 3, 3, 5, 0.9, 2]], 0.9, w).personal).toBe(false)
  })
})

describe('sync merge', () => {
  function randomState(seed: number, device: string): State {
    const r = rng(seed)
    const s = fresh()
    s.device = device
    s.xpBy = { [device]: Math.floor(r() * 500) }
    s.xp = s.xpBy[device]
    s.studyDays = ['2026-09-01', `2026-09-0${1 + Math.floor(r() * 8)}`]
    s.streak = { count: Math.floor(r() * 5), best: 7, lastDay: s.studyDays[1], freezes: Math.floor(r() * 3) }
    s.problems = { 'A1-p1': { attempts: 1 + Math.floor(r() * 3), solved: r() < 0.5, firstTry: false } }
    s.lessons = { A1: { opened: `2026-09-0${1 + Math.floor(r() * 5)}T10:00:00Z`, derivations: r() < 0.5 ? ['x', 'y'] : ['y'] } }
    s.cards = { 'A1-c1': createEmptyCard(new Date(1e12 + Math.floor(r() * 1e6))) }
    s.log.attempts = [[1e12 + Math.floor(r() * 100), 'A1-p1', 0, 0, 'high', 0]]
    s.badges = { 'first-light': `2026-09-0${1 + Math.floor(r() * 5)}` }
    return s
  }
  it('is commutative and idempotent, so devices converge', () => {
    for (let i = 0; i < 20; i++) {
      const a = randomState(i, 'aaa')
      const b = randomState(100 + i, 'bbb')
      const ab = mergeState(a, payload(b))
      const ba = mergeState(b, payload(a))
      expect(canon(payload(ab))).toBe(canon(payload(ba)))
      expect(canon(payload(mergeState(ab, payload(ab))))).toBe(canon(payload(ab)))
      expect(ab.xp).toBe(a.xp + b.xp)
    }
  })
  it('lets a newer reset win over older progress', () => {
    const a = randomState(1, 'aaa')
    const b = { ...fresh(), device: 'bbb', epoch: '2026-09-30T00:00:00Z' }
    const merged = mergeState(a, payload(b))
    expect(merged.xp).toBe(0)
    expect(merged.device).toBe('aaa')
    expect(mergeState(b, payload(a)).xp).toBe(0)
  })
})

describe('study rhythm', () => {
  it('splits sessions on 30-minute gaps', () => {
    const m = 60000
    const s = sessions([0, 5 * m, 20 * m, 70 * m, 75 * m])
    expect(s).toHaveLength(2)
    expect(s[0].minutes).toBeCloseTo(22)
    const st = fresh()
    const base = new Date(2026, 8, 1, 19, 0).getTime()
    for (let d = 0; d < 6; d++) st.log.xp.push([base + d * 86400000, 5, 'x'])
    expect(rhythm(st, base + 7 * 86400000).bestHour).toBe(19)
  })
})
