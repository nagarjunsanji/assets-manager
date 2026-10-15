import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AccessApprovalService } from '../../services/access-approval.service';
import { NotificationService } from '../../services/notification.service';
import { PortfolioService } from '../../services/portfolio.service';
import { ChartCard } from '../../shared/components/chart-card';
import { CountUp } from '../../shared/components/count-up';
import { StatCard } from '../../shared/components/stat-card';
import { areaChart, barChart, donutChart, radialChart } from '../../utilities/chart-builders';
import { pct } from '../../utilities/finance';
import { formatDate, formatInr, periodLabel } from '../../utilities/format';

@Component({
  selector: 'app-dashboard-page',
  imports: [StatCard, ChartCard, CountUp, MatIconModule, MatButtonModule, MatProgressBarModule, MatTooltipModule, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly p = inject(PortfolioService);
  protected readonly alerts = inject(NotificationService);
  protected readonly auth = inject(AuthService);
  protected readonly approvals = inject(AccessApprovalService);

  protected readonly s = this.p.summary;
  protected readonly fmt = formatInr;
  protected readonly fmtDate = formatDate;
  protected readonly requestedDate = (timestamp: number) =>
    new Date(timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const name = this.auth.user()?.displayName?.split(' ')[0] ?? '';
    return `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}${name ? ', ' + name : ''}`;
  });
  protected readonly today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  protected readonly netWorthChart = computed(() => {
    const h = this.p.sortedHistory().slice(-24);
    return areaChart(
      h.map((x) => periodLabel(x.period)),
      [
        { name: 'Net Worth', data: h.map((x) => x.netWorth) },
        { name: 'Total Assets', data: h.map((x) => x.totalAssets) },
      ],
      { colors: ['#4F8CFF', '#00C48C'] },
    );
  });

  protected readonly allocationChart = computed(() => {
    const classes = this.s().assetClasses.filter((c) => c.value > 0);
    return donutChart(classes.map((c) => c.label), classes.map((c) => c.value), classes.map((c) => c.color));
  });

  protected readonly incomeChart = computed(() => {
    const src = this.s().incomeSources.filter((x) => x.value > 0);
    return donutChart(src.map((x) => x.label), src.map((x) => x.value));
  });

  protected readonly assetLiabilityChart = computed(() => {
    const h = this.p.sortedHistory().slice(-12);
    return barChart(
      h.map((x) => periodLabel(x.period)),
      [
        { name: 'Assets', data: h.map((x) => x.totalAssets) },
        { name: 'Liabilities', data: h.map((x) => x.totalLiabilities) },
      ],
      { colors: ['#4F8CFF', '#FF5C7A'] },
    );
  });

  protected readonly healthChart = computed(() =>
    radialChart(['Health'], [this.s().healthScore], {
      plotOptions: {
        radialBar: {
          startAngle: -120,
          endAngle: 120,
          hollow: { size: '64%' },
          track: { background: 'rgba(138,148,178,0.15)' },
          dataLabels: {
            name: { offsetY: 24, fontSize: '13px' },
            value: { offsetY: -12, fontSize: '34px', fontWeight: 800, formatter: (v: number) => `${Math.round(v)}` },
          },
        },
      },
    }),
  );

  protected readonly goals = computed(() =>
    this.p.goals.items().map((g) => ({ ...g, progress: Math.min(100, pct(g.currentAmount, g.targetAmount)) }))
      .sort((a, b) => b.progress - a.progress).slice(0, 5),
  );

  protected readonly topHoldings = computed(() => {
    const d = this.p.data();
    return [
      ...d.properties.map((x) => ({ name: x.name, kind: 'Property', icon: 'apartment', value: x.currentValue, change: pct(x.currentValue - x.purchaseCost, x.purchaseCost) })),
      ...d.agricultureLands.map((x) => ({ name: x.name, kind: 'Agri Land', icon: 'grass', value: x.marketValue, change: pct(x.marketValue - x.purchaseValue, x.purchaseValue) })),
      ...d.stocks.map((x) => ({ name: x.symbol, kind: 'Stock', icon: 'candlestick_chart', value: x.quantity * x.currentPrice, change: pct(x.currentPrice - x.purchasePrice, x.purchasePrice) })),
      ...d.mutualFunds.map((x) => ({ name: x.fundName.split(' - ')[0], kind: 'Mutual Fund', icon: 'pie_chart', value: x.units * x.currentNav, change: pct(x.currentNav - x.averageNav, x.averageNav) })),
      ...d.assets.map((x) => ({ name: x.name, kind: x.category, icon: 'account_balance_wallet', value: x.currentValue, change: pct(x.currentValue - x.investedValue, x.investedValue) })),
    ].sort((a, b) => b.value - a.value).slice(0, 6);
  });

  protected async approveAccess(requestId: string): Promise<void> {
    const request = this.approvals.pendingRequests().find((item) => item.id === requestId);
    if (!request) return;
    try {
      await this.approvals.approve(request);
    } catch {
      // The service reports the failure to the user.
    }
  }

}
