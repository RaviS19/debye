// All learner state lives in one object persisted on the device. No account, no server.
import { useSyncExternalStore } from 'react'
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'

export interface ProblemRecord { attempts: number; solved: boolean; firstTry: boolean }
export interface LessonRecord { opened: string; completed?: string; derivations: string[] }
export interface Reminder { enabled: boolean; time: string; days: number[] } // days: 0 = Sunday

export interface State {
  version: 1
  xp: number
  streak: { count: number; best: number; lastDay: string | null; freezes: number }
  studyDays: string[]
  lessons: Record<string, LessonRecord>
  problems: Record<string, ProblemRecord>
  cards: Record<string, Card>
  reviews: number
  simsUsed: Record<string, number>
  badges: Record<string, string>
  reminder: Reminder
  lastNotified: string | null
  glow: number
  sound: boolean
}

const KEY = 'debye-state-v1'

function fresh(): State {
  return {
    version: 1,
    xp: 0,
    streak: { count: 0, best: 0, lastDay: null, freezes: 0 },
    studyDays: [],
    lessons: {},
    problems: {},
    cards: {},
    reviews: 0,
    simsUsed: {},
    badges: {},
    reminder: { enabled: false, time: '19:00', days: [1, 2, 3, 4, 5, 6, 0] },
    lastNotified: null,
    glow: 1,
    sound: true,
  }
}

function reviveCards(cards: Record<string, Card>) {
  for (const c of Object.values(cards)) {
    c.due = new Date(c.due)
    if (c.last_review) c.last_review = new Date(c.last_review)
  }
  return cards
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const s = { ...fresh(), ...JSON.parse(raw) } as State
    s.cards = reviveCards(s.cards)
    return s
  } catch {
    return fresh()
  }
}

let state: State = load()
const listeners = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode or storage blocked: keep working in memory */
  }
}

export function getState() {
  return state
}

export function setState(fn: (s: State) => State | void) {
  const draft = structuredClone(state)
  draft.cards = reviveCards(draft.cards)
  const out = fn(draft) ?? draft
  state = out
  save()
  listeners.forEach((l) => l())
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => sel(state),
  )
}

export function resetAll() {
  state = fresh()
  save()
  listeners.forEach((l) => l())
}

// ---------- events (toasts, celebrations) ----------
export type AppEvent =
  | { kind: 'xp'; amount: number; reason: string }
  | { kind: 'badge'; id: string }
  | { kind: 'levelup'; level: number }
  | { kind: 'streak'; count: number; usedFreeze: boolean }

const eventListeners = new Set<(e: AppEvent) => void>()
export function onEvent(fn: (e: AppEvent) => void) {
  eventListeners.add(fn)
  return () => {
    eventListeners.delete(fn)
  }
}
function emit(e: AppEvent) {
  eventListeners.forEach((l) => l(e))
}

// ---------- dates ----------
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

// ---------- levels ----------
// Ranks follow a gas on its way to ignition.
export const LEVELS = [
  { xp: 0, name: 'Neutral Gas' },
  { xp: 60, name: 'Weakly Ionized' },
  { xp: 160, name: 'Glow Discharge' },
  { xp: 320, name: 'Quasi-Neutral' },
  { xp: 550, name: 'Collisionless' },
  { xp: 850, name: 'Magnetized' },
  { xp: 1250, name: 'Fully Ionized' },
  { xp: 1800, name: 'Burning Plasma' },
  { xp: 2600, name: 'Ignition' },
]
export function levelFor(xp: number) {
  let i = 0
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++
  const next = LEVELS[i + 1]
  return {
    index: i,
    name: LEVELS[i].name,
    progress: next ? (xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp) : 1,
    toNext: next ? next.xp - xp : 0,
  }
}

// ---------- actions ----------
/** Any real study action counts for the day's streak. One missed day is covered by a freeze. */
export function markStudied() {
  const today = dayKey()
  if (state.streak.lastDay === today) return
  let usedFreeze = false
  setState((s) => {
    const last = s.streak.lastDay
    const gap = last ? daysBetween(last, today) : Infinity
    if (gap === 1) s.streak.count += 1
    else if (gap === 2 && s.streak.freezes > 0) {
      s.streak.freezes -= 1
      s.streak.count += 1
      usedFreeze = true
    } else s.streak.count = 1
    s.streak.lastDay = today
    s.streak.best = Math.max(s.streak.best, s.streak.count)
    if (s.streak.count > 0 && s.streak.count % 7 === 0) s.streak.freezes = Math.min(s.streak.freezes + 1, 3)
    if (!s.studyDays.includes(today)) s.studyDays.push(today)
  })
  emit({ kind: 'streak', count: state.streak.count, usedFreeze })
  checkBadges()
}

export function addXP(amount: number, reason: string) {
  const before = levelFor(state.xp).index
  setState((s) => {
    s.xp += amount
  })
  emit({ kind: 'xp', amount, reason })
  const after = levelFor(state.xp).index
  if (after > before) emit({ kind: 'levelup', level: after })
  markStudied()
}

export function openLesson(id: string) {
  if (state.lessons[id]) return
  setState((s) => {
    s.lessons[id] = { opened: new Date().toISOString(), derivations: [] }
  })
}

export function recordProblem(id: string, correct: boolean) {
  const prev = state.problems[id]
  if (prev?.solved) return
  const attempts = (prev?.attempts ?? 0) + 1
  setState((s) => {
    s.problems[id] = { attempts, solved: correct, firstTry: correct && attempts === 1 }
  })
  if (correct) addXP(attempts === 1 ? 20 : 10, attempts === 1 ? 'Solved first try' : 'Problem solved')
  else markStudied()
  checkBadges()
}

export function finishDerivation(lessonId: string, derivId: string) {
  const rec = state.lessons[lessonId]
  if (rec?.derivations.includes(derivId)) return
  setState((s) => {
    s.lessons[lessonId] ??= { opened: new Date().toISOString(), derivations: [] }
    s.lessons[lessonId].derivations.push(derivId)
  })
  addXP(15, 'Derivation complete')
  checkBadges()
}

export function touchSim(id: string) {
  const first = !state.simsUsed[id]
  setState((s) => {
    s.simsUsed[id] = (s.simsUsed[id] ?? 0) + 1
  })
  if (first) addXP(5, 'New simulation explored')
  checkBadges()
}

export function completeLesson(id: string) {
  if (state.lessons[id]?.completed) return
  setState((s) => {
    s.lessons[id] ??= { opened: new Date().toISOString(), derivations: [] }
    s.lessons[id].completed = new Date().toISOString()
  })
  addXP(50, 'Lesson mastered')
  checkBadges()
}

// ---------- spaced repetition (FSRS) ----------
const scheduler = fsrs({ enable_fuzz: true })

export function ensureCards(ids: string[]) {
  const missing = ids.filter((id) => !state.cards[id])
  if (!missing.length) return
  setState((s) => {
    for (const id of missing) s.cards[id] = createEmptyCard(new Date())
  })
}

export function reviewCard(id: string, grade: Grade) {
  setState((s) => {
    s.cards[id] = scheduler.next(s.cards[id] ?? createEmptyCard(), new Date(), grade).card
    s.reviews += 1
  })
  addXP(2, 'Card reviewed')
}

export function dueCards(ids?: string[]): string[] {
  const now = Date.now()
  return Object.entries(state.cards)
    .filter(([id, c]) => (!ids || ids.includes(id)) && c.due.getTime() <= now)
    .sort((a, b) => a[1].due.getTime() - b[1].due.getTime())
    .map(([id]) => id)
}

export { Rating }

// ---------- badges ----------
import { BADGES } from './badges'

export function checkBadges() {
  for (const b of BADGES) {
    if (state.badges[b.id]) continue
    if (b.test(state)) {
      setState((s) => {
        s.badges[b.id] = new Date().toISOString()
      })
      emit({ kind: 'badge', id: b.id })
    }
  }
}
