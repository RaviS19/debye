import { useEffect, useRef } from 'react'

/** Keeps a canvas sized to its CSS box at device-pixel resolution; returns its ref. */
export function useCanvas(aspect: number, onResize?: () => void, maxHeight = 460) {
  const ref = useRef<HTMLCanvasElement>(null)
  const cb = useRef(onResize)
  cb.current = onResize
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const fit = () => {
      const w = c.clientWidth
      const h = Math.round(Math.min(w * aspect, maxHeight))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      c.style.height = `${h}px`
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      cb.current?.()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(c)
    return () => ro.disconnect()
  }, [aspect, maxHeight])
  return ref
}

/** requestAnimationFrame loop that pauses when the canvas is off-screen. */
export function useAnimation(ref: React.RefObject<HTMLCanvasElement | null>, frame: (dtMs: number) => void, running: boolean) {
  const f = useRef(frame)
  f.current = frame
  useEffect(() => {
    const c = ref.current
    if (!c || !running) return
    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(c)
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(t - last, 50)
      last = t
      if (visible) f.current(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [ref, running])
}

export const COLORS = {
  bg: '#030710',
  grid: '#15233d',
  axis: '#314c72',
  text: '#9aa0c9',
  glow: '#8fffff',
  cyan: '#22d3ee',
  violet: '#a06fd6',
  magenta: '#f472b6',
  lime: '#4ade80',
  amber: '#fbbf24',
  red: '#fb5f5f',
  white: '#e8eaf6',
}

/** Stroke a path with a soft neon glow (wide faint passes under a crisp line). */
export function glowStroke(ctx: CanvasRenderingContext2D, color: string, width: number, path: () => void) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const [w, a] of [[width * 5, 0.07], [width * 2.6, 0.14]] as const) {
    ctx.globalAlpha = a
    ctx.lineWidth = w
    ctx.beginPath()
    path()
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.lineWidth = width
  ctx.beginPath()
  path()
  ctx.stroke()
  ctx.restore()
}
