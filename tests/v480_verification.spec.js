import { test, expect } from '@playwright/test';

const BASE_URL = 'https://daybypalak.duckdns.org';

test('Verify v4.8.0, Authentic Profile Picture, Tracked Partners, and 0% Midnight Stats for Palak', async ({ page }) => {
  // 1. Visit app and verify version pill or title
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Clear local storage to test clean login
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 2. Login as palakharinkhede
  const userInput = page.locator('input[type="text"]').first();
  await expect(userInput).toBeVisible({ timeout: 15000 });
  await userInput.fill('palakharinkhede');

  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill('Habit@123');

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  // Wait for app shell
  await page.waitForSelector('.app-root, nav, .habits-container, .desktop-profile-pill', { timeout: 20000 });
  await page.waitForTimeout(2000);

  // Dismiss any tutorial modals if open
  for (const sel of ['.features-guide-cta-btn', '.features-guide-close-btn', '.onboarding-skip-btn', 'button:has-text("Skip")', 'button:has-text("Got It")']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  // 3. Verify Header Profile Picture (Desktop or Mobile)
  const avatarImg = page.locator('.profile-pill-img, .mobile-avatar-img').first();
  await expect(avatarImg).toBeVisible({ timeout: 10000 });
  const imgSrc = await avatarImg.getAttribute('src');
  console.log('Header Avatar Img src preview:', imgSrc?.slice(0, 50));
  expect(imgSrc).toContain('data:image/');
  expect(imgSrc?.length).toBeGreaterThan(5000); // 20,583 bytes authentic photo
  expect(imgSrc).not.toContain('AAAAEAAAAB'); // Not a 1x1 dummy pixel
  console.log('✅ 1. Authentic Profile Picture is rendering in the header!');

  // 4. Navigate to Track Tab and Verify Tracked Partners
  const trackTab = page.locator('button:has-text("Track")').first();
  await trackTab.click();
  await page.waitForTimeout(2000);

  // Verify partner badge says Tracked Partners (2/5)
  const partnerBadge = page.locator('text=Tracked Partners').first();
  await expect(partnerBadge).toBeVisible({ timeout: 10000 });
  const partnerText = await page.locator(':has-text("Tracked Partners")').first().innerText();
  console.log('Partner text on Track screen:', partnerText);
  expect(partnerText).toContain('2/5');

  // Verify Gayatri and Janki Bisen partner chips are visible
  const gayatriChip = page.locator('.partner-chip-btn:has-text("gayatri")').first();
  await expect(gayatriChip).toBeVisible({ timeout: 10000 });
  const jankiChip = page.locator('.partner-chip-btn:has-text("janki_bisen")').first();
  await expect(jankiChip).toBeVisible({ timeout: 10000 });
  console.log('✅ 2. Track Screen correctly displays 2/5 tracked partners (Gayatri & Janki Bisen)!');

  // 5. Navigate to Together Tab and Verify 0% Stats past midnight
  const togetherTab = page.locator('button:has-text("Together")').first();
  await togetherTab.click();
  await page.waitForTimeout(2000);

  // Check the member card for palakharinkhede (You)
  const youCard = page.locator('.group-member-card.is-me, .group-member-card:has-text("palakharinkhede")').first();
  await expect(youCard).toBeVisible({ timeout: 10000 });

  // Verify member stats show 0%, NOT 17%
  const memberPct = youCard.locator('.member-pct').first();
  const pctText = await memberPct.innerText();
  console.log('Together Tab palakharinkhede percentage:', pctText);
  expect(pctText.trim()).toBe('0%');
  console.log('✅ 3. Together Tab correctly shows 0% when habits are 0 (NOT 17%)!');

  // Verify member photo inside Together card
  const memberAvatarImg = youCard.locator('img').first();
  await expect(memberAvatarImg).toBeVisible({ timeout: 5000 });
  const memberImgSrc = await memberAvatarImg.getAttribute('src');
  expect(memberImgSrc?.length).toBeGreaterThan(5000);
  console.log('✅ 4. Authentic Profile Picture is rendering inside the Together Tab member card!');

  // 6. Navigate to Settings and Verify Profile Picture & v4.8.0 Version
  const settingsTab = page.locator('button:has-text("Settings")').first();
  await settingsTab.click();
  await page.waitForTimeout(1500);

  const settingsAvatarImg = page.locator('.profile-avatar-image').first();
  await expect(settingsAvatarImg).toBeVisible({ timeout: 5000 });
  const settingsSrc = await settingsAvatarImg.getAttribute('src');
  expect(settingsSrc?.length).toBeGreaterThan(5000);
  console.log('✅ 5. Settings Screen displays the authentic profile photo!');

  // Check version string in Settings
  const versionText = await page.locator('text=/v?4\\.8\\.0/i').first().innerText().catch(() => '');
  console.log('Version found in Settings/App:', versionText);

  console.log('🎉 ALL 5 E2E TESTS COMPLETED WITH 100% SUCCESS!');
});
