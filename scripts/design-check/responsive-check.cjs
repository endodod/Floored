// Responsiveness pass: phones, tablets, monitors and browser zoom (a 1440×900 laptop at 150% and 200%).
// Flags horizontal overflow and elements that poke past the right edge; screenshots each view.
const { chromium } = require('playwright');
const VIEWS = [
  ['phone-390', 390, 844, 3], ['phone-360', 360, 740, 3], ['tablet-768', 768, 1024, 2],
  ['laptop-1280x720', 1280, 720, 1], ['desk-1920', 1920, 1080, 1], ['qhd-2560', 2560, 1440, 1],
  ['zoom150-1440', 960, 600, 1.5], ['zoom200-1440', 720, 450, 2],
];
(async () => {
  const out = process.argv[2]; const routes = process.argv.slice(3);
  const only = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
  const b = await chromium.launch();
  for (const [name, w, h, dsf] of VIEWS) {
    if (only && !only.includes(name)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: name.startsWith('phone'), hasTouch: name.startsWith('phone') });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    for (const r of routes) {
      await p.goto((process.env.BASE_URL || 'http://localhost:3000') + r, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(1800);
      const res = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const docOverflow = document.documentElement.scrollWidth - vw;
        const main = document.querySelector('main');
        const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;
        const poking = [];
        for (const el of document.querySelectorAll('main *')) {
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
          const rc = el.getBoundingClientRect(); if (rc.width === 0 || rc.height === 0) continue;
          // skip things inside a horizontally scrolling or clipping ancestor
          let a = el.parentElement, clipped = false;
          while (a && a !== document.body) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { const ar = a.getBoundingClientRect(); if (ar.right <= vw + 1) { clipped = true; break; } } a = a.parentElement; }
          if (!clipped && rc.right > vw + 1) poking.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,3).join('.')} →${Math.round(rc.right - vw)}px`);
        }
        // Content cut off by a clipping (overflow hidden) container — the board hides it, nothing scrolls.
        const clipped = [];
        for (const el of document.querySelectorAll('main *')) {
          if (el.closest('[aria-hidden="true"], .tile-suit, .invisible')) continue;
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.position === 'absolute' || +cs.opacity === 0) continue;
          if (el.children.length && el.textContent.trim() === '' && !['IMG','SVG','CANVAS','BUTTON'].includes(el.tagName.toUpperCase())) continue;
          const rc = el.getBoundingClientRect(); if (rc.width < 4 || rc.height < 4) continue;
          let a = el.parentElement;
          while (a && a.tagName !== 'MAIN') { const s = getComputedStyle(a); if (/(hidden|clip)/.test(s.overflowX + s.overflowY)) break; a = a.parentElement; }
          if (!a || a.tagName === 'MAIN') continue;
          const ar = a.getBoundingClientRect();
          const over = Math.max(ar.left - rc.left, rc.right - ar.right, ar.top - rc.top, rc.bottom - ar.bottom);
          if (over > 3) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,2).join('.')} cut ${Math.round(over)}px`);
        }
        return { docOverflow, mainOverflow, poking: poking.slice(0, 4), clipped: clipped.slice(0, 4) };
      });
      const bad = res.docOverflow > 0 || res.mainOverflow > 0 || res.poking.length || res.clipped.length;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${name.padEnd(16)} ${r.padEnd(22)} ${bad ? JSON.stringify(res) : ''}`);
      await p.screenshot({ path: `${out}/${name}${r.replace(/\//g, '_')}.png` });
    }
    if (errs.length) console.log('  page errors', name, errs.slice(0, 3));
    await ctx.close();
  }
  await b.close();
})();
