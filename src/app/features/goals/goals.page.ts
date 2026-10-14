import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Goal, GOAL_CATEGORIES } from '../../models/wealth.models';
import { GoalRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { radialChart } from '../../utilities/chart-builders';
import { monthsBetween, pct, projectWealth, sum } from '../../utilities/finance';
import { formatDate, formatInr } from '../../utilities/format';

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Goal name', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'select', options: GOAL_CATEGORIES, required: true },
  { key: 'targetAmount', label: 'Goal amount', type: 'currency', required: true, min: 1 },
  { key: 'currentAmount', label: 'Current progress', type: 'currency', defaultValue: 0 },
  { key: 'monthlyContribution', label: 'Monthly contribution', type: 'currency', defaultValue: 0 },
  { key: 'targetDate', label: 'Target date', type: 'date', required: true },
  { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], defaultValue: 'Medium' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const GOAL_ICONS: Record<string, string> = {
  Retirement: 'beach_access', 'Farm Expansion': 'agriculture', House: 'home', 'Emergency Fund': 'emergency',
  Education: 'school', Travel: 'flight', Other: 'flag',
};

/** Projected corpus at target date assuming 10% return on existing amount + contributions. */
export function goalProjection(g: Goal): { projected: number; onTrack: boolean } {
  const months = monthsBetween(new Date(), new Date(g.targetDate));
  const values = projectWealth(g.currentAmount, g.monthlyContribution, 10, Math.ceil(months / 12));
  const projected = values.at(-1) ?? g.currentAmount;
  return { projected, onTrack: projected >= g.targetAmount };
}

@Component({
  selector: 'app-goals-page',
  imports: [EntityPage, StatCard, ChartCard, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Financial Goals" subtitle="Retirement, farm expansion, housing, emergency fund and education"
      icon="flag" entityLabel="Goal" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Total Goal Amount" [value]="kpi().target" icon="flag" accent="primary" [hint]="repo.count() + ' goals'" />
        <app-stat-card label="Accumulated" [value]="kpi().current" icon="savings" accent="success" [hint]="kpi().progress.toFixed(1) + '% overall'" />
        <app-stat-card label="Monthly Commitment" [value]="kpi().monthly" icon="event_repeat" accent="gold" />
        <app-stat-card label="On Track" [value]="kpi().onTrack" format="number" icon="verified" accent="cyan" [hint]="'of ' + repo.count() + ' goals (10% return)'" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-5" title="Goal Progress" [options]="progressChart()" [height]="360" />
        <section class="glass-card goals span-7">
          @for (g of cards(); track g.id) {
            <article class="goal hoverable">
              <span class="icon"><mat-icon>{{ g.icon }}</mat-icon></span>
              <div class="body">
                <div class="top">
                  <strong>{{ g.name }}</strong>
                  <span class="chip" [class]="g.onTrack ? 'tone-success' : 'tone-warning'">{{ g.onTrack ? 'On track' : 'Needs attention' }}</span>
                </div>
                <div class="bar"><span [style.width.%]="g.progress"></span></div>
                <small>{{ fmt(g.currentAmount) }} of {{ fmt(g.targetAmount) }} · {{ g.progress.toFixed(0) }}% · by {{ date(g.targetDate) }} · projected {{ fmt(g.projected) }}</small>
              </div>
            </article>
          } @empty {
            <p class="muted">Add a goal to start tracking.</p>
          }
        </section>
      </div>
    </app-entity-page>
  `,
  styles: `
    .goals { padding: 16px; display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
    .goal { display: flex; gap: 14px; padding: 12px; border-radius: 16px; transition: background .2s; }
    .goal:hover { background: color-mix(in srgb, var(--primary) 6%, transparent); }
    .icon { width: 42px; height: 42px; min-width: 42px; border-radius: 14px; display: grid; place-items: center; color: var(--gold); background: color-mix(in srgb, var(--gold) 14%, transparent); }
    .body { flex: 1; min-width: 0; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
    .bar { height: 8px; border-radius: 8px; background: var(--glass-border); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 8px; background: linear-gradient(90deg, var(--gold), var(--success)); transition: width 1s ease; }
    small { display: block; margin-top: 6px; color: var(--text-muted); font-size: 12px; }
  `,
})
export class GoalsPage {
  protected readonly repo = inject(GoalRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly fmt = formatInr;
  protected readonly date = formatDate;
  protected readonly columns: ColumnConfig<Goal>[] = [
    { key: 'name', label: 'Goal', sub: (g) => g.category },
    { key: 'priority', label: 'Priority', type: 'chip', chipTone: (g) => (g.priority === 'High' ? 'danger' : g.priority === 'Medium' ? 'warning' : 'neutral') },
    { key: 'targetAmount', label: 'Target', type: 'currency' },
    { key: 'currentAmount', label: 'Current', type: 'currency' },
    { key: 'progress', label: 'Progress', type: 'progress', value: (g) => pct(g.currentAmount, g.targetAmount) },
    { key: 'monthlyContribution', label: 'Monthly', type: 'currency' },
    { key: 'targetDate', label: 'Target Date', type: 'date' },
    { key: 'projected', label: 'Projected', type: 'currency', value: (g) => goalProjection(g).projected },
  ];

  protected readonly cards = computed(() =>
    this.repo.items().map((g) => ({
      ...g,
      ...goalProjection(g),
      icon: GOAL_ICONS[g.category] ?? 'flag',
      progress: Math.min(100, pct(g.currentAmount, g.targetAmount)),
    })),
  );

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const target = sum(items, (g) => g.targetAmount);
    const current = sum(items, (g) => g.currentAmount);
    return {
      target, current, progress: pct(current, target), monthly: sum(items, (g) => g.monthlyContribution),
      onTrack: this.cards().filter((g) => g.onTrack).length,
    };
  });

  protected readonly progressChart = computed(() =>
    radialChart(this.cards().map((g) => g.name), this.cards().map((g) => g.progress)),
  );
}
