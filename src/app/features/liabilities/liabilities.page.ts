import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Liability, LIABILITY_TYPES } from '../../models/wealth.models';
import { LiabilityRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { liabilityMetrics, sum } from '../../utilities/finance';

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'type', label: 'Type', type: 'select', options: LIABILITY_TYPES, required: true },
  { key: 'lender', label: 'Lender', type: 'text', required: true },
  { key: 'interestRate', label: 'Interest rate', type: 'percent', required: true },
  { key: 'principal', label: 'Principal / credit limit', type: 'currency', required: true },
  { key: 'outstanding', label: 'Outstanding balance', type: 'currency', required: true },
  { key: 'emi', label: 'EMI', type: 'currency', defaultValue: 0, hint: '0 for credit cards' },
  { key: 'tenureMonths', label: 'Tenure (months)', type: 'number', defaultValue: 0 },
  { key: 'paymentsMade', label: 'EMIs paid', type: 'number', min: 0, defaultValue: 0 },
  { key: 'startDate', label: 'Start date', type: 'date', required: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-liabilities-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Liabilities" subtitle="Home, vehicle, personal, agriculture loans and credit cards"
      icon="credit_card" entityLabel="Liability" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Outstanding Balance" [value]="kpi().outstanding" icon="credit_card" accent="danger" [hint]="repo.count() + ' accounts'" />
        <app-stat-card label="Monthly EMI" [value]="kpi().emi" icon="event_repeat" accent="warning" />
        <app-stat-card label="Interest Paid" [value]="kpi().interestPaid" icon="receipt_long" accent="gold" hint="Estimated to date" />
        <app-stat-card label="Principal Repaid" [value]="kpi().repaid" icon="task_alt" accent="success" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-4" title="Debt Mix" [options]="mixChart()" />
        <app-chart-card class="span-8" title="Repayment Progress" subtitle="Principal repaid vs outstanding" [options]="progressChart()" />
      </div>
    </app-entity-page>
  `,
})
export class LiabilitiesPage {
  protected readonly repo = inject(LiabilityRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<Liability>[] = [
    { key: 'name', label: 'Liability', sub: (l) => l.lender },
    { key: 'type', label: 'Type', type: 'chip', chipTone: (l) => (l.type === 'Credit Card' ? 'warning' : 'info') },
    { key: 'principal', label: 'Principal', type: 'currency' },
    { key: 'outstanding', label: 'Outstanding', type: 'currency' },
    { key: 'interestRate', label: 'Rate', type: 'percent' },
    { key: 'emi', label: 'EMI', type: 'currency' },
    { key: 'interestPaid', label: 'Interest Paid', type: 'currency', value: (l) => liabilityMetrics(l).interestPaid },
    { key: 'repaid', label: 'Repaid', type: 'progress', value: (l) => (l.type === 'Credit Card' ? 0 : liabilityMetrics(l).repaidPct) },
    { key: 'remaining', label: 'Months Left', type: 'number', value: (l) => liabilityMetrics(l).remainingMonths },
  ];

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const loans = items.filter((l) => l.type !== 'Credit Card');
    const m = loans.map((l) => liabilityMetrics(l));
    return {
      outstanding: sum(items, (l) => l.outstanding),
      emi: sum(loans, (l) => l.emi),
      interestPaid: sum(m, (x) => x.interestPaid),
      repaid: sum(m, (x) => x.principalRepaid),
    };
  });

  protected readonly mixChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((l) => groups.set(l.type, (groups.get(l.type) ?? 0) + l.outstanding));
    return donutChart([...groups.keys()], [...groups.values()]);
  });

  protected readonly progressChart = computed(() => {
    const items = this.repo.items().filter((l) => l.type !== 'Credit Card');
    return barChart(items.map((l) => l.name), [
      { name: 'Repaid', data: items.map((l) => Math.max(0, l.principal - l.outstanding)) },
      { name: 'Outstanding', data: items.map((l) => l.outstanding) },
    ], { colors: ['#00C48C', '#FF5C7A'], chart: { type: 'bar', stacked: true } });
  });
}
