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
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(text: string): number {
    return this.show('success', text, 3000);
  }

  error(text: string): number {
    return this.show('error', text, 6000);
  }

  dismiss(id: number): void {
    if (!this.toasts().some((t) => t.id === id && !t.leaving)) return;
    // Mark as leaving so the fade-out can play, then drop it.
    this.toasts.update((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t.id !== id)), 200);
  }

  private show(tone: ToastTone, text: string, ms: number): number {
    const id = this.nextId++;
    // One message of the same text at a time (double clicks, repeated submits).
    this.toasts.update((list) => [...list.filter((t) => t.text !== text), { id, tone, text, leaving: false }].slice(-3));
    setTimeout(() => this.dismiss(id), ms);
    return id;
  }
}
