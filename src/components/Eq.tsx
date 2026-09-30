// Equation explainer. Write symbols as \s{key}{tex}: each becomes tappable and shows its
// meaning, units and intuition. A "Plot it" link opens the matching plotter preset.
import katex from 'katex'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export interface SymbolInfo {
  name: string
  units?: string
  note: string
}

const MACROS = { '\\s': '\\htmlClass{sym sym-#1}{#2}' }

export function tex(src: string, display = false) {
  return katex.renderToString(src, {
    displayMode: display,
    throwOnError: false,
    trust: (ctx) => ctx.command === '\\htmlClass',
    strict: false,
    macros: { ...MACROS },
  })
}

/** Inline math, e.g. <M>{'\\lambda_D'}</M> */
export function M({ children }: { children: string }) {
  return <span dangerouslySetInnerHTML={{ __html: tex(children) }} />
}

export function Eq({
  title,
  src,
  symbols,
  says,
  plot,
}: {
  title?: string
  src: string
  symbols?: Record<string, SymbolInfo>
  says?: string
  plot?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState<string | null>(null)
  const html = useMemo(() => tex(src, true), [src])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (ev: Event) => {
      const t = (ev.target as HTMLElement).closest('.sym') as HTMLElement | null
      if (!t) return
      const key = [...t.classList].find((c) => c.startsWith('sym-'))?.slice(4)
      if (key) setOn((cur) => (cur === key ? null : key))
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    ref.current?.querySelectorAll('.sym').forEach((n) => {
      n.classList.toggle('on', !!on && n.classList.contains(`sym-${on}`))
    })
  }, [on, html])

  const info = on && symbols?.[on]
  return (
    <div className="card glow">
      <div className="card-head">
        <span className="pill">Equation</span>
        {title && <span className="hud-title">{title}</span>}
        {plot && (
          <Link className="btn small" to={`/plot/${plot}`} style={{ marginLeft: 'auto' }}>
            Plot it
          </Link>
        )}
      </div>
      <div className="eq-block" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      {symbols && (
        <div className="sym-chips" aria-label="Symbols">
          {Object.entries(symbols).map(([k, v]) => (
            <button key={k} className={`sym-chip ${on === k ? 'on' : ''}`} onClick={() => setOn(on === k ? null : k)}>
              {v.name}
            </button>
          ))}
        </div>
      )}
      {info ? (
        <div className="sym-panel">
          <strong>{info.name}</strong>
          {info.units && <span className="dim small"> · {info.units}</span>}
          <div>{info.note}</div>
        </div>
      ) : (
        symbols && <div className="dim small" style={{ marginTop: 8 }}>Tap any symbol to see what it means.</div>
      )}
      {says && (
        <div className="sym-panel" style={{ borderColor: 'var(--violet)', background: 'rgba(160,111,214,0.06)' }}>
          <span className="tag">In words</span>
          <div>{says}</div>
        </div>
      )}
    </div>
  )
}
