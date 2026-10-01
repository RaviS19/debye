// HUD decorations and gauges from the SciFi template: ring gauges, circuit traces, the logo, badges.
import { useEffect, useRef, useState } from 'react'
import { onEvent, levelFor, LEVELS, getState, type AppEvent } from '../store/store'
import { badgeById } from '../store/badges'

export function Ring({ value, size = 96, label, color = '#22d3ee' }: { value: number; size?: number; label: string; color?: string }) {
  const r = size / 2 - 8
  const C = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r + 5} fill="none" stroke="rgba(143,255,255,0.15)" strokeWidth="1" strokeDasharray="2 4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#132544" strokeWidth="6" />
        {v > 0 && <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${C * v} ${C}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.8s ease' }}
        />}
      </svg>
      <span className="val" style={{ fontSize: size / 4.6 }}>{label}</span>
    </div>
  )
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="none" stroke="#8fffff" strokeWidth="1.2" opacity="0.5" strokeDasharray="3 3" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#22d3ee" strokeWidth="1.6" style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
      <circle cx="20" cy="20" r="3.2" fill="#f472b6" style={{ filter: 'drop-shadow(0 0 5px #f472b6)' }} />
      <circle cx="31" cy="20" r="2" fill="#8fffff" />
      <circle cx="12" cy="12" r="1.5" fill="#a06fd6" />
    </svg>
  )
}

export function Circuit({ className }: { className: string }) {
  return (
    <svg className={`circuit ${className}`} width="320" height="220" viewBox="0 0 320 220" aria-hidden="true">
      <g fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.5">
        <path d="M0 40 H90 L120 70 H200" />
        <path d="M0 80 H60 L90 110 V160" />
        <path d="M40 0 V30 L70 60 H140 L160 40 H260" />
        <path d="M0 130 H30 L50 150 V220" opacity="0.6" />
        <path d="M120 0 V20 L140 40" opacity="0.6" />
      </g>
      <g fill="#8fffff">
        <circle cx="200" cy="70" r="3" />
        <circle cx="90" cy="160" r="3" />
        <circle cx="260" cy="40" r="3" />
        <circle cx="50" cy="220" r="2" />
      </g>
      <g fill="none" stroke="#8fffff" strokeWidth="1.2" opacity="0.4">
        <path d="M230 90 l8 8 l-8 8 M242 90 l8 8 l-8 8 M254 90 l8 8 l-8 8" />
      </g>
    </svg>
  )
}

export function BadgeIcon({ glyph, earned = true, size = 96 }: { glyph: string; earned?: boolean; size?: number }) {
  const col = earned ? '#8fffff' : '#314c72'
  // 'n_c' draws c as a subscript; three characters or more get a smaller font so they stay inside the hexagon
  const [base, sub = ''] = glyph.split('_')
  const fs = base.length + sub.length * 0.6 > 2.4 ? 27 : 34
  return (
    <svg className={earned ? 'badge-icon' : ''} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ width: size, height: size, flex: 'none', opacity: earned ? undefined : 0.6 }}>
      <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill={earned ? 'rgba(34,211,238,0.12)' : 'transparent'} stroke={col} strokeWidth="2.5" />
      <polygon points="50,14 81,32 81,68 50,86 19,68 19,32" fill="none" stroke={earned ? '#a06fd6' : '#1f3150'} strokeWidth="1.2" strokeDasharray="4 3" />
      <text x="50" y={sub ? 59 : 62} textAnchor="middle" fontSize={fs} fontFamily="Exo, sans-serif" fontWeight="700" fill={earned ? '#fff' : '#314c72'}>
        {base}
        {sub && <tspan fontSize={Math.round(fs * 0.62)} dy={Math.round(fs * 0.24)}>{sub}</tspan>}
      </text>
    </svg>
  )
}

// ---------- toasts, confetti and the badge modal ----------
const CONFETTI = ['#8fffff', '#22d3ee', '#a06fd6', '#f472b6', '#4ade80', '#fbbf24']

function burst(canvas: HTMLCanvasElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const ctx = canvas.getContext('2d')!
  const W = (canvas.width = innerWidth)
  const H = (canvas.height = innerHeight)
  const parts = Array.from({ length: 140 }, () => ({
    x: W / 2,
    y: H * 0.4,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 3,
    r: Math.random() * 3 + 1.5,
    c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    life: 1,
  }))
  const tick = () => {
    ctx.clearRect(0, 0, W, H)
    let alive = false
    for (const p of parts) {
      p.vy += 0.32
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.009
      if (p.life <= 0) continue
      alive = true
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.c
      ctx.shadowColor = p.c
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, 7)
      ctx.fill()
    }
    if (alive) requestAnimationFrame(tick)
    else ctx.clearRect(0, 0, W, H)
  }
  tick()
}

function chime(freqs: number[]) {
  if (!getState().sound) return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new AC()
    freqs.forEach((f, i) => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.09)
      g.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + i * 0.09 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.09 + 0.5)
      o.connect(g).connect(ac.destination)
      o.start(ac.currentTime + i * 0.09)
      o.stop(ac.currentTime + i * 0.09 + 0.55)
    })
  } catch {
    /* audio unavailable */
  }
}

const PRAISE = [
  'Quasi-neutral and fully charged.',
  'That is exactly how a physicist thinks.',
  'Your understanding just ionized a little further.',
  'Nicely shielded from confusion.',
  'Another invariant conserved: your momentum.',
]

export function Celebrations() {
  const [toasts, setToasts] = useState<{ id: number; node: React.ReactNode }[]>([])
  const [modal, setModal] = useState<AppEvent | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(
    () =>
      onEvent((ev) => {
        const id = Math.random()
        const push = (node: React.ReactNode) => {
          setToasts((t) => [...t.slice(-3), { id, node }])
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
        }
        if (ev.kind === 'xp') push(<><span className="xp">+{ev.amount} XP</span> · {ev.reason}</>)
        if (ev.kind === 'streak' && ev.count > 1) push(<>🔥 {ev.count}-day streak{ev.usedFreeze ? ' (a streak freeze covered yesterday)' : ''}</>)
        if (ev.kind === 'badge' || ev.kind === 'levelup') {
          setModal(ev)
          if (canvas.current) burst(canvas.current)
          chime([523, 659, 784, 1047])
        } else if (ev.kind === 'xp' && ev.amount >= 20) chime([659, 988])
      }),
    [],
  )
  const badge = modal?.kind === 'badge' ? badgeById(modal.id) : null
  return (
    <>
      <canvas ref={canvas} className="confetti" />
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>{t.node}</div>
        ))}
      </div>
      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="card glow modal" onClick={(e) => e.stopPropagation()}>
            {badge ? (
              <>
                <span className="pill">Badge unlocked</span>
                <BadgeIcon glyph={badge.glyph} />
                <h2 style={{ margin: '4px 0' }}>{badge.name}</h2>
                <p className="dim">{badge.blurb}</p>
              </>
            ) : modal.kind === 'levelup' ? (
              <>
                <span className="pill violet">Rank up</span>
                <div style={{ margin: '14px auto' }}>
                  <Ring value={1} size={110} label={String(modal.level + 1)} color="#a06fd6" />
                </div>
                <h2 style={{ margin: '4px 0' }}>{LEVELS[modal.level].name}</h2>
                <p className="dim">{levelFor(getState().xp).toNext ? `${levelFor(getState().xp).toNext} XP to the next rank.` : 'Top rank reached.'}</p>
              </>
            ) : null}
            <p>{PRAISE[Math.floor(Math.random() * PRAISE.length)]}</p>
            <button className="btn primary" onClick={() => setModal(null)}>Keep going</button>
          </div>
        </div>
      )}
    </>
  )
}
