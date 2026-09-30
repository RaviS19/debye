import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { lessonById, LESSONS, MODULES } from '../lessons'
import { mastery, MASTERY_THRESHOLD } from '../lessons/progress'
import { ProblemCard, FlashcardView, withMath } from '../components/Learning'
import { Ring } from '../components/Hud'
import { completeLesson, ensureCards, openLesson, useStore, dueCards } from '../store/store'
import { useState } from 'react'

export function LessonPage() {
  const { id = 'A1' } = useParams()
  const lesson = lessonById(id)
  const s = useStore((s) => s)
  const { hash } = useLocation()
  useEffect(() => {
    if (!lesson) return
    openLesson(lesson.id)
    ensureCards(lesson.cards.map((c) => c.id))
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth' }))
    else window.scrollTo(0, 0)
  }, [lesson, hash])

  const m = lesson ? mastery(s, lesson) : 0
  useEffect(() => {
    if (lesson && m >= MASTERY_THRESHOLD) completeLesson(lesson.id)
  }, [lesson, m])

  if (!lesson) {
    const mod = MODULES.find((x) => x.id === id)
    return (
      <div className="card glow">
        <span className="pill ghost">Coming in a later phase</span>
        <h1 style={{ marginTop: 12 }}>{mod ? `${mod.id} · ${mod.title}` : 'Not found'}</h1>
        <p className="dim">This module is on the roadmap. Track A (A1 to A11) is ready now.</p>
        <Link className="btn" to="/map">Back to the map</Link>
      </div>
    )
  }

  const idx = LESSONS.indexOf(lesson)
  const next = LESSONS[idx + 1]
  const unmet = MODULES.find((x) => x.id === lesson.id)!.prereqs.filter((p) => !s.lessons[p]?.completed)
  const Body = lesson.body

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="tag">Track A · Chen · {lesson.id} · ~{lesson.minutes} min</span>
          <h1>{lesson.title}</h1>
          <p className="lede">{lesson.subtitle}</p>
        </div>
        <Ring value={m} size={84} label={`${Math.round(m * 100)}%`} />
      </div>

      {unmet.length > 0 && (
        <div className="banner">
          <span>
            This builds on <strong>{unmet.join(', ')}</strong>, which you have not mastered yet. You can carry on, or do a quick pass there first.
          </span>
          <Link className="btn small" to={`/learn/${unmet[0]}`}>Go to {unmet[0]}</Link>
        </div>
      )}

      <nav className="lesson-nav" aria-label="Sections">
        {lesson.sections.map((sec) => (
          <a key={sec.id} className="pill ghost" href={`#${sec.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' }) }}>
            {sec.label}
          </a>
        ))}
      </nav>

      <div className="card">
        <div className="card-head"><span className="pill violet">Objectives</span></div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {lesson.objectives.map((o) => <li key={o} dangerouslySetInnerHTML={{ __html: withMath(o) }} />)}
        </ul>
        {lesson.refs.map((r) => <div key={r} className="ref">Read alongside: {r}</div>)}
      </div>

      <Body />

      <section id="problems">
        <h2>Problems</h2>
        <p className="dim">Solve {Math.ceil(lesson.problems.length * MASTERY_THRESHOLD)} of {lesson.problems.length} to master this lesson. First-try answers earn double XP.</p>
        {lesson.problems.map((p, i) => <ProblemCard key={p.id} p={p} index={i} />)}
      </section>

      <LessonCards ids={lesson.cards.map((c) => c.id)} lessonId={lesson.id} />

      <div className="card glow" style={{ textAlign: 'center' }}>
        {s.lessons[lesson.id]?.completed ? (
          <>
            <span className="pill lime">Lesson mastered</span>
            <p style={{ marginTop: 10 }}>Its flashcards will come back for review on a spaced schedule.</p>
          </>
        ) : (
          <p className="dim" style={{ margin: 0 }}>Keep going: {Math.round(m * 100)}% of {Math.round(MASTERY_THRESHOLD * 100)}% needed.</p>
        )}
        {next && <Link className="btn primary" style={{ marginTop: 10 }} to={`/learn/${next.id}`}>Next: {next.title}</Link>}
      </div>
    </>
  )
}

function LessonCards({ ids, lessonId }: { ids: string[]; lessonId: string }) {
  const lesson = lessonById(lessonId)!
  useStore((s) => s.reviews)
  const due = dueCards(ids)
  const [open, setOpen] = useState(false)
  const card = lesson.cards.find((c) => c.id === due[0])
  return (
    <section>
      <h2>Lock it in</h2>
      <p className="dim">These flashcards join your review deck and return just before you would forget them.</p>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)} disabled={!due.length}>
          {due.length ? `Review ${due.length} card${due.length === 1 ? '' : 's'} now` : 'All cards reviewed for now'}
        </button>
      ) : card ? (
        <FlashcardView key={card.id} card={card} onDone={() => {}} />
      ) : (
        <span className="pill lime">Done for now</span>
      )}
    </section>
  )
}
