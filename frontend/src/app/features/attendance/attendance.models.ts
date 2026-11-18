/**
 * I3 contracts (docs/api/I3.md): QR sessions, check-in, manual attendance, history, report.
 * Shared by /scan (student), /attendance and /reports (organizer). Timestamps are ISO 8601 with offset.
 */
import { RegistrationStatus } from '../registrations/registration.models';

export type AttendanceResult = 'PRESENT' | 'NOT_RECORDED';
export type AttendanceMethod = 'QR' | 'MANUAL' | 'SYSTEM';
/** Derived by the server: ABSENT only after ends_at; NOT_APPLICABLE for WAITLISTED/CANCELLED. */
export type AttendanceState = 'PRESENT' | 'NOT_RECORDED' | 'ABSENT' | 'NOT_APPLICABLE';

// ── QR session (organizer) ──────────────────────────────────────────────────

export interface QrSession {
  id: number;
  eventId: number;
  openedAt: string;
  expiresAt: string;
  closedAt: string | null;
  /** False once expired; an inactive session never carries the payload. */
  active: boolean;
  /** JSON text encoded in the QR; only for the owning organizer while active. */
  qrPayload: string | null;
}

/** Session length the API accepts (always cut at ends_at by the server). */
export const QR_DURATION_MIN = 1;
export const QR_DURATION_MAX = 30;
/** The QR can be opened from this long before starts_at until ends_at. */
export const QR_OPENS_BEFORE_START_MS = 30 * 60 * 1000;

// ── Scan / check-in (student) ───────────────────────────────────────────────

/** Content of the QR code: {"type":"BKeventCheckIn","eventId":6,"sessionId":1,"token":"<43 chars>"}. */
export interface CheckInQr {
  eventId: number;
  sessionId: number;
  token: string;
}

/** Returns null when the text is not a BKevent check-in code (any other QR, or a damaged one). */
export function parseCheckInQr(text: string): CheckInQr | null {
  try {
    const data = JSON.parse(text);
    const valid =
      data?.type === 'BKeventCheckIn' &&
      Number.isInteger(data.eventId) && data.eventId > 0 &&
      Number.isInteger(data.sessionId) && data.sessionId > 0 &&
      typeof data.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(data.token);
    return valid ? { eventId: data.eventId, sessionId: data.sessionId, token: data.token } : null;
  } catch {
    return null;
  }
}

/** POST .../attendance/preview: read-only; keep the versions to send with the confirmation. */
export interface AttendancePreview {
  eventId: number;
  eventVersion: number;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  sessionId: number;
  expiresAt: string;
  registrationId: number;
  registrationVersion: number;
  /** 0 when no attendance row exists yet. */
  attendanceVersion: number;
  alreadyPresent: boolean;
}

/** Body of POST .../attendance/check-in: the scanned code plus the versions the student confirmed. */
export interface CheckInRequest {
  sessionId: number;
  token: string;
  eventVersion: number;
  registrationVersion: number;
  attendanceVersion: number;
}

export interface Attendance {
  registrationId: number;
  eventId: number;
  result: AttendanceResult;
  method: AttendanceMethod;
  sessionId: number | null;
  recordedBy: number | null;
  recordedAt: string;
  reason: string | null;
  version: number;
}

/** GET /events/{id}/attendance: the student's own state for one event. */
export interface MyAttendance {
  eventId: number;
  registrationId: number | null;
  registrationStatus: RegistrationStatus | null;
  attendanceState: AttendanceState | null;
  attendance: Attendance | null;
}

// ── Manual attendance and history (organizer) ───────────────────────────────

export interface ManualAttendanceRequest {
  result: AttendanceResult;
  /** attendanceVersion of the row (0 when there is no attendance row yet). */
  version: number;
  registrationVersion: number;
  /** Required, max 500 characters. */
  reason: string;
}
export const MANUAL_REASON_MAX = 500;

export interface AttendanceHistoryEntry {
  id: number;
  registrationId: number;
  actorId: number;
  oldResult: AttendanceResult | null;
  newResult: AttendanceResult;
  reason: string;
  changedAt: string;
  /** Snapshots for display only (I2 trigger rows use SQL column names, API rows use model fields). */
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

export interface AttendanceHistoryPage {
  items: AttendanceHistoryEntry[];
  page: number;
  size: number;
  hasNext: boolean;
}

// ── Report (organizer) ──────────────────────────────────────────────────────

export interface EventReport {
  eventId: number;
  title: string;
  generatedAt: string;
  endsAt: string;
  hasEnded: boolean;
  registeredCount: number;
  waitingCount: number;
  cancelledCount: number;
  presentCount: number;
  notRecordedCount: number;
  /** null before ends_at (not final yet). */
  absentCount: number | null;
  /** Percentage with one decimal; null when nobody is registered. */
  attendanceRate: number | null;
}

export interface AttendanceRow {
  registrationId: number;
  registrationVersion: number;
  studentId: number;
  studentCode: string;
  fullName: string;
  email: string;
  department: string;
  studyYear: number;
  registrationStatus: RegistrationStatus;
  result: AttendanceResult | null;
  attendanceState: AttendanceState;
  method: AttendanceMethod | null;
  recordedAt: string | null;
  /** 0 when no attendance row exists yet. */
  attendanceVersion: number;
}

export interface AttendanceListPage {
  summary: EventReport;
  items: AttendanceRow[];
  page: number;
  size: number;
  hasNext: boolean;
}

/**
 * Registration filter of the attendance list and CSV. Unlike I2 lists, the API defaults to REGISTERED
 * when the parameter is missing; 'ALL' sends `status=` to include every registration.
 */
export type AttendanceFilter = 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'ALL';

export const ATTENDANCE_STATE_BADGE: Record<AttendanceState, { label: string; css: string }> = {
  PRESENT: { label: 'Có mặt', css: 'badge' },
  NOT_RECORDED: { label: 'Chưa ghi nhận', css: 'badge gray' },
  ABSENT: { label: 'Vắng', css: 'badge red' },
  NOT_APPLICABLE: { label: 'Không áp dụng', css: 'badge gray' },
};

export const METHOD_LABEL: Record<AttendanceMethod, string> = {
  QR: 'Quét QR',
  MANUAL: 'Thủ công',
  SYSTEM: 'Hệ thống',
};
