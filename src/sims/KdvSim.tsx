// A10: two KdV solitons. A tall (fast) soliton overtakes a short (slow) one; both emerge unchanged,
// but shifted: the tall one jumps ahead and the short one falls back. Pseudo-spectral solver of
// u_t + u u_x + u_xxx = 0 with an integrating factor (exact dispersion) and RK4.
import { useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { createKdv, findPeaks, phaseShifts, stepKdv, syncU, wrapDist, type Kdv } from '../physics/kdv'
import { SimFrame, Slider } from './SimFrame'

const L = 200
const N = 512
const DT = 0.025
const X1 = 20
const X2 = 50
const SNAP = 0.5 // time between rows of the space–time image
const COLS = 256

interface Meas {
  t: number
  v1: number
  v2: number
  s1: number
  s2: number
  done: boolean
}

function colormap(f: number): [number, number, number] {
  // bg → violet → cyan → white
  const stops: [number, number, number, number][] = [
    [0, 3, 7, 16],
    [0.12, 60, 30, 110],
    [0.4, 34, 150, 220],
    [0.7, 60, 230, 240],
    [1, 240, 255, 255],
  ]
  f = Math.max(0, Math.min(1, f))
  for (let i = 1; i < stops.length; i++) {
    if (f <= stops[i][0]) {
      const a = stops[i - 1]
      const b = stops[i]
      const s = (f - a[0]) / (b[0] - a[0])
      return [a[1] + s * (b[1] - a[1]), a[2] + s * (b[2] - a[2]), a[3] + s * (b[3] - a[3])]
    }
  }
  return [240, 255, 255]
}

export function KdvSim() {
  const [running, setRunning] = useState(true)
  const [A1, setA1] = useState(3)
  const [A2, setA2] = useState(0.75)
  const [speed, setSpeed] = useState(2)
  const c1 = A1 / 3
  const c2 = A2 / 3
  const tEnd = (L - 30 - X1) / c1
  const rows = Math.ceil(tEnd / SNAP) + 1
  const make = (a1 = A1, a2 = A2) => createKdv(N, L, DT, [{ c: a1 / 3, x0: X1 }, { c: a2 / 3, x0: X2 }])
  const sim = useRef<Kdv>(make())
  const img = useRef<{ cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; row: ImageData; rows: number } | null>(null)
  const nextSnap = useRef(0)
  const hist = useRef<{ t: number; x1: number; x2: number }[]>([])
  const shifts = useRef<{ t: number; d1: number; d2: number }[]>([])
  const [m, setM] = useState<Meas>({ t: 0, v1: NaN, v2: NaN, s1: NaN, s2: NaN, done: false })
  const frameN = useRef(0)

  const newImage = (nrows: number) => {
    if (typeof document === 'undefined') return
    const cv = document.createElement('canvas')
    cv.width = COLS
    cv.height = nrows
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, COLS, nrows)
    img.current = { cv, ctx, row: ctx.createImageData(COLS, 1), rows: nrows }
  }

  const restart = (a1 = A1, a2 = A2) => {
    sim.current = make(a1, a2)
    nextSnap.current = 0
    hist.current = []
    shifts.current = []
    frameN.current = 0
    newImage(Math.ceil((L - 30 - X1) / (a1 / 3) / SNAP) + 1)
    setM({ t: 0, v1: NaN, v2: NaN, s1: NaN, s2: NaN, done: false })
  }
  useEffect(() => {
    if (!img.current) newImage(rows)
  }, [rows])

  const narrowInit = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrowInit ? 1.25 : 0.62, undefined, narrowInit ? 560 : 480)

  const snapshot = () => {
    const im = img.current
    const s = sim.current
    if (!im) return
    const r = Math.round(s.t / SNAP)
    if (r >= im.rows) return
    const d = im.row.data
    const scale = 1 / (A1 * 1.02)
    for (let j = 0; j < COLS; j++) {
      const v = Math.max(s.u[2 * j], s.u[2 * j + 1])
      const [R, G, B] = colormap(Math.sqrt(Math.max(0, v * scale)))
      d[4 * j] = R
      d[4 * j + 1] = G
      d[4 * j + 2] = B
      d[4 * j + 3] = 255
    }
    im.ctx.putImageData(im.row, 0, im.rows - 1 - r)
  }

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const narrow = c.clientWidth < 560
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = (narrow ? 10 : 11) * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const padL = 34 * u
    const padR = 8 * u
    const sideW = (narrow ? 78 : 150) * u
    const mainW = W - padL - padR - sideW - 10 * u
    const top = { x: padL, y: 18 * u, w: mainW, h: H * 0.36 - 18 * u }
    const bot = { x: padL, y: H * 0.36 + 22 * u, w: mainW, h: H - H * 0.36 - 22 * u - 30 * u }
    const side = { x: padL + mainW + 10 * u, y: bot.y, w: sideW, h: bot.h }
    const s = sim.current
    const X = (x: number) => top.x + (x / L) * top.w
    // ---- profile ----
    const umax = A1 * 1.15
    const Y = (v: number) => top.y + top.h - ((v + 0.1 * umax) / (1.1 * umax)) * top.h
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    const step = A1 > 3.5 ? 2 : 1
    for (let v = 0; v <= umax; v += step) {
      ctx.beginPath()
      ctx.moveTo(top.x, Y(v))
      ctx.lineTo(top.x + top.w, Y(v))
      ctx.stroke()
      ctx.fillText(String(v), top.x - 5 * u, Y(v) + 4 * u)
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(top.x, top.y, top.w, top.h)
    // where the solitons would be with no interaction
    for (const [x0, cc, col] of [[X1, c1, COLORS.amber], [X2, c2, COLORS.magenta]] as const) {
      const xf = ((x0 + cc * s.t) % L + L) % L
      ctx.strokeStyle = col
      ctx.globalAlpha = 0.55
      ctx.setLineDash([3 * u, 4 * u])
      ctx.beginPath()
      ctx.moveTo(X(xf), top.y)
      ctx.lineTo(X(xf), top.y + top.h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
    glowStroke(ctx, COLORS.cyan, 2 * u, () => {
      for (let j = 0; j < N; j++) {
        const px = X(s.x[j])
        if (j) ctx.lineTo(px, Y(s.u[j]))
        else ctx.moveTo(px, Y(s.u[j]))
      }
    })
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    ctx.fillText(`u(x) at t = ${s.t.toFixed(1)}`, top.x, top.y - 6 * u)
    ctx.textAlign = 'right'
    ctx.fillText(narrow ? 'dashed: no collision' : 'dashed: where each would be with no collision', top.x + top.w, top.y - 6 * u)

    // ---- space–time image ----
    const im = img.current
    if (im) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(im.cv, bot.x, bot.y, bot.w, bot.h)
    }
    const tMax = (im ? im.rows - 1 : rows - 1) * SNAP
    const T = (t: number) => bot.y + bot.h - (t / tMax) * bot.h
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(bot.x, bot.y, bot.w, bot.h)
    // free paths
    ctx.save()
    ctx.beginPath()
    ctx.rect(bot.x, bot.y, bot.w, bot.h)
    ctx.clip()
    for (const [x0, cc, col] of [[X1, c1, COLORS.amber], [X2, c2, COLORS.magenta]] as const) {
      ctx.strokeStyle = col
      ctx.lineWidth = 1.2 * u
      ctx.setLineDash([5 * u, 5 * u])
      ctx.beginPath()
      ctx.moveTo(X(x0), T(0))
      ctx.lineTo(X(x0 + cc * tMax), T(tMax))
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.moveTo(bot.x, T(s.t))
    ctx.lineTo(bot.x + bot.w, T(s.t))
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    for (let x = 0; x <= L; x += narrow ? 50 : 25) ctx.fillText(String(x), X(x), bot.y + bot.h + 13 * u)
    ctx.fillText('x', bot.x + bot.w / 2, bot.y + bot.h + 26 * u)
    ctx.textAlign = 'right'
    const tStep = tMax > 150 ? 50 : 25
    for (let t = 0; t <= tMax; t += tStep) ctx.fillText(String(t), bot.x - 5 * u, T(t) + 4 * u)
    ctx.textAlign = 'left'
    ctx.fillText('space–time: t ↑', bot.x, bot.y - 6 * u)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.amber
    ctx.fillText(narrow ? 'dashed: no collision' : 'dashed: straight paths with no collision', bot.x + bot.w, bot.y - 6 * u)

    // ---- shift from the straight path vs time (same time axis) ----
    const th = phaseShifts(c1, c2)
    const d0 = Math.floor(th.slow) - 1
    const d1 = Math.ceil(th.fast) + 1
    const D = (d: number) => side.x + ((d - d0) / (d1 - d0)) * side.w
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(side.x, side.y, side.w, side.h)
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(D(0), side.y)
    ctx.lineTo(D(0), side.y + side.h)
    ctx.stroke()
    ctx.setLineDash([3 * u, 4 * u])
    for (const [d, col] of [[th.fast, COLORS.amber], [th.slow, COLORS.magenta]] as const) {
      ctx.strokeStyle = col
      ctx.beginPath()
      ctx.moveTo(D(d), side.y)
      ctx.lineTo(D(d), side.y + side.h)
      ctx.stroke()
    }
    ctx.setLineDash([])
    for (const [key, col] of [['d1', COLORS.amber], ['d2', COLORS.magenta]] as const) {
      ctx.fillStyle = col
      for (const h of shifts.current) ctx.fillRect(D(h[key]) - 1.2 * u, T(h.t) - 1.2 * u, 2.4 * u, 2.4 * u)
    }
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    for (const d of [Math.ceil(th.slow), 0, Math.floor(th.fast)]) ctx.fillText(String(d), D(d), side.y + side.h + 13 * u)
    ctx.fillText('shift', side.x + side.w / 2, side.y + side.h + 26 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    ctx.fillText(narrow ? 'shift vs t' : 'shift from straight path', side.x, side.y - 6 * u)
    if (!narrow) {
      ctx.fillStyle = COLORS.text
      ctx.fillText('dots: measured', side.x, side.y - 6 * u - fs * 1.4)
      ctx.fillText('dashed: theory', side.x, side.y - 6 * u - fs * 2.8)
    }
  }

  useAnimation(
    canvas,
    () => {
      const s = sim.current
      if (s.t < tEnd) {
        const n = 10 * speed
        for (let i = 0; i < n && s.t < tEnd; i++) {
          stepKdv(s)
          if (s.t >= nextSnap.current - 1e-9) {
            syncU(s)
            snapshot()
            nextSnap.current += SNAP
          }
        }
      }
      syncU(s)
      // measurements
      const pk = findPeaks(s, Math.min(0.4 * A2, 0.2))
      // speeds are measured only while the two peaks are well apart (a clean segment of history)
      const sep = pk.length >= 2 ? Math.abs(wrapDist(pk[0].x - pk[1].x, L)) : 0
      if (sep > 15) {
        hist.current.push({ t: s.t, x1: pk[0].x, x2: pk[1].x })
        if (hist.current.length > 200) hist.current.shift()
        const last = shifts.current[shifts.current.length - 1]
        if (!last || s.t - last.t >= 1) shifts.current.push({ t: s.t, d1: wrapDist(pk[0].x - (X1 + c1 * s.t), L), d2: wrapDist(pk[1].x - (X2 + c2 * s.t), L) })
      } else hist.current = []
      if (++frameN.current % 6 === 0) {
        const hh = hist.current
        let v1 = m.v1
        let v2 = m.v2
        const last = hh[hh.length - 1]
        if (last) {
          const old = hh.find((h) => h.t >= last.t - 8)
          if (old && last.t - old.t > 4) {
            v1 = wrapDist(last.x1 - old.x1, L) / (last.t - old.t)
            v2 = wrapDist(last.x2 - old.x2, L) / (last.t - old.t)
          }
        }
        let s1 = NaN
        let s2 = NaN
        // the collision is over once the overtaking time has passed and the peaks are well apart again
        // (use the periodic separation: the tall one can be more than L/2 ahead of the short one)
        const passed = s.t > (X2 - X1) / (c1 - c2)
        if (passed && sep > 15) {
          s1 = wrapDist(pk[0].x - (X1 + c1 * s.t), L)
          s2 = wrapDist(pk[1].x - (X2 + c2 * s.t), L)
        }
        setM({ t: s.t, v1, v2, s1, s2, done: s.t >= tEnd })
      }
      draw()
    },
    running,
  )

  const th = phaseShifts(c1, c2)
  const ok = (a: number, b: number, tol: number) => isFinite(a) && Math.abs(a / b - 1) < tol
  return (
    <SimFrame
      id="kdv-solitons"
      title="Two solitons collide (KdV)"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint="Normalized KdV, u_t + u u_x + u_xxx = 0: a soliton of height A moves at speed A/3 and has width ∝ 1/√A. The tall one catches the short one and both come out with their original shapes. If the tall one is more than about three times higher they briefly merge into a single hump; closer in height they trade places without ever merging. Watch the space–time picture: after the collision the tall track sits ahead of its dashed no-collision line and the short one behind. Make them closer in height and the interaction takes longer and the shifts grow."
    >
      <canvas ref={canvas} className="sim" aria-label="KdV two-soliton simulation" />
      <div className="readouts">
        <span>tall speed: <b className={ok(m.v1, c1, 0.03) ? 'ok' : ''}>{isFinite(m.v1) ? m.v1.toFixed(3) : '…'}</b> vs A/3 = <b>{c1.toFixed(3)}</b></span>
        <span>short speed: <b className={ok(m.v2, c2, 0.05) ? 'ok' : ''}>{isFinite(m.v2) ? m.v2.toFixed(3) : '…'}</b> vs <b>{c2.toFixed(3)}</b></span>
      </div>
      <div className="readouts">
        <span>tall jumps ahead: <b className={ok(m.s1, th.fast, 0.1) ? 'ok' : ''}>{isFinite(m.s1) ? m.s1.toFixed(2) : 'after the collision'}</b> vs theory <b>{th.fast.toFixed(2)}</b></span>
        <span>short falls back: <b className={ok(m.s2, th.slow, 0.1) ? 'ok' : ''}>{isFinite(m.s2) ? m.s2.toFixed(2) : 'after the collision'}</b> vs <b>{th.slow.toFixed(2)}</b></span>
      </div>
      <div className="controls">
        <Slider label="Height of the tall soliton" value={A1} min={2.4} max={4.5} step={0.1} onChange={(v) => { setA1(v); restart(v, A2) }} fmt={(v) => v.toFixed(1)} />
        <Slider label="Height of the short soliton" value={A2} min={0.3} max={1.2} step={0.05} onChange={(v) => { setA2(v); restart(A1, v) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Speed" value={speed} min={1} max={3} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
