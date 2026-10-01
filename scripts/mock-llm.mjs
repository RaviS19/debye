// A fake local model server for trying the tutor's local-model path without a GPU. Serves both protocols on one port:
//   Ollama:            GET /api/tags, POST /api/chat (NDJSON stream)
//   OpenAI-compatible: GET /v1/models, POST /v1/chat/completions (SSE stream)
// The canned answer (markdown + maths) is written in deliberately awkward byte chunks, split mid-line and
// mid-character, to exercise the client's stream parsing.
// Usage: node scripts/mock-llm.mjs <port> [--think] [--slow] [--missing] [--no-cors] [--cut]
//   --think    a reasoning model: the answer starts with a <think>…</think> block
//   --slow     a cold model: 3 s before the first byte, then slow tokens
//   --missing  every chat request fails with "model not found" (404)
//   --no-cors  no CORS headers, like Ollama without OLLAMA_ORIGINS or LM Studio with CORS off
//   --cut      the answer stops early with finish_reason / done_reason 'length'
// Models it knows: qwen2.5:7b, llama3.2:3b (Ollama) and qwen2.5-7b-instruct (OpenAI). Any other name gets a 404.
import { createServer } from 'node:http'

const args = process.argv.slice(2)
const port = +(args.find((a) => /^\d+$/.test(a)) ?? 11500)
const flag = (f) => args.includes(f)
const THINK = flag('--think')
const SLOW = flag('--slow')
const MISSING = flag('--missing')
const CORS = !flag('--no-cors')
const CUT = flag('--cut')

const OLLAMA_MODELS = [
  { name: 'qwen2.5:7b', model: 'qwen2.5:7b', size: 4683087332, details: { family: 'qwen2', parameter_size: '7.6B', quantization_level: 'Q4_K_M' } },
  { name: 'llama3.2:3b', model: 'llama3.2:3b', size: 2019393189, details: { family: 'llama', parameter_size: '3.2B', quantization_level: 'Q4_K_M' } },
]
const OPENAI_MODELS = ['qwen2.5-7b-instruct', 'text-embedding-nomic-embed-text-v1.5']

const ANSWER = [
  'Good question. The **restoring force** comes from charge separation: shift the electrons by $\\delta$ and the ions, too heavy to follow, leave a field behind.',
  '',
  '- Gauss gives $E = n e \\delta/\\varepsilon_0$, pointing back towards equilibrium.',
  '- Newton for one electron: $m_e \\ddot\\delta = -eE$.',
  '',
  '$$\\ddot\\delta = -\\omega_{pe}^2\\,\\delta, \\qquad \\omega_{pe} = \\sqrt{\\frac{n e^2}{\\varepsilon_0 m_e}}$$',
  '',
  'So the electrons ring at $\\omega_{pe}$ — about $2\\pi \\times 9\\,\\text{kHz}\\times\\sqrt{n\\,[\\text{m}^{-3}]}$ ✓. What happens to $\\omega_{pe}$ if you quadruple $n$?',
].join('\n')
const THOUGHT = '<think>\nThe learner asks about plasma oscillations. Recall ω² = ne²/(ε₀mₑ); keep it Socratic, end with a question.\n</think>\n\n'

const tokens = (s) => s.match(/\s*\S+\s*/g) ?? []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SIZES = [37, 53, 71, 1, 29, 91, 2, 61] // odd byte slices, one per tick, so they land mid-line and mid-character

function cors(req, res) {
  if (!CORS) return
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
async function readBody(req) {
  let s = ''
  for await (const c of req) s += c
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

/** Writes the events as one byte stream, re-sliced at awkward sizes. Stops if the client goes away. */
async function stream(req, res, events) {
  let gone = false
  res.on('close', () => (gone = true))
  if (SLOW) await sleep(3000)
  const bytes = Buffer.from(events.join(''))
  for (let i = 0, k = 0; i < bytes.length && !gone; k++) {
    const n = SLOW ? 1 + (SIZES[k % SIZES.length] % 23) : SIZES[k % SIZES.length]
    res.write(bytes.subarray(i, i + n))
    i += n
    await sleep(SLOW ? 50 : 20)
  }
  res.end()
}

function answerParts() {
  let parts = tokens(ANSWER)
  if (CUT) parts = parts.slice(0, Math.floor(parts.length / 2))
  return [...(THINK ? tokens(THOUGHT) : []), ...parts]
}

createServer(async (req, res) => {
  cors(req, res)
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') {
    res.writeHead(CORS ? 204 : 403)
    return res.end()
  }
  if (req.method === 'GET' && url.pathname === '/api/tags') return json(res, 200, { models: OLLAMA_MODELS })
  if (req.method === 'GET' && url.pathname === '/v1/models') return json(res, 200, { object: 'list', data: OPENAI_MODELS.map((id) => ({ id, object: 'model', owned_by: 'organization_owner' })) })

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    const body = await readBody(req)
    const sys = body.messages?.find((m) => m.role === 'system')?.content ?? ''
    console.error(`[ollama] model=${body.model} msgs=${body.messages?.length} system=${sys.length} chars num_ctx=${body.options?.num_ctx}`)
    if (MISSING || !OLLAMA_MODELS.some((m) => m.name === body.model)) return json(res, 404, { error: `model "${body.model}" not found, try pulling it first` })
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
    const at = new Date().toISOString()
    const events = answerParts().map((t) => JSON.stringify({ model: body.model, created_at: at, message: { role: 'assistant', content: t }, done: false }) + '\n')
    events.push(JSON.stringify({ model: body.model, created_at: at, message: { role: 'assistant', content: '' }, done: true, done_reason: CUT ? 'length' : 'stop', total_duration: 1e9, eval_count: events.length }) + '\n')
    return stream(req, res, events)
  }

  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    const body = await readBody(req)
    const sys = body.messages?.find((m) => m.role === 'system')?.content ?? ''
    console.error(`[openai] model=${body.model} msgs=${body.messages?.length} system=${sys.length} chars auth=${req.headers.authorization ? 'yes' : 'no'}`)
    if (MISSING || !OPENAI_MODELS.includes(body.model)) return json(res, 404, { error: { message: `Model "${body.model}" not found. Load it first.`, type: 'invalid_request_error', code: 'model_not_found' } })
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id: 'chatcmpl-mock', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
    const events = [': mock-llm\n\n', chunk({ role: 'assistant', content: '' }), ...answerParts().map((t) => chunk({ content: t })), chunk({}, CUT ? 'length' : 'stop'), 'data: [DONE]\n\n']
    return stream(req, res, events)
  }
  json(res, 404, { error: 'not found' })
}).listen(port, () => console.error(`mock-llm on http://localhost:${port} (Ollama /api, OpenAI /v1)${THINK ? ' think' : ''}${SLOW ? ' slow' : ''}${MISSING ? ' missing' : ''}${CORS ? '' : ' no-cors'}${CUT ? ' cut' : ''}`))
