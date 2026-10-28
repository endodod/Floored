// Like responsive-check.cjs but plays steps first (in-round states), across the same views.
const { chromium } = require('playwright');
const VIEWS = [['phone-360',360,740,3],['phone-390',390,844,3],['tablet-768',768,1024,2],['laptop-1280x720',1280,720,1],['qhd-2560',2560,1440,1],['zoom150-1440',960,600,1.5],['zoom200-1440',720,450,2]];
(async () => {
  const [out, route, ...steps] = process.argv.slice(2);
  const b = await chromium.launch();
  for (const [name,w,h,dsf] of VIEWS) {
    const p = await (await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:dsf })).newPage();
    await p.goto((process.env.BASE_URL || 'http://localhost:3000')+route, { waitUntil:'networkidle' }); await p.waitForTimeout(1200);
    for (const st of steps) { const [k,...r]=st.split(':'); const v=r.join(':');
      if (k==='click') { const loc = v.startsWith('css=') ? p.locator(v.slice(4)).first() : p.getByRole('button',{name:v}).first(); await loc.click({timeout:4000}).catch(()=>console.log('  click failed',name,v)); }
      else if (k==='wait') await p.waitForTimeout(+v); }
    await p.evaluate(() => document.querySelector('main')?.scrollTo(0,0));
    const res = await p.evaluate(() => {
      const clipped=[]; for (const el of document.querySelectorAll('main *')) {
        if (el.closest('[aria-hidden="true"], .tile-suit, .invisible')) continue;
        const cs=getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||cs.position==='absolute'||cs.position==='fixed'||+cs.opacity===0) continue;
        const rc=el.getBoundingClientRect(); if (rc.width<4||rc.height<4) continue;
        let a=el.parentElement; while (a && a.tagName!=='MAIN') { const s=getComputedStyle(a); if (/(hidden|clip)/.test(s.overflowX+s.overflowY)) break; a=a.parentElement; }
        if (!a||a.tagName==='MAIN') continue; const ar=a.getBoundingClientRect();
        const over=Math.max(ar.left-rc.left, rc.right-ar.right, ar.top-rc.top, rc.bottom-ar.bottom);
        if (over>3) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,2).join('.')} cut ${Math.round(over)}px`);
      }
      return { docX: document.documentElement.scrollWidth - document.documentElement.clientWidth, clipped: clipped.slice(0,4) };
    });
    console.log(`${res.docX>0||res.clipped.length?'FAIL':'ok  '} ${name.padEnd(16)} ${route} ${res.docX>0||res.clipped.length?JSON.stringify(res):''}`);
    await p.screenshot({ path: `${out}/play-${name}${route.replace(/\//g,'_')}.png` });
    await p.context().close();
  }
  await b.close();
})();
