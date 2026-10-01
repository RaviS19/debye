// Device-only settings, the tutor model and its API key above all, must never travel with synced progress.
import { describe, expect, it } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { fresh, getState, resetAll, setState, upgrade, type State } from './store'
import { mergeState, payload, SYNC_KEYS } from './merge'
import { exportCode } from './sync'

const SECRET = 'sk-never-synced-123'
function withLocalModel(s: State) {
  s.tutorModel = { provider: 'local', preset: 'lmstudio', protocol: 'openai', baseUrl: 'http://localhost:1234/v1', model: 'qwen', apiKey: SECRET, contextTokens: 16384 }
  return s
}

describe('tutor model stays on the device', () => {
  it('is not part of the sync payload', () => {
    expect(SYNC_KEYS).not.toContain('tutorModel' as never)
    const p = payload(withLocalModel(fresh()))
    expect(Object.keys(p)).not.toContain('tutorModel')
    expect(JSON.stringify(p)).not.toContain(SECRET)
  })
  it('is not in a progress code', async () => {
    setState((s) => withLocalModel(s))
    const code = await exportCode()
    const bytes = Buffer.from(code.slice(7), 'base64')
    const json = code.startsWith('DEBYE1.') ? gunzipSync(bytes).toString() : bytes.toString()
    expect(json).toContain('xpBy')
    expect(json).not.toContain('tutorModel')
    expect(json).not.toContain(SECRET)
  })
  it('survives merges, including a reset from another device, and ignores a remote copy', () => {
    const local = withLocalModel(fresh())
    const remote = { ...payload(fresh()), tutorModel: { ...fresh().tutorModel, baseUrl: 'http://evil.example' } }
    expect(mergeState(local, remote).tutorModel).toEqual(local.tutorModel)
    const reset = { ...payload(fresh()), epoch: '2099-01-01T00:00:00Z' }
    expect(mergeState(local, reset).tutorModel).toEqual(local.tutorModel)
  })
  it('survives a reset of progress', () => {
    setState((s) => withLocalModel(s))
    resetAll()
    expect(getState().tutorModel.apiKey).toBe(SECRET)
  })
  it('defaults to Claude for states saved before it existed', () => {
    const old = fresh() as Partial<State>
    delete old.tutorModel
    const s = upgrade(JSON.parse(JSON.stringify(old)))
    expect(s.tutorModel.provider).toBe('claude')
    expect(s.tutorModel.contextTokens).toBe(8192)
    expect(upgrade({ ...old, tutorModel: { model: 'x' } as State['tutorModel'] }).tutorModel).toMatchObject({ model: 'x', baseUrl: 'http://localhost:11434', provider: 'claude' })
  })
})
