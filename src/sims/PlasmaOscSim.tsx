// A1: a real 1D particle-in-cell code. Displace the electrons and watch them ring at ω_pe.
import { useRef, useState } from 'react'
import { COLORS, glowStroke, useAnimation, useCanvas } from '../components/useCanvas'
import { createPic, fieldEnergy, stepPic, type Pic1D } from '../physics/pic1d'
import { SimFrame, Slider } from './SimFrame'

const L = 4 * Math.PI
const NP = 3000
const NG = 64

export function PlasmaOscSim() {
  const [running, setRunning] = useState(true)
  const [amp, setAmp] = useState(0.25)
  const [vth, setVth] = useState(0)
  const [mode, setMode] = useState(1)
  const [beams, setBeams] = useState(0)
  const [speed, setSpeed] = useState(2)
  const make = (a = amp, v = vth, m = mode, b = beams) =>
    createPic({ n: NP, ng: NG, L, dt: 0.05, amplitude: a / m, mode: m, vth: v, beams: b }) // keep kξ fixed so higher modes do not wave-break
  const pic = useRef<Pic1D>(make())
  const history = useRef<number[]>([])
  const zeros = useRef<number[]>([])
  const prevProbe = useRef(0)
  const [measured, setMeasured] = useState<number | null>(null)

  const restart = (a = amp, v = vth, m = mode, b = beams) => {
    pic.current = make(a, v, m, b)
    history.current = []
    zeros.current = []
    setMeasured(null)
  }

  const k = (2 * Math.PI * mode) / L
  const bohmGross = Math.sqrt(1 + 3 * k * k * vth * vth)

  const canvas = useCanvas(0.62)
  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = W / c.clientWidth
    const p = pic.current
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const phaseH = H * 0.55
    const vmax = Math.max(1.2, 3 * vth + beams * 1.6 + amp * 1.5)
    // phase space
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(0, phaseH / 2)
    ctx.lineTo(W, phaseH / 2)
    ctx.stroke()
    ctx.fillStyle = COLORS.cyan
    ctx.globalAlpha = 0.8
    for (let i = 0; i < p.x.length; i += 1) {
      const px = (p.x[i] / L) * W
      const py = phaseH / 2 - (p.v[i] / vmax) * (phaseH / 2 - 8)
      ctx.fillRect(px - u, py - u, 2 * u, 2 * u)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = COLORS.text
    ctx.font = `${11 * u}px "PT Sans", sans-serif`
    ctx.fillText('phase space: position x (across) vs velocity v (up)', 8 * u, 14 * u)
    // electric field
    const fy0 = phaseH + (H - phaseH) * 0.35
    const fh = (H - phaseH) * 0.3
    let emax = 0.3
    for (const e of p.E) emax = Math.max(emax, Math.abs(e))
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(0, fy0)
    ctx.lineTo(W, fy0)
    ctx.stroke()
    glowStroke(ctx, COLORS.magenta, 2 * u, () => {
      for (let j = 0; j <= NG; j++) {
        const x = (j / NG) * W
        const y = fy0 - (p.E[j % NG] / emax) * fh
        if (j) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
    })
    ctx.fillStyle = COLORS.magenta
    ctx.fillText('electric field E(x)', 8 * u, phaseH + 14 * u)
    // field energy history
    const hy = H - 6 * u
    const hh = (H - phaseH) * 0.3
    const hist = history.current
    const hmax = Math.max(1e-6, ...hist)
    glowStroke(ctx, COLORS.lime, 1.5 * u, () => {
      hist.forEach((v, i) => {
        const x = (i / 400) * W
        const y = hy - (v / hmax) * hh
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      })
    })
    ctx.fillStyle = COLORS.lime
    ctx.fillText('field energy vs time (oscillates at 2ω_pe)', 8 * u, hy - hh - 4 * u)
  }

  useAnimation(
    canvas,
    () => {
      const p = pic.current
      for (let s = 0; s < speed; s++) {
        stepPic(p)
        const probe = p.E[Math.floor(NG / (4 * mode)) % NG]
        if (prevProbe.current < 0 && probe >= 0) zeros.current.push(p.t)
        prevProbe.current = probe
      }
      history.current.push(fieldEnergy(p))
      if (history.current.length > 400) history.current.shift()
      const z = zeros.current
      if (z.length >= 3 && z.length % 2 === 1) {
        const recent = z.slice(-6)
        const period = (recent[recent.length - 1] - recent[0]) / (recent.length - 1)
        const w = (2 * Math.PI) / period
        if (!measured || Math.abs(w - measured) > 0.005) setMeasured(w)
      }
      draw()
    },
    running,
  )

  return (
    <SimFrame
      id="plasma-osc"
      title="Plasma oscillation (1D PIC)"
      running={running}
      setRunning={setRunning}
      onReset={() => restart()}
      hint="Each dot is a computational electron in a 1D particle-in-cell code, the same method research codes like EPOCH use. The electrons start displaced; the ions pull them back, they overshoot, and the plasma rings. Add temperature to see the Bohm–Gross shift (lesson A5), or turn on two beams to watch the two-stream instability grow (A8)."
    >
      <canvas ref={canvas} className="sim" aria-label="Plasma oscillation simulation" />
      <div className="readouts">
        <span>theory ω/ω_pe = <b>{bohmGross.toFixed(3)}</b>{vth > 0 && ' (Bohm–Gross)'}</span>
        <span>
          measured = <b className={measured && Math.abs(measured - bohmGross) / bohmGross < 0.05 ? 'ok' : ''}>{measured && !beams ? measured.toFixed(3) : beams ? 'unstable' : '…'}</b>
        </span>
        <span>time = <b>{pic.current.t.toFixed(0)} / ω_pe</b></span>
      </div>
      <div className="controls">
        <Slider label="Initial displacement" value={amp} min={0.02} max={0.6} step={0.02} onChange={(v) => { setAmp(v); restart(v) }} />
        <Slider label="Electron temperature (v_th)" value={vth} min={0} max={0.6} step={0.05} onChange={(v) => { setVth(v); restart(amp, v) }} />
        <Slider label="Wave mode number" value={mode} min={1} max={4} step={1} onChange={(v) => { setMode(v); restart(amp, vth, v) }} />
        <Slider label="Two counter-streaming beams" value={beams} min={0} max={1.2} step={0.1} onChange={(v) => { setBeams(v); restart(amp, vth, mode, v) }} fmt={(v) => (v ? `±${v}` : 'off')} />
        <Slider label="Speed" value={speed} min={1} max={6} step={1} onChange={setSpeed} fmt={(v) => `${v}×`} />
      </div>
    </SimFrame>
  )
}
