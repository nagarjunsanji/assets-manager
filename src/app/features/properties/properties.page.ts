import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Property, PROPERTY_TYPES } from '../../models/wealth.models';
import { PropertyRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { appreciationPct, cagr, pct, sum, yearsBetween } from '../../utilities/finance';
import { formatInr } from '../../utilities/format';

export function propertyMetrics(p: Property) {
  const purchaseCost = p.purchaseCost ?? 0;
  const years = yearsBetween(p.purchaseDate);
  const annualRent = (p.monthlyRent || 0) * 12;
  const netRent = annualRent - (p.annualExpenses || 0);
  const gain = p.currentValue - purchaseCost;
  return {
    appreciation: appreciationPct(purchaseCost, p.currentValue),
    cagr: cagr(purchaseCost, p.currentValue, years),
    rentalYield: pct(annualRent, p.currentValue),
    roi: pct(gain + netRent * years, purchaseCost),
    equity: p.currentValue - (p.loanOutstanding || 0),
  };
}

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Property name', type: 'text', required: true, section: 'Details' },
  { key: 'type', label: 'Property type', type: 'select', options: PROPERTY_TYPES, required: true, defaultValue: 'Residential' },
  { key: 'address', label: 'Address', type: 'text', required: true, span: 2 },
  { key: 'surveyNumber', label: 'Survey number', type: 'text' },
  { key: 'purchaseDate', label: 'Purchase date', type: 'date', hint: 'Leave blank if unknown.' },
  { key: 'purchaseCost', label: 'Purchase cost', type: 'currency', section: 'Valuation', hint: 'Leave blank if unknown.' },
  { key: 'currentValue', label: 'Current value', type: 'currency', required: true },
  { key: 'monthlyRent', label: 'Monthly rental income', type: 'currency', defaultValue: 0 },
  { key: 'annualExpenses', label: 'Annual expenses (tax, maintenance)', type: 'currency', defaultValue: 0 },
  { key: 'lender', label: 'Lender', type: 'text', section: 'Loan & Insurance', hint: 'Track the loan itself under Liabilities' },
  { key: 'loanOutstanding', label: 'Loan outstanding', type: 'currency', defaultValue: 0 },
  { key: 'loanEmi', label: 'Loan EMI', type: 'currency', defaultValue: 0 },
  { key: 'insurancePolicy', label: 'Insurance policy', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-properties-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Property Management" subtitle="Residential, commercial and plots with appreciation, ROI and rental yield"
      icon="apartment" entityLabel="Property" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Portfolio Value" [value]="kpi().value" icon="apartment" accent="primary" />
        <app-stat-card label="Total Appreciation" [value]="kpi().gain" icon="trending_up" accent="success" [delta]="kpi().appreciation" deltaLabel="Over purchase cost" />
        <app-stat-card label="Monthly Rent" [value]="kpi().rent" icon="payments" accent="gold" [hint]="kpi().yield.toFixed(2) + '% gross yield'" />
        <app-stat-card label="Net Equity" [value]="kpi().equity" icon="account_balance" accent="purple" [hint]="'Loans ' + kpi().loans.toFixed(0) + '% of value'" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-8" title="Property Appreciation" subtitle="Purchase cost vs current value" [options]="valueChart()" />
        <app-chart-card class="span-4" title="By Type" [options]="typeChart()" />
      </div>
    </app-entity-page>
  `,
})
export class PropertiesPage {
  protected readonly repo = inject(PropertyRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<Property>[] = [
    { key: 'name', label: 'Property', sub: (p) => p.address },
    { key: 'type', label: 'Type', type: 'chip' },
    { key: 'purchaseCost', label: 'Cost', value: (p) => p.purchaseCost == null ? 'Unknown' : formatInr(p.purchaseCost, false) },
    { key: 'currentValue', label: 'Value', type: 'currency' },
    { key: 'appreciation', label: 'Appreciation', type: 'pnl-pct', value: (p) => propertyMetrics(p).appreciation },
    { key: 'cagr', label: 'CAGR', type: 'percent', value: (p) => propertyMetrics(p).cagr },
    { key: 'monthlyRent', label: 'Rent / mo', type: 'currency' },
    { key: 'yield', label: 'Rental Yield', type: 'percent', value: (p) => propertyMetrics(p).rentalYield },
    { key: 'roi', label: 'Total ROI', type: 'pnl-pct', value: (p) => propertyMetrics(p).roi },
    { key: 'loanOutstanding', label: 'Loan', type: 'currency' },
  ];

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const value = sum(items, (p) => p.currentValue);
    const knownCostProperties = items.filter((p) => p.purchaseCost != null);
    const cost = sum(knownCostProperties, (p) => p.purchaseCost ?? 0);
    const knownCostValue = sum(knownCostProperties, (p) => p.currentValue);
    const rent = sum(items, (p) => p.monthlyRent);
    const loans = sum(items, (p) => p.loanOutstanding || 0);
    return { value, gain: knownCostValue - cost, appreciation: appreciationPct(cost, knownCostValue), rent, yield: pct(rent * 12, value), equity: value - loans, loans: pct(loans, value) };
  });

  protected readonly valueChart = computed(() => {
    const items = this.repo.items();
    return barChart(items.map((p) => p.name), [
      { name: 'Purchase Cost', data: items.map((p) => p.purchaseCost ?? 0) },
      { name: 'Current Value', data: items.map((p) => p.currentValue) },
    ], { colors: ['#8A94B2', '#4F8CFF'] });
  });

  protected readonly typeChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((p) => groups.set(p.type, (groups.get(p.type) ?? 0) + p.currentValue));
    return donutChart([...groups.keys()], [...groups.values()]);
  });

}
