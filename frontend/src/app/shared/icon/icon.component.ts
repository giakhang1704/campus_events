import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** SVG paths copied from public/mockup/app.js (ICONS). */
const ICONS: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M7 14h3 M14 14h3 M7 18h3',
  qr: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h2v2h-2z M19 15h2v6h-6v-2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  chart: 'M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8',
  plus: 'M12 5v14 M5 12h14',
  logout: 'M9 21H4V3h5 M16 17l5-5-5-5 M21 12H9',
  clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  check: 'M5 12l4 4L19 6',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
  edit: 'M16 3l5 5 M3 21l4-1L21 6l-5-5L2 15z',
  close: 'M6 6l12 12 M18 6L6 18',
  lock: 'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  mail: 'M3 5h18v14H3z M3 5l9 8 9-8',
  camera: 'M3 6h5l2-3h4l2 3h5v15H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  shield: 'M12 2l8 4v6c0 6-8 10-8 10S4 18 4 12V6z M8 12l3 3 5-6',
  server: 'M3 4h18v6H3z M3 14h18v6H3z M7 7h.01 M7 17h.01',
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path [attr.d]="path()" />
  </svg>`,
  styles: `:host { display: inline-flex; }`,
})
export class IconComponent {
  readonly name = input.required<string>();
  protected readonly path = computed(() => ICONS[this.name()] ?? ICONS['grid']);
}
