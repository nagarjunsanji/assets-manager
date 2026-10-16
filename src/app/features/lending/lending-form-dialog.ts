import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Lending, LENDING_STATUS, LENDING_TYPES, PAYMENT_DAY_OPTIONS } from '../../models/wealth.models';
import { emi, impliedAnnualRate } from '../../utilities/finance';
import { formatInr } from '../../utilities/format';
import { lendingRecoverySummary } from '../../utilities/repayment-calendar';

export interface LendingFormDialogData {
  title: string;
  lending?: Lending;
}

type LendingFormValues = {
  borrowerName: string;
  loanName: string;
  mobile: string;
  address: string;
  principal: number | null;
  interestRate: number | null;
  interestType: string;
  loanType: string;
  startDate: string;
  endDate: string;
  totalEmis: number | null;
  paymentDay: number | null;
  paymentAccount: string;
  paymentsMade: number | null;
  collateral: string;
  status: string;
  notes: string;
  emiAmount: number | null;
};

@Component({
  selector: 'app-lending-form-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <span class="title-icon"><mat-icon>handshake</mat-icon></span>
      {{ data.title }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <section>
          <h3>Borrower</h3>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Borrower name</mat-label>
              <input matInput formControlName="borrowerName" required />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Loan label / reference</mat-label>
              <input matInput formControlName="loanName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Mobile number</mat-label>
              <input matInput formControlName="mobile" />
              @if (form.controls.mobile.hasError('pattern')) { <mat-error>Enter a valid mobile number</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Address</mat-label>
              <input matInput formControlName="address" />
            </mat-form-field>
          </div>
        </section>

        <section>
          <h3>Loan terms</h3>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Principal amount</mat-label>
              <span matTextPrefix>₹&nbsp;</span>
              <input matInput type="number" min="1" step="any" formControlName="principal" required />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Interest method</mat-label>
              <mat-select formControlName="interestType">
                <mat-option value="Flat">Flat · monthly interest only</mat-option>
                <mat-option value="Reducing">Reducing · fixed EMI</mat-option>
                <mat-option value="Bullet">Bullet · principal and interest at end</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Annual interest rate</mat-label>
              <input matInput type="number" min="0" max="100" step="any" formControlName="interestRate" [readonly]="emiMode() === 'custom'" required />
              <span matTextSuffix>%</span>
              @if (emiMode() === 'custom') {
                <mat-hint>Rate derived from the confirmed EMI and locked</mat-hint>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Loan type</mat-label>
              <mat-select formControlName="loanType">
                @for (type of loanTypes; track type) { <mat-option [value]="type">{{ type }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Start date</mat-label>
              <input matInput type="date" formControlName="startDate" required />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>End date{{ interestType() === 'Flat' ? ' (optional)' : '' }}</mat-label>
              <input matInput type="date" formControlName="endDate" [required]="interestType() !== 'Flat'" />
              @if (dateError()) { <mat-error>{{ dateError() }}</mat-error> }
            </mat-form-field>
            @if (interestType() !== 'Bullet') {
              <mat-form-field appearance="outline">
                <mat-label>{{ interestType() === 'Reducing' ? 'Total EMIs' : 'Total monthly payments (optional)' }}</mat-label>
                <input matInput type="number" min="1" step="1" formControlName="totalEmis" [required]="interestType() === 'Reducing'" />
                <mat-hint>
                  {{ interestType() === 'Reducing'
                    ? 'Required. Set total EMIs or end date; the other is calculated.'
                    : 'Optional. Set a term or leave the loan open-ended.' }}
                </mat-hint>
                @if (form.controls.totalEmis.hasError('required') || form.controls.totalEmis.hasError('pattern') || form.controls.totalEmis.hasError('min')) {
                  <mat-error>Enter a whole number greater than zero</mat-error>
                }
              </mat-form-field>
            }
            @if (interestType() !== 'Bullet') {
              <mat-form-field appearance="outline">
                <mat-label>Monthly payment day</mat-label>
                <mat-select formControlName="paymentDay">
                  @for (option of paymentDays; track option.value) {
                    <mat-option [value]="option.value">{{ option.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
            @if (interestType() === 'Bullet' && !form.controls.endDate.value) {
              <div class="method-note wide">
                <mat-icon>info</mat-icon>
                <span>Bullet loans need an end date because principal and accumulated interest are due together at maturity.</span>
              </div>
            }
            <mat-form-field appearance="outline">
              <mat-label>Receiving bank / account</mat-label>
              <input matInput formControlName="paymentAccount" />
            </mat-form-field>
          </div>

          @if (interestType() === 'Flat') {
            <div class="method-note">
              <mat-icon>info</mat-icon>
              <span>
                Flat method is interest-only: receive {{ fmt(monthlyInterest()) }} each month.
                @if (form.controls.endDate.value) {
                  The {{ fmt(principal()) }} principal remains unchanged and is due on the end date.
                } @else {
                  The {{ fmt(principal()) }} principal remains unchanged until you record its repayment.
                }
              </span>
            </div>
          } @else if (interestType() === 'Reducing') {
            <div class="emi-panel">
              <div>
                <small>Calculated monthly EMI</small>
                <strong>{{ calculatedEmi() === null ? 'Enter valid terms' : fmt(calculatedEmi()!) }}</strong>
                @if (emiMode() === 'custom') {
                  <span>Custom EMI confirmed · rate locked at {{ form.controls.interestRate.value }}%</span>
                }
              </div>
              @if (emiMode() === 'review') {
                <div class="emi-actions">
                  <button mat-stroked-button type="button" (click)="confirmCalculatedEmi()" [disabled]="calculatedEmi() === null">
                    <mat-icon>check</mat-icon> Confirm EMI
                  </button>
                  <button mat-button type="button" (click)="editEmi()">Edit EMI</button>
                </div>
              } @else if (emiMode() === 'editing') {
                <div class="emi-edit">
                  <mat-form-field appearance="outline">
                    <mat-label>Agreed monthly EMI</mat-label>
                    <span matTextPrefix>₹&nbsp;</span>
                    <input matInput type="number" min="1" step="any" formControlName="emiAmount" />
                  </mat-form-field>
                  @if (impliedRate() !== null) {
                    <small>Implied annual rate: {{ impliedRate()!.toFixed(2) }}%</small>
                  }
                  <button mat-flat-button type="button" (click)="confirmCustomEmi()" [disabled]="impliedRate() === null">
                    Use this EMI
                  </button>
                  @if (impliedRate() === null) {
                    <small class="form-error">EMI must be at least the principal divided by the number of months.</small>
                  }
                </div>
              } @else {
                <span class="confirmed"><mat-icon>verified</mat-icon> EMI set</span>
              }
            </div>
          } @else if (interestType() === 'Bullet') {
            <div class="method-note">
              <mat-icon>info</mat-icon>
              <span>No monthly EMI is scheduled. Principal and accumulated interest are due on the end date.</span>
            </div>
          }
        </section>

        <section>
          <h3>Recovery tracking</h3>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ paymentCountLabel() }}</mat-label>
              <input matInput type="number" min="0" [attr.max]="interestType() === 'Bullet' ? 1 : null" step="1" formControlName="paymentsMade" />
              <mat-hint>{{ paymentCountHint() }}</mat-hint>
              @if (form.controls.paymentsMade.hasError('pattern')) {
                <mat-error>Enter a whole number of payments</mat-error>
              }
            </mat-form-field>
            <div class="calculated-field">
              <small>Total confirmed {{ interestType() === 'Reducing' ? 'EMIs' : 'payments' }}</small>
              <strong>{{ confirmedPayments() }}</strong>
              <span>
                @if (separatelyConfirmedPayments()) {
                  {{ separatelyConfirmedPayments() }} individually confirmed beyond the consecutive count
                } @else {
                  Includes scheduled payments marked as confirmed
                }
              </span>
            </div>
            <div class="calculated-field">
              <small>Amount recovered to date</small>
              <strong>{{ fmt(amountRecovered()) }}</strong>
              <span>Calculated from confirmed scheduled payments</span>
            </div>
            <div class="calculated-field">
              <small>Remaining {{ interestType() === 'Reducing' ? 'EMIs' : 'monthly payments' }}</small>
              <strong>{{ remainingEmis() === null ? 'Open-ended' : remainingEmis() }}</strong>
              <span>{{ totalEmis() === null ? 'Set an end date or total payments to calculate' : 'Of ' + totalEmis() + ' scheduled payments' }}</span>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>Collateral</mat-label>
              <input matInput formControlName="collateral" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                @for (status of statuses; track status) { <mat-option [value]="status">{{ status }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="wide">
              <mat-label>Notes</mat-label>
              <textarea matInput rows="2" formControlName="notes"></textarea>
            </mat-form-field>
          </div>
          @if (interestType() === 'Reducing' && form.controls.paymentsMade.value !== null) {
            <div class="method-note recovery-summary">
              <mat-icon>calculate</mat-icon>
              <span>After {{ form.controls.paymentsMade.value }} paid {{ Number(form.controls.paymentsMade.value) === 1 ? 'EMI' : 'EMIs' }}, estimated outstanding principal is {{ fmt(outstandingAfterPayments()) }} and interest received is {{ fmt(interestAfterPayments()) }}.</span>
            </div>
          }
        </section>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="!canSave()">
          <mat-icon>check</mat-icon> Save loan
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .dialog-title { display: flex; align-items: center; gap: 12px; }
    .title-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 12px; color: var(--primary); background: color-mix(in srgb, var(--primary) 18%, transparent); }
    mat-dialog-content { max-height: 75vh; }
    section { padding: 4px 0 12px; }
    section + section { margin-top: 12px; border-top: 1px solid var(--glass-border); }
    h3 { margin: 8px 0 14px; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 14px; }
    mat-form-field { width: 100%; }
    .wide { grid-column: 1 / -1; }
    .calculated-field { display: flex; min-height: 55px; flex-direction: column; justify-content: center; gap: 3px; margin: 0 0 20px; padding: 8px 12px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--surface-2); }
    .calculated-field small, .calculated-field span { color: var(--text-muted); font-size: 10px; }
    .calculated-field strong { font-size: 14px; }
    .method-note, .emi-panel { display: flex; align-items: center; gap: 12px; margin: 4px 0 8px; padding: 12px 14px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--surface-2); }
    .method-note mat-icon { flex: 0 0 auto; color: var(--primary); }
    .emi-panel { justify-content: space-between; align-items: flex-start; gap: 18px; }
    .emi-panel > div:first-child { display: flex; flex-direction: column; gap: 4px; }
    .emi-panel small, .emi-panel span { color: var(--text-muted); font-size: 11px; }
    .emi-panel strong { font-size: 20px; }
    .emi-actions { display: flex; gap: 6px; align-items: center; }
    .emi-edit { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 420px; }
    .emi-edit mat-form-field { flex: 1 1 190px; }
    .form-error { flex-basis: 100%; color: var(--danger); }
    .confirmed { display: inline-flex; align-items: center; gap: 5px; color: var(--success) !important; font-weight: 700; }
    .confirmed mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .recovery-summary { align-items: flex-start; }
    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .wide { grid-column: auto; }
      .emi-panel { flex-direction: column; }
    }
  `,
})
export class LendingFormDialog {
  protected readonly data = inject<LendingFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<LendingFormDialog, Partial<Lending>>);
  protected readonly loanTypes = LENDING_TYPES;
  protected readonly statuses = LENDING_STATUS;
  protected readonly paymentDays = PAYMENT_DAY_OPTIONS;
  protected readonly emiMode = signal<'review' | 'editing' | 'confirmed' | 'custom'>(
    this.data.lending?.emiAmount ? 'custom' : 'review',
  );
  private readonly values = signal<LendingFormValues | null>(null);

  protected readonly form = new FormGroup({
    borrowerName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    loanName: new FormControl('', { nonNullable: true }),
    mobile: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[+0-9 ()-]{7,20}$/)] }),
    address: new FormControl('', { nonNullable: true }),
    principal: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    interestRate: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    interestType: new FormControl('Flat', { nonNullable: true, validators: [Validators.required] }),
    loanType: new FormControl('Personal', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl('', { nonNullable: true }),
    totalEmis: new FormControl<number | null>(null),
    paymentDay: new FormControl<number | null>(1),
    paymentAccount: new FormControl('', { nonNullable: true }),
    paymentsMade: new FormControl<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
    collateral: new FormControl('', { nonNullable: true }),
    status: new FormControl('Active', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true }),
    emiAmount: new FormControl<number | null>(null, [Validators.min(1)]),
  });

  protected readonly interestType = computed(() => this.values()?.interestType ?? this.form.controls.interestType.value);
  protected readonly principal = computed(() => Number(this.values()?.principal ?? this.form.controls.principal.value) || 0);
  protected readonly totalEmis = computed(() => this.values()?.totalEmis ?? this.form.controls.totalEmis.value);
  protected readonly amountRecovered = computed(() => this.recoverySummary().amountRecovered);
  protected readonly confirmedPayments = computed(() => this.recoverySummary().paidInstallments);
  protected readonly separatelyConfirmedPayments = computed(() => this.recoverySummary().separatelyConfirmedInstallments);
  protected readonly remainingEmis = computed(() => this.recoverySummary().remainingInstallments);
  private readonly recoverySummary = computed(() => {
    const values = this.values();
    const loan: Lending = {
      id: this.data.lending?.id ?? 'new-lending',
      borrowerName: values?.borrowerName ?? this.form.controls.borrowerName.value,
      loanName: values?.loanName || undefined,
      mobile: values?.mobile ?? this.form.controls.mobile.value,
      principal: Number(values?.principal ?? this.form.controls.principal.value) || 0,
      interestRate: Number(values?.interestRate ?? this.form.controls.interestRate.value) || 0,
      interestType: (values?.interestType ?? this.form.controls.interestType.value) as Lending['interestType'],
      emiAmount: Number(values?.emiAmount ?? this.form.controls.emiAmount.value) || undefined,
      loanType: values?.loanType ?? this.form.controls.loanType.value,
      startDate: values?.startDate ?? this.form.controls.startDate.value,
      endDate: values?.endDate || undefined,
      paymentDay: Number(values?.paymentDay ?? this.form.controls.paymentDay.value) || 1,
      paymentsMade: Number(values?.paymentsMade ?? this.form.controls.paymentsMade.value) || 0,
      paymentConfirmations: this.data.lending?.paymentConfirmations,
      amountRecovered: 0,
      status: (values?.status ?? this.form.controls.status.value) as Lending['status'],
    };
    return loan.startDate ? lendingRecoverySummary(loan) : {
      amountRecovered: 0, paidInstallments: 0, separatelyConfirmedInstallments: 0,
      totalInstallments: null, remainingInstallments: null,
    };
  });
  protected readonly calculatedEmi = computed(() => {
    const values = this.values();
    const principal = Number(values?.principal ?? this.form.controls.principal.value);
    const rate = Number(values?.interestRate ?? this.form.controls.interestRate.value);
    const totalEmis = Number(values?.totalEmis ?? this.form.controls.totalEmis.value);
    return principal > 0 && rate >= 0 && totalEmis > 0 ? emi(principal, rate, totalEmis) : null;
  });
  protected readonly impliedRate = computed(() => {
    const values = this.values();
    const payment = Number(values?.emiAmount ?? this.form.controls.emiAmount.value);
    const principal = Number(values?.principal ?? this.form.controls.principal.value);
    const term = Number(values?.totalEmis ?? this.form.controls.totalEmis.value);
    const rate = impliedAnnualRate(principal, payment, term);
    return rate !== null && rate <= 100 ? rate : null;
  });
  protected readonly monthlyInterest = computed(() => this.principal() * (Number(this.values()?.interestRate ?? this.form.controls.interestRate.value) || 0) / 1200);
  protected readonly outstandingAfterPayments = computed(() => this.reducingResult().balance);
  protected readonly interestAfterPayments = computed(() => this.reducingResult().interest);

  constructor() {
    const l = this.data.lending;
    if (l) {
      this.form.patchValue({
        borrowerName: l.borrowerName,
        loanName: l.loanName ?? '',
        mobile: l.mobile,
        address: l.address ?? '',
        principal: l.principal,
        interestRate: l.interestRate,
        interestType: l.interestType,
        loanType: l.loanType,
        startDate: l.startDate,
        endDate: l.endDate ?? '',
        totalEmis: l.endDate ? this.termMonths(l.startDate, l.endDate) : null,
        paymentDay: l.paymentDay ?? 1,
        paymentAccount: l.paymentAccount ?? '',
        paymentsMade: l.paymentsMade ?? 0,
        collateral: l.collateral ?? '',
        status: l.status,
        notes: l.notes ?? '',
        emiAmount: l.emiAmount ?? null,
      }, { emitEvent: false });
    }

    this.syncMethodValidators();
    this.form.controls.interestType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncMethodValidators();
      this.values.set(this.form.getRawValue());
    });
    this.form.controls.endDate.valueChanges.pipe(takeUntilDestroyed()).subscribe((endDate) => {
      if (this.form.controls.interestType.value === 'Bullet') return;
      this.form.controls.totalEmis.setValue(endDate && this.form.controls.startDate.value
        ? this.termMonths(this.form.controls.startDate.value, endDate)
        : null, { emitEvent: false });
    });
    this.form.controls.totalEmis.valueChanges.pipe(takeUntilDestroyed()).subscribe((count) => {
      const startDate = this.form.controls.startDate.value;
      if (this.form.controls.interestType.value !== 'Bullet' && count && startDate) {
        this.form.controls.endDate.setValue(
          this.endDateForInstallments(startDate, Number(count), Number(this.form.controls.paymentDay.value) || 1),
          { emitEvent: false },
        );
      }
    });
    this.form.controls.startDate.valueChanges.pipe(takeUntilDestroyed()).subscribe((startDate) => {
      const count = this.form.controls.totalEmis.value;
      if (this.form.controls.interestType.value !== 'Bullet' && startDate && count) {
        this.form.controls.endDate.setValue(
          this.endDateForInstallments(startDate, Number(count), Number(this.form.controls.paymentDay.value) || 1),
          { emitEvent: false },
        );
      } else if (startDate && this.form.controls.endDate.value) {
        this.form.controls.totalEmis.setValue(this.termMonths(startDate, this.form.controls.endDate.value), { emitEvent: false });
      }
    });
    this.form.controls.paymentDay.valueChanges.pipe(takeUntilDestroyed()).subscribe((paymentDay) => {
      const startDate = this.form.controls.startDate.value;
      const count = this.form.controls.totalEmis.value;
      if (this.form.controls.interestType.value !== 'Bullet' && startDate && count) {
        this.form.controls.endDate.setValue(
          this.endDateForInstallments(startDate, Number(count), Number(paymentDay) || 1),
          { emitEvent: false },
        );
      }
    });

    let lastTerms = this.termsKey();
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const nextTerms = this.termsKey();
      if (nextTerms !== lastTerms && this.emiMode() !== 'editing') this.emiMode.set('review');
      lastTerms = nextTerms;
      this.values.set(this.form.getRawValue());
    });
    this.values.set(this.form.getRawValue());
  }

  protected fmt(value: number): string {
    return formatInr(value);
  }

  protected Number(value: number | null): number {
    return Number(value) || 0;
  }

  protected paymentCountLabel(): string {
    return this.interestType() === 'Reducing' ? 'Consecutive EMIs paid'
      : this.interestType() === 'Flat' ? 'Consecutive monthly interest payments received' : 'Final payment received (0 or 1)';
  }

  protected paymentCountHint(): string {
    return this.interestType() === 'Reducing'
      ? 'Enter the consecutive paid count (installments 1 through this number). Individually confirmed installments are added below.'
      : this.interestType() === 'Flat'
        ? 'Enter the consecutive count of interest receipts. Individually confirmed installments are added below; these do not reduce principal.'
        : 'The bullet payment includes principal and accumulated interest at maturity.';
  }

  protected dateError(): string {
    const start = this.form.controls.startDate.value;
    const end = this.form.controls.endDate.value;
    if (this.interestType() !== 'Flat' && !end) return `${this.interestType()} loans require an end date.`;
    if (this.interestType() === 'Reducing' && !this.form.controls.totalEmis.value) return 'Enter an end date or total number of EMIs.';
    if (end && start && end <= start) return 'End date must be after the start date.';
    return '';
  }

  protected confirmCalculatedEmi(): void {
    const amount = this.calculatedEmi();
    if (amount === null) return;
    this.form.controls.emiAmount.setValue(amount, { emitEvent: false });
    this.values.set(this.form.getRawValue());
    this.emiMode.set('confirmed');
  }

  protected editEmi(): void {
    const suggested = this.calculatedEmi();
    if (suggested !== null) this.form.controls.emiAmount.setValue(suggested);
    this.emiMode.set('editing');
  }

  protected confirmCustomEmi(): void {
    const rate = this.impliedRate();
    if (rate === null) return;
    this.form.controls.interestRate.setValue(rate, { emitEvent: false });
    this.values.set(this.form.getRawValue());
    this.emiMode.set('custom');
  }

  protected canSave(): boolean {
    if (this.form.invalid || this.dateError()) return false;
    if (this.interestType() === 'Reducing') {
      return this.totalEmis() !== null
        && ((this.emiMode() === 'confirmed' && this.calculatedEmi() !== null)
          || (this.emiMode() === 'custom' && this.impliedRate() !== null));
    }
    return true;
  }

  protected save(): void {
    if (!this.canSave()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const out: Partial<Lending> = {
      borrowerName: value.borrowerName.trim(),
      loanName: value.loanName.trim() || undefined,
      mobile: value.mobile.trim(),
      address: value.address.trim() || undefined,
      principal: Number(value.principal),
      interestRate: Number(value.interestRate),
      interestType: value.interestType as Lending['interestType'],
      loanType: value.loanType,
      startDate: value.startDate,
      endDate: value.endDate || undefined,
      paymentDay: value.paymentDay ?? 1,
      paymentAccount: value.paymentAccount.trim() || undefined,
      paymentsMade: value.paymentsMade ?? undefined,
      collateral: value.collateral.trim() || undefined,
      amountRecovered: this.amountRecovered(),
      status: value.status as Lending['status'],
      notes: value.notes.trim() || undefined,
      emiAmount: value.interestType === 'Reducing'
        ? this.emiMode() === 'confirmed' ? this.calculatedEmi()! : Number(value.emiAmount)
        : undefined,
    };
    this.ref.close(out);
  }

  private reducingResult(): { balance: number; interest: number } {
    const values = this.values();
    const principal = Number(values?.principal ?? this.form.controls.principal.value) || 0;
    const rate = Number(values?.interestRate ?? this.form.controls.interestRate.value) || 0;
    const start = values?.startDate ?? this.form.controls.startDate.value;
    const end = values?.endDate ?? this.form.controls.endDate.value;
    const term = Number(values?.totalEmis ?? this.form.controls.totalEmis.value) || this.termMonths(start, end);
    const payment = Number(values?.emiAmount ?? this.form.controls.emiAmount.value) || emi(principal, rate, term);
    const count = this.recoverySummary().paidInstallments;
    let balance = principal;
    let interestPaid = 0;
    const monthlyRate = rate / 1200;
    for (let period = 1; period <= Math.min(count, term); period++) {
      const interest = balance * monthlyRate;
      const principalPaid = Math.min(balance, Math.max(0, payment - interest));
      interestPaid += interest;
      balance = Math.max(0, balance - principalPaid);
    }
    return { balance, interest: interestPaid };
  }

  private termMonths(startDate: string, endDate: string): number {
    if (!startDate || !endDate || endDate <= startDate) return 0;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
  }

  private endDateForInstallments(startDate: string, installments: number, paymentDay: number): string {
    const [year, month, day] = startDate.split('-').map(Number);
    const monthStart = new Date(year, month - 1 + installments, 1);
    const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const dueDay = Math.min(Math.max(paymentDay, 1), lastDay);
    const endDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), dueDay || day);
    return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  }

  private syncMethodValidators(): void {
    const method = this.form.controls.interestType.value;
    const endDate = this.form.controls.endDate;
    const totalEmis = this.form.controls.totalEmis;
    const paymentsMade = this.form.controls.paymentsMade;

    endDate.setValidators(method === 'Flat' ? [] : [Validators.required]);
    totalEmis.setValidators(method === 'Reducing'
      ? [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]
      : method === 'Flat' ? [Validators.min(1), Validators.pattern(/^\d+$/)] : []);
    paymentsMade.setValidators(method === 'Bullet'
      ? [Validators.min(0), Validators.max(1), Validators.pattern(/^\d+$/)]
      : [Validators.min(0), Validators.pattern(/^\d+$/)]);

    if (method === 'Bullet') totalEmis.setValue(null, { emitEvent: false });
    else if (method === 'Reducing' && !totalEmis.value && endDate.value && this.form.controls.startDate.value) {
      totalEmis.setValue(this.termMonths(this.form.controls.startDate.value, endDate.value), { emitEvent: false });
    }

    endDate.updateValueAndValidity({ emitEvent: false });
    totalEmis.updateValueAndValidity({ emitEvent: false });
    paymentsMade.updateValueAndValidity({ emitEvent: false });
  }

  private termsKey(): string {
    const { principal, interestRate, interestType, startDate, endDate, totalEmis, emiAmount } = this.form.getRawValue();
    return [principal, interestRate, interestType, startDate, endDate, totalEmis, emiAmount].join('|');
  }
}
