// What the tutor is told: the lesson on screen, the learner model and, when asked from a problem, the problem.
import { getState } from '../store/store'
import { LESSONS, lessonById, MODULES } from '../lessons'
import { conceptMastery, band } from '../learner/concepts'
import { MISTAKES, patterns } from '../learner/digest'
import type { ProblemContext, TutorContext } from './state'
import { SUBJECT } from '../subject'

// ---------- prompt ----------
/** The lesson as plain text with its maths written back as TeX, read from the page itself. */
export function pageExcerpt(max = 9000) {
  const main = document.querySelector('main')
  if (!main) return ''
  const clone = main.cloneNode(true) as HTMLElement
  clone.querySelectorAll('canvas, button, input, svg, script, style, .tutor-fab, .banner, .readouts, .kbd, select, .lesson-nav').forEach((n) => n.remove())
  clone.querySelectorAll('.katex-display, .katex').forEach((k) => {
    if (!k.isConnected) return
    const tx = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? ''
    const display = k.classList.contains('katex-display')
    k.replaceWith(document.createTextNode(display ? ` $$${tx}$$ ` : `$${tx}$`))
  })
  clone.querySelectorAll('p, h1, h2, h3, li, section, .step, .card, details, summary').forEach((n) => n.appendChild(document.createTextNode('\n')))
  const text = (clone.textContent ?? '')
    .replace(/\\s\{[\w-]+\}\{([^{}]*)\}/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
  return text.length > max ? text.slice(0, max) + ' …' : text
}

function learnerSummary(lessonId: string | null) {
  const s = getState()
  const { concepts, state } = conceptMastery(s, LESSONS)
  const solid: string[] = []
  const weak: string[] = []
  for (const [id, cs] of state) {
    const b = band(cs)
    const label = concepts.get(id)?.label ?? id
    if (b === 'solid') solid.push(label)
    else weak.push(`${label} (${Math.round(cs.p * 100)}%)`)
  }
  const mastered = LESSONS.filter((l) => s.lessons[l.id]?.completed).map((l) => l.id)
  const pat = patterns(s, LESSONS)
  const mistakes = pat.mistakes.slice(0, 3).map((m) => `${MISTAKES[m.kind]?.label ?? m.kind} ×${m.n}`)
  const here = lessonId ? lessonById(lessonId) : undefined
  const hereSolved = here ? here.problems.filter((p) => s.problems[p.id]?.solved).length : 0
  return [
    `Lessons mastered: ${mastered.length ? mastered.join(', ') : 'none yet'}.`,
    solid.length ? `Concepts they handle well: ${solid.slice(0, 12).join(', ')}.` : '',
    weak.length ? `Concepts that are still shaky (estimated mastery): ${weak.slice(0, 8).join(', ')}.` : '',
    pat.numeric.n + pat.mcq.n ? `First-try accuracy: numeric ${pat.numeric.first}/${pat.numeric.n}, multiple choice ${pat.mcq.first}/${pat.mcq.n}. Hints used on ${Math.round(pat.hintRate * 100)}% of problems.` : 'They have not answered any problems yet.',
    mistakes.length ? `Most common mistakes: ${mistakes.join(', ')}.` : '',
    here ? `In this lesson they have solved ${hereSolved} of ${here.problems.length} problems.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function problemBlock(p: ProblemContext) {
  const lesson = LESSONS.find((l) => l.problems.some((x) => x.id === p.id))
  const prob = lesson?.problems.find((x) => x.id === p.id)
  if (!prob) return ''
  const answer = prob.kind === 'numeric' ? `${prob.answer} ${prob.unit} (accepted within ${Math.round(prob.tol * 100)}%)` : `option ${prob.correct + 1}: ${prob.options[prob.correct]}`
  return [
    'THE LEARNER IS WORKING ON THIS PROBLEM:',
    prob.prompt,
    prob.kind === 'mcq' ? `Options: ${prob.options.map((o, i) => `(${i + 1}) ${o}`).join(' ')}` : '',
    `Correct answer (never state it unless the learner explicitly asks for it after trying): ${answer}`,
    `Worked solution (for you only): ${prob.solution}`,
    `Hints the app has already shown: ${p.hints} of ${prob.hints.length}.`,
    p.wrong.length ? `Their wrong answers so far: ${p.wrong.join('; ')}.` : 'They have not submitted an answer yet.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** The system prompt. `excerptMax` shrinks the lesson text for local models with small context windows. */
export function instructions(ctx: TutorContext, excerptMax = 9000) {
  const lesson = ctx.lessonId ? lessonById(ctx.lessonId) : undefined
  const mod = lesson ? MODULES.find((m) => m.id === lesson.id) : undefined
  const excerpt = typeof document !== 'undefined' ? pageExcerpt(excerptMax) : ''
  return [
    SUBJECT.tutorPersona,
    '',
    'How to tutor:',
    '- When the learner is working a problem, be Socratic: find where their reasoning went wrong with one short diagnostic question, or give one hint at a time. Do not give the final answer unless they explicitly ask for it after trying.',
    `- Otherwise explain clearly: intuition first, then the equation. ${SUBJECT.tutorGuidance}`,
    '- Keep replies under about 180 words unless the learner asks for more. Short paragraphs or "- " bullets, no headings. Write maths as $...$ inline and $$...$$ for displayed equations (KaTeX).',
    '- Use what you know about the learner below: build on what they have mastered and be patient with what is shaky, without reciting their statistics back to them.',
    `- If a question is outside ${SUBJECT.name}, answer briefly and steer back. If you are not sure of a fact, say so. Never reproduce textbook passages; cite sections instead.`,
    '',
    lesson ? `CURRENT LESSON: ${lesson.id} · ${lesson.title} (${lesson.subtitle}). Prerequisites: ${mod?.prereqs.join(', ') || 'none'}.` : 'The learner is not inside a lesson right now.',
    lesson ? `Objectives: ${lesson.objectives.join(' | ')}` : '',
    excerpt ? `WHAT IS ON THEIR SCREEN (lesson text, maths as TeX):\n"""\n${excerpt}\n"""` : '',
    '',
    `ABOUT THE LEARNER:\n${learnerSummary(ctx.lessonId)}`,
    ctx.problem ? `\n${problemBlock(ctx.problem)}` : '',
  ]
    .filter((x) => x !== '')
    .join('\n')
}

/** Quick questions offered as chips, depending on where the learner is. */
export function quickAsks(ctx: TutorContext): string[] {
  if (ctx.problem) return ['Where did I go wrong?', 'Give me a hint, not the answer', 'Which equation applies here?']
  if (ctx.lessonId) return ['Explain the key idea more simply', 'Quiz me on this lesson', 'How does this connect to fusion or lasers?']
  return SUBJECT.generalAsks
}

