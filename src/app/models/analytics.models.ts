export interface AssetClassValue {
  key: string;
  label: string;
  value: number;
  invested: number;
  color: string;
}

export interface LabeledValue {
  label: string;
  value: number;
}

export interface HealthFactor {
  label: string;
  score: number;
  max: number;
  hint: string;
}

export interface FireStatus {
  target: number;
  progress: number;
  gap: number;
  monthsToFire: number | null;
  estimatedDate: Date | null;
  monthlyInvestment: number;
}

export interface PortfolioSummary {
  assetClasses: AssetClassValue[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  investedCapital: number;
  investmentValue: number;
  investmentReturn: number;
  investmentReturnPct: number;
  passiveIncome: number;
  incomeSources: LabeledValue[];
  monthlyEmi: number;
  monthlyPremiums: number;
  monthlyExpenses: number;
  monthlyIncome: number;
  monthlyCashflow: number;
  savingsRate: number;
  liquidAssets: number;
  emergencyMonths: number;
  debtToAsset: number;
  healthScore: number;
  healthFactors: HealthFactor[];
  fire: FireStatus;
}

export interface AppNotification {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  icon: string;
  cashflow?: 'credit' | 'debit';
  title: string;
  message: string;
  date: string;
  route: string;
}
