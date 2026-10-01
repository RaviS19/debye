// All learner state lives in one object persisted on the device. Sync across devices is optional (see sync.ts).
import { useSyncExternalStore } from 'react'
import { createEmptyCard, forgetting_curve, fsrs, Rating, State as CardState, type Card, type Grade } from 'ts-fsrs'

export interface ProblemRecord { attempts: number; solved: boolean; firstTry: boolean }
export interface LessonRecord { opened: string; completed?: string; derivations: string[] }
export interface Reminder { enabled: boolean; time: string; days: number[] } // days: 0 = Sunday
export type TutorProvider = 'claude' | 'local'
export type LocalPreset = 'ollama' | 'lmstudio' | 'llamacpp' | 'jan' | 'custom'
/** Which model answers in the tutor. Per device and never synced: a local server only exists on one network. */
export interface TutorModel {
  provider: TutorProvider
  preset: LocalPreset
  /** 'ollama' = Ollama's native API, 'openai' = any OpenAI-compatible server */
  protocol: 'ollama' | 'openai'
  baseUrl: string
  model: string
  /** optional, sent as a Bearer token only when set */
  apiKey: string
  /** the context window asked for (Ollama num_ctx) and the budget the prompt is trimmed to */
  contextTokens: number
}

// Event logs are compact tuples so a year of study still fits in one synced document.
/** [time ms, xp, reason] */
export type XpEvent = [number, number, string]
/** [time ms, problem id, correct 0/1, hints shown, mistake kind ('' if none), worked solution seen 0/1] */
export type Attempt = [number, string, 0 | 1, number, string, 0 | 1]
/** [time ms, card id, grade 1-4, days since last review, stability before, predicted recall before, card state before] */
export type ReviewEntry = [number, string, number, number, number, number, number]
/** [time ms, lesson id] */
export type TutorEvent = [number, string]

export interface Logs {
  xp: XpEvent[]
  attempts: Attempt[]
  reviews: ReviewEntry[]
  tutor: TutorEvent[]
}
export const LOG_CAPS: Record<keyof Logs, number> = { xp: 1500, attempts: 1500, reviews: 2500, tutor: 400 }

export interface State {
  version: 1
  /** Random id of this browser. XP and review counts are kept per device so that syncing never loses any. */
  device: string
  xp: number
  xpBy: Record<string, number>
  streak: { count: number; best: number; lastDay: string | null; freezes: number }
  studyDays: string[]
  lessons: Record<string, LessonRecord>
  problems: Record<string, ProblemRecord>
  cards: Record<string, Card>
  reviews: number
  reviewsBy: Record<string, number>
  simsUsed: Record<string, number>
  badges: Record<string, string>
  log: Logs
  /** Recall probability you want at the moment a card comes back (FSRS "desired retention"). */
  retention: number
  /** Set when progress is reset, so a reset on one device wins over older progress on another. */
  epoch: string
  reminder: Reminder
  lastNotified: string | null
  lastDigest: string | null
  sync: { enabled: boolean }
  glow: number
  sound: boolean
  tutorModel: TutorModel
}

const KEY = 'debye-state-v1'

function newDeviceId() {
  try {
    return crypto.randomUUID().slice(0, 8)
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
}

export function fresh(): State {
  return {
    version: 1,
    device: newDeviceId(),
    xp: 0,
    xpBy: {},
    streak: { count: 0, best: 0, lastDay: null, freezes: 0 },
    studyDays: [],
    lessons: {},
    problems: {},
    cards: {},
    reviews: 0,
    reviewsBy: {},
    simsUsed: {},
    badges: {},
    log: { xp: [], attempts: [], reviews: [], tutor: [] },
    retention: 0.9,
    epoch: '',
    reminder: { enabled: false, time: '19:00', days: [1, 2, 3, 4, 5, 6, 0] },
    lastNotified: null,
    lastDigest: null,
    sync: { enabled: true },
    glow: 1,
    sound: true,
    tutorModel: { provider: 'claude', preset: 'ollama', protocol: 'ollama', baseUrl: 'http://localhost:11434', model: '', apiKey: '', contextTokens: 8192 },
  }
}

export function reviveCards(cards: Record<string, Card>) {
  for (const c of Object.values(cards)) {
    c.due = new Date(c.due)
    if (c.last_review) c.last_review = new Date(c.last_review)
  }
  return cards
}

/** Fill in fields added after a state was first saved. */
export function upgrade(raw: Partial<State>): State {
  const base = fresh()
  const s = { ...base, ...raw } as State
  s.log = { ...base.log, ...(raw.log ?? {}) }
  s.sync = { ...base.sync, ...(raw.sync ?? {}) }
  // Claude stays the default; a local model takes over only once someone sets one up in Settings.
  s.tutorModel = { ...base.tutorModel, ...(raw.tutorModel ?? {}) }
  s.cards = reviveCards(s.cards ?? {})
  if (!raw.xpBy || !Object.keys(raw.xpBy).length) s.xpBy = s.xp ? { [s.device]: s.xp } : {}
  if (!raw.reviewsBy || !Object.keys(raw.reviewsBy).length) s.reviewsBy = s.reviews ? { [s.device]: s.reviews } : {}
  return s
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    return upgrade(JSON.parse(raw))
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

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state))
}

/** Erase progress but keep this device's settings. With sync on, the reset reaches other devices too. */
export function resetAll() {
  const keep = state
  state = { ...fresh(), device: keep.device, reminder: keep.reminder, glow: keep.glow, sound: keep.sound, sync: keep.sync, retention: keep.retention, tutorModel: keep.tutorModel, epoch: new Date().toISOString() }
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

// ---------- logs ----------
function pushLog<K extends keyof Logs>(s: State, k: K, entry: Logs[K][number]) {
  const arr = s.log[k] as Logs[K][number][]
  arr.push(entry)
  if (arr.length > LOG_CAPS[k]) arr.splice(0, arr.length - LOG_CAPS[k])
}
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
const r3 = (x: number) => Math.round(x * 1000) / 1000

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
    s.xpBy[s.device] = (s.xpBy[s.device] ?? 0) + amount
    s.xp = sum(s.xpBy)
    pushLog(s, 'xp', [Date.now(), amount, reason])
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

export interface AttemptInfo {
  /** hints revealed before this answer */
  hints?: number
  /** what kind of mistake a wrong answer looked like, e.g. 'pow10', '2pi', 'high', 'low', 'option' */
  mistake?: string
  /** the worked solution was open before this answer */
  sawSolution?: boolean
}

export function recordProblem(id: string, correct: boolean, info: AttemptInfo = {}) {
  const prev = state.problems[id]
  if (prev?.solved) return
  const attempts = (prev?.attempts ?? 0) + 1
  setState((s) => {
    s.problems[id] = { attempts, solved: correct, firstTry: correct && attempts === 1 }
    pushLog(s, 'attempts', [Date.now(), id, correct ? 1 : 0, info.hints ?? 0, correct ? '' : info.mistake ?? '', info.sawSolution ? 1 : 0])
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

export function logTutorQuestion(lessonId: string) {
  setState((s) => {
    pushLog(s, 'tutor', [Date.now(), lessonId])
  })
  markStudied()
  checkBadges()
}

// ---------- spaced repetition (FSRS with a personal memory curve) ----------
import { memoryModel } from '../learner/memory'

const baseScheduler = fsrs({ enable_fuzz: true })
export const FSRS_W = baseScheduler.parameters.w

let schedCache: { key: string; sched: ReturnType<typeof fsrs>; target: number } | null = null
/** A scheduler whose retention target is shifted by how well this learner actually remembers (memory.ts). */
export function scheduler() {
  const key = `${state.retention}|${state.log.reviews.length}`
  if (schedCache?.key !== key) {
    const m = memoryModel(state.log.reviews, state.retention, FSRS_W)
    schedCache = { key, sched: fsrs({ enable_fuzz: true, request_retention: m.effectiveRetention }), target: m.effectiveRetention }
  }
  return schedCache.sched
}

export function ensureCards(ids: string[]) {
  const missing = ids.filter((id) => !state.cards[id])
  if (!missing.length) return
  setState((s) => {
    for (const id of missing) s.cards[id] = createEmptyCard(new Date())
  })
}

export function reviewCard(id: string, grade: Grade) {
  const sched = scheduler()
  setState((s) => {
    const now = new Date()
    const card = s.cards[id] ?? createEmptyCard(now)
    const days = card.last_review ? (now.getTime() - card.last_review.getTime()) / 86400000 : 0
    const R = card.stability > 0 && card.last_review ? forgetting_curve(FSRS_W, days, card.stability) : 0
    pushLog(s, 'reviews', [now.getTime(), id, grade, r3(days), r3(card.stability), r3(R), card.state])
    s.cards[id] = sched.next(card, now, grade).card
    s.reviewsBy[s.device] = (s.reviewsBy[s.device] ?? 0) + 1
    s.reviews = sum(s.reviewsBy)
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

export { Rating, CardState }

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

/** Replace the whole state (used by sync and progress import). Emits no events. */
export function replaceState(next: State) {
  state = next
  save()
  listeners.forEach((l) => l())
}
