import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { PortfolioService } from '../../services/portfolio.service';
import { ChartCard } from '../../shared/components/chart-card';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { areaChart } from '../../utilities/chart-builders';
import { projectWealth } from '../../utilities/finance';
import { formatInr } from '../../utilities/format';

interface SliderDef {
  key: 'netWorth' | 'monthly' | 'expectedReturn' | 'inflation' | 'years' | 'spread';
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

@Component({
  selector: 'app-simulator-page',
  imports: [PageHeader, StatCard, ChartCard, MatSliderModule, MatIconModule, MatButtonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Wealth Projection Simulator" subtitle="Model best, expected and worst-case outcomes" icon="auto_graph">
        <button mat-stroked-button (click)="reset()"><mat-icon>restart_alt</mat-icon>Use my portfolio</button>
      </app-page-header>

      <div class="layout">
        <section class="glass-card inputs">
          <h3>Assumptions</h3>
          @for (s of sliders; track s.key) {
            <div class="input">
              <div class="row">
                <label [for]="s.key">{{ s.label }}</label>
                <strong>{{ s.format(values()[s.key]) }}</strong>
              </div>
              <mat-slider [min]="s.min" [max]="s.max" [step]="s.step" discrete [displayWith]="s.format">
                <input matSliderThumb [id]="s.key" [ngModel]="values()[s.key]" (ngModelChange)="set(s.key, $event)" />
              </mat-slider>
            </div>
          }
        </section>

        <div class="results">
          <div class="kpi-grid stagger">
            <app-stat-card label="Best Case" [value]="final().best" icon="rocket_launch" accent="success" [hint]="(values().expectedReturn + values().spread) + '% return'" />
            <app-stat-card label="Expected Case" [value]="final().expected" icon="trending_up" accent="primary" [hint]="values().expectedReturn + '% return'" />
            <app-stat-card label="Worst Case" [value]="final().worst" icon="trending_down" accent="warning" [hint]="(values().expectedReturn - values().spread) + '% return'" />
            <app-stat-card label="Expected (today's ₹)" [value]="final().real" icon="currency_rupee" accent="gold" [hint]="'Adjusted for ' + values().inflation + '% inflation'" />
          </div>
          <app-chart-card title="Projection" [subtitle]="values().years + '-year outlook · total contributions ' + fmt(final().contributed)" [options]="chart()" [height]="400" />
        </div>
      </div>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 20px; align-items: start; }
    .inputs { padding: 22px; position: sticky; top: 88px; }
    h3 { margin: 0 0 12px; font-size: 15px; }
    .input { margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; font-size: 13px; }
    label { color: var(--text-muted); }
    mat-slider { width: 100%; }
    .results { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .inputs { position: static; } }
  `,
})
export class SimulatorPage {
  private readonly p = inject(PortfolioService);
  protected readonly fmt = formatInr;

  protected readonly sliders: SliderDef[] = [
    { key: 'netWorth', label: 'Current net worth', min: 0, max: 500_000_000, step: 500_000, format: (v) => formatInr(v) },
    { key: 'monthly', label: 'Monthly investment', min: 0, max: 1_000_000, step: 5_000, format: (v) => formatInr(v) },
    { key: 'expectedReturn', label: 'Expected return', min: 1, max: 20, step: 0.5, format: (v) => `${v}%` },
    { key: 'spread', label: 'Best/worst spread', min: 0, max: 8, step: 0.5, format: (v) => `±${v}%` },
    { key: 'inflation', label: 'Inflation', min: 0, max: 12, step: 0.5, format: (v) => `${v}%` },
    { key: 'years', label: 'Years', min: 1, max: 40, step: 1, format: (v) => `${v} yrs` },
  ];

  protected readonly values = signal(this.defaults());
  private readonly touched = signal(false);

  constructor() {
    effect(() => {
      if (this.p.loaded() && !untracked(this.touched)) this.values.set(untracked(() => this.defaults()));
    });
  }

  protected readonly series = computed(() => {
    const v = this.values();
    const best = projectWealth(v.netWorth, v.monthly, v.expectedReturn + v.spread, v.years);
    const expected = projectWealth(v.netWorth, v.monthly, v.expectedReturn, v.years);
    const worst = projectWealth(v.netWorth, v.monthly, Math.max(0, v.expectedReturn - v.spread), v.years);
    const real = expected.map((x, y) => x / Math.pow(1 + v.inflation / 100, y));
    return { best, expected, worst, real };
  });

  protected readonly final = computed(() => {
    const s = this.series();
    const v = this.values();
    return {
      best: s.best.at(-1) ?? 0, expected: s.expected.at(-1) ?? 0, worst: s.worst.at(-1) ?? 0, real: s.real.at(-1) ?? 0,
      contributed: v.netWorth + v.monthly * 12 * v.years,
    };
  });

  protected readonly chart = computed(() => {
    const s = this.series();
    const year = new Date().getFullYear();
    const r = (a: number[]) => a.map(Math.round);
    return areaChart(s.expected.map((_, i) => String(year + i)), [
      { name: 'Best Case', data: r(s.best) },
      { name: 'Expected Case', data: r(s.expected) },
      { name: 'Worst Case', data: r(s.worst) },
      { name: 'Expected (real)', data: r(s.real) },
    ], {
      colors: ['#00C48C', '#4F8CFF', '#FFB020', '#F5B942'],
      stroke: { curve: 'smooth', width: [2, 3, 2, 2], dashArray: [0, 0, 0, 6] },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.01 } },
    });
  });

  protected set(key: SliderDef['key'], value: number): void {
    this.touched.set(true);
    this.values.update((v) => ({ ...v, [key]: Number(value) }));
  }

  protected reset(): void {
    this.touched.set(false);
    this.values.set(this.defaults());
  }

  private defaults() {
    const s = this.p.summary();
    const prof = this.p.profile();
    return {
      netWorth: Math.max(0, Math.round(s.netWorth / 500_000) * 500_000),
      monthly: Math.max(0, Math.round(s.fire.monthlyInvestment / 5_000) * 5_000),
      expectedReturn: prof.expectedReturn,
      spread: 3,
      inflation: prof.inflation,
      years: 20,
    };
  }
}
