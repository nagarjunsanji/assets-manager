import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MF_CATEGORIES, MutualFund } from '../../models/wealth.models';
import { MutualFundRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { mutualFundMetrics, pct, sum, xirr } from '../../utilities/finance';

const FIELDS: FieldConfig[] = [
  { key: 'fundName', label: 'Fund name', type: 'text', required: true, span: 2 },
  { key: 'amc', label: 'AMC', type: 'text', required: true },
  { key: 'folio', label: 'Folio number', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'select', options: MF_CATEGORIES, required: true },
  { key: 'purchaseDate', label: 'First investment date', type: 'date', required: true },
  { key: 'units', label: 'Units', type: 'number', required: true },
  { key: 'averageNav', label: 'Average purchase NAV', type: 'currency', required: true },
  { key: 'currentNav', label: 'Current NAV', type: 'currency', required: true },
  { key: 'sipAmount', label: 'Monthly SIP', type: 'currency' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-mutual-funds-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Mutual Funds" subtitle="Current value, CAGR and XIRR across folios"
      icon="pie_chart" entityLabel="Fund" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Current Value" [value]="kpi().current" icon="pie_chart" accent="purple" [hint]="repo.count() + ' funds'" />
        <app-stat-card label="Invested" [value]="kpi().invested" icon="savings" accent="cyan" />
        <app-stat-card label="Gains" [value]="kpi().gain" icon="trending_up" [accent]="kpi().gain >= 0 ? 'success' : 'danger'" [delta]="kpi().gainPct" deltaLabel="Absolute return" />
        <app-stat-card label="Portfolio XIRR" [value]="kpi().xirr" format="pct" icon="speed" accent="gold" [hint]="'Monthly SIP ' + kpi().sipLabel" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-8" title="Fund Performance" subtitle="Invested vs current value" [options]="perfChart()" />
        <app-chart-card class="span-4" title="Category Allocation" [options]="categoryChart()" />
      </div>
    </app-entity-page>
  `,
})
export class MutualFundsPage {
  protected readonly repo = inject(MutualFundRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<MutualFund>[] = [
    { key: 'fundName', label: 'Fund', sub: (f) => `${f.amc} · Folio ${f.folio}` },
    { key: 'category', label: 'Category', type: 'chip' },
    { key: 'units', label: 'Units', type: 'number' },
    { key: 'currentNav', label: 'NAV', type: 'currency' },
    { key: 'invested', label: 'Invested', type: 'currency', value: (f) => mutualFundMetrics(f).invested },
    { key: 'current', label: 'Current Value', type: 'currency', value: (f) => mutualFundMetrics(f).current },
    { key: 'gain', label: 'Gain', type: 'pnl', value: (f) => mutualFundMetrics(f).gain },
    { key: 'cagr', label: 'CAGR', type: 'pnl-pct', value: (f) => mutualFundMetrics(f).cagr },
    { key: 'xirr', label: 'XIRR', type: 'pnl-pct', value: (f) => mutualFundMetrics(f).xirr },
    { key: 'sipAmount', label: 'SIP', type: 'currency' },
  ];

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const m = items.map((f) => mutualFundMetrics(f));
    const invested = sum(m, (x) => x.invested);
    const current = sum(m, (x) => x.current);
    const now = new Date();
    const flows = items.flatMap((f) =>
      (f.transactions?.length ? f.transactions : [{ date: f.purchaseDate, amount: f.units * f.averageNav }]).map((t) => ({ date: new Date(t.date), amount: -Math.abs(t.amount) })),
    ).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (flows.length) flows.push({ date: now, amount: current });
    const sip = sum(items, (f) => f.sipAmount || 0);
    return { invested, current, gain: current - invested, gainPct: pct(current - invested, invested), xirr: xirr(flows), sipLabel: `₹${sip.toLocaleString('en-IN')}` };
  });

  protected readonly perfChart = computed(() => {
    const items = this.repo.items();
    const m = items.map((f) => mutualFundMetrics(f));
    return barChart(items.map((f) => f.fundName.split(' - ')[0].replace(' Fund', '')), [
      { name: 'Invested', data: m.map((x) => Math.round(x.invested)) },
      { name: 'Current', data: m.map((x) => Math.round(x.current)) },
    ], { colors: ['#8A94B2', '#9B6BFF'] });
  });

  protected readonly categoryChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((f) => groups.set(f.category, (groups.get(f.category) ?? 0) + f.units * f.currentNav));
    return donutChart([...groups.keys()], [...groups.values()]);
  });
}
