// The small part of the claude.ai artifact runtime this app uses. Present only when the app is opened
// as a published artifact on claude.ai; everywhere else `window.claude` is undefined and these features hide.
export {}

declare global {
  interface ClaudeDocSnapshot {
    exists: boolean
    data(): Record<string, unknown> | undefined
    metadata: { fromCache: boolean; hasPendingWrites: boolean }
  }
  interface ClaudeDocRef {
    get(): Promise<ClaudeDocSnapshot>
    set(data: Record<string, unknown>): Promise<void>
    onSnapshot(next: (s: ClaudeDocSnapshot) => void, error?: (e: { code: string; message: string }) => void): () => void
  }
  interface ClaudeDb {
    doc(path: string): ClaudeDocRef
  }
  interface ClaudeUser {
    id(): Promise<string | null>
  }
  interface ClaudeSampleError {
    code: string
    message: string
    text?: string
  }
  type ClaudeTurn = { role: 'user' | 'assistant'; content: string }
  interface ClaudeSample {
    (
      input: string | ClaudeTurn[],
      options?: { onText?: (u: { text: string; delta: string }) => void; signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex'; cache?: boolean },
    ): Promise<{ text: string; truncated: boolean }>
  }
  interface ClaudeRuntime {
    use(name: 'db'): Promise<ClaudeDb | null>
    use(name: 'user'): Promise<ClaudeUser | null>
    use(name: 'sample'): Promise<ClaudeSample | null>
  }
  interface Window {
    claude?: ClaudeRuntime
  }
}
