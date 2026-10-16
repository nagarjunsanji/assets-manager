import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Livestock } from '../../models/wealth.models';
import { LivestockRepositoryService } from '../../services/repositories/repositories';
import { livestockMetrics } from '../../utilities/finance';
import { formatInr } from '../../utilities/format';

export interface LivestockDetailsDialogData {
  livestock: Livestock;
}

@Component({
  selector: 'app-livestock-details-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dialog-heading">
      <span>
        <small>Livestock record</small>
        <strong>{{ data.livestock.tagNumber ? '#' + data.livestock.tagNumber + ' · ' : '' }}{{ data.livestock.breed }} {{ data.livestock.animalType }}</strong>
      </span>
      <button mat-icon-button mat-dialog-close aria-label="Close details"><mat-icon>close</mat-icon></button>
    </h2>
    <mat-dialog-content>
      <section class="details-grid">
        <article><small>Location</small><strong>{{ data.livestock.farmName || 'Not specified' }}</strong></article>
        <article><small>Type / breed</small><strong>{{ data.livestock.animalType }} · {{ data.livestock.breed }}</strong></article>
        <article><small>Tag number</small><strong>{{ data.livestock.tagNumber || 'Not assigned' }}</strong></article>
        <article><small>Gender</small><strong>{{ data.livestock.gender || 'Not specified' }}</strong></article>
        <article><small>Birth date</small><strong>{{ data.livestock.birthDate ? formatDate(data.livestock.birthDate) : '—' }}</strong></article>
        @if (mother()) {
          <article><small>Mother</small><strong>{{ motherLabel() }}</strong></article>
        }
        @if (data.livestock.pregnancyMonths) {
          <article><small>Pregnancy</small><strong>{{ data.livestock.pregnancyMonths }} months</strong></article>
        }
        <article><small>Current count</small><strong>{{ data.livestock.count }}</strong></article>
        <article><small>Initial count</small><strong>{{ data.livestock.initialCount }}</strong></article>
        <article><small>Purchase date</small><strong>{{ data.livestock.purchaseDate ? formatDate(data.livestock.purchaseDate) : '—' }}</strong></article>
        <article><small>Purchase value</small><strong>{{ fmt(data.livestock.purchaseValue) }}</strong></article>
        <article><small>Current value</small><strong>{{ fmt(data.livestock.currentValue) }}</strong></article>
        <article><small>Milk production</small><strong>{{ data.livestock.milkLitresPerDay }} L/day</strong></article>
        <article><small>Milk price</small><strong>{{ fmt(data.livestock.milkPricePerLitre) }} / L</strong></article>
        <article><small>Estimated monthly revenue</small><strong>{{ fmt(metrics().monthlyRevenue) }}</strong></article>
        <article><small>Feed cost / month</small><strong>{{ fmt(data.livestock.monthlyFeedCost) }}</strong></article>
        <article><small>Medicine cost / month</small><strong>{{ fmt(data.livestock.monthlyMedicineCost) }}</strong></article>
        <article><small>Estimated monthly profit</small><strong>{{ fmt(metrics().monthlyProfit) }}</strong></article>
        <article><small>Last vaccination</small><strong>{{ data.livestock.lastVaccination ? formatDate(data.livestock.lastVaccination) : '—' }}</strong></article>
        <article><small>Next vaccination</small><strong>{{ data.livestock.nextVaccination ? formatDate(data.livestock.nextVaccination) : '—' }}</strong></article>
        <article><small>Insured</small><strong>{{ data.livestock.insured ? 'Yes' : 'No' }}</strong></article>
        @if (data.livestock.otherMonthlyRevenue) {
          <article><small>Other revenue / month</small><strong>{{ fmt(data.livestock.otherMonthlyRevenue) }}</strong></article>
        }
        @if (data.livestock.notes) {
          <article class="wide"><small>Notes</small><strong>{{ data.livestock.notes }}</strong></article>
        }
      </section>

      <section class="income-section">
        <header>
          <div>
            <h3>Milk income received</h3>
            <p>{{ transactions().length }} recorded receipt{{ transactions().length === 1 ? '' : 's' }}</p>
          </div>
          <strong class="income-total">{{ fmt(totalMilkIncome()) }}</strong>
        </header>
        @if (transactions().length) {
          <div class="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Amount received</th></tr></thead>
              <tbody>
                @for (transaction of transactions(); track transaction.date + transaction.amount) {
                  <tr><td>{{ formatDate(transaction.date) }}</td><td>{{ fmt(transaction.amount) }}</td></tr>
                }
              </tbody>
              <tfoot><tr><th>Total received</th><th>{{ fmt(totalMilkIncome()) }}</th></tr></tfoot>
            </table>
          </div>
        } @else {
          <p class="empty">No milk income receipts recorded.</p>
        }
      </section>
    </mat-dialog-content>
  `,
  styles: `
    .dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .dialog-heading span { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .dialog-heading small { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .dialog-heading strong { overflow-wrap: anywhere; font-size: 20px; }
    mat-dialog-content { max-height: 78vh; }
    .details-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; overflow: hidden; margin-bottom: 22px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-border); }
    .details-grid article { display: flex; min-width: 0; flex-direction: column; gap: 5px; padding: 11px 13px; background: var(--surface); }
    .details-grid article.wide { grid-column: 1 / -1; }
    .details-grid small { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
    .details-grid strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 600; }
    .income-section { padding: 16px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass); }
    .income-section header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .income-section h3 { margin: 0; font-size: 15px; }
    .income-section p { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
    .income-total { color: var(--success); font-size: 16px; }
    .table-scroll { overflow: auto; max-height: 280px; }
    table { width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 12px; }
    th, td { padding: 9px 10px; border-bottom: 1px solid var(--glass-border); text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    thead th { color: var(--text-muted); }
    tfoot th { color: var(--success); border-bottom: 0; }
    .empty { padding: 18px 0 0; }
    @media (max-width: 650px) { .details-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class LivestockDetailsDialog {
  protected readonly data = inject<LivestockDetailsDialogData>(MAT_DIALOG_DATA);
  private readonly livestockRepo = inject(LivestockRepositoryService);
  protected readonly fmt = formatInr;
  protected readonly metrics = computed(() => livestockMetrics(this.data.livestock));
  protected readonly mother = computed(() => this.livestockRepo.getById(this.data.livestock.motherId));
  protected readonly motherLabel = computed(() => {
    const value = this.mother();
    return value ? `${value.tagNumber ? `#${value.tagNumber} · ` : ''}${value.breed} ${value.animalType}` : '';
  });
  protected readonly transactions = computed(() =>
    [...(this.data.livestock.milkIncomeTransactions ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
  );
  protected readonly totalMilkIncome = computed(() =>
    this.transactions().reduce((total, transaction) => total + transaction.amount, 0),
  );

  protected formatDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }
}
