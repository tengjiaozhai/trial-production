/**
 * E2E Test: History load → Step 5 rendering
 *
 * Verifies that loading a history entry at Step 5 renders Univer cell data
 * (canvas elements + workbench-container), not just the shell layout.
 *
 * Strategy: inject a synthetic HistoryEntry into localStorage, reload,
 * open the history modal, load the entry, and verify Step 5 renders.
 */
const { chromium } = require('/Users/shenmingjie/.nvm/versions/node/v24.13.1/lib/node_modules/@playwright/cli/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_PATH = '/Users/shenmingjie/tinno/output/trial-production/e2e-history-step5.png';
const CHROME_PATH = '/Users/shenmingjie/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

// Minimal synthetic HistoryEntry at Step 5 with valid skuData
const SYNTHETIC_ENTRY = {
  id: 'history_e2e_test_001',
  timestamp: Date.now(),
  name: 'E2E-TestProject',
  version: 1,
  projectInfo: {
    name: 'E2E-TestProject',
    customer: '标准',
    stage: 'EVB',
    files: [],
    checkedPcbaOptions: ['MB-TEST'],
    pcbaOptions: [
      { pcba: 'MB-TEST', projectName: 'E2E-TestProject', band: '', bandConflict: false, duplicateConflict: false, duplicateCount: 1, emmc: '128G', ddr: '4G' },
    ],
    pcbaRows: [
      { pcba: 'MB-TEST', sourceIndex: 0, values: {} },
    ],
  },
  skuData: [
    {
      id: 'sku_e2e_001',
      stage: 'EVB',
      orderNo: 'ORD-001',
      project: 'E2E-TestProject',
      selectedSupplyKey: '一供',
      supplies: [
        {
          id: 'supply_e2e_001',
          supplyKey: '一供',
          label: '一供',
          values: {
            project: 'E2E-TestProject',
            stage: 'EVB',
            supply_select: '一供',
            order_no: 'ORD-001',
            color: 'Black',
            unit_id: 'U-001',
            mb_id: 'MB-TEST',
            band: 'B1/B3/B5',
            storage: '128G+4G',
            lcd: 'LCD-A',
            front_cam: 'FC-8M',
            main_cam: 'MC-48M',
            sub_cam: 'SC-2M',
            battery: 'BAT-5000',
            fingerprint: 'FP-side',
          },
        },
      ],
    },
  ],
  currentStep: 5,
  activeFields: [
    { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
    { id: 'stage', label: '试产阶段', group: '基础信息', behavior: 'auto' },
    { id: 'supply_select', label: '一供/二供', group: '基础信息', behavior: 'manual' },
    { id: 'order_no', label: '订单号', group: '基础信息', behavior: 'manual' },
    { id: 'color', label: '颜色', group: '产品规格', behavior: 'manual' },
    { id: 'unit_id', label: '整机标识', group: '产品规格', behavior: 'manual' },
    { id: 'mb_id', label: '主板标识', group: '产品规格', behavior: 'manual' },
    { id: 'band', label: '频段', group: '产品规格', behavior: 'auto' },
    { id: 'storage', label: '存储', group: '产品规格', behavior: 'auto' },
    { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto' },
    { id: 'front_cam', label: '前CAM', group: '电子物料', behavior: 'auto' },
    { id: 'main_cam', label: '主CAM', group: '电子物料', behavior: 'auto' },
    { id: 'sub_cam', label: '副CAM', group: '电子物料', behavior: 'auto' },
    { id: 'fingerprint', label: '指纹', group: '电子物料', behavior: 'auto' },
    { id: 'battery', label: '电池', group: '电子物料', behavior: 'auto' },
  ],
  isFlowComplete: false,
  isArchived: false,
};

(async () => {
  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });

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
    await page.waitForTimeout(1000);

    // 2. Inject synthetic history entry into localStorage
    console.log('[2] Injecting synthetic history entry into localStorage...');
    await page.evaluate((entry) => {
      localStorage.setItem('trial_production_history', JSON.stringify([entry]));
    }, SYNTHETIC_ENTRY);

    // 3. Reload to pick up the injected history
    console.log('[3] Reloading page...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 4. Click "历史记录" button to open history modal
    console.log('[4] Opening history modal...');
    const historyBtn = page.locator('button:has-text("历史记录")');
    await historyBtn.click();
    await page.waitForTimeout(500);

    // 5. Find and click the history entry
    console.log('[5] Clicking history entry "E2E-TestProject"...');
    const entryItem = page.locator('text=E2E-TestProject').first();
    await entryItem.waitFor({ state: 'visible', timeout: 5000 });
    await entryItem.click();

    // 6. Wait for sheet to appear
    console.log('[6] Waiting for [data-testid="trial-production-sheet"] ...');
    await page.locator('[data-testid="trial-production-sheet"]').waitFor({ state: 'attached', timeout: 15000 });

    // 7. Wait additional 3s for Univer render
    console.log('[7] Waiting 3s for Univer render...');
    await page.waitForTimeout(3000);

    // 8. Check canvas count
    const canvasCount = await page.locator('[data-testid="trial-production-sheet"] canvas').count();

    // 9. Screenshot
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    console.log(`[Screenshot] Saved to ${SCREENSHOT_PATH}`);

    // 10. Verdict — canvas >= 1 means Univer rendered cell data (not just shell)
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
      console.log('PASS: History-loaded Step 5 rendered Univer cell data.');
    } else {
      console.log('FAIL: History-loaded Step 5 did NOT render cell data.');
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
