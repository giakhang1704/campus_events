// I3 browser checks for /scan (student QR check-in) and the organizer close-failure path.
// The camera is replaced by a canvas stream that shows a QR image, so the real decoder, preview,
// confirmation and check-in run end to end. Runs only against an isolated I3 test stack;
// pass the playwright module path as the first argument. Env: TEST_ACCOUNT_PASSWORD, I3_UI_BASE_URL.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { QRCodeWriter, BarcodeFormat } = require('../../frontend/node_modules/@zxing/library');
const { makeApi, contextFactory, inMinutes, createPublishedEvent } = require('./ui_fixtures.cjs');

const root = path.resolve(__dirname, '../..');
const base = process.env.I3_UI_BASE_URL || 'http://127.0.0.1:14205';
const password = process.env.TEST_ACCOUNT_PASSWORD;
if (!password) throw new Error('TEST_ACCOUNT_PASSWORD is required.');
const shots = path.join(root, 'frontend/.angular');
fs.mkdirSync(shots, { recursive: true });

const api = makeApi(base);
const at = inMinutes;

/** SVG (data URL) of a QR code holding `text`, for codes the backend does not issue. */
function qrDataUrl(text) {
  const m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, new Map());
  let d = '';
  for (let y = 0; y < m.getHeight(); y++) for (let x = 0; x < m.getWidth(); x++) if (m.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  const n = m.getWidth();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="-4 -4 ${n + 8} ${n + 8}"><rect x="-4" y="-4" width="${n + 8}" height="${n + 8}" fill="white"/><path d="${d}"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

/**
 * Fake camera: getUserMedia returns a canvas stream drawing window.__qr (an image URL) each frame.
 * window.__camera = 'denied' makes it fail like a blocked permission.
 */
const fakeCamera = () => {
  if (!navigator.mediaDevices) return; // about:blank and other insecure pages have no camera API
  navigator.mediaDevices.getUserMedia = async () => {
    if (window.__camera === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let src = '';
    const draw = () => {
      if (window.__qr && window.__qr !== src) { src = window.__qr; img.src = src; }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 640, 480);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, 170, 90, 300, 300);
      requestAnimationFrame(draw);
    };
    draw();
    return canvas.captureStream(15);
  };
};

(async () => {
  const browser = await chromium.launch(process.env.I3_UI_CHANNEL ? { channel: process.env.I3_UI_CHANNEL } : {});
  const errors = [];
  const newContext = contextFactory(browser, errors);
  try {
    // ── Fixtures: event in the QR window, three registered students, one waitlisted, one not registered ──
    const org = await newContext();
    await api(org, 'POST', '/auth/login', { email: 'organizer.i1@example.test', password });
    const [departments, units] = await Promise.all([api(org, 'GET', '/catalog/departments'), api(org, 'GET', '/catalog/organization-units')]);
    const suffix = crypto.randomBytes(4).toString('hex');
    const event = await createPublishedEvent(api, org, units[0].id, {
      title: `Quét QR UI ${suffix}`, location: 'Hội trường C',
      registrationClosesAt: at(5), startsAt: at(10), endsAt: at(120), capacity: 3,
    });

    const student = async (key, register = true) => {
      const context = await newContext();
      await context.addInitScript(fakeCamera);
      const email = `i3-scan-${suffix}-${key}@example.test`;
      await api(context, 'POST', '/auth/register', {
        fullName: `SV ${key.toUpperCase()} ${suffix}`, email, studentCode: `S${suffix}${key}`, password, departmentId: departments[0].id, studyYear: 2,
      });
      await api(context, 'POST', '/auth/login', { email, password });
      if (register) await api(context, 'POST', `/events/${event.id}/registrations`);
      return context;
    };
    // Sequential: capacity 3, so the fourth registration is WAITLISTED.
    const a = await student('a');
    const b = await student('b');
    const c = await student('c');
    const w = await student('w');
    const n = await student('n', false);
    assert.equal((await api(w, 'GET', `/events/${event.id}/registration`)).registration.status, 'WAITLISTED');

    const session = await api(org, 'POST', `/organizer/events/${event.id}/attendance/sessions`, { durationMinutes: 10 });
    const qrUrl = qrDataUrl(session.qrPayload);

    /** Opens /scan, shows `image` to the fake camera and starts scanning. */
    const scan = async (context, image, page) => {
      page = page || (await context.newPage());
      if (!page.url().endsWith('/scan')) await page.goto(`${base}/scan`);
      await page.evaluate((src) => { window.__qr = src; }, image);
      const done = page.getByRole('button', { name: 'Xong', exact: true });
      // Leave a finished result first; ignore it if the view re-rendered meanwhile.
      if (await done.count()) await done.click({ timeout: 3000 }).catch(() => {});
      const start = page.getByRole('button', { name: /Bật camera để quét|Quét lại|Quét mã khác/ }).first();
      await start.click();
      return page;
    };
    const heading = (page, name) => page.getByRole('heading', { name, exact: true }).waitFor();

    // ── A: scan → preview → confirm → success ──
    const pa = await scan(a, qrUrl);
    await heading(pa, event.title);
    await pa.getByText('Hội trường C', { exact: true }).waitFor();
    const mineBefore = await api(a, 'GET', `/events/${event.id}/attendance`);
    assert.equal(mineBefore.attendance, null, 'preview alone must not record attendance');
    await pa.getByRole('button', { name: /Xác nhận điểm danh/ }).click();
    await heading(pa, 'Điểm danh thành công');
    await pa.getByText('Có mặt', { exact: true }).waitFor();
    await pa.getByText('Quét QR', { exact: true }).waitFor();
    assert.equal((await api(a, 'GET', `/events/${event.id}/attendance`)).attendance.result, 'PRESENT');
    await pa.screenshot({ path: path.join(shots, 'i3-scan-success.png'), fullPage: true });

    // A scans again: existing result, no duplicate.
    await scan(a, qrUrl, pa);
    await heading(pa, 'Bạn đã điểm danh trước đó');

    // ── B: network failure on confirm → no success; retry → success ──
    const pb = await scan(b, qrUrl);
    await heading(pb, event.title);
    await pb.route('**/attendance/check-in', (route) => route.abort('internetdisconnected'));
    await pb.getByRole('button', { name: /Xác nhận điểm danh/ }).click();
    await heading(pb, 'Chưa xác nhận được điểm danh');
    assert.equal(await pb.getByText('Điểm danh thành công').count(), 0, 'network failure must not show success');
    await pb.unroute('**/attendance/check-in');
    await pb.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await heading(pb, 'Điểm danh thành công');

    // ── Ineligible: waitlisted and not registered ──
    const pw = await scan(w, qrUrl);
    await heading(pw, 'Chưa đủ điều kiện điểm danh');
    await pw.getByText(/danh sách chờ/).first().waitFor();
    const pn = await scan(n, qrUrl);
    await heading(pn, 'Bạn chưa đăng ký sự kiện này');

    // ── Not a BKevent code ──
    const pc = await scan(c, qrDataUrl('https://example.com/not-a-checkin'));
    await heading(pc, 'Mã QR không đúng');

    // ── Camera blocked ──
    const pd = await c.newPage();
    await pd.goto(`${base}/scan`);
    await pd.evaluate(() => { window.__camera = 'denied'; });
    await pd.getByRole('button', { name: /Bật camera để quét/ }).click();
    await pd.getByText('Trình duyệt đang chặn quyền dùng camera.').waitFor();
    await pd.getByText(/người tổ chức để được điểm danh thủ công/).first().waitFor();
    await pd.close();

    // ── Organizer: a failed close keeps the server state on screen ──
    const po = await org.newPage();
    await po.goto(`${base}/attendance?event=${event.id}`);
    await po.getByRole('img', { name: 'Mã QR điểm danh' }).waitFor();
    await po.route('**/close', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"TEST","message":"Máy chủ bận."}' }));
    await po.getByRole('button', { name: /Đóng điểm danh/ }).click();
    await po.getByText(/Đóng điểm danh chưa thành công: Máy chủ bận/).waitFor();
    assert.equal(await po.getByText('Đang mở', { exact: true }).count(), 1, 'session stays open after a failed close');
    await po.unroute('**/close');
    await po.getByRole('button', { name: /Đóng điểm danh/ }).click();
    await po.getByText('Đã đóng', { exact: true }).waitFor();

    // ── After close: C's old code is rejected; A (already present) still sees the result ──
    await scan(c, qrUrl, pc);
    await heading(pc, 'Mã QR không còn hiệu lực');
    assert.equal((await api(c, 'GET', `/events/${event.id}/attendance`)).attendance, null);
    await scan(a, qrUrl, pa);
    await heading(pa, 'Bạn đã điểm danh trước đó');

    // Mobile: no sideways scroll.
    await pc.setViewportSize({ width: 390, height: 844 });
    assert.equal(await pc.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '/scan scrolls sideways on mobile');
    await pc.screenshot({ path: path.join(shots, 'i3-scan-mobile.png'), fullPage: true });

    assert.deepEqual(errors, [], 'Uncaught page errors: ' + errors.join(' | '));
    console.log('I3 scan UI checks passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
