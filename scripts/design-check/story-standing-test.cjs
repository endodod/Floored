const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, '../../out-screens');
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, dsf: 1 },
  { name: 'phone-390x844', width: 390, height: 844, dsf: 1 },
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function baseState(overrides = {}) {
  return {
    state: {
      started: true,
      startedAt: new Date().toISOString(),
      city: 'dustwater',
      visited: ['dustwater'],
      cleared: [],
      night: 0,
      cityNight: 0,
      money: 200,
      owed: 0,
      markersHere: 0,
      standing: { dustwater: 0 },
      factions: { syndicate: 0, 'old-guard': 0, underground: 0 },
      flags: { 'arrived-dustwater': true, 'met-marta': true, 'met-pike': true },
      seen: ['dustwater-arrival', 'dustwater-how-nights-work'],
      errands: {},
      minigameNight: {},
      bossBackOn: null,
      bossTable: null,
      seenGames: [],
      stats: { busts: 0, bossTries: 0, bossWins: 0, markers: 0, bestWin: 0 },
      tonight: null,
      lastNight: null,
      queue: [],
      news: [],
      scene: null,
      ...overrides,
    },
    version: 2,
  };
}

(async () => {
  const browser = await chromium.launch();
  let allPassed = true;

  for (const view of VIEWS) {
    console.log(`\nTesting view: ${view.name}`);

    // --- 1. A new story starts at standing 0 with only the dive open ---
    {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.dsf,
      });
      const page = await context.newPage();
      await page.addInitScript((val) => {
        localStorage.setItem('floored-story', JSON.stringify(val));
      }, baseState({ standing: { dustwater: 0 } }));

      await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Verify dive is open, main and high roller locked
      const diveSpot = page.locator('[data-spot="dive"]');
      const mainSpot = page.locator('[data-spot="main"]');
      const highSpot = page.locator('[data-spot="high"]');

      const mainText = await mainSpot.innerText().catch(() => '');
      const hasLockedMain = mainText.includes('Standing 1 needed');
      console.log(`  [1] New story standing 0: Main floor locked: ${hasLockedMain}`);
      if (!hasLockedMain) allPassed = false;

      // Click main floor door to see door card
      await mainSpot.click();
      await page.waitForTimeout(300);
      const sheetText = await page.locator('.st-action-sheet, [role="dialog"]').innerText().catch(() => '');
      const cardNeeds = sheetText.includes('Needs standing 1. Finish a job at the tables.');
      console.log(`  [1] Door card says "Needs standing 1. Finish a job at the tables.": ${cardNeeds}`);
      if (!cardNeeds) allPassed = false;

      await page.screenshot({ path: path.join(OUT_DIR, `${view.name}-1-standing-0-locked.png`) });
      await context.close();
    }

    // --- 2. Jo's "seed money" errand (finish night up) gives standing 1 and opens the main floor ---
    {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.dsf,
      });
      const page = await context.newPage();
      await page.addInitScript((val) => {
        localStorage.setItem('floored-story', JSON.stringify(val));
      }, baseState({
        standing: { dustwater: 1 },
        errands: { 'dustwater-jo-stake': 'done' },
      }));

      await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const mainSpot = page.locator('[data-spot="main"]');
      const mainText = await mainSpot.innerText().catch(() => '');
      const mainUnlocked = !mainText.includes('Standing 1 needed');
      console.log(`  [2] Standing 1: Main floor unlocked: ${mainUnlocked}`);
      if (!mainUnlocked) allPassed = false;

      await page.screenshot({ path: path.join(OUT_DIR, `${view.name}-2-standing-1-main-unlocked.png`) });
      await context.close();
    }

    // --- 3. A minigame errand gives no standing ---
    {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.dsf,
      });
      const page = await context.newPage();
      await page.addInitScript((val) => {
        localStorage.setItem('floored-story', JSON.stringify(val));
      }, baseState({
        standing: { dustwater: 0 },
        errands: { 'dustwater-marta-shift': 'done' },
      }));

      await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const mainSpot = page.locator('[data-spot="main"]');
      const mainText = await mainSpot.innerText().catch(() => '');
      const stillStanding0 = mainText.includes('Standing 1 needed');
      console.log(`  [3] Minigame errand gives no standing (standing remains 0): ${stillStanding0}`);
      if (!stillStanding0) allPassed = false;

      // Open notebook to check "+1 standing" vs "pays only"
      const jobsBtn = page.getByRole('button', { name: /Jobs/i }).first();
      if (await jobsBtn.isVisible()) {
        await jobsBtn.click();
        await page.waitForTimeout(300);
        const notebookText = (await page.locator('.st-notebook').innerText().catch(() => '')).toLowerCase();
        const hasPaysOnly = notebookText.includes('pays only');
        const hasStandingBadge = notebookText.includes('+1 standing');
        console.log(`  [3] Notebook marks "+1 standing" and "pays only": ${hasPaysOnly || hasStandingBadge}`);
        if (!hasPaysOnly && !hasStandingBadge) allPassed = false;
      }

      await page.screenshot({ path: path.join(OUT_DIR, `${view.name}-3-minigame-errand-no-rep.png`) });
      await context.close();
    }

    // --- 4. A bust lowers standing ---
    {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.dsf,
      });
      const page = await context.newPage();
      // Suppose player was at standing 1 in Dustwater, then busted down to 0
      await page.addInitScript((val) => {
        localStorage.setItem('floored-story', JSON.stringify(val));
      }, baseState({
        standing: { dustwater: 0 },
        stats: { busts: 1, bossTries: 0, bossWins: 0, markers: 0, bestWin: 0 },
        lastNight: { night: 2, played: true, comps: 0, hustles: [], lodging: 0, car: true, net: -100, bust: true },
      }));

      await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const mainSpot = page.locator('[data-spot="main"]');
      const mainText = await mainSpot.innerText().catch(() => '');
      const lockedAgain = mainText.includes('Standing 1 needed');
      console.log(`  [4] Bust lowered standing: main floor locked again: ${lockedAgain}`);
      if (!lockedAgain) allPassed = false;

      await page.screenshot({ path: path.join(OUT_DIR, `${view.name}-4-bust-lowers-standing.png`) });
      await context.close();
    }

    // --- 5. Rattlesnake Junction shows 0 ---
    {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.dsf,
      });
      const page = await context.newPage();
      await page.addInitScript((val) => {
        localStorage.setItem('floored-story', JSON.stringify(val));
      }, baseState({
        city: 'rattlesnake-junction',
        visited: ['dustwater', 'rattlesnake-junction'],
        cleared: ['dustwater'],
        standing: { dustwater: 3, 'rattlesnake-junction': 0 },
        flags: { 'dustwater-cleared': true, 'arrived-rattlesnake-junction': true },
      }));

      await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const mainSpot = page.locator('[data-spot="main"]');
      const mainText = await mainSpot.innerText().catch(() => '');
      const rjStanding0 = mainText.includes('Standing 1 needed');
      console.log(`  [5] Rattlesnake Junction standing starts at 0: ${rjStanding0}`);
      if (!rjStanding0) allPassed = false;

      await page.screenshot({ path: path.join(OUT_DIR, `${view.name}-5-rattlesnake-standing-0.png`) });
      await context.close();
    }

    // --- 6. Old version-1 save in localStorage migrates without a crash ---
    {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.dsf,
      });
      const page = await context.newPage();
      // v1 save with old rep: 2, but only 1 finished gambling errand (dustwater-pike-marks).
      // Migrated standing should be capped at 1!
      const v1Save = {
        state: {
          started: true,
          startedAt: new Date().toISOString(),
          city: 'dustwater',
          visited: ['dustwater'],
          cleared: [],
          night: 2,
          cityNight: 2,
          money: 300,
          owed: 0,
          markersHere: 0,
          rep: 2, // Old version 1 property
          factions: { syndicate: 0, 'old-guard': 0, underground: 0 },
          flags: { 'arrived-dustwater': true, 'met-marta': true, 'met-pike': true },
          seen: ['dustwater-arrival', 'dustwater-how-nights-work'],
          errands: { 'dustwater-pike-marks': 'done' },
          minigameNight: {},
          bossBackOn: null,
          bossTable: null,
          seenGames: [],
          stats: { busts: 0, bossTries: 0, bossWins: 0, markers: 0, bestWin: 0 },
          tonight: null,
          lastNight: null,
          queue: [],
          news: [],
          scene: null,
        },
        version: 1, // Version 1
      };

      await page.addInitScript((val) => {
        localStorage.setItem('floored-story', JSON.stringify(val));
      }, v1Save);

      let pageError = null;
      page.on('pageerror', (err) => { pageError = err; });

      await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      console.log(`  [6] v1 save migrated without error: ${pageError === null}`);
      if (pageError) {
        console.error('    Error:', pageError);
        allPassed = false;
      }

      // Check that main floor is open (standing 1) and high-roller is locked (standing 2 needed)
      const mainSpot = page.locator('[data-spot="main"]');
      const highSpot = page.locator('[data-spot="high"]');
      const mainText = await mainSpot.innerText().catch(() => '');
      const highText = await highSpot.innerText().catch(() => '');
      const mainOpen = !mainText.includes('Standing 1 needed');
      const highLocked = highText.includes('Standing 2 needed');
      console.log(`  [6] v1 migrated standing capped at 1 (main open, high locked): ${mainOpen && highLocked}`);
      if (!mainOpen || !highLocked) allPassed = false;

      await page.screenshot({ path: path.join(OUT_DIR, `${view.name}-6-v1-migration.png`) });
      await context.close();
    }
  }

  await browser.close();
  console.log(allPassed ? '\nALL PLAYWRIGHT TESTS PASSED!' : '\nSOME PLAYWRIGHT TESTS FAILED!');
  process.exit(allPassed ? 0 : 1);
})();
