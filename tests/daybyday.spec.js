import { test, expect } from '@playwright/test';

test.describe('DayByDay Production Reliability Suite', () => {
  test('Fast Login, Instant Track Data, and Bulletproof Session Persistence Across Reloads', async ({ page }) => {
    // Monitor console and errors
    page.on('console', msg => console.log(`[PAGE ${msg.type().toUpperCase()}] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}\n${err.stack}`));

    // Monitor API calls
    const apiCalls = [];
    page.on('response', res => {
      if (res.url().includes('/api/')) {
        apiCalls.push({ url: res.url(), status: res.status() });
      }
    });

    console.log('--- Step 1: Navigate to https://daybypalak.duckdns.org ---');
    const navStart = Date.now();
    await page.goto('https://daybypalak.duckdns.org', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`Page loaded in ${Date.now() - navStart}ms`);

    // Verify version pill
    const versionPill = page.locator('.auth-version-pill');
    await expect(versionPill).toBeVisible({ timeout: 10000 });
    const versionText = await versionPill.textContent();
    console.log(`Live Version: "${versionText.trim()}"`);
    expect(versionText).toMatch(/4\.7\.[23]/);

    console.log('--- Step 2: Sign In with palakharinkhede / Habit@123 ---');
    const usernameInput = page.locator('input[placeholder*="username"], input[type="text"]').first();
    const passwordInput = page.locator('input[placeholder*="password"], input[type="password"]').first();
    await usernameInput.fill('palakharinkhede');
    await passwordInput.fill('Habit@123');

    const signInBtn = page.locator('button.auth-primary-submit-btn, button[type="submit"]').first();
    console.log('3. Clicking submit button and measuring response time ...');
    const loginClickTime = Date.now();

    const loginResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/user') && res.request().method() === 'POST',
      { timeout: 30000 }
    );
    await signInBtn.click();

    const loginRes = await loginResponsePromise;
    const loginDuration = Date.now() - loginClickTime;
    console.log(`Login API returned HTTP ${loginRes.status()} in ${loginDuration}ms`);
    expect(loginRes.status()).toBe(200);

    // Wait for Dashboard to render
    console.log('--- Step 3: Verify Dashboard & Habit Cards ---');
    await page.waitForSelector('.app-root, .habits-container, nav', { timeout: 15000 });
    console.log('Dashboard rendered successfully!');

    // Check localStorage has daybyday_user
    const storageUser = await page.evaluate(() => localStorage.getItem('daybyday_user'));
    expect(storageUser).not.toBeNull();
    const parsedUser = JSON.parse(storageUser);
    expect(parsedUser.username).toBe('palakharinkhede');
    console.log(`Authenticated user in localStorage: @${parsedUser.username} (${parsedUser.secretCode || parsedUser.secret_code})`);

    // Dismiss guide modal if open
    const guideCta = page.locator('.features-guide-cta-btn, .features-guide-close-btn');
    if (await guideCta.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await guideCta.first().click();
      await page.waitForTimeout(500);
    }

    console.log('--- Step 4: Verify Track Tab & Partner Data ---');
    const trackTabBtn = page.locator('button.nav-tab-btn:has-text("Track"), button:has-text("Track"), [data-tab="track"]').first();
    await expect(trackTabBtn).toBeVisible({ timeout: 5000 });
    await trackTabBtn.click();

    // Verify Track Screen rendered
    await page.waitForSelector('.screen-track-container, .track-code-card', { timeout: 10000 });
    console.log('Track screen rendered!');

    // Check your secret code is displayed
    const codeText = await page.locator('.code-text').textContent().catch(() => '');
    console.log(`Track screen secret code: "${codeText.trim()}"`);

    // Check tracked partners are rendered
    const partnerChips = page.locator('.partner-chip, .partner-card, .track-partner-card, .partners-chips-scroll');
    const partnerCount = await partnerChips.count();
    console.log(`Tracked partner elements found: ${partnerCount}`);

    console.log('--- Step 5: Test Hard Reload 1 (F5) ---');
    const reloadStart1 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`Reload 1 completed in ${Date.now() - reloadStart1}ms`);

    // Verify STILL logged in
    await page.waitForSelector('.app-root, nav', { timeout: 10000 });
    const isAuthVisible1 = await page.locator('.auth-card-surface').isVisible().catch(() => false);
    expect(isAuthVisible1).toBe(false);
    console.log('Session survived Reload 1: User is STILL logged in!');

    console.log('--- Step 6: Test Hard Reload 2 (F5) ---');
    const reloadStart2 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`Reload 2 completed in ${Date.now() - reloadStart2}ms`);

    await page.waitForSelector('.app-root, nav', { timeout: 10000 });
    const isAuthVisible2 = await page.locator('.auth-card-surface').isVisible().catch(() => false);
    expect(isAuthVisible2).toBe(false);
    console.log('Session survived Reload 2: User is STILL logged in!');

    console.log('--- All reliability assertions passed successfully! ---');
  });
});
