import { Fragment, useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Celebrations, Circuit, Logo } from './components/Hud'
import { Home } from './pages/Home'
import { LessonPage } from './pages/LessonPage'
import { MapPage, PlotPage, ReviewPage, SettingsPage } from './pages/Other'
import { YouPage } from './pages/You'
import { TutorFab, TutorPanel } from './tutor/TutorPanel'
import { initTutor } from './tutor/state'
import { startSync, useSyncStatus } from './store/sync'
import { dueCards, levelFor, useStore } from './store/store'
import { nudge, reminderDue, tickReminder } from './store/reminders'
import { READY_TRACKS, TRACKS, lessonsOf } from './lessons'
import { Link } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Home', icon: '◈' },
  { to: '/learn/A1', label: 'Learn', icon: '⚛' },
  { to: '/map', label: 'Map', icon: '⌬' },
  { to: '/plot', label: 'Plot', icon: '∿' },
  { to: '/review', label: 'Review', icon: '↻' },
  { to: '/you', label: 'You', icon: '⬡' },
  { to: '/settings', label: 'Remind', icon: '⏰' },
]

function Shell() {
  const s = useStore((s) => s)
  const loc = useLocation()
  const [showBanner, setShowBanner] = useState(false)
  useEffect(() => {
    document.documentElement.style.setProperty('--glow-strength', String(s.glow))
  }, [s.glow])
  useEffect(() => {
    const check = () => {
      setShowBanner(reminderDue())
      tickReminder()
    }
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [s.streak.lastDay, s.reminder])

  useEffect(() => {
    if (!loc.hash) window.scrollTo(0, 0)
  }, [loc.pathname, loc.hash])

  // keep the current lesson visible in the (scrollable) sidebar
  useEffect(() => {
    document.querySelector('.nav a.lesson-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [loc.pathname])

  useEffect(() => {
    initTutor()
    void startSync()
  }, [])
  const sync = useSyncStatus()

  const lvl = levelFor(s.xp)
  const due = dueCards().length
  const learnActive = loc.pathname.startsWith('/learn')

  return (
    <>
      <Circuit className="tl" />
      <Circuit className="br" />
      <div className="shell">
        <aside className="nav">
          <Link to="/" className="brand">
            <Logo />
            <span className="brand-name">DEBYE</span>
          </Link>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `item ${isActive || (n.label === 'Learn' && learnActive) ? 'active' : ''}`}>
              <span aria-hidden="true">{n.icon}</span> {n.label}
              {n.to === '/review' && due > 0 && <span className="pill" style={{ marginLeft: 'auto', padding: '0 8px' }}>{due}</span>}
            </NavLink>
          ))}
          {READY_TRACKS.map((t) => (
            <Fragment key={t}>
              <div className="tag" style={{ margin: '16px 12px 4px' }}>{t === 'L' ? 'Track L · Laser trial' : `Track ${t} · ${TRACKS[t].book}`}</div>
              {lessonsOf(t).map((l) => (
                <NavLink key={l.id} to={`/learn/${l.id}`} className="item lesson-item" title={`${l.id} ${l.title}`}>
                  {s.lessons[l.id]?.completed ? '●' : '○'} {l.id} {l.title}
                </NavLink>
              ))}
            </Fragment>
          ))}
          <div className="spacer" />
          <div className="nav-stats">
            <span>Rank <b>{lvl.name}</b></span>
            <span><b>{s.xp}</b> XP · 🔥 <b>{s.streak.count}</b> day{s.streak.count === 1 ? '' : 's'}</span>
            {(sync.state === 'synced' || sync.state === 'saving') && <span className="kbd">☁ {sync.state === 'saving' ? 'saving…' : 'synced across devices'}</span>}
          </div>
        </aside>
        <main className="main">
          {showBanner && (
            <div className="banner">
              <span>⏰ {nudge()}</span>
              <Link className="btn small" to={due ? '/review' : '/'} onClick={() => setShowBanner(false)}>
                {due ? `Review ${due} card${due === 1 ? '' : 's'}` : 'Start'}
              </Link>
              <button className="btn small" onClick={() => setShowBanner(false)}>Later</button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/learn/:id" element={<LessonPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/plot" element={<PlotPage />} />
            <Route path="/plot/:id" element={<PlotPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/you" element={<YouPage />} />
            <Route path="/progress" element={<YouPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {NAV.filter((n) => n.label !== 'Remind').map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive || (n.label === 'Learn' && learnActive) ? 'active' : '')}>
            <span style={{ fontSize: 18 }} aria-hidden="true">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <TutorFab />
      <TutorPanel />
      <Celebrations />
    </>
  )
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
