import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { ThemeService } from '../../core/theme/theme.service';
import { deepMerge } from '../../utilities/deep-merge';
import { formatInr } from '../../utilities/format';

export const CHART_COLORS = ['#4F8CFF', '#00C48C', '#F5B942', '#9B6BFF', '#22D3EE', '#FF7A45', '#E879F9', '#7BD88F', '#FFB020', '#94A3B8'];

/** Glass card wrapping an ApexCharts instance with theme-aware defaults. */
@Component({
  selector: 'app-chart-card',
  imports: [NgApexchartsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card chart-card" [class.compact]="compact()">
      @if (title()) {
        <header>
          <div>
            <h3>{{ title() }}</h3>
            @if (subtitle()) {
              <p>{{ subtitle() }}</p>
            }
          </div>
          <ng-content select="[actions]" />
        </header>
      }
      <ng-content />
      @if (hasData()) {
        @let o = merged();
        <apx-chart
          [chart]="o.chart"
          [series]="$any(o.series)"
          [labels]="$any(o.labels)"
          [colors]="o.colors"
          [xaxis]="o.xaxis"
          [yaxis]="o.yaxis"
          [stroke]="o.stroke"
          [fill]="o.fill"
          [dataLabels]="o.dataLabels"
          [plotOptions]="o.plotOptions"
          [legend]="o.legend"
          [tooltip]="o.tooltip"
          [grid]="o.grid"
          [markers]="o.markers"
          [theme]="o.theme"
          [states]="o.states"
          [annotations]="o.annotations"
          [responsive]="o.responsive"
        />
      } @else {
        <div class="empty" [style.height.px]="height()">
          <mat-icon>insights</mat-icon>
          <span>No data yet</span>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .chart-card { padding: 20px 20px 8px; height: 100%; display: flex; flex-direction: column; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    h3 { margin: 0; font-size: 15px; font-weight: 600; }
    p { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
    .empty { display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; color: var(--text-muted); font-size: 13px; }
  `,
})
export class ChartCard {
  private readonly theme = inject(ThemeService);

  readonly title = input('');
  readonly subtitle = input('');
  readonly options = input.required<ApexOptions>();
  readonly height = input(300);
  readonly compact = input(false);

  protected readonly hasData = computed(() => {
    const series = this.options().series as unknown[] | undefined;
    if (!series?.length) return false;
    return series.some((s) =>
      typeof s === 'number' ? s !== 0 : ((s as { data?: unknown[] }).data?.length ?? 0) > 0,
    );
  });

  protected readonly merged = computed<ApexOptions>(() => {
    const dark = this.theme.mode() === 'dark';
    const defaults: ApexOptions = {
      chart: {
        type: 'area',
        height: this.height(),
        background: 'transparent',
        foreColor: dark ? '#8A94B2' : '#5B6478',
        fontFamily: 'Inter, system-ui, sans-serif',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: {
          enabled: true,
          speed: 800,
          animateGradually: { enabled: true, delay: 120 },
          dynamicAnimation: { enabled: true, speed: 450 },
        },
      },
      theme: { mode: dark ? 'dark' : 'light' },
      colors: CHART_COLORS,
      grid: { borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)', strokeDashArray: 4 },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      legend: { position: 'bottom', fontSize: '12px', itemMargin: { horizontal: 8, vertical: 4 } },
      tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v: number) => formatInr(v, false) } },
      yaxis: { labels: { formatter: (v: number) => formatInr(v) } },
      states: { hover: { filter: { type: 'lighten' } } },
    };
    return deepMerge(defaults, this.options());
  });
}
