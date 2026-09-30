// Weekly digest, study rhythm, problem patterns, weak spots and next-step suggestions.
import type { State } from '../store/store'
import type { Lesson, ModuleInfo } from '../lessons/types'
import { band, conceptMastery, type ConceptState } from './concepts'
import { predictModel, type PredictModel } from './predict'

const DAY = 86400000

/** Timestamps of every logged study action. */
export function actionTimes(s: Pick<State, 'log'>) {
  return [...s.log.xp.map((e) => e[0]), ...s.log.attempts.map((e) => e[0]), ...s.log.reviews.map((e) => e[0]), ...s.log.tutor.map((e) => e[0])].sort((a, b) => a - b)
}

/** Sessions are runs of actions with gaps under 30 minutes; each gets two minutes of padding. */
export function sessions(times: number[]) {
  const out: { start: number; end: number }[] = []
  for (const t of times) {
    const last = out[out.length - 1]
    if (last && t - last.end < 30 * 60000) last.end = t
    else out.push({ start: t, end: t })
  }
  return out.map((x) => ({ ...x, minutes: (x.end - x.start) / 60000 + 2 }))
}

export interface WeekStats {
  xp: number
  solved: number
  firstTry: number
  reviews: number
  minutes: number
  days: number
  mastered: string[]
}

export function weekStats(s: State, lessons: Lesson[], end = Date.now()): WeekStats {
  const start = startOfDay(end) - 6 * DAY
  const inWeek = (t: number) => t >= start && t <= end
  const solvedAttempts = s.log.attempts.filter((a) => inWeek(a[0]) && a[2] === 1)
  const firsts = new Set<string>()
  let firstTry = 0
  for (const a of s.log.attempts) {
    if (firsts.has(a[1])) continue
    firsts.add(a[1])
    if (inWeek(a[0]) && a[2] === 1) firstTry++
  }
  const times = actionTimes(s).filter(inWeek)
  return {
    xp: s.log.xp.filter((e) => inWeek(e[0])).reduce((a, e) => a + e[1], 0),
    solved: solvedAttempts.length,
    firstTry,
    reviews: s.log.reviews.filter((r) => inWeek(r[0])).length,
    minutes: Math.round(sessions(times).reduce((a, x) => a + x.minutes, 0)),
    days: new Set(times.map((t) => dayOf(t))).size,
    mastered: lessons.filter((l) => {
      const c = s.lessons[l.id]?.completed
      return c && inWeek(Date.parse(c))
    }).map((l) => l.id),
  }
}

export function startOfDay(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function dayOf(t: number) {
  const d = new Date(t)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export interface Rhythm {
  hours: number[]
  bestHour: number | null
  avgSession: number
  sessions: number
}

/** When you actually study, from the last 60 days of actions. */
export function rhythm(s: Pick<State, 'log'>, now = Date.now()): Rhythm {
  const times = actionTimes(s).filter((t) => t > now - 60 * DAY)
  const ss = sessions(times)
  const hours = new Array(24).fill(0)
  // Count sessions (not clicks) by the hour they started, so one long evening does not dominate.
  for (const x of ss) hours[new Date(x.start).getHours()] += 1
  const max = Math.max(...hours)
  return {
    hours,
    bestHour: ss.length >= 4 && max >= 2 ? hours.indexOf(max) : null,
    avgSession: ss.length ? ss.reduce((a, x) => a + x.minutes, 0) / ss.length : 0,
    sessions: ss.length,
  }
}

export const MISTAKES: Record<string, { label: string; advice: string }> = {
  pow10: { label: 'Off by a power of ten', advice: 'Check unit prefixes and cm⁻³ versus m⁻³ before you compute.' },
  '2pi': { label: 'Off by 2π', advice: 'Decide up front whether the question wants ω (rad/s) or f (Hz).' },
  high: { label: 'Too high', advice: 'Look for a square root or a factor you forgot to divide by.' },
  low: { label: 'Too low', advice: 'Look for a square root you took twice or a factor you divided by twice.' },
  option: { label: 'Wrong choice', advice: 'Before choosing, say which way each quantity scales and why.' },
}

export interface Patterns {
  numeric: { n: number; first: number }
  mcq: { n: number; first: number }
  hintRate: number
  mistakes: { kind: string; n: number }[]
}

export function patterns(s: Pick<State, 'log'>, lessons: Lesson[]): Patterns {
  const kind = new Map<string, 'numeric' | 'mcq'>()
  for (const l of lessons) for (const p of l.problems) kind.set(p.id, p.kind)
  const seen = new Set<string>()
  const out: Patterns = { numeric: { n: 0, first: 0 }, mcq: { n: 0, first: 0 }, hintRate: 0, mistakes: [] }
  const counts: Record<string, number> = {}
  let hinted = 0
  for (const a of s.log.attempts) {
    const k = kind.get(a[1])
    if (!k) continue
    if (a[4]) counts[a[4]] = (counts[a[4]] ?? 0) + 1
    if (seen.has(a[1])) continue
    seen.add(a[1])
    out[k].n += 1
    if (a[2] === 1 && a[3] === 0) out[k].first += 1
  }
  const byProblem = new Map<string, boolean>()
  for (const a of s.log.attempts) if (a[3] > 0) byProblem.set(a[1], true)
  hinted = byProblem.size
  out.hintRate = seen.size ? hinted / seen.size : 0
  out.mistakes = Object.entries(counts).map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n)
  return out
}

export interface WeakSpot {
  concept: string
  label: string
  lessonId: string
  p: number
  reason: string
}

export function weakSpots(s: State, lessons: Lesson[], limit = 4): WeakSpot[] {
  const { concepts, state } = conceptMastery(s, lessons)
  const out: WeakSpot[] = []
  for (const [id, cs] of state as Map<string, ConceptState>) {
    const b = band(cs)
    if (b === 'solid') continue
    const info = concepts.get(id)
    if (!info) continue
    const unsolved = info.problems.filter((p) => !s.problems[p]?.solved).length
    out.push({
      concept: id,
      label: info.label,
      lessonId: info.lessons[0],
      p: cs.p,
      reason: unsolved ? `${unsolved} problem${unsolved === 1 ? '' : 's'} still open` : cs.helped ? 'solved with help; try it again cold' : 'several tries needed',
    })
  }
  return out.sort((a, b) => a.p - b.p).slice(0, limit)
}

/** Lessons whose flashcards you have been forgetting lately. */
export function fadingLessons(s: State, lessons: Lesson[], now = Date.now()) {
  const recent = s.log.reviews.filter((r) => r[0] > now - 14 * DAY)
  const out: { lessonId: string; lapses: number }[] = []
  for (const l of lessons) {
    const ids = new Set(l.cards.map((c) => c.id))
    const lapses = recent.filter((r) => ids.has(r[1]) && r[2] === 1).length
    if (lapses >= 2) out.push({ lessonId: l.id, lapses })
  }
  return out.sort((a, b) => b.lapses - a.lapses)
}

export interface Suggestion {
  lessonId: string
  kind: 'continue' | 'next' | 'prep' | 'revisit'
  title: string
  reason: string
  /** predicted chance of solving a new problem there cleanly on the first try */
  p?: number
}

const DRAG_TEXT: Record<string, string> = {
  lesson: 'your answers in this lesson so far have needed several tries',
  concept: 'it reuses a concept you found tricky',
  prereq: 'its prerequisites are not mastered yet',
  recent: 'your recent first-try accuracy has dipped',
  hints: 'you have leaned on hints lately',
}

/** Up to three next steps, each with the reason behind it, so the learner can overrule them. */
export function suggestions(s: State, lessons: Lesson[], modules: ModuleInfo[], model?: PredictModel): Suggestion[] {
  const m = model ?? predictModel(s, lessons, modules)
  const pred = new Map(m.predictions.map((p) => [p.lessonId, p]))
  const out: Suggestion[] = []
  const mastered = (id: string) => !!s.lessons[id]?.completed
  const pct = (p?: number) => (p === undefined ? '' : ` Predicted first-try success on its problems: ${Math.round(p * 100)}%.`)

  const started = lessons.find((l) => s.lessons[l.id] && !mastered(l.id))
  if (started) {
    const left = started.problems.filter((p) => !s.problems[p.id]?.solved).length
    out.push({ lessonId: started.id, kind: 'continue', title: `Finish ${started.id}`, reason: `You started it. ${left} problem${left === 1 ? '' : 's'} left to master it.`, p: pred.get(started.id)?.p })
  }
  const next = lessons.find((l) => !s.lessons[l.id] && (modules.find((x) => x.id === l.id)?.prereqs ?? []).every(mastered))
  if (next && next.id !== started?.id) {
    const pr = pred.get(next.id)
    if (pr && pr.p < 0.45 && pr.drag === 'prereq') {
      const weakPre = (modules.find((x) => x.id === next.id)?.prereqs ?? []).find((id) => !mastered(id))
      if (weakPre) out.push({ lessonId: weakPre, kind: 'prep', title: `Warm up with ${weakPre}`, reason: `${next.id} leans on it and the model expects ${next.id} to be hard for you right now.` })
    }
    out.push({ lessonId: next.id, kind: 'next', title: `Start ${next.id}`, reason: `Its prerequisites are mastered.${pct(pr?.p)}${pr?.drag && pr.p < 0.5 ? ` Take it slowly: ${DRAG_TEXT[pr.drag]}.` : ''}` })
  }
  const taken = (id: string) => out.some((x) => x.lessonId === id)
  const weak = weakSpots(s, lessons, 6).find((w) => !taken(w.lessonId))
  if (weak) out.push({ lessonId: weak.lessonId, kind: 'revisit', title: `Revisit ${weak.label}`, reason: `One of the ideas still settling (${weak.reason}).` })
  const fading = fadingLessons(s, lessons).find((f) => !taken(f.lessonId))
  if (fading) out.push({ lessonId: fading.lessonId, kind: 'revisit', title: `Refresh ${fading.lessonId}`, reason: `${fading.lapses} of its flashcards slipped in the last two weeks. A quick review brings them back.` })
  if (!out.length) {
    const any = lessons.find((l) => !mastered(l.id))
    if (any) out.push({ lessonId: any.id, kind: 'next', title: `Open ${any.id}`, reason: 'Open it any time; mastering the earlier lessons first will make it easier.', p: pred.get(any.id)?.p })
  }
  return out.slice(0, 3)
}
