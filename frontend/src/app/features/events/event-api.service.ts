import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import { CampusEvent, EventContent, EventPage } from './event.models';

@Injectable({ providedIn: 'root' })
export class EventApi {
  private readonly api = inject(Api);

  listOwned(page = 0, size = 10): Promise<EventPage> {
    return this.api.request('/organizer/events?' + new URLSearchParams({ page: String(page), size: String(size) }));
  }

  getOwned(id: number): Promise<CampusEvent> {
    return this.api.request('/organizer/events/' + id);
  }

  create(content: EventContent): Promise<CampusEvent> {
    return this.api.request('/events', 'POST', content);
  }

  update(id: number, content: EventContent): Promise<CampusEvent> {
    return this.api.request('/events/' + id, 'PATCH', content);
  }

  publish(event: CampusEvent): Promise<CampusEvent> {
    return this.api.request('/events/' + event.id + '/publish', 'POST', { version: event.version });
  }
}
