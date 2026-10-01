// A6: a clickable CMA (Clemmow–Mullaly–Allis) diagram for a cold electron plasma with fixed ions.
// Horizontal: X = ω_p²/ω² (density, or lower frequency). Vertical: Y = ω_c/ω (magnetic field).
// Tap a point to see which of the four principal waves propagate there, drawn as live wave strips.
import { useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { modeN2, propagating, type ModeName } from '../physics/emwave'
import { SimFrame } from './SimFrame'

const XMAX = 3
const YMAX = 2.5
const MODES: { m: ModeName; dir: string; color: string; what: string }[] = [
  { m: 'R', dir: 'k ∥ B', color: COLORS.cyan, what: 'right-hand circular' },
  { m: 'L', dir: 'k ∥ B', color: COLORS.magenta, what: 'left-hand circular' },
  { m: 'O', dir: 'k ⊥ B', color: COLORS.amber, what: 'ordinary, E ∥ B' },
  { m: 'X', dir: 'k ⊥ B', color: COLORS.lime, what: 'extraordinary, E ⊥ B' },
]
const PRESETS: { label: string; X: number; Y: number }[] = [
  { label: 'Thin plasma', X: 0.3, Y: 0.3 },
  { label: 'Past R cutoff', X: 0.6, Y: 0.5 },
  { label: 'Whistler', X: 2.8, Y: 1.5 },
  { label: 'Overdense', X: 2, Y: 0.5 },
]

interface Layout {
  dx0: number
  dy0: number
  dw: number
  dh: number
  sx0: number
  sy0: number
  sw: number
  sh: number
}

function layout(W: number, H: number, u: number, narrow: boolean): Layout {
  if (narrow) {
    const dh = H * 0.56
    return { dx0: 36 * u, dy0: 10 * u, dw: W - 46 * u, dh: dh - 44 * u, sx0: 8 * u, sy0: dh + 4 * u, sw: W - 16 * u, sh: H - dh - 10 * u }
  }
  const dW = W * 0.6
  return { dx0: 40 * u, dy0: 12 * u, dw: dW - 52 * u, dh: H - 56 * u, sx0: dW + 6 * u, sy0: 12 * u, sw: W - dW - 14 * u, sh: H - 24 * u }
}

export function CmaSim() {
  const [running, setRunning] = useState(true)
  const [pt, setPt] = useState({ X: 0.6, Y: 0.5 })
  const phase = useRef(0)
  const shade = useRef<{ key: string; img: HTMLCanvasElement } | null>(null)

  const n2 = modeN2(pt.X, pt.Y)
  const prop = propagating(pt.X, pt.Y)

  const canvas = useCanvas(typeof innerWidth !== 'undefined' && innerWidth < 560 ? 1.45 : 0.56, undefined, 600)

  /** Region shading: brighter where more of the four modes propagate. Cached per canvas size. */
  const shading = (L: Layout) => {
    const key = `${Math.round(L.dw)}x${Math.round(L.dh)}`
    if (shade.current?.key === key) return shade.current.img
    const nx = 240
    const ny = Math.max(40, Math.round((nx * L.dh) / L.dw))
    const img = document.createElement('canvas')
    img.width = nx
    img.height = ny
    const g = img.getContext('2d')!
    const data = g.createImageData(nx, ny)
    for (let j = 0; j < ny; j++) {
      const Y = YMAX * (1 - (j + 0.5) / ny)
      for (let i = 0; i < nx; i++) {
        const X = XMAX * ((i + 0.5) / nx)
        const p = propagating(X, Y)
        const n = +p.R + +p.L + +p.O + +p.X
        const o = 4 * (j * nx + i)
        data.data[o] = 34
        data.data[o + 1] = 211
        data.data[o + 2] = 238
        data.data[o + 3] = Math.round(255 * (0.02 + 0.075 * n))
      }
    }
    g.putImageData(data, 0, 0)
    shade.current = { key, img }
    return img
  }

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const narrow = c.clientWidth < 560
    const L = layout(W, H, u, narrow)
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const PX = (X: number) => L.dx0 + (X / XMAX) * L.dw
    const PY = (Y: number) => L.dy0 + (1 - Y / YMAX) * L.dh
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(shading(L), L.dx0, L.dy0, L.dw, L.dh)
    // grid + axes
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    const fs = (narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.text
    for (let X = 0; X <= XMAX; X += 0.5) {
      ctx.beginPath()
      ctx.moveTo(PX(X), L.dy0)
      ctx.lineTo(PX(X), L.dy0 + L.dh)
      ctx.stroke()
      if (Number.isInteger(X)) {
        ctx.textAlign = 'center'
        ctx.fillText(String(X), PX(X), L.dy0 + L.dh + 13 * u)
      }
    }
    for (let Y = 0; Y <= YMAX; Y += 0.5) {
      ctx.beginPath()
      ctx.moveTo(L.dx0, PY(Y))
      ctx.lineTo(L.dx0 + L.dw, PY(Y))
      ctx.stroke()
      if (Number.isInteger(Y)) {
        ctx.textAlign = 'right'
        ctx.fillText(String(Y), L.dx0 - 5 * u, PY(Y) + 4 * u)
      }
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(L.dx0, L.dy0, L.dw, L.dh)
    ctx.fillStyle = COLORS.white
    ctx.textAlign = 'center'
    ctx.fillText('X = ω_p²/ω²  (denser →)', L.dx0 + L.dw / 2, L.dy0 + L.dh + 28 * u)
    ctx.save()
    ctx.translate(L.dx0 - 24 * u, L.dy0 + L.dh / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Y = ω_c/ω  (stronger B →)', 0, 0)
    ctx.restore()

    // boundaries: cutoffs (n = 0) and resonances (n → ∞)
    ctx.save()
    ctx.beginPath()
    ctx.rect(L.dx0, L.dy0, L.dw, L.dh)
    ctx.clip()
    const curve = (col: string, f: (s: number) => [number, number], dashed = false) => {
      if (dashed) ctx.setLineDash([6 * u, 5 * u])
      glowStroke(ctx, col, 1.6 * u, () => {
        for (let k = 0; k <= 100; k++) {
          const [X, Y] = f(k / 100)
          if (k) ctx.lineTo(PX(X), PY(Y))
          else ctx.moveTo(PX(X), PY(Y))
        }
      })
      ctx.setLineDash([])
    }
    curve(COLORS.amber, (s) => [1, s * YMAX]) // P = 0
    curve(COLORS.cyan, (s) => [1 - s, s]) // R = 0
    curve(COLORS.magenta, (s) => [1 + s * YMAX, s * YMAX]) // L = 0
    curve(COLORS.lime, (s) => [1 - s * s, s], true) // S = 0, upper hybrid
    curve(COLORS.red, (s) => [s * XMAX, 1], true) // R → ∞, cyclotron
    ctx.restore()
    // the chosen point
    const cx = PX(pt.X)
    const cy = PY(pt.Y)
    ctx.strokeStyle = 'rgba(143,255,255,0.45)'
    ctx.setLineDash([3 * u, 4 * u])
    ctx.beginPath()
    ctx.moveTo(cx, L.dy0)
    ctx.lineTo(cx, L.dy0 + L.dh)
    ctx.moveTo(L.dx0, cy)
    ctx.lineTo(L.dx0 + L.dw, cy)
    ctx.stroke()
    ctx.setLineDash([])
    // legend in the open top-left corner (all five boundaries meet near X = 1, Y = 0)
    const legend: [string, string, boolean][] = [
      [COLORS.amber, 'O cutoff  (ω = ω_p)', false],
      [COLORS.cyan, 'R cutoff  (ω = ω_R)', false],
      [COLORS.magenta, 'L cutoff  (ω = ω_L)', false],
      [COLORS.lime, 'upper hybrid', true],
      [COLORS.red, 'cyclotron  (ω = ω_c)', true],
    ]
    const lf = (narrow ? 10 : 10.5) * u
    ctx.font = `${lf}px "PT Sans", sans-serif`
    ctx.textAlign = 'left'
    const lx = L.dx0 + 6 * u
    let ly = L.dy0 + 8 * u
    ctx.fillStyle = 'rgba(3,7,16,0.72)'
    ctx.fillRect(L.dx0 + 2 * u, L.dy0 + 2 * u, (narrow ? 112 : 132) * u, lf * 1.35 * legend.length + 10 * u)
    for (const [col, txt, dashed] of legend) {
      ctx.strokeStyle = col
      ctx.lineWidth = 2 * u
      if (dashed) ctx.setLineDash([4 * u, 3 * u])
      ctx.beginPath()
      ctx.moveTo(lx, ly + lf * 0.45)
      ctx.lineTo(lx + 14 * u, ly + lf * 0.45)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = col
      ctx.fillText(narrow ? txt.replace(/\s+\(.*\)/, '') : txt, lx + 19 * u, ly + lf * 0.85)
      ly += lf * 1.35
    }

    ctx.fillStyle = '#fff'
    ctx.shadowColor = COLORS.glow
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(cx, cy, 6 * u, 0, 7)
    ctx.fill()
    ctx.shadowBlur = 0

    // wave strips: E along the propagation direction, over three vacuum wavelengths
    const rowH = L.sh / 4
    const ph = phase.current
    MODES.forEach(({ m, dir, color, what }, r) => {
      const y0 = L.sy0 + r * rowH
      const midY = y0 + rowH * 0.62
      const amp = rowH * 0.24
      const x0 = L.sx0 + 4 * u
      const w = L.sw - 8 * u
      ctx.strokeStyle = COLORS.grid
      ctx.strokeRect(L.sx0, y0 + 2 * u, L.sw, rowH - 4 * u)
      const v = n2[m]
      const ok = prop[m]
      ctx.textAlign = 'left'
      ctx.font = `600 ${(narrow ? 11 : 12) * u}px Exo, sans-serif`
      ctx.fillStyle = color
      ctx.fillText(m, x0 + 2 * u, y0 + 16 * u)
      ctx.font = `${(narrow ? 10 : 11) * u}px "PT Sans", sans-serif`
      ctx.fillStyle = COLORS.text
      const n2txt = !isFinite(v) ? '∞ (resonance)' : Math.abs(v) > 99 ? (v > 0 ? '> 99' : '< −99') : v.toFixed(2)
      ctx.fillText(`${dir} · n² = ${n2txt}`, x0 + 18 * u, y0 + 16 * u)
      if (!narrow) {
        ctx.fillStyle = 'rgba(154,160,201,0.7)'
        ctx.fillText(what, x0 + 2 * u, y0 + 31 * u)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = ok ? COLORS.lime : COLORS.red
      ctx.fillText(ok ? 'propagates' : 'cut off', L.sx0 + L.sw - 6 * u, y0 + 16 * u)
      // vacuum reference wave, faint
      ctx.strokeStyle = 'rgba(154,160,201,0.25)'
      ctx.lineWidth = u
      ctx.beginPath()
      for (let k = 0; k <= 120; k++) {
        const s = (k / 120) * 3
        const y = midY - amp * Math.cos(2 * Math.PI * (s - ph))
        if (k) ctx.lineTo(x0 + (k / 120) * w, y)
        else ctx.moveTo(x0 + (k / 120) * w, y)
      }
      ctx.stroke()
      const nAbs = Math.sqrt(Math.min(Math.abs(v), 144))
      glowStroke(ctx, ok ? color : COLORS.red, 1.6 * u, () => {
        const N = 240
        for (let k = 0; k <= N; k++) {
          const s = (k / N) * 3
          const y = ok
            ? midY - amp * Math.cos(2 * Math.PI * (nAbs * s - ph))
            : midY - amp * Math.exp(-2 * Math.PI * nAbs * s) * Math.cos(2 * Math.PI * ph)
          if (k) ctx.lineTo(x0 + (k / N) * w, y)
          else ctx.moveTo(x0 + (k / N) * w, y)
        }
      })
    })
  }

  useAnimation(
    canvas,
    (dt) => {
      phase.current = (phase.current + dt / 2000) % 1
      draw()
    },
    running,
  )
  useEffect(() => {
    if (!running) draw()
  })

  const pick = (e: React.PointerEvent) => {
    const c = canvas.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const u = c.width / c.clientWidth
    const L = layout(c.width, c.height, u, c.clientWidth < 560)
    const px = (e.clientX - r.left) * u
    const py = (e.clientY - r.top) * u
    const X = ((px - L.dx0) / L.dw) * XMAX
    const Y = (1 - (py - L.dy0) / L.dh) * YMAX
    if (X < -0.1 || X > XMAX + 0.1 || Y < -0.1 || Y > YMAX + 0.1) return
    const clamp = (v: number, hi: number) => Math.max(0.005, Math.min(hi, v))
    setPt({ X: clamp(X, XMAX), Y: clamp(Y, YMAX) })
  }

  const w = 1 / Math.sqrt(pt.X) // ω/ω_p
  const count = MODES.filter(({ m }) => prop[m]).length

  return (
    <SimFrame
      id="cma"
      title="CMA diagram: which waves get through?"
      running={running}
      setRunning={setRunning}
      onReset={() => setPt({ X: 0.6, Y: 0.5 })}
      hint="Tap or drag anywhere on the diagram. Moving right means a denser plasma (or a lower wave frequency); moving up means a stronger magnetic field. The strips show each principal wave over three vacuum wavelengths (faint line): a propagating wave has wavelength λ₀/n; a cut-off one decays as exp(−2π|n|x/λ₀), within a fraction of a wavelength unless it is close to a cutoff. Brighter regions let more of the four waves through. Electrons only; ions are held fixed."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {PRESETS.map((p) => (
          <button key={p.label} className="btn small" onClick={() => setPt({ X: p.X, Y: p.Y })}>{p.label}</button>
        ))}
      </div>
      <canvas
        ref={canvas}
        className="sim"
        onPointerDown={(e) => { ;(e.target as HTMLElement).setPointerCapture(e.pointerId); pick(e) }}
        onPointerMove={(e) => e.buttons && pick(e)}
        aria-label="CMA diagram: tap to choose density and magnetic field"
      />
      <div className="readouts">
        <span>X = <b>{pt.X.toFixed(2)}</b></span>
        <span>Y = <b>{pt.Y.toFixed(2)}</b></span>
        <span>ω/ω_p = <b>{w.toFixed(2)}</b></span>
        <span>ω_c/ω_p = <b>{(pt.Y * w).toFixed(2)}</b></span>
        <span>
          propagating: <b className={count ? 'ok' : ''}>{count ? MODES.filter(({ m }) => prop[m]).map(({ m }) => m).join(', ') : 'none'}</b>
        </span>
      </div>
    </SimFrame>
  )
}
