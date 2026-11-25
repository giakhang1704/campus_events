import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import {
  Attendance,
  AttendanceFilter,
  AttendanceHistoryPage,
  AttendanceListPage,
  AttendancePreview,
  CheckInQr,
  CheckInRequest,
  EventReport,
  ManualAttendanceRequest,
  MyAttendance,
  QrSession,
} from './attendance.models';

/**
 * I3 endpoints (docs/api/I3.md). Organizer routes need the owning organizer of a PUBLISHED event (others get 404);
 * student routes always act for the logged-in student. The QR token never goes into a URL.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private readonly api = inject(Api);

  // ── Organizer: QR session ──

  /** Returns the current session if one is still active (not extended), else opens a new one. */
  openSession(eventId: number, durationMinutes: number): Promise<QrSession> {
    return this.api.request(`/organizer/events/${eventId}/attendance/sessions`, 'POST', { durationMinutes });
  }

  /** The unclosed session, or null; an expired one comes back with active=false. */
  async currentSession(eventId: number): Promise<QrSession | null> {
    return (await this.api.request<QrSession | undefined>(`/organizer/events/${eventId}/attendance/session`)) ?? null;
  }

  /** Idempotent. */
  closeSession(eventId: number, sessionId: number): Promise<QrSession> {
    return this.api.request(`/organizer/events/${eventId}/attendance/sessions/${sessionId}/close`, 'POST');
  }

  /** QR image (SVG) of an active session; show it with URL.createObjectURL and revoke it afterwards. */
  qrSvg(eventId: number, sessionId: number): Promise<Blob> {
    return this.api.requestBlob(`/organizer/events/${eventId}/attendance/sessions/${sessionId}/qr.svg`);
  }

  // ── Student: scan ──

  /** Read-only check of a scanned code; nothing is recorded. */
  preview(qr: CheckInQr): Promise<AttendancePreview> {
    return this.api.request(`/events/${qr.eventId}/attendance/preview`, 'POST', { sessionId: qr.sessionId, token: qr.token });
  }

  /** Only after the student pressed "Xác nhận". 409 CONFIRMATION_STALE: show the new preview and ask again. */
  checkIn(eventId: number, body: CheckInRequest): Promise<Attendance> {
    return this.api.request(`/events/${eventId}/attendance/check-in`, 'POST', body);
  }

  mine(eventId: number): Promise<MyAttendance> {
    return this.api.request(`/events/${eventId}/attendance`);
  }

  // ── Organizer: list, manual changes, history ──

  list(eventId: number, filter: AttendanceFilter, page: number, size = 20): Promise<AttendanceListPage> {
    return this.api.request(`/organizer/events/${eventId}/attendance?` + listQuery(filter, { page: String(page), size: String(size) }));
  }

  /** 409 VERSION_CONFLICT when the result or the registration changed meanwhile: reload, never overwrite. */
  setManual(eventId: number, registrationId: number, body: ManualAttendanceRequest): Promise<Attendance> {
    return this.api.request(`/organizer/events/${eventId}/attendance/${registrationId}`, 'PUT', body);
  }

  history(eventId: number, registrationId: number, page: number, size = 20): Promise<AttendanceHistoryPage> {
    return this.api.request(`/organizer/events/${eventId}/attendance/${registrationId}/history?` + new URLSearchParams({ page: String(page), size: String(size) }));
  }

  // ── Organizer: report ──

  report(eventId: number): Promise<EventReport> {
    return this.api.request(`/organizer/events/${eventId}/report`);
  }

  /** CSV (UTF-8 BOM). 413 REPORT_TOO_LARGE above 10,000 rows. */
  reportCsv(eventId: number, filter: AttendanceFilter = 'REGISTERED'): Promise<Blob> {
    return this.api.requestBlob(`/organizer/events/${eventId}/report.csv?` + listQuery(filter));
  }
}

/** Missing status = REGISTERED on the server; 'ALL' must be sent as an empty `status=`. */
function listQuery(filter: AttendanceFilter, extra: Record<string, string> = {}): string {
  return new URLSearchParams({ status: filter === 'ALL' ? '' : filter, ...extra }).toString();
}
