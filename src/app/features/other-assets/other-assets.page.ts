import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { OTHER_ASSET_CATEGORIES, OtherAsset } from '../../models/wealth.models';
import { OtherAssetRepositoryService } from '../../services/repositories/repositories';
import { ChartCard } from '../../shared/components/chart-card';
import { ColumnConfig } from '../../shared/components/data-table';
import { EntityPage } from '../../shared/components/entity-page';
import { StatCard } from '../../shared/components/stat-card';
import { FieldConfig } from '../../shared/dialogs/entity-form-dialog';
import { barChart, donutChart } from '../../utilities/chart-builders';
import { appreciationPct, sum } from '../../utilities/finance';

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Asset name', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'select', options: OTHER_ASSET_CATEGORIES, required: true },
  { key: 'institution', label: 'Institution / Custodian', type: 'text' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'unit', label: 'Unit', type: 'text', placeholder: 'grams, kg, units…' },
  { key: 'investedValue', label: 'Invested value', type: 'currency', required: true },
  { key: 'currentValue', label: 'Current value', type: 'currency', required: true },
  { key: 'interestRate', label: 'Interest rate', type: 'percent' },
  { key: 'annualIncome', label: 'Annual income (interest / coupon)', type: 'currency' },
  { key: 'maturityDate', label: 'Maturity date', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

@Component({
  selector: 'app-other-assets-page',
  imports: [EntityPage, StatCard, ChartCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-page title="Other Assets" subtitle="Bonds, savings, gold, silver, crypto, EPF, PPF, NPS, machinery and receivables"
      icon="account_balance_wallet" entityLabel="Asset" [repo]="repo" [fields]="fields" [columns]="columns">
      <ng-container kpis>
        <app-stat-card label="Current Value" [value]="kpi().current" icon="account_balance_wallet" accent="primary" />
        <app-stat-card label="Gains" [value]="kpi().gain" icon="trending_up" accent="success" [delta]="kpi().gainPct" deltaLabel="Over invested value" />
        <app-stat-card label="Retirement Corpus" [value]="kpi().retirement" icon="elderly" accent="purple" hint="EPF + PPF + NPS" />
        <app-stat-card label="Precious Metals" [value]="kpi().metals" icon="diamond" accent="gold" hint="Gold + Silver" />
      </ng-container>
      <div charts class="chart-grid">
        <app-chart-card class="span-4" title="Category Mix" [options]="mixChart()" />
        <app-chart-card class="span-8" title="Invested vs Current" [options]="valueChart()" />
      </div>
    </app-entity-page>
  `,
})
export class OtherAssetsPage {
  protected readonly repo = inject(OtherAssetRepositoryService);
  protected readonly fields = FIELDS;
  protected readonly columns: ColumnConfig<OtherAsset>[] = [
    { key: 'name', label: 'Asset', sub: (a) => a.institution },
    { key: 'category', label: 'Category', type: 'chip' },
    { key: 'quantity', label: 'Qty', value: (a) => (a.quantity ? `${a.quantity} ${a.unit ?? ''}` : '—') },
    { key: 'investedValue', label: 'Invested', type: 'currency' },
    { key: 'currentValue', label: 'Current', type: 'currency' },
    { key: 'gain', label: 'Return', type: 'pnl-pct', value: (a) => appreciationPct(a.investedValue, a.currentValue) },
    { key: 'annualIncome', label: 'Income / yr', type: 'currency' },
    { key: 'maturityDate', label: 'Maturity', type: 'date' },
  ];

  private readonly byCategory = computed(() => {
    const map = new Map<string, { invested: number; current: number }>();
    this.repo.items().forEach((a) => {
      const g = map.get(a.category) ?? { invested: 0, current: 0 };
      map.set(a.category, { invested: g.invested + a.investedValue, current: g.current + a.currentValue });
    });
    return [...map.entries()].sort((a, b) => b[1].current - a[1].current);
  });

  protected readonly kpi = computed(() => {
    const items = this.repo.items();
    const invested = sum(items, (a) => a.investedValue);
    const current = sum(items, (a) => a.currentValue);
    const of = (...cats: string[]) => sum(items.filter((a) => cats.includes(a.category)), (a) => a.currentValue);
    return { current, gain: current - invested, gainPct: appreciationPct(invested, current), retirement: of('EPF', 'PPF', 'NPS'), metals: of('Gold', 'Silver') };
  });

  protected readonly mixChart = computed(() => donutChart(this.byCategory().map((c) => c[0]), this.byCategory().map((c) => c[1].current)));

  protected readonly valueChart = computed(() =>
    barChart(this.byCategory().map((c) => c[0]), [
      { name: 'Invested', data: this.byCategory().map((c) => c[1].invested) },
      { name: 'Current', data: this.byCategory().map((c) => c[1].current) },
    ], { colors: ['#8A94B2', '#F5B942'] }),
  );
}
