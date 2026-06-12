// Look at deeper structure: where does Univer actually render cell data?
const { chromium } = require('/Users/shenmingjie/.nvm/versions/node/v24.13.1/lib/node_modules/@playwright/cli/node_modules/playwright');
const fs = require('fs');

(async () => {
  const dummyXlsx = '/Users/shenmingjie/tinno/output/trial-production/dummy-config.xlsx';
  fs.writeFileSync(dummyXlsx, Buffer.from('PK\x03\x04', 'latin1'));

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/shenmingjie/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  });
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage());

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[console.${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.locator('input').nth(0).fill('ReproProject');
  await page.locator('select').nth(0).selectOption({ index: 1 });
  await page.locator('select').nth(1).selectOption({ index: 1 });
  await page.locator('input[type="file"]').setInputFiles(dummyXlsx);
  await page.waitForTimeout(500);

  const pcbaInput = page.locator('input[placeholder*="主板标识"]');
  await pcbaInput.fill('MB-X1');
  await pcbaInput.press('Enter');
  await page.waitForTimeout(500);

  await page.locator('button:has-text("点此开始解析")').click();
  await page.waitForTimeout(8000);

  // Dump structure: every element with data-u-comp attribute
  const comps = await page.evaluate(() => {
    const out = [];
    const all = document.querySelectorAll('[data-u-comp]');
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      out.push({
        comp: el.getAttribute('data-u-comp'),
        tag: el.tagName,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        childCount: el.children.length,
        hasCanvas: el.querySelector('canvas') !== null,
        hasSvg: el.querySelector('svg') !== null,
      });
    }
    return out;
  });
  console.log('=== data-u-comp elements ===');
  for (const c of comps) {
    console.log(`  ${c.comp}: tag=${c.tag} ${c.w}x${c.h} children=${c.childCount} canvas=${c.hasCanvas} svg=${c.hasSvg}`);
  }

  // Count canvases globally
  const canvasGlobal = await page.locator('canvas').count();
  console.log('=== global canvas count:', canvasGlobal, '===');

  // Try: look at the sheet container area, see if there's a row area
  const sheetHtml = await page.locator('[data-testid="trial-production-sheet"]').innerHTML();
  console.log('=== sheet innerHTML total length:', sheetHtml.length, '===');

  // Check if "sheets" rendering area exists
  const sheetContainerExists = await page.locator('[data-u-comp="workbench-container"]').count();
  console.log('=== workbench-container count:', sheetContainerExists);

  // Look for cell text in DOM
  const textContent = await page.locator('[data-testid="trial-production-sheet"]').textContent();
  console.log('=== sheet textContent (first 500):', textContent?.slice(0, 500));

  // Also try: click 4 to see if it pops up
  console.log('=== Now click 下一步 to go to step 3 ===');
  const nextBtn = page.locator('button:has-text("下一步")');
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(2000);
    const canvas3 = await page.locator('canvas').count();
    console.log('=== canvas count after click 下一步:', canvas3);
  }

  // Then click 上一步 to go back
  const backBtn = page.locator('button:has-text("上一步")');
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
    await page.waitForTimeout(2000);
    const canvasBack2 = await page.locator('canvas').count();
    console.log('=== canvas count after click 上一步 (back to 2):', canvasBack2);
  }

  // Then click 下一步 again
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(2000);
    const canvasForward2 = await page.locator('canvas').count();
    console.log('=== canvas count after click 下一步 again (forward to 3):', canvasForward2);
  }

  await page.screenshot({ path: '/Users/shenmingjie/tinno/output/trial-production/step2-deep.png', fullPage: true });
  await browser.close();
  console.log('=== Done ===');
})();
