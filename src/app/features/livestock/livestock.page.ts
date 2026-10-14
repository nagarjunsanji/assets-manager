import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ANIMAL_TYPES, Livestock } from '../../models/wealth.models';
import { FarmRepositoryService, LivestockRepositoryService } from '../../services/repositories/repositories';
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
      icon="pets" entityLabel="Livestock" [repo]="repo" [fields]="fields()" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Herd Value" [value]="kpi().value" icon="pets" accent="purple" [delta]="kpi().growth" deltaLabel="Value growth over purchase" />
        <app-stat-card label="Total Animals" [value]="kpi().count" format="number" icon="groups" accent="cyan" [hint]="kpi().countGrowth.toFixed(0) + '% herd growth'" />
        <app-stat-card label="Milk / Day" [value]="kpi().milk" format="number" icon="water_drop" accent="primary" hint="litres" />
        <app-stat-card label="Monthly Profit" [value]="kpi().profit" icon="savings" accent="success" [hint]="kpi().expenseRatio.toFixed(0) + '% expense ratio'" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-8" title="Farm Profitability" subtitle="Monthly livestock revenue vs costs per farm" [options]="farmChart()" />
        <app-chart-card class="span-4" title="Livestock Value Mix" [options]="mixChart()" />
      </div>
    </app-entity-page>
  `,
})
export class LivestockPage {
  protected readonly repo = inject(LivestockRepositoryService);
  private readonly farms = inject(FarmRepositoryService);

  protected readonly fields = computed<FieldConfig[]>(() => [
    {
      key: 'farmId', label: 'Farm', type: 'select', required: true, section: 'Herd',
      options: this.farms.items().map((f) => ({ value: f.id, label: f.name })),
      hint: this.farms.count() ? '' : 'Create a farm first',
    },
    { key: 'animalType', label: 'Animal type', type: 'select', options: ANIMAL_TYPES, required: true, defaultValue: 'Cow' },
    { key: 'breed', label: 'Breed', type: 'text', required: true },
    { key: 'count', label: 'Current count', type: 'number', required: true, min: 0 },
    { key: 'initialCount', label: 'Initial count', type: 'number', min: 0 },
    { key: 'purchaseDate', label: 'Purchase date', type: 'date' },
    { key: 'purchaseValue', label: 'Purchase value', type: 'currency', section: 'Valuation & Income', defaultValue: 0 },
    { key: 'currentValue', label: 'Current value', type: 'currency', required: true },
    { key: 'milkLitresPerDay', label: 'Milk production (L/day)', type: 'number', defaultValue: 0 },
    { key: 'milkPricePerLitre', label: 'Milk price (₹/L)', type: 'currency', defaultValue: 0 },
    { key: 'otherMonthlyRevenue', label: 'Other revenue / month', type: 'currency', hint: 'Eggs, kids, manure, sales' },
    { key: 'monthlyFeedCost', label: 'Feed cost / month', type: 'currency', defaultValue: 0, section: 'Costs & Health' },
    { key: 'monthlyMedicineCost', label: 'Medicine cost / month', type: 'currency', defaultValue: 0 },
    { key: 'lastVaccination', label: 'Last vaccination', type: 'date' },
    { key: 'nextVaccination', label: 'Next vaccination', type: 'date' },
    { key: 'insured', label: 'Insured', type: 'toggle' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]);

  protected readonly columns: ColumnConfig<Livestock>[] = [
    { key: 'breed', label: 'Breed', sub: (l) => `${l.animalType} · ${this.farms.getById(l.farmId)?.name ?? 'Unassigned'}` },
    { key: 'animalType', label: 'Type', type: 'chip' },
    { key: 'count', label: 'Count', type: 'number' },
    { key: 'currentValue', label: 'Value', type: 'currency' },
    { key: 'growth', label: 'Value Growth', type: 'pnl-pct', value: (l) => appreciationPct(l.purchaseValue, l.currentValue) },
    { key: 'milkLitresPerDay', label: 'Milk L/day', type: 'number' },
    { key: 'cost', label: 'Feed + Med / mo', type: 'currency', value: (l) => livestockMetrics(l).monthlyExpense },
    { key: 'profit', label: 'Profit / mo', type: 'pnl', value: (l) => livestockMetrics(l).monthlyProfit },
    {
      key: 'nextVaccination', label: 'Vaccination', type: 'chip',
      value: (l) => { const d = daysUntil(l.nextVaccination); return d === null ? 'Not scheduled' : d < 0 ? 'Overdue' : `In ${d} days`; },
      chipTone: (l) => { const d = daysUntil(l.nextVaccination); return d === null ? 'neutral' : d < 0 ? 'danger' : d <= 14 ? 'warning' : 'success'; },
    },
    { key: 'insured', label: 'Insured', type: 'chip', value: (l) => (l.insured ? 'Yes' : 'No'), chipTone: (l) => (l.insured ? 'success' : 'warning') },
  ];

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

  protected readonly farmChart = computed(() => {
    const farms = this.farms.items();
    const per = farms.map((f) => {
      const m = this.repo.items().filter((l) => l.farmId === f.id).map(livestockMetrics);
      return { revenue: sum(m, (x) => x.monthlyRevenue), expense: sum(m, (x) => x.monthlyExpense) };
    });
    return barChart(farms.map((f) => f.name), [
      { name: 'Revenue', data: per.map((x) => x.revenue) },
      { name: 'Feed & Medicine', data: per.map((x) => x.expense) },
      { name: 'Profit', data: per.map((x) => x.revenue - x.expense) },
    ], { colors: ['#00C48C', '#FF5C7A', '#F5B942'] });
  });

  protected readonly mixChart = computed(() => {
    const groups = new Map<string, number>();
    this.repo.items().forEach((l) => groups.set(l.animalType, (groups.get(l.animalType) ?? 0) + l.currentValue));
    return donutChart([...groups.keys()], [...groups.values()]);
  });
}
