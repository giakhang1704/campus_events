import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { CampusEvent } from './event.models';
import { dateTile, registrationWindow, WINDOW_BADGE } from './event-view';

/**
 * Published event card. The date lives only in the tile at the top (day, month, weekday, time);
 * the body carries the organiser, title, description, place and capacity.
 */
@Component({
  selector: 'app-public-event-card',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <a class="poster" [routerLink]="['/events', event().id]" tabindex="-1" aria-hidden="true">
        <span class="date-tile">
          <strong>{{ tile().day }}</strong>
          <span><b>{{ tile().month }}</b><small>{{ tile().weekday }}</small></span>
        </span>
        <span class="poster-tag"><app-icon name="clock" /> {{ tile().time }}</span>
      </a>
      <div class="card-body">
        @if (unitName()) {
          <p class="card-unit" [attr.title]="unitName()">{{ unitName() }}</p>
        }
        <h3><a [routerLink]="['/events', event().id]">{{ event().title }}</a></h3>
        <p class="card-desc">{{ event().description }}</p>
        <div class="meta">
          <app-icon name="pin" /> <span class="card-loc" [attr.title]="event().location">{{ event().location }}</span><br />
          <app-icon name="users" /> {{ capacity() }} chỗ
        </div>
        <div class="card-foot">
          <span class="badge" [class]="badge().css">{{ badge().label }}</span>
          <a class="text-button" [routerLink]="['/events', event().id]" [attr.aria-label]="'Chi tiết: ' + event().title">Chi tiết <app-icon name="arrow" /></a>
        </div>
      </div>
    </article>
  `,
})
export class PublicEventCardComponent {
  readonly event = input.required<CampusEvent>();
  readonly unitName = input('');
  protected readonly tile = computed(() => dateTile(this.event().startsAt));
  protected readonly capacity = computed(() => new Intl.NumberFormat('vi-VN').format(this.event().capacity));
  protected readonly badge = computed(() => {
    const b = WINDOW_BADGE[registrationWindow(this.event())];
    return { label: b.label, css: ('badge ' + b.css).trim() };
  });
}
