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
import { InsuranceDetailsDialog, InsuranceDetailsDialogData } from './insurance-details-dialog';

const FIELDS: FieldConfig[] = [
  { key: 'policyName', label: 'Policy name', type: 'text', required: true },
  { key: 'policyNumber', label: 'Policy number', type: 'text', required: true },
  { key: 'provider', label: 'Provider', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'select', options: INSURANCE_CATEGORIES, required: true },
  { key: 'coverage', label: 'Sum assured / coverage', type: 'currency', required: true },
  { key: 'premium', label: 'Premium', type: 'currency', required: true },
  { key: 'premiumFrequency', label: 'Premium frequency', type: 'select', options: PREMIUM_FREQUENCY, defaultValue: 'Yearly' },
  { key: 'premiumPaymentDay', label: 'Premium payment day', type: 'select', options: PAYMENT_DAY_OPTIONS, required: true, section: 'Premium payment', hint: 'For recurring premiums, the selected day is used in each payment month' },
  { key: 'paymentAccount', label: 'Debit bank / account', type: 'text', hint: 'Account from which the premium is paid' },
  { key: 'startDate', label: 'Policy start date', type: 'date', required: true },
  { key: 'maturityDate', label: 'Maturity date', type: 'date', section: 'Maturity payout', hint: 'Adds a maturity credit to the cashflow calendar' },
  { key: 'maturityPayoutAmount', label: 'Expected maturity payout', type: 'currency', min: 0, hint: 'Optional; the calendar will show the maturity date and mark the amount as not provided if blank' },
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
  const d = daysUntil(p.maturityDate) ?? 999;
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
                <span class="when">{{ label(p) }} · {{ date(p.maturityDate) }}</span>
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
    { key: 'premiumPaymentDay', label: 'Payment day', type: 'number', value: (p) => p.premiumPaymentDay ?? (p.startDate ? Number(p.startDate.slice(-2)) : '—') },
    { key: 'maturityDate', label: 'Maturity', type: 'date' },
    { key: 'status', label: 'Maturity status', type: 'chip', value: (p) => this.label(p), chipTone: maturityTone },
  ];

  protected readonly upcoming = computed(() =>
    this.repo.items()
      .filter((p) => p.maturityDate && (daysUntil(p.maturityDate) ?? 999) <= 45)
      .sort((a, b) => (a.maturityDate ?? '').localeCompare(b.maturityDate ?? '')),
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
    const d = daysUntil(p.maturityDate) ?? 0;
    return !p.maturityDate ? 'No maturity date' : d < 0 ? `Matured ${-d}d ago` : d === 0 ? 'Matures today' : `In ${d} days`;
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
