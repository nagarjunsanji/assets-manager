import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Farm, FARM_TYPES } from '../../models/wealth.models';
import { FarmRepositoryService, LivestockRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart } from '../../utilities/chart-builders';
import { livestockMetrics, pct, sum } from '../../utilities/finance';

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Farm name', type: 'text', required: true },
  { key: 'farmType', label: 'Farm type', type: 'select', options: FARM_TYPES, required: true, defaultValue: 'Mixed' },
  { key: 'location', label: 'Location', type: 'text', required: true },
  { key: 'landAreaAcres', label: 'Land area (acres)', type: 'number', required: true },
  { key: 'established', label: 'Established', type: 'date' },
  { key: 'infrastructureValue', label: 'Infrastructure value (sheds, borewells)', type: 'currency', defaultValue: 0 },
  { key: 'totalRevenue', label: 'Annual revenue (excl. livestock)', type: 'currency', defaultValue: 0 },
  { key: 'totalExpense', label: 'Annual expense (excl. livestock)', type: 'currency', defaultValue: 0 },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-farms-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Farm Management" subtitle="Operating farms with combined crop and livestock profitability"
      icon="agriculture" entityLabel="Farm" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Farms" [value]="repo.count()" format="number" icon="agriculture" accent="success" [hint]="kpi().acres.toFixed(1) + ' acres'" />
        <app-stat-card label="Annual Revenue" [value]="kpi().revenue" icon="payments" accent="gold" hint="Incl. livestock" />
        <app-stat-card label="Annual Expense" [value]="kpi().expense" icon="receipt_long" accent="danger" />
        <app-stat-card label="Net Profit" [value]="kpi().profit" icon="savings" accent="primary" [delta]="kpi().margin" deltaLabel="Profit margin" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-12" title="Farm Profitability" subtitle="Annualised revenue, expense and profit incl. livestock" [options]="profitChart()" />
      </div>
    </app-entity-page>
  `,
})
export class FarmsPage {
  protected readonly repo = inject(FarmRepositoryService);
  private readonly livestock = inject(LivestockRepositoryService);
  protected readonly fields = FIELDS;

  private readonly rows = computed(() =>
    this.repo.items().map((f) => {
      const herd = this.livestock.items().filter((l) => l.farmId === f.id).map(livestockMetrics);
      const revenue = f.totalRevenue + sum(herd, (m) => m.monthlyRevenue) * 12;
      const expense = f.totalExpense + sum(herd, (m) => m.monthlyExpense) * 12;
      return { farm: f, revenue, expense, profit: revenue - expense };
    }),
  );

  protected readonly columns: ColumnConfig<Farm>[] = [
    { key: 'name', label: 'Farm', sub: (f) => f.location },
    { key: 'farmType', label: 'Type', type: 'chip' },
    { key: 'landAreaAcres', label: 'Acres', type: 'number' },
    { key: 'herd', label: 'Animals', type: 'number', value: (f) => sum(this.livestock.items().filter((l) => l.farmId === f.id), (l) => l.count) },
    { key: 'revenue', label: 'Revenue (yr)', type: 'currency', value: (f) => this.metric(f.id).revenue },
    { key: 'expense', label: 'Expense (yr)', type: 'currency', value: (f) => this.metric(f.id).expense },
    { key: 'profit', label: 'Profit', type: 'pnl', value: (f) => this.metric(f.id).profit },
    { key: 'margin', label: 'Margin', type: 'pnl-pct', value: (f) => pct(this.metric(f.id).profit, this.metric(f.id).revenue) },
    { key: 'infrastructureValue', label: 'Infra Value', type: 'currency' },
  ];

  protected readonly kpi = computed(() => {
    const r = this.rows();
    const revenue = sum(r, (x) => x.revenue);
    const expense = sum(r, (x) => x.expense);
    return { revenue, expense, profit: revenue - expense, margin: pct(revenue - expense, revenue), acres: sum(this.repo.items(), (f) => f.landAreaAcres) };
  });

  protected readonly profitChart = computed(() => {
    const r = this.rows();
    return barChart(r.map((x) => x.farm.name), [
      { name: 'Revenue', data: r.map((x) => x.revenue) },
      { name: 'Expense', data: r.map((x) => x.expense) },
      { name: 'Profit', data: r.map((x) => x.profit) },
    ], { colors: ['#00C48C', '#FF5C7A', '#F5B942'] });
  });

  private metric(id: string) {
    return this.rows().find((r) => r.farm.id === id) ?? { revenue: 0, expense: 0, profit: 0 };
  }
}
