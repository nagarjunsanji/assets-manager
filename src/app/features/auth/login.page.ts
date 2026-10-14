import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService, authErrorMessage } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

type Mode = 'signin' | 'register' | 'reset';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly returnUrl = input<string>('/dashboard');

  protected readonly mode = signal<Mode>('signin');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly info = signal('');
  protected readonly hidePassword = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly highlights = [
    { icon: 'account_balance', text: 'Stocks, MFs, FDs, gold, EPF/PPF/NPS & crypto' },
    { icon: 'agriculture', text: 'Properties, agri-lands, farms & livestock' },
    { icon: 'handshake', text: 'Private lending with flat, reducing & bullet interest' },
    { icon: 'local_fire_department', text: 'FIRE tracking & wealth projection simulator' },
  ];

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set('');
    this.info.set('');
    const pw = this.form.controls.password;
    pw.setValidators(mode === 'reset' ? [] : [Validators.required, Validators.minLength(6)]);
    pw.updateValueAndValidity();
    const name = this.form.controls.name;
    name.setValidators(mode === 'register' ? [Validators.required] : []);
    name.updateValueAndValidity();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    await this.run(async () => {
      if (this.mode() === 'register') await this.auth.register(name.trim(), email.trim(), password);
      else if (this.mode() === 'reset') {
        await this.auth.resetPassword(email.trim());
        this.info.set('Password reset email sent. Check your inbox.');
        return false;
      } else await this.auth.signInWithEmail(email.trim(), password);
      return true;
    });
  }

  protected google(): Promise<void> {
    return this.run(async () => (await this.auth.signInWithGoogle(), true));
  }

  protected microsoft(): Promise<void> {
    return this.run(async () => (await this.auth.signInWithMicrosoft(), true));
  }

  protected demo(): Promise<void> {
    return this.run(async () => (this.auth.startDemo(), true));
  }

  private async run(action: () => Promise<boolean>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      if (await action()) await this.router.navigateByUrl(this.safeReturnUrl());
    } catch (err) {
      this.error.set(authErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  /** Only allow in-app relative redirects (prevents open redirects). */
  private safeReturnUrl(): string {
    const url = this.returnUrl() || '/dashboard';
    return url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard';
  }
}
