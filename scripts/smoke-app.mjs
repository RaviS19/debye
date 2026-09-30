// Smoke-test the app pages (Home, You, Settings, Review, Map) with a seeded learner, and the tutor panel
// with a mocked Claude (dev server only, ?mocktutor). Usage: node scripts/smoke-app.mjs <port> [outDir]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { createEmptyCard, fsrs } from 'ts-fsrs'
import { mkdirSync } from 'node:fs'

const [port, out = '/tmp/claude-0/shots/app'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

// ---------- a learner two weeks in ----------
const DAY = 86400000
const now = Date.now()
const sched = fsrs({})
const state = {
  version: 1, device: 'seed01', xp: 0, xpBy: {}, streak: { count: 4, best: 6, lastDay: null, freezes: 0 }, studyDays: [],
  lessons: {}, problems: {}, cards: {}, reviews: 0, reviewsBy: {}, simsUsed: { debye: 3, 'plasma-osc': 2, orbit: 1 }, badges: {},
  log: { xp: [], attempts: [], reviews: [], tutor: [] }, retention: 0.9, epoch: '',
  reminder: { enabled: true, time: '07:30', days: [1, 2, 3, 4, 5] }, lastNotified: null, lastDigest: null, sync: { enabled: true }, glow: 1, sound: false,
}
const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
let seed = 3
const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const plan = [
  ['A1', [1, 1, 1, 1, 0, 1]],
  ['A2', [1, 0, 1, 1, 1, 0]],
  ['A3', [0, 0, 1, 2, 2, 2]], // 2 = not tried
]
let t = now - 13 * DAY + 19 * 3600000 - (new Date(now).getHours() * 3600000)
for (const [lid, outcomes] of plan) {
  state.lessons[lid] = { opened: new Date(t).toISOString(), derivations: ['d1'] }
  outcomes.forEach((o, i) => {
    const pid = `${lid}-p${i + 1}`
    if (o === 2) return
    t += 4 * 60000
    if (o === 1) state.log.attempts.push([t, pid, 1, 0, '', 0])
    else {
      state.log.attempts.push([t, pid, 0, 0, i % 2 ? 'option' : 'pow10', 0])
      t += 3 * 60000
      state.log.attempts.push([t, pid, 1, 1, '', 0])
    }
    state.problems[pid] = { attempts: o === 1 ? 1 : 2, solved: true, firstTry: o === 1 }
    state.log.xp.push([t, o === 1 ? 20 : 10, 'p'])
  })
  if (lid !== 'A3') state.lessons[lid].completed = new Date(t).toISOString()
  t += 2 * DAY
}
// flashcards with a review history
for (const lid of ['A1', 'A2', 'A3']) {
  for (let c = 1; c <= 6; c++) {
    const id = `${lid}-c${c}`
    let card = createEmptyCard(new Date(now - 12 * DAY))
    let tt = now - 12 * DAY + 20 * 3600000
    for (let k = 0; k < 4 && tt < now; k++) {
      const g = r() < 0.85 ? 3 : 1
      const days = card.last_review ? (tt - card.last_review.getTime()) / DAY : 0
      const R = card.stability > 0 ? Math.pow(1 + (Math.pow(0.9, 1 / -0.1542) - 1) * days / card.stability, -0.1542) : 0
      state.log.reviews.push([tt, id, g, Math.round(days * 1000) / 1000, Math.round(card.stability * 1000) / 1000, Math.round(R * 1000) / 1000, card.state])
      card = sched.next(card, new Date(tt), g).card
      tt = Math.max(card.due.getTime(), tt + DAY / 2) + 19 * 3600000 % DAY
    }
    state.cards[id] = card
  }
}
state.log.reviews.sort((a, b) => a[0] - b[0])
state.log.xp.push(...state.log.reviews.map((e) => [e[0], 2, 'c']))
state.log.xp.sort((a, b) => a[0] - b[0])
state.xpBy = { seed01: state.log.xp.reduce((a, e) => a + e[1], 0) + 100 + 45 }
state.xp = state.xpBy.seed01
state.reviewsBy = { seed01: state.log.reviews.length }
state.reviews = state.log.reviews.length
state.studyDays = [...new Set([...state.log.xp.map((e) => day(e[0]))])].sort()
state.streak.lastDay = day(now - DAY)
state.badges = { 'first-light': new Date(now - 13 * DAY).toISOString(), shielded: new Date(now - 12 * DAY).toISOString() }

// ---------- run ----------
const b = await chromium.launch()
const problems = []
const pages = [
  ['home', '/'],
  ['you', '/you'],
  ['settings', '/settings'],
  ['review', '/review'],
  ['map', '/map'],
  ['lesson', '/learn/A3#problems'],
]
for (const [name, viewport] of [['desk', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, isMobile: name === 'phone', hasTouch: name === 'phone' })
  await ctx.addInitScript((s) => { if (!localStorage.getItem('debye-state-v1')) localStorage.setItem('debye-state-v1', s) }, JSON.stringify(state))
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('fonts.g') && !m.text().includes('403') && problems.push(name + ' console: ' + m.text()))
  p.on('pageerror', (e) => problems.push(name + ' pageerror: ' + e.message))
  for (const [pn, path] of pages) {
    await p.goto(`http://localhost:${port}/?mocktutor#${path}`)
    await p.waitForTimeout(1500)
    const ke = await p.locator('.katex-error').allInnerTexts()
    ke.forEach((x) => problems.push(`${name} ${pn} katex-error: ${x}`))
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (overflow) problems.push(`${name} ${pn} page scrolls horizontally`)
    await p.screenshot({ path: `${out}/${name}-${pn}.png`, fullPage: true })
  }
  // struggle + tutor from a problem
  await p.goto(`http://localhost:${port}/?mocktutor#/learn/A3#problems`)
  await p.waitForTimeout(1200)
  const prob = p.locator('#problems .card').nth(3)
  await prob.scrollIntoViewIfNeeded()
  const input = prob.locator('input[type=text]')
  if (await input.count()) {
    for (const v of ['1', '2']) {
      await input.fill(v)
      await prob.locator('button:has-text("Check")').click()
      await p.waitForTimeout(300)
    }
    await prob.screenshot({ path: `${out}/${name}-struggle.png` })
    const ask = prob.locator('button:has-text("Ask the tutor")')
    if (await ask.count()) {
      await ask.click()
      await p.waitForTimeout(4500)
      await p.screenshot({ path: `${out}/${name}-tutor.png` })
      const txt = await p.locator('.tutor-msg.bot').last().innerText()
      if (!txt.includes('restoring')) problems.push(name + ' tutor reply did not stream: ' + txt.slice(0, 80))
      await p.locator('button[aria-label="Close tutor"]').click()
    } else problems.push(name + ' no Ask the tutor button after two misses')
  } else problems.push(name + ' problem 4 of A3 is not numeric; struggle test skipped')
  await ctx.close()
}
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no problems')
await b.close()
