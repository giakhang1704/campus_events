import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastsComponent } from './shared/toast/toasts.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!ready()) {
      <div class="startup" role="status" aria-live="polite">
        <strong>BKevent</strong>
        <span>Đang kết nối…</span>
      </div>
    }
    <router-outlet (activate)="ready.set(true)" /><app-toasts />
  `,
  styles: `.startup { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #64748b; font-size: 14px; }
    .startup strong { color: #0753a6; font-size: 24px; }`,
})
export class AppComponent {
  protected readonly ready = signal(false);
}
