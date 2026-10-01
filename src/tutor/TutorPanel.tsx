import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { closeTutor, currentProvider, disableTutor, getSample, HIDE_CODES, openTutor, setProvider, useTutor, useTutorAvail, useTutorPanel, type TutorContext } from './state'
import { instructions, quickAsks } from './prompt'
import { renderTutor } from './render'
import { chat, explain, fitHistory, hostOf, LocalError, promptBudget, type ChatMessage } from './local'
import { getState, logTutorQuestion } from '../store/store'
import { lessonById } from '../lessons'

type Msg = { role: 'user' | 'assistant'; content: string; note?: string }
const chats = new Map<string, { ctx: TutorContext; msgs: Msg[] }>()
const keyFor = (ctx: TutorContext) => `${ctx.lessonId ?? 'general'}${ctx.problem ? ':' + ctx.problem.id : ''}`

const ERR: Record<string, string> = {
  rate_limited: 'Too many questions at once, or your Claude usage limit is reached. Try again in a little while.',
  session_expired: 'Sign in to claude.ai again to keep using the tutor.',
  refused: 'The tutor could not answer that. Try asking it another way.',
  empty_completion: 'No answer came back. Try asking in a different way.',
  prompt_too_large: 'The conversation got too long. Start a new chat.',
}

export function TutorFab() {
  const avail = useTutorAvail()
  const { open } = useTutorPanel()
  const loc = useLocation()
  if (avail !== 'ready' || open) return null
  const m = loc.pathname.match(/^\/learn\/(\w+)/)
  return (
    <button className="tutor-fab" onClick={() => openTutor({ lessonId: m && lessonById(m[1]) ? m[1] : null })} aria-label="Ask the tutor">
      <span aria-hidden="true">✦</span> Ask
    </button>
  )
}

export function TutorPanel() {
  const avail = useTutorAvail()
  const tutor = useTutor()
  const { open, ctx, nonce } = useTutorPanel()
  const key = keyFor(ctx)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const current = useRef<{ key: string; ctx: TutorContext }>({ key, ctx })

  // Switch conversation when the panel is opened somewhere else.
  useEffect(() => {
    if (!open) return
    const chat = chats.get(key) ?? { ctx, msgs: [] }
    chat.ctx = ctx
    chats.set(key, chat)
    current.current = { key, ctx }
    setMsgs(chat.msgs)
    setDraft(ctx.seed && !ctx.autoSend ? ctx.seed : '')
    if (ctx.seed && ctx.autoSend && !busy) void send(ctx.seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, open])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [msgs])

  useEffect(() => () => ctl.current?.abort(), [])

  const save = (next: Msg[]) => {
    const chat = chats.get(current.current.key)
    if (chat) chat.msgs = next
    setMsgs(next)
  }

  async function send(text: string) {
    const provider = currentProvider()
    const sample = getSample()
    const q = text.trim()
    if (!provider || (provider === 'claude' && !sample) || !q || busy) return
    const { ctx: c, key: k } = current.current
    const history = (chats.get(k)?.msgs ?? []).filter((m) => m.content)
    const next: Msg[] = [...history, { role: 'user', content: q }, { role: 'assistant', content: '' }]
    save(next)
    setDraft('')
    setBusy(true)
    const controller = new AbortController()
    ctl.current = controller
    const update = (content: string, note?: string) => {
      const chat = chats.get(k)
      if (!chat) return
      const msgs2 = [...chat.msgs]
      msgs2[msgs2.length - 1] = { role: 'assistant', content, note }
      chat.msgs = msgs2
      if (current.current.key === k) setMsgs(msgs2)
    }
    try {
      if (provider === 'local') await askLocal(c, history, q, controller.signal, update)
      else await askClaude(sample!, c, history, q, controller.signal, update)
    } finally {
      setBusy(false)
      ctl.current = null
      // Logged once the answer is in: a badge it earns opens a modal, which must not cover Stop mid-answer.
      logTutorQuestion(c.lessonId ?? 'general')
    }
  }

  if (avail !== 'ready' || !open) return null
  const local = tutor.provider === 'local'
  const m = tutor.model

  const lesson = ctx.lessonId ? lessonById(ctx.lessonId) : undefined
  const pIndex = lesson && ctx.problem ? lesson.problems.findIndex((p) => p.id === ctx.problem!.id) : -1
  const last = msgs[msgs.length - 1]
  const thinking = busy && last?.role === 'assistant' && !last.content

  return (
    <>
      <div className="tutor-backdrop" onClick={closeTutor} />
      <aside className="tutor-panel" role="dialog" aria-label="Tutor">
        <div className="card-head" style={{ marginBottom: 8 }}>
          <span className="pill violet">Tutor</span>
          <span className="small dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {lesson ? `${lesson.id} · ${lesson.title}${pIndex >= 0 ? ` · Problem ${pIndex + 1}` : ''}` : 'General'}
          </span>
          {msgs.length > 0 && !busy && (
            <button className="btn small" onClick={() => save([])}>New chat</button>
          )}
          <button className="btn small" onClick={closeTutor} aria-label="Close tutor">✕</button>
        </div>
        <div className="row tutor-switch">
          {tutor.both ? (
            <div className="row" role="group" aria-label="Model">
              <button className={`pill chip ${local ? 'ghost' : ''}`} aria-pressed={!local} disabled={busy} onClick={() => setProvider('claude')}>Claude</button>
              <button className={`pill chip ${local ? '' : 'ghost'}`} aria-pressed={local} disabled={busy} onClick={() => setProvider('local')} title={`${m.model} on ${hostOf(m.baseUrl)}`}>
                {m.model} · local
              </button>
            </div>
          ) : (
            <span className="kbd model-name">{local ? `${m.model} · local` : 'Claude'}</span>
          )}
          <Link to="/settings#tutor-model" className="kbd" onClick={closeTutor} style={{ marginLeft: 'auto' }}>Model settings</Link>
        </div>
        <div className="tutor-msgs" ref={scroller}>
          {msgs.length === 0 && (
            <p className="dim small" style={{ margin: '4px 2px 10px' }}>
              {ctx.problem
                ? 'Stuck? Say what you tried. The tutor will help you find the step that went wrong without giving the answer away.'
                : 'Ask anything about what is on your screen. The tutor knows this lesson and which ideas you have already mastered.'}
            </p>
          )}
          {msgs.map((msg, i) =>
            msg.role === 'user' ? (
              <div key={i} className="tutor-msg user">{msg.content}</div>
            ) : (
              <div key={i} className="tutor-msg bot">
                {msg.content ? <div dangerouslySetInnerHTML={{ __html: renderTutor(msg.content) }} /> : thinking && i === msgs.length - 1 ? <span className="thinking">Thinking…</span> : null}
                {msg.note && <div className="small dim tutor-note" style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: renderTutor(msg.note, { maths: false }) }} />}
              </div>
            ),
          )}
        </div>
        {!busy && (
          <div className="row" style={{ gap: 6, margin: '8px 0' }}>
            {quickAsks(ctx).map((q) => (
              <button key={q} className="pill ghost chip" onClick={() => void send(q)}>{q}</button>
            ))}
          </div>
        )}
        <form
          className="tutor-input"
          onSubmit={(e) => {
            e.preventDefault()
            void send(draft)
          }}
        >
          <textarea
            value={draft}
            rows={2}
            placeholder="Ask about this lesson…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(draft)
              }
            }}
            aria-label="Your question"
          />
          {busy ? (
            <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Stop</button>
          ) : (
            <button type="submit" className="btn primary" disabled={!draft.trim()}>Send</button>
          )}
        </form>
        <div className="kbd" style={{ marginTop: 6 }}>
          {local ? `Runs on ${m.model} at ${hostOf(m.baseUrl)}.` : 'Uses your Claude account.'} Answers can be wrong; check them against the lesson.
        </div>
      </aside>
    </>
  )
}

type Update = (content: string, note?: string) => void

async function askClaude(sample: ClaudeSample, c: TutorContext, history: Msg[], q: string, signal: AbortSignal, update: Update) {
  const turns: ClaudeTurn[] = [
    { role: 'user', content: instructions(c) + '\n\nThe conversation with the learner follows.' },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: q },
  ]
  try {
    const r = await sample(turns, { signal, cache: false, onText: ({ text }) => update(text) })
    update(r.text, r.truncated ? 'Cut short. Ask for less at a time.' : undefined)
  } catch (err) {
    const e = err as ClaudeSampleError
    if (HIDE_CODES.includes(e.code)) {
      disableTutor()
      if (currentProvider() === 'local') update('', `Claude is not available in this view. Ask again to use ${getState().tutorModel.model}.`)
      else {
        update('', 'The tutor is not available in this view.')
        closeTutor()
      }
    } else if (e.code === 'cancelled') update(e.text ?? '', 'Stopped.')
    else if (e.code === 'refused') update('', ERR.refused)
    else update(e.text ?? '', ERR[e.code] ?? 'The connection was interrupted. Try again.')
  }
}

/** Same conversation for a model on the learner's machine, with the prompt sized to its context window. */
async function askLocal(c: TutorContext, history: Msg[], q: string, signal: AbortSignal, update: Update) {
  const m = getState().tutorModel
  const budget = promptBudget(m.contextTokens)
  const system = instructions(c, budget.excerpt)
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...fitHistory(system, history.slice(-12), q, budget.total).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: q },
  ]
  try {
    const r = await chat(m, messages, { signal, onText: ({ text }) => update(text) })
    update(r.text, r.truncated ? 'Cut short: the model reached its length limit. Ask for less at a time, or raise the context size in Model settings.' : undefined)
  } catch (err) {
    const e = err instanceof LocalError ? err : new LocalError('network', String(err))
    update(e.text, e.code === 'cancelled' ? 'Stopped.' : explain(e, m, location.origin))
  }
}
