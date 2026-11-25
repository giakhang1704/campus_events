// Held session restoration reproduces a slow/cold backend without contacting production.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: process.env.I3_UI_CHANNEL || 'msedge' });
  try {
    for (const authenticated of [false, true]) {
      const context = await browser.newContext();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await context.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/me') {
          await gate;
          return route.fulfill(authenticated ? { json: { id: 1, fullName: 'Student', email: 'test@example.test', role: 'STUDENT', status: 'ACTIVE', mustChangePassword: false, version: 1 } }
            : { status: 401, json: { code: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập.' } });
        }
        if (path === '/api/events') return route.fulfill({ json: { items: [], page: 0, size: 20, hasNext: false } });
        return route.fulfill({ json: [] });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:14206/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('status').filter({ hasText: 'Đang kết nối…' }).waitFor();
      assert.match(await page.locator('body').innerText(), /BKevent/);
      release();
      await page.waitForURL(authenticated ? '**/events' : '**/login');
      await page.locator('.startup').waitFor({ state: 'detached' });
      if (!authenticated) await page.getByRole('textbox', { name: 'Email', exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS startup with delayed session: ${authenticated ? 'restored student' : 'guest login'}`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
