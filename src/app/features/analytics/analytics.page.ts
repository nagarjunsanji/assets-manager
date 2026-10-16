import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PortfolioService } from '../../services/portfolio.service';
import { ChartCard } from '../../shared/components/chart-card';
import { PageHeader } from '../../shared/components/page-header';
import { areaChart, barChart, donutChart, lineChart, radialChart } from '../../utilities/chart-builders';
import { appreciationPct, lendingMetrics, livestockMetrics, pct, sum } from '../../utilities/finance';
import { periodKey, periodLabel } from '../../utilities/format';
import { ASSET_CLASS_COLORS } from '../../utilities/portfolio';

@Component({
  selector: 'app-analytics-page',
  imports: [PageHeader, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Analytics" subtitle="Deep-dive into wealth growth, allocation, income and risk" icon="monitoring" />

      <h2 class="section-title">Wealth</h2>
      <div class="chart-grid stagger">
        <app-chart-card class="span-8" title="1 · Net Worth Growth" subtitle="Monthly net worth" [options]="netWorth()" />
        <app-chart-card class="span-4" title="2 · Asset Allocation" [options]="allocation()" />
        <app-chart-card title="3 · Assets vs Liabilities" [options]="assetVsLiability()" />
        <app-chart-card title="5 · Wealth Growth Trend" subtitle="Stacked by asset class" [options]="wealthTrend()" />
      </div>

      <h2 class="section-title">Income & Cash Flow</h2>
      <div class="chart-grid stagger">
        <app-chart-card class="span-8" title="4 · Passive Income Trend" subtitle="Monthly passive income" [options]="passiveTrend()" />
        <app-chart-card class="span-4" title="15 · Income Source Breakdown" subtitle="Monthly, incl. active income" [options]="incomeSources()" />
        <app-chart-card class="span-12" title="14 · Cash Flow Trend" subtitle="Monthly surplus after expenses, EMIs and premiums" [options]="cashflow()" />
      </div>

      <h2 class="section-title">Investments & Lending</h2>
      <div class="chart-grid stagger">
        <app-chart-card title="6 · Investment Growth" subtitle="Invested vs current by instrument" [options]="investmentGrowth()" />
        <app-chart-card title="7 · Lending Growth" subtitle="Capital lent & interest accrued" [options]="lendingGrowth()" />
      </div>

      <h2 class="section-title">Real & Business Assets</h2>
      <div class="chart-grid stagger">
        <app-chart-card title="8 · Agriculture Revenue" subtitle="Annual revenue & expenses per land" [options]="agriRevenue()" />
        <app-chart-card title="9 · Livestock Profitability" subtitle="Annual profit by location" [options]="livestockProfit()" />
        <app-chart-card title="10 · Livestock Value Trend" subtitle="Herd value over time" [options]="livestockTrend()" />
        <app-chart-card title="11 · Property Appreciation" subtitle="% gain over purchase cost" [options]="propertyAppreciation()" />
      </div>

      <h2 class="section-title">Planning</h2>
      <div class="chart-grid stagger">
        <app-chart-card class="span-8" title="12 · Goal Progress" [options]="goalProgress()" [height]="340" />
        <app-chart-card class="span-4" title="13 · FIRE Progress" subtitle="Net worth vs FIRE target" [options]="fireProgress()" [height]="340" />
      </div>
    </div>
  `,
})
export class AnalyticsPage {
  private readonly p = inject(PortfolioService);
  private readonly s = this.p.summary;
  private readonly history = computed(() => this.p.sortedHistory().slice(-24));
  private readonly labels = computed(() => this.history().map((h) => periodLabel(h.period)));

  protected readonly netWorth = computed(() =>
    areaChart(this.labels(), [{ name: 'Net Worth', data: this.history().map((h) => h.netWorth) }], { colors: ['#4F8CFF'] }),
  );

  protected readonly allocation = computed(() => {
    const c = this.s().assetClasses.filter((x) => x.value > 0);
    return donutChart(c.map((x) => x.label), c.map((x) => x.value), c.map((x) => x.color));
  });

  protected readonly assetVsLiability = computed(() =>
    barChart(this.labels(), [
      { name: 'Assets', data: this.history().map((h) => h.totalAssets) },
      { name: 'Liabilities', data: this.history().map((h) => h.totalLiabilities) },
    ], { colors: ['#4F8CFF', '#FF5C7A'] }),
  );

  protected readonly wealthTrend = computed(() => {
    const classes = this.s().assetClasses;
    return areaChart(
      this.labels(),
      classes.map((c) => ({ name: c.label, data: this.history().map((h) => h.breakdown?.[c.key] ?? 0) })),
      { chart: { type: 'area', stacked: true }, colors: classes.map((c) => ASSET_CLASS_COLORS[c.key]), stroke: { width: 1.5, curve: 'smooth' }, fill: { type: 'solid', opacity: 0.55 }, legend: { show: false } },
    );
  });

  protected readonly passiveTrend = computed(() =>
    areaChart(this.labels(), [{ name: 'Passive Income', data: this.history().map((h) => h.passiveIncome) }], { colors: ['#F5B942'] }),
  );

  protected readonly incomeSources = computed(() => {
    const src = [{ label: 'Active Income', value: this.s().monthlyIncome }, ...this.s().incomeSources].filter((x) => x.value > 0);
    return donutChart(src.map((x) => x.label), src.map((x) => x.value));
  });

  protected readonly cashflow = computed(() =>
    barChart(this.labels(), [{ name: 'Cash Flow', data: this.history().map((h) => h.cashflow ?? 0) }], {
      colors: ['#22D3EE'],
      plotOptions: { bar: { borderRadius: 6, columnWidth: '50%', colors: { ranges: [{ from: -1e12, to: -0.01, color: '#FF5C7A' }] } } },
    }),
  );

  protected readonly investmentGrowth = computed(() => {
    const keys = ['equity', 'mutualFunds', 'fixedIncome', 'metals', 'crypto'];
    const c = this.s().assetClasses.filter((x) => keys.includes(x.key));
    return barChart(c.map((x) => x.label), [
      { name: 'Invested', data: c.map((x) => Math.round(x.invested)) },
      { name: 'Current', data: c.map((x) => Math.round(x.value)) },
    ], { colors: ['#8A94B2', '#9B6BFF'] });
  });

  protected readonly lendingGrowth = computed(() => {
    const loans = this.p.lending.items();
    const periods = this.p.sortedHistory().slice(-12).map((h) => h.period);
    if (!periods.length) periods.push(periodKey());
    const ends = periods.map((k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0); });
    return lineChart(periods.map(periodLabel), [
      { name: 'Capital Lent', data: ends.map((d) => sum(loans.filter((l) => new Date(l.startDate) <= d), (l) => l.principal)) },
      { name: 'Interest Accrued', data: ends.map((d) => Math.round(sum(loans.filter((l) => new Date(l.startDate) <= d), (l) => lendingMetrics(l, d).interestEarned))) },
    ], { colors: ['#FFB020', '#00C48C'] });
  });

  protected readonly agriRevenue = computed(() => {
    const lands = this.p.agricultureLands.items();
    return barChart(lands.map((l) => l.name), [
      { name: 'Revenue', data: lands.map((l) => l.annualRevenue) },
      { name: 'Expenses', data: lands.map((l) => l.annualExpenses) },
    ], { colors: ['#7BD88F', '#FF5C7A'] });
  });

  protected readonly livestockProfit = computed(() => {
    const herd = this.p.livestock.items();
    const groups = new Map<string, number>();
    herd.forEach((animal) => {
      const location = animal.farmName || 'Unassigned';
      groups.set(location, (groups.get(location) ?? 0) + livestockMetrics(animal).monthlyProfit * 12);
    });
    return barChart([...groups.keys()], [{ name: 'Annual Profit', data: [...groups.values()] }], {
      colors: ['#F5B942'], plotOptions: { bar: { borderRadius: 8, columnWidth: '35%', borderRadiusApplication: 'end' } },
    });
  });

  protected readonly livestockTrend = computed(() =>
    areaChart(this.labels(), [{ name: 'Livestock Value', data: this.history().map((h) => h.breakdown?.['livestock'] ?? 0) }], { colors: ['#E879F9'] }),
  );

  protected readonly propertyAppreciation = computed(() => {
    const props = this.p.properties.items().filter((property) => property.purchaseCost != null);
    return barChart(props.map((x) => x.name), [{ name: 'Appreciation', data: props.map((x) => Math.round(appreciationPct(x.purchaseCost ?? 0, x.currentValue) * 10) / 10) }], {
      colors: ['#22D3EE'],
      plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '50%', borderRadiusApplication: 'end' } },
      yaxis: { labels: { formatter: (v: number | string) => String(v) } },
      xaxis: { categories: props.map((x) => x.name), labels: { formatter: (v: string) => `${v}%` } },
      tooltip: { y: { formatter: (v: number) => `${v}%` } },
    });
  });

  protected readonly goalProgress = computed(() => {
    const goals = this.p.goals.items();
    return radialChart(goals.map((g) => g.name), goals.map((g) => Math.min(100, pct(g.currentAmount, g.targetAmount))));
  });

  protected readonly fireProgress = computed(() => radialChart(['FIRE'], [this.s().fire.progress]));
}
