import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, OnChanges, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:mm[:ss]" (24 h) -> "HH:MM AM" (12 h, two digits, space before AM/PM). */
export function toDisplayTime(value: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(value);
  if (!m) return '';
  const h = +m[1];
  return `${pad(h % 12 || 12)}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

type Period = 'AM' | 'PM';

/**
 * Time as three selects in one row: Giờ (01–12) | Phút (:00–:55 by 5, or "Khác…" with a 00–59 box) | Buổi (AM/PM).
 * Hours, minutes and period are kept in the component; the form gets "HH:mm" (24 h) once all three are set,
 * '' otherwise, so the existing date + time join and order checks stay unchanged.
 * Seconds already on an incoming value are kept until the user changes the time.
 */
@Component({
  selector: 'app-time-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'time-field', role: 'group', '[attr.aria-label]': 'groupLabel()' },
  template: `
    <span class="select-wrap hour">
      <select [class.placeholder]="!hour()" [attr.aria-label]="label()" [attr.aria-invalid]="invalid() || null" [attr.aria-describedby]="describedBy() || null"
        (change)="setHour($any($event.target).value)">
        <option value="" disabled [selected]="!hour()">Giờ</option>
        @for (h of hours; track h) { <option [value]="h" [selected]="h === hour()">{{ h }}</option> }
      </select>
      <app-icon name="chevron" />
    </span>
    <span class="select-wrap minute">
      <select [class.placeholder]="!minuteChoice()" [attr.aria-label]="minuteLabel()" [attr.aria-invalid]="invalid() || null" [attr.aria-describedby]="describedBy() || null"
        (change)="setMinuteChoice($any($event.target).value)">
        <option value="" disabled [selected]="!minuteChoice()">Phút</option>
        @for (m of minuteOptions(); track m) { <option [value]="m" [selected]="m === minuteChoice()">:{{ m }}</option> }
        <option value="other" [selected]="minuteChoice() === 'other'">Khác…</option>
      </select>
      <app-icon name="chevron" />
    </span>
    @if (minuteChoice() === 'other') {
      <input class="minute-other" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="00"
        [attr.aria-label]="minuteLabel() + ' lẻ'" [attr.aria-invalid]="invalid() || null"
        (input)="setOddMinute($any($event.target).value)" (blur)="commitOddMinute()" (keydown.enter)="$event.preventDefault(); commitOddMinute(true)" />
    }
    <span class="select-wrap period">
      <select [class.placeholder]="!period()" [attr.aria-label]="periodLabel()" [attr.aria-invalid]="invalid() || null" [attr.aria-describedby]="describedBy() || null"
        (change)="setPeriod($any($event.target).value)">
        <option value="" disabled [selected]="!period()">Buổi</option>
        <option value="AM" [selected]="period() === 'AM'">AM</option>
        <option value="PM" [selected]="period() === 'PM'">PM</option>
      </select>
      <app-icon name="chevron" />
    </span>
  `,
})
export class TimeFieldComponent implements OnChanges {
  readonly value = input('');
  /** Accessible name of the hour select, e.g. "Mở đăng ký – giờ"; minute and period selects derive theirs. */
  readonly label = input.required<string>();
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly valueChange = output<string>();

  protected readonly hours = Array.from({ length: 12 }, (_, i) => pad(i + 1));
  protected readonly minuteSteps = Array.from({ length: 12 }, (_, i) => pad(i * 5));

  /** Internal state: "01".."12", "00".."59", "AM"/"PM"; '' = not chosen yet. */
  protected readonly hour = signal('');
  protected readonly minute = signal('');
  protected readonly period = signal<Period | ''>('');
  /** Which minute option is shown: a minute ("05", "59"…), "other" while typing an odd minute, or ''. */
  protected readonly minuteChoice = signal('');
  /** 5-minute steps plus the current odd minute, so a typed :59 stays visible in the select. */
  protected readonly minuteOptions = computed(() => {
    const m = this.minute();
    return m && !this.minuteSteps.includes(m) ? [...this.minuteSteps, m].sort() : this.minuteSteps;
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected groupLabel(): string {
    return this.label().replace(/giờ$/, 'thời gian');
  }

  protected minuteLabel(): string {
    return this.label().replace(/giờ$/, 'phút');
  }

  protected periodLabel(): string {
    return this.label().replace(/giờ$/, 'buổi');
  }

  ngOnChanges(): void {
    // Re-split only when the incoming value differs from what the selects already say.
    if (this.joined() === this.value().slice(0, 5)) return;
    const m = /^(\d{2}):(\d{2})/.exec(this.value());
    if (!m) {
      this.hour.set(''); this.minute.set(''); this.period.set(''); this.minuteChoice.set('');
      return;
    }
    const h = +m[1];
    this.hour.set(pad(h % 12 || 12));
    this.minute.set(m[2]);
    this.period.set(h < 12 ? 'AM' : 'PM');
    this.minuteChoice.set(m[2]);
  }

  protected setHour(v: string): void {
    this.hour.set(v);
    this.emit();
  }

  protected setMinuteChoice(v: string): void {
    this.minuteChoice.set(v);
    if (v === 'other') {
      // Show the small box only while typing; focus it right away.
      // The box is not bound to minute(): rewriting it while typing ("5" -> "05") broke the next keystroke.
      setTimeout(() => {
        const box = this.host.nativeElement.querySelector<HTMLInputElement>('.minute-other');
        if (!box) return;
        box.value = this.minute();
        box.focus();
        box.select();
      });
      return;
    }
    this.minute.set(v);
    this.emit();
  }

  protected setOddMinute(v: string): void {
    const n = Number(v);
    this.minute.set(v !== '' && Number.isInteger(n) && n >= 0 && n <= 59 ? pad(n) : '');
    this.emit();
  }

  /** Leaving the box (or Enter) puts the typed minute into the select as its own option and hides the box. */
  protected commitOddMinute(refocus = false): void {
    if (this.minuteChoice() !== 'other') return;
    this.minuteChoice.set(this.minute());
    if (refocus) this.host.nativeElement.querySelector<HTMLSelectElement>('.select-wrap.minute select')?.focus();
  }

  protected setPeriod(v: string): void {
    this.period.set(v as Period);
    this.emit();
  }

  /** "HH:mm" (24 h) from the three parts, or '' while any part is missing. */
  private joined(): string {
    const h = this.hour(), m = this.minute(), p = this.period();
    if (!h || !m || !p) return '';
    return `${pad((+h % 12) + (p === 'PM' ? 12 : 0))}:${m}`;
  }

  private emit(): void {
    this.valueChange.emit(this.joined());
  }
}
