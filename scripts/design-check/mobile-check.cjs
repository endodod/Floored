// Mobile layout audit: phone-sized viewport, checks every game mode page for
// horizontal overflow, content cut off by a clipping container, unreachable
// controls (page scrolls to reach a button) and overlapping controls.
//
//   node scripts/design-check/mobile-check.cjs ./out /freeplay /freeplay/blackjack
//   node scripts/design-check/mobile-check.cjs ./out "/freeplay/blackjack|click:Add 100|click:Deal|wait:900"
//
// A route is "<path>" or "<path>|<click:text>|<click:css=selector>|<wait:ms>".
// W / H / DSF set the viewport (default: Pixel 9, 412x915).
const { chromium } = require('playwright')

const W = +(process.env.W || 412)
const H = +(process.env.H || 915)
const DSF = +(process.env.DSF || 2.625)
const BASE = process.env.BASE_URL || 'http://localhost:3000'

const AUDIT = () => {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const main = document.querySelector('main')
  const visible = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && cs.position !== 'fixed'
  }
  // Is the element hidden by an ancestor that clips it?
  const clipper = (el) => {
    let a = el.parentElement
    while (a && a !== document.body) {
      const s = getComputedStyle(a)
      if (/(hidden|clip)/.test(s.overflowX + s.overflowY)) return a
      a = a.parentElement
    }
    return null
  }

  const poking = []
  const clipped = []
  for (const el of document.querySelectorAll('main *')) {
    if (!visible(el)) continue
    if (el.closest('[aria-hidden="true"], .tile-suit, .invisible') || (el.ownerSVGElement && el.tagName.toLowerCase() !== 'svg')) continue
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    if (r.right > vw + 1 && !clipper(el)) poking.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} +${Math.round(r.right - vw)}px`)
    if (r.left < -1 && !clipper(el)) poking.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} -${Math.round(-r.left)}px`)
    const c = clipper(el)
    if (!c) continue
    if (el.children.length && el.textContent.trim() === '') continue
    const cr = c.getBoundingClientRect()
    const over = Math.max(cr.left - r.left, r.right - cr.right, cr.top - r.top, r.bottom - cr.bottom)
    if (over > 3) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} "${el.textContent.trim().slice(0, 18)}" cut ${Math.round(over)}px`)
  }

  // Controls the player has to scroll to reach, and pages that scroll at all.
  const scrollers = []
  for (const el of [document.documentElement, document.body, main]) {
    if (!el) continue
    if (el.scrollHeight - el.clientHeight > 2) scrollers.push(`${el.tagName.toLowerCase()} +${el.scrollHeight - el.clientHeight}px`)
  }
  const offscreen = []
  for (const el of document.querySelectorAll('main button, main a, main [role="radio"], main input')) {
    if (!visible(el) || el.closest('[aria-hidden="true"]')) continue
    const r = el.getBoundingClientRect()
    if (r.bottom > vh + 2 || r.top < -2) offscreen.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}" ${r.top < -2 ? 'above' : `below by ${Math.round(r.bottom - vh)}px`}`)
  }

  // Overlapping controls: two clickable siblings in the same row whose boxes intersect noticeably.
  const clicks = [...document.querySelectorAll('main button, main a, nav a, nav button')].filter(visible)
  const overlaps = []
  for (let i = 0; i < clicks.length; i++) {
    for (let j = i + 1; j < clicks.length; j++) {
      const a = clicks[i]
      const b = clicks[j]
      if (a.contains(b) || b.contains(a)) continue
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
      if (ox > 2 && oy > 2) {
        // A control deliberately stacked over a board spot (Roulette chips) is absolute; skip those.
        const pos = getComputedStyle(a).position + getComputedStyle(b).position
        if (pos.includes('absolute') || pos.includes('fixed')) continue
        overlaps.push(`"${(a.getAttribute('aria-label') || a.textContent).trim().slice(0, 16)}" ∩ "${(b.getAttribute('aria-label') || b.textContent).trim().slice(0, 16)}" ${Math.round(ox)}×${Math.round(oy)}px`)
      }
    }
  }

  return {
    docOverflow: document.documentElement.scrollWidth - vw,
    mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
    scrollers,
    offscreen: offscreen.slice(0, 6),
    poking: poking.slice(0, 6),
    clipped: clipped.slice(0, 6),
    overlaps: overlaps.slice(0, 6),
  }
}

;(async () => {
  const [out, ...specs] = process.argv.slice(2)
  // `channel: 'chromium'` uses the full browser build, not the headless shell.
  const browser = await chromium.launch({ channel: 'chromium' })
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: DSF,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url().slice(-60)}`))
  let failures = 0

  for (const spec of specs) {
    const [route, ...steps] = spec.split('|')
    await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(3500)
    for (const st of steps) {
      const [k, ...rest] = st.split(':')
      const v = rest.join(':')
      if (k === 'click') {
        const loc = v.startsWith('css=') ? page.locator(v.slice(4)).first() : page.getByRole('button', { name: v, exact: false }).first()
        await loc.click({ timeout: 4000 }).catch((e) => console.log('  click failed:', v, e.message.split('\n')[0]))
        await page.waitForTimeout(250)
      } else if (k === 'auto') {
        // Place a chip, then press the dock's primary action.
        await page.evaluate(() => {
          const chip = [...document.querySelectorAll('main [aria-label^="Add "], main [aria-label$="chip"]')].find((b) => !b.disabled)
          chip?.click()
        })
        await page.waitForTimeout(200)
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll('main button')].filter((b) => !b.disabled && b.offsetParent)
          const primary = btns.find((b) => b.className.includes('btn-glow')) ?? btns[btns.length - 1]
          primary?.click()
        })
        await page.waitForTimeout(600)
      } else if (k === 'wait') await page.waitForTimeout(+v)
      else if (k === 'scroll') await page.evaluate((y) => window.scrollTo(0, y), +v)
      else if (k === 'shot') await page.screenshot({ path: v })
    }
    // Game pages must fit the screen without scrolling; hub pages (lobbies) may scroll.
    const path = new URL(page.url()).pathname
    const isGame =
      /^\/(freeplay|daily|ladder|survival)\/[^/]+$/.test(path) || /^\/tables\/(?!lobby$)[^/]+$/.test(path)
    const res = await page.evaluate(AUDIT)
    if (!isGame) {
      res.scrollers = []
      res.offscreen = []
    }
    const bad =
      res.docOverflow > 0 || res.mainOverflow > 0 || res.scrollers.length > 0 ||
      res.offscreen.length > 0 || res.poking.length > 0 || res.clipped.length > 0 || res.overlaps.length > 0
    if (bad) failures++
    console.log(`${bad ? 'FAIL' : 'ok  '} ${spec}`)
    if (bad) {
      for (const k of ['scrollers', 'offscreen', 'poking', 'clipped', 'overlaps']) {
        if (res[k].length) console.log(`     ${k}: ${JSON.stringify(res[k])}`)
      }
      if (res.docOverflow > 0) console.log(`     docOverflow: ${res.docOverflow}px`)
      if (res.mainOverflow > 0) console.log(`     mainOverflow: ${res.mainOverflow}px`)
    }
    const slug = (path.replace(/[^a-z0-9]+/gi, '_') || 'root') + (steps.length ? `_${steps.filter((s) => s.startsWith('auto') || s.startsWith('click')).length}` : '')
    await page.screenshot({ path: `${out}/${slug}.png` })
    await page.screenshot({ path: `${out}/${slug}_full.png`, fullPage: true })
  }
  if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5))
  console.log(`${specs.length - failures}/${specs.length} routes clean`)
  await browser.close()
})()
