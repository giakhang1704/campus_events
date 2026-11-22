// Real Angular + HTTP/PostgreSQL checks. Run via scripts/test-i3-reports.ps1, never against real data.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeApi, contextFactory, inMinutes, createPublishedEvent } = require('./ui_fixtures.cjs');

const root = path.resolve(__dirname, '../..');
const base = process.env.I3_UI_BASE_URL;
const project = 'campus-events-i3-reports-test';
const password = process.env.TEST_ACCOUNT_PASSWORD;
assert.equal(base, 'http://127.0.0.1:14204', 'Use the isolated report test runner.');
assert.equal(process.env.I3_REPORTS_TEST_PROJECT, project, 'SQL fixtures require the dedicated test project.');
assert.ok(password, 'TEST_ACCOUNT_PASSWORD is required.');
const artifacts = path.join(root, 'frontend/.angular/i3-reports');
fs.mkdirSync(artifacts, { recursive: true });
for (const file of ['failure.png', 'results.json']) fs.rmSync(path.join(artifacts, file), { force: true });
const api = makeApi(base);
const cases = [];
const watchdog = setTimeout(() => { console.error('Report browser checks exceeded 3 minutes.'); process.exit(1); }, 180000);
watchdog.unref();
function pass(name) { cases.push(name); console.log(`PASS ${name}`); }

// Parse the downloaded CSV, including quoted commas, CRLF and escaped quotes.
function csvRows(buffer) {
  assert.deepEqual([...buffer.subarray(0, 3)], [239, 187, 191], 'UTF-8 BOM');
  const text = buffer.toString('utf8').replace(/^\ufeff/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  const [headers, ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i]])));
}

function endEvent(eventId) {
  assert.ok(Number.isSafeInteger(eventId) && eventId > 0);
  const sql = `UPDATE campus.events SET registration_opens_at=clock_timestamp()-interval '3 hours', registration_closes_at=clock_timestamp()-interval '2 hours', starts_at=clock_timestamp()-interval '1 hour', ends_at=clock_timestamp()-interval '1 second' WHERE id=${eventId};`;
  const result = spawnSync('docker', ['compose', '-p', project, '-f', 'compose.i3-test.yaml', 'exec', '-T', 'db', 'psql', '-U', 'campus_test', '-d', 'campus_i1_test', '-v', 'ON_ERROR_STOP=1', '-c', sql], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.I3_UI_CHANNEL || 'msedge' });
  const errors = [];
  const newContext = contextFactory(browser, errors);
  let page;
  try {
    const org = await newContext();
    await api(org, 'POST', '/auth/login', { email: 'organizer.i1@example.test', password });
    const [departments, units] = await Promise.all([api(org, 'GET', '/catalog/departments'), api(org, 'GET', '/catalog/organization-units')]);
    const suffix = crypto.randomBytes(4).toString('hex');
    const event = await createPublishedEvent(api, org, units[0].id, {
      title: `Báo cáo, "I3" ${suffix}`, capacity: 21,
      registrationClosesAt: inMinutes(5), startsAt: inMinutes(10), endsAt: inMinutes(120),
    });
    const empty = await createPublishedEvent(api, org, units[0].id, { title: `Chưa có đăng ký ${suffix}` });
    const student = async (key, fullName = `Sinh viên ${key} ${suffix}`) => {
      const context = await newContext();
      await api(context, 'POST', '/auth/register', {
        fullName, email: `i3-report-${suffix}-${key}@example.test`, studentCode: `R${suffix}${key}`, password,
        departmentId: departments[0].id, studyYear: 2,
      });
      await api(context, 'POST', '/auth/login', { email: `i3-report-${suffix}-${key}@example.test`, password });
      const registration = await api(context, 'POST', `/events/${event.id}/registrations`);
      return { context, registration, fullName };
    };
    const manual = (s) => api(org, 'PUT', `/organizer/events/${event.id}/attendance/${s.registration.id}`, {
      result: 'PRESENT', version: 0, registrationVersion: s.registration.version, reason: 'Dữ liệu kiểm thử báo cáo',
    });
    const cancelled = await student('cancel', '=SUM(1,2) "Đã hủy"');
    await manual(cancelled);
    await api(cancelled.context, 'POST', `/events/${event.id}/registration/cancel`, { version: cancelled.registration.version });
    const students = [];
    // Sequential registration fixes the row order and the FIFO position.
    for (let n = 0; n < 21; n++) students.push(await student(String(n).padStart(2, '0')));
    const waiting = await student('wait');
    await manual(students[0]);
    await manual(students[1]);
    assert.equal(waiting.registration.status, 'WAITLISTED');

    page = await org.newPage();
    await page.goto(`${base}/reports?event=${event.id}`);
    const stats = page.getByRole('region', { name: 'Tổng quan báo cáo' });
    const statValues = () => stats.locator('.stat strong').allTextContents();
    const ready = () => stats.waitFor();
    const row = (s) => page.getByRole('row').filter({ hasText: s.fullName });
    const filter = page.getByLabel('Lọc lượt đăng ký', { exact: true });
    const download = async (name) => {
      const response = page.waitForResponse((r) => r.url().includes(`/events/${event.id}/report.csv`));
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Tải CSV', exact: true }).click();
      const file = await pending;
      assert.equal(await file.failure(), null);
      assert.match(file.suggestedFilename(), /^bk-event-\d+-report-(registered|all|cancelled|waitlisted)\.csv$/);
      const filePath = path.join(artifacts, name);
      await file.saveAs(filePath);
      return { rows: csvRows(fs.readFileSync(filePath)), response: await response };
    };
    await ready();
    assert.deepEqual(await statValues(), ['21', '2', '19', '9,5%']);
    await page.getByText('Tạm tính', { exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 20);
    await row(students[0]).getByText('Có mặt', { exact: true }).waitFor();
    assert.equal(await row(cancelled).count(), 0);
    const summary = await api(org, 'GET', `/organizer/events/${event.id}/report`);
    assert.equal(summary.presentCount, 2);
    assert.equal(summary.attendanceRate, 9.5);
    pass('real summary, temporary numbers, official-only denominator');

    // Download from page 2: the file must still contain all 21 official registrations.
    await page.getByRole('button', { name: /Trang sau/ }).click();
    await row(students[20]).waitFor();
    assert.match(page.url(), /page=2/);
    const fullCsv = await download('registered.csv');
    assert.equal(fullCsv.rows.length, 21);
    assert.ok(fullCsv.rows.every((r) => r.registration_status === 'REGISTERED' && r.present_count === '2'));
    assert.match(fullCsv.rows[0].generated_at, /\+07:00$/);
    assert.equal(fullCsv.rows[0].event_title, event.title);
    pass('pagination and full CSV download with Vietnamese text, quotes, BOM and +07:00');

    await filter.selectOption('ALL');
    await row(cancelled).getByText('Không áp dụng', { exact: true }).waitFor();
    assert.doesNotMatch(page.url(), /page=/);
    assert.deepEqual(await statValues(), ['21', '2', '19', '9,5%']);
    assert.equal(await row(cancelled).getByText('Có mặt', { exact: true }).count(), 0);
    const allCsv = await download('all.csv');
    assert.equal(new URL(allCsv.response.url()).searchParams.get('status'), '');
    assert.equal(allCsv.rows.length, 23);
    const old = allCsv.rows.find((r) => r.registration_status === 'CANCELLED');
    assert.equal(old.attendance_state, 'NOT_APPLICABLE');
    assert.equal(old.full_name, `'${cancelled.fullName}`);
    pass('ALL sends status=; cancelled PRESENT evidence excluded; CSV formula protection');

    await filter.selectOption('WAITLISTED');
    await row(waiting).getByText('Không áp dụng', { exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.reload();
    await row(waiting).waitFor();
    assert.equal(await filter.inputValue(), 'WAITLISTED');
    await page.goBack();
    await row(cancelled).waitFor();
    assert.equal(await filter.inputValue(), 'ALL');
    pass('filter, reload and browser Back preserve URL state');

    await page.getByLabel('Chọn sự kiện', { exact: true }).selectOption(String(empty.id));
    await stats.getByText('Không áp dụng', { exact: true }).waitFor();
    assert.deepEqual(await statValues(), ['0', '0', '0', 'Không áp dụng']);
    await page.getByRole('heading', { name: 'Không có lượt đăng ký phù hợp' }).waitFor();
    const pendingEmpty = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Tải CSV', exact: true }).click();
    const emptyDownload = await pendingEmpty;
    await emptyDownload.saveAs(path.join(artifacts, 'empty.csv'));
    const emptyRows = csvRows(fs.readFileSync(path.join(artifacts, 'empty.csv')));
    assert.equal(emptyRows.length, 1);
    assert.equal(emptyRows[0].attendance_rate_percent, '');
    assert.equal(emptyRows[0].registration_id, '');
    pass('empty event, null rate and summary-only CSV');

    // Network/error UX and a delayed old event response; successful fixtures above use real APIs.
    const listUrl = `**/api/organizer/events/${event.id}/attendance?*`;
    await page.route(listUrl, (route) => route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: 'Dịch vụ báo cáo tạm gián đoạn.' } }));
    await page.getByLabel('Chọn sự kiện', { exact: true }).selectOption(String(event.id));
    await page.getByRole('heading', { name: 'Chưa tải được báo cáo' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tải CSV', exact: true }).isDisabled(), true);
    await page.unroute(listUrl);
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await ready();
    pass('list failure and retry');

    const csvUrl = `**/api/organizer/events/${event.id}/report.csv?*`;
    let unexpectedDownload = false;
    const onDownload = () => { unexpectedDownload = true; };
    page.on('download', onDownload);
    await page.route(csvUrl, (route) => route.fulfill({ status: 413, json: { code: 'REPORT_TOO_LARGE', message: 'Too large' } }));
    await page.getByRole('button', { name: 'Tải CSV', exact: true }).click();
    await page.getByRole('alert').getByText(/Bản xuất vượt giới hạn 10.000 dòng/).waitFor();
    assert.equal(unexpectedDownload, false);
    await page.unroute(csvUrl);
    await download('retry.csv');
    page.off('download', onDownload);
    pass('413 export failure is shown, no error file download, retry succeeds');

    let releaseList;
    let listIntercepted;
    const listStarted = new Promise((resolve) => { listIntercepted = resolve; });
    const listGate = new Promise((resolve) => { releaseList = resolve; });
    let listFinished;
    const oldListDone = new Promise((resolve) => { listFinished = resolve; });
    await page.route(listUrl, async (route) => {
      const response = await route.fetch();
      listIntercepted();
      await listGate;
      await route.fulfill({ response });
      listFinished();
    });
    await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
    await listStarted;
    await page.getByRole('status').getByText('Đang tải báo cáo…', { exact: true }).waitFor();
    await page.getByLabel('Chọn sự kiện', { exact: true }).selectOption(String(empty.id));
    await stats.getByText('Không áp dụng', { exact: true }).waitFor();
    releaseList();
    await oldListDone;
    await page.unroute(listUrl);
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.deepEqual(await statValues(), ['0', '0', '0', 'Không áp dụng']);
    pass('late list response cannot overwrite the newly selected event');

    // A pending CSV is abandoned when the user chooses a different event.
    await page.getByLabel('Chọn sự kiện', { exact: true }).selectOption(String(event.id));
    await ready();
    let releaseCsv;
    let csvIntercepted;
    const csvStarted = new Promise((resolve) => { csvIntercepted = resolve; });
    const csvGate = new Promise((resolve) => { releaseCsv = resolve; });
    await page.route(csvUrl, async (route) => {
      const response = await route.fetch();
      csvIntercepted();
      await csvGate;
      await route.fulfill({ response });
    });
    unexpectedDownload = false;
    page.on('download', onDownload);
    await page.getByRole('button', { name: 'Tải CSV', exact: true }).click();
    await csvStarted;
    await page.getByRole('button', { name: 'Đang tải CSV…', exact: true }).waitFor();
    await page.getByLabel('Chọn sự kiện', { exact: true }).selectOption(String(empty.id));
    await stats.getByText('Không áp dụng', { exact: true }).waitFor();
    const csvCompleted = page.waitForResponse((r) => r.url().includes(`/events/${event.id}/report.csv`));
    releaseCsv();
    await (await csvCompleted).finished();
    // Readiness after the response is processed; no old-context file should have started.
    await page.getByRole('button', { name: 'Tải CSV', exact: true }).waitFor();
    await page.unroute(csvUrl);
    assert.equal(unexpectedDownload, false);
    page.off('download', onDownload);
    pass('late CSV response is discarded after changing event');

    // Event end changes derived states in the database, without writing ABSENT attendance records.
    endEvent(event.id);
    await page.getByLabel('Chọn sự kiện', { exact: true }).selectOption(String(event.id));
    await page.getByText('Đã kết thúc', { exact: true }).waitFor();
    await row(students[2]).getByText('Vắng', { exact: true }).waitFor();
    assert.deepEqual(await statValues(), ['21', '2', '19', '9,5%']);
    const ended = await download('ended.csv');
    assert.equal(ended.rows.filter((r) => r.attendance_state === 'ABSENT').length, 19);
    assert.ok(ended.rows.every((r) => r.has_ended === 'true' && r.absent_count === '19'));
    pass('after ends_at: correct absence labels and CSV counts');

    // Permission checks include direct API calls, outside the Angular route guard.
    const guest = await newContext();
    await api(guest, 'GET', `/organizer/events/${event.id}/report`, undefined, 401);
    await api(guest, 'GET', `/organizer/events/${event.id}/report.csv`, undefined, 401);
    for (const [context, home] of [[students[0].context, '/events']]) {
      const otherPage = await context.newPage();
      await otherPage.goto(`${base}/reports?event=${event.id}`);
      await otherPage.waitForURL(`${base}${home}`);
      await api(context, 'GET', `/organizer/events/${event.id}/report`, undefined, 403);
      await api(context, 'GET', `/organizer/events/${event.id}/report.csv`, undefined, 403);
    }
    const admin = await newContext();
    await api(admin, 'POST', '/auth/login', { email: 'admin.i1@example.test', password });
    const adminPage = await admin.newPage();
    await adminPage.goto(`${base}/reports?event=${event.id}`);
    await adminPage.waitForURL(`${base}/admin/accounts`);
    await api(admin, 'GET', `/organizer/events/${event.id}/report`, undefined, 403);
    await api(admin, 'GET', `/organizer/events/${event.id}/report.csv`, undefined, 403);
    const other = await api(admin, 'POST', '/admin/users', {
      fullName: 'Người tổ chức khác', email: `other-report-${suffix}@example.test`, temporaryPassword: password,
      organizationUnitId: units[0].id, reason: 'Kiểm thử phạm vi báo cáo',
    });
    const outsider = await newContext();
    await api(outsider, 'POST', '/auth/login', { email: other.email, password });
    await api(outsider, 'POST', '/auth/password', { currentPassword: password, newPassword: password + 'Other' }, 204);
    await api(outsider, 'POST', '/auth/login', { email: other.email, password: password + 'Other' });
    await api(outsider, 'GET', `/organizer/events/${event.id}/report`, undefined, 404);
    await api(outsider, 'GET', `/organizer/events/${event.id}/report.csv`, undefined, 404);
    await api(outsider, 'GET', `/organizer/events/${event.id}/attendance`, undefined, 404);
    const outsiderPage = await outsider.newPage();
    await outsiderPage.goto(`${base}/reports?event=${event.id}`);
    await outsiderPage.getByRole('heading', { name: 'Chưa có sự kiện nào được công bố' }).waitFor();
    assert.equal(await outsiderPage.getByRole('button', { name: 'Tải CSV', exact: true }).count(), 0);
    pass('student/admin route guards, direct API permissions and organizer ownership');

    // The CSV request may lose its session after the report was already loaded.
    await page.route(csvUrl, (route) => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập đã hết hạn.' } }));
    unexpectedDownload = false;
    page.on('download', onDownload);
    await page.getByRole('button', { name: 'Tải CSV', exact: true }).click();
    await page.waitForURL(`${base}/login`);
    await page.getByRole('heading', { name: 'Đăng nhập', exact: true }).waitFor();
    assert.equal(unexpectedDownload, false);
    page.off('download', onDownload);
    await page.unroute(csvUrl);
    await page.goto(`${base}/reports?event=${event.id}`);
    await ready();
    pass('expired session during export redirects to login without downloading JSON');

    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page should not scroll sideways on mobile.');
    assert.ok((await page.locator('tbody td').first().boundingBox()).width >= 230, 'Student column must stay readable while the table scrolls.');
    await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
    assert.deepEqual(errors, [], `Uncaught browser errors: ${errors.join(' | ')}`);
    pass('desktop/mobile layout and no uncaught browser exceptions');
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), cases }, null, 2));
    console.log(`I3 reports: ${cases.length} checks passed.`);
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
