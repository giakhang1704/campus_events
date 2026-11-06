import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, OnChanges, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { padTwoDigits } from '../utils/date.utils';

/** "YYYY-MM-DD" -> "DD/MM/YYYY". */
export function toDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Accepts "DD/MM/YYYY" (also with - or .) and "YYYY-MM-DD"; returns "YYYY-MM-DD" or '' when not a real date. */
export function parseDate(text: string): string {
  const input = text.trim();
  let day: number, month: number, year: number;

  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(input); // 05/11/2026, 5-11-2026, 5.11.2026
  const isoForm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input); //          2026-11-05
  if (dayFirst) [day, month, year] = [Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3])];
  else if (isoForm) [year, month, day] = [Number(isoForm[1]), Number(isoForm[2]), Number(isoForm[3])];
  else return '';

  // Reject impossible dates such as 31/02: JavaScript would silently roll them over to March,
  // so build the date and check that it still has the same day, month and year.
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? `${year}-${padTwoDigits(month)}-${padTwoDigits(day)}` : '';
}

/** Today in Vietnam time as "YYYY-MM-DD". */
function todayVN(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

/** One cell of the month grid. */
interface Day {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** 6 weeks of 7 days. */
const CALENDAR_CELLS = 42;

/**
 * Date field that always reads DD/MM/YYYY, whatever the browser language (a native date input shows
 * MM/DD/YYYY in English browsers). Type a date, or open the month calendar (Monday first, Vietnamese
 * weekday names) from the field or its icon; it opens on the first click. Value in/out: "YYYY-MM-DD" or ''.
 */
@Component({
  selector: 'app-date-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'date-field',
    '(document:pointerdown)': 'onOutside($event)',
    '(keydown.escape)': 'close(true)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <input type="text" inputmode="text" autocomplete="off" placeholder="dd/mm/yyyy" maxlength="10"
      [attr.aria-label]="label()" [attr.aria-invalid]="invalid() || null" [attr.aria-describedby]="describedBy() || null"
      aria-haspopup="dialog" [attr.aria-expanded]="open()"
      [value]="text()" (input)="onInput($any($event.target).value)" (blur)="normalize()"
      (click)="show()" (keydown.arrowdown)="show()" />
    <button type="button" class="field-icon-btn" tabindex="-1" aria-hidden="true" (mousedown)="$event.preventDefault()" (click)="openFromIcon()"><app-icon name="calendar" /></button>
    @if (open()) {
      <div class="pick-pop date-pop" role="dialog" [attr.aria-label]="'Chọn ' + label().toLowerCase()">
        <div class="cal-head">
          <button type="button" class="cal-nav" aria-label="Tháng trước" (click)="move(-1)"><app-icon name="back" /></button>
          <strong aria-live="polite">Tháng {{ view().month + 1 }}, {{ view().year }}</strong>
          <button type="button" class="cal-nav" aria-label="Tháng sau" (click)="move(1)"><app-icon name="arrow" /></button>
        </div>
        <div class="cal-grid cal-week" aria-hidden="true">
          @for (w of weekdays; track w) { <span>{{ w }}</span> }
        </div>
        <div class="cal-grid" role="group" [attr.aria-label]="'Tháng ' + (view().month + 1) + ' năm ' + view().year">
          @for (d of days(); track d.iso) {
            <button type="button" [class.out]="!d.inMonth" [class.today]="d.iso === today" [class.on]="d.iso === value()"
              [attr.aria-pressed]="d.iso === value()" [attr.aria-label]="ariaDay(d.iso)" (click)="pick(d.iso)">{{ d.day }}</button>
          }
        </div>
        <div class="cal-foot">
          <button type="button" class="link-btn" (click)="pick(today)">Hôm nay</button>
        </div>
      </div>
    }
  `,
})
export class DateFieldComponent implements OnChanges {
  readonly value = input('');
  readonly label = input.required<string>();
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly valueChange = output<string>();

  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly today = todayVN();
  protected readonly weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  /** Month shown in the calendar (0-based month). */
  protected readonly view = signal({ year: 2026, month: 0 });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * The month grid: always 6 weeks x 7 days = 42 cells, Monday first, so the calendar never changes
   * height between months. Cells before the 1st and after the last day show the neighbouring months.
   */
  protected readonly days = computed<Day[]>(() => {
    const { year, month } = this.view();
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    // getUTCDay(): Sunday = 0 ... Saturday = 6. Shift so Monday = 0 ... Sunday = 6.
    const blanksBeforeFirst = (firstOfMonth.getUTCDay() + 6) % 7;
    return Array.from({ length: CALENDAR_CELLS }, (_, cellIndex) => {
      // Date.UTC rolls over by itself: day 0 is the last day of the previous month, day 32 is in the next one.
      const date = new Date(Date.UTC(year, month, 1 - blanksBeforeFirst + cellIndex));
      return { iso: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month };
    });
  });

  ngOnChanges(): void {
    if (parseDate(this.text()) !== this.value()) this.text.set(toDisplayDate(this.value()));
  }

  protected onInput(text: string): void {
    this.text.set(text);
    const iso = parseDate(text);
    if (iso) this.viewOf(iso);
    this.valueChange.emit(iso);
  }

  protected normalize(): void {
    const iso = parseDate(this.text());
    if (iso) this.text.set(toDisplayDate(iso));
  }

  protected pick(iso: string): void {
    this.text.set(toDisplayDate(iso));
    this.valueChange.emit(iso);
    this.close(true);
  }

  protected move(delta: number): void {
    // month is 0-11; going past December or before January changes the year.
    this.view.update(({ year, month }) => {
      const monthIndex = month + delta;
      return { year: year + Math.floor(monthIndex / 12), month: ((monthIndex % 12) + 12) % 12 };
    });
  }

  protected ariaDay(iso: string): string {
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(iso + 'T00:00:00Z'));
  }

  protected show(): void {
    if (this.open()) return;
    this.viewOf(this.value() || this.today);
    this.open.set(true);
  }

  /** The icon always opens (never toggles): the field click may already have opened it. */
  protected openFromIcon(): void {
    this.show();
    this.host.nativeElement.querySelector('input')?.focus();
  }

  close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.host.nativeElement.querySelector('input')?.focus();
  }

  protected onOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this.host.nativeElement.contains(next)) this.close();
  }

  private viewOf(iso: string): void {
    this.view.set({ year: +iso.slice(0, 4), month: +iso.slice(5, 7) - 1 });
  }
}
