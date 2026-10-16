import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { INTEREST_TYPES, Lending, LENDING_STATUS, LENDING_TYPES, PAYMENT_DAY_OPTIONS } from '../../models/wealth.models';
import { LendingRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { LendingScheduleDialog, LendingScheduleDialogData } from '../calendar/lending-schedule-dialog';
import { areaChart, donutChart } from '../../utilities/chart-builders';
import { lendingMetrics, pct, sum } from '../../utilities/finance';
import { periodKey, periodLabel } from '../../utilities/format';

const FIELDS: FieldConfig[] = [
  { key: 'borrowerName', label: 'Borrower name', type: 'text', required: true, section: 'Borrower' },
  { key: 'loanName', label: 'Loan label / reference', type: 'text', hint: 'Useful when a borrower has multiple loans' },
  { key: 'mobile', label: 'Mobile number', type: 'tel', pattern: '^[+0-9 ()-]{7,20}$' },
  { key: 'address', label: 'Address', type: 'text', span: 2 },
  { key: 'principal', label: 'Principal amount', type: 'currency', required: true, min: 1, section: 'Terms' },
  { key: 'interestRate', label: 'Interest rate (annual)', type: 'percent', required: true, min: 0, max: 100 },
  { key: 'interestType', label: 'Interest method', type: 'select', options: INTEREST_TYPES, required: true, defaultValue: 'Flat',
    hint: 'Flat: simple · Reducing: EMI · Bullet: lump sum at end' },
  { key: 'loanType', label: 'Loan type', type: 'select', options: LENDING_TYPES, required: true, defaultValue: 'Personal' },
  { key: 'startDate', label: 'Start date', type: 'date', required: true },
  { key: 'endDate', label: 'End date', type: 'date', hint: 'Leave blank for an open-ended loan' },
  { key: 'paymentDay', label: 'Monthly payout date', type: 'select', options: PAYMENT_DAY_OPTIONS, defaultValue: 1, hint: 'Choose the day of each month; dates are adjusted to month end when needed' },
  { key: 'paymentAccount', label: 'Receiving bank / account', type: 'text', hint: 'Account where lending payments are received' },
  { key: 'paymentsMade', label: 'Installments paid', type: 'number', min: 0, hint: 'Optional; leave blank to calculate from loan dates' },
  { key: 'collateral', label: 'Collateral', type: 'text', span: 2 },
  { key: 'amountRecovered', label: 'Amount recovered to date', type: 'currency', defaultValue: 0, section: 'Recovery' },
  { key: 'status', label: 'Status', type: 'select', options: LENDING_STATUS, defaultValue: 'Active' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-lending-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Private Lending" subtitle="Flat, reducing-balance and bullet loans with recovery tracking"
      icon="handshake" entityLabel="Loan" [repo]="repo" [fields]="fields" [columns]="columns"
      [rowClickEnabled]="true" (rowClick)="showDetails($event)">
      <ng-container kpis>
        <app-stat-card label="Capital Deployed" [value]="kpi().principal" icon="account_balance" accent="primary" [hint]="kpi().active + ' active loans'" />
        <app-stat-card label="Interest Earned" [value]="kpi().interest" icon="payments" accent="success" [delta]="kpi().roi" deltaLabel="ROI on principal" />
        <app-stat-card label="Outstanding" [value]="kpi().outstanding" icon="hourglass_bottom" accent="warning" />
        <app-stat-card label="Recovered" [value]="kpi().recovered" icon="task_alt" accent="cyan" [hint]="kpi().recovery.toFixed(1) + '% recovery rate'" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-8" title="Lending Growth" subtitle="Cumulative capital lent and interest accrued" [options]="growthChart()" />
        <app-chart-card class="span-4" title="By Interest Method" [options]="typeChart()" />
      </div>
    </app-entity-page>
  `,
})
export class LendingPage {
  protected readonly repo = inject(LendingRepositoryService);
  private readonly dialog = inject(MatDialog);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<Lending>[] = [
    {
      key: 'borrowerName',
      label: 'Borrower',
      sub: (l) => [
        l.loanName,
        l.mobile,
        l.collateral,
        `Payment day ${l.paymentDay ?? 1}`,
        l.paymentAccount,
      ].filter(Boolean).join(' · '),
    },
    { key: 'loanType', label: 'Type' },
    { key: 'interestType', label: 'Method', type: 'chip' },
    { key: 'principal', label: 'Principal', type: 'currency' },
    { key: 'interestRate', label: 'Rate', type: 'percent' },
    { key: 'interest', label: 'Interest Earned', type: 'currency', value: (l) => lendingMetrics(l).interestEarned },
    { key: 'outstanding', label: 'Outstanding', type: 'currency', value: (l) => lendingMetrics(l).outstanding },
    { key: 'recovery', label: 'Recovery', type: 'progress', value: (l) => lendingMetrics(l).recoveryPct },
    { key: 'endDate', label: 'Due', type: 'date' },
    {
      key: 'status', label: 'Status', type: 'chip',
      chipTone: (l) => (l.status === 'Active' ? 'info' : l.status === 'Closed' ? 'success' : 'danger'),
    },
  ];

  protected showDetails(lending: Lending): void {
    this.dialog.open<LendingScheduleDialog, LendingScheduleDialogData>(LendingScheduleDialog, {
      data: { lending },
      width: 'min(1000px, 96vw)',
      maxWidth: '96vw',
      autoFocus: false,
    });
  }

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const m = items.map((l) => lendingMetrics(l));
    const principal = sum(items, (l) => l.principal);
    const interest = sum(m, (x) => x.interestEarned);
    const recovered = sum(items, (l) => l.amountRecovered || 0);
    return {
      principal, interest, recovered, outstanding: sum(m, (x) => x.outstanding), roi: pct(interest, principal),
      recovery: pct(recovered, principal + interest), active: items.filter((l) => l.status === 'Active').length,
    };
  });

  protected readonly growthChart = computed(() => {
    const items = [...this.repo.items()].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (!items.length) return areaChart([], []);
    const start = new Date(items[0].startDate);
    const now = new Date();
    const periods: Date[] = [];
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) periods.push(d);
    const lent = periods.map((p) => sum(items.filter((l) => new Date(l.startDate) <= p), (l) => l.principal));
    const interest = periods.map((p) => sum(items.filter((l) => new Date(l.startDate) <= p), (l) => lendingMetrics(l, p).interestEarned));
    return areaChart(periods.map((p) => periodLabel(periodKey(p))), [
      { name: 'Capital Lent', data: lent },
      { name: 'Interest Accrued', data: interest.map(Math.round) },
    ], { colors: ['#FFB020', '#00C48C'] });
  });

  protected readonly typeChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((l) => groups.set(l.interestType, (groups.get(l.interestType) ?? 0) + l.principal));
    return donutChart([...groups.keys()], [...groups.values()]);
  });
}
