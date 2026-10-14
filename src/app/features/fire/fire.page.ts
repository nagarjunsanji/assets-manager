import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { PortfolioService } from '../../services/portfolio.service';
import { ChartCard } from '../../shared/components/chart-card';
import { CountUp } from '../../shared/components/count-up';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { areaChart, radialChart } from '../../utilities/chart-builders';
import { formatInr } from '../../utilities/format';

@Component({
  selector: 'app-fire-page',
  imports: [PageHeader, StatCard, ChartCard, CountUp, MatIconModule, MatButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Financial Independence" subtitle="Track your path to FIRE (Financial Independence, Retire Early)" icon="local_fire_department">
        <a mat-stroked-button routerLink="/settings"><mat-icon>tune</mat-icon>Assumptions</a>
      </app-page-header>

      <div class="kpi-grid stagger">
        <app-stat-card label="Current Net Worth" [value]="s().netWorth" icon="account_balance" accent="primary" />
        <app-stat-card label="FIRE Target" [value]="f().target" icon="flag" accent="gold" [hint]="'Expenses × ' + multiple() + ' (' + profile().withdrawalRate + '% SWR)'" />
        <app-stat-card label="Progress" [value]="f().progress" format="pct" icon="percent" accent="success" />
        <app-stat-card label="Remaining Gap" [value]="f().gap" icon="hourglass_bottom" accent="warning" />
      </div>

      <div class="chart-grid stagger">
        <section class="glass-card eta span-4">
          <app-chart-card [options]="gauge()" [height]="260" class="embedded" />
          <div class="eta-body">
            <span class="muted">Estimated FIRE date</span>
            <strong class="date">{{ etaLabel() }}</strong>
            <span class="muted">{{ yearsLabel() }}</span>
            <div class="assumptions">
              <div><span>Monthly investing</span><strong><app-count-up [value]="f().monthlyInvestment" /></strong></div>
              <div><span>Expected return</span><strong>{{ profile().expectedReturn }}%</strong></div>
              <div><span>Inflation</span><strong>{{ profile().inflation }}%</strong></div>
              <div><span>Annual expenses</span><strong>{{ fmt(profile().monthlyExpenses * 12) }}</strong></div>
            </div>
          </div>
        </section>
        <app-chart-card class="span-8" title="Path to FIRE" subtitle="Projected net worth vs inflation-adjusted FIRE target" [options]="path()" [height]="420" />
      </div>
    </div>
  `,
  styles: `
    .eta { padding: 20px; display: flex; flex-direction: column; }
    .embedded ::ng-deep .chart-card { background: transparent; border: 0; box-shadow: none; backdrop-filter: none; padding: 0; }
    .eta-body { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; }
    .date { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; background: linear-gradient(90deg, var(--gold), var(--success)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .assumptions { width: 100%; margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .assumptions div { padding: 12px; border-radius: 14px; background: var(--input-bg); border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 2px; text-align: left; }
    .assumptions span { font-size: 11.5px; color: var(--text-muted); }
  `,
})
export class FirePage {
  private readonly p = inject(PortfolioService);
  protected readonly s = this.p.summary;
  protected readonly f = computed(() => this.s().fire);
  protected readonly profile = this.p.profile;
  protected readonly fmt = formatInr;
  protected readonly multiple = computed(() => Math.round(100 / (this.profile().withdrawalRate || 4)));

  protected readonly etaLabel = computed(() => {
    const d = this.f().estimatedDate;
    if (this.f().monthsToFire === 0) return 'Achieved 🎉';
    return d ? d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Beyond 60 years';
  });

  protected readonly yearsLabel = computed(() => {
    const m = this.f().monthsToFire;
    if (m === null) return 'Increase savings to reach FIRE';
    if (m === 0) return 'You are financially independent';
    return `${Math.floor(m / 12)} years ${m % 12} months away`;
  });

  protected readonly gauge = computed(() => radialChart(['FIRE Progress'], [this.f().progress], {
    plotOptions: { radialBar: { startAngle: -135, endAngle: 135, hollow: { size: '62%' }, dataLabels: { name: { offsetY: 22 }, value: { offsetY: -14, fontSize: '30px', fontWeight: 800 } } } },
  }));

  protected readonly path = computed(() => {
    const prof = this.profile();
    const start = this.s().netWorth;
    const monthly = this.f().monthlyInvestment;
    const horizon = Math.min(40, Math.max(10, Math.ceil((this.f().monthsToFire ?? 360) / 12) + 5));
    const r = prof.expectedReturn / 100 / 12;
    const i = prof.inflation / 100;
    const year = new Date().getFullYear();
    const nw: number[] = [];
    const target: number[] = [];
    let v = start;
    for (let y = 0; y <= horizon; y++) {
      if (y > 0) for (let m = 0; m < 12; m++) v = v * (1 + r) + monthly;
      nw.push(Math.round(v));
      target.push(Math.round(this.f().target * Math.pow(1 + i, y)));
    }
    return areaChart(Array.from({ length: horizon + 1 }, (_, k) => String(year + k)), [
      { name: 'Projected Net Worth', data: nw },
      { name: 'FIRE Target (inflation adjusted)', data: target },
    ], { colors: ['#00C48C', '#F5B942'], stroke: { curve: 'smooth', width: [3, 2], dashArray: [0, 6] } });
  });
}
