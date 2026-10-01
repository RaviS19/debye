// Protocol checks for the local-model clients: real-looking Ollama NDJSON and OpenAI-style SSE streams
// (LM Studio, llama.cpp server, Jan, vLLM), cut at every possible byte boundary, plus base-URL edge cases.
// The one case marked `it.fails` documents a known limit: it passes while the limit is there, and starts failing once it is fixed.
import { describe, expect, it } from 'vitest'
import { chat, explain, fitHistory, listModels, LocalError, parseNdjsonLine, parseSseLine, readLines, tidyUrl, visibleText } from './local'
import { fresh, type TutorModel } from '../store/store'

const enc = new TextEncoder()
const OLLAMA: TutorModel = { ...fresh().tutorModel, provider: 'local', model: 'qwen2.5:7b' }
const LMSTUDIO: TutorModel = { ...OLLAMA, preset: 'lmstudio', protocol: 'openai', baseUrl: 'http://localhost:1234/v1', model: 'qwen2.5-7b-instruct' }
const LLAMACPP: TutorModel = { ...LMSTUDIO, preset: 'llamacpp', baseUrl: 'http://localhost:8080/v1', model: 'model.gguf' }

/** A byte stream that hands out exactly these chunks. */
function stream(chunks: Uint8Array[]) {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < chunks.length) c.enqueue(chunks[i++])
      else c.close()
    },
  })
}
/** `bytes` cut at the given offsets. */
const cut = (bytes: Uint8Array, at: number[]) => [0, ...at, bytes.length].slice(1).map((end, k, a) => bytes.slice(k ? a[k - 1] : 0, end))
const at = (bytes: Uint8Array, at0: number[]) => cut(bytes, [...at0].sort((a, b) => a - b))

type Call = { url: string; init?: RequestInit }
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const path = Object.keys(routes).find((p) => url.endsWith(p))
    if (!path) return new Response('404 page not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
    return routes[path]()
  }) as typeof fetch
  return { f, calls }
}
const fail = (p: Promise<unknown>) => p.then(() => null, (e) => e as LocalError)

// ---------- sample streams, shaped like what the servers really send ----------

/** Ollama /api/chat, stream: true. Thinking in its own field, a multibyte answer, final stats object. */
const OLLAMA_STREAM =
  [
    { model: 'qwen3:8b', created_at: '2026-10-01T10:00:00Z', message: { role: 'assistant', content: '', thinking: 'Debye length λ_D…' }, done: false },
    { model: 'qwen3:8b', created_at: '2026-10-01T10:00:00Z', message: { role: 'assistant', content: 'λ_D = √(ε₀kT/ne²)' }, done: false },
    { model: 'qwen3:8b', created_at: '2026-10-01T10:00:00Z', message: { role: 'assistant', content: ' — ✓ 🙂' }, done: false },
    {
      model: 'qwen3:8b',
      created_at: '2026-10-01T10:00:01Z',
      message: { role: 'assistant', content: '' },
      done_reason: 'stop',
      done: true,
      total_duration: 123,
      load_duration: 1,
      prompt_eval_count: 40,
      eval_count: 12,
      eval_duration: 99,
    },
  ]
    .map((o) => JSON.stringify(o))
    .join('\n') + '\n'

/** OpenAI-style SSE as LM Studio / llama.cpp / vLLM send it: CRLF, a comment, an event: line, a role-only first chunk,
 *  null content, reasoning_content, a finish chunk, a usage-only chunk with empty choices, then [DONE]. */
const SSE_STREAM = [
  ': ping',
  '',
  'event: message',
  'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":null},"finish_reason":null}]}',
  '',
  'data: {"id":"c1","choices":[{"index":0,"delta":{"reasoning_content":"think about λ"},"finish_reason":null}]}',
  '',
  'data: {"id":"c1","choices":[{"index":0,"delta":{"content":"λ_D = √(ε₀kT/ne²)"},"finish_reason":null}]}',
  '',
  'data:{"id":"c1","choices":[{"index":0,"delta":{"content":" — ✓ 🙂"},"finish_reason":null}]}',
  '',
  'data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  '',
  'data: {"id":"c1","choices":[],"usage":{"prompt_tokens":40,"completion_tokens":12,"total_tokens":52}}',
  '',
  'data: [DONE]',
  '',
  '',
].join('\r\n')

const ANSWER = 'λ_D = √(ε₀kT/ne²) — ✓ 🙂'

// ---------- every chunk boundary ----------

describe('every chunk boundary', () => {
  it('Ollama NDJSON gives the same answer wherever the bytes are cut once', async () => {
    const bytes = enc.encode(OLLAMA_STREAM)
    for (let i = 1; i < bytes.length; i++) {
      const { f } = fakeFetch({ '/api/chat': () => new Response(stream(at(bytes, [i]))) })
      const seen: string[] = []
      const r = await chat(OLLAMA, [{ role: 'user', content: 'q' }], { fetch: f, onText: ({ text }) => seen.push(text) })
      expect(r, `cut at ${i}`).toEqual({ text: ANSWER, truncated: false })
      expect(seen.every((t) => ANSWER.startsWith(t)), `cut at ${i}`).toBe(true)
      expect(seen.join('')).not.toContain('�')
    }
  })

  it('OpenAI SSE gives the same answer wherever the bytes are cut once', async () => {
    const bytes = enc.encode(SSE_STREAM)
    for (let i = 1; i < bytes.length; i++) {
      const { f } = fakeFetch({ '/chat/completions': () => new Response(stream(at(bytes, [i]))) })
      const seen: string[] = []
      const r = await chat(LMSTUDIO, [{ role: 'user', content: 'q' }], { fetch: f, onText: ({ text }) => seen.push(text) })
      expect(r, `cut at ${i}`).toEqual({ text: ANSWER, truncated: false })
      expect(seen.every((t) => ANSWER.startsWith(t) && !t.includes('think')), `cut at ${i}`).toBe(true)
    }
  })

  it('both formats survive one byte at a time', async () => {
    const one = (s: string) => Array.from(enc.encode(s), (b) => Uint8Array.of(b))
    const o = fakeFetch({ '/api/chat': () => new Response(stream(one(OLLAMA_STREAM))) })
    expect((await chat(OLLAMA, [], { fetch: o.f })).text).toBe(ANSWER)
    const s = fakeFetch({ '/chat/completions': () => new Response(stream(one(SSE_STREAM))) })
    expect((await chat(LMSTUDIO, [], { fetch: s.f })).text).toBe(ANSWER)
  })

  it('the line reader gives the same lines for every pair of cuts (CRLF, multibyte, 4-byte emoji)', async () => {
    const text = 'a→\r\n\r\n: c\r\ndata: 🙂ü\r\nend'
    const want = ['a→', '', ': c', 'data: 🙂ü', 'end']
    const bytes = enc.encode(text)
    for (let i = 1; i < bytes.length; i++)
      for (let j = i; j < bytes.length; j++) {
        const lines: string[] = []
        for await (const l of readLines(stream(at(bytes, [i, j])))) lines.push(l)
        expect(lines, `cuts ${i},${j}`).toEqual(want)
      }
  })

  it('a <think> block streamed in content stays hidden for every single cut', async () => {
    const parts = ['<think>', 'n_e = 10^18 so', '</think>', '\n\nIt is ', '7.4 μm.']
    const body = parts.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`).join('') + 'data: [DONE]\n\n'
    const bytes = enc.encode(body)
    for (let i = 1; i < bytes.length; i += 3) {
      const { f } = fakeFetch({ '/chat/completions': () => new Response(stream(at(bytes, [i]))) })
      const seen: string[] = []
      const r = await chat(LMSTUDIO, [], { fetch: f, onText: ({ text }) => seen.push(text) })
      expect(r.text).toBe('It is 7.4 μm.')
      expect(seen.every((t) => !t.includes('<') && !t.includes('10^18'))).toBe(true)
    }
  })
})

// ---------- Ollama specifics ----------

describe('Ollama /api/chat', () => {
  it('sends the native request body to /api/chat, with no auth header unless a key is set', async () => {
    const { f, calls } = fakeFetch({ '/api/chat': () => new Response(OLLAMA_STREAM) })
    await chat({ ...OLLAMA, baseUrl: 'http://localhost:11434///' }, [{ role: 'system', content: 's' }, { role: 'user', content: 'q' }], { fetch: f })
    expect(calls[0].url).toBe('http://localhost:11434/api/chat')
    expect(calls[0].init!.method).toBe('POST')
    const body = JSON.parse(calls[0].init!.body as string)
    expect(body).toEqual({ model: 'qwen2.5:7b', messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'q' }], stream: true, options: { num_ctx: 8192, temperature: 0.4 } })
    expect(calls[0].init!.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it("flags done_reason 'length' only on the final object", () => {
    expect(parseNdjsonLine('{"message":{"content":"x"},"done":false,"done_reason":"length"}')).toEqual({ text: 'x', done: false, truncated: false })
    expect(parseNdjsonLine('{"message":{"content":""},"done":true,"done_reason":"length","eval_count":5}')).toEqual({ text: '', done: true, truncated: true })
    expect(parseNdjsonLine('{"error":"model runner has unexpectedly stopped"}')).toEqual({ error: 'model runner has unexpectedly stopped' })
    expect(parseNdjsonLine('  \r')).toBeNull()
  })

  it('maps the real 404 body for a model that is not pulled, and offers the installed ones', async () => {
    const { f } = fakeFetch({
      '/api/chat': () => Response.json({ error: 'model "qwen2.5:7b" not found, try pulling it first' }, { status: 404 }),
      '/api/tags': () => Response.json({ models: [{ name: 'llama3.2:3b' }, { name: 'qwen3:8b' }] }),
    })
    const e = await fail(chat(OLLAMA, [], { fetch: f }))
    expect(e!.code).toBe('model_missing')
    expect(e!.models).toEqual(['llama3.2:3b', 'qwen3:8b'])
    expect(explain(e, OLLAMA, 'http://localhost:4173')).toContain('llama3.2:3b')
  })

  it('reports an error object sent mid-stream after some text (HTTP 200)', async () => {
    const body = '{"message":{"content":"Part"},"done":false}\n{"error":"an error was encountered while running the model: unexpected EOF"}\n'
    const { f } = fakeFetch({ '/api/chat': () => new Response(body) })
    const e = await fail(chat(OLLAMA, [], { fetch: f }))
    expect(e!.code).toBe('server')
    expect(e!.text).toBe('Part')
  })

  it('maps a 500 with a JSON error body', async () => {
    const { f } = fakeFetch({ '/api/chat': () => Response.json({ error: 'llama runner process has terminated: exit status 2' }, { status: 500 }) })
    const e = await fail(chat(OLLAMA, [], { fetch: f }))
    expect(e!.code).toBe('http')
    expect(explain(e, OLLAMA, 'http://localhost:4173')).toContain('HTTP 500')
  })

  it('a pasted /v1 on the Ollama preset gets the "no /v1" hint', async () => {
    const { f } = fakeFetch({}) // Ollama answers 404 page not found for /v1/api/...
    const e = await fail(listModels({ ...OLLAMA, baseUrl: 'http://localhost:11434/v1/' }, { fetch: f }))
    expect(e!.code).toBe('not_found')
    expect(explain(e, OLLAMA, 'http://localhost:4173')).toContain('no /v1')
  })

  it('a model that is installed but cannot load (HTTP 500) is not called missing', async () => {
    const { f } = fakeFetch({
      '/api/chat': () => Response.json({ error: "error loading model: unknown model architecture: 'qwen3'" }, { status: 500 }),
      '/api/tags': () => Response.json({ models: [{ name: 'qwen2.5:7b' }] }),
    })
    const e = await fail(chat(OLLAMA, [], { fetch: f }))
    expect(e!.code).toBe('http')
  })
})

// ---------- OpenAI-compatible specifics ----------

describe('OpenAI-compatible /chat/completions', () => {
  it('ignores role-only, null-content, reasoning and usage-only chunks', () => {
    expect(parseSseLine('data: {"choices":[{"delta":{"role":"assistant","content":null}}]}')).toEqual({ text: '', truncated: false })
    expect(parseSseLine('data: {"choices":[{"delta":{"reasoning_content":"x","content":null}}]}')).toEqual({ text: '', truncated: false })
    expect(parseSseLine('data: {"choices":[],"usage":{"total_tokens":3}}')).toEqual({ text: '', truncated: false })
    expect(parseSseLine('event: message')).toBeNull()
    expect(parseSseLine('retry: 3000')).toBeNull()
    expect(parseSseLine('data:[DONE]')).toEqual({ done: true })
    expect(parseSseLine('data: [DONE]\r')).toEqual({ done: true })
  })

  it("keeps truncated when finish_reason 'length' is followed by a usage chunk and [DONE]", async () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"Cut"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
      'data: {"choices":[],"usage":{"completion_tokens":1}}',
      'data: [DONE]',
    ].join('\n\n') + '\n\n'
    const { f } = fakeFetch({ '/chat/completions': () => new Response(body) })
    expect(await chat(LLAMACPP, [], { fetch: f })).toEqual({ text: 'Cut', truncated: true })
  })

  it('a length cut-off with nothing visible yet (still thinking) is truncated, not an error', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"<think>long"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'
    const { f } = fakeFetch({ '/chat/completions': () => new Response(body) })
    expect(await chat(LLAMACPP, [], { fetch: f })).toEqual({ text: '', truncated: true })
  })

  it('stops reading at [DONE] and closes the stream', async () => {
    let cancelled = false
    const chunks = [enc.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n')]
    let i = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (i < chunks.length) c.enqueue(chunks[i++])
        return new Promise(() => {}) // the server keeps the connection open
      },
      cancel() {
        cancelled = true
      },
    })
    const { f } = fakeFetch({ '/chat/completions': () => new Response(body) })
    expect((await chat(LMSTUDIO, [], { fetch: f })).text).toBe('ok')
    expect(cancelled).toBe(true)
  })

  it('maps vLLM\'s 404 "model does not exist" body', async () => {
    const { f } = fakeFetch({
      '/chat/completions': () => Response.json({ object: 'error', message: 'The model `x` does not exist.', type: 'NotFoundError', code: 404 }, { status: 404 }),
      '/models': () => Response.json({ data: [{ id: 'Qwen/Qwen2.5-7B-Instruct' }] }),
    })
    // vLLM puts the text in a top-level "message", not in "error", so httpError only sees the raw body; still classified.
    const e = await fail(chat({ ...LMSTUDIO, preset: 'custom', model: 'x' }, [], { fetch: f }))
    expect(e!.code).toBe('model_missing')
    expect(e!.models).toEqual(['Qwen/Qwen2.5-7B-Instruct'])
  })

  it('sends an Authorization header only for a non-blank key', async () => {
    const { f, calls } = fakeFetch({ '/models': () => Response.json({ data: [] }) })
    await listModels({ ...LMSTUDIO, apiKey: '   ' }, { fetch: f })
    expect(calls[0].init!.headers).toEqual({})
  })

  // llama.cpp server builds that use server_sent_event(sink, "error", ...) send a streaming error as an `error: {...}`
  // SSE line; the learner must see the server's message (e.g. the prompt exceeding the context size).
  it('an `error:` SSE field (llama.cpp) is surfaced as a server error', async () => {
    const body = 'error: {"code":400,"message":"the request exceeds the available context size, try increasing it","type":"exceed_context_size_error"}\n\n'
    const { f } = fakeFetch({ '/chat/completions': () => new Response(body) })
    const e = await fail(chat(LLAMACPP, [], { fetch: f }))
    expect(e!.code).toBe('server')
    expect(e!.message).toContain('context size')
  })

  // LM Studio answers unknown paths with HTTP 200 and {"error":"Unexpected endpoint or method. (GET /models)"}.
  // With /v1 left off the address that must not read as "running but has no models yet".
  it('listModels surfaces an {"error"} body sent with HTTP 200 (LM Studio without /v1)', async () => {
    const { f } = fakeFetch({ '/models': () => Response.json({ error: 'Unexpected endpoint or method. (GET /models)' }) })
    const m = { ...LMSTUDIO, baseUrl: 'http://localhost:1234' }
    const r = await fail(listModels(m, { fetch: f }))
    expect(r).toBeInstanceOf(LocalError)
    expect(r!.code).toBe('not_found')
    expect(explain(r, m, 'http://localhost:4173')).toContain('/v1')
  })
  it('chat on LM Studio without /v1 says to add it', async () => {
    const { f } = fakeFetch({ '/chat/completions': () => Response.json({ error: 'Unexpected endpoint or method. (POST /chat/completions)' }) })
    const m = { ...LMSTUDIO, baseUrl: 'http://localhost:1234' }
    const e = await fail(chat(m, [], { fetch: f }))
    expect(e!.code).toBe('not_found')
    expect(explain(e, m, 'http://localhost:4173')).toContain('/v1')
  })
})

// ---------- endings that are not a clean finish ----------

describe('streams that end early', () => {
  // A stream that closes without `done: true` / `[DONE]` / a finish_reason (server killed, proxy timeout, laptop
  // asleep) is not a complete answer: it is reported as interrupted, with the partial text kept.
  it('an Ollama stream closed before done:true is reported as interrupted', async () => {
    const { f } = fakeFetch({ '/api/chat': () => new Response('{"message":{"content":"The Debye len"},"done":false}\n') })
    const e = await fail(chat(OLLAMA, [], { fetch: f }))
    expect(e?.code).toBe('interrupted')
    expect(e?.text).toBe('The Debye len')
  })
  it('an SSE stream closed before [DONE] is reported as interrupted', async () => {
    const { f } = fakeFetch({ '/chat/completions': () => new Response('data: {"choices":[{"delta":{"content":"The Debye len"}}]}\n\n') })
    const e = await fail(chat(LMSTUDIO, [], { fetch: f }))
    expect(e?.code).toBe('interrupted')
  })
  it('an SSE stream with a finish_reason but no [DONE] is complete', async () => {
    const { f } = fakeFetch({ '/chat/completions': () => new Response('data: {"choices":[{"delta":{"content":"Done."},"finish_reason":"stop"}]}\n\n') })
    expect(await chat(LMSTUDIO, [], { fetch: f })).toEqual({ text: 'Done.', truncated: false })
  })

  it('a body that errors mid-read is interrupted and keeps the partial text', async () => {
    let n = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (n++ === 0) c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Half"}}]}\n\n'))
        else c.error(new TypeError('network error'))
      },
    })
    const { f } = fakeFetch({ '/chat/completions': () => new Response(body) })
    const e = await fail(chat(LMSTUDIO, [], { fetch: f }))
    expect(e!.code).toBe('interrupted')
    expect(e!.text).toBe('Half')
  })

  it('abort while the reader waits keeps the partial text and cancels the body', async () => {
    const ctl = new AbortController()
    let cancelled = false
    let n = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (n++ === 0) return c.enqueue(enc.encode('{"message":{"content":"Half"},"done":false}\n{"message":{"content":" an'))
        return new Promise(() => {})
      },
      cancel() {
        cancelled = true
      },
    })
    const { f } = fakeFetch({ '/api/chat': () => new Response(body) })
    const e = await fail(chat(OLLAMA, [], { fetch: f, signal: ctl.signal, onText: () => queueMicrotask(() => ctl.abort()) }))
    expect(e!.code).toBe('cancelled')
    expect(e!.text).toBe('Half')
    expect(cancelled).toBe(true)
  })
})

// ---------- base URLs and model names ----------

describe('addresses and names', () => {
  // "localhost:11434" (no scheme) parses as a URL with scheme "localhost:"; it must still count as a bad address,
  // not as a remote host (whose help would say OLLAMA_HOST=0.0.0.0).
  it('an address without http:// is reported as a bad address', async () => {
    const f = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const m = { ...OLLAMA, baseUrl: 'localhost:11434' }
    const e = await fail(chat(m, [], { fetch: f }))
    expect(e!.code).toBe('bad_url')
  })
  it('explains the scheme-less address as one, and the address field adds http://', async () => {
    const f = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const m = { ...OLLAMA, baseUrl: 'localhost:11434' }
    const e = await fail(chat(m, [], { fetch: f }))
    const text = explain(e, m, 'http://localhost:4173')
    expect(text).toContain('http://localhost:11434')
    expect(text).not.toContain('OLLAMA_HOST=0.0.0.0')
    expect(tidyUrl(' localhost:11434/ ')).toBe('http://localhost:11434')
    expect(tidyUrl('https://box.lan/v1')).toBe('https://box.lan/v1')
  })

  // Settings' Test trims the model name (cfg()), and the tutor panel passes getState().tutorModel as saved, so chat()
  // trims it too: "qwen2.5:7b " must not pass Test and then fail in the panel.
  it('chat() trims the model name', async () => {
    const { f, calls } = fakeFetch({ '/api/chat': () => new Response(OLLAMA_STREAM) })
    await chat({ ...OLLAMA, model: 'qwen2.5:7b ' }, [], { fetch: f })
    expect(JSON.parse(calls[0].init!.body as string).model).toBe('qwen2.5:7b')
  })
})

// ---------- what the model is sent ----------

describe('conversation shape', () => {
  // A failed or stopped-before-text answer leaves a question with no answer. Jinja chat templates used by LM Studio and
  // llama.cpp --jinja for Mistral and Gemma 2 raise "Conversation roles must alternate user/assistant/..." on two user
  // turns in a row, so that question is left out of what the model is sent.
  it('fitHistory never yields two user turns in a row', () => {
    const history = [
      { role: 'user', content: 'What is the Debye length?' }, // its answer failed: "Could not reach…", content ''
      { role: 'user', content: 'What is the Debye length?' },
      { role: 'assistant', content: 'It is…' },
    ]
    const out = fitHistory('system', history, 'next', 10_000)
    const roles = [...out.map((m) => m.role), 'user']
    expect(roles.some((r, i) => i > 0 && r === roles[i - 1])).toBe(false)
    // as the panel keeps it: the failed answer saved empty, and a trailing question whose answer failed too
    const kept = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'q3' },
    ]
    expect(fitHistory('system', kept, 'q4', 10_000).map((m) => m.content)).toEqual(['q2', 'a2'])
  })
})

describe('reasoning models', () => {
  // KNOWN LIMIT (still it.fails): when the chat template opens <think> in the prompt (QwQ, Qwen3-Thinking-2507, DeepSeek-R1 distills on
  // servers that do not split reasoning out), the model only emits "</think>". Until that tag arrives, visibleText
  // shows the reasoning, which then vanishes: the learner sees the scratch work flash past instead of "Thinking…".
  it.fails('KNOWN LIMIT: reasoning before a lone </think> is not shown while streaming', async () => {
    const parts = ['Okay, the user asks', ' about n_e.', '</think>', '\n\nAnswer.']
    const body = parts.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`).join('') + 'data: [DONE]\n\n'
    const { f } = fakeFetch({ '/chat/completions': () => new Response(body) })
    const seen: string[] = []
    const r = await chat(LMSTUDIO, [], { fetch: f, onText: ({ text }) => seen.push(text) })
    expect(r.text).toBe('Answer.')
    expect(seen.filter((t) => t.includes('user asks'))).toEqual([])
  })
  it('the final text of a lone </think> reply is right', () => {
    expect(visibleText('Okay, the user asks…</think>\n\nAnswer.', true)).toBe('Answer.')
  })
})
