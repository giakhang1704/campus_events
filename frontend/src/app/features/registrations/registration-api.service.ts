import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import { ParticipantPage, Registration, RegistrationPage, RegistrationState, StatusFilter } from './registration.models';

/** I2 registration endpoints. The student is always taken from the session, never sent by the client. Lists use the API's page size (20). */
@Injectable({ providedIn: 'root' })
export class RegistrationApi {
  private readonly api = inject(Api);

  state(eventId: number): Promise<RegistrationState> {
    return this.api.request(`/events/${eventId}/registration`);
  }

  /** 201 = new registration, 200 = already REGISTERED/WAITLISTED (idempotent); both return the registration. */
  register(eventId: number): Promise<Registration> {
    return this.api.request(`/events/${eventId}/registrations`, 'POST');
  }

  /** A stale `version` returns 409 VERSION_CONFLICT; cancelling again returns the current state. */
  cancel(eventId: number, version: number): Promise<Registration> {
    return this.api.request(`/events/${eventId}/registration/cancel`, 'POST', { version });
  }

  mine(status: StatusFilter, page: number, size = 20): Promise<RegistrationPage> {
    return this.api.request('/me/registrations?' + query(status, page, size));
  }

  participants(eventId: number, status: StatusFilter, page: number, size = 20): Promise<ParticipantPage> {
    return this.api.request(`/organizer/events/${eventId}/registrations?` + query(status, page, size));
  }
}

function query(status: StatusFilter, page: number, size: number): string {
  return new URLSearchParams({ status, page: String(page), size: String(size) }).toString();
}
