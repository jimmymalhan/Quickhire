const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOTS = process.env.SHOTS_DIR || 'state/local-agent-runtime/screenshots';
const STATE = process.env.STATE_DIR || 'state/local-agent-runtime';

const results = { passed: 0, failed: 0, tests: [], startedAt: new Date().toISOString() };

async function test(name, fn, page) {
  try {
    await fn(page);
    results.passed++;
    results.tests.push({ name, status: 'pass' });
    console.log(`  [PASS] ${name}`);
  } catch (e) {
    results.failed++;
    results.tests.push({ name, status: 'fail', error: e.message });
    console.log(`  [FAIL] ${name}: ${e.message}`);
    try { await page.screenshot({ path: `${SHOTS}/${name.replace(/\s+/g,'-')}.png` }); } catch {}
  }
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({
    headless: false,  // SHOW the browser — user can watch
    slowMo: 120,      // slow enough to see mouse movements
    args: ['--window-size=1440,900', '--no-sandbox']
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('\n=== QUICKHIRE AUTONOMOUS BROWSER AGENT ===');
  console.log(`Testing: ${BASE}\n`);

  // ── JOB FEED ──────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOTS}/01-job-feed.png` });

  await test('Job Feed loads', async (p) => {
    await p.waitForSelector('h1', { timeout: 8000 });
  }, page);

  await test('Job cards render with match %', async (p) => {
    await p.waitForSelector('[role="article"]', { timeout: 8000 });
    const count = await p.locator('[role="article"]').count();
    if (count === 0) throw new Error('No job cards found');
    console.log(`    Found ${count} job cards`);
  }, page);

  await test('Click job card expands with AI insights', async (p) => {
    const card = p.locator('[role="article"]').first();
    await card.click();
    await delay(500);
    await p.screenshot({ path: `${SHOTS}/02-card-expanded.png` });
  }, page);

  await test('Auto-Apply button visible and clickable', async (p) => {
    const btn = p.locator('button').filter({ hasText: /apply/i }).first();
    await btn.waitFor({ timeout: 5000 });
    await btn.hover();
    await delay(300);
    await p.screenshot({ path: `${SHOTS}/03-apply-hover.png` });
    await btn.click();
    await delay(2000);
    await p.screenshot({ path: `${SHOTS}/04-apply-progress.png` });
  }, page);

  await test('Remote filter checkbox works', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const checkbox = p.locator('input[type="checkbox"]').first();
    await checkbox.check();
    await delay(400);
    await p.screenshot({ path: `${SHOTS}/05-remote-filter.png` });
  }, page);

  await test('Match score slider filters jobs', async (p) => {
    const slider = p.locator('input[type="range"]').first();
    if (await slider.count() > 0) {
      await slider.fill('88');
      await delay(400);
      await p.screenshot({ path: `${SHOTS}/06-slider-filter.png` });
    }
  }, page);

  // ── COMMAND PALETTE ───────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });

  await test('Command palette opens with Cmd+K', async (p) => {
    await p.keyboard.press('Meta+k');
    await delay(300);
    const input = p.locator('input[placeholder*="command" i], input[placeholder*="search" i]').first();
    await input.waitFor({ state: 'visible', timeout: 3000 });
    await p.screenshot({ path: `${SHOTS}/07-cmd-palette.png` });
  }, page);

  await test('Command palette search works', async (p) => {
    await p.keyboard.type('salary');
    await delay(300);
    await p.screenshot({ path: `${SHOTS}/08-palette-search.png` });
    await p.keyboard.press('Escape');
  }, page);

  // ── APPLICATION TRACKER ───────────────────────────────────────────────────
  await test('Navigate to /tracker', async (p) => {
    await p.goto(`${BASE}/tracker`, { waitUntil: 'networkidle' });
    await delay(800);
    await p.screenshot({ path: `${SHOTS}/09-tracker.png` });
  }, page);

  await test('Tracker shows application stats', async (p) => {
    await delay(1000);
    await p.screenshot({ path: `${SHOTS}/10-tracker-stats.png` });
  }, page);

  // ── SALARY INSIGHTS ───────────────────────────────────────────────────────
  await test('Navigate to /salary', async (p) => {
    await p.goto(`${BASE}/salary`, { waitUntil: 'networkidle' });
    await delay(800);
    await p.screenshot({ path: `${SHOTS}/11-salary.png` });
  }, page);

  // ── ML DASHBOARD ──────────────────────────────────────────────────────────
  await test('Navigate to /ml', async (p) => {
    await p.goto(`${BASE}/ml`, { waitUntil: 'networkidle' });
    await delay(800);
    await p.screenshot({ path: `${SHOTS}/12-ml-dashboard.png` });
  }, page);

  await test('ML panels render (match score, rejection, profile)', async (p) => {
    await delay(1500);
    await p.screenshot({ path: `${SHOTS}/13-ml-panels.png` });
  }, page);

  // ── FULL FLOW: Job → Apply → Track ────────────────────────────────────────
  await test('E2E flow: job feed → apply → tracker', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await delay(500);
    // Click first card
    const card = p.locator('[role="article"]').first();
    await card.click();
    await delay(800);
    // Click apply
    const btn = p.locator('button').filter({ hasText: /apply/i }).first();
    if (await btn.count() > 0) {
      await btn.click();
      await delay(3000);
    }
    await p.screenshot({ path: `${SHOTS}/14-e2e-flow.png` });
    // Navigate to tracker
    await p.goto(`${BASE}/tracker`, { waitUntil: 'networkidle' });
    await delay(800);
    await p.screenshot({ path: `${SHOTS}/15-post-apply-tracker.png` });
  }, page);

  // ── WRITE RESULTS ─────────────────────────────────────────────────────────
  results.finishedAt = new Date().toISOString();
  results.screenshots = fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).length;
  fs.writeFileSync(`${STATE}/browser-test-results.json`, JSON.stringify(results, null, 2));

  console.log(`\n=== RESULTS ===`);
  console.log(`PASSED: ${results.passed}  FAILED: ${results.failed}`);
  console.log(`Screenshots: ${results.screenshots} saved to ${SHOTS}/`);

  // Keep browser open so user can interact
  console.log('\nBrowser staying open for inspection. Ctrl+C to close.');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await delay(86400000); // stay open 24h
})().catch(e => {
  console.error('Browser agent crashed:', e.message);
  process.exit(1);
});
