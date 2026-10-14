import { AssetClassValue, HealthFactor, LabeledValue, PortfolioSummary } from '../models/analytics.models';
import { UserProfile } from '../models/user.model';
import {
  AgricultureLand, Farm, FixedDeposit, Goal, Insurance, Lending, Liability, Livestock, MutualFund, OtherAsset, Property, Stock, Vehicle,
} from '../models/wealth.models';
import { fdMetrics, lendingMetrics, livestockMetrics, monthsToTarget, pct, premiumMonthly, sum } from './finance';

export interface PortfolioData {
  properties: Property[];
  agricultureLands: AgricultureLand[];
  farms: Farm[];
  livestock: Livestock[];
  lending: Lending[];
  stocks: Stock[];
  mutualFunds: MutualFund[];
  fixedDeposits: FixedDeposit[];
  assets: OtherAsset[];
  insurance: Insurance[];
  vehicles: Vehicle[];
  liabilities: Liability[];
  goals: Goal[];
}

export const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: '#4F8CFF',
  mutualFunds: '#9B6BFF',
  fixedIncome: '#00C48C',
  metals: '#F5B942',
  crypto: '#FF7A45',
  realEstate: '#22D3EE',
  agriculture: '#7BD88F',
  livestock: '#E879F9',
  machinery: '#94A3B8',
  lending: '#FFB020',
};

const FIXED_INCOME = new Set(['Bond', 'Savings Account', 'EPF', 'PPF', 'NPS', 'Cash']);
const METALS = new Set(['Gold', 'Silver']);
const MACHINERY = new Set(['Machinery', 'Farm Equipment']);
const LIQUID = new Set(['Savings Account', 'Cash']);

export function computeSummary(d: PortfolioData, profile: UserProfile, asOf: Date = new Date()): PortfolioSummary {
  const otherBy = (pred: (a: OtherAsset) => boolean) => d.assets.filter(pred);
  const fd = d.fixedDeposits.map((f) => ({ f, m: fdMetrics(f, asOf) }));
  const lend = d.lending.map((l) => ({ l, m: lendingMetrics(l, asOf) }));

  const cls = (key: string, label: string, value: number, invested: number): AssetClassValue => ({
    key, label, value, invested, color: ASSET_CLASS_COLORS[key],
  });

  const fixedOthers = otherBy((a) => FIXED_INCOME.has(a.category));
  const metals = otherBy((a) => METALS.has(a.category));
  const crypto = otherBy((a) => a.category === 'Crypto');
  const machinery = otherBy((a) => MACHINERY.has(a.category));
  const receivables = otherBy((a) => a.category === 'Receivable');

  const assetClasses: AssetClassValue[] = [
    cls('equity', 'Stocks', sum(d.stocks, (s) => s.quantity * s.currentPrice), sum(d.stocks, (s) => s.quantity * s.purchasePrice)),
    cls('mutualFunds', 'Mutual Funds', sum(d.mutualFunds, (f) => f.units * f.currentNav), sum(d.mutualFunds, (f) => f.units * f.averageNav)),
    cls(
      'fixedIncome',
      'Fixed Income',
      sum(fd, (x) => x.m.currentValue) + sum(fixedOthers, (a) => a.currentValue),
      sum(d.fixedDeposits, (f) => f.principal) + sum(fixedOthers, (a) => a.investedValue),
    ),
    cls('metals', 'Gold & Silver', sum(metals, (a) => a.currentValue), sum(metals, (a) => a.investedValue)),
    cls('crypto', 'Crypto', sum(crypto, (a) => a.currentValue), sum(crypto, (a) => a.investedValue)),
    cls('realEstate', 'Real Estate', sum(d.properties, (p) => p.currentValue), sum(d.properties, (p) => p.purchaseCost)),
    cls(
      'agriculture',
      'Agriculture',
      sum(d.agricultureLands, (l) => l.marketValue) + sum(d.farms, (f) => f.infrastructureValue),
      sum(d.agricultureLands, (l) => l.purchaseValue) + sum(d.farms, (f) => f.infrastructureValue),
    ),
    cls('livestock', 'Livestock', sum(d.livestock, (l) => l.currentValue), sum(d.livestock, (l) => l.purchaseValue)),
    cls(
      'machinery',
      'Vehicles & Machinery',
      sum(d.vehicles, (v) => v.currentValue) + sum(machinery, (a) => a.currentValue),
      sum(d.vehicles, (v) => v.purchaseCost) + sum(machinery, (a) => a.investedValue),
    ),
    cls(
      'lending',
      'Lending & Receivables',
      sum(lend, (x) => x.m.outstanding) + sum(receivables, (a) => a.currentValue),
      sum(d.lending.filter((l) => l.status !== 'Closed'), (l) => l.principal) + sum(receivables, (a) => a.investedValue),
    ),
  ];

  const totalAssets = sum(assetClasses, (c) => c.value);
  const totalLiabilities = sum(d.liabilities, (l) => l.outstanding);
  const netWorth = totalAssets - totalLiabilities;

  const investmentKeys = new Set(['equity', 'mutualFunds', 'fixedIncome', 'metals', 'crypto']);
  const investments = assetClasses.filter((c) => investmentKeys.has(c.key));
  const investedCapital = sum(investments, (c) => c.invested);
  const investmentValue = sum(investments, (c) => c.value);

  const livestockProfit = sum(d.livestock, (l) => livestockMetrics(l).monthlyProfit);
  const incomeSources: LabeledValue[] = [
    { label: 'Rental Income', value: sum(d.properties, (p) => p.monthlyRent) },
    { label: 'Lending Interest', value: sum(lend, (x) => x.m.monthlyIncome) },
    { label: 'FD Interest', value: sum(d.fixedDeposits, (f) => (f.principal * f.interestRate) / 1200) },
    { label: 'Agriculture', value: sum(d.agricultureLands, (l) => (l.annualRevenue - l.annualExpenses) / 12) },
    { label: 'Farm Operations', value: sum(d.farms, (f) => (f.totalRevenue - f.totalExpense) / 12) },
    { label: 'Livestock', value: livestockProfit },
    { label: 'Other Yield', value: sum(d.assets, (a) => (a.annualIncome || 0) / 12) },
  ];
  const passiveIncome = sum(incomeSources, (s) => s.value);

  const monthlyEmi = sum(d.liabilities, (l) => (l.type === 'Credit Card' ? 0 : l.emi));
  const monthlyPremiums = sum(d.insurance, (i) => premiumMonthly(i.premium, i.premiumFrequency));
  const monthlyIncome = profile.monthlyIncome || 0;
  const monthlyExpenses = profile.monthlyExpenses || 0;
  const monthlyCashflow = monthlyIncome + passiveIncome - monthlyExpenses - monthlyEmi - monthlyPremiums;
  const grossIncome = monthlyIncome + passiveIncome;
  const savingsRate = pct(monthlyCashflow, grossIncome);

  const liquidAssets =
    sum(fd, (x) => x.m.currentValue) + sum(otherBy((a) => LIQUID.has(a.category)), (a) => a.currentValue) +
    sum(d.mutualFunds.filter((f) => f.category === 'Liquid'), (f) => f.units * f.currentNav);
  const essentialOutflow = monthlyExpenses + monthlyEmi + monthlyPremiums;
  const emergencyMonths = essentialOutflow ? liquidAssets / essentialOutflow : 0;
  const debtToAsset = pct(totalLiabilities, totalAssets);

  const lifeCover = sum(d.insurance.filter((i) => i.category === 'Life'), (i) => i.coverage);
  const healthCover = sum(d.insurance.filter((i) => i.category === 'Health'), (i) => i.coverage);
  const diversified = assetClasses.filter((c) => totalAssets && c.value / totalAssets >= 0.04).length;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const healthFactors: HealthFactor[] = [
    { label: 'Emergency Fund', max: 20, score: 20 * clamp(emergencyMonths / 6), hint: `${emergencyMonths.toFixed(1)} months of essential expenses covered` },
    { label: 'Debt Load', max: 20, score: 20 * clamp((60 - debtToAsset) / 40), hint: `Debt is ${debtToAsset.toFixed(1)}% of assets` },
    {
      label: 'Insurance Cover',
      max: 20,
      score: 14 * clamp(lifeCover / Math.max(1, monthlyIncome * 12 * 10)) + 6 * clamp(healthCover / 1_000_000),
      hint: `Life cover ${(lifeCover / Math.max(1, monthlyIncome * 12)).toFixed(1)}x annual income`,
    },
    { label: 'Savings Rate', max: 20, score: 20 * clamp(savingsRate / 30), hint: `${savingsRate.toFixed(1)}% of income saved` },
    { label: 'Diversification', max: 20, score: 20 * clamp(diversified / 6), hint: `${diversified} meaningful asset classes` },
  ];
  const healthScore = Math.round(sum(healthFactors, (f) => f.score));

  const fireTarget = monthlyExpenses * 12 * (100 / (profile.withdrawalRate || 4));
  const monthlyInvestment = Math.max(0, monthlyCashflow);
  const monthsToFire = monthsToTarget(netWorth, monthlyInvestment, fireTarget, profile.expectedReturn, profile.inflation);
  const estimatedDate = monthsToFire === null ? null : new Date(asOf.getFullYear(), asOf.getMonth() + monthsToFire, 1);

  return {
    assetClasses,
    totalAssets,
    totalLiabilities,
    netWorth,
    investedCapital,
    investmentValue,
    investmentReturn: investmentValue - investedCapital,
    investmentReturnPct: pct(investmentValue - investedCapital, investedCapital),
    passiveIncome,
    incomeSources,
    monthlyEmi,
    monthlyPremiums,
    monthlyExpenses,
    monthlyIncome,
    monthlyCashflow,
    savingsRate,
    liquidAssets,
    emergencyMonths,
    debtToAsset,
    healthScore,
    healthFactors,
    fire: {
      target: fireTarget,
      progress: Math.min(100, pct(netWorth, fireTarget)),
      gap: Math.max(0, fireTarget - netWorth),
      monthsToFire,
      estimatedDate,
      monthlyInvestment,
    },
  };
}
