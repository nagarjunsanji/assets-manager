import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { Entity } from '../../models/entity.model';
import { BaseRepository } from '../../services/repositories/base-repository';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialog, ConfirmDialogData } from '../dialogs/confirm-dialog';
import { EntityFormDialog, EntityFormDialogData, FieldConfig } from '../dialogs/entity-form-dialog';
import { ColumnConfig, DataTable } from './data-table';
import { PageHeader } from './page-header';

/** Reusable CRUD page shell: header, KPI slot, chart slot, data table and dialogs. */
@Component({
  selector: 'app-entity-page',
  imports: [PageHeader, DataTable, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header [title]="title()" [subtitle]="subtitle()" [icon]="icon()">
        <ng-content select="[headerActions]" />
        <button mat-flat-button (click)="externalForms() ? addRequested.emit() : add()">
          <mat-icon>add</mat-icon>
          Add {{ entityLabel() }}
        </button>
      </app-page-header>

      <div class="kpi-grid stagger"><ng-content select="[kpis]" /></div>
      <ng-content select="[charts]" />
      <ng-content />

      <app-data-table
        [title]="tableTitle()"
        [rows]="tableRows()"
        [columns]="columns()"
        [loading]="!repo().loaded()"
        [rowClickEnabled]="rowClickEnabled()"
        (edit)="externalForms() ? editRequested.emit($event) : edit($event)"
        (remove)="remove($event)"
        (rowClick)="rowClick.emit($event)"
      />
    </div>
  `,
})
export class EntityPage<T extends Entity> {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly icon = input('folder');
  readonly entityLabel = input.required<string>();
  readonly repo = input.required<BaseRepository<T>>();
  readonly fields = input.required<FieldConfig[]>();
  readonly columns = input.required<ColumnConfig<T>[]>();
  readonly rowClickEnabled = input(false);
  readonly externalForms = input(false);
  readonly rowClick = output<T>();
  readonly addRequested = output<void>();
  readonly editRequested = output<T>();
  readonly rows = input<T[] | null>(null);
  readonly tableTitle = input('All records');

  protected readonly tableRows = computed(() => this.rows() ?? this.repo().items());

  async add(): Promise<void> {
    const value = await this.openForm(`Add ${this.entityLabel()}`, null);
    if (!value) return;
    await this.run(() => this.repo().create(value as Partial<T>), `${this.entityLabel()} added`);
  }

  async edit(row: T): Promise<void> {
    const value = await this.openForm(`Edit ${this.entityLabel()}`, row as unknown as Record<string, unknown>);
    if (!value) return;
    await this.run(() => this.repo().update(row.id, value as Partial<T>), `${this.entityLabel()} updated`);
  }

  async remove(row: T): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: { title: `Delete ${this.entityLabel()}?`, message: 'This action cannot be undone.', confirmText: 'Delete', danger: true },
          width: '420px',
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.run(() => this.repo().delete(row.id), `${this.entityLabel()} deleted`);
  }

  private openForm(title: string, value: Record<string, unknown> | null): Promise<Record<string, unknown> | undefined> {
    return firstValueFrom(
      this.dialog
        .open<EntityFormDialog, EntityFormDialogData, Record<string, unknown>>(EntityFormDialog, {
          data: { title, icon: this.icon(), fields: this.fields(), value },
          width: '720px',
          maxWidth: '96vw',
          autoFocus: 'first-tabbable',
        })
        .afterClosed(),
    );
  }

  private async run(action: () => Promise<unknown>, success: string): Promise<void> {
    try {
      await action();
      this.toast.success(success);
    } catch (err) {
      console.error(err);
      this.toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  }
}
