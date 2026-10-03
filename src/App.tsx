import { useEffect, useState } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Celebrations, Circuit, Logo } from './components/Hud'
import { Home } from './pages/Home'
import { ContentsPage } from './pages/Contents'
import { LessonPage } from './pages/LessonPage'
import { MapPage, PlotPage, ReviewPage, SettingsPage } from './pages/Other'
import { YouPage } from './pages/You'
import { TutorFab, TutorPanel } from './tutor/TutorPanel'
import { initTutor } from './tutor/state'
import { startSync, useSyncStatus } from './store/sync'
import { dueCards, levelFor, useStore } from './store/store'
import { nudge, reminderDue, tickReminder } from './store/reminders'
import { lessonById, lessonsOf, trackOf } from './lessons'

const NAV = [
  { to: '/', label: 'Home', icon: '◈' },
  { to: '/contents', label: 'Contents', icon: '▤' },
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

  // A lesson gets the whole screen: no main navigation, only the way back to the contents.
  const inLesson = loc.pathname.startsWith('/learn/')
  useEffect(() => {
    document.documentElement.classList.toggle('lesson-mode', inLesson)
  }, [inLesson])

  useEffect(() => {
    initTutor()
    void startSync()
  }, [])
  const sync = useSyncStatus()

  const lvl = levelFor(s.xp)
  const due = dueCards().length

  return (
    <>
      <Circuit className="tl" />
      <Circuit className="br" />
      <div className="shell">
        {inLesson ? (
          <LessonBar id={loc.pathname.split('/')[2] ?? ''} />
        ) : (
          <header className="topbar">
            <Link to="/" className="brand">
              <Logo />
              <span className="brand-name">DEBYE</span>
            </Link>
            <nav className="topnav" aria-label="Main">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className="item">
                  <span aria-hidden="true">{n.icon}</span> {n.label}
                  {n.to === '/review' && due > 0 && <span className="pill">{due}</span>}
                </NavLink>
              ))}
            </nav>
            <div className="top-stats">
              <span className="rank">Rank <b>{lvl.name}</b></span>
              <span><b>{s.xp}</b> XP · 🔥 <b>{s.streak.count}</b></span>
              {(sync.state === 'synced' || sync.state === 'saving') && <span className="kbd" title="Progress syncs across your devices">☁ {sync.state === 'saving' ? 'saving…' : 'synced'}</span>}
            </div>
          </header>
        )}
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
            <Route path="/contents" element={<ContentsPage />} />
            <Route path="/learn" element={<Navigate to="/contents" replace />} />
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
      {!inLesson && <nav className="tabbar" aria-label="Main">
        {NAV.filter((n) => n.label !== 'Remind').map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <span style={{ fontSize: 18 }} aria-hidden="true">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>}
      <TutorFab />
      <TutorPanel />
      <Celebrations />
    </>
  )
}

/** The only navigation inside a lesson: back to the contents, where any other lesson is picked. */
function LessonBar({ id }: { id: string }) {
  const lesson = lessonById(id)
  const track = trackOf(id)
  const list = lessonsOf(track)
  const n = list.findIndex((l) => l.id === id)
  return (
    <header className="lessonbar">
      <Link to={`/contents#${id}`} className="btn small">← Contents</Link>
      {lesson && (
        <span className="lessonbar-title">
          <b>{lesson.id}</b> {lesson.title}
          <span className="dim"> · Track {track}, lesson {n + 1} of {list.length}</span>
        </span>
      )}
    </header>
  )
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
