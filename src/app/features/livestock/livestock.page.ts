import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ANIMAL_TYPES, Livestock } from '../../models/wealth.models';
import { LivestockRepositoryService } from '../../services/repositories/repositories';
import { LivestockDetailsDialog, LivestockDetailsDialogData } from './livestock-details-dialog';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { appreciationPct, daysUntil, livestockMetrics, pct, sum } from '../../utilities/finance';

@Component({
  selector: 'app-livestock-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Livestock Management" subtitle="Herd value, milk production, costs and vaccination schedule"
      icon="pets" entityLabel="Livestock" [repo]="repo" [fields]="fields()" [columns]="columns"
      [rowClickEnabled]="true" (rowClick)="showDetails($event)">
      <ng-container kpis>
        <app-stat-card label="Herd Value" [value]="kpi().value" icon="pets" accent="purple" [delta]="kpi().growth" deltaLabel="Value growth over purchase" />
        <app-stat-card label="Total Animals" [value]="kpi().count" format="number" icon="groups" accent="cyan" [hint]="kpi().countGrowth.toFixed(0) + '% herd growth'" />
        <app-stat-card label="Milk / Day" [value]="kpi().milk" format="number" icon="water_drop" accent="primary" hint="litres" />
        <app-stat-card label="Monthly Profit" [value]="kpi().profit" icon="savings" accent="success" [hint]="kpi().expenseRatio.toFixed(0) + '% expense ratio'" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-8" title="Livestock by Location" subtitle="Monthly revenue, costs and profit" [options]="locationChart()" />
        <app-chart-card class="span-4" title="Livestock Value Mix" [options]="mixChart()" />
      </div>
    </app-entity-page>
  `,
})
export class LivestockPage {
  protected readonly repo = inject(LivestockRepositoryService);
  private readonly dialog = inject(MatDialog);

  protected readonly fields = computed<FieldConfig[]>(() => [
    { key: 'farmName', label: 'Farm name', type: 'text', section: 'Herd', placeholder: 'e.g. Hebbevu Farms' },
    { key: 'animalType', label: 'Animal type', type: 'select', options: ANIMAL_TYPES, required: true, defaultValue: 'Cow' },
    { key: 'breed', label: 'Breed', type: 'text', required: true },
    { key: 'tagNumber', label: 'Cattle / tag number', type: 'text', hint: 'Leave blank until a tag number is assigned' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male'] },
    { key: 'birthDate', label: 'Birth date', type: 'date' },
    {
      key: 'motherId', label: 'Mother', type: 'select',
      options: this.repo.items().filter((l) => l.gender === 'Female').map((l) => ({
        value: l.id, label: `${l.tagNumber ? `#${l.tagNumber}` : l.animalType} · ${l.breed}`,
      })),
      hint: 'Link a calf to its mother when known',
    },
    { key: 'pregnancyMonths', label: 'Pregnancy (months)', type: 'number', min: 0, max: 10, hint: 'For currently pregnant animals' },
    { key: 'count', label: 'Current count', type: 'number', required: true, min: 0 },
    { key: 'initialCount', label: 'Initial count', type: 'number', min: 0 },
    { key: 'purchaseDate', label: 'Purchase date', type: 'date' },
    { key: 'purchaseValue', label: 'Purchase value', type: 'currency', section: 'Valuation & Income', defaultValue: 0 },
    { key: 'currentValue', label: 'Current value', type: 'currency', required: true },
    { key: 'milkLitresPerDay', label: 'Milk production (L/day)', type: 'number', defaultValue: 0 },
    { key: 'milkPricePerLitre', label: 'Milk price (₹/L)', type: 'currency', defaultValue: 0 },
    {
      key: 'milkIncomeTransactions',
      label: 'Milk income received',
      type: 'cashflows',
      section: 'Milk income history',
      placeholder: '2025-10-05, 41521',
      hint: 'One receipt per line: YYYY-MM-DD, amount',
    },
    { key: 'otherMonthlyRevenue', label: 'Other revenue / month', type: 'currency', hint: 'Eggs, kids, manure, sales' },
    { key: 'monthlyFeedCost', label: 'Feed cost / month', type: 'currency', defaultValue: 0, section: 'Costs & Health' },
    { key: 'monthlyMedicineCost', label: 'Medicine cost / month', type: 'currency', defaultValue: 0 },
    { key: 'lastVaccination', label: 'Last vaccination', type: 'date' },
    { key: 'nextVaccination', label: 'Next vaccination', type: 'date' },
    { key: 'insured', label: 'Insured', type: 'toggle' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]);

  protected readonly columns: ColumnConfig<Livestock>[] = [
    {
      key: 'breed',
      label: 'Animal',
      sub: (l) => [
        l.tagNumber ? `Tag ${l.tagNumber}` : '',
        l.gender,
        l.birthDate ? `Born ${l.birthDate}` : '',
        l.motherId ? `Mother ${this.repo.getById(l.motherId)?.tagNumber ?? this.repo.getById(l.motherId)?.breed ?? ''}` : '',
        l.farmName || 'Unassigned',
        l.pregnancyMonths ? `${l.pregnancyMonths} months pregnant` : '',
      ].filter(Boolean).join(' · '),
    },
    { key: 'animalType', label: 'Type', type: 'chip' },
    { key: 'count', label: 'Count', type: 'number' },
    { key: 'currentValue', label: 'Value', type: 'currency' },
    { key: 'growth', label: 'Value Growth', type: 'pnl-pct', value: (l) => appreciationPct(l.purchaseValue, l.currentValue) },
    { key: 'milkLitresPerDay', label: 'Milk L/day', type: 'number' },
    { key: 'milkIncome', label: 'Milk income received', type: 'currency', value: (l) => sum(l.milkIncomeTransactions ?? [], (entry) => entry.amount) },
    { key: 'cost', label: 'Feed + Med / mo', type: 'currency', value: (l) => livestockMetrics(l).monthlyExpense },
    { key: 'profit', label: 'Profit / mo', type: 'pnl', value: (l) => livestockMetrics(l).monthlyProfit },
    {
      key: 'nextVaccination', label: 'Vaccination', type: 'chip',
      value: (l) => { const d = daysUntil(l.nextVaccination); return d === null ? 'Not scheduled' : d < 0 ? 'Overdue' : `In ${d} days`; },
      chipTone: (l) => { const d = daysUntil(l.nextVaccination); return d === null ? 'neutral' : d < 0 ? 'danger' : d <= 14 ? 'warning' : 'success'; },
    },
    { key: 'insured', label: 'Insured', type: 'chip', value: (l) => (l.insured ? 'Yes' : 'No'), chipTone: (l) => (l.insured ? 'success' : 'warning') },
  ];

  protected showDetails(livestock: Livestock): void {
    this.dialog.open<LivestockDetailsDialog, LivestockDetailsDialogData>(LivestockDetailsDialog, {
      data: { livestock },
      width: 'min(860px, 96vw)',
      maxWidth: '96vw',
      autoFocus: false,
    });
  }

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const m = items.map(livestockMetrics);
    const value = sum(items, (l) => l.currentValue);
    const purchase = sum(items, (l) => l.purchaseValue);
    const count = sum(items, (l) => l.count);
    const initial = sum(items, (l) => l.initialCount || 0);
    const revenue = sum(m, (x) => x.monthlyRevenue);
    const expense = sum(m, (x) => x.monthlyExpense);
    return {
      value, count, growth: appreciationPct(purchase, value), countGrowth: pct(count - initial, initial),
      milk: sum(items, (l) => l.milkLitresPerDay), profit: revenue - expense, expenseRatio: pct(expense, revenue),
    };
  });

  protected readonly locationChart = computed(() => {
    const groups = new Map<string, { revenue: number; expense: number }>();
    this.repo.items().forEach((animal) => {
      const location = animal.farmName || 'Unassigned';
      const current = groups.get(location) ?? { revenue: 0, expense: 0 };
      const metrics = livestockMetrics(animal);
      groups.set(location, {
        revenue: current.revenue + metrics.monthlyRevenue,
        expense: current.expense + metrics.monthlyExpense,
      });
    });
    const locations = [...groups.keys()];
    const totals = [...groups.values()];
    return barChart(locations, [
      { name: 'Revenue', data: totals.map((x) => x.revenue) },
      { name: 'Feed & Medicine', data: totals.map((x) => x.expense) },
      { name: 'Profit', data: totals.map((x) => x.revenue - x.expense) },
    ], { colors: ['#00C48C', '#FF5C7A', '#F5B942'] });
  });

  protected readonly mixChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((l) => groups.set(l.animalType, (groups.get(l.animalType) ?? 0) + l.currentValue));
    return donutChart([...groups.keys()], [...groups.values()]);
  });
}
