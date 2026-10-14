import { DEFAULT_PROFILE } from '../models/user.model';
import { CashFlowEntry, NetWorthSnapshot } from '../models/wealth.models';
import { toIsoDate, periodKey } from './format';
import { computeSummary, PortfolioData } from './portfolio';

const today = new Date();
const monthsAgo = (m: number, day = 5) => toIsoDate(new Date(today.getFullYear(), today.getMonth() - m, day));
const daysAhead = (d: number) => toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + d));

function sipFlows(amount: number, months: number): CashFlowEntry[] {
  return Array.from({ length: months }, (_, i) => ({ date: monthsAgo(months - i, 7), amount }));
}

/** Realistic sample portfolio for an Indian family office. Dates are relative to today. */
export function buildSeedData(): PortfolioData {
  return {
    properties: [
      {
        id: 'prop-1', name: 'Gachibowli Apartment', type: 'Residential', address: 'Flat 1204, My Home Bhooja, Gachibowli, Hyderabad 500032',
        surveyNumber: 'Sy. 83/1', purchaseDate: monthsAgo(76), purchaseCost: 9_200_000, currentValue: 14_800_000,
        lender: 'HDFC Bank', loanOutstanding: 4_150_000, loanEmi: 62_500, monthlyRent: 42_000, annualExpenses: 48_000,
        insurancePolicy: 'HDFC ERGO Home Shield',
      },
      {
        id: 'prop-2', name: 'Kondapur Commercial Shop', type: 'Commercial', address: 'Shop 7, Botanical Garden Rd, Kondapur, Hyderabad',
        surveyNumber: 'Sy. 112/4', purchaseDate: monthsAgo(52), purchaseCost: 6_500_000, currentValue: 8_900_000,
        monthlyRent: 55_000, annualExpenses: 36_000,
      },
      {
        id: 'prop-3', name: 'Whitefield Villa Plot', type: 'Plot', address: 'Plot 44, Prestige Lakeside Layout, Whitefield, Bengaluru',
        surveyNumber: 'Sy. 19/2A', purchaseDate: monthsAgo(34), purchaseCost: 7_800_000, currentValue: 9_650_000, monthlyRent: 0,
      },
    ],
    agricultureLands: [
      {
        id: 'land-1', name: 'Mango Orchard', village: 'Nuzvid', district: 'Eluru', surveyNumber: '214/3', areaAcres: 6.5,
        purchaseDate: monthsAgo(110), purchaseValue: 3_250_000, marketValue: 7_150_000, cropType: 'Mango (Banganapalli)',
        waterSource: 'Borewell', annualRevenue: 780_000, annualExpenses: 260_000,
      },
      {
        id: 'land-2', name: 'Paddy Fields', village: 'Bhimavaram', district: 'West Godavari', surveyNumber: '87/1B', areaAcres: 10,
        purchaseDate: monthsAgo(88), purchaseValue: 4_000_000, marketValue: 6_800_000, cropType: 'Paddy (Sona Masuri)',
        waterSource: 'Canal', annualRevenue: 950_000, annualExpenses: 520_000,
      },
      {
        id: 'land-3', name: 'Cotton & Chilli Farm', village: 'Gadwal', district: 'Jogulamba Gadwal', surveyNumber: '301/2', areaAcres: 8,
        purchaseDate: monthsAgo(40), purchaseValue: 2_400_000, marketValue: 3_100_000, cropType: 'Cotton / Chilli',
        waterSource: 'Drip Irrigation', annualRevenue: 640_000, annualExpenses: 380_000,
      },
    ],
    farms: [
      {
        id: 'farm-1', name: 'Sri Lakshmi Dairy Farm', location: 'Shamshabad, Rangareddy', farmType: 'Dairy', landAreaAcres: 4,
        established: monthsAgo(60), totalRevenue: 360_000, totalExpense: 180_000, infrastructureValue: 2_200_000,
      },
      {
        id: 'farm-2', name: 'Green Valley Integrated Farm', location: 'Chevella, Rangareddy', farmType: 'Mixed', landAreaAcres: 7.5,
        established: monthsAgo(30), totalRevenue: 540_000, totalExpense: 310_000, infrastructureValue: 1_650_000,
      },
    ],
    livestock: [
      {
        id: 'ls-1', farmId: 'farm-1', animalType: 'Cow', breed: 'Holstein Friesian', count: 14, initialCount: 10, purchaseDate: monthsAgo(58),
        purchaseValue: 850_000, currentValue: 1_260_000, milkLitresPerDay: 165, milkPricePerLitre: 48, monthlyFeedCost: 98_000,
        monthlyMedicineCost: 9_000, lastVaccination: monthsAgo(5), nextVaccination: daysAhead(9), insured: true,
      },
      {
        id: 'ls-2', farmId: 'farm-1', animalType: 'Buffalo', breed: 'Murrah', count: 9, initialCount: 6, purchaseDate: monthsAgo(48),
        purchaseValue: 540_000, currentValue: 855_000, milkLitresPerDay: 82, milkPricePerLitre: 62, monthlyFeedCost: 52_000,
        monthlyMedicineCost: 5_500, lastVaccination: monthsAgo(4), nextVaccination: daysAhead(40), insured: true,
      },
      {
        id: 'ls-3', farmId: 'farm-1', animalType: 'Calf', breed: 'HF Cross', count: 7, initialCount: 0, purchaseValue: 0,
        currentValue: 175_000, milkLitresPerDay: 0, milkPricePerLitre: 0, monthlyFeedCost: 8_500, monthlyMedicineCost: 1_500, insured: false,
      },
      {
        id: 'ls-4', farmId: 'farm-2', animalType: 'Goat', breed: 'Sirohi', count: 48, initialCount: 30, purchaseDate: monthsAgo(28),
        purchaseValue: 330_000, currentValue: 612_000, milkLitresPerDay: 0, milkPricePerLitre: 0, otherMonthlyRevenue: 38_000,
        monthlyFeedCost: 14_000, monthlyMedicineCost: 3_000, nextVaccination: daysAhead(5), insured: false,
      },
      {
        id: 'ls-5', farmId: 'farm-2', animalType: 'Poultry', breed: 'Kadaknath', count: 600, initialCount: 400, purchaseDate: monthsAgo(14),
        purchaseValue: 160_000, currentValue: 270_000, milkLitresPerDay: 0, milkPricePerLitre: 0, otherMonthlyRevenue: 52_000,
        monthlyFeedCost: 26_000, monthlyMedicineCost: 4_000, insured: true,
      },
      {
        id: 'ls-6', farmId: 'farm-2', animalType: 'Bull', breed: 'Ongole', count: 2, initialCount: 2, purchaseDate: monthsAgo(26),
        purchaseValue: 240_000, currentValue: 310_000, milkLitresPerDay: 0, milkPricePerLitre: 0, otherMonthlyRevenue: 6_000,
        monthlyFeedCost: 7_000, monthlyMedicineCost: 1_000, insured: true,
      },
    ],
    lending: [
      {
        id: 'lend-1', borrowerName: 'Ramesh Reddy', mobile: '+91 98480 12345', address: 'Kukatpally, Hyderabad', principal: 1_000_000,
        interestRate: 18, interestType: 'Flat', loanType: 'Business', startDate: monthsAgo(14), endDate: daysAhead(300),
        collateral: 'Property documents (Plot 22, Miyapur)', amountRecovered: 150_000, status: 'Active',
      },
      {
        id: 'lend-2', borrowerName: 'Suresh Kumar', mobile: '+91 90000 54321', address: 'Guntur', principal: 500_000, interestRate: 24,
        interestType: 'Reducing', loanType: 'Agriculture', startDate: monthsAgo(10), endDate: daysAhead(420), collateral: 'Tractor RC',
        amountRecovered: 205_000, status: 'Active',
      },
      {
        id: 'lend-3', borrowerName: 'Lakshmi Traders', mobile: '+91 99890 11122', address: 'Vijayawada', principal: 750_000, interestRate: 15,
        interestType: 'Bullet', loanType: 'Gold Backed', startDate: monthsAgo(11), endDate: daysAhead(21), collateral: '180g gold ornaments',
        amountRecovered: 0, status: 'Active',
      },
      {
        id: 'lend-4', borrowerName: 'Venkat Rao', mobile: '+91 94400 77788', address: 'Warangal', principal: 300_000, interestRate: 18,
        interestType: 'Flat', loanType: 'Personal', startDate: monthsAgo(30), endDate: monthsAgo(6), amountRecovered: 435_000, status: 'Closed',
      },
    ],
    stocks: [
      { id: 'st-1', symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', quantity: 450, purchasePrice: 1_480, currentPrice: 1_725, sector: 'Banking', purchaseDate: monthsAgo(40) },
      { id: 'st-2', symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', quantity: 300, purchasePrice: 2_310, currentPrice: 2_965, sector: 'Energy', purchaseDate: monthsAgo(36) },
      { id: 'st-3', symbol: 'INFY', name: 'Infosys', exchange: 'NSE', quantity: 400, purchasePrice: 1_390, currentPrice: 1_842, sector: 'IT', purchaseDate: monthsAgo(30) },
      { id: 'st-4', symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', quantity: 120, purchasePrice: 3_280, currentPrice: 4_120, sector: 'IT', purchaseDate: monthsAgo(44) },
      { id: 'st-5', symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE', quantity: 1_500, purchasePrice: 268, currentPrice: 462, sector: 'FMCG', purchaseDate: monthsAgo(48) },
      { id: 'st-6', symbol: 'LT', name: 'Larsen & Toubro', exchange: 'NSE', quantity: 150, purchasePrice: 2_150, currentPrice: 3_640, sector: 'Infrastructure', purchaseDate: monthsAgo(32) },
      { id: 'st-7', symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', exchange: 'NSE', quantity: 260, purchasePrice: 980, currentPrice: 1_715, sector: 'Pharma', purchaseDate: monthsAgo(28) },
      { id: 'st-8', symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE', quantity: 600, purchasePrice: 845, currentPrice: 762, sector: 'Auto', purchaseDate: monthsAgo(16) },
      { id: 'st-9', symbol: 'BAJFINANCE', name: 'Bajaj Finance', exchange: 'NSE', quantity: 60, purchasePrice: 7_100, currentPrice: 8_640, sector: 'Financials', purchaseDate: monthsAgo(22) },
    ],
    mutualFunds: [
      {
        id: 'mf-1', fundName: 'Parag Parikh Flexi Cap Fund - Direct Growth', amc: 'PPFAS', folio: '12345678/01', category: 'Flexi Cap',
        units: 28_450.12, averageNav: 52.4, currentNav: 86.3, purchaseDate: monthsAgo(48), sipAmount: 25_000, transactions: sipFlows(31_060, 48),
      },
      {
        id: 'mf-2', fundName: 'Mirae Asset Large Cap Fund - Direct Growth', amc: 'Mirae Asset', folio: '79865412', category: 'Large Cap',
        units: 9_820.5, averageNav: 92.1, currentNav: 118.7, purchaseDate: monthsAgo(36), sipAmount: 20_000, transactions: sipFlows(25_125, 36),
      },
      {
        id: 'mf-3', fundName: 'Axis Small Cap Fund - Direct Growth', amc: 'Axis MF', folio: '9102837465', category: 'Small Cap',
        units: 7_210.0, averageNav: 71.5, currentNav: 112.4, purchaseDate: monthsAgo(30), sipAmount: 15_000, transactions: sipFlows(17_183, 30),
      },
      {
        id: 'mf-4', fundName: 'Mirae Asset ELSS Tax Saver - Direct Growth', amc: 'Mirae Asset', folio: '79865413', category: 'ELSS',
        units: 6_150.3, averageNav: 34.2, currentNav: 51.9, purchaseDate: monthsAgo(54), transactions: [{ date: monthsAgo(54), amount: 210_340 }],
      },
      {
        id: 'mf-5', fundName: 'UTI Nifty 50 Index Fund - Direct Growth', amc: 'UTI MF', folio: '554433221', category: 'Index',
        units: 4_380.0, averageNav: 128.6, currentNav: 171.2, purchaseDate: monthsAgo(26), sipAmount: 10_000, transactions: sipFlows(21_665, 26),
      },
      {
        id: 'mf-6', fundName: 'HDFC Liquid Fund - Direct Growth', amc: 'HDFC MF', folio: '1928374/55', category: 'Liquid',
        units: 120.5, averageNav: 4_610, currentNav: 4_985, purchaseDate: monthsAgo(14), transactions: [{ date: monthsAgo(14), amount: 555_505 }],
      },
    ],
    fixedDeposits: [
      { id: 'fd-1', bank: 'State Bank of India', accountNumber: 'XXXX4521', principal: 1_000_000, interestRate: 7.1, startDate: monthsAgo(11), maturityDate: daysAhead(24), compounding: 'Quarterly' },
      { id: 'fd-2', bank: 'HDFC Bank', accountNumber: 'XXXX8834', principal: 750_000, interestRate: 7.4, startDate: monthsAgo(8), maturityDate: daysAhead(480), compounding: 'Quarterly' },
      { id: 'fd-3', bank: 'Bajaj Finance', accountNumber: 'BF-229103', principal: 500_000, interestRate: 8.25, startDate: monthsAgo(20), maturityDate: daysAhead(520), compounding: 'Yearly' },
      { id: 'fd-4', bank: 'Post Office (NSC)', accountNumber: 'NSC-77120', principal: 300_000, interestRate: 7.7, startDate: monthsAgo(30), maturityDate: daysAhead(900), compounding: 'Yearly' },
    ],
    assets: [
      { id: 'as-1', name: 'HDFC Savings Account', category: 'Savings Account', institution: 'HDFC Bank', investedValue: 640_000, currentValue: 640_000, annualIncome: 19_200, interestRate: 3 },
      { id: 'as-2', name: 'Emergency Cash Reserve', category: 'Cash', investedValue: 150_000, currentValue: 150_000 },
      { id: 'as-3', name: 'Physical Gold (Jewellery & Coins)', category: 'Gold', quantity: 420, unit: 'grams', investedValue: 1_890_000, currentValue: 3_150_000 },
      { id: 'as-4', name: 'Sovereign Gold Bonds 2028', category: 'Gold', institution: 'RBI', quantity: 120, unit: 'grams', investedValue: 576_000, currentValue: 900_000, annualIncome: 14_400, interestRate: 2.5, maturityDate: daysAhead(800) },
      { id: 'as-5', name: 'Silver Bars', category: 'Silver', quantity: 8, unit: 'kg', investedValue: 520_000, currentValue: 760_000 },
      { id: 'as-6', name: 'Bitcoin & Ethereum', category: 'Crypto', institution: 'CoinDCX', investedValue: 350_000, currentValue: 610_000 },
      { id: 'as-7', name: 'Employee Provident Fund', category: 'EPF', institution: 'EPFO', investedValue: 1_720_000, currentValue: 2_180_000, interestRate: 8.25 },
      { id: 'as-8', name: 'Public Provident Fund', category: 'PPF', institution: 'SBI', investedValue: 1_050_000, currentValue: 1_420_000, interestRate: 7.1, maturityDate: daysAhead(1600) },
      { id: 'as-9', name: 'NPS Tier I', category: 'NPS', institution: 'HDFC Pension', investedValue: 800_000, currentValue: 1_120_000 },
      { id: 'as-10', name: 'REC 54EC Bonds', category: 'Bond', institution: 'REC Ltd', investedValue: 500_000, currentValue: 500_000, annualIncome: 26_250, interestRate: 5.25, maturityDate: daysAhead(700) },
      { id: 'as-11', name: 'Mahindra 575 DI Tractor', category: 'Farm Equipment', investedValue: 780_000, currentValue: 610_000 },
      { id: 'as-12', name: 'Milking Machines & Chillers', category: 'Machinery', investedValue: 420_000, currentValue: 330_000 },
      { id: 'as-13', name: 'Harvest Sale Receivable', category: 'Receivable', institution: 'Eluru Mango Traders', investedValue: 185_000, currentValue: 185_000 },
    ],
    insurance: [
      { id: 'ins-1', policyNumber: 'HDFCL-99821034', provider: 'HDFC Life', policyName: 'Click 2 Protect Super', category: 'Life', coverage: 30_000_000, premium: 28_500, premiumFrequency: 'Yearly', startDate: monthsAgo(60), renewalDate: daysAhead(18), nominee: 'Spouse' },
      { id: 'ins-2', policyNumber: 'LIC-55120934', provider: 'LIC of India', policyName: 'Jeevan Anand', category: 'Life', coverage: 2_500_000, premium: 54_000, premiumFrequency: 'Yearly', startDate: monthsAgo(120), renewalDate: daysAhead(140), nominee: 'Son' },
      { id: 'ins-3', policyNumber: 'NIVA-7731209', provider: 'Niva Bupa', policyName: 'ReAssure 2.0 Family Floater', category: 'Health', coverage: 2_500_000, premium: 36_800, premiumFrequency: 'Yearly', startDate: monthsAgo(36), renewalDate: daysAhead(62) },
      { id: 'ins-4', policyNumber: 'ICICI-MV-662190', provider: 'ICICI Lombard', policyName: 'Car Comprehensive - XUV700', category: 'Vehicle', coverage: 1_950_000, premium: 32_400, premiumFrequency: 'Yearly', renewalDate: daysAhead(28), insuredAsset: 'TS09 FK 7788' },
      { id: 'ins-5', policyNumber: 'HDFCERGO-HS-1190', provider: 'HDFC ERGO', policyName: 'Home Shield', category: 'Property', coverage: 9_000_000, premium: 6_800, premiumFrequency: 'Yearly', renewalDate: daysAhead(210), insuredAsset: 'Gachibowli Apartment' },
      { id: 'ins-6', policyNumber: 'NIA-CATTLE-44120', provider: 'New India Assurance', policyName: 'Cattle Insurance', category: 'Livestock', coverage: 1_800_000, premium: 54_000, premiumFrequency: 'Yearly', renewalDate: daysAhead(-4), insuredAsset: 'Sri Lakshmi Dairy Farm' },
    ],
    vehicles: [
      { id: 'veh-1', registrationNumber: 'TS09 FK 7788', make: 'Mahindra', model: 'XUV700 AX7', type: 'SUV', year: 2023, purchaseDate: monthsAgo(32), purchaseCost: 2_450_000, currentValue: 1_860_000, insuranceRenewal: daysAhead(28) },
      { id: 'veh-2', registrationNumber: 'TS08 EQ 4521', make: 'Honda', model: 'City ZX', type: 'Car', year: 2021, purchaseDate: monthsAgo(56), purchaseCost: 1_520_000, currentValue: 880_000 },
      { id: 'veh-3', registrationNumber: 'AP39 TR 1102', make: 'Mahindra', model: 'Bolero Pik-Up', type: 'Truck', year: 2022, purchaseDate: monthsAgo(44), purchaseCost: 980_000, currentValue: 690_000 },
    ],
    liabilities: [
      { id: 'lia-1', name: 'Gachibowli Home Loan', type: 'Home Loan', lender: 'HDFC Bank', principal: 7_000_000, outstanding: 4_150_000, interestRate: 8.6, emi: 62_500, startDate: monthsAgo(76), tenureMonths: 240 },
      { id: 'lia-2', name: 'XUV700 Car Loan', type: 'Vehicle Loan', lender: 'ICICI Bank', principal: 1_500_000, outstanding: 860_000, interestRate: 9.1, emi: 31_200, startDate: monthsAgo(32), tenureMonths: 60 },
      { id: 'lia-3', name: 'Dairy Expansion Loan', type: 'Agriculture Loan', lender: 'NABARD via SBI', principal: 1_200_000, outstanding: 720_000, interestRate: 7, emi: 23_800, startDate: monthsAgo(28), tenureMonths: 60 },
      { id: 'lia-4', name: 'HDFC Infinia', type: 'Credit Card', lender: 'HDFC Bank', principal: 1_000_000, outstanding: 84_500, interestRate: 42, emi: 0, startDate: monthsAgo(1), tenureMonths: 1 },
      { id: 'lia-5', name: 'Amazon Pay ICICI', type: 'Credit Card', lender: 'ICICI Bank', principal: 300_000, outstanding: 22_300, interestRate: 42, emi: 0, startDate: monthsAgo(1), tenureMonths: 1 },
    ],
    goals: [
      { id: 'goal-1', name: 'Retire at 50', category: 'Retirement', targetAmount: 120_000_000, currentAmount: 38_500_000, targetDate: daysAhead(365 * 12), monthlyContribution: 150_000, priority: 'High' },
      { id: 'goal-2', name: 'Expand Dairy to 50 Cows', category: 'Farm Expansion', targetAmount: 3_500_000, currentAmount: 1_450_000, targetDate: daysAhead(540), monthlyContribution: 60_000, priority: 'Medium' },
      { id: 'goal-3', name: 'Farmhouse in Chevella', category: 'House', targetAmount: 6_000_000, currentAmount: 1_800_000, targetDate: daysAhead(365 * 4), monthlyContribution: 50_000, priority: 'Medium' },
      { id: 'goal-4', name: '12-Month Emergency Fund', category: 'Emergency Fund', targetAmount: 2_400_000, currentAmount: 1_870_000, targetDate: daysAhead(240), monthlyContribution: 40_000, priority: 'High' },
      { id: 'goal-5', name: "Children's Higher Education", category: 'Education', targetAmount: 8_000_000, currentAmount: 2_150_000, targetDate: daysAhead(365 * 9), monthlyContribution: 45_000, priority: 'High' },
    ],
  };
}

/** Backfills 24 months of plausible net worth history ending at the current portfolio. */
export function buildSeedHistory(data: PortfolioData): NetWorthSnapshot[] {
  const s = computeSummary(data, DEFAULT_PROFILE);
  const months = 24;
  return Array.from({ length: months }, (_, idx) => {
    const back = months - 1 - idx;
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const wobble = 1 + Math.sin(idx * 1.7) * 0.012;
    const growth = Math.pow(0.986, back) * wobble;
    const debtFactor = 1 + back * 0.018;
    const breakdown = Object.fromEntries(
      s.assetClasses.map((c) => {
        const volatility = c.key === 'equity' || c.key === 'crypto' || c.key === 'mutualFunds' ? 1 + Math.sin(idx * 0.9 + c.value) * 0.04 : 1;
        return [c.key, Math.round(c.value * growth * volatility)];
      }),
    );
    const totalAssets = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const totalLiabilities = Math.round(s.totalLiabilities * debtFactor);
    return {
      id: periodKey(date),
      period: periodKey(date),
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      passiveIncome: Math.round(s.passiveIncome * Math.pow(0.988, back)),
      cashflow: Math.round(s.monthlyCashflow * (0.85 + 0.15 * Math.cos(idx * 1.3)) * Math.pow(0.99, back)),
      breakdown,
    };
  });
}
