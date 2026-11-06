import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
  leaving: boolean;
}

/**
 * App-wide toasts, rendered once by <app-toasts> in the root component so they survive navigation
 * (e.g. "đã đăng xuất" shown after the shell routes to /login).
 * Success toasts close after 3 s; errors stay 6 s and can be closed by hand.
 */
/** How long each kind of toast stays; errors stay longer so they can be read. */
const SUCCESS_MS = 3000;
const ERROR_MS = 6000;
/** Length of the fade-out in styles.css (.toast.leaving). */
const LEAVE_MS = 200;
/** Older toasts are dropped beyond this, so the stack never covers the page. */
const MAX_VISIBLE = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(text: string): number {
    return this.show('success', text, SUCCESS_MS);
  }

  error(text: string): number {
    return this.show('error', text, ERROR_MS);
  }

  dismiss(id: number): void {
    if (!this.toasts().some((toast) => toast.id === id && !toast.leaving)) return;
    // Mark as leaving so the fade-out can play, then drop it.
    this.toasts.update((list) => list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    setTimeout(() => this.toasts.update((list) => list.filter((toast) => toast.id !== id)), LEAVE_MS);
  }

  private show(tone: ToastTone, text: string, ms: number): number {
    const id = this.nextId++;
    // One message of the same text at a time (double clicks, repeated submits).
    this.toasts.update((list) =>
      [...list.filter((toast) => toast.text !== text), { id, tone, text, leaving: false }].slice(-MAX_VISIBLE),
    );
    setTimeout(() => this.dismiss(id), ms);
    return id;
  }
}
