import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CountFormat, CountUp } from './count-up';

export type Accent = 'primary' | 'success' | 'gold' | 'warning' | 'danger' | 'purple' | 'cyan';

@Component({
  selector: 'app-stat-card',
  imports: [CountUp, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="glass-card hoverable stat" [class]="'accent-' + accent()" [attr.aria-label]="label()">
      <div class="stat-top">
        <span class="icon-badge"><mat-icon>{{ icon() }}</mat-icon></span>
        @if (delta() !== null && delta() !== undefined) {
          <span class="delta" [class.up]="delta()! >= 0" [class.down]="delta()! < 0" [matTooltip]="deltaLabel()">
            <mat-icon>{{ delta()! >= 0 ? 'trending_up' : 'trending_down' }}</mat-icon>
            {{ deltaText() }}
          </span>
        }
      </div>
      <p class="label">{{ label() }}</p>
      <p class="value"><app-count-up [value]="value()" [format]="format()" /></p>
      @if (hint()) {
        <p class="hint">{{ hint() }}</p>
      }
    </article>
  `,
  styles: `
    :host { display: block; }
    .stat { padding: 20px 22px; height: 100%; position: relative; overflow: hidden; }
    .stat::after {
      content: ''; position: absolute; inset: auto -30% -60% auto; width: 180px; height: 180px; border-radius: 50%;
      background: radial-gradient(circle, var(--accent-glow), transparent 70%); pointer-events: none;
    }
    .stat-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .icon-badge {
      width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center;
      background: var(--accent-soft); color: var(--accent);
    }
    .label { margin: 0; color: var(--text-muted); font-size: 13px; font-weight: 500; letter-spacing: .02em; }
    .value { margin: 6px 0 0; font-size: clamp(22px, 2.2vw, 28px); font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .hint { margin: 6px 0 0; color: var(--text-muted); font-size: 12px; }
    .delta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 999px; }
    .delta mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .delta.up { color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); }
    .delta.down { color: var(--danger); background: color-mix(in srgb, var(--danger) 14%, transparent); }
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly icon = input('insights');
  readonly format = input<CountFormat>('inr');
  readonly accent = input<Accent>('primary');
  readonly delta = input<number | null | undefined>(null);
  readonly deltaLabel = input('vs last month');
  readonly hint = input<string>('');

  protected readonly deltaText = computed(() => `${Math.abs(this.delta() ?? 0).toFixed(1)}%`);
}
