// Interactive plotter: parameter sliders, log or linear axes, drag to pan, wheel or
// pinch to zoom, tap or hover for a crosshair readout.
import { useCallback, useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useCanvas } from './useCanvas'
import { sci } from '../physics/constants'
import { tex } from './Eq'

export interface Param {
  key: string
  label: string
  min: number
  max: number
  value: number
  step?: number
  log?: boolean
  unit?: string
}

export interface Curve {
  label: string
  color: string
  fn: (x: number, p: Record<string, number>) => number
  dashed?: boolean
}

export interface Marker {
  label: string
  color: string
  x?: (p: Record<string, number>) => number
  y?: (p: Record<string, number>) => number
}

export interface PlotSpec {
  id: string
  title: string
  equation?: string
  blurb: string
  x: { label: string; min: number; max: number; log?: boolean }
  y: { label: string; min: number; max: number; log?: boolean }
  params: Param[]
  curves: Curve[]
  markers?: Marker[]
}

type View = { x0: number; x1: number; y0: number; y1: number }

const toAxis = (v: number, log?: boolean) => (log ? Math.log10(v) : v)
const fromAxis = (v: number, log?: boolean) => (log ? 10 ** v : v)

const SUP = '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'
function tick(t: number, log?: boolean) {
  if (!log) return sci(t, 2)
  if (t === 0) return '1'
  if (t === 1) return '10'
  return '10' + String(t).replace(/[-0-9]/g, (d) => SUP['-0123456789'.indexOf(d)])
}

function niceTicks(a: number, b: number, n = 6): number[] {
  const span = b - a
  const step0 = span / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? mag * 10
  const out = []
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-12; v += step) out.push(+v.toPrecision(12))
  return out
}

export function Plotter({ spec, compact }: { spec: PlotSpec; compact?: boolean }) {
  const initial = useCallback(
    (): View => ({
      x0: toAxis(spec.x.min, spec.x.log),
      x1: toAxis(spec.x.max, spec.x.log),
      y0: toAxis(spec.y.min, spec.y.log),
      y1: toAxis(spec.y.max, spec.y.log),
    }),
    [spec],
  )
  const [params, setParams] = useState<Record<string, number>>(() => Object.fromEntries(spec.params.map((p) => [p.key, p.value])))
  const [view, setView] = useState<View>(initial)
  const [hover, setHover] = useState<{ px: number; x: number } | null>(null)
  const [hidden, setHidden] = useState<Record<number, boolean>>({})
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    setParams(Object.fromEntries(spec.params.map((p) => [p.key, p.value])))
    setView(initial())
    setHidden({})
  }, [spec, initial])

  const draw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = c.width / c.clientWidth
    const W = c.clientWidth
    const H = c.clientHeight
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const padL = 58
    const padB = 40
    const padT = 12
    const padR = 14
    const pw = W - padL - padR
    const ph = H - padT - padB
    const v = viewRef.current
    const X = (a: number) => padL + ((a - v.x0) / (v.x1 - v.x0)) * pw
    const Y = (a: number) => padT + (1 - (a - v.y0) / (v.y1 - v.y0)) * ph

    // grid + ticks
    ctx.font = '11px "PT Sans", sans-serif'
    ctx.fillStyle = COLORS.text
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1
    const xt = spec.x.log ? niceTicks(v.x0, v.x1).filter((t) => Number.isInteger(t)) : niceTicks(v.x0, v.x1)
    const yt = spec.y.log ? niceTicks(v.y0, v.y1).filter((t) => Number.isInteger(t)) : niceTicks(v.y0, v.y1, 5)
    ctx.textAlign = 'center'
    for (const t of xt) {
      ctx.beginPath()
      ctx.moveTo(X(t), padT)
      ctx.lineTo(X(t), padT + ph)
      ctx.stroke()
      ctx.fillText(tick(t, spec.x.log), X(t), H - padB + 16)
    }
    ctx.textAlign = 'right'
    for (const t of yt) {
      ctx.beginPath()
      ctx.moveTo(padL, Y(t))
      ctx.lineTo(padL + pw, Y(t))
      ctx.stroke()
      ctx.fillText(tick(t, spec.y.log), padL - 6, Y(t) + 4)
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, padT, pw, ph)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.white
    ctx.fillText(spec.x.label, padL + pw / 2, H - 6)
    ctx.save()
    ctx.translate(12, padT + ph / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(spec.y.label, 0, 0)
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, padT, pw, ph)
    ctx.clip()
    // markers
    for (const m of spec.markers ?? []) {
      ctx.setLineDash([4, 5])
      ctx.strokeStyle = m.color
      ctx.lineWidth = 1.2
      ctx.fillStyle = m.color
      ctx.textAlign = 'left'
      if (m.x) {
        const px = X(toAxis(m.x(params), spec.x.log))
        ctx.beginPath()
        ctx.moveTo(px, padT)
        ctx.lineTo(px, padT + ph)
        ctx.stroke()
        ctx.fillText(m.label, px + 4, padT + 14)
      }
      if (m.y) {
        const py = Y(toAxis(m.y(params), spec.y.log))
        ctx.beginPath()
        ctx.moveTo(padL, py)
        ctx.lineTo(padL + pw, py)
        ctx.stroke()
        ctx.fillText(m.label, padL + 6, py - 5)
      }
      ctx.setLineDash([])
    }
    // curves
    const N = Math.max(200, Math.round(pw))
    spec.curves.forEach((cv, i) => {
      if (hidden[i]) return
      if (cv.dashed) ctx.setLineDash([6, 6])
      glowStroke(ctx, cv.color, 2, () => {
        let pen = false
        for (let k = 0; k <= N; k++) {
          const a = v.x0 + ((v.x1 - v.x0) * k) / N
          const y = cv.fn(fromAxis(a, spec.x.log), params)
          const ya = spec.y.log ? (y > 0 ? Math.log10(y) : NaN) : y
          if (!isFinite(ya)) {
            pen = false
            continue
          }
          const py = Math.max(-1e4, Math.min(1e4, Y(ya)))
          if (pen) ctx.lineTo(X(a), py)
          else ctx.moveTo(X(a), py)
          pen = true
        }
      })
      ctx.setLineDash([])
    })
    // crosshair
    if (hover) {
      ctx.strokeStyle = 'rgba(143,255,255,0.4)'
      ctx.beginPath()
      ctx.moveTo(hover.px, padT)
      ctx.lineTo(hover.px, padT + ph)
      ctx.stroke()
      spec.curves.forEach((cv, i) => {
        if (hidden[i]) return
        const y = cv.fn(hover.x, params)
        const ya = spec.y.log ? Math.log10(y) : y
        if (!isFinite(ya)) return
        ctx.fillStyle = cv.color
        ctx.beginPath()
        ctx.arc(hover.px, Y(ya), 4, 0, 7)
        ctx.fill()
      })
    }
    ctx.restore()
  }, [spec, params, hover, hidden])

  const canvasRef = useCanvas(compact ? 0.55 : 0.6, () => draw())
  useEffect(draw, [draw, view])

  // ---- interaction ----
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const geom = () => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { r, padL: 58, pw: r.width - 72, padT: 12, ph: r.height - 52 }
  }
  const axisAt = (clientX: number, clientY: number) => {
    const g = geom()
    const v = viewRef.current
    const fx = (clientX - g.r.left - g.padL) / g.pw
    const fy = 1 - (clientY - g.r.top - g.padT) / g.ph
    return { fx, fy, ax: v.x0 + fx * (v.x1 - v.x0), ay: v.y0 + fy * (v.y1 - v.y0) }
  }
  const zoom = (factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const ax = cx ?? (v.x0 + v.x1) / 2
      const ay = cy ?? (v.y0 + v.y1) / 2
      return { x0: ax + (v.x0 - ax) * factor, x1: ax + (v.x1 - ax) * factor, y0: ay + (v.y0 - ay) * factor, y1: ay + (v.y1 - ay) * factor }
    })
  }
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const { ax, ay } = axisAt(e.clientX, e.clientY)
      zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, ax, ay)
    }
    c.addEventListener('wheel', wheel, { passive: false })
    return () => c.removeEventListener('wheel', wheel)
  })

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const onMove = (e: React.PointerEvent) => {
    const { fx, ax } = axisAt(e.clientX, e.clientY)
    if (fx >= 0 && fx <= 1) setHover({ px: geom().padL + fx * geom().pw, x: fromAxis(ax, spec.x.log) })
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const pts = [...pointers.current.values()]
    if (pts.length === 2) {
      const other = pts.find((p) => p !== prev)!
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      if (d0 > 0 && d1 > 0) {
        const mid = axisAt((e.clientX + other.x) / 2, (e.clientY + other.y) / 2)
        zoom(d0 / d1, mid.ax, mid.ay)
      }
    } else {
      const g = geom()
      setView((v) => {
        const dx = ((e.clientX - prev.x) / g.pw) * (v.x1 - v.x0)
        const dy = ((e.clientY - prev.y) / g.ph) * (v.y1 - v.y0)
        return { x0: v.x0 - dx, x1: v.x1 - dx, y0: v.y0 + dy, y1: v.y1 + dy }
      })
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const onUp = (e: React.PointerEvent) => pointers.current.delete(e.pointerId)

  return (
    <div className={compact ? '' : 'card glow'}>
      {!compact && (
        <div className="card-head">
          <span className="pill violet">Plotter</span>
          <span className="hud-title">{spec.title}</span>
        </div>
      )}
      {spec.equation && !compact && <div className="eq-block" dangerouslySetInnerHTML={{ __html: tex(spec.equation, true) }} />}
      <canvas
        ref={canvasRef}
        className="sim"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
        aria-label={`Plot: ${spec.title}`}
      />
      <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 6 }}>
          {spec.curves.map((cv, i) => (
            <button
              key={cv.label}
              className="sym-chip"
              style={{ borderColor: hidden[i] ? undefined : cv.color, color: hidden[i] ? undefined : cv.color }}
              onClick={() => setHidden((h) => ({ ...h, [i]: !h[i] }))}
            >
              {hidden[i] ? '○' : '●'} {cv.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn small" onClick={() => zoom(1 / 1.4)} aria-label="Zoom in">＋</button>
          <button className="btn small" onClick={() => zoom(1.4)} aria-label="Zoom out">－</button>
          <button className="btn small" onClick={() => setView(initial())}>Reset</button>
        </div>
      </div>
      {hover && (
        <div className="readouts">
          <span>
            {spec.x.label}: <b>{sci(hover.x)}</b>
          </span>
          {spec.curves.map((cv, i) =>
            hidden[i] ? null : (
              <span key={cv.label} style={{ color: cv.color }}>
                {cv.label}: <b>{sci(cv.fn(hover.x, params))}</b>
              </span>
            ),
          )}
        </div>
      )}
      <div className="controls">
        {spec.params.map((p) => (
          <ParamSlider key={p.key} p={p} value={params[p.key]} onChange={(v) => setParams((s) => ({ ...s, [p.key]: v }))} />
        ))}
      </div>
      {!compact && <p className="dim small" style={{ marginTop: 12 }}>{spec.blurb}</p>}
    </div>
  )
}

export function ParamSlider({ p, value, onChange }: { p: Param; value: number; onChange: (v: number) => void }) {
  const pos = p.log ? Math.log10(value) : value
  const min = p.log ? Math.log10(p.min) : p.min
  const max = p.log ? Math.log10(p.max) : p.max
  return (
    <div className="ctrl">
      <label>
        <span>{p.label}</span>
        <b>
          {sci(value)} {p.unit}
        </b>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={p.log ? (max - min) / 200 : p.step ?? (max - min) / 200}
        value={pos}
        onChange={(e) => onChange(p.log ? 10 ** +e.target.value : +e.target.value)}
        aria-label={p.label}
      />
    </div>
  )
}
