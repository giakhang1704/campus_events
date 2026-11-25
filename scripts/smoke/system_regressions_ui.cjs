// Angular + real QR decoder with intercepted API contracts; no database or mail is used.
const { chromium } = require(process.argv[2] || 'playwright');
const { QRCodeWriter, BarcodeFormat } = require('../../frontend/node_modules/@zxing/library');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:14206';
const at = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
const e = (id, status = 'PUBLISHED') => ({ id, organizerId: 2, organizationUnitId: 1, title: `Sự kiện ${id}`, description: 'Mô tả',
  location: 'Hội trường', registrationOpensAt: at(-60), registrationClosesAt: at(5), startsAt: at(10), endsAt: at(120),
  capacity: 100, status, publishedAt: at(-100), version: 1, departmentIds: [], studyYears: [] });
const record = { registrationId: 1, eventId: 101, result: 'PRESENT', method: 'QR', sessionId: 1, recordedBy: null,
  recordedAt: at(-5), reason: null, version: 1 };

function qrImage() {
  const matrix = new QRCodeWriter().encode(JSON.stringify({ type: 'BKeventCheckIn', eventId: 101, sessionId: 1, token: 'a'.repeat(43) }), BarcodeFormat.QR_CODE, 0, 0, new Map());
  let drawing = '';
  for (let y = 0; y < matrix.getHeight(); y++) for (let x = 0; x < matrix.getWidth(); x++) if (matrix.get(x, y)) drawing += `M${x} ${y}h1v1h-1z`;
  const n = matrix.getWidth();
  return 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${n + 8} ${n + 8}"><rect x="-4" y="-4" width="${n + 8}" height="${n + 8}" fill="white"/><path d="${drawing}"/></svg>`).toString('base64');
}

(async () => {
  const image = qrImage();
  const browser = await chromium.launch(process.env.I3_UI_CHANNEL ? { channel: process.env.I3_UI_CHANNEL } : { channel: 'msedge' });
  const context = await browser.newContext();
  let role = 'STUDENT', registrationStatus = 'CANCELLED', attendanceState = 'NOT_APPLICABLE', previewError = false;
  const errors = [], ownedPages = [], registrationPages = [];
  await context.addInitScript((source) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d'), image = new Image(); image.src = source;
      const draw = () => {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 640, 480);
        if (image.complete && image.naturalWidth) ctx.drawImage(image, 170, 90, 300, 300);
        requestAnimationFrame(draw);
      };
      draw(); return canvas.captureStream(15);
    };
  }, image);
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()), path = url.pathname.slice(4);
    const send = (json, status = 200) => route.fulfill({ status, json });
    if (path === '/auth/me') return send({ id: 1, fullName: 'Tài khoản thử', role, status: 'ACTIVE', email: 'student@example.test', mustChangePassword: false, version: 1 });
    if (path === '/auth/csrf') return send({ token: 'fixture' });
    if (path === '/me/registrations') {
      const page = Number(url.searchParams.get('page')); registrationPages.push(page);
      return send({ page, size: 100, hasNext: page === 0, items: (page === 0 ? Array.from({ length: 100 }, (_, i) => i + 1) : [101]).map((id) => ({
        id, eventId: id, studentId: 1, status: 'REGISTERED', version: 1, eventTitle: e(id).title, location: 'Hội trường',
        startsAt: at(id === 101 ? 10 : -120), endsAt: at(id === 101 ? 120 : -60), registeredAt: at(-150),
      })) });
    }
    if (path === '/events/101/attendance/preview') {
      if (previewError) return send({ code: 'QR_SESSION_INVALID', message: 'QR đã đóng.' }, 409);
      return send({ eventId: 101, eventVersion: 1, title: e(101).title, location: 'Hội trường', startsAt: at(10), endsAt: at(120),
        sessionId: 1, expiresAt: at(5), registrationId: 1, registrationVersion: 1, attendanceVersion: 1, alreadyPresent: true });
    }
    if (path === '/events/101/attendance') return send({ eventId: 101, registrationId: 1, registrationStatus, attendanceState, attendance: record });
    if (path === '/organizer/events') {
      const page = Number(url.searchParams.get('page')); ownedPages.push(page);
      return send({ page, size: 100, hasNext: page === 0, items: page === 0 ? Array.from({ length: 100 }, (_, i) => e(i + 1, 'DRAFT')) : [e(101)] });
    }
    if (path === '/organizer/events/101/attendance') return send({ items: [], page: 0, size: 20, hasNext: false, summary: {
      eventId: 101, title: e(101).title, generatedAt: at(0), endsAt: at(120), hasEnded: false,
      registeredCount: 0, waitingCount: 0, cancelledCount: 0, presentCount: 0, notRecordedCount: 0, absentCount: null, attendanceRate: null,
    } });
    errors.push(`Unexpected request ${path}`); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const scan = async () => {
    await page.goto(`${base}/scan`);
    await page.getByRole('button', { name: 'Bật camera để quét', exact: true }).click();
  };
  try {
    await scan();
    await page.getByRole('heading', { name: 'Chưa đủ điều kiện điểm danh', exact: true }).waitFor();
    assert.equal(await page.getByText('Bạn đã điểm danh trước đó', { exact: true }).count(), 0);
    await page.getByText('Sự kiện 101', { exact: true }).waitFor();
    assert.deepEqual(registrationPages.slice(0, 2), [0, 1]);
    console.log('PASS cancelled after preview never displays historical PRESENT; scan loads the second registration page');

    registrationStatus = 'REGISTERED'; attendanceState = 'NOT_RECORDED'; previewError = true;
    await scan();
    await page.getByRole('heading', { name: 'Mã QR không còn hiệu lực', exact: true }).waitFor();
    assert.equal(await page.getByText('Bạn đã điểm danh trước đó', { exact: true }).count(), 0);
    console.log('PASS invalid-QR fallback requires the current derived PRESENT state');

    attendanceState = 'PRESENT';
    await scan();
    await page.getByRole('heading', { name: 'Bạn đã điểm danh trước đó', exact: true }).waitFor();
    console.log('PASS valid current attendance remains visible after the QR session closes');

    role = 'ORGANIZER';
    await page.goto(`${base}/reports?event=101`);
    await page.getByRole('combobox', { name: 'Chọn sự kiện' }).getByRole('option', { name: /Sự kiện 101/ }).waitFor({ state: 'attached' });
    assert.deepEqual(ownedPages, [0, 1]);
    assert.equal(await page.getByRole('combobox', { name: 'Chọn sự kiện' }).inputValue(), '101');
    assert.deepEqual(errors, []);
    console.log('PASS 100 newer drafts do not hide an older published event in organizer reports');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
