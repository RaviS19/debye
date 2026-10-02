// B7: where two-plasmon decay grows. The plane of plasmon wavevectors k1 = (k∥, k⊥), in units of the laser k0, with
// k⊥ along the laser polarization. Colour: the homogeneous growth rate γ/(k0 v_os/4). Dashed: the hyperbola of maximum
// growth. Violet circles: where in density each pair is resonant (Bohm–Gross matching at the chosen T_e). Grey wash:
// pairs whose plasmons have kλ_De > 0.3 and are Landau damped. Tap (or let it play) to pick a decay and see the
// matching triangle k0 = k1 + k2.
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { hyperbolaKperp, tpdGrowth, tpdMatch } from '../physics/tpd'
import { SimFrame, Slider } from './SimFrame'

const KP0 = -1.6
const KP1 = 2.6
const KQ = 2.1 // k⊥ from −KQ to KQ
const G = 168 // heat-map grid
const LANDAU = 0.3
const DENS = [0.245, 0.24, 0.23, 0.22, 0.2]

function buildMap(T: number) {
  const img = new Uint8ClampedArray(G * G * 4)
  for (let j = 0; j < G; j++) {
    const kq = KQ - ((j + 0.5) * 2 * KQ) / G
    for (let i = 0; i < G; i++) {
      const kp = KP0 + ((i + 0.5) * (KP1 - KP0)) / G
      const g = tpdGrowth(kp, kq) / 0.25
      const m = tpdMatch(kp, kq, T)
      const damped = !m || Math.max(m.k1lD, m.k2lD) > LANDAU
      // dark navy → deep blue → cyan → white
      const t = Math.pow(g, 1.3)
      let r = 3 + t * 30
      let gg = 7 + t * 190
      let b = 16 + t * 222
      if (t > 0.9) {
        const f = (t - 0.9) / 0.1
        r += f * 180
        gg += f * 58
        b += f * 17
      }
      if (damped) {
        r = r * 0.35 + 40
        gg = gg * 0.35 + 42
        b = b * 0.35 + 52
      }
      const p = (j * G + i) * 4
      img[p] = r
      img[p + 1] = gg
      img[p + 2] = b
      img[p + 3] = 255
    }
  }
  return img
}

/** Contour of matched density n (units n_c): points on rays from (½, 0), where n falls monotonically outward. */
function densityContour(n: number, T: number) {
  const pts: [number, number][] = []
  for (let a = 0; a <= 360; a += 4) {
    const th = (a * Math.PI) / 180
    const at = (rho: number) => tpdMatch(0.5 + rho * Math.cos(th), rho * Math.sin(th), T)
    let lo = 0
    let hi = 4
    const m0 = at(lo)
    if (!m0 || m0.n < n) continue
    for (let k = 0; k < 40; k++) {
      const mid = 0.5 * (lo + hi)
      const m = at(mid)
      if (m && m.n > n) lo = mid
      else hi = mid
    }
    pts.push([0.5 + lo * Math.cos(th), lo * Math.sin(th)])
  }
  return pts
}

export function TpdMapSim() {
  const [running, setRunning] = useState(true)
  const [T, setT] = useState(2)
  const [pt, setPtState] = useState<[number, number]>([1.6, hyperbolaKperp(1.6)])
  const ptRef = useRef(pt)
  const setPt = (p: [number, number]) => {
    ptRef.current = p
    setPtState(p)
  }
  const phase = useRef(0)
  const off = useRef<HTMLCanvasElement | null>(null)
  const map = useMemo(() => buildMap(T), [T])
  const contours = useMemo(() => DENS.map((n) => ({ n, pts: densityContour(n, T) })), [T])
  const mapDirty = useRef(true)
  const lastMap = useRef<Uint8ClampedArray | null>(null)
  if (lastMap.current !== map) {
    lastMap.current = map
    mapDirty.current = true
  }

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.02 : 0.62, () => draw(), narrow ? 520 : 460)

  const geom = () => {
    const c = canvas.current!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const pad = 30 * u
    // one scale for both axes so the circles stay circles
    const s = Math.min((W - 2 * pad - (narrow ? 0 : 150 * u)) / (KP1 - KP0), (H - 2 * pad) / (2 * KQ))
    const w = s * (KP1 - KP0)
    const h = s * 2 * KQ
    const x0 = pad + (narrow ? (W - 2 * pad - w) / 2 : 0)
    const y0 = (H - h) / 2
    return { W, H, u, s, x0, y0, w, h, X: (kp: number) => x0 + (kp - KP0) * s, Y: (kq: number) => y0 + (KQ - kq) * s }
  }

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const { W, H, u, x0, y0, w, h, X, Y } = geom()
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    if (!off.current) {
      off.current = document.createElement('canvas')
      off.current.width = G
      off.current.height = G
    }
    if (mapDirty.current) {
      const ictx = off.current.getContext('2d')!
      const id = ictx.createImageData(G, G)
      id.data.set(map)
      ictx.putImageData(id, 0, 0)
      mapDirty.current = false
    }
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off.current, x0, y0, w, h)
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = u
    ctx.strokeRect(x0, y0, w, h)
    // axes through the origin and through k0
    ctx.strokeStyle = 'rgba(232,234,246,0.25)'
    ctx.beginPath()
    ctx.moveTo(X(KP0), Y(0))
    ctx.lineTo(X(KP1), Y(0))
    ctx.moveTo(X(0), Y(KQ))
    ctx.lineTo(X(0), Y(-KQ))
    ctx.stroke()
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    for (const k of [-1, 0, 1, 2]) ctx.fillText(String(k), X(k), y0 + h + 13 * u)
    ctx.fillText('k∥/k₀ (along the laser)', x0 + w / 2, y0 + h + 25 * u)
    ctx.textAlign = 'right'
    for (const k of [-2, -1, 1, 2]) ctx.fillText(String(k), x0 - 4 * u, Y(k) + 4 * u)
    ctx.save()
    ctx.translate(x0 - 18 * u, y0 + h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('k⊥/k₀ (along E)', 0, 0)
    ctx.restore()
    // density contours
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, w, h)
    ctx.clip()
    for (const { n, pts } of contours) {
      ctx.strokeStyle = 'rgba(160,111,214,0.85)'
      ctx.lineWidth = 1.2 * u
      ctx.beginPath()
      pts.forEach(([a, b], i) => (i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))))
      ctx.closePath()
      ctx.stroke()
      if (pts.length) {
        const top = pts.reduce((best, p) => (p[1] > best[1] ? p : best), pts[0])
        ctx.fillStyle = COLORS.violet
        ctx.textAlign = 'center'
        ctx.fillText(`${n}`, X(top[0]), Y(top[1]) - 3 * u)
      }
    }
    // hyperbola of maximum growth
    ctx.setLineDash([6 * u, 4 * u])
    ctx.strokeStyle = COLORS.amber
    ctx.lineWidth = 1.6 * u
    for (const sgn of [1, -1]) {
      for (const [a, b] of [[1, KP1], [KP0, 0]]) {
        ctx.beginPath()
        let first = true
        for (let k = 0; k <= 120; k++) {
          const kp = a + ((b - a) * k) / 120
          const kq = sgn * hyperbolaKperp(kp)
          if (!isFinite(kq)) continue
          if (first) ctx.moveTo(X(kp), Y(kq))
          else ctx.lineTo(X(kp), Y(kq))
          first = false
        }
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
    ctx.restore()
    // matching triangle k0 = k1 + k2
    const arrow = (xa: number, ya: number, xb: number, yb: number, col: string) => {
      glowStroke(ctx, col, 2.2 * u, () => {
        ctx.moveTo(xa, ya)
        ctx.lineTo(xb, yb)
      })
      const a = Math.atan2(yb - ya, xb - xa)
      const hd = 9 * u
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(xb, yb)
      ctx.lineTo(xb - hd * Math.cos(a - 0.4), yb - hd * Math.sin(a - 0.4))
      ctx.lineTo(xb - hd * Math.cos(a + 0.4), yb - hd * Math.sin(a + 0.4))
      ctx.closePath()
      ctx.fill()
    }
    const [kp, kq] = ptRef.current
    arrow(X(0), Y(0), X(1), Y(0), COLORS.amber)
    arrow(X(0), Y(0), X(kp), Y(kq), COLORS.cyan)
    arrow(X(kp), Y(kq), X(1), Y(0), COLORS.magenta)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(X(kp), Y(kq), 4 * u, 0, 7)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.amber
    ctx.fillText('k₀', X(0.5) - 6 * u, Y(0) + 14 * u)
    ctx.fillStyle = COLORS.cyan
    ctx.fillText('k₁', X(kp / 2) + 6 * u, Y(kq / 2) - 4 * u)
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('k₂', X((kp + 1) / 2) + 6 * u, Y(kq / 2) + 12 * u)
    // legend
    const lx = narrow ? x0 + 6 * u : x0 + w + 14 * u
    let ly = narrow ? y0 + 14 * u : y0 + 14 * u
    const line = (txt: string, col: string) => {
      ctx.fillStyle = col
      ctx.fillText(txt, lx, ly)
      ly += 16 * u
    }
    if (!narrow) {
      line('colour: γ/(k₀v_os/4)', COLORS.white)
      line('dashed: maximum growth', COLORS.amber)
      line('violet: matched n/n_c', COLORS.violet)
      line(`grey: kλ_De > ${LANDAU}`, '#9aa0b8')
      line('(Landau damped)', '#9aa0b8')
    }
  }

  const pick = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const { X: _x, u, x0, y0, s } = geom()
    void _x
    const px = (ev.clientX - rect.left) * u
    const py = (ev.clientY - rect.top) * u
    const kp = KP0 + (px - x0) / s
    const kq = KQ - (py - y0) / s
    if (kp < KP0 || kp > KP1 || kq < -KQ || kq > KQ) return
    setRunning(false)
    setPt([kp, kq])
  }

  useAnimation(
    canvas,
    (dt) => {
      // travel along the hyperbola: k∥ = ½ ± ½cosh τ, k⊥ = ½ sinh τ
      phase.current += dt * 0.00035
      const p = phase.current % 4
      const branch = p < 2 ? 1 : -1
      const q = p % 2
      const tau = 2.1 * Math.sin(Math.PI * (q - 0.5))
      const kp = 0.5 + branch * 0.5 * Math.cosh(tau)
      const kq = 0.5 * Math.sinh(tau)
      if (kp > KP0 && kp < KP1) setPt([kp, kq])
      draw()
    },
    running,
  )
  // redraw when paused and something changed
  useEffect(() => {
    if (!running) draw()
  })

  const m = tpdMatch(pt[0], pt[1], T)
  const g = tpdGrowth(pt[0], pt[1]) / 0.25
  const damped = !m || Math.max(m.k1lD, m.k2lD) > LANDAU
  return (
    <SimFrame
      id="tpd-map"
      title="Two-plasmon decay in k-space"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setT(2)
        setPt([1.6, hyperbolaKperp(1.6)])
        phase.current = 0
        setRunning(true)
      }}
      hint="Each point is one plasmon k₁; its partner is k₂ = k₀ − k₁ (magenta), so the arrows always close the triangle k₀ = k₁ + k₂. Tap anywhere to choose a decay. Growth is zero along the laser axis and peaks (γ = k₀v_os/4) on the whole dashed hyperbola, so the matching circle picks out where on it the decay happens: pairs with small k sit just below n_c/4, larger ones lower down. Raise T_e and the circles spread out while the grey Landau-damped region closes in: hot plasma confines TPD to a thin layer just below quarter-critical."
    >
      <canvas ref={canvas} className="sim" aria-label="Two-plasmon decay growth rate in wavevector space" onPointerDown={pick} onPointerMove={(e) => e.buttons && pick(e)} style={{ touchAction: 'none' }} />
      {narrow && (
        <p className="small dim" style={{ margin: '6px 0 0' }}>
          Colour: γ/(k₀v_os/4). Amber dashed: maximum growth. Violet: matched density n/n_c. Grey: kλ_De &gt; {LANDAU}, Landau damped.
        </p>
      )}
      <div className="readouts">
        <span>γ/(k₀v_os/4) = <b className={g > 0.98 ? 'ok' : ''}>{g.toFixed(3)}</b></span>
        {m ? (
          <>
            <span>resonant at n/n_c = <b>{m.n.toFixed(4)}</b></span>
            <span>ω₁/ω₀ = <b>{m.w1.toFixed(4)}</b>, ω₂/ω₀ = <b>{m.w2.toFixed(4)}</b> (sum <b className="ok">{(m.w1 + m.w2).toFixed(4)}</b>)</span>
            <span>k₁λ_De = <b>{m.k1lD.toFixed(3)}</b>, k₂λ_De = <b>{m.k2lD.toFixed(3)}</b>{damped ? ' (Landau damped)' : ''}</span>
            <span>3ω₀/2 light from ω₀ + ω₁ = <b>{(1 + m.w1).toFixed(4)} ω₀</b></span>
          </>
        ) : (
          <span>no resonant density: these plasmons are too short to be matched at this T_e</span>
        )}
      </div>
      <div className="controls">
        <Slider label="Electron temperature" value={T} min={0.5} max={5} step={0.1} onChange={setT} fmt={(v) => `${v.toFixed(1)} keV`} />
      </div>
    </SimFrame>
  )
}
