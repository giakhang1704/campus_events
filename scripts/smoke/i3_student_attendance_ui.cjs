// Student event-detail UI contract checks. All /api requests are intercepted; no real data is used.
// This verifies the Angular UI, not backend/database behavior. Full-stack checks: test-i3-ui.ps1.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.I3_DETAIL_UI_BASE_URL || 'http://127.0.0.1:14206';
assert.equal(base, 'http://127.0.0.1:14206', 'Use the dedicated localhost UI runner.');
const artifacts = path.resolve(__dirname, '../../frontend/.angular/student-attendance');
fs.mkdirSync(artifacts, { recursive: true });
const at = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
const makeEvent = (id, overrides = {}) => ({
  id, organizerId: 2, organizationUnitId: 1, title: `Sự kiện ${id}`, description: 'Hoạt động sinh viên', location: 'Hội trường A',
  registrationOpensAt: at(-60), registrationClosesAt: at(5), startsAt: at(10), endsAt: at(120),
  capacity: 10, status: 'PUBLISHED', publishedAt: at(-120), version: 1, departmentIds: [], studyYears: [], ...overrides,
});
const events = new Map([
  [1, makeEvent(1)],
  [2, makeEvent(2, { registrationClosesAt: at(60), startsAt: at(120), endsAt: at(240) })],
  [3, makeEvent(3, { registrationOpensAt: at(-300), registrationClosesAt: at(-150), startsAt: at(-120), endsAt: at(-30) })],
]);
const registrations = new Map([1, 2, 3].map((id) => [id, { status: 'REGISTERED', version: 1 }]));
const records = new Map();
const errors = [], cases = [];
let role = 'STUDENT', attendanceRequests = 0, failAttendance = false, heldResponse = null;
const watchdog = setTimeout(() => { console.error('Student attendance UI checks timed out.'); process.exit(1); }, 120000);
watchdog.unref();
const pass = (name) => { cases.push(name); console.log(`PASS ${name}`); };
const present = (method = 'QR') => ({
  registrationId: 101, eventId: 1, result: 'PRESENT', method, sessionId: method === 'QR' ? 1 : null,
  recordedBy: method === 'MANUAL' ? 2 : null, recordedAt: '2026-11-25T02:15:00Z', reason: null, version: 1,
});
const registration = (id) => {
  const current = registrations.get(id), e = events.get(id);
  return !current ? null : {
    ...current, id: 100 + id, eventId: id, studentId: 1, registeredAt: at(-10), cancelledAt: current.status === 'CANCELLED' ? at(-1) : null,
    waitlistedAt: current.status === 'WAITLISTED' ? at(-5) : null, queuePosition: current.status === 'WAITLISTED' ? 1 : null,
    eventTitle: e.title, location: e.location, startsAt: e.startsAt, endsAt: e.endsAt,
  };
};
const mine = (id) => {
  const r = registration(id), attendance = records.get(id) ?? null;
  return {
    eventId: id, registrationId: r?.id ?? null, registrationStatus: r?.status ?? null, attendance,
    attendanceState: r?.status !== 'REGISTERED' ? 'NOT_APPLICABLE' : attendance?.result === 'PRESENT'
      ? 'PRESENT' : Date.now() >= Date.parse(events.get(id).endsAt) ? 'ABSENT' : 'NOT_RECORDED',
  };
};

(async () => {
  const browser = await chromium.launch({ channel: process.env.I3_UI_CHANNEL || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/api/**', async (route) => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api/, '');
    const send = (json, status = 200) => route.fulfill({ status, json });
    if (endpoint === '/auth/me') return send({ id: 1, fullName: 'Sinh viên thử nghiệm', email: 'student@example.test', role,
      status: 'ACTIVE', mustChangePassword: false, version: 1, studentCode: '2310001', departmentId: 1, studyYear: 2, organizationUnitId: 1 });
    if (endpoint === '/auth/csrf') return send({ token: 'ui-contract-token' });
    if (endpoint === '/catalog/departments') return send([{ id: 1, name: 'Khoa học và Kỹ thuật Máy tính' }]);
    if (endpoint === '/catalog/organization-units') return send([{ id: 1, name: 'Đoàn trường' }]);
    if (endpoint === '/me/registrations') return send({ items: [...registrations.keys()].map(registration).filter((r) => r.status === 'REGISTERED'), page: 0, size: 20, hasNext: false });
    const match = endpoint.match(/^\/events\/(\d+)(.*)$/);
    if (!match || !events.has(Number(match[1]))) { errors.push(`Unhandled fixture request: ${request.method()} ${endpoint}`); return route.abort(); }
    const id = Number(match[1]), suffix = match[2], e = events.get(id);
    if (!suffix) return send(e);
    if (suffix === '/registration') return send({ eventId: id, registration: registration(id), eligible: true,
      registrationOpen: Date.now() >= Date.parse(e.registrationOpensAt) && Date.now() < Date.parse(e.registrationClosesAt),
      registeredCount: 1, waitingCount: 0, availableSeats: 9 });
    if (suffix === '/registration/cancel' && request.method() === 'POST') {
      const current = registrations.get(id);
      registrations.set(id, { status: 'CANCELLED', version: current.version + 1 });
      return send(registration(id));
    }
    if (suffix === '/registrations' && request.method() === 'POST') {
      registrations.set(id, { status: 'REGISTERED', version: (registrations.get(id)?.version ?? 0) + 1 });
      records.set(id, { ...present('SYSTEM'), eventId: id, registrationId: 100 + id, result: 'NOT_RECORDED' });
      return send(registration(id), 201);
    }
    if (suffix === '/attendance') {
      attendanceRequests++;
      if (failAttendance) return send({ code: 'UNAVAILABLE', message: 'Chưa tải được điểm danh.' }, 503);
      const snapshot = mine(id);
      if (heldResponse) {
        const held = heldResponse;
        heldResponse = null;
        held.started();
        await held.gate;
        return send(snapshot);
      }
      return send(snapshot);
    }
    errors.push(`Unhandled fixture request: ${request.method()} ${endpoint}`);
    return route.abort();
  });
  const panel = () => page.getByRole('region', { name: 'Điểm danh của bạn', exact: true });
  const badge = (text) => panel().getByText(text, { exact: true }).waitFor();
  const scanLink = () => panel().getByRole('link', { name: 'Quét QR điểm danh', exact: true });
  try {
    await page.goto(`${base}/events/1`);
    await badge('Chưa ghi nhận');
    assert.equal(await scanLink().getAttribute('href'), '/scan');
    await scanLink().click();
    await page.getByRole('heading', { name: 'Điểm danh bằng QR', exact: true }).waitFor();
    await page.goBack();
    await badge('Chưa ghi nhận');
    pass('registered student sees current status and can open QR scan');

    records.set(1, present());
    await panel().getByRole('button', { name: 'Tải lại điểm danh', exact: true }).click();
    await badge('Có mặt');
    assert.match(await panel().locator('.recorded-at').innerText(), /09:15.*Quét QR/);
    assert.equal(await scanLink().count(), 0);
    await page.reload();
    await badge('Có mặt');
    pass('QR result persists on reload; timestamp uses Vietnam time on a UTC device');

    let started, release;
    const pendingStarted = new Promise((resolve) => { started = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    heldResponse = { started, gate };
    await panel().getByRole('button', { name: 'Tải lại điểm danh', exact: true }).click();
    await pendingStarted;
    await page.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click();
    await page.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
    await badge('Đã hủy đăng ký');
    const released = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/events/1/attendance');
    release();
    await (await released).finished();
    assert.equal(await panel().getByText('Có mặt', { exact: true }).count(), 0);
    assert.equal(await scanLink().count(), 0);
    assert.equal(records.get(1).result, 'PRESENT', 'old evidence still exists in the API fixture');
    pass('cancel hides old PRESENT and ignores a delayed attendance response');

    await page.getByRole('button', { name: 'Đăng ký lại', exact: true }).click();
    await badge('Chưa ghi nhận');
    assert.equal(await panel().getByText('Có mặt', { exact: true }).count(), 0);
    assert.equal(await panel().locator('.recorded-at').count(), 0);
    assert.equal(await scanLink().count(), 1);
    pass('re-registration loads a new result instead of carrying PRESENT forward');

    records.set(1, present('MANUAL'));
    await panel().getByRole('button', { name: 'Tải lại điểm danh', exact: true }).click();
    await badge('Có mặt');
    assert.match(await panel().locator('.recorded-at').innerText(), /Thủ công/);
    failAttendance = true;
    await panel().getByRole('button', { name: 'Tải lại điểm danh', exact: true }).click();
    await panel().getByRole('alert').getByText('Chưa tải được điểm danh.', { exact: true }).waitFor();
    assert.equal(await panel().getByText('Có mặt', { exact: true }).count(), 0);
    failAttendance = false;
    await panel().getByRole('button', { name: 'Thử lại', exact: true }).click();
    await badge('Có mặt');
    pass('manual result, error state and retry do not show stale data');
    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });

    registrations.set(1, { status: 'WAITLISTED', version: 5 });
    await page.reload();
    await badge('Đang chờ suất');
    assert.equal(await scanLink().count(), 0);
    registrations.delete(1);
    await page.reload();
    await badge('Chưa đăng ký');
    assert.equal(await scanLink().count(), 0);
    pass('waitlisted and unregistered students cannot start check-in from the detail panel');

    await page.goto(`${base}/events/2`);
    await badge('Chưa ghi nhận');
    await panel().getByText('Mở từ', { exact: false }).waitFor();
    assert.equal(await scanLink().count(), 0);
    await page.goto(`${base}/events/3`);
    await badge('Vắng');
    assert.equal(await scanLink().count(), 0);
    pass('before the QR window and after ends_at show the correct state');

    events.set(5, makeEvent(5, { registrationOpensAt: at(-300), registrationClosesAt: at(-20), startsAt: at(-10), endsAt: new Date(Date.now() + 5000).toISOString() }));
    registrations.set(5, { status: 'REGISTERED', version: 1 });
    await page.goto(`${base}/events/5`);
    await badge('Chưa ghi nhận');
    await badge('Vắng');
    assert.equal(await scanLink().count(), 0);
    pass('the end-time boundary refreshes the state from the server');

    role = 'ORGANIZER';
    const before = attendanceRequests;
    await page.goto(`${base}/events/1`);
    await page.getByRole('heading', { name: 'Sự kiện 1', exact: true }).waitFor();
    assert.equal(await page.locator('app-my-attendance').count(), 0);
    assert.equal(attendanceRequests, before);
    pass('organizer preview does not call the student-only attendance API');

    role = 'STUDENT';
    registrations.set(1, { status: 'REGISTERED', version: 6 });
    await page.goto(`${base}/events/1`);
    await badge('Có mặt');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    pass('mobile layout and no uncaught browser errors');

    const longDescription = 'dfsfa' + 'a'.repeat(2500) + '\nDòng mô tả tiếp theo.';
    events.set(6, makeEvent(6, { title: 'Sự kiện ' + 'A'.repeat(230), description: longDescription, location: 'B'.repeat(250) }));
    registrations.set(6, { status: 'REGISTERED', version: 1 });
    await page.goto(`${base}/events/6`);
    await badge('Chưa ghi nhận');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.locator('.event-description').textContent(), longDescription, 'description must not be truncated');
      assert.equal(await page.locator('.event-description').evaluate((element) => element.scrollWidth > element.clientWidth + 1), false, 'unbroken text must wrap inside its panel');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `event detail overflows at ${width}px`);
      await page.screenshot({ path: path.join(artifacts, `long-text-${width}.png`), fullPage: true });
    }
    pass('long unbroken description/title/location wrap without truncation on desktop and mobile');
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ apiMode: 'intercepted-contract-fixtures', cases }, null, 2));
    console.log(`Student attendance UI: ${cases.length} checks passed (API contract fixtures).`);
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
