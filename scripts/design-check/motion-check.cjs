// Motion setting check: plays a game under Motion = full and reduced and prints the animation of each matching element.
// node scripts/design-check/motion-check.cjs <route> <css selector> [steps...]   (steps as in play-game.cjs: click:<name>, wait:<ms>)
const { chromium } = require('playwright');
(async () => {
  const [route, selector, ...steps] = process.argv.slice(2);
  const b = await chromium.launch();
  for (const motion of ['full', 'reduced']) {
    const p = await b.newPage();
    await p.addInitScript((m) => localStorage.setItem('floored-settings', JSON.stringify({ state: { motion: m }, version: 0 })), motion);
    await p.goto((process.env.BASE_URL || 'http://localhost:3000') + route, { waitUntil: 'networkidle' });
    for (const st of steps) {
      const [k, ...rest] = st.split(':'); const v = rest.join(':');
      if (k === 'click') await (v.startsWith('css=') ? p.locator(v.slice(4)) : p.getByRole('button', { name: v })).first().click({ timeout: 5000 }).catch(() => console.log('  click failed', v));
      else if (k === 'wait') await p.waitForTimeout(+v);
    }
    const r = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
      const cs = getComputedStyle(el); return `${cs.animationName}/${cs.transitionDuration}`;
    }), selector);
    console.log(motion.padEnd(8), r.length ? r.join('  ') : '(no match)');
    await p.close();
  }
  await b.close();
})();
