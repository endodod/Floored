// Drive a game: node scripts/design-check/play-game.cjs <out.png> <route> [steps...]; a step is "click:<text>", "wait:<ms>", "shot:<file>"
const { chromium } = require('playwright');
(async () => {
  const [out, route, ...steps] = process.argv.slice(2);
  const w = +(process.env.W || 1440), h = +(process.env.H || 900);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DSF || 1) });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto((process.env.BASE_URL || 'http://localhost:3000') + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  for (const st of steps) {
    const [k, ...rest] = st.split(':'); const v = rest.join(':');
    if (k === 'click') { const loc = v.startsWith('css=') ? p.locator(v.slice(4)).first() : p.getByRole('button', { name: v, exact: false }).first(); await loc.click({ timeout: 5000 }).catch((e) => console.log('click failed', v, e.message.split('\n')[0])); }
    else if (k === 'wait') await p.waitForTimeout(+v);
    else if (k === 'shot') await p.screenshot({ path: v });
  }
  await p.screenshot({ path: out });
  if (errs.length) console.log('page errors', errs);
  await b.close();
})();
