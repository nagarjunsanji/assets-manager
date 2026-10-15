export interface UserProfile {
  displayName: string;
  email: string;
  currency: 'INR';
  monthlyIncome: number;
  monthlyExpenses: number;
  spouseName?: string;
  childrenNames?: string[];
  /** Safe withdrawal rate % used for the FIRE target */
  withdrawalRate: number;
  expectedReturn: number;
  inflation: number;
  updatedAt?: number;
}

export const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  email: '',
  currency: 'INR',
  monthlyIncome: 450000,
  monthlyExpenses: 300000,
  withdrawalRate: 4,
  expectedReturn: 11,
  inflation: 6,
};

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  provider: string;
}
