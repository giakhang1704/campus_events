import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ToastService } from './toast.service';

/** Toast stack, top right. Rendered once in AppComponent. */
@Component({
  selector: 'app-toasts',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class.error]="t.tone === 'error'" [class.leaving]="t.leaving" [attr.role]="t.tone === 'error' ? 'alert' : 'status'">
          <app-icon [name]="t.tone === 'error' ? 'info' : 'check'" />
          <span>{{ t.text }}</span>
          <button type="button" class="toast-close" aria-label="Đóng thông báo" (click)="toasts.dismiss(t.id)"><app-icon name="close" /></button>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}
