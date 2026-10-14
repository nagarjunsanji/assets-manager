import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';
const THEME_KEY = 'asset-manager.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>((localStorage.getItem(THEME_KEY) as ThemeMode) || 'dark');

  constructor() {
    effect(() => {
      const mode = this.mode();
      const root = this.document.documentElement;
      root.classList.toggle('light', mode === 'light');
      root.classList.toggle('dark', mode === 'dark');
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#0B1020' : '#F4F6FB');
      localStorage.setItem(THEME_KEY, mode);
    });
  }

  toggle(): void {
    this.mode.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }
}
