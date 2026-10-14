import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../theme/theme.service';
import { NotificationService } from '../../services/notification.service';
import { PortfolioService } from '../../services/portfolio.service';
import { SearchResult, SearchService } from '../../services/search.service';
import { CountUp } from '../../shared/components/count-up';
import { NAVIGATION } from './navigation';

const COLLAPSE_KEY = 'asset-manager.sidebar-collapsed';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatIconModule, MatButtonModule, MatTooltipModule,
    MatMenuModule, MatBadgeModule, MatAutocompleteModule, MatDividerModule, CountUp,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationService);
  protected readonly portfolio = inject(PortfolioService);
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);

  protected readonly nav = NAVIGATION;
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver).observe('(max-width: 1023px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  protected readonly collapsed = signal(localStorage.getItem(COLLAPSE_KEY) === '1');
  protected readonly mobileOpen = signal(false);
  protected readonly query = signal('');
  protected readonly results = computed<SearchResult[]>(() => this.searchService.search(this.query()));
  protected readonly user = this.auth.user;
  protected readonly initials = computed(() =>
    (this.user()?.displayName ?? 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
  );

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.mobileOpen.set(false));
  }

  protected toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileOpen.update((v) => !v);
      return;
    }
    this.collapsed.update((v) => !v);
    localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
  }

  protected onSearchInput(value: string): void {
    this.query.set(value);
  }

  protected onSearchSelect(event: MatAutocompleteSelectedEvent, input: HTMLInputElement): void {
    const result = event.option.value as SearchResult;
    input.value = '';
    this.query.set('');
    this.router.navigateByUrl(result.route);
  }

  protected displayNothing = () => '';

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
