import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

/** DEV ONLY: switches the data source of the screen via ?data= (api = live backend). Rendered only when isDevMode() and ?data is set. */
@Component({
  selector: 'app-fixture-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fx" role="group" aria-label="Dữ liệu thử (chỉ ở dev)">
      @for (o of options; track o.key) {
        <button type="button" class="fx-seg" [class.on]="current() === o.key" [attr.aria-pressed]="current() === o.key" (click)="pick(o.key)">
          {{ o.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .fx { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 1000; display: flex; gap: 2px;
      padding: 3px; background: #e5e5e5; border-radius: 10px; font: 12px/1 system-ui, sans-serif;
      max-width: calc(100vw - 16px); overflow-x: auto; }
    .fx-seg { all: unset; cursor: pointer; padding: 7px 10px; border-radius: 7px; color: #333; white-space: nowrap; }
    .fx-seg.on { background: #fff; color: #000; }
    .fx-seg:focus-visible { outline: 2px solid #333; }
  `,
})
export class FixtureToggleComponent {
  private readonly router = inject(Router);
  protected readonly options = [
    { key: 'api', label: 'API thật' },
    { key: 'demo', label: 'Demo data' },
    { key: 'worst', label: 'Worst case' },
    { key: 'empty', label: 'Empty' },
    { key: 'one', label: 'One' },
    { key: 'huge', label: '1,284 rows' },
  ];
  protected readonly current = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('data') ?? 'api')), {
    initialValue: 'api',
  });

  protected pick(key: string): void {
    void this.router.navigate([], { queryParams: { data: key }, queryParamsHandling: 'merge' });
  }
}
