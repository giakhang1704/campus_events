import { User } from '../../core/api';
import { CampusEvent } from './event.models';

/**
 * Event rules shown on screen: registration status, badges and who may join.
 * Pure functions (no API calls, no Angular), so they are easy to test and reuse in any component.
 * Date/number formatting lives in shared/utils; it is re-exported at the bottom for existing imports.
 */

// ── Registration window (what students see) ──────────────────────────────────

/** Where "now" falls on the event's timeline. */
export type RegistrationWindow = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'FINISHED';

/**
 * The event's timeline is: registration opens → registration closes → event starts → event ends.
 *   before opening             UPCOMING  ("Sắp mở đăng ký")
 *   between opening and close  OPEN      ("Đang nhận đăng ký")
 *   after close, before end    CLOSED    ("Đã đóng đăng ký")
 *   after the end              FINISHED  ("Đã kết thúc")
 * `now` is a parameter so the rule can be tested with any moment.
 */
export function registrationWindow(event: CampusEvent, now = Date.now()): RegistrationWindow {
  if (now >= Date.parse(event.endsAt)) return 'FINISHED';
  if (now < Date.parse(event.registrationOpensAt)) return 'UPCOMING';
  if (now < Date.parse(event.registrationClosesAt)) return 'OPEN';
  return 'CLOSED';
}

/** Badge text and colour class for each window (empty class = the default green badge). */
export const WINDOW_BADGE: Record<RegistrationWindow, { label: string; css: string }> = {
  UPCOMING: { label: 'Sắp mở đăng ký', css: 'blue' },
  OPEN: { label: 'Đang nhận đăng ký', css: '' },
  CLOSED: { label: 'Đã đóng đăng ký', css: 'amber' },
  FINISHED: { label: 'Đã kết thúc', css: 'dark' },
};

// ── Eligibility ──────────────────────────────────────────────────────────────

/**
 * A student may join when their department AND their study year are allowed.
 * An empty list means "no restriction" for that condition.
 * The server checks the same rule; this only decides what the screen shows.
 */
export function isEligible(event: CampusEvent, user: User | null): boolean {
  if (!user || user.role !== 'STUDENT') return false;
  const departmentAllowed =
    !event.departmentIds.length || (user.departmentId !== null && event.departmentIds.includes(user.departmentId));
  const studyYearAllowed =
    !event.studyYears.length || (user.studyYear !== null && event.studyYears.includes(user.studyYear));
  return departmentAllowed && studyYearAllowed;
}

// ── Status for organizers ────────────────────────────────────────────────────

export type OrganizerStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'PUBLISHED' | 'FINISHED';

/**
 * The database only stores DRAFT or PUBLISHED. For a published event the organizer sees the
 * same timeline states as students (OPEN, CLOSED, FINISHED), and "Đã công bố" before registration opens.
 */
export function organizerStatus(event: CampusEvent, now = Date.now()): OrganizerStatus {
  if (event.status === 'DRAFT') return 'DRAFT';
  const window = registrationWindow(event, now);
  return window === 'UPCOMING' ? 'PUBLISHED' : window;
}

/** Same colours as WINDOW_BADGE: green open, amber closed, blue published, gray draft, dark gray over. */
export const ORGANIZER_BADGE: Record<OrganizerStatus, { label: string; css: string }> = {
  OPEN: { label: 'Đang nhận đăng ký', css: 'badge' },
  CLOSED: { label: 'Đã đóng đăng ký', css: 'badge amber' },
  PUBLISHED: { label: 'Đã công bố', css: 'badge blue' },
  DRAFT: { label: 'Bản nháp', css: 'badge gray' },
  FINISHED: { label: 'Đã kết thúc', css: 'badge dark' },
};

// ── Formatting, re-exported for files that import it from here ──────────────
export {
  dateTile,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatLongDate,
  formatTime,
  formatTimeRange,
} from '../../shared/utils/date.utils';
export { formatCount } from '../../shared/utils/number.utils';
