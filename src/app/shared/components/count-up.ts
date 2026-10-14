import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { formatInr, formatNumber, formatPct } from '../../utilities/format';

export type CountFormat = 'inr' | 'inr-full' | 'pct' | 'number' | 'months';

/** Animated number counter that eases from the previous value to the new one. */
@Component({
  selector: 'app-count-up',
  template: `{{ display() }}`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountUp {
  readonly value = input.required<number>();
  readonly format = input<CountFormat>('inr');
  readonly duration = input(1100);

  private readonly current = signal(0);
  protected readonly display = computed(() => {
    const v = this.current();
    switch (this.format()) {
      case 'inr-full':
        return formatInr(v, false);
      case 'pct':
        return formatPct(v);
      case 'number':
        return formatNumber(v);
      case 'months':
        return `${v.toFixed(1)} mo`;
      default:
        return formatInr(v);
    }
  });

  constructor() {
    effect((onCleanup) => {
      const target = Number(this.value()) || 0;
      const from = untracked(this.current);
      const duration = untracked(this.duration);
      if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.current.set(target);
        return;
      }
      const start = performance.now();
      let raf = 0;
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        this.current.set(from + (target - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      onCleanup(() => cancelAnimationFrame(raf));
    });
  }
}
