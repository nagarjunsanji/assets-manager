import { inject, Injectable } from '@angular/core';
import { PortfolioService } from './portfolio.service';
import { ProfileService } from './profile.service';
import { DocumentRepositoryService } from './repositories/repositories';

@Injectable({ providedIn: 'root' })
export class PortfolioBackupService {
  private readonly p = inject(PortfolioService);
  private readonly profile = inject(ProfileService);
  private readonly documents = inject(DocumentRepositoryService);

  exportJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        profile: this.profile.profile(),
        ...this.p.data(),
        documents: this.documents.items().map(({ url: _url, ...rest }) => rest),
        networthHistory: this.p.history.items(),
      },
      null,
      2,
    );
  }
}
