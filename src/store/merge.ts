// Merging two copies of the learner state (this device and another one) without losing anything.
// Counters are kept per device and merged by maximum; sets are unions; records keep the most advanced
// version; logs are unions. A reset (newer epoch) wins over everything older.
import type { Card } from 'ts-fsrs'
import { fresh, LOG_CAPS, reviveCards, type Logs, type State } from './store'

/** The part of the state that travels between devices. Device-local settings stay behind, including the tutor
 *  model and its optional API key (tutorModel), which must never leave the device. */
export type Synced = Pick<
  State,
  'xpBy' | 'streak' | 'studyDays' | 'lessons' | 'problems' | 'cards' | 'reviewsBy' | 'simsUsed' | 'badges' | 'log' | 'epoch'
>
// Every merge rule below is commutative and idempotent, so two devices always converge on the same state
// (otherwise they would keep overwriting each other).
export const SYNC_KEYS: (keyof Synced)[] = ['xpBy', 'streak', 'studyDays', 'lessons', 'problems', 'cards', 'reviewsBy', 'simsUsed', 'badges', 'log', 'epoch']

export function payload(s: State): Synced {
  const out = {} as Record<string, unknown>
  for (const k of SYNC_KEYS) out[k] = s[k]
  return out as Synced
}

const maxMap = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v)
  return out
}
const sum = (o: Record<string, number>) => Object.values(o).reduce((x, y) => x + y, 0)
const minIso = (a?: string, b?: string) => (!a ? b : !b ? a : a < b ? a : b)

function mergeLog<T extends (string | number)[]>(a: T[] = [], b: T[] = [], cap: number): T[] {
  const seen = new Set<string>()
  const all: T[] = []
  for (const e of [...a, ...b]) {
    const key = `${e[0]}|${e[1]}`
    if (seen.has(key)) continue
    seen.add(key)
    all.push(e)
  }
  all.sort((x, y) => (x[0] as number) - (y[0] as number) || String(x[1]).localeCompare(String(y[1])))
  return all.slice(-cap)
}

function laterCard(a?: Card, b?: Card) {
  if (!a) return b
  if (!b) return a
  const ta = a.last_review ? new Date(a.last_review).getTime() : 0
  const tb = b.last_review ? new Date(b.last_review).getTime() : 0
  if (ta !== tb) return ta > tb ? a : b
  if ((a.reps ?? 0) !== (b.reps ?? 0)) return (b.reps ?? 0) > (a.reps ?? 0) ? b : a
  return canon(a) <= canon(b) ? a : b // deterministic tie-break
}

/** Merge a remote copy into the local state. Pure: returns a new state. */
export function mergeState(local: State, remoteRaw: Partial<Synced> | undefined | null): State {
  if (!remoteRaw) return local
  const remote = structuredClone(remoteRaw) as Partial<Synced>
  if (remote.cards) reviveCards(remote.cards)
  const le = local.epoch ?? ''
  const re = remote.epoch ?? ''
  if (re < le) return local // the remote copy predates a reset made here
  let base = local
  if (re > le) {
    // A reset happened elsewhere after this device's progress began: start from a clean slate.
    base = { ...fresh(), device: local.device, reminder: local.reminder, glow: local.glow, sound: local.sound, sync: local.sync, tutorModel: local.tutorModel, lastNotified: local.lastNotified, lastDigest: local.lastDigest, epoch: re }
  }
  const s = structuredClone(base)
  reviveCards(s.cards)

  s.xpBy = maxMap(s.xpBy, remote.xpBy)
  s.xp = sum(s.xpBy)
  s.reviewsBy = maxMap(s.reviewsBy, remote.reviewsBy)
  s.reviews = sum(s.reviewsBy)
  s.simsUsed = maxMap(s.simsUsed, remote.simsUsed)
  s.studyDays = [...new Set([...s.studyDays, ...(remote.studyDays ?? [])])].sort()

  if (remote.streak) {
    const a = s.streak
    const b = remote.streak
    const key = (x: typeof a) => `${x.lastDay ?? ''}|${String(x.count).padStart(6, '0')}|${x.freezes}`
    const pick = key(b) > key(a) ? b : a
    s.streak = { ...pick, best: Math.max(a.best, b.best) }
  }

  for (const [id, r] of Object.entries(remote.lessons ?? {})) {
    const l = s.lessons[id]
    if (!l) s.lessons[id] = { ...r, derivations: [...r.derivations].sort() }
    else s.lessons[id] = { opened: minIso(l.opened, r.opened)!, completed: minIso(l.completed, r.completed), derivations: [...new Set([...l.derivations, ...r.derivations])].sort() }
    if (!s.lessons[id].completed) delete s.lessons[id].completed
  }
  for (const [id, r] of Object.entries(remote.problems ?? {})) {
    const p = s.problems[id]
    s.problems[id] = p ? { attempts: Math.max(p.attempts, r.attempts), solved: p.solved || r.solved, firstTry: p.firstTry || r.firstTry } : r
  }
  for (const [id, c] of Object.entries(remote.cards ?? {})) s.cards[id] = laterCard(s.cards[id], c)!
  for (const [id, t] of Object.entries(remote.badges ?? {})) s.badges[id] = minIso(s.badges[id], t)!

  const rl = (remote.log ?? {}) as Partial<Logs>
  s.log = {
    xp: mergeLog(s.log.xp, rl.xp, LOG_CAPS.xp),
    attempts: mergeLog(s.log.attempts, rl.attempts, LOG_CAPS.attempts),
    reviews: mergeLog(s.log.reviews, rl.reviews, LOG_CAPS.reviews),
    tutor: mergeLog(s.log.tutor, rl.tutor, LOG_CAPS.tutor),
  }
  return s
}

/** JSON with sorted keys, so two equal states always serialize the same way. */
export function canon(v: unknown): string {
  return JSON.stringify(sortKeys(v))
}
function sortKeys(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = sortKeys(o[k])
    return out
  }
  return v
}
