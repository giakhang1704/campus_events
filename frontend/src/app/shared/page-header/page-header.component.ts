import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title block (mockup `head()`); project action buttons via <ng-content>. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
