/**
 * Date and time formatting for the whole app.
 *
 * The API stores instants in UTC (ISO 8601 strings). Every screen shows them in Vietnam time,
 * whatever the device's own timezone, so each formatter passes `timeZone: VIETNAM_TIME_ZONE`.
 *
 * One vocabulary everywhere:
 *   formatLongDate   "Thứ Năm, 12/11/2026"            headline dates
 *   formatDate       "12/11/2026"                     compact dates
 *   formatTime       "08:00"
 *   formatDateTime   "Thứ Năm, 12/11/2026 · 08:00"    timestamps (registration window, tables)
 *   formatTimeRange  "14:00 – 17:00"                  start and end of one event
 */

export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 5 -> "05". Used for hours, minutes, days and months. */
export function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** "11/11". Built from parts because the vi-VN locale would print day + month as "11-11". */
export function formatDayMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: VIETNAM_TIME_ZONE, day: '2-digit', month: '2-digit' })
    .formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}`;
}

/** "08:00" (24-hour clock). */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: VIETNAM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(iso));
}

/** "12/11/2026" */
export function formatDate(iso: string): string {
  const year = new Intl.DateTimeFormat('en-GB', { timeZone: VIETNAM_TIME_ZONE, year: 'numeric' }).format(new Date(iso));
  return `${formatDayMonth(iso)}/${year}`;
}

/** "Thứ Năm, 12/11/2026" (weekday capitalised: the locale prints "thứ Năm"). */
export function formatLongDate(iso: string): string {
  const text = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
  return capitalize(text);
}

/** "Thứ Năm, 12/11/2026 · 08:00" */
export function formatDateTime(iso: string): string {
  return `${formatLongDate(iso)} · ${formatTime(iso)}`;
}

/**
 * Start and end of one event:
 *   same day        "14:00 – 17:00"
 *   past midnight   "23:00 – 01:00 hôm sau"
 *   several days    "08:00 – Thứ Hai, 16/11/2026 · 17:00"
 * Days are compared as Vietnam calendar dates, not as 24-hour spans.
 */
export function formatTimeRange(startIso: string, endIso: string): string {
  const startDay = formatDate(startIso);
  const endDay = formatDate(endIso);
  if (startDay === endDay) return `${formatTime(startIso)} – ${formatTime(endIso)}`;

  const dayAfterStart = formatDate(new Date(Date.parse(startIso) + ONE_DAY_MS).toISOString());
  if (endDay === dayAfterStart) return `${formatTime(startIso)} – ${formatTime(endIso)} hôm sau`;

  return `${formatTime(startIso)} – ${formatDateTime(endIso)}`;
}

/** The pieces of the date tile on event cards and the detail banner: "08" / "Tháng 11" / "Chủ Nhật" / "14:00". */
export function dateTile(iso: string): { day: string; month: string; weekday: string; time: string } {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: VIETNAM_TIME_ZONE, day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('en-GB', { timeZone: VIETNAM_TIME_ZONE, month: 'numeric' }).format(date);
  const weekday = new Intl.DateTimeFormat('vi-VN', { timeZone: VIETNAM_TIME_ZONE, weekday: 'long' }).format(date);
  return { day, month: 'Tháng ' + month, weekday: capitalize(weekday), time: formatTime(iso) };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
