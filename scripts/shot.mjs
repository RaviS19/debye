import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const [port, path, out, w = '1280', h = '860', full = '0'] = process.argv.slice(2)
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage()
await p.goto(`http://localhost:${port}/#${path}`); await p.waitForTimeout(1500)
await p.screenshot({ path: out, fullPage: full === '1' }); await b.close()
