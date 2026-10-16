import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SelectOption } from '../../models/entity.model';

export type FieldType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'select' | 'textarea' | 'toggle' | 'tel' | 'email';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly (string | SelectOption | { value: number; label: string })[];
  min?: number;
  max?: number;
  pattern?: string;
  hint?: string;
  placeholder?: string;
  /** Number of grid columns to span (1 or 2). */
  span?: 1 | 2;
  section?: string;
  defaultValue?: unknown;
}

export interface EntityFormDialogData {
  title: string;
  icon?: string;
  fields: FieldConfig[];
  value?: Record<string, unknown> | null;
}

interface FieldView extends FieldConfig {
  opts: Array<SelectOption | { value: number; label: string }>;
  showSection: boolean;
}

/** Generic, config-driven create/edit dialog. */
@Component({
  selector: 'app-entity-form-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatButtonModule, MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dlg-title">
      <span class="dlg-icon"><mat-icon>{{ data.icon ?? 'edit' }}</mat-icon></span>
      {{ data.title }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          @for (f of fields(); track f.key) {
            @if (f.showSection) {
              <h4 class="section">{{ f.section }}</h4>
            }
            <div class="cell" [class.span-2]="f.span === 2 || f.type === 'textarea'">
              @switch (f.type) {
                @case ('select') {
                  <mat-form-field appearance="outline">
                    <mat-label>{{ f.label }}</mat-label>
                    <mat-select [formControlName]="f.key">
                      @for (o of f.opts; track o.value) {
                        <mat-option [value]="o.value">{{ o.label }}</mat-option>
                      }
                    </mat-select>
                    @if (f.hint) { <mat-hint>{{ f.hint }}</mat-hint> }
                    <mat-error>{{ errorFor(f) }}</mat-error>
                  </mat-form-field>
                }
                @case ('toggle') {
                  <mat-slide-toggle [formControlName]="f.key" class="toggle">{{ f.label }}</mat-slide-toggle>
                }
                @case ('textarea') {
                  <mat-form-field appearance="outline">
                    <mat-label>{{ f.label }}</mat-label>
                    <textarea matInput rows="3" [formControlName]="f.key" [placeholder]="f.placeholder ?? ''"></textarea>
                    <mat-error>{{ errorFor(f) }}</mat-error>
                  </mat-form-field>
                }
                @default {
                  <mat-form-field appearance="outline">
                    <mat-label>{{ f.label }}</mat-label>
                    @if (f.type === 'currency') { <span matTextPrefix>₹&nbsp;</span> }
                    <input
                      matInput
                      [type]="inputType(f)"
                      [formControlName]="f.key"
                      [placeholder]="f.placeholder ?? ''"
                      [attr.min]="f.min ?? null"
                      [attr.max]="f.max ?? null"
                      [attr.step]="f.type === 'number' || f.type === 'currency' || f.type === 'percent' ? 'any' : null"
                    />
                    @if (f.type === 'percent') { <span matTextSuffix>%</span> }
                    @if (f.hint) { <mat-hint>{{ f.hint }}</mat-hint> }
                    <mat-error>{{ errorFor(f) }}</mat-error>
                  </mat-form-field>
                }
              }
            </div>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit">
          <mat-icon>check</mat-icon>
          Save
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .dlg-title { display: flex; align-items: center; gap: 12px; }
    .dlg-icon { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; background: color-mix(in srgb, var(--primary) 18%, transparent); color: var(--primary); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; row-gap: 8px; padding-top: 8px; }
    .cell.span-2, .section { grid-column: 1 / -1; }
    .section { margin: 8px 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); font-weight: 600; }
    mat-form-field { width: 100%; }
    .toggle { display: flex; min-height: 56px; align-items: center; }
    @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
  `,
})
export class EntityFormDialog {
  protected readonly data = inject<EntityFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<EntityFormDialog, Record<string, unknown>>);

  protected readonly form = new FormGroup<Record<string, FormControl>>({});

  protected readonly fields = computed<FieldView[]>(() => {
    let lastSection: string | undefined;
    return this.data.fields.map((f) => {
      const showSection = !!f.section && f.section !== lastSection;
      if (f.section) lastSection = f.section;
      return {
        ...f,
        showSection,
        opts: (f.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
      };
    });
  });

  constructor() {
    const value = this.data.value ?? {};
    for (const f of this.data.fields) {
      const initial = value[f.key] ?? f.defaultValue ?? (f.type === 'toggle' ? false : null);
      this.form.addControl(f.key, new FormControl(initial, this.validators(f)));
    }
  }

  protected inputType(f: FieldConfig): string {
    switch (f.type) {
      case 'currency':
      case 'percent':
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'tel':
        return 'tel';
      case 'email':
        return 'email';
      default:
        return 'text';
    }
  }

  protected errorFor(f: FieldConfig): string {
    const c = this.form.controls[f.key];
    if (c?.hasError('required')) return `${f.label} is required`;
    if (c?.hasError('min')) return `Minimum is ${f.min}`;
    if (c?.hasError('max')) return `Maximum is ${f.max}`;
    if (c?.hasError('pattern')) return `Invalid ${f.label.toLowerCase()}`;
    if (c?.hasError('email')) return 'Invalid email address';
    return '';
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const out: Record<string, unknown> = {};
    for (const f of this.data.fields) {
      let v = this.form.controls[f.key].value;
      if (['number', 'currency', 'percent'].includes(f.type)) v = v === null || v === '' ? 0 : Number(v);
      else if (typeof v === 'string') v = v.trim();
      if (v !== null && v !== '') out[f.key] = v;
    }
    this.ref.close(out);
  }

  private validators(f: FieldConfig): ValidatorFn[] {
    const v: ValidatorFn[] = [];
    if (f.required) v.push(Validators.required);
    if (f.min !== undefined) v.push(Validators.min(f.min));
    if (f.max !== undefined) v.push(Validators.max(f.max));
    if (f.pattern) v.push(Validators.pattern(f.pattern));
    if (f.type === 'email') v.push(Validators.email);
    if (['currency', 'number'].includes(f.type) && f.min === undefined) v.push(Validators.min(0));
    return v;
  }
}
