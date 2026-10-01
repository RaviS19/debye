// B6: three-wave amplification. The 1D envelope equations of backscatter (pump moving right, scattered light
// moving left, plasma or ion wave at rest and damped), solved in space and time. A periodic box shows temporal
// growth at γ0; a finite slab with a seed shows convective amplification to the steady gain 2γ0²L/ν, then pump
// depletion (Tang's steady state); a noisy seed shows bursty reflectivity. Readouts check each against theory and
// the Manley–Rowe balance (one scattered quantum per destroyed pump quantum).
import { useEffect, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { fitSlope } from '../physics/parametric'
import { actions, backscatterAt0, createThreeWave, dampedGrowth, manleyRoweBalance, stepThreeWave, tangReflectivity, type ThreeWave } from '../physics/srsSbs'
import { SimFrame, Slider } from './SimFrame'

type PresetId = 'temporal' | 'amplifier' | 'depletion' | 'noise'
const PRESETS: Record<PresetId, { label: string; slab: boolean; K: number; nu: number; lseed: number; noise: boolean; speed: number }> = {
  temporal: { label: 'Temporal growth', slab: false, K: 0.05, nu: 0, lseed: -12, noise: false, speed: 2 },
  amplifier: { label: 'Convective amplifier', slab: true, K: 0.1, nu: 0.5, lseed: -10, noise: false, speed: 16 },
  depletion: { label: 'Pump depletion', slab: true, K: 0.14, nu: 0.5, lseed: -6, noise: false, speed: 16 },
  noise: { label: 'Noise seed', slab: true, K: 0.15, nu: 0.5, lseed: -8, noise: true, speed: 16 },
}
const L = 200
const NCELL = 400
const HIST = 1500
const SRS_WS = 0.644 // ω_s/ω0 for SRS backscatter at 0.1 n_c, 2 keV (B5)

export function ThreeWaveSim() {
  const [running, setRunning] = useState(true)
  const [preset, setPreset] = useState<PresetId>('amplifier')
  const [K, setK] = useState(PRESETS.amplifier.K)
  const [nu, setNu] = useState(PRESETS.amplifier.nu)
  const [lseed, setLseed] = useState(PRESETS.amplifier.lseed)
  const [speed, setSpeed] = useState(PRESETS.amplifier.speed)
  const [logScale, setLogScale] = useState(true)
  const [, setTick] = useState(0)
  const P = PRESETS[preset]
  const seed = 10 ** lseed

  const make = (id: PresetId, k: number, n: number, s: number) =>
    createThreeWave({ n: NCELL, L, K: k, nu: n, mode: PRESETS[id].slab ? 'slab' : 'periodic', seed: s, noise: PRESETS[id].noise })
  const sim = useRef<ThreeWave>(make('amplifier', K, nu, seed))
  const hist = useRef<{ t: number[]; y: number[] }>({ t: [], y: [] })
  const measured = useRef<{ gamma: number | null }>({ gamma: null })

  const restart = (id: PresetId, k: number, n: number, s: number) => {
    sim.current = make(id, k, n, s)
    hist.current = { t: [], y: [] }
    measured.current = { gamma: null }
  }
  // live parameter changes act on the running system (the slab re-settles); the seed restarts a periodic box
  useEffect(() => {
    const s = sim.current
    s.K = K
    s.nu = nu
    if (s.seed !== seed) {
      s.seed = seed
      if (s.mode === 'periodic') restart(preset, K, nu, seed)
      else if (!s.noise) {
        s.zr = Math.sqrt(seed)
        s.zi = 0
      }
    }
  }, [K, nu, seed, preset])

  const choose = (id: PresetId) => {
    const p = PRESETS[id]
    setPreset(id)
    setK(p.K)
    setNu(p.nu)
    setLseed(p.lseed)
    setSpeed(p.speed)
    setLogScale(true)
    restart(id, p.K, p.nu, 10 ** p.lseed)
    setRunning(true)
  }

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.25 : 0.6, undefined, 500)

  const theoryG = (2 * K * K * L) / Math.max(nu, 1e-9)
  const tang = P.slab ? tangReflectivity(theoryG, seed) : NaN
  const gTheory = dampedGrowth(K, nu)

  const draw = () => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = cv.width
    const H = cv.height
    const u = W / cv.clientWidth
    const small = cv.clientWidth < 560
    const s = sim.current
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    const x0 = 52 * u
    const x1 = W - 12 * u
    const split = Math.round(H * 0.56)
    // ---- top: profiles ----
    const ty0 = 22 * u
    const ty1 = split - 26 * u
    const lo = -12
    const hi = 0.5
    const Ytop = (v: number) => (logScale ? ty1 - ((Math.log10(Math.max(v, 1e-30)) - lo) / (hi - lo)) * (ty1 - ty0) : ty1 - (v / 1.2) * (ty1 - ty0))
    const X = (i: number) => x0 + ((i + 0.5) / s.n) * (x1 - x0)
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1 * u
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'right'
    const ticks = logScale ? [-12, -9, -6, -3, 0] : [0, 0.5, 1]
    for (const t of ticks) {
      const y = logScale ? Ytop(10 ** t) : Ytop(t)
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x1, y)
      ctx.stroke()
      ctx.fillText(logScale ? `1e${t}` : String(t), x0 - 5 * u, y + 4 * u)
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(x0, ty0, x1 - x0, ty1 - ty0)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, ty0, x1 - x0, ty1 - ty0)
    ctx.clip()
    const prof = (re: Float64Array, im: Float64Array, color: string) =>
      glowStroke(ctx, color, 1.8 * u, () => {
        for (let i = 0; i < s.n; i++) {
          const v = re[i] * re[i] + im[i] * im[i]
          if (i === 0) ctx.moveTo(X(i), Ytop(v))
          else ctx.lineTo(X(i), Ytop(v))
        }
      })
    prof(s.a2r, s.a2i, COLORS.magenta)
    prof(s.a1r, s.a1i, COLORS.cyan)
    prof(s.a0r, s.a0i, COLORS.amber)
    ctx.restore()
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    ctx.fillText(small ? '|a|² vs x' : logScale ? 'action density |a|² (log) vs x' : 'action density |a|² vs x', x0, ty0 - 7 * u)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.amber
    let lx = x1
    const leg = (txt: string, col: string) => {
      ctx.fillStyle = col
      ctx.fillText(txt, lx, ty0 - 7 * u)
      lx -= ctx.measureText(txt).width + 10 * u
    }
    leg('plasma wave', COLORS.magenta)
    leg(small ? '← light' : '← scattered', COLORS.cyan)
    leg('pump →', COLORS.amber)
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'left'
    ctx.fillText(s.mode === 'slab' ? (small ? 'x = 0: laser in, light out' : 'x = 0: laser in, reflected light out') : 'periodic box', x0, ty1 + 14 * u)
    ctx.textAlign = 'right'
    ctx.fillText(s.mode === 'slab' ? (s.noise ? 'x = L: noise in' : 'x = L: seed in') : '', x1, ty1 + 14 * u)

    // ---- bottom: history ----
    const by0 = split + 18 * u
    const by1 = H - 26 * u
    const { t: ht, y: hy } = hist.current
    const blo = Math.min(-12, Math.floor(lseed) - 1)
    const bhi = 0.5
    const Yb = (v: number) => by1 - ((Math.log10(Math.max(v, 1e-30)) - blo) / (bhi - blo)) * (by1 - by0)
    const tA = ht.length ? ht[0] : 0
    const tB = Math.max(ht.length ? ht[ht.length - 1] : 1, tA + 1)
    const Xt = (t: number) => x0 + ((t - tA) / (tB - tA)) * (x1 - x0)
    ctx.strokeStyle = COLORS.grid
    ctx.fillStyle = COLORS.text
    for (let e = Math.ceil(blo / 3) * 3; e <= 0; e += 3) {
      ctx.beginPath()
      ctx.moveTo(x0, Yb(10 ** e))
      ctx.lineTo(x1, Yb(10 ** e))
      ctx.stroke()
      ctx.fillText(`1e${e}`, x0 - 5 * u, Yb(10 ** e) + 4 * u)
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(x0, by0, x1 - x0, by1 - by0)
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.round(tA)}`, x0, by1 + 14 * u)
    ctx.fillText(`time ${Math.round(tB)}`, x1 - 20 * u, by1 + 14 * u)
    ctx.textAlign = 'left'
    ctx.fillText(s.mode === 'slab' ? 'reflectivity r = |a₁(0)|² vs time (log)' : 'scattered action |a₁|² vs time (log)', x0, by0 - 6 * u)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, by0, x1 - x0, by1 - by0)
    ctx.clip()
    // theory lines
    ctx.setLineDash([6 * u, 5 * u])
    ctx.lineWidth = 1.4 * u
    if (s.mode === 'slab') {
      ctx.strokeStyle = COLORS.white
      const und = seed * Math.exp(theoryG)
      ctx.beginPath()
      ctx.moveTo(x0, Yb(und))
      ctx.lineTo(x1, Yb(und))
      ctx.stroke()
      ctx.strokeStyle = COLORS.amber
      ctx.beginPath()
      ctx.moveTo(x0, Yb(tang))
      ctx.lineTo(x1, Yb(tang))
      ctx.stroke()
    } else if (ht.length > 1) {
      // theory slope through the first sample after the transient
      ctx.strokeStyle = COLORS.amber
      const t1 = 3 / Math.max(gTheory, 1e-6)
      let i1 = ht.findIndex((t) => t >= t1)
      if (i1 < 0) i1 = 0
      const y1 = hy[i1]
      ctx.beginPath()
      ctx.moveTo(Xt(ht[i1]), Yb(y1))
      const tEnd = tB
      ctx.lineTo(Xt(tEnd), Yb(y1 * Math.exp(2 * gTheory * (tEnd - ht[i1]))))
      ctx.stroke()
    }
    ctx.setLineDash([])
    if (ht.length > 1)
      glowStroke(ctx, COLORS.cyan, 1.8 * u, () => {
        for (let i = 0; i < ht.length; i++) {
          if (i === 0) ctx.moveTo(Xt(ht[i]), Yb(hy[i]))
          else ctx.lineTo(Xt(ht[i]), Yb(hy[i]))
        }
      })
    ctx.restore()
    ctx.textAlign = 'right'
    if (s.mode === 'slab') {
      ctx.fillStyle = COLORS.white
      ctx.fillText('ε·exp(G), undepleted', x1 - 6 * u, Math.max(by0 + 12 * u, Math.min(by1 - 4 * u, Yb(seed * Math.exp(theoryG)) - 5 * u)))
      ctx.fillStyle = COLORS.amber
      ctx.fillText('Tang', x1 - 6 * u, Math.max(by0 + 12 * u, Math.min(by1 - 4 * u, Yb(tang) + 14 * u)))
    } else {
      ctx.fillStyle = COLORS.amber
      ctx.fillText('theory slope 2γ', x1 - 6 * u, by0 + 14 * u)
    }
  }

  useAnimation(
    canvas,
    () => {
      if (running) {
        const s = sim.current
        stepThreeWave(s, speed)
        const y = s.mode === 'slab' ? backscatterAt0(s) : actions(s)[1] / s.L
        const h = hist.current
        h.t.push(s.t)
        h.y.push(y)
        if (h.t.length > HIST) {
          h.t.splice(0, h.t.length - HIST)
          h.y.splice(0, h.y.length - HIST)
        }
        if (s.mode === 'periodic' && y < 1e-3) {
          // linear phase: fit ln|a1|² over the samples since the transient
          const t0 = 3 / Math.max(gTheory, 1e-6)
          if (s.t > t0 + 20) {
            const ly = h.y.map(Math.log)
            const sl = fitSlope(h.t, ly, Math.max(t0, s.t - 150), s.t)
            if (sl !== null) measured.current.gamma = sl / 2
          }
        }
        setTick((k) => (k + 1) % 1_000_000)
      }
      draw()
    },
    true,
  )

  // ---- readouts ----
  const s = sim.current
  const r = s.mode === 'slab' ? backscatterAt0(s) : NaN
  const settled = s.mode === 'slab' && s.t > 6 * L
  const Gmeas = Math.log(r / seed)
  const mr = manleyRoweBalance(s)
  const mrRatio = mr.pumpLost > 1e-10 ? mr.scatMade / mr.pumpLost : NaN
  const [n0, n1, n2] = actions(s)
  const hy = hist.current.y
  const recent = hy.slice(-200)
  const rAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : NaN
  const fmt = (v: number) => (Number.isFinite(v) ? (Math.abs(v) >= 1e-3 && Math.abs(v) < 1e4 ? v.toPrecision(4) : v.toExponential(2)) : '—')
  const gm = measured.current.gamma

  return (
    <SimFrame
      id="three-wave"
      title="Three-wave amplification"
      running={running}
      setRunning={setRunning}
      onReset={() => choose(preset)}
      hint="Units: both light waves move at speed 1, the plasma wave stays put; the slab is 200 long and γ₀ (the coupling) is in inverse time units. The convective amplifier injects a weak seed at the far side: it grows as it crosses the slab and settles to a reflectivity ε·exp(G), with G = 2γ₀²L/ν measured to within a few percent. Raise γ₀ in the pump-depletion preset: the reflectivity saturates at Tang’s value instead of growing as exp(G), and the pump profile (amber) is eaten from the left. The noise preset gives the bursty reflectivity of real experiments. In every slab run, Manley–Rowe holds: each pump quantum destroyed makes one scattered quantum."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <button key={id} className={`btn small ${preset === id ? 'primary' : ''}`} onClick={() => choose(id)}>
            {PRESETS[id].label}
          </button>
        ))}
        <button className="btn small" onClick={() => setLogScale(!logScale)}>
          {logScale ? 'Linear profiles' : 'Log profiles'}
        </button>
      </div>
      <canvas ref={canvas} className="sim" aria-label="Pump, scattered light and plasma wave profiles, and reflectivity history" />
      <div className="readouts">
        {s.mode === 'periodic' ? (
          <>
            <span>
              measured growth γ = <b className={gm !== null && Math.abs(gm / gTheory - 1) < 0.03 ? 'ok' : ''}>{gm !== null ? gm.toFixed(4) : 'fitting…'}</b> vs theory −ν/2 + √(ν²/4 + γ₀²) = <b>{gTheory.toFixed(4)}</b>
            </span>
            <span>
              Manley–Rowe invariants: ⟨|a₀|² + |a₁|²⟩ = <b>{((n0 + n1) / s.L).toFixed(6)}</b>
              {nu === 0 && (
                <>
                  , ⟨|a₁|² − |a₂|²⟩ = <b>{((n1 - n2) / s.L).toExponential(2)}</b>
                </>
              )}{' '}
              (constant)
            </span>
            <span>
              pump left: <b>{fmt(n0 / s.L)}</b>, t = <b>{Math.round(s.t)}</b>
            </span>
          </>
        ) : (
          <>
            <span>
              reflectivity r = <b>{fmt(r)}</b>
              {s.noise && (
                <>
                  {' '}
                  (recent mean <b>{fmt(rAvg)}</b>)
                </>
              )}
              , t = <b>{Math.round(s.t)}</b> {settled ? '(steady)' : '(settling…)'}
            </span>
            {!s.noise && (
              <span>
                measured gain ln(r/ε) = <b className={settled && Math.abs(Gmeas / theoryG - 1) < 0.05 ? 'ok' : ''}>{fmt(Gmeas)}</b> vs 2γ₀²L/ν = <b>{theoryG.toFixed(3)}</b> (undepleted)
              </span>
            )}
            <span>
              Tang (pump depletion): r = <b className={!s.noise && settled && Math.abs(r / tang - 1) < 0.05 ? 'ok' : ''}>{fmt(tang)}</b>; undepleted ε·exp(G) = <b>{fmt(seed * Math.exp(theoryG))}</b>
            </span>
            <span>
              Manley–Rowe: scattered quanta made / pump quanta lost = <b className={Number.isFinite(mrRatio) && Math.abs(mrRatio - 1) < 1e-3 ? 'ok' : ''}>{Number.isFinite(mrRatio) ? mrRatio.toFixed(5) : '—'}</b>
            </span>
            <span>
              energy reflectivity if this is SRS at 0.1 n_c: <b>{fmt(SRS_WS * (s.noise ? rAvg : r))}</b> (ω_s/ω₀ = {SRS_WS}); for SBS ≈ r
            </span>
          </>
        )}
      </div>
      <div className="controls">
        <Slider label="Growth rate γ₀ (coupling)" value={K} min={0.02} max={0.2} step={0.005} onChange={setK} fmt={(v) => v.toFixed(3)} />
        <Slider label="Plasma-wave damping ν" value={nu} min={0} max={1} step={0.01} onChange={setNu} fmt={(v) => v.toFixed(2)} />
        <Slider label="Seed level ε" value={lseed} min={-14} max={-3} step={0.5} onChange={setLseed} fmt={(v) => `1e${v}`} />
        <Slider label="Speed (steps per frame)" value={speed} min={1} max={40} step={1} onChange={setSpeed} fmt={(v) => String(v)} />
      </div>
    </SimFrame>
  )
}
