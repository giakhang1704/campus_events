import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** "Trang trước · Trang n · Trang sau" for APIs that return `page` + `hasNext`. Hidden when there is one page. */
@Component({
  selector: 'app-pager',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (page() > 0 || hasNext()) {
      <div class="pager">
        <button type="button" class="small" [disabled]="page() === 0 || disabled()" (click)="pageChange.emit(page() - 1)"><app-icon name="back" /> Trang trước</button>
        <span>Trang {{ page() + 1 }}</span>
        <button type="button" class="small" [disabled]="!hasNext() || disabled()" (click)="pageChange.emit(page() + 1)">Trang sau <app-icon name="arrow" /></button>
      </div>
    }
  `,
})
export class PagerComponent {
  /** 0-based. */
  readonly page = input.required<number>();
  readonly hasNext = input.required<boolean>();
  readonly disabled = input(false);
  readonly pageChange = output<number>();
}
