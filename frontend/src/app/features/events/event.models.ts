export type EventStatus = 'DRAFT' | 'PUBLISHED';

export interface EventContent {
  title: string;
  description: string;
  location: string;
  organizationUnitId: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  departmentIds: number[];
  studyYears: number[];
  version?: number;
}

export interface CampusEvent extends EventContent {
  id: number;
  organizerId: number;
  status: EventStatus;
  publishedAt: string | null;
  version: number;
}

export interface EventPage {
  items: CampusEvent[];
  page: number;
  size: number;
  hasNext: boolean;
}

/** datetime-local values explicitly represent Vietnam time, independent of the device timezone. */
export function toVietnamInput(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(new Date(iso)).replace(' ', 'T');
}

export function toEventTimestamp(local: string): string {
  return local + '+07:00';
}

export function displayEventTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(iso));
}
