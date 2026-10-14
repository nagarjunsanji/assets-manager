import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, input, output, signal, viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Entity } from '../../models/entity.model';
import { formatDate, formatInr, formatNumber, formatPct } from '../../utilities/format';

export type ColumnType = 'text' | 'currency' | 'number' | 'percent' | 'date' | 'chip' | 'pnl' | 'pnl-pct' | 'progress';

export interface ColumnConfig<T> {
  key: string;
  label: string;
  type?: ColumnType;
  value?: (row: T) => unknown;
  sub?: (row: T) => string | undefined;
  chipTone?: (row: T) => 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

/** Generic sortable/filterable glass table with edit & delete actions. */
@Component({
  selector: 'app-data-table',
  imports: [MatTableModule, MatSortModule, MatPaginatorModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card table-card">
      <header>
        <div>
          <h3>{{ title() }}</h3>
          <p>{{ rows().length }} records</p>
        </div>
        <label class="filter">
          <mat-icon>search</mat-icon>
          <input type="search" placeholder="Filter…" (input)="applyFilter($any($event.target).value)" aria-label="Filter table" />
        </label>
      </header>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="table-scroll">
        <table mat-table [dataSource]="dataSource" matSort>
          @for (col of columns(); track col.key) {
            <ng-container [matColumnDef]="col.key">
              <th mat-header-cell *matHeaderCellDef mat-sort-header [class.num]="isNumeric(col)">{{ col.label }}</th>
              <td mat-cell *matCellDef="let row" [class.num]="isNumeric(col)">
                @let v = valueOf(col, row);
                @switch (col.type) {
                  @case ('currency') { {{ inr(v) }} }
                  @case ('number') { {{ num(v) }} }
                  @case ('percent') { {{ pctFmt(v) }} }
                  @case ('date') { {{ date(v) }} }
                  @case ('pnl') { <span [class.pos]="$any(v) >= 0" [class.neg]="$any(v) < 0">{{ $any(v) >= 0 ? '+' : '' }}{{ inr(v) }}</span> }
                  @case ('pnl-pct') { <span [class.pos]="$any(v) >= 0" [class.neg]="$any(v) < 0">{{ $any(v) >= 0 ? '+' : '' }}{{ pctFmt(v) }}</span> }
                  @case ('chip') { <span class="chip" [class]="'tone-' + (col.chipTone?.(row) ?? 'info')">{{ v }}</span> }
                  @case ('progress') {
                    <div class="progress"><span [style.width.%]="clamp(v)"></span></div>
                    <small>{{ pctFmt(v) }}</small>
                  }
                  @default {
                    <span class="primary-text">{{ v ?? '—' }}</span>
                    @if (col.sub?.(row); as sub) { <small class="sub">{{ sub }}</small> }
                  }
                }
              </td>
            </ng-container>
          }
          <ng-container matColumnDef="__actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row" class="actions">
              <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="Row actions"><mat-icon>more_vert</mat-icon></button>
              <mat-menu #menu="matMenu" xPosition="before">
                <button mat-menu-item (click)="edit.emit(row)"><mat-icon>edit</mat-icon>Edit</button>
                <button mat-menu-item (click)="remove.emit(row)" class="danger"><mat-icon>delete</mat-icon>Delete</button>
              </mat-menu>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayed(); sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayed()" (dblclick)="edit.emit(row)"></tr>
          <tr class="mat-row" *matNoDataRow>
            <td class="no-data" [attr.colspan]="displayed().length">
              <mat-icon>inbox</mat-icon>
              <span>{{ loading() ? 'Loading…' : 'No records yet. Add your first one.' }}</span>
            </td>
          </tr>
        </table>
      </div>
      <mat-paginator [pageSizeOptions]="[10, 25, 50]" [pageSize]="10" [hidePageSize]="rows().length <= 10" aria-label="Select page" />
    </section>
  `,
  styles: `
    :host { display: block; }
    .table-card { padding: 0; overflow: hidden; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 22px 12px; flex-wrap: wrap; }
    h3 { margin: 0; font-size: 15px; font-weight: 600; }
    header p { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
    .filter { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 38px; border-radius: 12px; background: var(--input-bg); border: 1px solid var(--glass-border); }
    .filter mat-icon { color: var(--text-muted); font-size: 18px; width: 18px; height: 18px; }
    .filter input { border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; width: 160px; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; background: transparent; }
    th.mat-mdc-header-cell { color: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; background: var(--surface); white-space: nowrap; }
    td.mat-mdc-cell { border-bottom-color: var(--glass-border); font-variant-numeric: tabular-nums; white-space: nowrap; }
    tr.mat-mdc-row:hover td { background: color-mix(in srgb, var(--primary) 6%, transparent); }
    .num { text-align: right; }
    .primary-text { font-weight: 500; }
    .sub { display: block; color: var(--text-muted); font-size: 11.5px; margin-top: 2px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
    .pos { color: var(--success); font-weight: 600; }
    .neg { color: var(--danger); font-weight: 600; }
    .progress { display: inline-block; width: 90px; height: 6px; border-radius: 6px; background: var(--glass-border); overflow: hidden; vertical-align: middle; margin-right: 8px; }
    .progress span { display: block; height: 100%; background: linear-gradient(90deg, var(--primary), var(--success)); border-radius: 6px; }
    .actions { width: 56px; text-align: right; }
    .no-data { padding: 48px 16px; text-align: center; color: var(--text-muted); }
    .no-data mat-icon { display: block; margin: 0 auto 8px; }
    mat-paginator { background: transparent; }
  `,
})
export class DataTable<T extends Entity> implements AfterViewInit {
  readonly title = input('Records');
  readonly rows = input.required<T[]>();
  readonly columns = input.required<ColumnConfig<T>[]>();
  readonly loading = input(false);
  readonly edit = output<T>();
  readonly remove = output<T>();

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);
  protected readonly dataSource = new MatTableDataSource<T>([]);
  protected readonly displayed = computed(() => [...this.columns().map((c) => c.key), '__actions']);
  private readonly filter = signal('');

  constructor() {
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.dataSource.filter = this.filter().trim().toLowerCase();
    });
    this.dataSource.sortingDataAccessor = (row, key) => {
      const col = this.columns().find((c) => c.key === key);
      const v = col ? this.valueOf(col, row) : (row as Record<string, unknown>)[key];
      return typeof v === 'number' ? v : String(v ?? '').toLowerCase();
    };
    this.dataSource.filterPredicate = (row, filter) =>
      this.columns().some((c) => String(this.valueOf(c, row) ?? '').toLowerCase().includes(filter));
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.paginator = this.paginator() ?? null;
  }

  protected applyFilter(value: string): void {
    this.filter.set(value);
  }

  protected valueOf(col: ColumnConfig<T>, row: T): unknown {
    return col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
  }

  protected isNumeric(col: ColumnConfig<T>): boolean {
    return ['currency', 'number', 'percent', 'pnl', 'pnl-pct'].includes(col.type ?? 'text');
  }

  protected inr = (v: unknown) => formatInr(Number(v ?? 0), false);
  protected num = (v: unknown) => formatNumber(Number(v ?? 0), 2);
  protected pctFmt = (v: unknown) => formatPct(Number(v ?? 0));
  protected date = (v: unknown) => formatDate(v as string);
  protected clamp = (v: unknown) => Math.max(0, Math.min(100, Number(v ?? 0)));
}
