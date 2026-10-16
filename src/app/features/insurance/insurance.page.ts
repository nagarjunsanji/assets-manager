import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { INSURANCE_CATEGORIES, Insurance, PAYMENT_DAY_OPTIONS, PREMIUM_FREQUENCY } from '../../models/wealth.models';
import { InsuranceRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { daysUntil, premiumMonthly, sum } from '../../utilities/finance';
import { formatDate, formatInr } from '../../utilities/format';
import { insuranceEffectiveMaturityDate } from '../../utilities/repayment-calendar';
import { InsuranceDetailsDialog, InsuranceDetailsDialogData } from './insurance-details-dialog';

const FIELDS: FieldConfig[] = [
  { key: 'policyName', label: 'Policy name', type: 'text', required: true },
  { key: 'policyNumber', label: 'Policy number', type: 'text', required: true },
  { key: 'provider', label: 'Provider', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'select', options: INSURANCE_CATEGORIES, required: true },
  { key: 'coverage', label: 'Sum assured / coverage', type: 'currency', required: true },
  { key: 'premium', label: 'Premium', type: 'currency', required: true },
  { key: 'premiumFrequency', label: 'Premium frequency', type: 'select', options: PREMIUM_FREQUENCY, defaultValue: 'Yearly', hint: 'The policy start date anchors the schedule: quarterly every 3 months, half-yearly every 6 months, yearly in the same month' },
  {
    key: 'premiumPaymentDay',
    label: 'Premium debit day of month',
    type: 'select',
    options: PAYMENT_DAY_OPTIONS,
    section: 'Premium payment',
    hint: 'Used for each scheduled payment. For annual and multi-month frequencies, payment months follow the policy start month and selected frequency.',
    visibleWhen: (values) => values['premiumFrequency'] !== 'Single',
  },
  { key: 'paymentAccount', label: 'Debit bank / account', type: 'text', hint: 'Account from which the premium is paid' },
  { key: 'startDate', label: 'Policy start date', type: 'date', required: true, hint: 'This date anchors the premium schedule; the first payment is the first selected payment day on or after this date.' },
  { key: 'endDate', label: 'Policy end date', type: 'date', hint: 'Optional. Premiums stop on this date; if omitted, the maturity date is used when provided.' },
  {
    key: 'maturityDate',
    label: 'Maturity date',
    type: 'date',
    section: 'Maturity payout',
    hint: 'Adds a maturity credit to the cashflow calendar',
    visibleWhen: (values) => values['category'] !== 'Health',
  },
  {
    key: 'maturityPayoutAmount',
    label: 'Expected maturity payout',
    type: 'currency',
    min: 0,
    hint: 'Optional; the calendar will show the maturity date and mark the amount as not provided if blank',
    visibleWhen: (values) => values['category'] !== 'Health',
  },
  {
    key: 'insuredPeople',
    label: 'People covered',
    type: 'textarea',
    section: 'People & assets covered',
    placeholder: 'One person per line, e.g. Neeraja Sanji (spouse)',
    hint: 'Add each covered person and their relationship to the policyholder. For family floaters, enter everyone covered.',
  },
  { key: 'nominee', label: 'Nominee', type: 'text' },
  { key: 'insuredAsset', label: 'Insured asset', type: 'text', hint: 'Vehicle, property, farm or other asset covered' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

function maturityTone(p: Insurance): 'danger' | 'warning' | 'info' | 'success' {
  const d = daysUntil(insuranceEffectiveMaturityDate(p)) ?? 999;
  return d < 0 ? 'danger' : d <= 15 ? 'warning' : d <= 45 ? 'info' : 'success';
}

@Component({
  selector: 'app-insurance-page',
  imports: [EntityPage, StatCard, ChartCard, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Insurance" subtitle="Life, health, vehicle, property and livestock protection with premium and maturity schedules"
      icon="health_and_safety" entityLabel="Policy" [repo]="repo" [fields]="fields" [columns]="columns"
      [rowClickEnabled]="true" (rowClick)="showDetails($event)">
      <ng-container kpis>
        <app-stat-card label="Total Coverage" [value]="kpi().coverage" icon="shield" accent="primary" [hint]="repo.count() + ' policies'" />
        <app-stat-card label="Life Cover" [value]="kpi().life" icon="favorite" accent="danger" />
        <app-stat-card label="Annual Premium" [value]="kpi().annualPremium" icon="receipt_long" accent="gold" [hint]="fmt(kpi().annualPremium / 12) + ' / month'" />
        <app-stat-card label="Maturities (45 days)" [value]="upcoming().length" format="number" icon="event" accent="warning" />
      </ng-container>
      @if (upcoming().length) {
        <section class="glass-card renewals">
          <h3><mat-icon>notifications_active</mat-icon> Upcoming maturities</h3>
          <div class="renewal-list">
            @for (p of upcoming(); track p.id) {
              <div class="renewal" [class]="'tone-' + tone(p)">
                <strong>{{ p.policyName }}</strong>
                <small>{{ p.provider }} · {{ fmt(p.premium) }}</small>
                <span class="when">{{ label(p) }} · {{ date(effectiveMaturityDate(p)) }}</span>
              </div>
            }
          </div>
        </section>
      }
      <div charts class="chart-grid">
        <app-chart-card class="span-4" title="Coverage by Category" [options]="coverageChart()" />
        <app-chart-card class="span-8" title="Premium vs Coverage" subtitle="Annualised premium per policy" [options]="premiumChart()" />
      </div>
    </app-entity-page>
  `,
  styles: `
    .renewals { padding: 20px; }
    h3 { margin: 0 0 14px; font-size: 15px; display: flex; align-items: center; gap: 8px; mat-icon { color: var(--warning); } }
    .renewal-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .renewal { padding: 14px 16px; border-radius: 16px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 2px; border-left: 4px solid var(--tone); background: var(--input-bg); }
    .renewal small { color: var(--text-muted); }
    .when { margin-top: 6px; font-size: 12.5px; font-weight: 600; color: var(--tone); }
    .tone-danger { --tone: var(--danger); }
    .tone-warning { --tone: var(--warning); }
    .tone-info { --tone: var(--primary); }
    .tone-success { --tone: var(--success); }
  `,
})
export class InsurancePage {
  protected readonly repo = inject(InsuranceRepositoryService);
  private readonly dialog = inject(MatDialog);
  protected readonly fields = FIELDS;
  protected readonly fmt = formatInr;
  protected readonly date = formatDate;
  protected readonly tone = maturityTone;
  protected readonly columns: ColumnConfig<Insurance>[] = [
    {
      key: 'policyName',
      label: 'Policy',
      sub: (p) => [
        p.provider,
        p.policyNumber,
        p.insuredPeople?.replace(/\n/g, ', '),
        p.paymentAccount,
      ].filter(Boolean).join(' · '),
    },
    { key: 'category', label: 'Category', type: 'chip' },
    { key: 'coverage', label: 'Coverage', type: 'currency' },
    { key: 'premium', label: 'Premium', type: 'currency', },
    { key: 'premiumFrequency', label: 'Frequency' },
    {
      key: 'premiumPaymentDay',
      label: 'Payment day',
      value: (p) => p.premiumPaymentDay ?? (p.startDate ? `Day ${Number(p.startDate.slice(-2))}` : '—'),
    },
    {
      key: 'maturityDate',
      label: 'Maturity',
      type: 'date',
      value: (p) => insuranceEffectiveMaturityDate(p),
    },
    { key: 'status', label: 'Maturity status', type: 'chip', value: (p) => this.label(p), chipTone: maturityTone },
  ];

  protected readonly upcoming = computed(() =>
    this.repo.items()
      .filter((p) => p.category !== 'Health' && insuranceEffectiveMaturityDate(p) && (daysUntil(insuranceEffectiveMaturityDate(p)) ?? 999) <= 45)
      .sort((a, b) => (insuranceEffectiveMaturityDate(a) ?? '').localeCompare(insuranceEffectiveMaturityDate(b) ?? '')),
  );

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    return {
      coverage: sum(items, (p) => p.coverage),
      life: sum(items.filter((p) => p.category === 'Life'), (p) => p.coverage),
      annualPremium: sum(items, (p) => premiumMonthly(p.premium, p.premiumFrequency) * 12),
    };
  });

  protected readonly coverageChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((p) => groups.set(p.category, (groups.get(p.category) ?? 0) + p.coverage));
    return donutChart([...groups.keys()], [...groups.values()]);
  });

  protected readonly premiumChart = computed(() => {
    const items = this.repo.items();
    return barChart(items.map((p) => p.policyName), [
      { name: 'Annual Premium', data: items.map((p) => Math.round(premiumMonthly(p.premium, p.premiumFrequency) * 12)) },
    ], { colors: ['#F5B942'], plotOptions: { bar: { borderRadius: 6, columnWidth: '45%', distributed: false } } });
  });

  protected label(p: Insurance): string {
    const maturityDate = this.effectiveMaturityDate(p);
    const d = daysUntil(maturityDate) ?? 0;
    return !maturityDate ? 'No maturity date' : d < 0 ? `Matured ${-d}d ago` : d === 0 ? 'Matures today' : `In ${d} days`;
  }

  protected effectiveMaturityDate(policy: Insurance): string | undefined {
    return insuranceEffectiveMaturityDate(policy);
  }

  protected showDetails(policy: Insurance): void {
    this.dialog.open<InsuranceDetailsDialog, InsuranceDetailsDialogData>(InsuranceDetailsDialog, {
      data: { policy },
      width: 'min(860px, 96vw)',
      maxWidth: '96vw',
      autoFocus: false,
    });
  }
}
