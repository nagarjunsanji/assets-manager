import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AgricultureLand, WATER_SOURCES } from '../../models/wealth.models';
import { AgricultureLandRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart } from '../../utilities/chart-builders';
import { appreciationPct, cagr, pct, sum, yearsBetween } from '../../utilities/finance';

export function landMetrics(l: AgricultureLand) {
  const profit = l.annualRevenue - l.annualExpenses;
  return {
    profit,
    revenuePerAcre: l.areaAcres ? l.annualRevenue / l.areaAcres : 0,
    roi: pct(profit, l.purchaseValue),
    appreciation: appreciationPct(l.purchaseValue, l.marketValue),
    cagr: cagr(l.purchaseValue, l.marketValue, yearsBetween(l.purchaseDate)),
  };
}

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Land name', type: 'text', required: true, section: 'Location' },
  { key: 'surveyNumber', label: 'Survey number', type: 'text', required: true },
  { key: 'unitNumber', label: 'Unit number', type: 'text' },
  { key: 'village', label: 'Village', type: 'text', required: true },
  { key: 'district', label: 'District', type: 'text', required: true },
  { key: 'areaAcres', label: 'Area (acres)', type: 'number', required: true, min: 0.01 },
  { key: 'purchaseDate', label: 'Purchase date', type: 'date', required: true },
  { key: 'purchaseValue', label: 'Purchase value', type: 'currency', required: true, section: 'Valuation' },
  { key: 'marketValue', label: 'Market value', type: 'currency', required: true },
  { key: 'cropType', label: 'Crop type', type: 'text', section: 'Cultivation' },
  { key: 'waterSource', label: 'Water source', type: 'select', options: WATER_SOURCES },
  { key: 'annualRevenue', label: 'Annual revenue', type: 'currency', defaultValue: 0 },
  { key: 'annualExpenses', label: 'Annual expenses', type: 'currency', defaultValue: 0 },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-agriculture-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Agriculture Lands" subtitle="Land holdings, crop revenue, per-acre yield and appreciation"
      icon="grass" entityLabel="Land" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Land Market Value" [value]="kpi().value" icon="landscape" accent="success" [delta]="kpi().appreciation" deltaLabel="Appreciation over cost" />
        <app-stat-card label="Total Area" [value]="kpi().acres" format="number" icon="straighten" accent="cyan" hint="acres" />
        <app-stat-card label="Annual Revenue" [value]="kpi().revenue" icon="payments" accent="gold" [hint]="'Net ' + kpi().profitLabel" />
        <app-stat-card label="Revenue / Acre" [value]="kpi().perAcre" icon="eco" accent="primary" [hint]="kpi().roi.toFixed(1) + '% yield on cost'" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card title="Agriculture Revenue" subtitle="Annual revenue vs expenses" [options]="revenueChart()" />
        <app-chart-card title="Land Appreciation" subtitle="Purchase vs market value" [options]="valueChart()" />
      </div>
    </app-entity-page>
  `,
})
export class AgriculturePage {
  protected readonly repo = inject(AgricultureLandRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<AgricultureLand>[] = [
    { key: 'name', label: 'Land', sub: (l) => `${l.village}, ${l.district} · ${l.unitNumber ? `Unit ${l.unitNumber}` : `Sy. ${l.surveyNumber}`}` },
    { key: 'areaAcres', label: 'Acres', type: 'number' },
    { key: 'cropType', label: 'Crop' },
    { key: 'waterSource', label: 'Water', type: 'chip' },
    { key: 'marketValue', label: 'Market Value', type: 'currency' },
    { key: 'appreciation', label: 'Appreciation', type: 'pnl-pct', value: (l) => landMetrics(l).appreciation },
    { key: 'annualRevenue', label: 'Revenue', type: 'currency' },
    { key: 'perAcre', label: 'Rev / Acre', type: 'currency', value: (l) => landMetrics(l).revenuePerAcre },
    { key: 'roi', label: 'ROI', type: 'pnl-pct', value: (l) => landMetrics(l).roi },
  ];

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const value = sum(items, (l) => l.marketValue);
    const cost = sum(items, (l) => l.purchaseValue);
    const acres = sum(items, (l) => l.areaAcres);
    const revenue = sum(items, (l) => l.annualRevenue);
    const profit = revenue - sum(items, (l) => l.annualExpenses);
    return {
      value, acres, revenue, appreciation: appreciationPct(cost, value), perAcre: acres ? revenue / acres : 0, roi: pct(profit, cost),
      profitLabel: `₹${(profit / 1e5).toFixed(2)} L`,
    };
  });

  protected readonly revenueChart = computed(() => {
    const items = this.repo.items();
    return barChart(items.map((l) => l.name), [
      { name: 'Revenue', data: items.map((l) => l.annualRevenue) },
      { name: 'Expenses', data: items.map((l) => l.annualExpenses) },
      { name: 'Profit', data: items.map((l) => l.annualRevenue - l.annualExpenses) },
    ], { colors: ['#00C48C', '#FF5C7A', '#F5B942'] });
  });

  protected readonly valueChart = computed(() => {
    const items = this.repo.items();
    return barChart(items.map((l) => l.name), [
      { name: 'Purchase Value', data: items.map((l) => l.purchaseValue) },
      { name: 'Market Value', data: items.map((l) => l.marketValue) },
    ], { colors: ['#8A94B2', '#7BD88F'] });
  });

}
