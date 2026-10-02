// B8: surfing an electron plasma wave. Test electrons from a Maxwellian in a prescribed wave φ = φ0 cos(kx − ωt),
// periodic over one wavelength (two are drawn). Top: phase space (x, v) in the lab frame with the separatrix of the
// moving wells. Bottom: the distribution of forward-moving electrons against energy on a log scale, with the energy
// range of the trapping band shaded. Normalized units: v_te = √(kT_e/m) = 1, k = 1 (wavelength 2π), time in 1/(k v_te).
import { useMemo, useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import {
  bounceFrequency,
  createSurf,
  hamiltonian,
  loadWindow,
  maxTrappedVelocity,
  stepOrbit,
  stepSurf,
  trapHalfWidth,
  trappedFraction,
  type Surf,
} from '../physics/hotElectrons'
import { SimFrame, Slider } from './SimFrame'

const NP = 5000
const DT = 0.05
const NB = 140 // histogram bins over the loading window
const TWO_PI = 2 * Math.PI

type Preset = 'small' | 'trap' | 'fast'
const PRESETS: Record<Preset, { label: string; vph: number; Phi: number }> = {
  small: { label: 'Small wave', vph: 3, Phi: 0.05 },
  trap: { label: 'Trapping the tail', vph: 3.5, Phi: 1 },
  fast: { label: 'Fast, strong wave', vph: 6, Phi: 4 },
}

// colour groups by initial velocity relative to the trapping band
const GROUPS = [
  { name: 'below the band', col: [34, 211, 238] },
  { name: 'trapped, started slower than the wave', col: [244, 114, 182] },
  { name: 'trapped, started faster than the wave', col: [251, 191, 36] },
  { name: 'above the band', col: [160, 111, 214] },
] as const

interface World {
  s: Surf
  buckets: Int32Array[] // particle indices by (group, alpha level)
  alphas: number[]
  tag: { xi: number; u: number }
  tagPrev: number
  cross: number[]
  vmax: number
  trapped: number
  hist: Float64Array
}

function makeWorld(vph: number, Phi: number): World {
  const s = createSurf({ n: NP, vph, Phi, seed: 99 })
  const half = trapHalfWidth(Phi)
  const lev = [0, 0, 0, 0].map(() => [[], [], [], []] as number[][])
  for (let i = 0; i < NP; i++) {
    const v = s.v0[i]
    const g = v < vph - half ? 0 : v < vph ? 1 : v < vph + half ? 2 : 3
    // brightness from log f: bulk bright, far tail faint but visible
    const lw = Math.log10(Math.max(s.w[i], 1e-30))
    const a = lw > -1 ? 3 : lw > -3 ? 2 : lw > -6 ? 1 : 0
    lev[g][a].push(i)
  }
  const buckets: Int32Array[] = []
  for (let g = 0; g < 4; g++) for (let a = 0; a < 4; a++) buckets.push(Int32Array.from(lev[g][a]))
  return {
    s,
    buckets,
    alphas: [0.22, 0.4, 0.65, 0.95],
    tag: { xi: 0.15, u: 0 },
    tagPrev: 0,
    cross: [],
    vmax: 0,
    trapped: 0,
    hist: new Float64Array(NB),
  }
}

export function SurfSim() {
  const [running, setRunning] = useState(true)
  const [preset, setPreset] = useState<Preset | null>('trap')
  const [vph, setVph] = useState(PRESETS.trap.vph)
  const [Phi, setPhi] = useState(PRESETS.trap.Phi)
  const [speed, setSpeed] = useState(2)
  const world = useRef<World>(makeWorld(vph, Phi))
  const frame = useRef(0)
  const [read, setRead] = useState<{ t: number; vmax: number; period: number | null; trapped: number }>({ t: 0, vmax: 0, period: null, trapped: 0 })

  const restart = (v = vph, p = Phi) => {
    world.current = makeWorld(v, p)
    setRead({ t: 0, vmax: 0, period: null, trapped: 0 })
    setRunning(true)
  }
  const choose = (k: Preset) => {
    setPreset(k)
    setVph(PRESETS[k].vph)
    setPhi(PRESETS[k].Phi)
    restart(PRESETS[k].vph, PRESETS[k].Phi)
  }

  const theory = useMemo(() => {
    const half = trapHalfWidth(Phi)
    const vmax = maxTrappedVelocity(vph, Phi)
    return { half, vmax, Emax: 0.5 * vmax * vmax, Tb: TWO_PI / bounceFrequency(Phi), trapped: trappedFraction(vph, Phi) }
  }, [vph, Phi])
  const win = loadWindow(vph, Phi)

  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 560
  const canvas = useCanvas(narrow ? 1.35 : 0.66, () => draw(), narrow ? 660 : 500)

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const wd = world.current
    const s = wd.s
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    const padL = 40 * u
    const padR = 10 * u
    const top = 18 * u
    const phH = H * (narrow ? 0.5 : 0.55)
    const pw = W - padL - padR
    const vlo = -4
    const vhi = Math.max(5, theory.vmax + 1.5)
    const X = (x: number) => padL + (x / (2 * TWO_PI)) * pw
    const Y = (v: number) => top + ((vhi - v) / (vhi - vlo)) * phH
    // grid
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = u
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.text
    for (let v = Math.ceil(vlo / 2) * 2; v <= vhi; v += 2) {
      ctx.beginPath()
      ctx.moveTo(padL, Y(v))
      ctx.lineTo(padL + pw, Y(v))
      ctx.stroke()
      ctx.fillText(String(v), padL - 4 * u, Y(v) + 4 * u)
    }
    ctx.save()
    ctx.translate(12 * u, top + phH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('v / v_te', 0, 0)
    ctx.restore()
    // particles
    const shift = (s.vph * s.t) % TWO_PI
    const sz = 1.8 * u
    for (let g = 0; g < 4; g++) {
      const [r, gg, b] = GROUPS[g].col
      for (let a = 0; a < 4; a++) {
        const idx = wd.buckets[g * 4 + a]
        if (!idx.length) continue
        ctx.fillStyle = `rgba(${r},${gg},${b},${wd.alphas[a]})`
        for (let k = 0; k < idx.length; k++) {
          const i = idx[k]
          let x = s.xi[i] + Math.PI + shift
          x -= TWO_PI * Math.floor(x / TWO_PI)
          const y = Y(s.u[i] + s.vph)
          if (y < top || y > top + phH) continue
          const px = X(x)
          ctx.fillRect(px - sz / 2, y - sz / 2, sz, sz)
          ctx.fillRect(px + pw / 2 - sz / 2, y - sz / 2, sz, sz)
        }
      }
    }
    // separatrix and band edges
    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, top, pw, phH)
    ctx.clip()
    for (const sg of [1, -1]) {
      glowStroke(ctx, COLORS.white, 1.3 * u, () => {
        for (let k = 0; k <= 200; k++) {
          const x = (k / 200) * 2 * TWO_PI
          const xi = x - shift - Math.PI
          const v = s.vph + sg * 2 * Math.sqrt(s.Phi) * Math.abs(Math.cos(xi / 2))
          if (k) ctx.lineTo(X(x), Y(v))
          else ctx.moveTo(X(x), Y(v))
        }
      })
    }
    ctx.setLineDash([5 * u, 4 * u])
    ctx.strokeStyle = 'rgba(251,191,36,0.8)'
    ctx.beginPath()
    ctx.moveTo(padL, Y(s.vph))
    ctx.lineTo(padL + pw, Y(s.vph))
    ctx.stroke()
    ctx.strokeStyle = 'rgba(251,95,95,0.75)'
    ctx.beginPath()
    ctx.moveTo(padL, Y(theory.vmax))
    ctx.lineTo(padL + pw, Y(theory.vmax))
    ctx.stroke()
    ctx.setLineDash([])
    // tagged deeply trapped electron
    {
      let x = wd.tag.xi + Math.PI + shift
      x -= TWO_PI * Math.floor(x / TWO_PI)
      ctx.fillStyle = '#fff'
      ctx.shadowColor = COLORS.white
      ctx.shadowBlur = 10
      for (const off of [0, pw / 2]) {
        ctx.beginPath()
        ctx.arc(X(x) + off, Y(wd.tag.u + s.vph), 3.5 * u, 0, 7)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }
    ctx.restore()
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, top, pw, phH)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.amber
    ctx.fillText('v_ph', padL + 4 * u, Y(s.vph) - 4 * u)
    ctx.fillStyle = COLORS.red
    ctx.fillText(narrow ? 'v_ph + 2√(eφ₀/m)' : 'v_ph + 2√(eφ₀/m): fastest trapped', padL + 4 * u, Y(theory.vmax) - 4 * u)
    ctx.fillStyle = COLORS.text
    ctx.fillText('phase space, lab frame: two wavelengths of the wave →', padL, top - 5 * u)

    // ---------- energy distribution ----------
    const gTop = top + phH + 34 * u
    const gH = H - gTop - 26 * u
    const Emax = 0.5 * vhi * vhi
    const XE = (E: number) => padL + (E / Emax) * pw
    const lo = -8
    const hi = 0
    const YF = (f: number) => gTop + ((hi - Math.log10(Math.max(f, 1e-12))) / (hi - lo)) * gH
    ctx.strokeStyle = COLORS.grid
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.text
    for (let p = lo; p <= hi; p += 2) {
      ctx.beginPath()
      ctx.moveTo(padL, YF(10 ** p))
      ctx.lineTo(padL + pw, YF(10 ** p))
      ctx.stroke()
      ctx.fillText(p === 0 ? '1' : `10${String(p).replace(/[-0-9]/g, (d) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(d)])}`, padL - 4 * u, YF(10 ** p) + 4 * u)
    }
    ctx.textAlign = 'center'
    const step = Emax > 40 ? 10 : Emax > 20 ? 5 : 2
    for (let E = 0; E <= Emax; E += step) ctx.fillText(String(E), XE(E), gTop + gH + 13 * u)
    ctx.fillText('energy E = ½mv² (units of kT_e)', padL + pw / 2, gTop + gH + 24 * u)
    // energies the trapping band spans (lab frame)
    {
      const e0 = 0.5 * Math.max(0, s.vph - theory.half) ** 2
      const e1 = Math.min(Emax, 0.5 * theory.vmax * theory.vmax)
      ctx.fillStyle = 'rgba(244,114,182,0.10)'
      ctx.fillRect(XE(e0), gTop, XE(e1) - XE(e0), gH)
      ctx.fillStyle = 'rgba(244,114,182,0.85)'
      ctx.textAlign = 'right'
      ctx.fillText('trapping band', XE(e1) - 4 * u, gTop + 13 * u)
    }
    ctx.strokeStyle = COLORS.axis
    ctx.strokeRect(padL, gTop, pw, gH)
    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, gTop, pw, gH)
    ctx.clip()
    // initial half-Maxwellian √(2/π) e^(−E)
    ctx.setLineDash([5 * u, 4 * u])
    ctx.strokeStyle = 'rgba(232,234,246,0.45)'
    ctx.beginPath()
    for (let k = 0; k <= 100; k++) {
      const E = (k / 100) * Emax
      const y = YF(Math.sqrt(2 / Math.PI) * Math.exp(-E))
      if (k) ctx.lineTo(XE(E), y)
      else ctx.moveTo(XE(E), y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    // measured forward distribution (per unit v, normalized over v > 0)
    const vmin = win.vlo
    const vmaxW = win.vhi
    const dv = (vmaxW - vmin) / NB
    glowStroke(ctx, COLORS.cyan, 1.8 * u, () => {
      let first = true
      for (let b = 0; b < NB; b++) {
        const v = vmin + (b + 0.5) * dv
        if (v <= 0 || wd.hist[b] <= 0) continue
        const E = 0.5 * v * v
        if (E > Emax) break
        const y = YF(wd.hist[b])
        if (first) ctx.moveTo(XE(E), y)
        else ctx.lineTo(XE(E), y)
        first = false
      }
    })
    ctx.restore()
    ctx.textAlign = 'left'
    const ly = gTop - 8 * u
    ctx.fillStyle = COLORS.cyan
    ctx.fillText(narrow ? 'forward f(v), log scale' : 'forward electrons, f(v) on a log scale', padL, ly)
    ctx.fillStyle = 'rgba(232,234,246,0.6)'
    ctx.textAlign = 'right'
    ctx.fillText(narrow ? 'dashed: start' : 'dashed: initial Maxwellian', padL + pw, ly)
  }

  useAnimation(
    canvas,
    () => {
      const wd = world.current
      const s = wd.s
      stepSurf(s, DT, speed)
      for (let k = 0; k < speed; k++) {
        const prev = wd.tag.u
        stepOrbit(wd.tag, s.Phi, DT)
        if (prev < 0 && wd.tag.u >= 0) wd.cross.push(s.t - DT * (speed - 1 - k) - (wd.tag.u / (wd.tag.u - prev)) * DT)
      }
      // fastest trapped electron so far, and the weighted share of electrons inside the separatrix
      let tw = 0
      let aw = 0
      for (let i = 0; i < s.n; i++) {
        aw += s.w[i]
        if (hamiltonian(s.xi[i], s.u[i], s.Phi) < s.Phi) {
          tw += s.w[i]
          const v = s.u[i] + s.vph
          if (v > wd.vmax) wd.vmax = v
        }
      }
      wd.trapped = tw / aw
      // histogram of forward electrons
      if (++frame.current % 4 === 0) {
        const vmin = win.vlo
        const dv = (win.vhi - vmin) / NB
        wd.hist.fill(0)
        let Wf = 0
        for (let i = 0; i < s.n; i++) {
          const v = s.u[i] + s.vph
          if (v <= 0) continue
          const b = Math.floor((v - vmin) / dv)
          if (b >= 0 && b < NB) wd.hist[b] += s.w[i]
          Wf += s.w[i]
        }
        for (let b = 0; b < NB; b++) wd.hist[b] /= Wf * dv
      }
      if (frame.current % 8 === 0) {
        const cr = wd.cross
        const period = cr.length >= 2 ? (cr[cr.length - 1] - cr[0]) / (cr.length - 1) : null
        setRead({ t: s.t, vmax: wd.vmax, period, trapped: wd.trapped })
      }
      draw()
    },
    running,
  )

  const pct = (x: number) => (x >= 1e-3 ? `${(100 * x).toFixed(x >= 0.01 ? 2 : 3)}%` : x.toExponential(1))
  const okF = read.trapped > 0 && Math.abs(read.trapped / theory.trapped - 1) < 0.05
  const okV = read.vmax > 0 && Math.abs(read.vmax / theory.vmax - 1) < 0.02
  const okT = read.period !== null && Math.abs(read.period / theory.Tb - 1) < 0.02
  return (
    <SimFrame
      id="wave-surf"
      title="Surfing an electron plasma wave"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint="Units: v_te = √(kT_e/m), k = 1, time in 1/(kv_te). The white curves are the separatrix: inside it electrons are trapped in a well moving at v_ph and rotate around its centre; the white dot is a deeply trapped electron that sets the bounce period. Colours mark where each electron started: magenta ones (slower than the wave) are carried up to the red line, amber ones are slowed down. Watch the forward distribution grow a flat shoulder across the shaded trapping band and a hot tail that ends near ½m(v_ph + 2√(eφ₀/m))². Then raise v_ph with the wave held fixed: once the band no longer reaches the thermal bulk, almost nothing is trapped; a faster wave needs a larger amplitude, but the electrons it does catch are far more energetic."
    >
      <div className="row" style={{ marginBottom: 10, gap: 6, flexWrap: 'wrap' }}>
        {(Object.keys(PRESETS) as Preset[]).map((k) => (
          <button key={k} className={`btn small ${preset === k ? 'primary' : ''}`} onClick={() => choose(k)}>
            {PRESETS[k].label}
          </button>
        ))}
      </div>
      <canvas ref={canvas} className="sim" aria-label="Electrons trapped and accelerated by a plasma wave" />
      <div className="readouts">
        <span>trapping band: v = <b>{(vph - theory.half).toFixed(2)}</b> to <b>{theory.vmax.toFixed(2)}</b> v_te</span>
        <span>fastest trapped: measured <b className={okV ? 'ok' : ''}>{read.vmax > 0 ? read.vmax.toFixed(3) : '…'}</b>, theory v_ph + 2√(eφ₀/m) = <b>{theory.vmax.toFixed(3)}</b></span>
        <span>bounce period: measured <b className={okT ? 'ok' : ''}>{read.period ? read.period.toFixed(2) : '…'}</b>, theory 2π/ω_b = <b>{theory.Tb.toFixed(2)}</b></span>
        <span>trapped electrons: measured <b className={okF ? 'ok' : ''}>{read.trapped > 0 ? pct(read.trapped) : '…'}</b>, Maxwellian share inside the separatrix <b>{pct(theory.trapped)}</b></span>
        <span>most energetic trapped: ½m(v_ph + 2√(eφ₀/m))² = <b>{theory.Emax.toFixed(1)} kT_e</b></span>
        <span>t = <b>{read.t.toFixed(0)}</b> ({(read.t / theory.Tb).toFixed(1)} bounce periods)</span>
      </div>
      <div className="controls">
        <Slider label="Phase velocity v_ph / v_te" value={vph} min={1.5} max={8} step={0.1} onChange={(v) => { setVph(v); setPreset(null); restart(v, Phi) }} fmt={(v) => v.toFixed(1)} />
        <Slider label="Wave amplitude eφ₀ / kT_e" value={Phi} min={0.02} max={6} step={0.02} onChange={(v) => { setPhi(v); setPreset(null); restart(vph, v) }} fmt={(v) => v.toFixed(2)} />
        <Slider label="Speed" value={speed} min={1} max={6} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
