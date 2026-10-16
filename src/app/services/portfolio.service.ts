import { computed, effect, inject, Injectable } from '@angular/core';
import { NetWorthSnapshot } from '../models/wealth.models';
import { periodKey } from '../utilities/format';
import { computeSummary, PortfolioData } from '../utilities/portfolio';
import { ProfileService } from './profile.service';
import {
  AgricultureLandRepositoryService, FixedDepositRepositoryService, GoalRepositoryService,
  InsuranceRepositoryService, LendingRepositoryService, LiabilityRepositoryService, LivestockRepositoryService,
  MutualFundRepositoryService, NetWorthHistoryRepositoryService, OtherAssetRepositoryService, PropertyRepositoryService,
  StockRepositoryService, VehicleRepositoryService,
} from './repositories/repositories';

/** Aggregates every repository into reactive portfolio analytics. */
@Injectable({ providedIn: 'root' })
export class PortfolioService {
  readonly properties = inject(PropertyRepositoryService);
  readonly agricultureLands = inject(AgricultureLandRepositoryService);
  readonly livestock = inject(LivestockRepositoryService);
  readonly lending = inject(LendingRepositoryService);
  readonly stocks = inject(StockRepositoryService);
  readonly mutualFunds = inject(MutualFundRepositoryService);
  readonly fixedDeposits = inject(FixedDepositRepositoryService);
  readonly assets = inject(OtherAssetRepositoryService);
  readonly insurance = inject(InsuranceRepositoryService);
  readonly vehicles = inject(VehicleRepositoryService);
  readonly liabilities = inject(LiabilityRepositoryService);
  readonly goals = inject(GoalRepositoryService);
  readonly history = inject(NetWorthHistoryRepositoryService);
  private readonly profileService = inject(ProfileService);

  private readonly repos = [
    this.properties, this.agricultureLands, this.livestock, this.lending, this.stocks, this.mutualFunds,
    this.fixedDeposits, this.assets, this.insurance, this.vehicles, this.liabilities, this.goals,
  ];

  readonly profile = this.profileService.profile;
  readonly loaded = computed(() => this.repos.every((r) => r.loaded()));
  readonly isEmpty = computed(() => this.repos.every((r) => r.count() === 0));

  readonly data = computed<PortfolioData>(() => ({
    properties: this.properties.items(),
    agricultureLands: this.agricultureLands.items(),
    livestock: this.livestock.items(),
    lending: this.lending.items(),
    stocks: this.stocks.items(),
    mutualFunds: this.mutualFunds.items(),
    fixedDeposits: this.fixedDeposits.items(),
    assets: this.assets.items(),
    insurance: this.insurance.items(),
    vehicles: this.vehicles.items(),
    liabilities: this.liabilities.items(),
    goals: this.goals.items(),
  }));

  readonly summary = computed(() => computeSummary(this.data(), this.profile()));

  readonly sortedHistory = computed<NetWorthSnapshot[]>(() =>
    [...this.history.items()].sort((a, b) => a.period.localeCompare(b.period)),
  );

  /** Month-over-month net worth change in % */
  readonly netWorthChange = computed(() => {
    const h = this.sortedHistory();
    const current = this.summary().netWorth;
    const prev = h.filter((s) => s.period < periodKey()).at(-1);
    return prev?.netWorth ? ((current - prev.netWorth) / Math.abs(prev.netWorth)) * 100 : null;
  });

  constructor() {
    // Keep a monthly snapshot in networthHistory for trend charts.
    effect((onCleanup) => {
      if (!this.loaded() || !this.history.loaded() || this.isEmpty()) return;
      const s = this.summary();
      const period = periodKey();
      const existing = this.history.items().find((h) => h.id === period);
      if (existing && Math.abs(existing.netWorth - s.netWorth) < 1 && Math.abs(existing.passiveIncome - s.passiveIncome) < 1) return;

      const timer = setTimeout(() => {
        const snapshot: Partial<NetWorthSnapshot> = {
          period,
          totalAssets: Math.round(s.totalAssets),
          totalLiabilities: Math.round(s.totalLiabilities),
          netWorth: Math.round(s.netWorth),
          passiveIncome: Math.round(s.passiveIncome),
          cashflow: Math.round(s.monthlyCashflow),
          breakdown: Object.fromEntries(s.assetClasses.map((c) => [c.key, Math.round(c.value)])),
        };
        this.history.upsert(period, snapshot).catch((err) => console.error('Snapshot failed', err));
      }, 2500);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
