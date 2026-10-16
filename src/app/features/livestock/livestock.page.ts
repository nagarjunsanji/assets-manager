import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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
import { formatInr } from '../../utilities/format';
import { buildLivestockTree, livestockAgeLabel } from '../../utilities/livestock-tree';

@Component({
  selector: 'app-livestock-page',
  imports: [EntityPage, StatCard, ChartCard, NgTemplateOutlet, MatIconModule],
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
      <section class="herd-tree glass-card" aria-labelledby="herd-tree-title">
        <header class="tree-header">
          <div>
            <h2 id="herd-tree-title">Herd Family Tree</h2>
            <p>Lineage is connected using each animal's Mother record. Hover or focus a node for age and performance; select it for full details.</p>
          </div>
          <span class="tree-count">{{ repo.count() }} records</span>
        </header>
        @if (familyTree().length) {
          <div class="tree-scroll">
            <div class="tree-canvas">
              <ng-container *ngTemplateOutlet="nodeTree; context: { $implicit: familyTree() }" />
            </div>
          </div>
        } @else {
          <p class="tree-empty">Add livestock records to start building the herd tree.</p>
        }
      </section>
      <ng-template #nodeTree let-nodes>
        <div class="tree-level" [class.tree-root]="nodes === familyTree()">
          @for (node of nodes; track node.animal.id) {
            <div class="tree-branch" [class.tree-last]="$last && nodes.length > 1">
              <button type="button" class="animal-node" (click)="showDetails(node.animal)"
                [attr.aria-label]="nodeLabel(node.animal)">
                <span class="node-icon"><mat-icon>pets</mat-icon></span>
                <span class="node-heading">
                  <strong>{{ node.animal.tagNumber ? '#' + node.animal.tagNumber : node.animal.breed }}</strong>
                  <small>{{ node.animal.animalType }} · {{ node.animal.gender || 'Gender not set' }}</small>
                </span>
                <span class="node-tooltip" role="tooltip">
                  <strong>{{ node.animal.tagNumber ? '#' + node.animal.tagNumber + ' · ' : '' }}{{ node.animal.breed }} {{ node.animal.animalType }}</strong>
                  <span>Age: {{ ageLabel(node.animal) }}</span>
                  <span>Count: {{ node.animal.count }}</span>
                  <span>Current value: {{ fmt(node.animal.currentValue) }}</span>
                  <span>Milk: {{ node.animal.milkLitresPerDay || 0 }} L/day</span>
                  <span>Est. monthly revenue: {{ fmt(metrics(node.animal).monthlyRevenue) }}</span>
                  <span>Est. monthly costs: {{ fmt(metrics(node.animal).monthlyExpense) }}</span>
                  <span>Est. monthly profit: {{ fmt(metrics(node.animal).monthlyProfit) }}</span>
                </span>
              </button>
              @if (node.children.length) {
                <div class="tree-children">
                  <ng-container *ngTemplateOutlet="nodeTree; context: { $implicit: node.children }" />
                </div>
              }
            </div>
          }
        </div>
      </ng-template>
    </app-entity-page>
  `,
  styles: `
    .herd-tree { min-width: 0; margin-top: 24px; padding: 22px; overflow: hidden; }
    .tree-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
    .tree-header h2 { margin: 0; font-size: 18px; }
    .tree-header p { margin: 6px 0 0; color: var(--text-muted); font-size: 13px; }
    .tree-count { flex: 0 0 auto; padding: 6px 10px; border: 1px solid var(--glass-border); border-radius: 999px; color: var(--text-muted); font-size: 12px; }
    .tree-scroll { overflow: auto; padding: 12px 12px 26px; }
    .tree-canvas { display: flex; justify-content: center; min-width: max-content; padding: 4px 12px 14px; perspective: 1100px; }
    .tree-level { position: relative; display: flex; align-items: flex-start; justify-content: center; gap: 20px; }
    .tree-branch { position: relative; display: flex; flex-direction: column; align-items: center; padding: 0 10px; }
    .tree-children { position: relative; padding-top: 34px; }
    .tree-children::before { position: absolute; top: 0; left: 50%; height: 34px; border-left: 2px solid color-mix(in srgb, var(--primary) 40%, var(--glass-border)); content: ''; }
    .tree-children > .tree-level > .tree-branch::before { position: absolute; top: 0; left: 50%; height: 34px; border-left: 2px solid color-mix(in srgb, var(--primary) 40%, var(--glass-border)); content: ''; }
    .tree-children > .tree-level > .tree-branch::after { position: absolute; top: 0; right: 0; left: 0; border-top: 2px solid color-mix(in srgb, var(--primary) 35%, var(--glass-border)); content: ''; }
    .tree-children > .tree-level > .tree-branch:first-child::after { left: 50%; }
    .tree-children > .tree-level > .tree-branch:last-child::after { right: 50%; }
    .animal-node { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; width: 190px; min-height: 74px; padding: 12px; border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--glass-border)); border-radius: 18px; background: linear-gradient(145deg, color-mix(in srgb, var(--surface) 92%, white), color-mix(in srgb, var(--primary) 10%, var(--surface))); box-shadow: 0 10px 20px rgb(20 30 60 / 12%), inset 0 1px 0 rgb(255 255 255 / 55%); color: var(--text); text-align: left; cursor: pointer; transform: rotateX(2deg); transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
    .animal-node:hover, .animal-node:focus-visible { z-index: 5; border-color: var(--primary); outline: none; box-shadow: 0 18px 28px rgb(20 30 60 / 24%), 0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent); transform: translateY(-5px) rotateX(0deg) scale(1.03); }
    .node-icon { display: grid; flex: 0 0 38px; width: 38px; height: 38px; place-items: center; border-radius: 13px; background: color-mix(in srgb, var(--primary) 16%, var(--surface)); color: var(--primary); }
    .node-heading { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
    .node-heading strong, .node-heading small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .node-heading strong { font-size: 13px; }
    .node-heading small { color: var(--text-muted); font-size: 11px; }
    .node-tooltip { position: absolute; z-index: 10; top: 50%; left: calc(100% + 12px); display: flex; visibility: hidden; width: 245px; flex-direction: column; gap: 5px; padding: 13px 15px; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--surface); box-shadow: 0 16px 36px rgb(10 18 40 / 30%); color: var(--text); font-size: 12px; opacity: 0; pointer-events: none; transform: translate(6px, -50%); transition: opacity 140ms ease, transform 140ms ease, visibility 140ms; }
    .tree-branch.tree-last > .animal-node .node-tooltip { right: calc(100% + 12px); left: auto; transform: translate(-6px, -50%); }
    .node-tooltip strong { margin-bottom: 3px; color: var(--primary); font-size: 13px; }
    .animal-node:hover .node-tooltip, .animal-node:focus-visible .node-tooltip { visibility: visible; opacity: 1; transform: translate(0, -50%); }
    .tree-branch.tree-last > .animal-node:hover .node-tooltip, .tree-branch.tree-last > .animal-node:focus-visible .node-tooltip { transform: translate(0, -50%); }
    .tree-empty { margin: 18px 0 2px; color: var(--text-muted); text-align: center; }
    @media (prefers-reduced-motion: reduce) { .animal-node, .node-tooltip { transition: none; } }
    @media (max-width: 600px) { .herd-tree { padding: 16px; } .tree-header { flex-direction: column; } }
  `,
})
export class LivestockPage {
  protected readonly repo = inject(LivestockRepositoryService);
  private readonly dialog = inject(MatDialog);
  protected readonly fmt = formatInr;
  protected readonly familyTree = computed(() => buildLivestockTree(this.repo.items()));

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

  protected metrics(animal: Livestock) {
    return livestockMetrics(animal);
  }

  protected ageLabel(animal: Livestock): string {
    return livestockAgeLabel(animal);
  }

  protected nodeLabel(animal: Livestock): string {
    const metrics = livestockMetrics(animal);
    return `${animal.tagNumber ? `Tag ${animal.tagNumber}, ` : ''}${animal.breed} ${animal.animalType}, age ${this.ageLabel(animal)}, current value ${formatInr(animal.currentValue)}, estimated monthly profit ${formatInr(metrics.monthlyProfit)}`;
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
