import { User } from '../../core/api';
import { CampusEvent } from './event.models';

/** Display helpers for published events (student screens). Pure functions, no API calls. */

export type RegistrationWindow = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'FINISHED';

export function registrationWindow(event: CampusEvent, now = Date.now()): RegistrationWindow {
  if (now >= Date.parse(event.endsAt)) return 'FINISHED';
  if (now < Date.parse(event.registrationOpensAt)) return 'UPCOMING';
  if (now < Date.parse(event.registrationClosesAt)) return 'OPEN';
  return 'CLOSED';
}

export const WINDOW_BADGE: Record<RegistrationWindow, { label: string; css: string }> = {
  UPCOMING: { label: 'Sắp mở đăng ký', css: 'blue' },
  OPEN: { label: 'Đang nhận đăng ký', css: '' },
  CLOSED: { label: 'Đã đóng đăng ký', css: 'amber' },
  FINISHED: { label: 'Đã kết thúc', css: 'gray' },
};

/** Department AND study year; an empty list means no restriction (docs/decisions/SCOPE.md). */
export function isEligible(event: CampusEvent, user: User | null): boolean {
  if (!user || user.role !== 'STUDENT') return false;
  const deptOk = !event.departmentIds.length || (user.departmentId !== null && event.departmentIds.includes(user.departmentId));
  const yearOk = !event.studyYears.length || (user.studyYear !== null && event.studyYears.includes(user.studyYear));
  return deptOk && yearOk;
}

const VN = 'Asia/Ho_Chi_Minh';

/** "11/11" (Vietnam time). Built from parts because vi-VN formats day+month as "11-11". */
export function formatDayMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: VN, day: '2-digit', month: '2-digit' }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}`;
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: VN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/*
 * One date vocabulary for the whole app (Vietnam time):
 *   formatLongDate  "Thứ Năm, 12/11/2026"  headline dates
 *   formatDate      "12/11/2026"           compact dates
 *   formatDateTime  "12/11/2026 · 08:00"   timestamps (registration window, tables)
 *   formatTime      "08:00"
 */

/** "12/11/2026" */
export function formatDate(iso: string): string {
  return `${formatDayMonth(iso)}/${new Intl.DateTimeFormat('en-GB', { timeZone: VN, year: 'numeric' }).format(new Date(iso))}`;
}

/** "12/11/2026 · 08:00" */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

/** Parts for the date tile on cards and the detail banner. */
export function dateTile(iso: string): { day: string; month: string; weekday: string; time: string } {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: VN, day: '2-digit' }).format(d);
  const month = new Intl.DateTimeFormat('en-GB', { timeZone: VN, month: 'numeric' }).format(d);
  const weekday = new Intl.DateTimeFormat('vi-VN', { timeZone: VN, weekday: 'long' }).format(d);
  return { day, month: 'Tháng ' + month, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), time: formatTime(iso) };
}

/** "Thứ Năm, 12/11/2026" */
export function formatLongDate(iso: string): string {
  const s = new Intl.DateTimeFormat('vi-VN', { timeZone: VN, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
