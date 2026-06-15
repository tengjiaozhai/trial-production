/**
 * E2E Test: Step 1 → Step 2 transition
 *
 * Verifies that after filling the Step 1 form and clicking "点此开始解析",
 * Step 2 renders with Univer cell data (canvas elements + workbench-container).
 *
 * This tests the univerReady fix: on first mount, Univer should render cell data,
 * not just the shell layout.
 */
const { chromium } = require('/Users/shenmingjie/.nvm/versions/node/v24.13.1/lib/node_modules/@playwright/cli/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_PATH = '/Volumes/PortableSSD/tin/trial-production/output/trial-production/e2e-step1-to-step2.png';
const CHROME_PATH = '/Users/shenmingjie/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

(async () => {
  // Ensure output dir exists
  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });

  // Create a minimal dummy xlsx (PK header = valid zip, xlsx is a zip format)
  const dummyXlsx = path.join(path.dirname(SCREENSHOT_PATH), 'dummy-e2e.xlsx');
  fs.writeFileSync(dummyXlsx, Buffer.from('PK\x03\x04', 'latin1'));

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  try {
    // 1. Open app
    console.log('[1] Opening http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 2. Fill Step 1 form
    console.log('[2] Filling Step 1 form...');
    await page.locator('input').nth(0).fill('TestProject');
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('input[type="file"]').setInputFiles(dummyXlsx);
    await page.waitForTimeout(500);

    // Type PCBA identifier and press Enter
    const pcbaInput = page.locator('input[placeholder*="主板标识"]');
    await pcbaInput.fill('MB-TEST');
    await pcbaInput.press('Enter');
    await page.waitForTimeout(500);

    // Try to check the checkbox next to MB-TEST
    try {
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 1000 })) {
        await checkbox.check();
      }
    } catch (_) {
      // Checkbox may not be visible — continue anyway
    }

    // 3. Click "点此开始解析"
    console.log('[3] Clicking "点此开始解析" ...');
    await page.locator('button:has-text("点此开始解析")').click();

    // 4. Wait for Step 2 sheet to appear
    console.log('[4] Waiting for [data-testid="trial-production-sheet"] ...');
    await page.locator('[data-testid="trial-production-sheet"]').waitFor({ state: 'attached', timeout: 30000 });

    // 5. Wait additional 3s for Univer to finish rendering
    console.log('[5] Waiting 3s for Univer render...');
    await page.waitForTimeout(3000);

    // 6. Check canvas count
    const canvasCount = await page.locator('[data-testid="trial-production-sheet"] canvas').count();

    // 7. Screenshot
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    console.log(`[Screenshot] Saved to ${SCREENSHOT_PATH}`);

    // 8. Verdict — canvas >= 1 means Univer rendered cell data (not just shell)
    const pass = canvasCount >= 1;
    console.log('');
    console.log('=== RESULTS ===');
    console.log(`  Canvas count (inside sheet): ${canvasCount}  (expected >= 1)`);
    console.log(`  Page errors:                 ${errors.length}`);
    if (errors.length > 0) {
      for (const e of errors.slice(0, 5)) console.log(`    - ${e.slice(0, 200)}`);
    }
    console.log('');
    if (pass) {
      console.log('PASS: Univer rendered cell data on first mount.');
    } else {
      console.log('FAIL: Univer did NOT render cell data — only shell layout present.');
      if (canvasCount === 0) console.log('  Reason: zero canvas elements found.');
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
    console.log('FAIL: Script error — screenshot saved for inspection.');
  } finally {
    await browser.close();
  }
})();
