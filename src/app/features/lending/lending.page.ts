import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Lending } from '../../models/wealth.models';
import { LendingRepositoryService } from '../../services/repositories/repositories';
import { ToastService } from '../../services/toast.service';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { LendingScheduleDialog, LendingScheduleDialogData } from '../calendar/lending-schedule-dialog';
import { LendingFormDialog, LendingFormDialogData } from './lending-form-dialog';
import { areaChart, donutChart } from '../../utilities/chart-builders';
import { lendingMetrics, pct, sum } from '../../utilities/finance';
import { periodKey, periodLabel } from '../../utilities/format';

@Component({
  selector: 'app-lending-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Private Lending" subtitle="Flat, reducing-balance and bullet loans with recovery tracking"
      icon="handshake" entityLabel="Loan" [repo]="repo" [fields]="fields" [columns]="columns" [externalForms]="true"
      [rowClickEnabled]="true" (addRequested)="addLoan()" (editRequested)="editLoan($event)" (rowClick)="showDetails($event)">
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
  private readonly toast = inject(ToastService);
  protected readonly fields: FieldConfig[] = [];
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

  protected async addLoan(): Promise<void> {
    const value = await this.openLendingForm('Add Loan');
    if (!value) return;
    await this.persistLoan(() => this.repo.create(value), 'Loan added');
  }

  protected async editLoan(lending: Lending): Promise<void> {
    const value = await this.openLendingForm('Edit Loan', lending);
    if (!value) return;
    await this.persistLoan(() => this.repo.update(lending.id, value), 'Loan updated');
  }

  private openLendingForm(title: string, lending?: Lending): Promise<Partial<Lending> | undefined> {
    return firstValueFrom(
      this.dialog.open<LendingFormDialog, LendingFormDialogData, Partial<Lending>>(LendingFormDialog, {
        data: { title, lending },
        width: '860px',
        maxWidth: '96vw',
        autoFocus: 'first-tabbable',
      }).afterClosed(),
    );
  }

  private async persistLoan(action: () => Promise<unknown>, message: string): Promise<void> {
    try {
      await action();
      this.toast.success(message);
    } catch (error) {
      console.error('Could not save private lending record', error);
      this.toast.error(error instanceof Error ? error.message : 'Could not save the loan.');
    }
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
