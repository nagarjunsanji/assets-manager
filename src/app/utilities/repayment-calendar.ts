import { Insurance, Lending, Liability } from '../models/wealth.models';
import { emi } from './finance';

export type CashflowDirection = 'credit' | 'debit';
export type RepaymentStatus = 'Paid' | 'Upcoming' | 'Unrecorded';

export interface RepaymentRow {
  date: string;
  installment: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  status: RepaymentStatus;
}

export interface CashflowEvent {
  id: string;
  date: string;
  direction: CashflowDirection;
  amount: number;
  title: string;
  subtitle: string;
  schedule: RepaymentRow;
  lending?: Lending;
  liability?: Liability;
  insurance?: Insurance;
  maturityPayout?: boolean;
  amountKnown?: boolean;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function scheduledDate(startDate: string, period: number, paymentDay = 1): Date {
  const start = parseIsoDate(startDate);
  const monthStart = new Date(start.getFullYear(), start.getMonth() + period, 1);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(Math.max(paymentDay, 1), lastDay));
}

function addMonthsFromAnchor(anchor: Date, months: number, paymentDay = anchor.getDate()): Date {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth() + months, 1);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(Math.max(paymentDay, 1), lastDay));
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
}

function statusFor(period: number, date: Date, paymentsMade: number | undefined, asOf: Date): RepaymentStatus {
  if (paymentsMade !== undefined && period <= paymentsMade) return 'Paid';
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return date < today ? 'Unrecorded' : 'Upcoming';
}

export function insuranceEffectiveMaturityDate(policy: Insurance): string | undefined {
  return policy.maturityDate ?? policy.endDate;
}

export function lendingSchedule(loan: Lending, asOf = new Date(), through = asOf): RepaymentRow[] {
  const start = parseIsoDate(loan.startDate);
  const end = loan.endDate ? parseIsoDate(loan.endDate) : null;
  const term = end
    ? Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth())
    : null;
  const monthsFromStart = Math.max(0, (asOf.getFullYear() - start.getFullYear()) * 12 + asOf.getMonth() - start.getMonth());
  const monthsThrough = Math.max(0, (through.getFullYear() - start.getFullYear()) * 12 + through.getMonth() - start.getMonth());
  const periods = term ?? Math.max(monthsFromStart + 12, monthsThrough);
  const effectiveTerm = term ?? 12;
  const monthlyRate = loan.interestRate / 1200;
  const reducingPayment = emi(loan.principal, loan.interestRate, effectiveTerm);
  let balance = loan.principal;
  const rows: RepaymentRow[] = [];

  for (let period = 1; period <= periods; period++) {
    const date = scheduledDate(loan.startDate, period, loan.paymentDay);
    if (end && date > end) break;
    let payment = 0;
    let principal = 0;
    let interest = 0;

    switch (loan.interestType) {
      case 'Flat':
        interest = loan.principal * monthlyRate;
        principal = end && period === term ? balance : 0;
        payment = interest + principal;
        balance -= principal;
        break;
      case 'Reducing':
        interest = balance * monthlyRate;
        payment = Math.min(reducingPayment, balance + interest);
        principal = Math.max(0, payment - interest);
        balance = Math.max(0, balance - principal);
        break;
      case 'Bullet':
        if (end && period === term) {
          interest = loan.principal * (Math.pow(1 + monthlyRate, term) - 1);
          principal = balance;
          payment = principal + interest;
          balance = 0;
        }
        break;
    }

    rows.push({
      date: isoDate(date),
      installment: period,
      payment,
      principal,
      interest,
      balance,
      status: statusFor(period, date, loan.paymentsMade, asOf),
    });
  }
  return rows;
}

export function liabilitySchedule(liability: Liability, asOf = new Date()): RepaymentRow[] {
  if (liability.status === 'Planned') return [];
  const months = Math.max(0, Math.floor(liability.tenureMonths));
  const monthlyRate = liability.interestRate / 1200;
  let balance = liability.principal;
  const rows: RepaymentRow[] = [];

  for (let period = 1; period <= months; period++) {
    const date = scheduledDate(liability.startDate, period, liability.paymentDay);
    const interest = balance * monthlyRate;
    const payment = Math.min(Math.max(0, liability.emi), balance + interest);
    const principal = Math.max(0, payment - interest);
    balance = Math.max(0, balance - principal);
    rows.push({
      date: isoDate(date),
      installment: period,
      payment,
      principal,
      interest,
      balance,
      status: statusFor(period, date, liability.paymentsMade, asOf),
    });
  }
  return rows;
}

export function insuranceSchedule(policy: Insurance, from: Date, to: Date): RepaymentRow[] {
  if (!policy.startDate || policy.premium <= 0) return [];
  const intervalMonths = {
    Monthly: 1,
    Quarterly: 3,
    'Half-Yearly': 6,
    Yearly: 12,
    Single: 0,
  }[policy.premiumFrequency];
  const anchor = parseIsoDate(policy.startDate);
  const paymentDay = policy.premiumPaymentDay ?? anchor.getDate();
  const policyEnd = insuranceEffectiveMaturityDate(policy);
  const firstPaymentIndex = intervalMonths && addMonthsFromAnchor(anchor, 0, paymentDay) < anchor ? 1 : 0;
  const startPeriod = intervalMonths
    ? Math.max(firstPaymentIndex, Math.floor(monthsBetween(anchor, from) / intervalMonths) - 1)
    : 0;
  const rows: RepaymentRow[] = [];
  const periods = intervalMonths ? 1200 : 1;

  for (let index = startPeriod; index < periods; index++) {
    const date = intervalMonths ? addMonthsFromAnchor(anchor, index * intervalMonths, paymentDay) : anchor;
    if (date > to) break;
    if (date < anchor) continue;
    if (policyEnd && date > parseIsoDate(policyEnd)) break;
    if (date < from) continue;
    rows.push({
      date: isoDate(date),
      installment: index + 1,
      payment: policy.premium,
      principal: policy.premium,
      interest: 0,
      balance: 0,
      status: 'Upcoming',
    });
  }
  return rows;
}

export function insuranceMaturitySchedule(policy: Insurance, from: Date, to: Date, asOf = new Date()): RepaymentRow[] {
  const maturityDate = insuranceEffectiveMaturityDate(policy);
  if (!maturityDate || policy.category === 'Health') return [];
  const date = parseIsoDate(maturityDate);
  if (date < from || date > to) return [];
  return [{
    date: maturityDate,
    installment: 1,
    payment: policy.maturityPayoutAmount ?? 0,
    principal: policy.maturityPayoutAmount ?? 0,
    interest: 0,
    balance: 0,
    status: statusFor(1, date, undefined, asOf),
  }];
}

export function cashflowEvents(
  lending: readonly Lending[],
  liabilities: readonly Liability[],
  from: Date,
  to: Date,
  asOf = new Date(),
  insurance: readonly Insurance[] = [],
): CashflowEvent[] {
  const fromDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDate = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const events: CashflowEvent[] = [];

  for (const loan of lending) {
    if (loan.status === 'Closed') continue;
    for (const schedule of lendingSchedule(loan, asOf, toDate)) {
      const date = parseIsoDate(schedule.date);
      if (date < fromDate || date > toDate || schedule.payment <= 0) continue;
      const label = loan.loanName || loan.borrowerName;
      const eventType = loan.interestType === 'Reducing' ? 'EMI received'
        : loan.interestType === 'Flat' ? (schedule.principal ? 'Final repayment' : 'Interest received')
          : 'Bullet repayment';
      events.push({
        id: `lending-${loan.id}-${schedule.installment}`,
        date: schedule.date,
        direction: 'credit',
        amount: schedule.payment,
        title: `${label} · ${eventType}`,
        subtitle: [loan.paymentAccount, `Private lending · ${schedule.status}`].filter(Boolean).join(' · '),
        schedule,
        lending: loan,
      });
    }
  }

  for (const liability of liabilities) {
    if (liability.outstanding <= 0) continue;
    for (const schedule of liabilitySchedule(liability, asOf)) {
      const date = parseIsoDate(schedule.date);
      if (date < fromDate || date > toDate || schedule.payment <= 0) continue;
      events.push({
        id: `liability-${liability.id}-${schedule.installment}`,
        date: schedule.date,
        direction: 'debit',
        amount: schedule.payment,
        title: `${liability.name} · EMI`,
        subtitle: [liability.lender, liability.paymentAccount, schedule.status].filter(Boolean).join(' · '),
        schedule,
        liability,
      });
    }
  }

  for (const policy of insurance) {
    for (const schedule of insuranceSchedule(policy, fromDate, toDate)) {
      events.push({
        id: `insurance-${policy.id}-${schedule.installment}`,
        date: schedule.date,
        direction: 'debit',
        amount: schedule.payment,
        title: `${policy.policyName} · Premium`,
        subtitle: [policy.provider, policy.paymentAccount, policy.premiumFrequency, schedule.status].filter(Boolean).join(' · '),
        schedule,
        insurance: policy,
      });
    }
    for (const schedule of insuranceMaturitySchedule(policy, fromDate, toDate, asOf)) {
      events.push({
        id: `insurance-maturity-${policy.id}`,
        date: schedule.date,
        direction: 'credit',
        amount: schedule.payment,
        title: `${policy.policyName} · Maturity payout`,
        subtitle: [policy.provider, schedule.payment > 0 ? 'Insurance maturity' : 'Maturity amount not provided'].filter(Boolean).join(' · '),
        schedule,
        insurance: policy,
        maturityPayout: true,
        amountKnown: policy.maturityPayoutAmount != null,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
