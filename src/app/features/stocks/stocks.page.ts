import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SECTORS, Stock } from '../../models/wealth.models';
import { StockRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { pct, sum } from '../../utilities/finance';
import { formatInr } from '../../utilities/format';
import {
  stockCurrentPriceInr, stockInvestedValueInr, stockMarketValueInr, stockPurchasePriceInr,
} from '../../utilities/stock-valuation';

const FIELDS: FieldConfig[] = [
  { key: 'symbol', label: 'Symbol', type: 'text', required: true, pattern: '^[A-Za-z0-9&._-]{1,20}$' },
  { key: 'name', label: 'Company name', type: 'text', required: true },
  { key: 'exchange', label: 'Exchange', type: 'select', options: ['NSE', 'BSE', 'NASDAQ', 'NYSE'], defaultValue: 'NSE' },
  { key: 'currency', label: 'Price currency', type: 'select', options: ['INR', 'USD'], required: true, defaultValue: 'INR' },
  { key: 'sector', label: 'Sector', type: 'select', options: SECTORS, required: true },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0 },
  { key: 'purchaseDate', label: 'Purchase date', type: 'date' },
  { key: 'purchasePrice', label: 'Average purchase price', type: 'currency', required: true, hint: 'If the original cost is unknown, use an estimated cost and note that it is an estimate.' },
  { key: 'currentPrice', label: 'Current market price', type: 'currency', required: true },
  { key: 'purchaseExchangeRateToInr', label: 'Purchase FX rate (INR per USD)', type: 'number', required: true, visibleWhen: (v) => v['currency'] === 'USD', hint: 'For an estimated cost basis, enter the USD/INR rate used when adding the holding.' },
  { key: 'exchangeRateToInr', label: 'Current FX rate (INR per USD)', type: 'number', required: true, visibleWhen: (v) => v['currency'] === 'USD', hint: 'Required to calculate the holding value in INR. Online refresh is best-effort.' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const invested = stockInvestedValueInr;
const current = stockMarketValueInr;
const unitPrice = (priceInr: number) => formatInr(priceInr, false);

@Component({
  selector: 'app-stocks-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Stock Portfolio" subtitle="Holdings, profit & loss and sector allocation"
      icon="candlestick_chart" entityLabel="Stock" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Current Value" [value]="kpi().current" icon="candlestick_chart" accent="primary" [hint]="repo.count() + ' holdings'" />
        <app-stat-card label="Invested" [value]="kpi().invested" icon="savings" accent="cyan" />
        <app-stat-card label="Total P&L" [value]="kpi().pnl" icon="trending_up" [accent]="kpi().pnl >= 0 ? 'success' : 'danger'" [delta]="kpi().pnlPct" deltaLabel="Absolute return" />
        <app-stat-card label="Top Sector" [value]="kpi().topSectorPct" format="pct" icon="donut_large" accent="gold" [hint]="kpi().topSector" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-8" title="Portfolio Growth" subtitle="Invested vs current value per holding" [options]="growthChart()" />
        <app-chart-card class="span-4" title="Sector Allocation" [options]="sectorChart()" />
      </div>
    </app-entity-page>
  `,
})
export class StocksPage {
  protected readonly repo = inject(StockRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<Stock>[] = [
    { key: 'symbol', label: 'Symbol', sub: (s) =>
      `${s.name} · ${s.exchange}${s.currency === 'USD' ? ` · Conversion: $1 = ${formatInr(s.exchangeRateToInr, false)}${s.fxRateDate ? ` (rate ${s.fxRateDate})` : ''} · Cost FX: $1 = ${formatInr(s.purchaseExchangeRateToInr ?? s.exchangeRateToInr, false)} · Quote ${s.quoteTimestamp ? new Date(s.quoteTimestamp).toLocaleString('en-IN') : 'not refreshed'}` : ''}` },
    { key: 'sector', label: 'Sector', type: 'chip' },
    { key: 'quantity', label: 'Qty', type: 'number' },
    { key: 'purchasePrice', label: 'Cost / Share (INR)', value: (s) => `${unitPrice(stockPurchasePriceInr(s))}${s.purchaseBasisIsEstimate ? ' (est.)' : ''}` },
    { key: 'currentPrice', label: 'Market / Share (INR)', value: (s) => unitPrice(stockCurrentPriceInr(s)) },
    { key: 'invested', label: 'Invested', type: 'currency', value: invested },
    { key: 'current', label: 'Current', type: 'currency', value: current },
    { key: 'pnl', label: 'P&L', type: 'pnl', value: (s) => current(s) - invested(s) },
    { key: 'pnlPct', label: 'Return', type: 'pnl-pct', value: (s) => pct(current(s) - invested(s), invested(s)) },
    { key: 'weight', label: 'Weight', type: 'percent', value: (s) => pct(current(s), this.kpi().current) },
  ];

  protected readonly sectors = computed(() => {
    const map = new Map<string, number>();
    this.repo.items().forEach((s) => map.set(s.sector, (map.get(s.sector) ?? 0) + current(s)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  });

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const inv = sum(items, invested);
    const cur = sum(items, current);
    const top = this.sectors()[0];
    return { invested: inv, current: cur, pnl: cur - inv, pnlPct: pct(cur - inv, inv), topSector: top?.[0] ?? '—', topSectorPct: top ? pct(top[1], cur) : 0 };
  });

  protected readonly growthChart = computed(() => {
    const items = [...this.repo.items()].sort((a, b) => current(b) - current(a));
    return barChart(items.map((s) => s.symbol), [
      { name: 'Invested', data: items.map(invested) },
      { name: 'Current', data: items.map(current) },
    ], { colors: ['#8A94B2', '#4F8CFF'] });
  });

  protected readonly sectorChart = computed(() => donutChart(this.sectors().map((s) => s[0]), this.sectors().map((s) => s[1])));
}
