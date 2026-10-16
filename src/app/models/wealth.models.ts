import { Entity } from './entity.model';

/** ISO date string: YYYY-MM-DD */
export type IsoDate = string;

// ---------- Real assets ----------
export const PROPERTY_TYPES = ['Residential', 'Commercial', 'Mixed Use', 'Plot', 'Industrial'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface Property extends Entity {
  name: string;
  type: PropertyType;
  address: string;
  surveyNumber?: string;
  purchaseDate?: IsoDate;
  purchaseCost?: number;
  currentValue: number;
  /** Informational loan details; the loan itself should be tracked in Liabilities. */
  lender?: string;
  loanOutstanding?: number;
  loanEmi?: number;
  monthlyRent: number;
  annualExpenses?: number;
  insurancePolicy?: string;
}

export const WATER_SOURCES = ['Borewell', 'Canal', 'Open Well', 'Rain-fed', 'Tank', 'Drip Irrigation'] as const;

export interface AgricultureLand extends Entity {
  name: string;
  village: string;
  district: string;
  surveyNumber: string;
  unitNumber?: string;
  areaAcres: number;
  purchaseDate: IsoDate;
  purchaseValue: number;
  marketValue: number;
  cropType: string;
  waterSource: string;
  annualRevenue: number;
  annualExpenses: number;
}

export const ANIMAL_TYPES = ['Cow', 'Goat'] as const;
export type AnimalType = (typeof ANIMAL_TYPES)[number];

export interface Livestock extends Entity {
  farmId?: string;
  farmName?: string;
  animalType: AnimalType;
  breed: string;
  tagNumber?: string;
  gender?: 'Female' | 'Male';
  birthDate?: IsoDate;
  lifeStatus?: 'Alive' | 'Deceased';
  deathDate?: IsoDate;
  motherId?: string;
  pregnancyMonths?: number;
  count: number;
  initialCount: number;
  purchaseDate?: IsoDate;
  purchaseValue: number;
  currentValue: number;
  milkLitresPerDay: number;
  milkPricePerLitre: number;
  milkIncomeTransactions?: CashFlowEntry[];
  otherMonthlyRevenue?: number;
  monthlyFeedCost: number;
  monthlyMedicineCost: number;
  lastVaccination?: IsoDate;
  nextVaccination?: IsoDate;
  insured: boolean;
}

// ---------- Alternative assets ----------
export const INTEREST_TYPES = ['Flat', 'Reducing', 'Bullet'] as const;
export type InterestType = (typeof INTEREST_TYPES)[number];
function ordinal(day: number): string {
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th';
  return `${day}${suffix}`;
}
export const PAYMENT_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  return { value: day, label: `${ordinal(day)} of every month` };
});
export const LENDING_TYPES = ['Personal', 'Business', 'Agriculture', 'Gold Backed', 'Property Backed'] as const;
export const LENDING_STATUS = ['Active', 'Closed', 'Overdue', 'Defaulted'] as const;

export interface Lending extends Entity {
  borrowerName: string;
  loanName?: string;
  mobile: string;
  address?: string;
  principal: number;
  /** Annual interest rate % */
  interestRate: number;
  interestType: InterestType;
  /** Fixed monthly EMI for reducing-balance loans; omitted for flat and bullet loans. */
  emiAmount?: number;
  loanType: string;
  startDate: IsoDate;
  endDate?: IsoDate;
  /** Day of month for recurring interest / installment payments; defaults to 1. */
  paymentDay?: number;
  paymentAccount?: string;
  paymentsMade?: number;
  paymentConfirmations?: PaymentConfirmation[];
  collateral?: string;
  amountRecovered: number;
  status: (typeof LENDING_STATUS)[number];
}

// ---------- Financial assets ----------
export const SECTORS = [
  'Banking', 'IT', 'FMCG', 'Energy', 'Pharma', 'Auto', 'Infrastructure', 'Metals', 'Telecom', 'Consumer', 'Financials', 'Chemicals', 'Other',
] as const;

export interface Stock extends Entity {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE';
  currency?: 'INR' | 'USD';
  quantity: number;
  purchasePrice: number;
  purchaseExchangeRateToInr?: number;
  currentPrice: number;
  exchangeRateToInr?: number;
  priceFetchedAt?: number;
  quoteTimestamp?: string;
  fxRateDate?: IsoDate;
  purchaseBasisIsEstimate?: boolean;
  sector: string;
  purchaseDate?: IsoDate;
}

export const MF_CATEGORIES = [
  'Large Cap', 'Mid Cap', 'Small Cap', 'Flexi Cap', 'ELSS', 'Index', 'Hybrid', 'Debt', 'Liquid', 'International',
] as const;

export interface CashFlowEntry {
  date: IsoDate;
  amount: number;
}

export interface MutualFund extends Entity {
  fundName: string;
  amc: string;
  folio: string;
  category: string;
  units: number;
  averageNav: number;
  currentNav: number;
  purchaseDate: IsoDate;
  sipAmount?: number;
  /** Investment cash flows used for XIRR (positive = invested). */
  transactions?: CashFlowEntry[];
}

export const COMPOUNDING = ['Quarterly', 'Monthly', 'Yearly', 'Simple'] as const;
export type Compounding = (typeof COMPOUNDING)[number];

export interface FixedDeposit extends Entity {
  bank: string;
  accountNumber?: string;
  principal: number;
  interestRate: number;
  startDate: IsoDate;
  maturityDate: IsoDate;
  compounding: Compounding;
}

export const OTHER_ASSET_CATEGORIES = [
  'Bond', 'Savings Account', 'Gold', 'Silver', 'Crypto', 'EPF', 'PPF', 'NPS', 'Machinery', 'Farm Equipment', 'Receivable', 'Cash',
] as const;
export type OtherAssetCategory = (typeof OTHER_ASSET_CATEGORIES)[number];

/** Generic asset stored in the `assets` collection. */
export interface OtherAsset extends Entity {
  name: string;
  category: OtherAssetCategory;
  institution?: string;
  quantity?: number;
  unit?: string;
  investedValue: number;
  currentValue: number;
  annualIncome?: number;
  interestRate?: number;
  maturityDate?: IsoDate;
}

// ---------- Protection ----------
export const INSURANCE_CATEGORIES = ['Life', 'Health', 'Vehicle', 'Property', 'Livestock'] as const;
export const PREMIUM_FREQUENCY = ['Single', 'Yearly', 'Half-Yearly', 'Quarterly', 'Monthly'] as const;

export interface Insurance extends Entity {
  policyNumber: string;
  provider: string;
  policyName: string;
  category: (typeof INSURANCE_CATEGORIES)[number];
  coverage: number;
  premium: number;
  premiumFrequency: (typeof PREMIUM_FREQUENCY)[number];
  /** Day of month for recurring premium payments; defaults to the policy start date's day. */
  premiumPaymentDay?: number;
  paymentAccount?: string;
  startDate?: IsoDate;
  endDate?: IsoDate;
  maturityDate?: IsoDate;
  maturityPayoutAmount?: number;
  nominee?: string;
  /** One covered person per line, optionally including their relationship to the policyholder. */
  insuredPeople?: string;
  insuredAsset?: string;
}

export const VEHICLE_TYPES = ['Car', 'SUV', 'Two Wheeler', 'Tractor', 'Truck', 'Other'] as const;

export interface Vehicle extends Entity {
  registrationNumber: string;
  ownerName?: string;
  make: string;
  model: string;
  type: string;
  year: number;
  purchaseDate?: IsoDate;
  purchaseCost: number;
  currentValue: number;
  insuranceRenewal?: IsoDate;
}

// ---------- Liabilities ----------
export const LIABILITY_TYPES = ['Home Loan', 'Vehicle Loan', 'Personal Loan', 'Credit Card', 'Gold Loan', 'Agriculture Loan', 'Business Loan'] as const;

export interface Liability extends Entity {
  name: string;
  type: (typeof LIABILITY_TYPES)[number];
  status?: 'Planned' | 'Active';
  lender: string;
  principal: number;
  outstanding: number;
  interestRate: number;
  emi: number;
  startDate: IsoDate;
  tenureMonths: number;
  /** Day of month for the recurring EMI; defaults to 1. */
  paymentDay?: number;
  paymentAccount?: string;
  paymentsMade?: number;
  paymentConfirmations?: PaymentConfirmation[];
}

export interface PaymentConfirmation {
  installment: number;
  dueDate: IsoDate;
  amount: number;
  principal: number;
  confirmedAt: string;
}

// ---------- Goals ----------
export const GOAL_CATEGORIES = ['Retirement', 'Farm Expansion', 'House', 'Emergency Fund', 'Education', 'Travel', 'Other'] as const;

export interface Goal extends Entity {
  name: string;
  category: (typeof GOAL_CATEGORIES)[number];
  targetAmount: number;
  currentAmount: number;
  targetDate: IsoDate;
  monthlyContribution: number;
  priority: 'High' | 'Medium' | 'Low';
}

// ---------- Documents ----------
export const DOCUMENT_ENTITY_TYPES = ['Property', 'Agriculture', 'Farm', 'Livestock', 'Insurance', 'Lending', 'Vehicle', 'Other'] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export interface VaultDocument extends Entity {
  name: string;
  entityType: DocumentEntityType;
  entityId?: string;
  entityName?: string;
  /** Base64 data URL for files stored directly in Firestore. */
  contentData?: string;
  /** External URL retained for older document records and manually linked files. */
  url?: string;
  contentType: string;
  size: number;
  tags?: string;
}

// ---------- History ----------
export interface NetWorthSnapshot extends Entity {
  /** YYYY-MM */
  period: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  passiveIncome: number;
  cashflow: number;
  breakdown: Record<string, number>;
}
