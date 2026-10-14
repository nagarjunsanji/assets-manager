import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-page-header',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="title-wrap">
        <span class="title-icon"><mat-icon>{{ icon() }}</mat-icon></span>
        <div>
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .page-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .title-wrap { display: flex; align-items: center; gap: 14px; }
    .title-icon {
      width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; color: #fff;
      background: linear-gradient(135deg, var(--primary), #7B5CFF); box-shadow: 0 8px 24px rgba(79, 140, 255, .35);
    }
    h1 { margin: 0; font-size: clamp(20px, 2.4vw, 26px); font-weight: 700; letter-spacing: -0.02em; }
    p { margin: 4px 0 0; color: var(--text-muted); font-size: 14px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly icon = input('dashboard');
}
