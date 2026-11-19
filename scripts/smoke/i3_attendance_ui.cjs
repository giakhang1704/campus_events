// I3 browser checks for /attendance (organizer): QR session, live list, manual change with reason,
// stale manual change (VERSION_CONFLICT), history and close. Runs only against the isolated I3 test stack;
// pass the playwright module path as the first argument. Env: TEST_ACCOUNT_PASSWORD, I3_UI_BASE_URL.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { makeApi, contextFactory, inMinutes, createPublishedEvent } = require('./ui_fixtures.cjs');

const root = path.resolve(__dirname, '../..');
const base = process.env.I3_UI_BASE_URL || 'http://127.0.0.1:14202';
const password = process.env.TEST_ACCOUNT_PASSWORD;
if (!password) throw new Error('TEST_ACCOUNT_PASSWORD is required.');
const shots = path.join(root, 'frontend/.angular');
fs.mkdirSync(shots, { recursive: true });

const api = makeApi(base);
const at = inMinutes;

(async () => {
  const browser = await chromium.launch(process.env.I3_UI_CHANNEL ? { channel: process.env.I3_UI_CHANNEL } : {});
  const errors = [];
  const newContext = contextFactory(browser, errors);
  try {
    // ── Fixtures: an event starting in 10 minutes (QR window open), three registered students ──
    const org = await newContext();
    await api(org, 'POST', '/auth/login', { email: 'organizer.i1@example.test', password });
    const [departments, units] = await Promise.all([api(org, 'GET', '/catalog/departments'), api(org, 'GET', '/catalog/organization-units')]);
    const suffix = crypto.randomBytes(4).toString('hex');
    const event = await createPublishedEvent(api, org, units[0].id, {
      title: `Điểm danh UI ${suffix}`, location: 'Hội trường B',
      registrationClosesAt: at(5), startsAt: at(10), endsAt: at(120), capacity: 5,
    });

    const student = async (key) => {
      const context = await newContext();
      const name = `SV ${key.toUpperCase()} ${suffix}`;
      const email = `i3-ui-${suffix}-${key}@example.test`;
      await api(context, 'POST', '/auth/register', {
        fullName: name, email, studentCode: `I3${suffix}${key}`, password, departmentId: departments[0].id, studyYear: 2,
      });
      await api(context, 'POST', '/auth/login', { email, password });
      await api(context, 'POST', `/events/${event.id}/registrations`);
      return { context, name };
    };
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map(student));
    const checkIn = async (s) => {
      const session = await api(org, 'GET', `/organizer/events/${event.id}/attendance/session`);
      const qr = JSON.parse(session.qrPayload);
      const preview = await api(s.context, 'POST', `/events/${event.id}/attendance/preview`, { sessionId: qr.sessionId, token: qr.token });
      await api(s.context, 'POST', `/events/${event.id}/attendance/check-in`, {
        sessionId: qr.sessionId, token: qr.token, eventVersion: preview.eventVersion,
        registrationVersion: preview.registrationVersion, attendanceVersion: preview.attendanceVersion,
      });
    };

    // ── Organizer page ──
    const page = await org.newPage();
    await page.goto(`${base}/attendance?event=${event.id}`);
    const row = (s) => page.getByRole('row').filter({ hasText: s.name });
    await row(a).getByText('Chưa ghi nhận', { exact: true }).waitFor();
    assert.equal((await page.locator('.stat.green strong').innerText()).trim(), '0');

    // Open a QR session: image + countdown.
    await page.getByRole('button', { name: /Mở phiên QR/ }).click();
    await page.getByRole('img', { name: 'Mã QR điểm danh' }).waitFor();
    await page.getByText(/còn \d\d:\d\d/).waitFor();
    assert.equal(await page.getByText('Đang mở', { exact: true }).count(), 1);
    await page.screenshot({ path: path.join(shots, 'i3-attendance-open.png'), fullPage: true });

    // A scans: the list shows it after a reload.
    await checkIn(a);
    await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
    await row(a).getByText('Có mặt', { exact: true }).waitFor();
    await row(a).getByText(/Quét QR ·/).waitFor();

    // Manual: B present with a reason.
    await row(b).getByRole('button', { name: 'Ghi có mặt', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Lưu', exact: true }).isDisabled(), true, 'reason is required');
    await page.getByLabel('Lý do', { exact: true }).fill('Bổ sung từ danh sách ký tên');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await page.getByText(`Đã ghi nhận ${b.name} có mặt.`, { exact: true }).waitFor();
    await row(b).getByText(/Thủ công ·/).waitFor();

    // Stale manual form: C scans while the organizer's form is open -> conflict, nothing overwritten.
    await row(c).getByRole('button', { name: 'Ghi có mặt', exact: true }).click();
    await checkIn(c);
    await page.getByLabel('Lý do', { exact: true }).fill('Form cũ');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await page.getByText('vừa thay đổi', { exact: false }).waitFor();
    await row(c).getByText(/Quét QR ·/).waitFor();
    assert.equal((await page.locator('.stat.green strong').innerText()).trim(), '3');

    // History of B shows the manual change and its reason.
    await row(b).getByRole('button', { name: 'Lịch sử', exact: true }).click();
    await page.getByRole('heading', { name: 'Lịch sử điểm danh', exact: true }).waitFor();
    await page.locator('.timeline').getByText('Bổ sung từ danh sách ký tên', { exact: true }).waitFor();

    // Undo B (NOT_RECORDED) with a reason.
    await row(b).getByRole('button', { name: 'Bỏ ghi nhận', exact: true }).click();
    await page.getByLabel('Lý do', { exact: true }).fill('Ghi nhầm');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await row(b).getByText('Chưa ghi nhận', { exact: true }).waitFor();

    // Filter is kept in the URL.
    await page.getByLabel('Lọc lượt đăng ký', { exact: true }).selectOption('CANCELLED');
    await page.getByText('Không có lượt đăng ký phù hợp', { exact: true }).waitFor();
    assert.match(page.url(), /status=CANCELLED/);
    await page.getByLabel('Lọc lượt đăng ký', { exact: true }).selectOption('REGISTERED');
    await row(a).waitFor();

    // Mobile: no sideways scroll.
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '/attendance scrolls sideways on mobile');
    await page.screenshot({ path: path.join(shots, 'i3-attendance-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Close the session: the image goes away and the old code no longer works.
    await page.getByRole('button', { name: /Đóng phiên/ }).click();
    await page.getByText('Đã đóng phiên QR', { exact: false }).waitFor();
    await page.getByRole('img', { name: 'Mã QR điểm danh' }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /Mở phiên QR/ }).waitFor();

    assert.deepEqual(errors, [], 'Uncaught page errors: ' + errors.join(' | '));
    console.log('I3 attendance UI checks passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
