import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Lending } from '../../models/wealth.models';
import { lendingMetrics } from '../../utilities/finance';
import { formatInr } from '../../utilities/format';
import { confirmedPaymentCount, lendingSchedule } from '../../utilities/repayment-calendar';

export interface LendingScheduleDialogData {
  lending: Lending;
}

@Component({
  selector: 'app-lending-schedule-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dialog-heading">
      <span>
        <small>Private lending record</small>
        <strong>{{ data.lending.loanName || data.lending.borrowerName }}</strong>
      </span>
      <button mat-icon-button mat-dialog-close aria-label="Close details"><mat-icon>close</mat-icon></button>
    </h2>
    <mat-dialog-content>
      <section class="details-grid">
        <article><small>Borrower</small><strong>{{ data.lending.borrowerName }}</strong></article>
        <article><small>Loan label</small><strong>{{ data.lending.loanName || '—' }}</strong></article>
        <article><small>Loan type / method</small><strong>{{ data.lending.loanType }} · {{ data.lending.interestType }}</strong></article>
        <article><small>Principal</small><strong>{{ fmt(data.lending.principal) }}</strong></article>
        <article><small>Annual interest rate</small><strong>{{ data.lending.interestRate }}%</strong></article>
        <article><small>Estimated outstanding</small><strong>{{ fmt(metrics().outstanding) }}</strong></article>
        <article><small>Interest earned to date</small><strong>{{ fmt(metrics().interestEarned) }}</strong></article>
        <article><small>Total interest over term</small><strong>{{ fmt(metrics().totalInterest) }}</strong></article>
        <article><small>Amount recovered</small><strong>{{ fmt(data.lending.amountRecovered) }}</strong></article>
        <article><small>Recovery rate</small><strong>{{ metrics().recoveryPct.toFixed(1) }}%</strong></article>
        <article><small>Start date</small><strong>{{ formatDate(data.lending.startDate) }}</strong></article>
        <article><small>End date</small><strong>{{ data.lending.endDate ? formatDate(data.lending.endDate) : 'Open-ended' }}</strong></article>
        <article><small>Payment day</small><strong>{{ data.lending.paymentDay ?? 1 }} of each month</strong></article>
        <article><small>Receiving account</small><strong>{{ data.lending.paymentAccount || '—' }}</strong></article>
        <article><small>Installments confirmed paid</small><strong>{{ confirmedCount() }}</strong></article>
        <article><small>Status</small><strong>{{ data.lending.status }}</strong></article>
        @if (data.lending.mobile) {
          <article><small>Mobile</small><strong>{{ data.lending.mobile }}</strong></article>
        }
        @if (data.lending.address) {
          <article class="wide"><small>Address</small><strong>{{ data.lending.address }}</strong></article>
        }
        @if (data.lending.collateral) {
          <article class="wide"><small>Collateral</small><strong>{{ data.lending.collateral }}</strong></article>
        }
        @if (data.lending.notes) {
          <article class="wide"><small>Notes</small><strong>{{ data.lending.notes }}</strong></article>
        }
      </section>

      <h3 class="schedule-title">Installments by year</h3>
      <div class="schedule-toolbar">
        <button mat-icon-button aria-label="Previous year" (click)="changeYear(-1)"><mat-icon>chevron_left</mat-icon></button>
        <strong>{{ selectedYear() }}</strong>
        <button mat-icon-button aria-label="Next year" (click)="changeYear(1)"><mat-icon>chevron_right</mat-icon></button>
        <span class="spacer"></span>
        <span class="annual-total">Year total <strong>{{ fmt(yearTotal()) }}</strong></span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>#</th>
              <th>Payment</th>
              <th>Principal</th>
              <th>Interest</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.installment) {
              <tr [class.row-paid]="row.status === 'Paid'">
                <td>{{ formatDate(row.date) }}</td>
                <td>{{ row.installment }}</td>
                <td>{{ fmt(row.payment) }}</td>
                <td>{{ fmt(row.principal) }}</td>
                <td>{{ fmt(row.interest) }}</td>
                <td>{{ fmt(row.balance) }}</td>
                <td>{{ row.status }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="empty">No installments scheduled for {{ selectedYear() }}.</td></tr>
            }
          </tbody>
          @if (rows().length) {
            <tfoot>
              <tr>
                <th colspan="2">Total for {{ selectedYear() }}</th>
                <th>{{ fmt(yearTotal()) }}</th>
                <th>{{ fmt(yearPrincipal()) }}</th>
                <th>{{ fmt(yearInterest()) }}</th>
                <th>{{ fmt(rows().at(-1)?.balance ?? 0) }}</th>
                <th></th>
              </tr>
            </tfoot>
          }
        </table>
      </div>
    </mat-dialog-content>
  `,
  styles: `
    .dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .dialog-heading span { display: flex; flex-direction: column; gap: 4px; }
    .dialog-heading small { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .dialog-heading strong { font-size: 20px; }
    mat-dialog-content { max-height: 75vh; }
    .details-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; overflow: hidden; margin-bottom: 22px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-border); }
    .details-grid article { display: flex; min-width: 0; flex-direction: column; gap: 5px; padding: 11px 13px; background: var(--surface); }
    .details-grid article.wide { grid-column: 1 / -1; }
    .details-grid small { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
    .details-grid strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 600; }
    .schedule-title { margin: 0 0 8px; font-size: 16px; }
    .schedule-toolbar { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 0 14px; }
    .schedule-toolbar > strong { min-width: 56px; text-align: center; font-size: 18px; }
    .spacer { flex: 1; }
    .annual-total { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; color: var(--text-muted); font-size: 11px; }
    .annual-total strong { color: var(--success); font-size: 15px; }
    .table-scroll { overflow: auto; max-height: 42vh; }
    table { width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 12px; }
    th, td { padding: 10px; border-bottom: 1px solid var(--glass-border); text-align: right; }
    th:first-child, td:first-child, th:last-child, td:last-child { text-align: left; }
    thead th { position: sticky; top: 0; z-index: 1; color: var(--text-muted); background: var(--surface); }
    tfoot th { position: sticky; bottom: 0; z-index: 1; color: var(--success); background: var(--surface-2); }
    .row-paid td:last-child { color: var(--success); }
    .empty { padding: 30px; text-align: center; color: var(--text-muted); }
    @media (max-width: 600px) {
      .details-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .schedule-toolbar { justify-content: flex-start; }
      th, td { padding: 8px; }
    }
  `,
})
export class LendingScheduleDialog {
  protected readonly data = inject<LendingScheduleDialogData>(MAT_DIALOG_DATA);
  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly fmt = formatInr;
  protected readonly metrics = computed(() => lendingMetrics(this.data.lending));

  protected readonly rows = computed(() => {
    const year = this.selectedYear();
    return lendingSchedule(this.data.lending, new Date(), new Date(year, 11, 31))
      .filter((row) => Number(row.date.slice(0, 4)) === year);
  });

  protected readonly yearTotal = computed(() => this.rows().reduce((sum, row) => sum + row.payment, 0));
  protected readonly yearPrincipal = computed(() => this.rows().reduce((sum, row) => sum + row.principal, 0));
  protected readonly yearInterest = computed(() => this.rows().reduce((sum, row) => sum + row.interest, 0));

  protected confirmedCount(): number {
    return confirmedPaymentCount(this.data.lending.paymentsMade, this.data.lending.paymentConfirmations);
  }

  protected changeYear(amount: number): void {
    this.selectedYear.update((year) => year + amount);
  }

  protected formatDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }
}
