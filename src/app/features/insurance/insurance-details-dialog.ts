import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Insurance } from '../../models/wealth.models';
import { formatInr } from '../../utilities/format';

export interface InsuranceDetailsDialogData {
  policy: Insurance;
}

@Component({
  selector: 'app-insurance-details-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dialog-heading">
      <span>
        <small>Insurance policy</small>
        <strong>{{ data.policy.policyName }}</strong>
      </span>
      <button mat-icon-button mat-dialog-close aria-label="Close details"><mat-icon>close</mat-icon></button>
    </h2>
    <mat-dialog-content>
      <section class="details-grid">
        <article><small>Provider</small><strong>{{ data.policy.provider }}</strong></article>
        <article><small>Category</small><strong>{{ data.policy.category }}</strong></article>
        <article><small>Policy number</small><strong>{{ data.policy.policyNumber }}</strong></article>
        <article><small>Coverage / sum assured</small><strong>{{ fmt(data.policy.coverage) }}</strong></article>
        <article><small>Premium</small><strong>{{ fmt(data.policy.premium) }} · {{ data.policy.premiumFrequency }}</strong></article>
        <article><small>Policy start date</small><strong>{{ date(data.policy.startDate) }}</strong></article>
        <article><small>Payment day</small><strong>{{ data.policy.premiumPaymentDay ?? dayFromDate(data.policy.startDate) ?? '—' }}{{ data.policy.premiumPaymentDay || dayFromDate(data.policy.startDate) ? ' of each applicable month' : '' }}</strong></article>
        <article><small>Debit account</small><strong>{{ data.policy.paymentAccount || '—' }}</strong></article>
        <article><small>Maturity date</small><strong>{{ date(data.policy.maturityDate) }}</strong></article>
        <article><small>Expected maturity payout</small><strong>{{ data.policy.maturityPayoutAmount == null ? 'Not provided' : fmt(data.policy.maturityPayoutAmount) }}</strong></article>
        <article><small>Nominee</small><strong>{{ data.policy.nominee || '—' }}</strong></article>
        @if (data.policy.insuredAsset) {
          <article><small>Insured asset</small><strong>{{ data.policy.insuredAsset }}</strong></article>
        }
        @if (data.policy.insuredPeople) {
          <article class="wide"><small>People covered</small><strong class="pre-line">{{ data.policy.insuredPeople }}</strong></article>
        }
        @if (data.policy.notes) {
          <article class="wide"><small>Notes</small><strong class="pre-line">{{ data.policy.notes }}</strong></article>
        }
      </section>
    </mat-dialog-content>
  `,
  styles: `
    .dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .dialog-heading span { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .dialog-heading small { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .dialog-heading strong { overflow-wrap: anywhere; font-size: 20px; }
    mat-dialog-content { max-height: 75vh; }
    .details-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-border); }
    .details-grid article { display: flex; min-width: 0; flex-direction: column; gap: 5px; padding: 11px 13px; background: var(--surface); }
    .details-grid article.wide { grid-column: 1 / -1; }
    .details-grid small { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
    .details-grid strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 600; }
    .pre-line { white-space: pre-line; }
    @media (max-width: 600px) { .details-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class InsuranceDetailsDialog {
  protected readonly data = inject<InsuranceDetailsDialogData>(MAT_DIALOG_DATA);
  protected readonly fmt = formatInr;

  protected date(value: string | undefined): string {
    if (!value) return '—';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  protected dayFromDate(value: string | undefined): number | null {
    return value ? Number(value.slice(-2)) : null;
  }
}
