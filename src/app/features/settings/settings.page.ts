import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FirestoreDataStore } from '../../core/data/firestore-data-store';
import { ThemeService } from '../../core/theme/theme.service';
import { ProfileService } from '../../services/profile.service';
import { SeedDataService } from '../../services/seed-data.service';
import { ToastService } from '../../services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/dialogs/confirm-dialog';

@Component({
  selector: 'app-settings-page',
  imports: [PageHeader, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSlideToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Settings" subtitle="Profile, financial assumptions and data management" icon="tune" />

      <div class="grid">
        <section class="glass-card card">
          <h3><mat-icon>person</mat-icon> Profile & assumptions</h3>
          <p class="muted">Used for cash flow, health score, FIRE target and projections.</p>
          <form [formGroup]="form" (ngSubmit)="save()">
            <mat-form-field class="span-2">
              <mat-label>Display name</mat-label>
              <input matInput formControlName="displayName" maxlength="80" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Monthly active income</mat-label>
              <span matTextPrefix>₹&nbsp;</span>
              <input matInput type="number" formControlName="monthlyIncome" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Monthly living expenses</mat-label>
              <span matTextPrefix>₹&nbsp;</span>
              <input matInput type="number" formControlName="monthlyExpenses" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Safe withdrawal rate</mat-label>
              <input matInput type="number" step="0.1" formControlName="withdrawalRate" />
              <span matTextSuffix>%</span>
            </mat-form-field>
            <mat-form-field>
              <mat-label>Expected return</mat-label>
              <input matInput type="number" step="0.5" formControlName="expectedReturn" />
              <span matTextSuffix>%</span>
            </mat-form-field>
            <mat-form-field>
              <mat-label>Inflation</mat-label>
              <input matInput type="number" step="0.5" formControlName="inflation" />
              <span matTextSuffix>%</span>
            </mat-form-field>
            <div class="actions span-2">
              <button mat-flat-button type="submit" [disabled]="form.invalid || form.pristine"><mat-icon>save</mat-icon>Save</button>
            </div>
          </form>
        </section>

        <div class="stack">
          <section class="glass-card card">
            <h3><mat-icon>palette</mat-icon> Appearance</h3>
            <mat-slide-toggle [checked]="theme.mode() === 'dark'" (change)="theme.toggle()">Dark mode</mat-slide-toggle>
          </section>

          <section class="glass-card card">
            <h3><mat-icon>storage</mat-icon> Data</h3>
            <p class="muted">
              Signed in as <strong>{{ auth.user()?.email }}</strong>
              {{ auth.user()?.demo ? '(demo workspace stored in this browser)' : '(synced to Firestore)' }}
            </p>
            <div class="buttons">
              <button mat-stroked-button (click)="checkConnection()" [disabled]="busy() || checkingConnection() || auth.user()?.demo">
                <mat-icon>{{ connectionState() === 'connected' ? 'cloud_done' : 'cloud_sync' }}</mat-icon>
                {{ checkingConnection() ? 'Checking Firestore…' : 'Test Firestore connection' }}
              </button>
              <p class="connection" [class.connected]="connectionState() === 'connected'" [class.failed]="connectionState() === 'failed'" role="status">
                @if (connectionState() === 'connected') {
                  Firestore connection verified for this account.
                } @else if (connectionState() === 'failed') {
                  Firestore connection failed. Check your network, sign-in and Firestore rules.
                } @else if (auth.user()?.demo) {
                  Demo data is stored only in this browser.
                } @else {
                  Test the live Firestore connection for this account.
                }
              </p>
              <button mat-stroked-button (click)="loadSample()" [disabled]="busy()">
                <mat-icon>auto_awesome</mat-icon>{{ auth.user()?.demo ? 'Load demo sample data' : 'Load Firestore sample data' }}
              </button>
              <button mat-stroked-button (click)="exportData()"><mat-icon>download</mat-icon>Export JSON backup</button>
              <button mat-stroked-button class="danger" (click)="clearAll()" [disabled]="busy()"><mat-icon>delete_forever</mat-icon>Delete all records</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 20px; align-items: start; }
    .stack { display: flex; flex-direction: column; gap: 20px; }
    .card { padding: 24px; }
    h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 6px; font-size: 16px; mat-icon { color: var(--primary); } }
    .muted { margin: 0 0 18px; font-size: 13px; }
    form { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; }
    .span-2 { grid-column: 1 / -1; }
    mat-form-field { width: 100%; }
    .actions { display: flex; justify-content: flex-end; }
    .buttons { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
    .connection { margin: 0; font-size: 13px; color: var(--text-muted); }
    .connection.connected { color: var(--success, #00c48c); }
    .connection.failed { color: var(--danger); }
    .danger { color: var(--danger) !important; border-color: color-mix(in srgb, var(--danger) 40%, transparent) !important; }
    @media (max-width: 960px) { .grid { grid-template-columns: 1fr; } }
    @media (max-width: 560px) { form { grid-template-columns: 1fr; } }
  `,
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly profile = inject(ProfileService);
  private readonly seed = inject(SeedDataService);
  private readonly firestore = inject(FirestoreDataStore);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  protected readonly busy = signal(false);
  protected readonly checkingConnection = signal(false);
  protected readonly connectionState = signal<'unknown' | 'connected' | 'failed'>('unknown');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.maxLength(80)]],
    monthlyIncome: [0, [Validators.required, Validators.min(0)]],
    monthlyExpenses: [0, [Validators.required, Validators.min(0)]],
    withdrawalRate: [4, [Validators.required, Validators.min(1), Validators.max(10)]],
    expectedReturn: [11, [Validators.required, Validators.min(0), Validators.max(30)]],
    inflation: [6, [Validators.required, Validators.min(0), Validators.max(20)]],
  });

  constructor() {
    effect(() => {
      const p = this.profile.profile();
      if (this.form.pristine) {
        this.form.patchValue(p, { emitEvent: false });
      }
    });
  }

  protected async save(): Promise<void> {
    try {
      await this.profile.save(this.form.getRawValue());
      this.form.markAsPristine();
      this.toast.success('Settings saved');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  protected async loadSample(): Promise<void> {
    const demo = this.auth.user()?.demo;
    const destination = demo ? 'this browser demo' : 'your signed-in Firestore account';
    if (!(await this.confirm('Load sample data?', `Existing records in each module in ${destination} will be replaced with the sample portfolio.`, 'Load'))) return;
    await this.busyRun(
      () => this.seed.loadSampleData(),
      demo ? 'Demo sample portfolio loaded' : 'Sample portfolio saved to Firestore',
    );
    this.form.markAsPristine();
  }

  protected async clearAll(): Promise<void> {
    if (!(await this.confirm('Delete all records?', 'Every asset, liability, goal and history snapshot will be permanently deleted.', 'Delete all', true))) return;
    await this.busyRun(() => this.seed.clearAll(), 'All records deleted');
  }

  protected async checkConnection(): Promise<void> {
    const user = this.auth.user();
    if (!user || user.demo) return;

    this.checkingConnection.set(true);
    this.connectionState.set('unknown');
    try {
      await this.firestore.checkConnection(this.auth.userPath(user));
      this.connectionState.set('connected');
      this.toast.success('Firestore connection verified');
    } catch (err) {
      this.connectionState.set('failed');
      this.toast.error(err instanceof Error ? err.message : 'Firestore connection failed');
    } finally {
      this.checkingConnection.set(false);
    }
  }

  protected exportData(): void {
    const blob = new Blob([this.seed.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private confirm(title: string, message: string, confirmText: string, danger = false): Promise<boolean | undefined> {
    return firstValueFrom(
      this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: { title, message, confirmText, danger }, width: '440px' }).afterClosed(),
    );
  }

  private async busyRun(action: () => Promise<void>, success: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      this.toast.success(success);
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      this.busy.set(false);
    }
  }
}
