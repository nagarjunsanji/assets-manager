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

const FIELDS: FieldConfig[] = [
  { key: 'symbol', label: 'Symbol', type: 'text', required: true, pattern: '^[A-Za-z0-9&._-]{1,20}$' },
  { key: 'name', label: 'Company name', type: 'text', required: true },
  { key: 'exchange', label: 'Exchange', type: 'select', options: ['NSE', 'BSE', 'NASDAQ', 'NYSE'], defaultValue: 'NSE' },
  { key: 'sector', label: 'Sector', type: 'select', options: SECTORS, required: true },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0 },
  { key: 'purchaseDate', label: 'Purchase date', type: 'date' },
  { key: 'purchasePrice', label: 'Average purchase price', type: 'currency', required: true },
  { key: 'currentPrice', label: 'Current market price', type: 'currency', required: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const invested = (s: Stock) => s.quantity * s.purchasePrice;
const current = (s: Stock) => s.quantity * s.currentPrice;

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
    { key: 'symbol', label: 'Symbol', sub: (s) => `${s.name} · ${s.exchange}` },
    { key: 'sector', label: 'Sector', type: 'chip' },
    { key: 'quantity', label: 'Qty', type: 'number' },
    { key: 'purchasePrice', label: 'Avg Price', type: 'currency' },
    { key: 'currentPrice', label: 'LTP', type: 'currency' },
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
