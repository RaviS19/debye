// Smoke-test one lesson in a real browser.
// Usage: node scripts/smoke.mjs <port> <lessonId> [outDir]
// Needs a dev server: npx vite --port <port> --strictPort
// Prints console errors, KaTeX parse errors, and writes screenshots of every simulation/plot card
// at desktop (1280px) and phone (390px) widths.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const [port, id, out = '/tmp/claude-0/shots/' + (process.argv[3] || 'x')] = process.argv.slice(2)
import { mkdirSync } from 'node:fs'
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const problems = []
for (const [name, viewport] of [['desk', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, isMobile: name === 'phone', hasTouch: name === 'phone' })
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('fonts.g') && problems.push(name + ' console: ' + m.text()))
  p.on('pageerror', (e) => problems.push(name + ' pageerror: ' + e.message))
  await p.goto('http://localhost:' + port + '/#/learn/' + id)
  await p.waitForTimeout(2500)
  const katexErrors = await p.locator('.katex-error').allInnerTexts()
  katexErrors.forEach((t) => problems.push(name + ' katex-error: ' + t))
  const title = await p.locator('h1').first().innerText().catch(() => '(no h1)')
  if (/not found|coming/i.test(title)) problems.push(name + ' lesson not registered: h1=' + title)
  await p.screenshot({ path: out + '/' + name + '-top.png' })
  const cards = p.locator('.card.glow:has(canvas)')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i)
    await c.scrollIntoViewIfNeeded()
    await p.waitForTimeout(3500)
    await c.screenshot({ path: out + '/' + name + '-canvas' + i + '.png' })
  }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  if (overflow) problems.push(name + ' page scrolls horizontally')
  console.log(name + ': ' + n + ' canvas cards, screenshots in ' + out)
  await ctx.close()
}
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no problems')
await b.close()
