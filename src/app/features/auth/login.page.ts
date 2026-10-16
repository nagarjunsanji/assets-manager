import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService, authErrorMessage } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-login-page',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>('/dashboard');

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly pending = signal(false);

  protected readonly highlights = [
    { icon: 'account_balance', text: 'Stocks, MFs, FDs, gold, EPF/PPF/NPS & crypto' },
    { icon: 'agriculture', text: 'Properties, agri-lands & livestock' },
    { icon: 'handshake', text: 'Private lending with flat, reducing & bullet interest' },
    { icon: 'local_fire_department', text: 'FIRE tracking & wealth projection simulator' },
  ];

  protected google(): Promise<void> {
    return this.run(async () => (await this.auth.signInWithGoogle(), true));
  }

  private async run(action: () => Promise<boolean>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.pending.set(false);
    try {
      if (await action()) await this.router.navigateByUrl(this.safeReturnUrl());
    } catch (err) {
      const message = authErrorMessage(err);
      if (message.includes('pending approval')) this.pending.set(true);
      else this.error.set(message);
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
