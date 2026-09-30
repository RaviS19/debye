// A small model trained on your own answers: predicts the chance you solve a problem cleanly on the
// first try (no hints, no worked solution). It is logistic regression with seven features, fitted on this
// device by maximum a posteriori estimation. The prior weights encode sensible defaults, so with little
// data the model behaves like the rule-based suggestions and only drifts as your own answers accumulate.
import type { State } from '../store/store'
import type { Lesson, ModuleInfo } from '../lessons/types'
import { BKT, bktSoft, cleanCorrect, conceptCatalog, evidence, guessFor } from './concepts'

export const FEATURES = [
  { key: 'bias', label: 'baseline' },
  { key: 'lesson', label: 'how you are doing in this lesson' },
  { key: 'concept', label: 'your record on this concept' },
  { key: 'prereq', label: 'mastery of the prerequisite lessons' },
  { key: 'recent', label: 'your recent first-try accuracy' },
  { key: 'mcq', label: 'multiple choice rather than numeric' },
  { key: 'position', label: 'later problems in a set are harder' },
  { key: 'hints', label: 'how often you have needed hints lately' },
] as const
export const PRIOR_W = [0.2, 2.0, 1.5, 1.2, 2.5, 0.6, -0.8, -1.0]
const LAMBDA = 3

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

interface Ctx {
  concept: Map<string, { p: number; n: number }>
  solved: Set<string>
  recent: { ok: boolean; hint: boolean }[]
}

function features(ctx: Ctx, lesson: Lesson, conceptId: string, index: number, isMcq: boolean, prereqs: string[], lessons: Lesson[]) {
  const lessonConcepts = new Set(lesson.problems.map((p) => p.concept ?? p.id))
  const seen = [...lessonConcepts].map((c) => ctx.concept.get(c)).filter((c) => c && c.n > 0) as { p: number }[]
  const all = [...ctx.concept.values()].filter((c) => c.n > 0)
  const lessonSkill = seen.length ? seen.reduce((a, c) => a + c.p, 0) / seen.length : all.length ? all.reduce((a, c) => a + c.p, 0) / all.length : BKT.L0 + 0.25
  const c = ctx.concept.get(conceptId)
  const prereq = prereqs.length
    ? prereqs.reduce((a, id) => {
        const l = lessons.find((x) => x.id === id)
        return a + (l ? l.problems.filter((p) => ctx.solved.has(p.id)).length / l.problems.length : 0)
      }, 0) / prereqs.length
    : 1
  const r = ctx.recent.slice(-10)
  const recent = (r.filter((x) => x.ok).length + 1.2) / (r.length + 2)
  const hints = r.length ? r.filter((x) => x.hint).length / r.length : 0
  return [1, lessonSkill - 0.5, c && c.n > 0 ? c.p - 0.5 : 0, prereq - 0.5, recent - 0.5, isMcq ? 1 : 0, index / 5 - 0.5, hints]
}

export interface Example {
  x: number[]
  y: 0 | 1
  t: number
  problem: string
}

/** Replays the attempt log and turns every first attempt into a training example, using only what was known before it. */
export function examples(s: Pick<State, 'log'>, lessons: Lesson[], modules: ModuleInfo[]): Example[] {
  const { byProblem } = conceptCatalog(lessons)
  const ctx: Ctx = { concept: new Map(), solved: new Set(), recent: [] }
  const tried = new Set<string>()
  const out: Example[] = []
  for (const a of s.log.attempts) {
    const meta = byProblem.get(a[1])
    if (!meta) continue
    if (!tried.has(a[1])) {
      tried.add(a[1])
      const prereqs = modules.find((m) => m.id === meta.lesson.id)?.prereqs ?? []
      const x = features(ctx, meta.lesson, meta.concept, meta.index, meta.problem.kind === 'mcq', prereqs, lessons)
      const ok = cleanCorrect(a)
      out.push({ x, y: ok ? 1 : 0, t: a[0], problem: a[1] })
      ctx.recent.push({ ok, hint: a[3] > 0 || a[5] === 1 })
    }
    const cs = ctx.concept.get(meta.concept) ?? { p: BKT.L0, n: 0 }
    cs.p = bktSoft(cs.p, evidence(a), guessFor(meta.problem))
    cs.n += 1
    ctx.concept.set(meta.concept, cs)
    if (a[2] === 1) ctx.solved.add(a[1])
  }
  return out
}

/** MAP logistic regression with a Gaussian prior centred on PRIOR_W, solved by Newton's method. */
export function fit(data: Example[], prior = PRIOR_W, lambda = LAMBDA, iters = 12) {
  const n = prior.length
  const w = [...prior]
  for (let it = 0; it < iters; it++) {
    const g = w.map((wi, i) => lambda * (wi - prior[i]))
    const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? lambda : 0)))
    for (const d of data) {
      const p = sigmoid(dot(w, d.x))
      const e = p - d.y
      const v = p * (1 - p)
      for (let i = 0; i < n; i++) {
        g[i] += e * d.x[i]
        for (let j = 0; j < n; j++) H[i][j] += v * d.x[i] * d.x[j]
      }
    }
    const step = solve(H, g)
    let moved = 0
    for (let i = 0; i < n; i++) {
      w[i] -= step[i]
      moved = Math.max(moved, Math.abs(step[i]))
    }
    if (moved < 1e-6) break
  }
  return w
}

/** Gaussian elimination with partial pivoting (the system is small and positive definite). */
function solve(A: number[][], b: number[]) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let acc = M[r][n]
    for (let k = r + 1; k < n; k++) acc -= M[r][k] * x[k]
    x[r] = acc / M[r][r]
  }
  return x
}

export interface Prediction {
  lessonId: string
  p: number
  /** unsolved problems the average is over */
  count: number
  /** the feature pulling the prediction down the most */
  drag: string | null
}

export interface PredictModel {
  w: number[]
  n: number
  /** accuracy on your most recent answers when trained on the earlier ones (null until there are enough) */
  holdout: { n: number; acc: number; baseline: number } | null
  predictions: Prediction[]
}

export function predictModel(s: Pick<State, 'log' | 'lessons'>, lessons: Lesson[], modules: ModuleInfo[]): PredictModel {
  const data = examples(s, lessons, modules)
  const w = fit(data)
  let holdout: PredictModel['holdout'] = null
  if (data.length >= 20) {
    const cut = Math.floor(data.length * 0.8)
    const wTrain = fit(data.slice(0, cut))
    const test = data.slice(cut)
    const acc = test.filter((d) => (sigmoid(dot(wTrain, d.x)) >= 0.5 ? 1 : 0) === d.y).length / test.length
    const rate = data.slice(0, cut).filter((d) => d.y).length / cut
    const baseline = test.filter((d) => (rate >= 0.5 ? 1 : 0) === d.y).length / test.length
    holdout = { n: test.length, acc, baseline }
  }

  // Current context: replay everything.
  const { byProblem } = conceptCatalog(lessons)
  const ctx: Ctx = { concept: new Map(), solved: new Set(), recent: [] }
  const tried = new Set<string>()
  for (const a of s.log.attempts) {
    const meta = byProblem.get(a[1])
    if (!meta) continue
    const ok = cleanCorrect(a)
    if (!tried.has(a[1])) {
      tried.add(a[1])
      ctx.recent.push({ ok, hint: a[3] > 0 || a[5] === 1 })
    }
    const cs = ctx.concept.get(meta.concept) ?? { p: BKT.L0, n: 0 }
    cs.p = bktSoft(cs.p, evidence(a), guessFor(meta.problem))
    cs.n += 1
    ctx.concept.set(meta.concept, cs)
    if (a[2] === 1) ctx.solved.add(a[1])
  }

  const predictions: Prediction[] = []
  for (const l of lessons) {
    if (s.lessons[l.id]?.completed) continue
    const prereqs = modules.find((m) => m.id === l.id)?.prereqs ?? []
    const open = l.problems.map((p, i) => ({ p, i })).filter(({ p }) => !tried.has(p.id))
    if (!open.length) continue
    let sum = 0
    const contrib = new Array(w.length).fill(0)
    for (const { p, i } of open) {
      const x = features(ctx, l, p.concept ?? p.id, i, p.kind === 'mcq', prereqs, lessons)
      sum += sigmoid(dot(w, x))
      x.forEach((xi, j) => (contrib[j] += (w[j] * xi) / open.length))
    }
    // Only features the learner can act on are offered as reasons.
    let drag: string | null = null
    let worst = -0.15
    for (const j of [1, 2, 3, 4, 7]) {
      if (contrib[j] < worst) {
        worst = contrib[j]
        drag = FEATURES[j].key
      }
    }
    predictions.push({ lessonId: l.id, p: sum / open.length, count: open.length, drag })
  }
  return { w, n: data.length, holdout, predictions }
}
