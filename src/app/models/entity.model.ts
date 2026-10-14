export interface Entity {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  notes?: string;
}

export type NewEntity<T extends Entity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

export type CollectionName =
  | 'assets'
  | 'properties'
  | 'agricultureLands'
  | 'farms'
  | 'livestock'
  | 'lending'
  | 'stocks'
  | 'mutualFunds'
  | 'fixedDeposits'
  | 'insurance'
  | 'vehicles'
  | 'liabilities'
  | 'goals'
  | 'documents'
  | 'networthHistory';

export interface SelectOption {
  value: string;
  label: string;
}
