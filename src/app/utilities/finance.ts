import { Compounding, FixedDeposit, Lending, Liability, Livestock, MutualFund } from '../models/wealth.models';

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.25;

function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function yearsBetween(from: string | Date | undefined, to: Date = new Date()): number {
  const f = toDate(from);
  if (!f) return 0;
  return Math.max(0, (to.getTime() - f.getTime()) / DAY_MS / YEAR_DAYS);
}

export function monthsBetween(from: string | Date | undefined, to: Date = new Date()): number {
  const f = toDate(from);
  if (!f) return 0;
  const months = (to.getFullYear() - f.getFullYear()) * 12 + (to.getMonth() - f.getMonth()) - (to.getDate() < f.getDate() ? 1 : 0);
  return Math.max(0, months);
}

export function daysUntil(date: string | Date | undefined, from: Date = new Date()): number | null {
  const d = toDate(date);
  if (!d) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((d.getTime() - start.getTime()) / DAY_MS);
}

export function pct(part: number, whole: number): number {
  return whole ? (part / whole) * 100 : 0;
}

export function sum<T>(items: readonly T[], fn: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (Number(fn(item)) || 0), 0);
}

export function appreciationPct(cost: number, current: number): number {
  return pct(current - cost, cost);
}

export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years < 0.08) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

/** XIRR in %, flows: negative = outflow (investment), positive = inflow (redemption / current value). */
export function xirr(flows: { amount: number; date: Date }[]): number {
  if (flows.length < 2 || !flows.some((f) => f.amount > 0) || !flows.some((f) => f.amount < 0)) return 0;
  const t0 = flows[0].date.getTime();
  const years = flows.map((f) => (f.date.getTime() - t0) / DAY_MS / 365);
  const npv = (r: number) => flows.reduce((acc, f, i) => acc + f.amount / Math.pow(1 + r, years[i]), 0);
  const dnpv = (r: number) => flows.reduce((acc, f, i) => acc - (years[i] * f.amount) / Math.pow(1 + r, years[i] + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 60; i++) {
    const value = npv(rate);
    const deriv = dnpv(rate);
    if (Math.abs(value) < 1e-6 || !deriv) break;
    const next = rate - value / deriv;
    if (!Number.isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - rate) < 1e-8) return next * 100;
    rate = next;
  }
  if (Math.abs(npv(rate)) < 1) return rate * 100;

  // Bisection fallback
  let lo = -0.99;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

export function emi(principal: number, annualRate: number, months: number): number {
  if (months <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (!r) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

const COMPOUNDS_PER_YEAR: Record<Compounding, number> = { Monthly: 12, Quarterly: 4, Yearly: 1, Simple: 0 };

export function compoundValue(principal: number, annualRate: number, years: number, compounding: Compounding): number {
  const n = COMPOUNDS_PER_YEAR[compounding];
  if (!n) return principal * (1 + (annualRate / 100) * years);
  return principal * Math.pow(1 + annualRate / 100 / n, n * years);
}

export function fdMetrics(fd: FixedDeposit, asOf: Date = new Date()) {
  const tenure = yearsBetween(fd.startDate, new Date(fd.maturityDate));
  const elapsed = Math.min(tenure, yearsBetween(fd.startDate, asOf));
  const maturityValue = compoundValue(fd.principal, fd.interestRate, tenure, fd.compounding);
  const currentValue = compoundValue(fd.principal, fd.interestRate, elapsed, fd.compounding);
  return {
    tenureYears: tenure,
    maturityValue,
    currentValue,
    interestAccrued: currentValue - fd.principal,
    totalInterest: maturityValue - fd.principal,
    daysToMaturity: daysUntil(fd.maturityDate, asOf),
    progress: tenure ? Math.min(100, (elapsed / tenure) * 100) : 100,
  };
}

export function lendingMetrics(loan: Lending, asOf: Date = new Date()) {
  const termMonths = Math.max(1, monthsBetween(loan.startDate, new Date(loan.endDate)));
  const elapsedMonths = Math.min(termMonths, monthsBetween(loan.startDate, asOf));
  const r = loan.interestRate / 100;
  let accrued = 0;
  let totalInterest = 0;
  let monthlyIncome = 0;

  switch (loan.interestType) {
    case 'Flat':
      accrued = loan.principal * r * (elapsedMonths / 12);
      totalInterest = loan.principal * r * (termMonths / 12);
      monthlyIncome = (loan.principal * r) / 12;
      break;
    case 'Reducing': {
      const installment = emi(loan.principal, loan.interestRate, termMonths);
      let balance = loan.principal;
      for (let m = 0; m < termMonths; m++) {
        const interest = balance * (r / 12);
        if (m < elapsedMonths) accrued += interest;
        if (m === elapsedMonths) monthlyIncome = interest;
        totalInterest += interest;
        balance -= installment - interest;
      }
      break;
    }
    case 'Bullet':
      accrued = loan.principal * (Math.pow(1 + r / 12, elapsedMonths) - 1);
      totalInterest = loan.principal * (Math.pow(1 + r / 12, termMonths) - 1);
      monthlyIncome = (loan.principal * r) / 12;
      break;
  }

  const closed = loan.status === 'Closed';
  const totalDue = loan.principal + accrued;
  const outstanding = closed ? 0 : Math.max(0, totalDue - (loan.amountRecovered || 0));
  return {
    termMonths,
    elapsedMonths,
    interestEarned: accrued,
    totalInterest,
    outstanding,
    recoveryPct: pct(loan.amountRecovered || 0, totalDue),
    roi: pct(accrued, loan.principal),
    monthlyIncome: closed ? 0 : monthlyIncome,
    daysToEnd: daysUntil(loan.endDate, asOf),
  };
}

export function liabilityMetrics(l: Liability, asOf: Date = new Date()) {
  const elapsed = Math.min(l.tenureMonths || 0, monthsBetween(l.startDate, asOf));
  const paid = l.emi * elapsed;
  const principalRepaid = Math.max(0, l.principal - l.outstanding);
  const interestPaid = l.type === 'Credit Card' ? 0 : Math.max(0, paid - principalRepaid);
  return {
    elapsedMonths: elapsed,
    remainingMonths: Math.max(0, (l.tenureMonths || 0) - elapsed),
    principalRepaid,
    interestPaid,
    repaidPct: pct(principalRepaid, l.principal),
    monthlyInterest: (l.outstanding * l.interestRate) / 1200,
  };
}

export function mutualFundMetrics(f: MutualFund, asOf: Date = new Date()) {
  const invested = f.units * f.averageNav;
  const current = f.units * f.currentNav;
  const years = yearsBetween(f.purchaseDate, asOf);
  const flows = (f.transactions?.length ? f.transactions : [{ date: f.purchaseDate, amount: invested }])
    .map((t) => ({ date: new Date(t.date), amount: -Math.abs(t.amount) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  flows.push({ date: asOf, amount: current });
  return {
    invested,
    current,
    gain: current - invested,
    gainPct: pct(current - invested, invested),
    cagr: cagr(invested, current, years),
    xirr: xirr(flows),
  };
}

export function livestockMetrics(l: Livestock) {
  const milkRevenue = (l.milkLitresPerDay || 0) * (l.milkPricePerLitre || 0) * 30;
  const revenue = milkRevenue + (l.otherMonthlyRevenue || 0);
  const expense = (l.monthlyFeedCost || 0) + (l.monthlyMedicineCost || 0);
  return {
    monthlyRevenue: revenue,
    monthlyExpense: expense,
    monthlyProfit: revenue - expense,
    expenseRatio: pct(expense, revenue),
    valueGrowth: appreciationPct(l.purchaseValue, l.currentValue),
    countGrowth: pct(l.count - (l.initialCount || l.count), l.initialCount || l.count),
  };
}

export function premiumMonthly(premium: number, frequency: string): number {
  switch (frequency) {
    case 'Single':
      return 0;
    case 'Monthly':
      return premium;
    case 'Quarterly':
      return premium / 3;
    case 'Half-Yearly':
      return premium / 6;
    default:
      return premium / 12;
  }
}

/** Year-end portfolio values for a monthly SIP with annual compounding expressed monthly. */
export function projectWealth(start: number, monthly: number, annualReturn: number, years: number): number[] {
  const r = annualReturn / 100 / 12;
  const values = [start];
  let v = start;
  for (let m = 1; m <= years * 12; m++) {
    v = v * (1 + r) + monthly;
    if (m % 12 === 0) values.push(v);
  }
  return values;
}

/** Months until corpus (growing at expectedReturn) reaches target inflating at inflation. */
export function monthsToTarget(start: number, monthly: number, target: number, expectedReturn: number, inflation: number, maxYears = 60): number | null {
  if (start >= target) return 0;
  const r = expectedReturn / 100 / 12;
  const i = inflation / 100 / 12;
  let v = start;
  let t = target;
  for (let m = 1; m <= maxYears * 12; m++) {
    v = v * (1 + r) + monthly;
    t = t * (1 + i);
    if (v >= t) return m;
  }
  return null;
}
