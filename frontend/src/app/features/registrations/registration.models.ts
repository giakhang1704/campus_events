/** I2 registration contracts (docs/api/I2.md). Timestamps are ISO 8601 with offset. */

export type RegistrationStatus = 'REGISTERED' | 'WAITLISTED' | 'CANCELLED';

export interface Registration {
  id: number;
  eventId: number;
  studentId: number;
  status: RegistrationStatus;
  version: number;
  waitlistedAt: string | null;
  registeredAt: string | null;
  cancelledAt: string | null;
  /** Only for WAITLISTED: position in the queue (not a promise of the order seats are given). */
  queuePosition: number | null;
  eventTitle: string;
  location: string;
  startsAt: string;
  endsAt: string;
}

/** GET /events/{id}/registration: the student's own state for one event. */
export interface RegistrationState {
  eventId: number;
  registration: Registration | null;
  eligible: boolean;
  registrationOpen: boolean;
  registeredCount: number;
  waitingCount: number;
  availableSeats: number;
}

export interface RegistrationPage {
  items: Registration[];
  page: number;
  size: number;
  hasNext: boolean;
}

export interface Participant {
  id: number;
  studentId: number;
  fullName: string;
  email: string;
  studentCode: string;
  departmentId: number;
  studyYear: number;
  status: RegistrationStatus;
  waitlistedAt: string | null;
  registeredAt: string | null;
  cancelledAt: string | null;
  version: number;
  queuePosition: number | null;
}

export interface ParticipantPage {
  items: Participant[];
  page: number;
  size: number;
  hasNext: boolean;
  registeredCount: number;
  waitingCount: number;
  capacity: number;
}

/** Filter value '' = every status. */
export type StatusFilter = '' | RegistrationStatus;

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'REGISTERED', label: 'Đã đăng ký' },
  { value: 'WAITLISTED', label: 'Danh sách chờ' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export const STATUS_BADGE: Record<RegistrationStatus, { label: string; css: string }> = {
  REGISTERED: { label: 'Đã đăng ký', css: 'badge' },
  WAITLISTED: { label: 'Danh sách chờ', css: 'badge amber' },
  CANCELLED: { label: 'Đã hủy', css: 'badge gray' },
};

export function parseStatusFilter(value: string | null): StatusFilter {
  return value === 'REGISTERED' || value === 'WAITLISTED' || value === 'CANCELLED' ? value : '';
}

/** Badge text for a row: "Danh sách chờ · #3" while waitlisted, else the plain status label. */
export function statusBadge(r: { status: RegistrationStatus; queuePosition: number | null }): { label: string; css: string } {
  const badge = STATUS_BADGE[r.status];
  return r.status === 'WAITLISTED' && r.queuePosition ? { ...badge, label: `${badge.label} · #${r.queuePosition}` } : badge;
}

/** The moment that matches the current status (registered / joined the queue / cancelled). */
export function statusSince(r: { status: RegistrationStatus; registeredAt: string | null; waitlistedAt: string | null; cancelledAt: string | null }): string | null {
  if (r.status === 'REGISTERED') return r.registeredAt;
  if (r.status === 'WAITLISTED') return r.waitlistedAt;
  return r.cancelledAt;
}
