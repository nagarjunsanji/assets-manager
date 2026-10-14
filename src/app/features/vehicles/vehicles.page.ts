import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Vehicle, VEHICLE_TYPES } from '../../models/wealth.models';
import { VehicleRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart } from '../../utilities/chart-builders';
import { appreciationPct, sum, yearsBetween } from '../../utilities/finance';

const FIELDS: FieldConfig[] = [
  { key: 'registrationNumber', label: 'Registration number', type: 'text', required: true, pattern: '^[A-Za-z0-9 -]{4,15}$' },
  { key: 'type', label: 'Vehicle type', type: 'select', options: VEHICLE_TYPES, required: true, defaultValue: 'Car' },
  { key: 'make', label: 'Make', type: 'text', required: true },
  { key: 'model', label: 'Model', type: 'text', required: true },
  { key: 'year', label: 'Manufacturing year', type: 'number', min: 1950, max: 2100 },
  { key: 'purchaseDate', label: 'Purchase date', type: 'date' },
  { key: 'purchaseCost', label: 'Purchase cost', type: 'currency', required: true },
  { key: 'currentValue', label: 'Current value', type: 'currency', required: true },
  { key: 'insuranceRenewal', label: 'Insurance renewal', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-vehicles-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Vehicles" subtitle="Cars, tractors and commercial vehicles with depreciation tracking"
      icon="directions_car" entityLabel="Vehicle" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Fleet Value" [value]="kpi().value" icon="directions_car" accent="primary" [hint]="repo.count() + ' vehicles'" />
        <app-stat-card label="Purchase Cost" [value]="kpi().cost" icon="receipt" accent="cyan" />
        <app-stat-card label="Depreciation" [value]="kpi().cost - kpi().value" icon="trending_down" accent="danger" [delta]="kpi().change" deltaLabel="Value change" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-12" title="Depreciation" subtitle="Purchase cost vs current value" [options]="chart()" />
      </div>
    </app-entity-page>
  `,
})
export class VehiclesPage {
  protected readonly repo = inject(VehicleRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<Vehicle>[] = [
    { key: 'registrationNumber', label: 'Registration', sub: (v) => `${v.make} ${v.model}` },
    { key: 'type', label: 'Type', type: 'chip' },
    { key: 'year', label: 'Year' },
    { key: 'purchaseCost', label: 'Cost', type: 'currency' },
    { key: 'currentValue', label: 'Value', type: 'currency' },
    { key: 'change', label: 'Change', type: 'pnl-pct', value: (v) => appreciationPct(v.purchaseCost, v.currentValue) },
    { key: 'annual', label: 'Depreciation / yr', type: 'percent', value: (v) => {
      const y = yearsBetween(v.purchaseDate);
      return y ? -appreciationPct(v.purchaseCost, v.currentValue) / y : 0;
    } },
    { key: 'insuranceRenewal', label: 'Insurance', type: 'date' },
  ];

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const value = sum(items, (v) => v.currentValue);
    const cost = sum(items, (v) => v.purchaseCost);
    return { value, cost, change: appreciationPct(cost, value) };
  });

  protected readonly chart = computed(() => {
    const items = this.repo.items();
    return barChart(items.map((v) => `${v.make} ${v.model}`), [
      { name: 'Purchase Cost', data: items.map((v) => v.purchaseCost) },
      { name: 'Current Value', data: items.map((v) => v.currentValue) },
    ], { colors: ['#8A94B2', '#22D3EE'] });
  });
}
