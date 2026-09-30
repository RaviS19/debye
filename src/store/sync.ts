// Cross-device sync through the claude.ai artifact store (private to each signed-in person), plus a
// copy-and-paste progress code for moving between places that cannot sync (another browser, the Android app).
import { useSyncExternalStore } from 'react'
import { getState, replaceState, setState, subscribe } from './store'
import { canon, mergeState, payload, type Synced } from './merge'

export type SyncState = 'unavailable' | 'off' | 'connecting' | 'synced' | 'saving' | 'error'
let status: { state: SyncState; detail?: string; at?: number } = { state: 'connecting' }
const statusListeners = new Set<() => void>()
function setStatus(state: SyncState, detail?: string) {
  status = { state, detail, at: Date.now() }
  statusListeners.forEach((l) => l())
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l)
      return () => statusListeners.delete(l)
    },
    () => status,
  )
}

type DocName = 'core' | 'history'
const MAX_BYTES = 240_000

function bodyFor(doc: DocName, p: Synced): Record<string, unknown> {
  if (doc === 'history') return { epoch: p.epoch, log: p.log }
  const { log: _log, ...core } = p
  void _log
  return core
}

/** Trim the oldest log entries until the document fits the store's size limit. */
function fit(body: Record<string, unknown>) {
  let json = canon(body)
  if (json.length <= MAX_BYTES || !body.log) return json
  const log = structuredClone(body.log) as Record<string, unknown[]>
  while (json.length > MAX_BYTES) {
    for (const k of Object.keys(log)) log[k] = log[k].slice(Math.floor(log[k].length / 4))
    json = canon({ ...body, log })
  }
  return json
}

let refs: Record<DocName, ClaudeDocRef> | null = null
let unsubs: (() => void)[] = []
const lastSeen: Record<DocName, string | null> = { core: null, history: null }
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let again = false
let started = false

async function flush() {
  if (!refs || !getState().sync.enabled) return
  if (flushing) {
    again = true
    return
  }
  flushing = true
  try {
    const p = payload(getState())
    for (const doc of ['core', 'history'] as DocName[]) {
      if (lastSeen[doc] === null) continue // wait for the first snapshot before writing
      const json = fit(bodyFor(doc, p))
      if (json === lastSeen[doc]) continue
      setStatus('saving')
      await refs[doc].set(JSON.parse(json))
      lastSeen[doc] = json
    }
    setStatus('synced')
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'unavailable'
    if (code === 'quota_exceeded') setStatus('error', 'The sync store is full. Progress is still saved on this device.')
    else if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked') setStatus('error', 'This view cannot save synced progress. It is still saved on this device.')
    else setStatus('error', 'Could not reach the sync store. It will retry on your next change.')
  } finally {
    flushing = false
    if (again) {
      again = false
      schedule()
    }
  }
}

function schedule(ms = 2500) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, ms)
}

function onRemote(doc: DocName, snap: ClaudeDocSnapshot) {
  if (snap.metadata.hasPendingWrites) return
  const data = snap.exists ? snap.data() : undefined
  lastSeen[doc] = data ? canon(data) : ''
  if (data) {
    const local = getState()
    const merged = mergeState(local, data as Partial<Synced>)
    if (canon(payload(merged)) !== canon(payload(local))) replaceState(merged)
  }
  if (status.state === 'connecting') setStatus('synced')
  schedule(800)
}

function listen() {
  if (!refs) return
  unsubs.forEach((u) => u())
  lastSeen.core = lastSeen.history = null
  setStatus('connecting')
  unsubs = (['core', 'history'] as DocName[]).map((doc) =>
    refs![doc].onSnapshot(
      (snap) => onRemote(doc, snap),
      (e) => setStatus('error', e.code === 'revoked' ? 'Sync was switched off for this view.' : 'Sync stopped. Reload the page to reconnect.'),
    ),
  )
}

/** Connects to the artifact store when the app runs on claude.ai. Safe to call more than once. */
export async function startSync() {
  if (started) return
  started = true
  const rt = typeof window !== 'undefined' ? window.claude : undefined
  if (!rt?.use) return setStatus('unavailable')
  try {
    const [db, user] = await Promise.all([rt.use('db'), rt.use('user')])
    const id = user ? await user.id() : null
    if (!db || !id) return setStatus('unavailable')
    refs = { core: db.doc(`data/users/${id}/progress`), history: db.doc(`data/users/${id}/history`) }
  } catch {
    return setStatus('unavailable')
  }
  subscribe(() => {
    if (getState().sync.enabled && refs) schedule()
  })
  if (getState().sync.enabled) listen()
  else setStatus('off')
}

export function setSyncEnabled(on: boolean) {
  setState((s) => {
    s.sync.enabled = on
  })
  if (!refs) return
  if (on) listen()
  else {
    unsubs.forEach((u) => u())
    unsubs = []
    setStatus('off')
  }
}

// ---------- progress codes ----------
const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

/** A text code holding all synced progress. Gzipped where the browser supports it. */
export async function exportCode() {
  const bytes = new TextEncoder().encode(canon(payload(getState())))
  if (typeof CompressionStream !== 'undefined') return 'DEBYE1.' + toB64(await pipe(bytes, new CompressionStream('gzip')))
  return 'DEBYE0.' + toB64(bytes)
}

/** Merges a progress code into this device. Nothing already here is lost. */
export async function importCode(code: string) {
  const c = code.trim().replace(/\s+/g, '')
  let bytes: Uint8Array
  if (c.startsWith('DEBYE1.')) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed codes.')
    bytes = await pipe(fromB64(c.slice(7)), new DecompressionStream('gzip'))
  } else if (c.startsWith('DEBYE0.')) bytes = fromB64(c.slice(7))
  else throw new Error('That does not look like a Debye progress code.')
  const data = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Synced>
  if (!data || typeof data !== 'object' || !data.xpBy) throw new Error('The code is incomplete.')
  replaceState(mergeState(getState(), data))
}
