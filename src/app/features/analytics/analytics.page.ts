import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PortfolioService } from '../../services/portfolio.service';
import { ChartCard } from '../../shared/components/chart-card';
import { PageHeader } from '../../shared/components/page-header';
import { areaChart, barChart, donutChart, lineChart, radialChart } from '../../utilities/chart-builders';
import { appreciationPct, fdMetrics, lendingMetrics, livestockMetrics, pct, sum } from '../../utilities/finance';
import { formatDate, formatInr, formatPct, periodKey } from '../../utilities/format';
import { ASSET_CLASS_COLORS } from '../../utilities/portfolio';
import { stockInvestedValueInr, stockMarketValueInr } from '../../utilities/stock-valuation';

@Component({
  selector: 'app-analytics-page',
  imports: [PageHeader, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Analytics" subtitle="Deep-dive into wealth growth, allocation, income and risk" icon="monitoring" />

      <h2 class="section-title">Wealth</h2>
      <div class="chart-grid stagger">
        <app-chart-card class="span-8" title="1 · Net Worth Growth" [subtitle]="netWorthSubtitle()" [options]="netWorth()" />
        <app-chart-card class="span-4" title="2 · Asset Allocation" [options]="allocation()" />
        <app-chart-card title="3 · Assets vs Liabilities" [options]="assetVsLiability()" />
        <app-chart-card title="5 · Wealth Growth Trend" subtitle="Stacked by asset class" [options]="wealthTrend()" />
      </div>

      <h2 class="section-title">Income & Cash Flow</h2>
      <div class="chart-grid stagger">
        <app-chart-card class="span-8" title="4 · Passive Income Trend" [subtitle]="passiveIncomeSubtitle()" [options]="passiveTrend()" />
        <app-chart-card class="span-4" title="15 · Income Source Breakdown" subtitle="Monthly, incl. active income" [options]="incomeSources()" />
        <app-chart-card class="span-12" title="14 · Cash Flow Trend" subtitle="Monthly surplus after expenses, EMIs and premiums" [options]="cashflow()" />
      </div>

      <h2 class="section-title">Investments & Lending</h2>
      <div class="chart-grid stagger">
        <app-chart-card title="6 · Investment Gain / Loss by Type" subtitle="Current value minus recorded invested amount · excludes income and expenses" [options]="investmentProfit()" />
        <app-chart-card title="16 · Investment Journey by Holding" subtitle="Invested vs current value · recorded start dates shown in labels; historical prices are not available" [options]="investmentGrowth()" [height]="investmentJourneyHeight()" />
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
  private readonly labels = computed(() => this.history().map((h) => this.snapshotLabel(h.period)));

  protected readonly netWorthSubtitle = computed(() => {
    const history = this.history();
    if (!history.length) return 'Monthly trend appears as dated snapshots are recorded';
    const first = history[0];
    const last = history.at(-1)!;
    const change = last.netWorth - first.netWorth;
    const changePct = first.netWorth ? pct(change, Math.abs(first.netWorth)) : null;
    return `${this.snapshotLabel(first.period)}–${this.snapshotLabel(last.period)} · ${change >= 0 ? 'up' : 'down'} ${formatInr(Math.abs(change))}${changePct === null ? '' : ` (${formatPct(Math.abs(changePct))})`}`;
  });

  protected readonly netWorth = computed(() => areaChart(
    this.labels(),
    [
      { name: 'Net Worth', data: this.history().map((h) => h.netWorth) },
      { name: 'Total Assets', data: this.history().map((h) => h.totalAssets) },
    ],
    {
      colors: ['#4F8CFF', '#00C48C'],
      yaxis: { labels: { formatter: (value: number) => formatInr(value) } },
      tooltip: { y: { formatter: (value: number) => formatInr(value) } },
      markers: { size: 3, hover: { size: 6 } },
      stroke: { curve: 'smooth', width: 2 },
    },
  ));

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

  protected readonly passiveIncomeSubtitle = computed(() => {
    const history = this.history();
    if (!history.length) return 'Monthly amount from dated portfolio snapshots';
    const first = history[0];
    const last = history.at(-1)!;
    const change = last.passiveIncome - first.passiveIncome;
    return `${this.snapshotLabel(first.period)}–${this.snapshotLabel(last.period)} · monthly income ${change >= 0 ? 'increased' : 'decreased'} by ${formatInr(Math.abs(change))}`;
  });

  protected readonly passiveTrend = computed(() => areaChart(
    this.labels(),
    [{ name: 'Monthly Passive Income', data: this.history().map((h) => h.passiveIncome) }],
    {
      colors: ['#F5B942'],
      yaxis: { labels: { formatter: (value: number) => formatInr(value) } },
      tooltip: { y: { formatter: (value: number) => `${formatInr(value)} / month` } },
      markers: { size: 3, hover: { size: 6 } },
      stroke: { curve: 'smooth', width: 2 },
    },
  ));

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
    const holdings = this.investmentHoldings();
    return barChart(holdings.map((holding) =>
      `${holding.name} · ${holding.startDate ? this.shortDate(holding.startDate) : 'start date not recorded'}`), [
      { name: 'Invested', data: holdings.map((holding) => Math.round(holding.invested)) },
      { name: 'Current', data: holdings.map((holding) => Math.round(holding.current)) },
    ], {
      chart: { type: 'bar' },
      colors: ['#8A94B2', '#9B6BFF'],
      plotOptions: { bar: { horizontal: true, borderRadius: 5, barHeight: '65%' } },
      xaxis: { labels: { formatter: (value: string) => formatInr(Number(value)) } },
      yaxis: { labels: { maxWidth: 190 } },
      tooltip: { y: { formatter: (value: number) => formatInr(value) } },
    });
  });

  protected readonly investmentJourneyHeight = computed(() =>
    Math.max(380, Math.min(900, 150 + this.investmentHoldings().length * 38)),
  );

  protected readonly investmentProfit = computed(() => {
    const classes = this.s().assetClasses
      .filter((assetClass) => ['equity', 'mutualFunds', 'fixedIncome', 'metals', 'crypto'].includes(assetClass.key))
      .filter((assetClass) => assetClass.value > 0 || assetClass.invested > 0);
    const gains = classes.map((assetClass) => Math.round(assetClass.value - assetClass.invested));
    return barChart(classes.map((assetClass) => assetClass.label), [
      { name: 'Gain / (Loss)', data: gains },
    ], {
      colors: ['#00C48C'],
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 6,
          barHeight: '55%',
          colors: { ranges: [{ from: -1e15, to: -1, color: '#FF5C7A' }] },
        },
      },
      xaxis: { labels: { formatter: (value: string) => formatInr(Number(value)) } },
      yaxis: { labels: { maxWidth: 150 } },
      tooltip: {
        y: {
          formatter: (value: number, options) => {
            const assetClass = classes[options?.dataPointIndex ?? -1];
            if (!assetClass) return formatInr(value);
            return `${formatInr(value)} · ${formatPct(pct(value, assetClass.invested))} return`;
          },
        },
      },
    });
  });

  private investmentHoldings() {
    const data = this.p.data();
    return [
      ...data.stocks.map((stock) => ({
        name: `${stock.symbol} · Stocks`,
        startDate: stock.purchaseDate,
        invested: stockInvestedValueInr(stock),
        current: stockMarketValueInr(stock),
      })),
      ...data.mutualFunds.map((fund) => ({
        name: `${fund.fundName} · Mutual fund`,
        startDate: fund.transactions?.length
          ? fund.transactions.map((transaction) => transaction.date).sort()[0]
          : fund.purchaseDate,
        invested: fund.units * fund.averageNav,
        current: fund.units * fund.currentNav,
      })),
      ...data.fixedDeposits.map((deposit) => ({
        name: `${deposit.bank} · Fixed deposit`,
        startDate: deposit.startDate,
        invested: deposit.principal,
        current: fdMetrics(deposit).currentValue,
      })),
      ...data.assets
        .filter((asset) => !['Cash', 'Receivable', 'Machinery', 'Farm Equipment'].includes(asset.category))
        .map((asset) => ({
          name: `${asset.name} · ${asset.category}`,
          startDate: undefined,
          invested: asset.investedValue,
          current: asset.currentValue,
        })),
    ].filter((holding) => holding.invested > 0 || holding.current > 0);
  }

  private snapshotLabel(period: string): string {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }

  private shortDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return formatDate(new Date(year, month - 1, day));
  }

  protected readonly lendingGrowth = computed(() => {
    const loans = this.p.lending.items();
    const periods = this.p.sortedHistory().slice(-12).map((h) => h.period);
    if (!periods.length) periods.push(periodKey());
    const ends = periods.map((k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0); });
    return lineChart(periods.map((period) => this.snapshotLabel(period)), [
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
