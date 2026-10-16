import { Injectable } from '@angular/core';
import {
  AgricultureLand, FixedDeposit, Goal, Insurance, Lending, Liability, Livestock, MutualFund, NetWorthSnapshot,
  OtherAsset, Property, Stock, Vehicle, VaultDocument,
} from '../../models/wealth.models';
import { BaseRepository } from './base-repository';

@Injectable({ providedIn: 'root' })
export class PropertyRepositoryService extends BaseRepository<Property> {
  constructor() { super('properties'); }
}

@Injectable({ providedIn: 'root' })
export class AgricultureLandRepositoryService extends BaseRepository<AgricultureLand> {
  constructor() { super('agricultureLands'); }
}

@Injectable({ providedIn: 'root' })
export class LivestockRepositoryService extends BaseRepository<Livestock> {
  constructor() { super('livestock'); }
}

@Injectable({ providedIn: 'root' })
export class LendingRepositoryService extends BaseRepository<Lending> {
  constructor() { super('lending'); }
}

@Injectable({ providedIn: 'root' })
export class StockRepositoryService extends BaseRepository<Stock> {
  constructor() { super('stocks'); }
}

@Injectable({ providedIn: 'root' })
export class MutualFundRepositoryService extends BaseRepository<MutualFund> {
  constructor() { super('mutualFunds'); }
}

@Injectable({ providedIn: 'root' })
export class FixedDepositRepositoryService extends BaseRepository<FixedDeposit> {
  constructor() { super('fixedDeposits'); }
}

@Injectable({ providedIn: 'root' })
export class OtherAssetRepositoryService extends BaseRepository<OtherAsset> {
  constructor() { super('assets'); }
}

@Injectable({ providedIn: 'root' })
export class InsuranceRepositoryService extends BaseRepository<Insurance> {
  constructor() { super('insurance'); }
}

@Injectable({ providedIn: 'root' })
export class VehicleRepositoryService extends BaseRepository<Vehicle> {
  constructor() { super('vehicles'); }
}

@Injectable({ providedIn: 'root' })
export class LiabilityRepositoryService extends BaseRepository<Liability> {
  constructor() { super('liabilities'); }
}

@Injectable({ providedIn: 'root' })
export class GoalRepositoryService extends BaseRepository<Goal> {
  constructor() { super('goals'); }
}

@Injectable({ providedIn: 'root' })
export class DocumentRepositoryService extends BaseRepository<VaultDocument> {
  constructor() { super('documents'); }
}

@Injectable({ providedIn: 'root' })
export class NetWorthHistoryRepositoryService extends BaseRepository<NetWorthSnapshot> {
  constructor() { super('networthHistory'); }
}
