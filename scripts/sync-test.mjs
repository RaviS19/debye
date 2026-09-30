// Two simulated devices sharing a mocked claude.ai store: checks that progress merges both ways,
// that a new answer on one device reaches the other, that a reset propagates, and that idle devices
// stop writing. Usage: node scripts/sync-test.mjs <port>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const port = process.argv[2]
const store = new Map()
const subs = []
let writes = 0
const push = (path) =>
  setTimeout(async () => {
    for (const s of subs.filter((x) => x.path === path)) {
      try {
        await s.page.evaluate(([p, d]) => window.__dbPush(p, d), [path, store.get(path) ?? null])
      } catch {
        /* page gone */
      }
    }
  }, 50)

const mock = () => {
  window.__dbListeners = {}
  window.__dbPush = (path, data) =>
    (window.__dbListeners[path] || []).forEach((fn) => fn({ exists: !!data, data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined), metadata: { fromCache: false, hasPendingWrites: false } }))
  window.claude = {
    use: async (name) => {
      if (name === 'user') return { id: async () => 'u_test' }
      if (name === 'db')
        return {
          doc: (path) => ({
            get: async () => ({ exists: false, data: () => undefined, metadata: { fromCache: false, hasPendingWrites: false } }),
            set: async (d) => {
              await window.__dbSet(path, d)
            },
            onSnapshot: (next) => {
              ;(window.__dbListeners[path] ||= []).push(next)
              window.__dbSub(path)
              return () => {}
            },
          }),
        }
      return null
    },
  }
}

function seed(device, xp, solved) {
  return JSON.stringify({
    version: 1, device, xp, xpBy: { [device]: xp }, streak: { count: 1, best: 1, lastDay: '2026-09-29', freezes: 0 }, studyDays: ['2026-09-29'],
    lessons: {}, problems: { [solved]: { attempts: 1, solved: true, firstTry: true } }, cards: {}, reviews: 0, reviewsBy: {}, simsUsed: {}, badges: {},
    log: { xp: [[Date.now() - 1000 * xp, xp, 'x']], attempts: [[Date.now() - 1000 * xp, solved, 1, 0, '', 0]], reviews: [], tutor: [] },
    retention: 0.9, epoch: '', reminder: { enabled: false, time: '19:00', days: [] }, lastNotified: null, lastDigest: null, sync: { enabled: true }, glow: 1, sound: false,
  })
}

const b = await chromium.launch()
const devices = []
for (const [name, xp, solved] of [['devA', 100, 'A1-p1'], ['devB', 50, 'A2-p1']]) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } })
  await ctx.exposeBinding('__dbSet', (_src, path, data) => {
    writes++
    store.set(path, data)
    push(path)
  })
  await ctx.exposeBinding('__dbSub', ({ page }, path) => {
    subs.push({ page, path })
    push(path)
  })
  await ctx.addInitScript(mock)
  await ctx.addInitScript((s) => { if (!localStorage.getItem('debye-state-v1')) localStorage.setItem('debye-state-v1', s) }, seed(name, xp, solved))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(name, 'pageerror', e.message))
  await page.goto(`http://localhost:${port}/#/`)
  devices.push({ name, page })
  await page.waitForTimeout(1500)
}
const read = (d) => d.page.evaluate(() => JSON.parse(localStorage.getItem('debye-state-v1')))
const fails = []
const check = (cond, msg) => (cond ? console.log('ok  ', msg) : (fails.push(msg), console.log('FAIL', msg)))

await devices[0].page.waitForTimeout(7000)
let [A, B] = [await read(devices[0]), await read(devices[1])]
check(A.xp === 150 && B.xp === 150, `both devices show the summed XP (A ${A.xp}, B ${B.xp})`)
check(A.problems['A2-p1']?.solved && B.problems['A1-p1']?.solved, 'each device has the other one’s solved problem')
check(A.device === 'devA' && B.device === 'devB', 'device ids stay local')

// New work on device A reaches device B.
await devices[0].page.goto(`http://localhost:${port}/#/learn/A1#problems`)
await devices[0].page.waitForTimeout(1200)
await devices[0].page.locator('#problems .card').nth(3).locator('button.opt').nth(2).click()
await devices[0].page.waitForTimeout(7000)
B = await read(devices[1])
check(B.problems['A1-p4']?.solved === true, 'a problem solved on A shows as solved on B')
check(B.xp === (await read(devices[0])).xp, `XP agrees after new work (B ${B.xp})`)

// Idle devices stop writing.
const w0 = writes
await devices[0].page.waitForTimeout(8000)
check(writes === w0, `no writes while idle (${writes - w0} extra)`)

// A reset on B wipes A too.
await devices[1].page.goto(`http://localhost:${port}/#/settings`)
await devices[1].page.waitForTimeout(800)
await devices[1].page.locator('button:has-text("Reset all progress")').click()
await devices[1].page.locator('button:has-text("Erase everything")').click()
await devices[1].page.waitForTimeout(7000)
A = await read(devices[0])
check(A.xp === 0 && Object.keys(A.problems).length === 0, `reset on B reached A (A xp ${A.xp})`)
check(A.reminder !== undefined && A.device === 'devA', 'A keeps its own device settings after the reset')
const w1 = writes
await devices[0].page.waitForTimeout(6000)
check(writes === w1, `no writes while idle after reset (${writes - w1} extra)`)
console.log(fails.length ? `\n${fails.length} FAILED` : '\nsync: all checks passed', `(${writes} writes in total)`)
await b.close()
