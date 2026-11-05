import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { CampusEvent } from './event.models';
import { formatDayMonth, formatLongDate, formatTime, posterColor, registrationWindow, WINDOW_BADGE } from './event-view';

/** Published event card (mockup `eventCard()`). */
@Component({
  selector: 'app-public-event-card',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <a class="poster" [class]="color()" [routerLink]="['/events', event().id]" [attr.aria-label]="event().title">
        <small>{{ unitName() }}</small>
        <strong>{{ formatDayMonth(event().startsAt) }}</strong>
        <span class="poster-tag">{{ formatTime(event().startsAt) }}</span>
      </a>
      <div class="card-body">
        <!-- DEFERRED (scope 2026-11-03): <span class="category">…</span> – no category column yet. -->
        <h3><a [routerLink]="['/events', event().id]">{{ event().title }}</a></h3>
        <p class="card-desc">{{ event().description }}</p>
        <div class="meta">
          <app-icon name="clock" /> {{ formatLongDate(event().startsAt) }} · {{ formatTime(event().startsAt) }}<br />
          <app-icon name="pin" /> <span class="card-loc" [attr.title]="event().location">{{ event().location }}</span><br />
          <app-icon name="users" /> {{ event().capacity }} chỗ
        </div>
        <div class="card-foot">
          <span class="badge" [class]="badge().css">{{ badge().label }}</span>
          <a class="text-button" [routerLink]="['/events', event().id]">Chi tiết <app-icon name="arrow" /></a>
        </div>
      </div>
    </article>
  `,
})
export class PublicEventCardComponent {
  readonly event = input.required<CampusEvent>();
  readonly unitName = input('');
  protected readonly color = computed(() => 'poster ' + posterColor(this.event()));
  protected readonly badge = computed(() => {
    const b = WINDOW_BADGE[registrationWindow(this.event())];
    return { label: b.label, css: ('badge ' + b.css).trim() };
  });
  protected readonly formatDayMonth = formatDayMonth;
  protected readonly formatTime = formatTime;
  protected readonly formatLongDate = formatLongDate;
}
