// Shared setup for the browser smoke tests (i2_ui.cjs, i3_attendance_ui.cjs): API calls through a
// Playwright browser context, so fixtures and pages share one session cookie.
const assert = require('node:assert/strict');

/**
 * api(context, method, url, body?, expected?) against `${base}/api`. Writes fetch a CSRF token first;
 * each fetch issues a new token, so run writes of one context one after another, never in parallel.
 */
function makeApi(base) {
  return async function api(context, method, url, body, expected = [200, 201]) {
    const headers = {};
    if (method !== 'GET') headers['X-XSRF-TOKEN'] = (await (await context.request.get(base + '/api/auth/csrf')).json()).token;
    const response = await context.request.fetch(base + '/api' + url, { method, headers, data: body });
    const text = await response.text();
    assert.ok([].concat(expected).includes(response.status()), `${method} ${url}: ${response.status()} ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

/** newContext() for a desktop viewport; uncaught page errors are collected in `errors`. */
function contextFactory(browser, errors) {
  return async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
    return context;
  };
}

/** ISO timestamp `minutes` from now. */
const inMinutes = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

/** Organizer creates and publishes an event; `overrides` replace the defaults (all times relative to now). */
async function createPublishedEvent(api, org, unitId, overrides = {}) {
  const draft = await api(org, 'POST', '/events', {
    description: 'Sự kiện kiểm thử giao diện tự động', location: 'Hội trường A', organizationUnitId: unitId,
    registrationOpensAt: inMinutes(-24 * 60), registrationClosesAt: inMinutes(60),
    startsAt: inMinutes(120), endsAt: inMinutes(240), capacity: 1, departmentIds: [], studyYears: [],
    ...overrides,
  });
  return api(org, 'POST', `/events/${draft.id}/publish`, { version: draft.version });
}

module.exports = { makeApi, contextFactory, inMinutes, createPublishedEvent };
