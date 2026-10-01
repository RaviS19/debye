// Settings card: which model the tutor uses on this device, and setting up a local one.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { setState, type LocalPreset, type TutorModel } from '../store/store'
import { useTutor } from './state'
import { chat, CONTEXT_SIZES, explain, listModels, localReady, PRESETS, setupHelp, tidyUrl, trimUrl, type ModelInfo } from './local'
import { renderTutor } from './render'

const edit = (patch: Partial<TutorModel>) =>
  setState((s) => {
    s.tutorModel = { ...s.tutorModel, ...patch }
  })

const EMBED = /embed/i
const TEST_PROMPT = [
  { role: 'system' as const, content: 'You are a concise physics tutor.' },
  { role: 'user' as const, content: 'In one sentence: what is a plasma?' },
]

export function TutorModelCard() {
  const t = useTutor()
  const m = t.model
  const origin = location.origin
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [busy, setBusy] = useState<'find' | 'test' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const { hash } = useLocation()

  // Opened from the tutor panel's "Model settings" link.
  useEffect(() => {
    if (hash === '#tutor-model') requestAnimationFrame(() => card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [hash])
  useEffect(() => () => ctl.current?.abort(), [])

  const forget = () => {
    ctl.current?.abort()
    ctl.current = null
    setBusy(null)
    setModels(null)
    setMsg(null)
    setReply(null)
  }
  const cfg = () => ({ ...m, baseUrl: trimUrl(m.baseUrl), model: m.model.trim() })

  async function find() {
    const c = new AbortController()
    ctl.current = c
    const was = cfg()
    setBusy('find')
    setMsg(null)
    setReply(null)
    try {
      const list = await listModels(was, { signal: c.signal })
      if (ctl.current !== c) return // the server was changed meanwhile: this list belongs to the old one
      setModels(list)
      if (!list.length)
        setMsg({ ok: false, text: `${PRESETS[m.preset].label} is running but has no models yet. ${m.protocol === 'ollama' ? 'Download one with `ollama pull qwen2.5:7b`.' : 'Download or load one first.'}` })
      else {
        const has = list.some((x) => x.id === was.model)
        // embedding models are listed too, but cannot chat
        if (!was.model) edit({ model: (list.find((x) => !EMBED.test(x.id)) ?? list[0]).id })
        setMsg({ ok: true, text: `Found ${list.length} model${list.length === 1 ? '' : 's'}.${was.model && !has ? ` "${was.model}" is not one of them; pick one below.` : ''}` })
      }
    } catch (e) {
      if (ctl.current !== c) return
      setModels(null)
      setMsg({ ok: false, text: explain(e, was, origin, true) })
    } finally {
      if (ctl.current === c) {
        setBusy(null)
        ctl.current = null
      }
    }
  }

  async function test() {
    const c = new AbortController()
    ctl.current = c
    setBusy('test')
    setMsg(null)
    setReply('')
    try {
      const r = await chat(cfg(), TEST_PROMPT, { signal: c.signal, onText: ({ text }) => setReply(text) })
      setReply(r.text)
      setMsg({ ok: true, text: `It works. ${m.model} answers in the tutor now.` })
    } catch (e) {
      setReply((r) => r || null) // keep a partial answer, drop the "Thinking…" placeholder
      setMsg({ ok: false, text: explain(e, cfg(), origin, true) })
    } finally {
      setBusy(null)
      ctl.current = null
    }
  }

  const listed = models?.some((x) => x.id === m.model)
  // The radios show what can actually be used here, not just what was saved.
  const claudeOn = (m.provider === 'claude' || t.blocked) && t.claude === 'ready'
  const localOn = m.provider === 'local' && !t.blocked
  return (
    <div className="card" id="tutor-model" ref={card}>
      <div className="card-head"><span className="pill violet">Tutor model</span></div>
      <p className="small dim">Which model answers when you press ✦ Ask. This choice stays on this device.</p>

      <div className="tm-choice" role="radiogroup" aria-label="Tutor model">
        <label htmlFor="tm-provider-claude" className={t.claude === 'ready' ? '' : 'off'}>
          <input type="radio" id="tm-provider-claude" name="tm-provider" checked={claudeOn} disabled={t.claude !== 'ready'} onChange={() => edit({ provider: 'claude' })} />
          <span>
            <b>Claude</b>
            <span className="small dim">
              {t.claude === 'ready'
                ? 'Uses your claude.ai account.'
                : t.blocked && t.claude === 'off'
                  ? 'Claude is not available in this view (it may not have been allowed for this artifact).'
                  : 'Available when Debye is opened on claude.ai.'}
            </span>
          </span>
        </label>
        <label htmlFor="tm-provider-local" className={t.blocked ? 'off' : ''}>
          <input type="radio" id="tm-provider-local" name="tm-provider" checked={localOn} disabled={t.blocked} onChange={() => edit({ provider: 'local' })} />
          <span>
            <b>Local model</b>
            <span className="small dim">
              {t.blocked
                ? 'A model on your own machine works when Debye runs on your own computer or phone (see “Use a local model” in the README), because claude.ai does not let this page reach it.'
                : 'Ollama, LM Studio, llama.cpp, Jan or any OpenAI-compatible server on your computer or network. With a server of your own, your questions stay with it.'}
            </span>
          </span>
        </label>
      </div>

      {localOn && (
        <>
          <div className="tm-grid">
            <div className="ctrl">
              <label htmlFor="tm-preset"><span>Server</span></label>
              <select
                id="tm-preset"
                value={m.preset}
                onChange={(e) => {
                  const p = e.target.value as LocalPreset
                  edit({ preset: p, protocol: PRESETS[p].protocol, baseUrl: p === 'custom' ? m.baseUrl : PRESETS[p].baseUrl, model: '' }) // model names differ between servers
                  forget()
                }}
              >
                {(Object.keys(PRESETS) as LocalPreset[]).map((p) => (
                  <option key={p} value={p}>{PRESETS[p].label}</option>
                ))}
              </select>
            </div>
            <div className="ctrl">
              <label htmlFor="tm-base"><span>Address</span></label>
              <input
                id="tm-base"
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={m.baseUrl}
                placeholder={PRESETS[m.preset].baseUrl || 'http://localhost:8000/v1'}
                onChange={(e) => {
                  edit({ baseUrl: e.target.value })
                  forget()
                }}
                onBlur={() => m.baseUrl !== tidyUrl(m.baseUrl) && edit({ baseUrl: tidyUrl(m.baseUrl) })}
              />
            </div>
            {models && models.length > 0 && (
              <div className="ctrl tm-wide">
                <label htmlFor="tm-model-select"><span>Models on this server</span></label>
                <select id="tm-model-select" value={listed ? m.model : ''} onChange={(e) => e.target.value && edit({ model: e.target.value })}>
                  {!listed && <option value="">Choose a model…</option>}
                  {models.map((x) => (
                    <option key={x.id} value={x.id}>{x.id}{x.detail ? ` (${x.detail})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="ctrl">
              <label htmlFor="tm-model"><span>{models?.length ? 'Or type a model name' : 'Model'}</span></label>
              <input
                id="tm-model"
                type="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={m.model}
                placeholder={m.protocol === 'ollama' ? 'e.g. qwen2.5:7b' : 'as the server lists it'}
                onChange={(e) => edit({ model: e.target.value })}
                onBlur={() => m.model !== m.model.trim() && edit({ model: m.model.trim() })}
              />
            </div>
            <div className="ctrl">
              <label htmlFor="tm-ctx"><span>Context size</span></label>
              <select id="tm-ctx" value={m.contextTokens} onChange={(e) => edit({ contextTokens: +e.target.value })}>
                {CONTEXT_SIZES.map((n) => (
                  <option key={n} value={n}>{n / 1024}K tokens</option>
                ))}
              </select>
            </div>
            <div className="ctrl">
              <label htmlFor="tm-key"><span>API key (optional)</span></label>
              <input id="tm-key" type="password" autoComplete="off" value={m.apiKey} placeholder="Leave empty if none" onChange={(e) => edit({ apiKey: e.target.value })} />
            </div>
          </div>
          <p className="small dim" style={{ marginTop: 10 }}>
            A bigger context lets the tutor read more of the lesson and the chat, but needs more memory; 8K suits most 7B models.
            {m.protocol === 'openai' ? ' Load the model with the same context length in your server; here it only sizes the prompt.' : ''} The API key is kept on this device only: it is never synced and never put in a progress code.
          </p>

          <div className="row">
            {busy === 'find' ? (
              <button className="btn small" onClick={forget}>Cancel</button>
            ) : (
              <button className="btn small" disabled={!!busy || !trimUrl(m.baseUrl)} onClick={() => void find()}>Find models</button>
            )}
            {busy === 'test' ? (
              <button className="btn small" onClick={() => ctl.current?.abort()}>Stop</button>
            ) : (
              <button className="btn small primary" disabled={!!busy || !localReady(m)} onClick={() => void test()}>Test</button>
            )}
            {busy === 'find' ? <span className="small dim">Looking for models…</span> : !localReady(m) && <span className="small dim">Pick a model to switch the tutor on.</span>}
          </div>
          {reply !== null && (
            <div className="tutor-msg bot tm-reply" aria-live="polite" aria-busy={busy === 'test'}>
              {reply ? <div dangerouslySetInnerHTML={{ __html: renderTutor(reply) }} /> : <span className="thinking">Thinking… (the first answer can take a while as the model loads)</span>}
            </div>
          )}
          {msg && <div className={`feedback tm-msg ${msg.ok ? 'good' : 'bad'}`} role="status" dangerouslySetInnerHTML={{ __html: renderTutor(msg.text, { maths: false }) }} />}

          <div className="tm-help">
            <div className="tag">Setting up {PRESETS[m.preset].label}</div>
            <div dangerouslySetInnerHTML={{ __html: renderTutor(setupHelp(m, origin).join('\n'), { maths: false }) }} />
          </div>
        </>
      )}
    </div>
  )
}
