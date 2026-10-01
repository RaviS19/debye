// B5: wave-matching triangle builder. Pick a three-wave process, the plasma and the direction of the first
// daughter; the matching conditions ω0 = ω1 + ω2, k0 = k1 + k2 are solved exactly with the fluid dispersion
// relations. Left: the k-vector triangle (with the locus of all matched k1). Right: the ω–k∥ diagram, where the
// pump point is the vector sum of the two daughter points, and the graphical construction (daughter 2's curve
// hung from the pump point) crosses daughter 1's curve at the solution. Play sweeps the angle.
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { kLambdaDe, mag, normalize, omegaOf, PROCESS_WAVES, solveMatching, type Norm, type Process, type WaveKind } from '../physics/parametric'
import { SimFrame, Slider } from './SimFrame'

const LABEL: Record<WaveKind, string> = { light: 'scattered light', epw: 'plasma wave', iaw: 'ion acoustic wave' }
const SHORT: Record<WaveKind, string> = { light: 'light', epw: 'EPW', iaw: 'IAW' }
const PROCS: { id: Process; label: string; nn: number; th: number }[] = [
  { id: 'SRS', label: 'SRS', nn: 0.1, th: 180 },
  { id: 'SBS', label: 'SBS', nn: 0.3, th: 180 },
  { id: 'TPD', label: 'Two-plasmon decay', nn: 0.23, th: 45 },
  { id: 'IAD', label: 'Ion-acoustic decay', nn: 0.9, th: 0 },
]
const WHERE: Record<Process, string> = {
  SRS: 'needs n ≤ n_c/4 (each daughter needs at least ω_pe, so ω0 ≥ 2ω_pe)',
  SBS: 'anywhere the light propagates, n < n_c',
  TPD: 'only just below n_c/4 (two plasma waves of about ω0/2 each)',
  IAD: 'only just below n_c (a plasma wave of nearly ω0 plus a slow ion wave)',
}

export function MatchingTriangleSim() {
  const [running, setRunning] = useState(false)
  const [proc, setProc] = useState<Process>('SRS')
  const [nn, setNn] = useState(0.1)
  const [lTe, setLTe] = useState(Math.log10(2))
  const [lTi, setLTi] = useState(0)
  const [Z, setZ] = useState(3.5)
  const [A, setA] = useState(6.5)
  const [lam, setLam] = useState(0.351)
  const [th, setTh] = useState(180)
  const dir = useRef(-1)
  const TeKeV = 10 ** lTe
  const TiKeV = 10 ** lTi

  const N: Norm = useMemo(() => normalize({ nn, TeKeV, TiKeV, Z, A }), [nn, TeKeV, TiKeV, Z, A])
  const m = useMemo(() => solveMatching(proc, N, (th * Math.PI) / 180), [proc, N, th])
  // locus of every matched k1 (all directions), for the k-space panel
  const locus = useMemo(() => {
    const pts: [number, number][] = []
    for (let d = 0; d <= 180; d += 3) {
      const s = solveMatching(proc, N, (d * Math.PI) / 180, 300)
      if (s) pts.push(s.k1)
    }
    return pts
  }, [proc, N])

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.45 : 0.5)

  const choose = (p: (typeof PROCS)[number]) => {
    setProc(p.id)
    setNn(p.nn)
    setTh(p.th)
  }

  const draw = () => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width
    const H = cv.height
    const u = W / cv.clientWidth
    const stacked = cv.clientWidth < 560
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const fs = 11 * u
    ctx.font = `${fs}px "PT Sans", sans-serif`
    const kinds = PROCESS_WAVES[proc]
    const col1 = COLORS.cyan
    const col2 = COLORS.magenta
    const colP = COLORS.amber
    const k0 = Math.sqrt(1 - nn)

    // ---------- panel 1: k-space ----------
    const p1 = stacked ? { x: 0, y: 0, w: W, h: H * 0.47 } : { x: 0, y: 0, w: W * 0.46, h: H }
    const pts: [number, number][] = [[0, 0], [k0, 0], ...locus.map(([x, y]) => [x, y] as [number, number]), ...locus.map(([x, y]) => [x, -y] as [number, number])]
    if (m) pts.push(m.k1)
    let xmin = Infinity
    let xmax = -Infinity
    let ymax = 0
    for (const [x, y] of pts) {
      xmin = Math.min(xmin, x)
      xmax = Math.max(xmax, x)
      ymax = Math.max(ymax, Math.abs(y))
    }
    const padK = 24 * u
    const top = p1.y + 22 * u
    const scale = Math.min((p1.w - 2 * padK) / Math.max(xmax - xmin, 1e-6), (p1.h - (top - p1.y) - 2 * padK) / Math.max(2 * ymax, 0.25 * (xmax - xmin), 1e-6))
    const cx = p1.x + padK + (-xmin) * scale + (p1.w - 2 * padK - (xmax - xmin) * scale) / 2
    const cy = top + (p1.h - (top - p1.y)) / 2
    const KX = (x: number) => cx + x * scale
    const KY = (y: number) => cy - y * scale
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.beginPath()
    ctx.moveTo(p1.x + 6 * u, cy)
    ctx.lineTo(p1.x + p1.w - 6 * u, cy)
    ctx.stroke()
    // locus
    if (locus.length > 1) {
      ctx.setLineDash([3 * u, 4 * u])
      ctx.strokeStyle = 'rgba(34,211,238,0.45)'
      for (const s of [1, -1]) {
        ctx.beginPath()
        locus.forEach(([x, y], i) => (i ? ctx.lineTo(KX(x), KY(s * y)) : ctx.moveTo(KX(x), KY(s * y))))
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
    const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, w = 2.2) => {
      glowStroke(ctx, color, w * u, () => {
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
      })
      const a = Math.atan2(y2 - y1, x2 - x1)
      const h = 9 * u
      if (Math.hypot(x2 - x1, y2 - y1) < h) return
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - h * Math.cos(a - 0.4), y2 - h * Math.sin(a - 0.4))
      ctx.lineTo(x2 - h * Math.cos(a + 0.4), y2 - h * Math.sin(a + 0.4))
      ctx.closePath()
      ctx.fill()
    }
    arrow(KX(0), KY(0), KX(k0), KY(0), colP, 2.6)
    if (m) {
      arrow(KX(0), KY(0), KX(m.k1[0]), KY(m.k1[1]), col1)
      arrow(KX(m.k1[0]), KY(m.k1[1]), KX(k0), KY(0), col2)
      // angle arc
      const r = 22 * u
      ctx.strokeStyle = 'rgba(232,234,246,0.5)'
      ctx.beginPath()
      ctx.arc(KX(0), KY(0), r, -Math.atan2(m.k1[1], m.k1[0]), 0, false)
      ctx.stroke()
    }
    ctx.fillStyle = colP
    ctx.textAlign = 'center'
    ctx.fillText('k₀ (laser)', KX(k0 / 2), KY(0) + 15 * u)
    if (m) {
      const lab = (txt: string, x: number, y: number, color: string) => {
        ctx.fillStyle = color
        ctx.fillText(txt, Math.min(p1.x + p1.w - 40 * u, Math.max(p1.x + 40 * u, x)), Math.min(p1.y + p1.h - 4 * u, Math.max(top + 10 * u, y)))
      }
      const off = m.k1[1] >= 0 ? -10 * u : 16 * u
      lab(`k₁ (${SHORT[kinds[0]]})`, KX(m.k1[0] / 2), KY(m.k1[1] / 2) + off, col1)
      lab(`k₂ (${SHORT[kinds[1]]})`, KX((m.k1[0] + k0) / 2) + 12 * u, KY(m.k1[1] / 2) + off, col2)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    ctx.fillText('wavevectors: k₀ = k₁ + k₂', p1.x + 8 * u, p1.y + 14 * u)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    ctx.fillText('dashed: all matched k₁', p1.x + p1.w - 6 * u, p1.y + 14 * u)
    ctx.textAlign = 'left'

    // ---------- panel 2: ω–k∥ ----------
    const p2 = stacked ? { x: 0, y: H * 0.5, w: W, h: H * 0.5 } : { x: W * 0.49, y: 0, w: W * 0.51, h: H }
    const gx0 = p2.x + 34 * u
    const gx1 = p2.x + p2.w - 8 * u
    const gy0 = p2.y + 24 * u
    const gy1 = p2.y + p2.h - 22 * u
    const kp = m ? Math.abs(m.k1[1]) : 0
    const X = 1.15 * Math.max(k0, m ? Math.abs(m.k1[0]) : 0, m ? Math.abs(m.k2[0]) : 0, 0.3)
    const wTop = 1.15
    const PX = (k: number) => gx0 + ((k + X) / (2 * X)) * (gx1 - gx0)
    const PY = (w: number) => gy1 - (w / wTop) * (gy1 - gy0)
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(PX(0), gy0)
    ctx.lineTo(PX(0), gy1)
    for (const w of [0.5, 1]) {
      ctx.moveTo(gx0, PY(w))
      ctx.lineTo(gx1, PY(w))
    }
    ctx.stroke()
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    for (const w of [0, 0.5, 1]) ctx.fillText(String(w), gx0 - 4 * u, PY(w) + 4 * u)
    ctx.textAlign = 'center'
    ctx.fillText('0', PX(0), gy1 + 15 * u)
    ctx.textAlign = 'right'
    ctx.fillText(stacked ? 'k∥ →' : 'k∥ (along the laser) →', gx1, gy1 + 15 * u)
    ctx.save()
    ctx.beginPath()
    ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    ctx.clip()
    // ω_pe line
    ctx.setLineDash([2 * u, 4 * u])
    ctx.strokeStyle = 'rgba(154,160,201,0.6)'
    ctx.beginPath()
    ctx.moveTo(gx0, PY(Math.sqrt(nn)))
    ctx.lineTo(gx1, PY(Math.sqrt(nn)))
    ctx.stroke()
    ctx.setLineDash([])
    const curve = (fn: (k: number) => number, color: string, width: number, dash?: number[]) => {
      const path = () => {
        let on = false
        for (let i = 0; i <= 240; i++) {
          const k = -X + (2 * X * i) / 240
          const w = fn(k)
          if (!isFinite(w)) {
            on = false
            continue
          }
          if (on) ctx.lineTo(PX(k), PY(w))
          else ctx.moveTo(PX(k), PY(w))
          on = true
        }
      }
      if (dash) {
        ctx.setLineDash(dash.map((d) => d * u))
        ctx.strokeStyle = color
        ctx.lineWidth = width * u
        ctx.beginPath()
        path()
        ctx.stroke()
        ctx.setLineDash([])
      } else glowStroke(ctx, color, width * u, path)
    }
    const om = (kind: WaveKind, kpar: number) => omegaOf(kind, Math.hypot(kpar, kp), N)
    curve((k) => omegaOf('light', Math.abs(k), N), colP, 1.2, [6, 5])
    curve((k) => om(kinds[0], k), col1, 1.6)
    curve((k) => om(kinds[1], k), col2, 1.6)
    curve((k) => 1 - om(kinds[1], k0 - k), col2, 1.3, [5, 4])
    if (m) {
      const P: [number, number] = [PX(k0), PY(1)]
      const D1: [number, number] = [PX(m.k1[0]), PY(m.w1)]
      const D2: [number, number] = [PX(m.k2[0]), PY(m.w2)]
      ctx.setLineDash([3 * u, 3 * u])
      ctx.strokeStyle = 'rgba(244,114,182,0.6)'
      ctx.lineWidth = u
      ctx.beginPath()
      ctx.moveTo(PX(0), PY(0))
      ctx.lineTo(...D2)
      ctx.lineTo(...P)
      ctx.stroke()
      ctx.setLineDash([])
      arrow(PX(0), PY(0), D1[0], D1[1], col1, 1.6)
      arrow(D1[0], D1[1], P[0], P[1], col2, 1.6)
      for (const [pt, color] of [
        [P, colP],
        [D1, col1],
        [D2, col2],
      ] as [[number, number], string][]) {
        ctx.fillStyle = '#fff'
        ctx.shadowColor = color
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(pt[0], pt[1], 4 * u, 0, 7)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }
    ctx.restore()
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.white
    ctx.fillText('ω/ω₀ vs k∥: pump = daughter 1 + daughter 2', p2.x + 8 * u, p2.y + 14 * u)
    ctx.fillStyle = 'rgba(154,160,201,0.9)'
    ctx.fillText('ω_pe', gx0 + 4 * u, PY(Math.sqrt(nn)) - 4 * u)
    if (!m) {
      ctx.fillStyle = COLORS.red
      ctx.textAlign = 'center'
      ctx.font = `${13 * u}px "PT Sans", sans-serif`
      ctx.fillText('no matched daughters here', (gx0 + gx1) / 2, (gy0 + gy1) / 2)
      ctx.fillText('no matched daughters here', p1.x + p1.w / 2, cy - 30 * u)
      ctx.textAlign = 'left'
    }
  }

  useAnimation(
    canvas,
    () => {
      if (running) {
        let t = th + dir.current * 0.6
        if (t <= 0 || t >= 180) {
          dir.current *= -1
          t = Math.max(0, Math.min(180, t))
        }
        setTh(Math.round(t * 10) / 10)
      }
      draw()
    },
    true,
  )

  const kinds = PROCESS_WAVES[proc]
  const k1 = m ? mag(m.k1) : NaN
  const k2 = m ? mag(m.k2) : NaN
  const lamNm = lam * 1000
  const klds: [string, number][] = []
  if (m) {
    if (kinds[0] === 'epw') klds.push(['daughter 1', kLambdaDe(k1, N)])
    if (kinds[1] === 'epw') klds.push([kinds[0] === 'epw' ? 'daughter 2' : 'plasma wave', kLambdaDe(k2, N)])
  }
  // simple estimates for comparison
  const est = (() => {
    const wp = Math.sqrt(nn)
    if (proc === 'SRS') return { label: 'cold estimate λ₀/(1 − √(n/n_c))', value: `${(lamNm / (1 - wp)).toFixed(1)} nm` }
    if (proc === 'SBS') {
      const kia = 2 * Math.sqrt(1 - nn) * Math.abs(Math.sin((th * Math.PI) / 360))
      return { label: 'estimate Δλ ≈ λ₀ k c_s/ω₀, k ≈ 2k₀ sin(θ/2)', value: `${(lamNm * kia * N.cs).toFixed(2)} nm` }
    }
    if (proc === 'TPD') return { label: 'cold estimate ω₁ ≈ ω₂ ≈ ω₀/2', value: '0.5, 0.5' }
    return { label: 'cold estimate ω₁ ≈ ω_pe', value: wp.toFixed(4) }
  })()
  const allowed = !!m

  return (
    <SimFrame
      id="matching-triangle"
      title="Wave-matching triangle builder"
      running={running}
      setRunning={setRunning}
      onReset={() => {
        setRunning(false)
        setLTe(Math.log10(2))
        setLTi(0)
        setZ(3.5)
        setA(6.5)
        setLam(0.351)
        choose(PROCS.find((p) => p.id === proc)!)
      }}
      hint="Units: ω₀ = 1 and c = 1, so k is in units of the vacuum laser wavenumber. Play sweeps the direction of daughter 1 between forward (0°) and backward (180°). For SRS, watch the plasma wave’s k (the magenta arrow) grow as the light scatters further back, and the scattered wavelength shift. Raise n/n_c past about 0.245 and SRS has no solution at all. Switch to SBS: the triangle is almost isosceles, because the ion wave takes almost no energy and the light bounces back with nearly its own wavelength."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {PROCS.map((p) => (
          <button key={p.id} className={`btn small ${proc === p.id ? 'primary' : ''}`} onClick={() => choose(p)}>
            {p.label}
          </button>
        ))}
      </div>
      <canvas ref={canvas} className="sim" aria-label="Wave-matching triangle and ω–k diagram" />
      <div className="readouts">
        {m ? (
          <>
            <span>
              ω₁/ω₀ = <b>{m.w1.toFixed(4)}</b> ({LABEL[kinds[0]]}), ω₂/ω₀ = <b>{m.w2.toPrecision(4)}</b> ({LABEL[kinds[1]]})
            </span>
            {kinds[0] === 'light' && (
              <span>
                scattered light: <b className="ok">{(lamNm / m.w1).toFixed(proc === 'SBS' ? 2 : 1)} nm</b>
                {proc === 'SBS' && <> (shift <b>{(lamNm / m.w1 - lamNm).toFixed(2)} nm</b>)</>}
              </span>
            )}
            <span>
              {est.label}: <b>{est.value}</b>
            </span>
            {klds.map(([who, v]) => (
              <span key={who}>
                kλ_De ({who}) = <b style={v > 0.3 ? { color: 'var(--amber)' } : undefined}>{v.toFixed(3)}</b>
                {v > 0.3 ? ' — strongly Landau damped' : ' (weakly damped)'}
              </span>
            ))}
            <span>
              energy split (Manley–Rowe): <b>{(100 * m.w1).toFixed(1)}%</b> : <b>{(100 * m.w2).toPrecision(3)}%</b>
            </span>
            <span>
              |k₁| = <b>{k1.toFixed(3)}</b>, |k₂| = <b>{k2.toFixed(3)}</b>, k₀ = <b>{m.k0.toFixed(3)}</b>
            </span>
          </>
        ) : (
          <span>
            <b style={{ color: 'var(--red)' }}>Not allowed here.</b> The matching conditions have no solution at this density and angle.
          </span>
        )}
        <span>
          {proc} {WHERE[proc]}: <b className={allowed ? 'ok' : ''}>{allowed ? 'matched' : 'no'}</b>
        </span>
      </div>
      <div className="controls">
        <Slider label="Density n/n_c" value={nn} min={0.005} max={0.99} step={0.005} onChange={setNn} fmt={(v) => v.toFixed(3)} />
        <Slider label={`Direction of daughter 1 (${SHORT[kinds[0]]})`} value={th} min={0} max={180} step={1} onChange={(v) => { setRunning(false); setTh(v) }} fmt={(v) => `${Math.round(v)}°`} />
        <Slider label="Electron temperature T_e" value={lTe} min={-1} max={1} step={0.01} onChange={setLTe} fmt={(v) => `${(10 ** v).toPrecision(2)} keV`} />
        <Slider label="Ion temperature T_i" value={lTi} min={-1.5} max={1} step={0.01} onChange={setLTi} fmt={(v) => `${(10 ** v).toPrecision(2)} keV`} />
        <Slider label="Ion charge Z" value={Z} min={1} max={60} step={0.5} onChange={setZ} />
        <Slider label="Ion mass number A" value={A} min={1} max={200} step={0.5} onChange={setA} />
      </div>
      <div className="row" style={{ marginTop: 10, gap: 6 }}>
        <span className="small dim">Laser:</span>
        {[0.351, 0.527, 1.053].map((l) => (
          <button key={l} className={`btn small ${lam === l ? 'primary' : ''}`} onClick={() => setLam(l)}>
            {Math.round(l * 1000)} nm
          </button>
        ))}
        <span className="small dim">CH plastic is Z = 3.5, A = 6.5 (averages); hydrogen 1, 1; gold about 50, 197.</span>
      </div>
    </SimFrame>
  )
}

