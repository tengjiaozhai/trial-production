// Just open the app and dump Step1 form structure.
const { chromium } = require('/Users/shenmingjie/.nvm/versions/node/v24.13.1/lib/node_modules/@playwright/cli/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/shenmingjie/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  });
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage());

  page.on('console', (msg) => console.log(`[console.${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Dump input + button + select structure
  const inputs = await page.locator('input').all();
  console.log('=== inputs found:', inputs.length, '===');
  for (let i = 0; i < Math.min(20, inputs.length); i++) {
    const el = inputs[i];
    const placeholder = await el.getAttribute('placeholder').catch(() => null);
    const name = await el.getAttribute('name').catch(() => null);
    const type = await el.getAttribute('type').catch(() => null);
    const id = await el.getAttribute('id').catch(() => null);
    const value = await el.inputValue().catch(() => null);
    console.log(`  [${i}] type=${type} name=${name} id=${id} placeholder=${JSON.stringify(placeholder)} value=${value}`);
  }

  const buttons = await page.locator('button').all();
  console.log('=== buttons found:', buttons.length, '===');
  for (let i = 0; i < Math.min(20, buttons.length); i++) {
    const text = await buttons[i].textContent();
    console.log(`  [${i}] ${text?.slice(0, 60)}`);
  }

  const selects = await page.locator('select').all();
  console.log('=== selects found:', selects.length, '===');
  for (let i = 0; i < Math.min(10, selects.length); i++) {
    const id = await selects[i].getAttribute('id').catch(() => null);
    const name = await selects[i].getAttribute('name').catch(() => null);
    console.log(`  [${i}] id=${id} name=${name}`);
  }

  await page.screenshot({ path: '/Users/shenmingjie/tinno/output/trial-production/step1-form.png', fullPage: true });
  await browser.close();
})();
