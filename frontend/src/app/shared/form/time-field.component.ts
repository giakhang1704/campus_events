import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, OnChanges, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { padTwoDigits } from '../utils/date.utils';

/** "HH:mm[:ss]" (24 h) -> "HH:MM AM" (12 h, two digits, space before AM/PM). */
export function toDisplayTime(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return '';
  const hour24 = Number(match[1]);
  const minute = match[2];
  return `${padTwoDigits(to12Hour(hour24))}:${minute} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

/** 0 -> 12, 13 -> 1, 12 -> 12: midnight and noon are both shown as 12 on a 12-hour clock. */
function to12Hour(hour24: number): number {
  return hour24 % 12 || 12;
}

/** 12 AM -> 0, 1 PM -> 13, 12 PM -> 12. */
function to24Hour(hour12: number, period: Period): number {
  return (hour12 % 12) + (period === 'PM' ? 12 : 0);
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

  protected readonly hours = Array.from({ length: 12 }, (_, index) => padTwoDigits(index + 1)); // 01 ... 12
  protected readonly minuteSteps = Array.from({ length: 12 }, (_, index) => padTwoDigits(index * 5)); // 00, 05 ... 55

  /** Internal state: "01".."12", "00".."59", "AM"/"PM"; '' = not chosen yet. */
  protected readonly hour = signal('');
  protected readonly minute = signal('');
  protected readonly period = signal<Period | ''>('');
  /** Which minute option is shown: a minute ("05", "59"…), "other" while typing an odd minute, or ''. */
  protected readonly minuteChoice = signal('');
  /** 5-minute steps plus the current odd minute, so a typed :59 stays visible in the select. */
  protected readonly minuteOptions = computed(() => {
    const minute = this.minute();
    return minute && !this.minuteSteps.includes(minute) ? [...this.minuteSteps, minute].sort() : this.minuteSteps;
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
    const match = /^(\d{2}):(\d{2})/.exec(this.value());
    if (!match) {
      this.hour.set('');
      this.minute.set('');
      this.period.set('');
      this.minuteChoice.set('');
      return;
    }
    const hour24 = Number(match[1]);
    const minute = match[2];
    this.hour.set(padTwoDigits(to12Hour(hour24)));
    this.minute.set(minute);
    this.period.set(hour24 < 12 ? 'AM' : 'PM');
    this.minuteChoice.set(minute);
  }

  protected setHour(hour: string): void {
    this.hour.set(hour);
    this.emit();
  }

  protected setMinuteChoice(choice: string): void {
    this.minuteChoice.set(choice);
    if (choice === 'other') {
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
    this.minute.set(choice);
    this.emit();
  }

  protected setOddMinute(typed: string): void {
    const minute = Number(typed);
    const isValidMinute = typed !== '' && Number.isInteger(minute) && minute >= 0 && minute <= 59;
    this.minute.set(isValidMinute ? padTwoDigits(minute) : '');
    this.emit();
  }

  /** Leaving the box (or Enter) puts the typed minute into the select as its own option and hides the box. */
  protected commitOddMinute(refocus = false): void {
    if (this.minuteChoice() !== 'other') return;
    this.minuteChoice.set(this.minute());
    if (refocus) this.host.nativeElement.querySelector<HTMLSelectElement>('.select-wrap.minute select')?.focus();
  }

  protected setPeriod(period: string): void {
    this.period.set(period as Period);
    this.emit();
  }

  /** "HH:mm" (24 h) from the three parts, or '' while any part is missing. */
  private joined(): string {
    const hour = this.hour();
    const minute = this.minute();
    const period = this.period();
    if (!hour || !minute || !period) return '';
    return `${padTwoDigits(to24Hour(Number(hour), period))}:${minute}`;
  }

  private emit(): void {
    this.valueChange.emit(this.joined());
  }
}
