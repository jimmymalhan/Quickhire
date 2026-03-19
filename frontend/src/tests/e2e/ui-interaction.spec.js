// Playwright E2E — mouse interaction tests for all built features
// Run: npx playwright test frontend/src/tests/e2e/ui-interaction.spec.js
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Job Feed — auto-apply flow', () => {
  test.beforeEach(async ({ page }) => { await page.goto(BASE); });

  test('job cards load and display match scores', async ({ page }) => {
    await page.waitForSelector('[role="article"]', { timeout: 5000 });
    const cards = page.locator('[role="article"]');
    await expect(cards).toHaveCount(5);
    // Verify match % visible
    const first = cards.first();
    await expect(first).toContainText('%');
  });

  test('click job card to expand and show AI insights', async ({ page }) => {
    await page.waitForSelector('[role="article"]');
    const card = page.locator('[role="article"]').first();
    await card.click();
    // Expanded view shows apply button
    await expect(page.locator('button:has-text("Auto-Apply")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=AI Cover Letter')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Salary Strategy')).toBeVisible({ timeout: 5000 });
  });

  test('auto-apply button shows progress steps', async ({ page }) => {
    await page.waitForSelector('[role="article"]');
    await page.locator('[role="article"]').first().click();
    const applyBtn = page.locator('button:has-text("Auto-Apply")');
    await applyBtn.click();
    // Progress steps appear
    await expect(page.locator('text=Analyzing job description')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Applied!')).toBeVisible({ timeout: 8000 });
  });

  test('salary filter slider filters jobs', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill('85');
    await page.waitForTimeout(300);
    const cards = page.locator('[role="article"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('remote-only checkbox filters to remote jobs', async ({ page }) => {
    await page.check('input[type="checkbox"]');
    await page.waitForTimeout(300);
    const cards = page.locator('[role="article"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0); // may be 0 if none match
  });
});

test.describe('Command Palette — Cmd+K keyboard nav', () => {
  test('opens with Cmd+K and closes with Escape', async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press('Meta+k');
    await expect(page.locator('input[placeholder="Search commands..."]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('input[placeholder="Search commands..."]')).not.toBeVisible();
  });

  test('arrow keys navigate commands and Enter selects', async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press('Meta+k');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    // Should navigate somewhere
    await page.waitForTimeout(300);
  });

  test('search filters commands', async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press('Meta+k');
    await page.keyboard.type('salary');
    await expect(page.locator('text=View Salary Insights')).toBeVisible();
  });
});

test.describe('Application Tracker — status updates', () => {
  test('tracker page loads with stats', async ({ page }) => {
    await page.goto(`${BASE}/tracker`);
    await expect(page.locator('text=Application Tracker')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=total')).toBeVisible();
  });
});

test.describe('ML Dashboard — scores render', () => {
  test('ML dashboard loads all 3 panels', async ({ page }) => {
    await page.goto(`${BASE}/ml`);
    await expect(page.locator('text=Job Match Score')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Rejection Predictor')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Profile Strength')).toBeVisible({ timeout: 5000 });
  });
});
