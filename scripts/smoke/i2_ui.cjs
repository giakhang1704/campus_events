// I2 browser checks: register / waitlist / cancel / FIFO promotion / stale version, "Sự kiện của tôi",
// "Người tham gia" and the editor's 409 mapping. Runs only against the isolated I2 test stack
// (scripts/test-i2.ps1 -PlaywrightModule ...); pass the playwright module path as the first argument.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { makeApi, contextFactory, inMinutes, createPublishedEvent } = require('./ui_fixtures.cjs');

const root = path.resolve(__dirname, '../..');
const base = process.env.I2_UI_BASE_URL || 'http://127.0.0.1:14201';
const password = process.env.TEST_ACCOUNT_PASSWORD;
if (!password) throw new Error('TEST_ACCOUNT_PASSWORD is required (set by scripts/test-i2.ps1).');
const shots = path.join(root, 'frontend/.angular');
fs.mkdirSync(shots, { recursive: true });

const api = makeApi(base);
const at = (hours) => inMinutes(hours * 60);

(async () => {
  const browser = await chromium.launch(process.env.I2_UI_CHANNEL ? { channel: process.env.I2_UI_CHANNEL } : {});
  const errors = [];
  const newContext = contextFactory(browser, errors);
  try {
    // ── Fixtures through the API ──
    const org = await newContext();
    await api(org, 'POST', '/auth/login', { email: 'organizer.i1@example.test', password });
    const [departments, units] = await Promise.all([api(org, 'GET', '/catalog/departments'), api(org, 'GET', '/catalog/organization-units')]);
    const department = departments[0].id;
    const unit = units[0].id;
    const suffix = crypto.randomBytes(4).toString('hex');
    const createEvent = (title, overrides = {}) => createPublishedEvent(api, org, unit, { title: `${title} ${suffix}`, ...overrides });
    // Sequential on purpose: writes of one context must not overlap (see ui_fixtures.cjs).
    const main = await createEvent('Workshop I2 UI');
    const yearFour = await createEvent('Chỉ năm 4', { studyYears: [4] });
    const later = await createEvent('Mở đăng ký sau', { registrationOpensAt: at(24), registrationClosesAt: at(48), startsAt: at(72), endsAt: at(74) });

    const student = async (name) => {
      const context = await newContext();
      const email = `i2-ui-${suffix}-${name}@example.test`;
      await api(context, 'POST', '/auth/register', {
        fullName: `Sinh viên ${name.toUpperCase()} ${suffix}`, email, studentCode: `UI${suffix}${name}`,
        password, departmentId: department, studyYear: 2,
      });
      return { context, email, name: `Sinh viên ${name.toUpperCase()} ${suffix}` };
    };
    const [a, b] = await Promise.all([student('a'), student('b')]);

    // ── Student A logs in through the form and registers (seat available) ──
    const pa = await a.context.newPage();
    await pa.goto(base + '/login');
    await pa.getByLabel('Email', { exact: true }).fill(a.email);
    await pa.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await pa.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await pa.getByRole('heading', { name: 'Khám phá sự kiện', exact: true }).waitFor();
    await pa.goto(`${base}/events/${main.id}`);
    await pa.getByText('1 / 1 chỗ', { exact: true }).waitFor();
    await pa.getByRole('button', { name: /Đăng ký tham gia/ }).click();
    await pa.getByText('Đăng ký thành công', { exact: false }).waitFor();
    await pa.getByText('Bạn đã có chỗ tham gia sự kiện', { exact: false }).waitFor();
    await pa.getByText('0 / 1 chỗ', { exact: true }).waitFor();

    // ── Student B: event is full -> waitlist #1 ──
    await api(b.context, 'POST', '/auth/login', { email: b.email, password });
    const pb = await b.context.newPage();
    await pb.goto(`${base}/events/${main.id}`);
    await pb.getByText('Sự kiện đã đủ chỗ', { exact: false }).waitFor();
    await pb.getByRole('button', { name: /Tham gia danh sách chờ/ }).click();
    await pb.getByText('Bạn đang ở vị trí', { exact: false }).waitFor();
    assert.match(await pb.locator('app-registration-panel .notice.warn').innerText(), /#1/);
    await pb.screenshot({ path: path.join(shots, 'i2-detail-waitlisted.png'), fullPage: true });

    // ── "Sự kiện của tôi": row, status filter kept in the URL, empty state ──
    await pb.goto(base + '/my-events');
    const myRow = pb.getByRole('row').filter({ hasText: main.title });
    await myRow.getByText('Danh sách chờ · #1', { exact: true }).waitFor();
    await pb.getByLabel('Lọc theo trạng thái', { exact: true }).selectOption('CANCELLED');
    await pb.getByText('Không có đăng ký ở trạng thái này', { exact: true }).waitFor();
    assert.match(pb.url(), /status=CANCELLED/);
    await pb.reload();
    await pb.getByText('Không có đăng ký ở trạng thái này', { exact: true }).waitFor();
    assert.equal(await pb.getByLabel('Lọc theo trạng thái', { exact: true }).inputValue(), 'CANCELLED');
    await pb.getByLabel('Lọc theo trạng thái', { exact: true }).selectOption('');
    await myRow.waitFor();
    await pb.setViewportSize({ width: 390, height: 844 });
    assert.equal(await pb.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '/my-events scrolls sideways on mobile');
    await pb.screenshot({ path: path.join(shots, 'i2-my-events-mobile.png'), fullPage: true });
    await pb.setViewportSize({ width: 1440, height: 1000 });

    // ── Organizer: /manage -> "Người tham gia" ──
    const po = await org.newPage();
    await po.goto(base + '/manage');
    await po.getByRole('row').filter({ hasText: main.title }).getByRole('link', { name: /Người tham gia/ }).click();
    await po.waitForURL(new RegExp(`/participants\\?event=${main.id}`));
    await po.getByRole('cell', { name: new RegExp(a.name) }).waitFor();
    await po.getByRole('cell', { name: new RegExp(b.name) }).waitFor();
    assert.equal((await po.locator('.stat.green strong').innerText()).trim(), '1');
    assert.equal((await po.locator('.stat.amber strong').innerText()).trim(), '1');
    await po.getByLabel('Lọc theo trạng thái', { exact: true }).selectOption('WAITLISTED');
    await po.getByRole('cell', { name: new RegExp(a.name) }).waitFor({ state: 'detached' });
    await po.getByRole('cell', { name: new RegExp(b.name) }).waitFor();
    await po.getByLabel('Lọc theo trạng thái', { exact: true }).selectOption('');
    await po.getByLabel('Tìm trong trang này').fill(b.name);
    await po.getByRole('cell', { name: new RegExp(a.name) }).waitFor({ state: 'detached' });
    await po.screenshot({ path: path.join(shots, 'i2-participants.png'), fullPage: true });
    await po.setViewportSize({ width: 390, height: 844 });
    assert.equal(await po.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '/participants scrolls sideways on mobile');
    await po.setViewportSize({ width: 1440, height: 1000 });

    // ── B keeps a stale WAITLISTED page; A cancels -> B is promoted (FIFO) ──
    await pb.goto(`${base}/events/${main.id}`);
    await pb.getByRole('button', { name: 'Rời danh sách chờ', exact: true }).waitFor();
    await pa.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click();
    await pa.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
    await pa.getByText('Đã hủy đăng ký.', { exact: true }).waitFor();
    await pa.getByText('Bạn đã hủy đăng ký lúc', { exact: false }).waitFor();
    // B was promoted, so the seat is gone again: A can only join the waitlist.
    await pa.getByRole('button', { name: /Tham gia danh sách chờ/ }).waitFor();

    // B's stale "leave waitlist" must not cancel the seat it was just given.
    await pb.getByRole('button', { name: 'Rời danh sách chờ', exact: true }).click();
    await pb.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
    await pb.getByText('Trạng thái đăng ký vừa thay đổi', { exact: false }).waitFor();
    await pb.getByText('Bạn đã có chỗ tham gia sự kiện', { exact: false }).waitFor();
    const promoted = await api(b.context, 'GET', `/events/${main.id}/registration`);
    assert.equal(promoted.registration.status, 'REGISTERED');

    // ── Disabled reasons ──
    await pa.goto(`${base}/events/${yearFour.id}`);
    assert.equal(await pa.getByRole('button', { name: /Không thuộc đối tượng tham gia/ }).isDisabled(), true);
    await pa.goto(`${base}/events/${later.id}`);
    assert.equal(await pa.getByRole('button', { name: /Ngoài thời gian đăng ký/ }).isDisabled(), true);
    await pa.getByText('Mở nhận đăng ký lúc', { exact: false }).waitFor();

    // ── Editor: changing eligibility with a REGISTERED student -> error on the year field ──
    await po.goto(base + '/manage');
    await po.getByRole('row').filter({ hasText: main.title }).getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    await po.getByText('đổi địa điểm hoặc thời gian sẽ gửi email', { exact: false }).waitFor();
    await po.getByLabel('Năm 4', { exact: true }).check();
    await po.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await po.locator('#event-years-error').filter({ hasText: 'Chưa thể đổi giới hạn đối tượng' }).waitFor();

    assert.deepEqual(errors, [], 'Uncaught page errors: ' + errors.join(' | '));
    console.log('I2 UI checks passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
