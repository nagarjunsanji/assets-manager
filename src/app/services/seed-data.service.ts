import { inject, Injectable } from '@angular/core';
import { DEFAULT_PROFILE } from '../models/user.model';
import { buildSeedData, buildSeedHistory } from '../utilities/seed-data';
import { PortfolioService } from './portfolio.service';
import { ProfileService } from './profile.service';
import { DocumentRepositoryService } from './repositories/repositories';

@Injectable({ providedIn: 'root' })
export class SeedDataService {
  private readonly p = inject(PortfolioService);
  private readonly profile = inject(ProfileService);
  private readonly documents = inject(DocumentRepositoryService);

  async loadSampleData(): Promise<void> {
    const data = buildSeedData();
    await Promise.all([
      this.p.properties.replaceAll(data.properties),
      this.p.agricultureLands.replaceAll(data.agricultureLands),
      this.p.farms.replaceAll(data.farms),
      this.p.livestock.replaceAll(data.livestock),
      this.p.lending.replaceAll(data.lending),
      this.p.stocks.replaceAll(data.stocks),
      this.p.mutualFunds.replaceAll(data.mutualFunds),
      this.p.fixedDeposits.replaceAll(data.fixedDeposits),
      this.p.assets.replaceAll(data.assets),
      this.p.insurance.replaceAll(data.insurance),
      this.p.vehicles.replaceAll(data.vehicles),
      this.p.liabilities.replaceAll(data.liabilities),
      this.p.goals.replaceAll(data.goals),
      this.p.history.replaceAll(buildSeedHistory(data)),
    ]);
    await this.profile.save({ ...DEFAULT_PROFILE, displayName: this.profile.profile().displayName, email: this.profile.profile().email });
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.p.properties.clear(), this.p.agricultureLands.clear(), this.p.farms.clear(), this.p.livestock.clear(),
      this.p.lending.clear(), this.p.stocks.clear(), this.p.mutualFunds.clear(), this.p.fixedDeposits.clear(),
      this.p.assets.clear(), this.p.insurance.clear(), this.p.vehicles.clear(), this.p.liabilities.clear(),
      this.p.goals.clear(), this.p.history.clear(),
    ]);
  }

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
