import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { COMPOUNDING, FixedDeposit } from '../../models/wealth.models';
import { FixedDepositRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { fdMetrics, sum } from '../../utilities/finance';

const FIELDS: FieldConfig[] = [
  { key: 'bank', label: 'Bank / Institution', type: 'text', required: true },
  { key: 'accountNumber', label: 'FD / Account number', type: 'text' },
  { key: 'principal', label: 'Principal', type: 'currency', required: true, min: 1 },
  { key: 'interestRate', label: 'Interest rate', type: 'percent', required: true, min: 0, max: 30 },
  { key: 'startDate', label: 'Start date', type: 'date', required: true },
  { key: 'maturityDate', label: 'Maturity date', type: 'date', required: true },
  { key: 'compounding', label: 'Compounding', type: 'select', options: COMPOUNDING, defaultValue: 'Quarterly' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-fixed-deposits-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Fixed Deposits" subtitle="Accrued value, maturity amounts and upcoming maturities"
      icon="savings" entityLabel="Fixed Deposit" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Principal" [value]="kpi().principal" icon="savings" accent="primary" [hint]="repo.count() + ' deposits'" />
        <app-stat-card label="Current Value" [value]="kpi().current" icon="account_balance" accent="success" />
        <app-stat-card label="Maturity Value" [value]="kpi().maturity" icon="event_available" accent="gold" />
        <app-stat-card label="Weighted Rate" [value]="kpi().rate" format="pct" icon="percent" accent="cyan" [hint]="kpi().soon + ' maturing in 30 days'" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-8" title="Maturity Ladder" subtitle="Principal vs maturity value" [options]="ladderChart()" />
        <app-chart-card class="span-4" title="By Institution" [options]="bankChart()" />
      </div>
    </app-entity-page>
  `,
})
export class FixedDepositsPage {
  protected readonly repo = inject(FixedDepositRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<FixedDeposit>[] = [
    { key: 'bank', label: 'Bank', sub: (f) => f.accountNumber },
    { key: 'principal', label: 'Principal', type: 'currency' },
    { key: 'interestRate', label: 'Rate', type: 'percent' },
    { key: 'compounding', label: 'Compounding', type: 'chip' },
    { key: 'current', label: 'Current Value', type: 'currency', value: (f) => fdMetrics(f).currentValue },
    { key: 'maturity', label: 'Maturity Value', type: 'currency', value: (f) => fdMetrics(f).maturityValue },
    { key: 'maturityDate', label: 'Maturity', type: 'date' },
    { key: 'progress', label: 'Tenure Elapsed', type: 'progress', value: (f) => fdMetrics(f).progress },
    {
      key: 'days', label: 'Status', type: 'chip',
      value: (f) => { const d = fdMetrics(f).daysToMaturity ?? 0; return d < 0 ? 'Matured' : `${d} days`; },
      chipTone: (f) => { const d = fdMetrics(f).daysToMaturity ?? 0; return d < 0 ? 'success' : d <= 30 ? 'warning' : 'info'; },
    },
  ];

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const m = items.map((f) => fdMetrics(f));
    const principal = sum(items, (f) => f.principal);
    return {
      principal,
      current: sum(m, (x) => x.currentValue),
      maturity: sum(m, (x) => x.maturityValue),
      rate: principal ? sum(items, (f) => f.principal * f.interestRate) / principal : 0,
      soon: m.filter((x) => x.daysToMaturity !== null && x.daysToMaturity >= 0 && x.daysToMaturity <= 30).length,
    };
  });

  protected readonly ladderChart = computed(() => {
    const items = [...this.repo.items()].sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));
    return barChart(items.map((f) => `${f.bank.split(' ')[0]} · ${f.maturityDate.slice(0, 7)}`), [
      { name: 'Principal', data: items.map((f) => f.principal) },
      { name: 'Maturity Value', data: items.map((f) => Math.round(fdMetrics(f).maturityValue)) },
    ], { colors: ['#4F8CFF', '#00C48C'] });
  });

  protected readonly bankChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((f) => groups.set(f.bank, (groups.get(f.bank) ?? 0) + f.principal));
    return donutChart([...groups.keys()], [...groups.values()]);
  });
}
