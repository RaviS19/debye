// Local model clients: stream parsing (NDJSON and SSE), think tags, errors, model lists, prompt budget.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chat, explain, fitHistory, LIST_TIMEOUT, listModels, LocalError, parseSseLine, PROBE_AFTER, promptBudget, readLines, visibleText } from './local'
import { renderTutor } from './render'
import { fresh, type TutorModel } from '../store/store'

const enc = new TextEncoder()
const OLLAMA: TutorModel = { ...fresh().tutorModel, provider: 'local', model: 'qwen2.5:7b' }
const LMSTUDIO: TutorModel = { ...OLLAMA, preset: 'lmstudio', protocol: 'openai', baseUrl: 'http://localhost:1234/v1/', model: 'qwen2.5-7b-instruct' }

/** The bytes of `text`, cut every `n` bytes, so lines and multibyte characters land across chunks. */
function chunked(text: string, n: number) {
  const bytes = enc.encode(text)
  const out: Uint8Array[] = []
  for (let i = 0; i < bytes.length; i += n) out.push(bytes.slice(i, i + n))
  return out
}
function stream(chunks: Uint8Array[], hang = false) {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < chunks.length) return c.enqueue(chunks[i++])
      if (hang) return new Promise(() => {}) // a model still thinking
      c.close()
    },
  })
}
type Call = { url: string; init?: RequestInit }
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const path = Object.keys(routes).find((p) => url.endsWith(p))
    if (!path) return new Response('404 page not found', { status: 404 })
    return routes[path]()
  }) as typeof fetch
  return { f, calls }
}
const ndjson = (objs: object[]) => objs.map((o) => JSON.stringify(o)).join('\n') + '\n'
const sse = (objs: (object | string)[]) => objs.map((o) => `data: ${typeof o === 'string' ? o : JSON.stringify(o)}\r\n\r\n`).join('')
const delta = (content: string, finish: string | null = null) => ({ choices: [{ delta: { content }, finish_reason: finish }] })

describe('line reader', () => {
  it('copes with chunks split mid-line, mid-character and between \\r and \\n', async () => {
    const text = 'α → β\r\nsecond ✓ line\r\n\r\nlast'
    for (const n of [1, 2, 3, 5, 64]) {
      const lines: string[] = []
      for await (const l of readLines(stream(chunked(text, n)))) lines.push(l)
      expect(lines).toEqual(['α → β', 'second ✓ line', '', 'last'])
    }
  })
})

describe('Ollama chat (NDJSON)', () => {
  const body = ndjson([
    { message: { role: 'assistant', content: '', thinking: 'let me think about ωₚ' }, done: false },
    { message: { role: 'assistant', content: 'The plasma ' }, done: false },
    { message: { role: 'assistant', content: 'frequency is $\\omega_{pe}$ — ✓.' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' },
  ])
  it('streams the text, ignores thinking and sends the right request', async () => {
    const { f, calls } = fakeFetch({ '/api/chat': () => new Response(stream(chunked(body, 7))) })
    const seen: string[] = []
    const r = await chat(OLLAMA, [{ role: 'user', content: 'hi' }], { fetch: f, onText: ({ text }) => seen.push(text) })
    expect(r).toEqual({ text: 'The plasma frequency is $\\omega_{pe}$ — ✓.', truncated: false })
    expect(seen.at(-1)).toBe(r.text)
    expect(seen.every((t) => !t.includes('think'))).toBe(true)
    expect(calls[0].url).toBe('http://localhost:11434/api/chat')
    const sent = JSON.parse(calls[0].init!.body as string)
    expect(sent).toMatchObject({ model: 'qwen2.5:7b', stream: true, options: { num_ctx: 8192, temperature: 0.4 } })
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBeUndefined()
  })
  it('flags an answer cut by the length limit', async () => {
    const cut = ndjson([{ message: { content: 'A long' }, done: false }, { message: { content: ' answer' }, done: true, done_reason: 'length' }])
    const { f } = fakeFetch({ '/api/chat': () => new Response(stream(chunked(cut, 4))) })
    expect(await chat(OLLAMA, [], { fetch: f })).toEqual({ text: 'A long answer', truncated: true })
  })
  it('turns an error sent in the stream into a LocalError and keeps the partial text', async () => {
    const bad = ndjson([{ message: { content: 'Partial' }, done: false }, { error: 'llama runner process has terminated' }])
    const { f } = fakeFetch({ '/api/chat': () => new Response(stream(chunked(bad, 9))) })
    const e = (await chat(OLLAMA, [], { fetch: f }).catch((x) => x)) as LocalError
    expect(e).toBeInstanceOf(LocalError)
    expect(e.code).toBe('server')
    expect(e.text).toBe('Partial')
    expect(explain(e, OLLAMA, 'http://localhost:4173')).toContain('llama runner process has terminated')
  })
  it('names the missing model and offers the ones that exist', async () => {
    const { f } = fakeFetch({
      '/api/chat': () => new Response(JSON.stringify({ error: 'model "qwen2.5:7b" not found, try pulling it first' }), { status: 404 }),
      '/api/tags': () => Response.json({ models: [{ name: 'llama3.2:3b' }, { name: 'phi4:latest' }] }),
    })
    const e = (await chat(OLLAMA, [], { fetch: f }).catch((x) => x)) as LocalError
    expect(e.code).toBe('model_missing')
    expect(e.models).toEqual(['llama3.2:3b', 'phi4:latest'])
    expect(explain(e, OLLAMA, 'http://localhost:4173')).toMatch(/no model called "qwen2.5:7b".*llama3.2:3b, phi4:latest/)
  })
})

describe('OpenAI-compatible chat (SSE)', () => {
  it('reads data lines, skips comments and blank lines, stops at [DONE]', async () => {
    const body = ': keep-alive\r\n\r\nevent: message\r\n' + sse([{ choices: [{ delta: { role: 'assistant', reasoning_content: 'hmm' } }] }, delta('Debye '), delta('shielding ✓'), delta('', 'stop'), '[DONE]']) + 'data: {"choices":[{"delta":{"content":"IGNORED"}}]}\n'
    const { f, calls } = fakeFetch({ '/chat/completions': () => new Response(stream(chunked(body, 3))) })
    const r = await chat({ ...LMSTUDIO, apiKey: ' sk-local ' }, [{ role: 'user', content: 'q' }], { fetch: f })
    expect(r).toEqual({ text: 'Debye shielding ✓', truncated: false })
    expect(calls[0].url).toBe('http://localhost:1234/v1/chat/completions')
    expect(JSON.parse(calls[0].init!.body as string)).toMatchObject({ model: 'qwen2.5-7b-instruct', stream: true, temperature: 0.4 })
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer sk-local')
  })
  it("treats finish_reason 'length' as truncated", async () => {
    const { f } = fakeFetch({ '/chat/completions': () => new Response(stream(chunked(sse([delta('Cut'), delta(' short', 'length'), '[DONE]']), 5))) })
    expect(await chat(LMSTUDIO, [], { fetch: f })).toEqual({ text: 'Cut short', truncated: true })
  })
  it('hides <think> blocks, even split across chunks and still open', async () => {
    const parts = ['<thi', 'nk>Let me reason: n = 10^18', ' so…</th', 'ink>\n\nThe answer is ', '$\\lambda_D$.']
    const { f } = fakeFetch({ '/chat/completions': () => new Response(stream(chunked(sse([...parts.map((p) => delta(p)), '[DONE]']), 11))) })
    const seen: string[] = []
    const r = await chat(LMSTUDIO, [], { fetch: f, onText: ({ text }) => seen.push(text) })
    expect(r.text).toBe('The answer is $\\lambda_D$.')
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((t) => !t.includes('<') && !t.includes('reason'))).toBe(true)
  })
  it('reports an error object sent in the stream', async () => {
    const body = sse([delta('Hi'), { error: { message: 'Model unloaded unexpectedly', type: 'server_error' } }])
    const { f } = fakeFetch({ '/chat/completions': () => new Response(stream(chunked(body, 6))) })
    const e = (await chat(LMSTUDIO, [], { fetch: f }).catch((x) => x)) as LocalError
    expect(e.code).toBe('server')
    expect(e.message).toBe('Model unloaded unexpectedly')
    expect(e.text).toBe('Hi')
  })
  it('parses single lines', () => {
    expect(parseSseLine(': comment')).toBeNull()
    expect(parseSseLine('')).toBeNull()
    expect(parseSseLine('id: 7')).toBeNull()
    expect(parseSseLine('data: [DONE]')).toEqual({ done: true })
    expect(parseSseLine('data:{"choices":[{"delta":{"reasoning":"x"}}]}')).toEqual({ text: '', truncated: false })
    expect(parseSseLine('{"error":"bad request"}')).toEqual({ error: 'bad request' })
  })
})

describe('think tags', () => {
  it('shows only the answer', () => {
    expect(visibleText('<think>a</think>b<think>c</think> d', true)).toBe('b d')
    expect(visibleText('<think>still going')).toBe('')
    expect(visibleText('Answer so far <th')).toBe('Answer so far ')
    expect(visibleText('a < b', true)).toBe('a < b')
    expect(visibleText('reasoning without an opening tag</think>\nAnswer')).toBe('Answer') // template opened it
  })
})

describe('stopping and failing', () => {
  it('keeps the partial text when stopped', async () => {
    const ctl = new AbortController()
    const { f } = fakeFetch({ '/api/chat': () => new Response(stream(chunked(ndjson([{ message: { content: 'Half an ans' }, done: false }]), 5), true)) })
    const p = chat(OLLAMA, [], { fetch: f, signal: ctl.signal, onText: ({ text }) => text === 'Half an ans' && ctl.abort() })
    const e = (await p.catch((x) => x)) as LocalError
    expect(e.code).toBe('cancelled')
    expect(e.text).toBe('Half an ans')
  })
  it('stops cleanly when fetch itself rejects with AbortError', async () => {
    const ctl = new AbortController()
    ctl.abort()
    const f = (async () => {
      throw new DOMException('aborted', 'AbortError')
    }) as typeof fetch
    expect(((await chat(OLLAMA, [], { fetch: f, signal: ctl.signal }).catch((x) => x)) as LocalError).code).toBe('cancelled')
  })
  it('explains a server that is not running or blocks the page', async () => {
    const f = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const e = (await chat(OLLAMA, [], { fetch: f }).catch((x) => x)) as LocalError
    expect(e.code).toBe('network')
    const fromLan = explain(e, OLLAMA, 'http://192.168.1.20:4173')
    expect(fromLan).toContain('ollama serve')
    expect(fromLan).toContain('OLLAMA_ORIGINS=http://192.168.1.20:4173')
    expect(explain(e, OLLAMA, 'http://localhost:4173')).not.toContain('OLLAMA_ORIGINS')
    const lan = explain(e, { ...OLLAMA, baseUrl: 'http://192.168.1.5:11434' }, 'http://192.168.1.20:4173')
    expect(lan).toContain('OLLAMA_HOST=0.0.0.0')
    expect(explain(e, LMSTUDIO, 'http://localhost:4173')).toContain('Enable CORS')
  })
  it('maps HTTP errors', async () => {
    const at = (status: number, body = '') => fakeFetch({ '/chat/completions': () => new Response(body, { status }) }).f
    expect(((await chat(LMSTUDIO, [], { fetch: at(401, '{"error":"Unauthorized"}') }).catch((x) => x)) as LocalError).code).toBe('auth')
    const nf = (await chat({ ...LMSTUDIO, baseUrl: 'http://localhost:1234' }, [], { fetch: at(404, 'Cannot POST') }).catch((x) => x)) as LocalError
    expect(nf.code).toBe('not_found')
    expect(explain(nf, LMSTUDIO, 'http://localhost:4173')).toContain('/v1')
    expect(((await chat({ ...LMSTUDIO, baseUrl: 'not a url' }, [], { fetch: at(200) }).catch((x) => x)) as LocalError).code).toBe('bad_url')
  })
})

describe('model lists', () => {
  it('reads Ollama /api/tags with size and quantization', async () => {
    const { f, calls } = fakeFetch({
      '/api/tags': () => Response.json({ models: [{ name: 'qwen2.5:7b', details: { parameter_size: '7.6B', quantization_level: 'Q4_K_M' } }, { name: 'tiny:latest', details: {} }] }),
    })
    expect(await listModels({ ...OLLAMA, baseUrl: 'http://localhost:11434/' }, { fetch: f })).toEqual([{ id: 'qwen2.5:7b', detail: '7.6B · Q4_K_M' }, { id: 'tiny:latest', detail: undefined }])
    expect(calls[0].url).toBe('http://localhost:11434/api/tags')
  })
  it('reads OpenAI-compatible /models', async () => {
    const { f, calls } = fakeFetch({ '/v1/models': () => Response.json({ object: 'list', data: [{ id: 'qwen2.5-7b-instruct' }, { id: 'text-embedding-nomic' }] }) })
    expect((await listModels(LMSTUDIO, { fetch: f })).map((m) => m.id)).toEqual(['qwen2.5-7b-instruct', 'text-embedding-nomic'])
    expect(calls[0].url).toBe('http://localhost:1234/v1/models')
  })
  it('says so when the answer is not a model list', async () => {
    const { f } = fakeFetch({ '/v1/models': () => new Response('<html>hello</html>') })
    expect(((await listModels(LMSTUDIO, { fetch: f }).catch((x) => x)) as LocalError).code).toBe('http')
  })
})

describe('prompt budget', () => {
  it('scales the lesson excerpt with the context window', () => {
    expect(promptBudget(4096).excerpt).toBeGreaterThanOrEqual(1500)
    expect(promptBudget(4096).excerpt).toBeLessThan(promptBudget(8192).excerpt)
    expect(promptBudget(32768).excerpt).toBe(9000)
    expect(promptBudget(8192).total).toBe(Math.round((8192 - 1500) * 2.5))
  })
  it('drops the oldest turns first and starts with the learner', () => {
    const h = [
      { role: 'user', content: 'a'.repeat(400) },
      { role: 'assistant', content: 'b'.repeat(400) },
      { role: 'user', content: 'c'.repeat(100) },
      { role: 'assistant', content: 'd'.repeat(100) },
    ]
    expect(fitHistory('s'.repeat(100), h, 'q', 2000)).toEqual(h)
    expect(fitHistory('s'.repeat(100), h, 'q', 750).map((m) => m.content[0])).toEqual(['c', 'd'])
    expect(fitHistory('s'.repeat(100), h, 'q', 600).map((m) => m.content[0])).toEqual(['c', 'd'])
    expect(fitHistory('s'.repeat(100), h, 'q', 250)).toEqual([]) // only 'd' fits, and it is the tutor's
  })
})

describe('hosts that never answer', () => {
  afterEach(() => void vi.useRealTimers())
  /** A fetch that hangs like a LAN address dropping packets, until it is aborted. */
  const hanging = (calls: string[] = []) =>
    ((url: string, init?: RequestInit) => {
      calls.push(url)
      return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    }) as typeof fetch
  const LAN = { ...OLLAMA, baseUrl: 'http://192.168.1.77:11434' }

  it('gives up on a model list after a few seconds', async () => {
    const e = (await listModels(LAN, { fetch: hanging(), timeout: 20 }).catch((x) => x)) as LocalError
    expect(e.code).toBe('timeout')
    expect(explain(e, LAN, 'http://192.168.1.20:4173')).toContain('awake')
  })
  it('a chat checks the host after a while and gives up when it is not there', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const p = chat(LAN, [], { fetch: hanging(calls) }).then(() => null, (x) => x as LocalError)
    await vi.advanceTimersByTimeAsync(PROBE_AFTER + LIST_TIMEOUT + 10)
    const e = await p
    expect(calls).toEqual(['http://192.168.1.77:11434/api/chat', 'http://192.168.1.77:11434/api/tags'])
    expect(e!.code).toBe('timeout')
  })
  it('a slow model on a host that is there is waited for', async () => {
    vi.useFakeTimers()
    let release!: () => void
    const f = ((url: string) =>
      url.endsWith('/api/tags')
        ? Promise.resolve(Response.json({ models: [] }))
        : new Promise<Response>((r) => (release = () => r(new Response('{"message":{"content":"Late"},"done":true}\n'))))) as typeof fetch
    const p = chat(OLLAMA, [], { fetch: f })
    await vi.advanceTimersByTimeAsync(60_000) // a cold model loading
    release()
    expect(await p).toEqual({ text: 'Late', truncated: false })
  })
  it('Stop still means Stopped while waiting', async () => {
    const ctl = new AbortController()
    const p = chat(LAN, [], { fetch: hanging(), signal: ctl.signal }).then(() => null, (x) => x as LocalError)
    ctl.abort()
    expect((await p)!.code).toBe('cancelled')
  })
})

describe('error text', () => {
  it('names an embedding model that cannot chat', async () => {
    const f = (async () => Response.json({ error: '"nomic-embed-text" does not support chat' }, { status: 400 })) as unknown as typeof fetch
    const e = (await chat({ ...OLLAMA, model: 'nomic-embed-text' }, [], { fetch: f }).catch((x) => x)) as LocalError
    expect(e.code).toBe('not_chat')
    expect(explain(e, OLLAMA, 'http://localhost:4173')).toContain('chat model')
  })
  it('says "here" inside the Settings card and points to Model settings elsewhere', () => {
    const e = new LocalError('auth', 'Unauthorized', 401)
    expect(explain(e, LMSTUDIO, 'http://localhost:4173', true)).toContain('Add it here')
    expect(explain(e, LMSTUDIO, 'http://localhost:4173')).toContain('in Model settings')
  })
  it('tells the desktop Ollama app how to take OLLAMA_ORIGINS', () => {
    const t = explain(new LocalError('forbidden', '', 403), OLLAMA, 'http://192.168.1.20:4173')
    expect(t).toContain('Quit the Ollama app')
    expect(t).toContain('launchctl setenv OLLAMA_ORIGINS http://192.168.1.20:4173')
  })
  it('only localhost, 127.0.0.1 and 0.0.0.0 pages count as allowed by default', () => {
    const e = new LocalError('network', 'Failed to fetch')
    expect(explain(e, OLLAMA, 'http://[::1]:4173')).toContain('OLLAMA_ORIGINS=http://[::1]:4173')
    expect(explain(e, OLLAMA, 'https://debye.example')).toContain('local network')
  })
  it('renders notes without maths, so server text cannot reach KaTeX', () => {
    const html = renderTutor('Server said: $\\htmlClass{tutor-panel}{x}$ and `code`', { maths: false })
    expect(html).not.toContain('katex')
    expect(html).toContain('$\\htmlClass{tutor-panel}{x}$')
    expect(html).toContain('<code>code</code>')
  })
})
