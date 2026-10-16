import { Insurance, Lending, Liability } from '../models/wealth.models';
import { cashflowEvents, insuranceSchedule, lendingSchedule, liabilitySchedule } from './repayment-calendar';

describe('repayment calendar', () => {
  const openEndedLending: Lending = {
    id: 'open-loan',
    borrowerName: 'Srinivas',
    mobile: '',
    principal: 4_000_000,
    interestRate: 24,
    interestType: 'Flat',
    loanType: 'Personal',
    startDate: '2025-09-01',
    paymentDay: 1,
    amountRecovered: 0,
    status: 'Active',
  };

  const liability: Liability = {
    id: 'home-loan',
    name: 'Home loan',
    type: 'Home Loan',
    lender: 'Bank',
    principal: 1_000_000,
    outstanding: 1_000_000,
    interestRate: 9,
    emi: 31_000,
    startDate: '2025-09-01',
    tenureMonths: 36,
    paymentDay: 1,
  };

  const insurance: Insurance = {
    id: 'health-policy',
    policyNumber: 'POL-1',
    provider: 'Insurer',
    policyName: 'Health policy',
    category: 'Health',
    coverage: 1_000_000,
    premium: 12_000,
    premiumFrequency: 'Monthly',
    premiumPaymentDate: '2025-01-31',
    paymentAccount: 'ICICI Bank',
    renewalDate: '2026-01-31',
  };

  it('generates open-ended lending receipts beyond the default schedule horizon', () => {
    const asOf = new Date(2026, 9, 16);
    const events = cashflowEvents(
      [openEndedLending],
      [],
      new Date(2028, 0, 1),
      new Date(2028, 0, 31),
      asOf,
    );

    expect(events.length).toBe(1);
    expect(events[0].date).toBe('2028-01-01');
    expect(events[0].direction).toBe('credit');
    expect(events[0].amount).toBe(80_000);
  });

  it('includes debits and clamps payment days to the last day of short months', () => {
    const events = cashflowEvents(
      [ { ...openEndedLending, paymentDay: 31, startDate: '2025-01-01' } ],
      [liability],
      new Date(2025, 1, 1),
      new Date(2025, 1, 28),
      new Date(2025, 0, 1),
    );

    expect(events.map(({ direction, date }) => [direction, date])).toEqual([
      ['debit', '2025-02-01'],
      ['credit', '2025-02-28'],
    ]);
  });

  it('builds the liability repayment schedule with the configured payment day', () => {
    const rows = liabilitySchedule(liability, new Date(2025, 8, 1));

    expect(rows[0].date).toBe('2025-10-01');
    expect(rows[0].payment).toBe(31_000);
    expect(rows[0].principal).toBeGreaterThan(0);
    expect(rows[0].interest).toBeGreaterThan(0);
  });

  it('keeps the assumed EMI stable when extending an open-ended reducing schedule', () => {
    const loan: Lending = {
      ...openEndedLending,
      interestType: 'Reducing',
      paymentDay: 1,
    };
    const near = lendingSchedule(loan, new Date(2026, 9, 16));
    const far = lendingSchedule(loan, new Date(2026, 9, 16), new Date(2028, 0, 31));

    expect(far[0].payment).toBe(near[0].payment);
    expect(far.length).toBeGreaterThan(near.length);
  });

  it('schedules recurring insurance premiums from the configured payment date', () => {
    const rows = insuranceSchedule(insurance, new Date(2025, 1, 1), new Date(2025, 2, 31));

    expect(rows.map(({ date }) => date)).toEqual(['2025-02-28', '2025-03-31']);
  });

  it('adds insurance premiums as debits with account details', () => {
    const events = cashflowEvents(
      [],
      [],
      new Date(2025, 0, 1),
      new Date(2025, 0, 31),
      new Date(2025, 0, 1),
      [insurance],
    );

    expect(events).toHaveSize(1);
    expect(events[0].direction).toBe('debit');
    expect(events[0].subtitle).toContain('ICICI Bank');
    expect(events[0].amount).toBe(12_000);
  });
});
