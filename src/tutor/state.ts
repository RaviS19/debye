// AI tutor. Two ways to answer: Claude through the artifact runtime's `sample` capability (on claude.ai, on the
// viewer's own account), or a model running on the learner's own machine (local.ts) wherever the page can reach it.
// This file holds availability and panel state only, so any component can open the tutor cheaply.
import { useMemo, useSyncExternalStore } from 'react'
import { getState, setState, useStore, type TutorModel, type TutorProvider } from '../store/store'
import { localReady } from './local'

// ---------- Claude availability ----------
export type TutorAvail = 'checking' | 'ready' | 'off'
let avail: TutorAvail = 'checking'
let sampleFn: ClaudeSample | null = null
const availListeners = new Set<() => void>()
function setAvail(a: TutorAvail) {
  avail = a
  availListeners.forEach((l) => l())
}

let started = false
export function initTutor() {
  if (started) return
  started = true
  const mock = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('mocktutor')
  if (mock) {
    sampleFn = mockSample
    return setAvail('ready')
  }
  const rt = typeof window !== 'undefined' ? window.claude : undefined
  if (!rt?.use) return setAvail('off')
  rt.use('sample').then(
    (s) => {
      sampleFn = s
      setAvail(s ? 'ready' : 'off')
    },
    () => setAvail('off'),
  )
}

function useClaudeAvail() {
  return useSyncExternalStore(
    (l) => {
      availListeners.add(l)
      return () => availListeners.delete(l)
    },
    () => avail,
  )
}

/** Errors after which Claude is off for the rest of this visit (a local model, if set up, takes over). */
export const HIDE_CODES = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']
export function disableTutor() {
  setAvail('off')
}
export function getSample() {
  return sampleFn
}

// ---------- which model answers ----------
/** Inside the claude.ai artifact the page's CSP blocks every other host, localhost included, so a local
 *  model cannot be reached there (and is not even tried, to keep the console free of CSP errors). */
export const localBlocked = () => typeof window !== 'undefined' && !!window.claude

/** Claude stays the default. A configured local model answers when it is chosen, or when Claude is not available. */
export function resolveProvider(m: TutorModel, claude: TutorAvail, blocked: boolean): TutorProvider | null {
  const local = !blocked && localReady(m)
  if (m.provider === 'local' && local) return 'local'
  if (claude === 'ready') return 'claude'
  if (claude === 'checking' && m.provider === 'claude') return null
  return local ? 'local' : null
}

export function currentProvider() {
  return resolveProvider(getState().tutorModel, avail, localBlocked())
}

export function setProvider(p: TutorProvider) {
  setState((s) => {
    s.tutorModel.provider = p
  })
}

/** Everything the tutor UI needs to know about its models. */
export function useTutor() {
  const claude = useClaudeAvail()
  // Every store update clones the state, so select a value that only changes when the model settings do.
  const key = useStore((s) => JSON.stringify(s.tutorModel))
  const model = useMemo(() => JSON.parse(key) as TutorModel, [key])
  const blocked = localBlocked()
  const local = !blocked && localReady(model)
  return { provider: resolveProvider(model, claude, blocked), claude, local, blocked, both: claude === 'ready' && local, model }
}

/** 'ready' when some model can answer. */
export function useTutorAvail(): TutorAvail {
  const t = useTutor()
  return t.provider ? 'ready' : t.claude === 'checking' ? 'checking' : 'off'
}

// ---------- panel state ----------
export interface ProblemContext {
  id: string
  wrong: string[]
  hints: number
}
export interface TutorContext {
  lessonId: string | null
  problem?: ProblemContext
  /** a question to put in the box when the panel opens */
  seed?: string
  /** send the seed straight away */
  autoSend?: boolean
}
let panel: { open: boolean; ctx: TutorContext; nonce: number } = { open: false, ctx: { lessonId: null }, nonce: 0 }
const panelListeners = new Set<() => void>()
export function openTutor(ctx: TutorContext) {
  panel = { open: true, ctx, nonce: panel.nonce + 1 }
  panelListeners.forEach((l) => l())
}
export function closeTutor() {
  panel = { ...panel, open: false }
  panelListeners.forEach((l) => l())
}
export function useTutorPanel() {
  return useSyncExternalStore(
    (l) => {
      panelListeners.add(l)
      return () => panelListeners.delete(l)
    },
    () => panel,
  )
}

// ---------- local mock for development screenshots (?mocktutor) ----------
const mockSample: ClaudeSample = (input, opts) =>
  new Promise((resolve, reject) => {
    const text =
      'Good question. Think about what sets the **restoring force**: the electrons are displaced, the ions stay put, and the charge imbalance pulls them back.\n\n- Displacement $\\delta$ creates a field $E = n e \\delta/\\varepsilon_0$.\n- The equation of motion is then a harmonic oscillator:\n\n$$\\ddot\\delta = -\\omega_{pe}^2\\,\\delta, \\qquad \\omega_{pe}^2 = \\frac{n e^2}{\\varepsilon_0 m_e}$$\n\nWhat do you expect happens to $\\omega_{pe}$ if you quadruple the density?'
    let i = 0
    const id = setInterval(() => {
      if (opts?.signal?.aborted) {
        clearInterval(id)
        return reject({ code: 'cancelled', message: 'cancelled', text: text.slice(0, i) })
      }
      i = Math.min(text.length, i + 24)
      opts?.onText?.({ text: text.slice(0, i), delta: text.slice(i - 24, i) })
      if (i >= text.length) {
        clearInterval(id)
        resolve({ text, truncated: false })
      }
    }, 40)
    void input
  })
