// Local models for the tutor: Ollama's own API, or any OpenAI-compatible server (LM Studio, llama.cpp, Jan…).
// Pure clients with an injectable fetch, so the stream parsing is tested without a server (local.test.ts).
import type { LocalPreset, TutorModel } from '../store/store'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export interface ModelInfo {
  id: string
  /** size and quantization, when the server says */
  detail?: string
}
type Fetch = typeof fetch

// ---------- presets ----------
export const PRESETS: Record<LocalPreset, { label: string; baseUrl: string; protocol: TutorModel['protocol'] }> = {
  ollama: { label: 'Ollama', baseUrl: 'http://localhost:11434', protocol: 'ollama' },
  lmstudio: { label: 'LM Studio', baseUrl: 'http://localhost:1234/v1', protocol: 'openai' },
  llamacpp: { label: 'llama.cpp server', baseUrl: 'http://localhost:8080/v1', protocol: 'openai' },
  jan: { label: 'Jan', baseUrl: 'http://localhost:1337/v1', protocol: 'openai' },
  custom: { label: 'Custom (OpenAI-compatible)', baseUrl: '', protocol: 'openai' },
}
export const CONTEXT_SIZES = [4096, 8192, 16384, 32768]

export const trimUrl = (u: string) => u.trim().replace(/\/+$/, '')
/** What the address field keeps on blur: trimmed, and with http:// added when the scheme was left off ("localhost:11434"). */
export const tidyUrl = (u: string) => {
  const t = trimUrl(u)
  return t && !/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? `http://${t}` : t
}
const isHttp = (u: string) => /^https?:\/\/[^/]/i.test(u)
/** A local model is usable once it has an address and a model name. */
export const localReady = (m: TutorModel) => !!trimUrl(m.baseUrl) && !!m.model.trim()
export function hostOf(url: string) {
  try {
    return new URL(trimUrl(url)).host
  } catch {
    return url
  }
}

// ---------- context budget ----------
/** Characters the whole prompt may use: ~1500 tokens stay free for the answer, at a cautious 2.5 characters a token
 *  (TeX and numbers tokenize poorly). The lesson excerpt gets a share of it. */
export function promptBudget(contextTokens: number) {
  const total = Math.max(3000, Math.round((contextTokens - 1500) * 2.5))
  const excerpt = Math.min(9000, Math.max(1500, Math.round(total * 0.4)))
  return { total, excerpt }
}

/** Question-and-answer pairs only. A question whose answer never came (server down, stopped while thinking) is
 *  dropped, so the roles strictly alternate: the chat templates of Mistral, Gemma and others reject anything else. */
function pairs<T extends { role: string; content: string }>(history: T[]): T[] {
  const out: T[] = []
  history.forEach((h, i) => {
    if (h.role === 'user' ? history[i + 1]?.role === 'assistant' && !!history[i + 1].content : out[out.length - 1]?.role === 'user' && !!h.content) out.push(h)
  })
  return out
}

/** The most recent turns that still fit next to the system prompt and the new question, oldest dropped first. */
export function fitHistory<T extends { role: string; content: string }>(system: string, history: T[], question: string, total: number): T[] {
  const turns = pairs(history)
  let used = system.length + question.length
  const out: T[] = []
  for (let i = turns.length - 1; i >= 0; i--) {
    used += turns[i].content.length
    if (used > total) break
    out.unshift(turns[i])
  }
  while (out[0]?.role === 'assistant') out.shift() // a conversation reads best starting with the learner
  return out
}

// ---------- errors ----------
export type LocalErrorCode = 'bad_url' | 'network' | 'timeout' | 'interrupted' | 'cancelled' | 'model_missing' | 'not_found' | 'auth' | 'forbidden' | 'server' | 'not_chat' | 'http' | 'empty'
export class LocalError extends Error {
  code: LocalErrorCode
  /** what had arrived before the error, kept on screen like the Claude path */
  text = ''
  status?: number
  /** models the server does have, offered when the chosen one is missing */
  models?: string[]
  constructor(code: LocalErrorCode, message: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError'
const MISSING = /model.*(not found|does not exist|not loaded|no such|unknown|not available)|(no|unknown) model/i
const WRONG_PATH = /unexpected endpoint/i // LM Studio's answer (HTTP 200) for a path it does not serve, e.g. /v1 left off
const NOT_CHAT = /does not support (chat|generate)/i // Ollama, asked to chat with an embedding model
const errText = (e: unknown): string => (typeof e === 'string' ? e : (e as { message?: string })?.message ?? JSON.stringify(e))

async function httpError(res: Response, url: string) {
  let body = ''
  try {
    body = await res.text()
  } catch {
    /* no body */
  }
  let detail = body.trim().slice(0, 300)
  try {
    const o = JSON.parse(body)
    if (o?.error) detail = errText(o.error)
  } catch {
    /* plain text */
  }
  const s = res.status
  let code: LocalErrorCode = 'http'
  if (s === 401) code = 'auth'
  else if (s === 403) code = 'forbidden'
  else if ((s === 404 || s === 400 || s === 422) && MISSING.test(detail)) code = 'model_missing'
  else if (s === 404) code = 'not_found'
  else if (s === 400 && NOT_CHAT.test(detail)) code = 'not_chat'
  const e = new LocalError(code, detail || res.statusText || `HTTP ${s}`, s)
  if (code === 'not_found') e.message = url
  return e
}

/** A signal that follows the caller's and can also be fired on its own (a timeout), which `timedOut` tells apart. */
function linked(outer?: AbortSignal) {
  const c = new AbortController()
  const relay = () => c.abort()
  if (outer?.aborted) c.abort()
  else outer?.addEventListener('abort', relay)
  const l = {
    signal: c.signal,
    timedOut: false,
    fire: () => {
      l.timedOut = true
      c.abort()
    },
    release: () => outer?.removeEventListener('abort', relay),
  }
  return l
}

/** fetch with the errors sorted out. With `timeout`, a host that has not answered (sent headers) by then is given up on:
 *  an unreachable LAN address otherwise hangs for minutes before the browser fails it. */
async function request(f: Fetch, url: string, init: RequestInit, timeout?: number) {
  let res: Response
  try {
    if (!isHttp(url)) throw 0
    new URL(url)
  } catch {
    throw new LocalError('bad_url', url)
  }
  const l = timeout ? linked(init.signal ?? undefined) : null
  const timer = l ? setTimeout(l.fire, timeout) : undefined
  try {
    res = await f(url, l ? { ...init, signal: l.signal } : init)
  } catch (e) {
    if (l?.timedOut) throw new LocalError('timeout', url)
    if (isAbort(e) || init.signal?.aborted) throw new LocalError('cancelled', 'Stopped.')
    throw new LocalError('network', errText(e)) // a TypeError: nothing listening, or blocked by CORS
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw await httpError(res, url)
  return res
}

function headers(m: TutorModel, json: boolean) {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  if (m.apiKey.trim()) h.Authorization = `Bearer ${m.apiKey.trim()}`
  return h
}

// ---------- model lists ----------
/** How long a model list, or the reachability check during a chat, may take before the host counts as unreachable. */
export const LIST_TIMEOUT = 8000
/** How long a chat waits for response headers before checking that the host is there at all
 *  (a cold model can legitimately take a minute to load, so the chat itself is never timed out). */
export const PROBE_AFTER = 5000

/** Ollama: GET /api/tags. OpenAI-compatible: GET /models. */
export async function listModels(m: TutorModel, opts: { fetch?: Fetch; signal?: AbortSignal; timeout?: number } = {}): Promise<ModelInfo[]> {
  const f = opts.fetch ?? fetch.bind(globalThis)
  const base = trimUrl(m.baseUrl)
  const url = m.protocol === 'ollama' ? `${base}/api/tags` : `${base}/models`
  const res = await request(f, url, { headers: headers(m, false), signal: opts.signal }, opts.timeout ?? LIST_TIMEOUT)
  let o: { error?: unknown; models?: { name?: string; model?: string; details?: { parameter_size?: string; quantization_level?: string } }[]; data?: { id?: string }[] }
  try {
    o = await res.json()
  } catch {
    throw new LocalError('http', 'The server answered, but not with a list of models. Check the address and the server type.')
  }
  if (o?.error) {
    const t = errText(o.error)
    throw WRONG_PATH.test(t) || /not found/i.test(t) ? new LocalError('not_found', url) : new LocalError('server', t)
  }
  if (m.protocol === 'ollama')
    return (o.models ?? [])
      .map((x) => ({ id: x.name ?? x.model ?? '', detail: [x.details?.parameter_size, x.details?.quantization_level].filter(Boolean).join(' · ') || undefined }))
      .filter((x) => x.id)
  return (o.data ?? []).map((x) => ({ id: x.id ?? '' })).filter((x) => x.id)
}

// ---------- streaming ----------
/** Complete lines from a byte stream, however the chunks split them (mid-line, mid-character, between \r and \n).
 *  Aborting the signal ends the stream; the caller decides what that means. */
export async function* readLines(body: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  const reader = body.getReader()
  const stop = () => void reader.cancel().catch(() => {})
  signal?.addEventListener('abort', stop)
  const dec = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        yield buf.slice(0, i).replace(/\r$/, '')
        buf = buf.slice(i + 1)
      }
    }
    buf += dec.decode()
    if (buf) yield buf.replace(/\r$/, '')
  } finally {
    signal?.removeEventListener('abort', stop)
    stop() // close the connection when the caller stops early ([DONE], an error)
  }
}

export interface StreamEvent {
  text?: string
  /** the stream is over: stop reading */
  done?: boolean
  /** the answer is complete (a finish_reason); [DONE] may still follow */
  finished?: boolean
  truncated?: boolean
  error?: string
}

/** Ollama /api/chat: one JSON object per line. Its `thinking` field (reasoning models) is not shown. */
export function parseNdjsonLine(line: string): StreamEvent | null {
  const t = line.trim()
  if (!t) return null
  let o: { error?: unknown; message?: { content?: string }; done?: boolean; done_reason?: string }
  try {
    o = JSON.parse(t)
  } catch {
    return null
  }
  if (o.error) return { error: errText(o.error) }
  return { text: o.message?.content ?? '', done: !!o.done, truncated: !!o.done && o.done_reason === 'length' }
}

/** OpenAI-compatible /chat/completions: server-sent events, `data: {...}` lines ending with `data: [DONE]`.
 *  reasoning_content / reasoning deltas are not shown. */
export function parseSseLine(line: string): StreamEvent | null {
  if (!line.trim() || line.startsWith(':')) return null // blank separator or comment
  let data: string
  if (line.startsWith('data:')) data = line.slice(5).trim()
  else if (line.startsWith('error:')) {
    // some llama.cpp server builds send a streaming error as its own SSE field
    const t = line.slice(6).trim()
    try {
      const o = JSON.parse(t)
      return { error: errText(o?.error ?? o) }
    } catch {
      return { error: t || 'unknown error' }
    }
  } else if (line.trimStart().startsWith('{')) data = line.trim() // a bare JSON error some servers send
  else return null // event:, id:, retry:
  if (data === '[DONE]') return { done: true }
  let o: { error?: unknown; choices?: { delta?: { content?: string | null }; message?: { content?: string | null }; finish_reason?: string | null }[] }
  try {
    o = JSON.parse(data)
  } catch {
    return null
  }
  if (o.error) return { error: errText(o.error) }
  const c = o.choices?.[0]
  const ev: StreamEvent = { text: c?.delta?.content ?? c?.message?.content ?? '', truncated: c?.finish_reason === 'length' }
  if (c?.finish_reason) ev.finished = true
  return ev
}

/** What to show of a reply: reasoning models wrap their thinking in <think>…</think>, which stays hidden,
 *  including a block still streaming. Mid-stream, a tag that is only half there is held back too. */
export function visibleText(raw: string, final = false) {
  let t = raw
  const close = t.indexOf('</think>')
  const open = t.indexOf('<think>')
  if (close >= 0 && (open < 0 || open > close)) t = t.slice(close + 8) // the template opened the block in the prompt
  t = t.replace(/<think>[\s\S]*?<\/think>/g, '')
  const still = t.indexOf('<think>')
  if (still >= 0) t = t.slice(0, still)
  if (!final) t = t.replace(/<(t(h(i(n(k)?)?)?)?)?$/, '')
  t = t.replace(/^\s+/, '')
  return final ? t.trimEnd() : t
}

/** Streams one answer. Rejects with a LocalError; on 'cancelled' its `text` holds what had arrived. */
export async function chat(
  m: TutorModel,
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; onText?: (u: { text: string }) => void; fetch?: Fetch } = {},
): Promise<{ text: string; truncated: boolean }> {
  const f = opts.fetch ?? fetch.bind(globalThis)
  const base = trimUrl(m.baseUrl)
  const model = m.model.trim()
  const ollama = m.protocol === 'ollama'
  const url = ollama ? `${base}/api/chat` : `${base}/chat/completions`
  const body = ollama
    ? { model, messages, stream: true, options: { num_ctx: m.contextTokens, temperature: 0.4 } }
    : { model, messages, stream: true, temperature: 0.4 }
  let raw = ''
  let shown = ''
  let truncated = false
  let connected = false
  let ended = false
  // No answer yet after a few seconds: check that the host is there at all (a quick model list). If that times out too,
  // give up with 'timeout' instead of letting the browser hang for minutes on an unreachable address.
  const l = linked(opts.signal)
  const probe = setTimeout(() => {
    listModels(m, { fetch: f, signal: l.signal }).catch((e) => {
      if (!connected && (e as LocalError).code === 'timeout') l.fire()
    })
  }, PROBE_AFTER)
  try {
    const res = await request(f, url, { method: 'POST', headers: headers(m, true), body: JSON.stringify(body), signal: l.signal })
    connected = true
    clearTimeout(probe)
    if (!res.body) throw new LocalError('empty', 'No answer came back.')
    for await (const line of readLines(res.body, l.signal)) {
      const ev = ollama ? parseNdjsonLine(line) : parseSseLine(line)
      if (!ev) continue
      if (ev.error) {
        if (WRONG_PATH.test(ev.error)) throw new LocalError('not_found', url)
        throw new LocalError(MISSING.test(ev.error) ? 'model_missing' : NOT_CHAT.test(ev.error) ? 'not_chat' : 'server', ev.error)
      }
      if (ev.text) {
        raw += ev.text
        const v = visibleText(raw)
        if (v !== shown) {
          shown = v
          opts.onText?.({ text: v })
        }
      }
      if (ev.truncated) truncated = true
      if (ev.done || ev.finished) ended = true
      if (ev.done) break
    }
    if (opts.signal?.aborted) throw new LocalError('cancelled', 'Stopped.')
    // The body closed without done / [DONE] / a finish_reason: the server stopped or a proxy cut it mid-answer.
    if (!ended && raw) throw new LocalError('interrupted', 'The answer stopped before it was finished.')
  } catch (err) {
    let e: LocalError
    if (l.timedOut) e = new LocalError('timeout', url)
    else if (opts.signal?.aborted || isAbort(err)) e = new LocalError('cancelled', 'Stopped.')
    else if (err instanceof LocalError) e = err
    else e = new LocalError(connected ? 'interrupted' : 'network', errText(err))
    e.text = shown
    if (e.code === 'model_missing') e.models = await listModels(m, { fetch: f }).then((x) => x.map((y) => y.id), () => undefined)
    throw e
  } finally {
    clearTimeout(probe)
    l.release()
  }
  const text = visibleText(raw, true)
  if (!text && !truncated) throw new LocalError('empty', 'No answer came back.')
  return { text, truncated }
}

// ---------- explaining errors ----------
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/
/** Pages Ollama accepts without OLLAMA_ORIGINS (its defaults cover localhost, 127.0.0.1 and 0.0.0.0, any port). */
const isLocalPage = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin)
const nameOf = (m: TutorModel) => (m.preset === 'custom' ? 'the server' : PRESETS[m.preset].label)

/** How to give Ollama environment variables. The desktop app ignores ones typed in a shell, and `ollama serve`
 *  cannot start while the app is running, so both ways are spelled out. */
function ollamaEnv(vars: Record<string, string>) {
  const kv = Object.entries(vars)
  return (
    `Quit the Ollama app, then run \`${kv.map(([k, v]) => `${k}=${v}`).join(' ')} ollama serve\`; ` +
    `or keep the app and set them for it (macOS: \`${kv.map(([k, v]) => `launchctl setenv ${k} ${v}`).join('; ')}\`; Windows: add them as user environment variables; Linux: \`sudo systemctl edit ollama\`, Environment= lines), then restart Ollama.`
  )
}

/** What went wrong and the exact fix, for this server and the page's origin (location.origin).
 *  `inSettings`: shown in the Settings card itself, so "in Settings" becomes "here". */
export function explain(err: unknown, m: TutorModel, origin: string, inSettings = false): string {
  const e = err instanceof LocalError ? err : new LocalError(isAbort(err) ? 'cancelled' : 'network', errText(err))
  const base = trimUrl(m.baseUrl)
  const model = m.model.trim()
  const name = nameOf(m)
  const Name = name[0].toUpperCase() + name.slice(1)
  const settings = inSettings ? 'here' : 'in Model settings'
  let hostname = ''
  try {
    if (!isHttp(base)) throw 0
    hostname = new URL(base).hostname
  } catch {
    return `"${m.baseUrl}" is not a web address. It should look like ${PRESETS[m.preset].baseUrl || 'http://localhost:8000/v1'}.`
  }
  switch (e.code) {
    case 'cancelled':
      return 'Stopped.'
    case 'network':
      return networkHelp(m, base, hostname, origin)
    case 'timeout':
      return LOOPBACK.test(hostname)
        ? `${Name} at ${base} did not answer. Restart it and try again.`
        : `Nothing answered at ${base}. Check that the computer running ${name} is awake and on the same network, that ${hostname} is its current address, and that its firewall lets this port in.`
    case 'interrupted':
      return `The connection to ${name} dropped in the middle of the answer. Try again.`
    case 'model_missing': {
      const others = e.models?.filter((x) => x !== model) ?? []
      if (others.length) return `${Name} has no model called "${model}". Pick one that exists${inSettings ? ' (Find models lists them)' : ' in Model settings'}: ${others.slice(0, 8).join(', ')}.`
      return m.protocol === 'ollama'
        ? `Ollama has no model called "${model}". Download it with \`ollama pull ${model}\`, or pick another one ${settings}.`
        : `${Name} has no model called "${model}" loaded. Load it in ${name}, or pick another one ${settings}.`
    }
    case 'not_chat':
      return `"${model}" cannot chat (it looks like an embedding model). Pick a chat model ${settings}.`
    case 'not_found':
      return `Nothing answered at ${e.message}. Check the address ${settings}${m.protocol === 'openai' ? ': OpenAI-compatible servers usually end in /v1' : ': Ollama needs no /v1 at the end'}.`
    case 'auth':
      return `${Name} wants an API key (HTTP 401). Add it ${settings}, or check the one there.`
    case 'forbidden':
      return m.protocol === 'ollama'
        ? `Ollama refused this page (HTTP 403). Allow it with OLLAMA_ORIGINS=${origin}. ${ollamaEnv({ OLLAMA_ORIGINS: origin })}`
        : `${Name} refused the request (HTTP 403). Check the API key and its CORS settings.`
    case 'server':
      return `${Name} reported an error: ${e.message}`
    case 'empty':
      return 'No answer came back. Try asking in a different way.'
    default:
      return `${Name} answered with an error${e.status ? ` (HTTP ${e.status})` : ''}: ${e.message}`
  }
}

function networkHelp(m: TutorModel, base: string, hostname: string, origin: string) {
  const loopback = LOOPBACK.test(hostname)
  const lead = `Could not reach ${nameOf(m)} at ${base}: it is not running, or it is blocking this page.`
  if (origin.startsWith('https:') && base.startsWith('http:') && !loopback)
    return `${lead} This page is served over https, so the browser will not call plain http on ${hostname}. Run Debye on your own computer (\`npm run local\`) and open it over http.`
  const elsewhere = !isLocalPage(origin) && loopback ? ' If Debye is open on a phone or another computer, localhost means that device: use the address of the computer running the model.' : ''
  const secure =
    origin.startsWith('https:') && loopback
      ? ' If the browser asked whether this page may reach devices on your local network, allow it. Safari blocks this from https pages: run Debye on your own computer with `npm run local` instead.'
      : ''
  const tail = elsewhere + secure
  switch (m.preset) {
    case 'ollama':
      return [
        lead,
        'Start it (open the Ollama app, or run `ollama serve`).',
        isLocalPage(origin)
          ? 'Pages on http://localhost and 127.0.0.1 are allowed by default.'
          : loopback
            ? `Ollama only accepts pages on localhost by default; allow this one with OLLAMA_ORIGINS=${origin}. ${ollamaEnv({ OLLAMA_ORIGINS: origin })}`
            : '',
        loopback ? '' : `To reach it from another device it needs OLLAMA_HOST=0.0.0.0 and OLLAMA_ORIGINS=${origin}. ${ollamaEnv({ OLLAMA_HOST: '0.0.0.0', OLLAMA_ORIGINS: origin })}`,
      ].filter(Boolean).join(' ') + tail
    case 'lmstudio':
      return `${lead} In LM Studio, start the server (Developer tab) and turn on Enable CORS in its settings${loopback ? '' : ', plus Serve on Local Network'}.${tail}`
    case 'llamacpp':
      return `${lead} Start it with \`llama-server -m model.gguf -c ${m.contextTokens} --port 8080${loopback ? '' : ' --host 0.0.0.0'}\`; it accepts browser requests by default.${tail}`
    case 'jan':
      return `${lead} In Jan, open Settings, Local API Server: keep CORS on and start the server${loopback ? '' : `, with the host set to 0.0.0.0 and ${hostname} added to Trusted Hosts`}. Jan asks for an API key there: copy it into Model settings.${tail}`
    default:
      return `${lead} Check that it is running, that the address is right, and that it sends CORS headers allowing ${origin}.${tail}`
  }
}

/** Setup steps for each server, as "- " bullets (rendered like a tutor reply, so `code` shows as code). */
export function setupHelp(m: TutorModel, origin: string) {
  const local = isLocalPage(origin)
  const phoneOrigin = local ? 'http://<computer-ip>:4173' : origin
  switch (m.preset) {
    case 'ollama':
      return [
        '- Install Ollama from ollama.com, then download a model: `ollama pull qwen2.5:7b` (about 5 GB; `qwen2.5:3b` suits smaller machines).',
        '- Keep the Ollama app open (or run `ollama serve`), then press Find models.',
        local ? '' : `- This page is not on localhost, so allow it with OLLAMA_ORIGINS=${origin}: quit the Ollama app and run \`OLLAMA_ORIGINS=${origin} ollama serve\`.`,
        `- From a phone on the same Wi-Fi: quit the Ollama app, run \`OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=${phoneOrigin} ollama serve\` on the computer, and use http://<computer-ip>:11434 here.`,
        `- To keep using the app instead, set the same variables for it and restart Ollama (macOS: \`launchctl setenv OLLAMA_HOST 0.0.0.0; launchctl setenv OLLAMA_ORIGINS ${phoneOrigin}\`; Windows: user environment variables; Linux: \`sudo systemctl edit ollama\`, Environment= lines).`,
      ].filter(Boolean)
    case 'lmstudio':
      return [
        '- Download and load a model in LM Studio (Qwen2.5 7B Instruct is a good start).',
        '- In the Developer tab, start the server (port 1234) and turn on Enable CORS in its settings. The address ends in /v1.',
        '- From a phone: also turn on Serve on Local Network and use http://<computer-ip>:1234/v1 here.',
      ]
    case 'llamacpp':
      return [
        `- Start the server with a GGUF model: \`llama-server -m qwen2.5-7b-instruct-q4_k_m.gguf -c ${m.contextTokens} --port 8080\`.`,
        '- It accepts browser requests by default. Add `--host 0.0.0.0` to reach it from a phone, and use http://<computer-ip>:8080/v1 here.',
      ]
    case 'jan':
      return [
        '- Download a model in Jan, then open Settings, Local API Server.',
        '- Set an API key there and copy it below, keep CORS on, and start the server (port 1337).',
        '- From a phone: set the host to 0.0.0.0, add the computer\'s IP to Trusted Hosts, and use http://<computer-ip>:1337/v1 here.',
      ]
    default:
      return [
        '- Any server with OpenAI-style `/models` and `/chat/completions` works (vLLM, LocalAI, Ollama at /v1 and more). Use its address up to and including /v1.',
        `- It must send CORS headers that allow ${origin}.`,
      ]
  }
}
