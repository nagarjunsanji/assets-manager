import { Insurance, Lending, Liability } from '../models/wealth.models';
import { liabilityMetrics } from './finance';
import {
  cashflowEvents, insuranceEffectiveMaturityDate, insuranceSchedule, lendingSchedule, liabilitySchedule,
} from './repayment-calendar';

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
    premiumPaymentDay: 5,
    startDate: '2025-01-31',
    paymentAccount: 'ICICI Bank',
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

  it('excludes planned loans from outstanding repayment and interest calculations', () => {
    const planned: Liability = {
      ...liability,
      status: 'Planned',
      principal: 10_350_900,
      outstanding: 0,
      emi: 0,
      startDate: '2026-11-01',
      tenureMonths: 180,
    };

    expect(liabilitySchedule(planned, new Date(2026, 9, 16))).toEqual([]);
    expect(liabilityMetrics(planned, new Date(2026, 9, 16))).toEqual({
      elapsedMonths: 0,
      remainingMonths: 180,
      principalRepaid: 0,
      interestPaid: 0,
      repaidPct: 0,
      monthlyInterest: 0,
    });
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

  it('schedules recurring insurance premiums from policy start using the configured payment day', () => {
    const rows = insuranceSchedule(insurance, new Date(2025, 0, 1), new Date(2025, 2, 31));

    expect(rows.map(({ date }) => date)).toEqual(['2025-02-05', '2025-03-05']);
  });

  it('does not schedule premiums after the policy maturity date', () => {
    const rows = insuranceSchedule(
      { ...insurance, maturityDate: '2025-03-10' },
      new Date(2025, 1, 1),
      new Date(2025, 3, 30),
    );

    expect(rows.map(({ date }) => date)).toEqual(['2025-02-05', '2025-03-05']);
  });

  it('prefers maturity date over policy end date for premium cutoff', () => {
    const rows = insuranceSchedule(
      {
        ...insurance,
        endDate: '2025-04-10',
        maturityDate: '2025-06-10',
      },
      new Date(2025, 1, 1),
      new Date(2025, 5, 30),
    );

    expect(rows.map(({ date }) => date)).toEqual([
      '2025-02-05', '2025-03-05', '2025-04-05', '2025-05-05', '2025-06-05',
    ]);
  });

  it('falls back to policy end date when maturity date is absent', () => {
    expect(insuranceEffectiveMaturityDate({ ...insurance, endDate: '2025-04-10' })).toBe('2025-04-10');
    expect(insuranceEffectiveMaturityDate({ ...insurance, maturityDate: '2025-06-10', endDate: '2025-04-10' })).toBe('2025-06-10');
  });

  it('does not schedule the first premium before the policy start date', () => {
    const rows = insuranceSchedule(
      { ...insurance, startDate: '2025-01-20', premiumPaymentDay: 5 },
      new Date(2025, 0, 1),
      new Date(2025, 1, 28),
    );

    expect(rows.map(({ date }) => date)).toEqual(['2025-02-05']);
  });

  it('schedules annual premiums in the policy start month on the selected day', () => {
    const rows = insuranceSchedule(
      { ...insurance, premiumFrequency: 'Yearly', startDate: '2025-01-20', premiumPaymentDay: 5 },
      new Date(2025, 0, 1),
      new Date(2027, 0, 31),
    );

    expect(rows.map(({ date }) => date)).toEqual(['2026-01-05', '2027-01-05']);
  });

  it('schedules quarterly premiums every three months from the policy start month', () => {
    const rows = insuranceSchedule(
      { ...insurance, premiumFrequency: 'Quarterly', startDate: '2025-01-20', premiumPaymentDay: 5 },
      new Date(2025, 0, 1),
      new Date(2025, 9, 31),
    );

    expect(rows.map(({ date }) => date)).toEqual(['2025-04-05', '2025-07-05', '2025-10-05']);
  });

  it('clamps a selected payment day to the last day of shorter months', () => {
    const rows = insuranceSchedule(
      { ...insurance, startDate: '2025-01-31', premiumPaymentDay: 31 },
      new Date(2025, 1, 1),
      new Date(2025, 2, 31),
    );

    expect(rows.map(({ date }) => date)).toEqual(['2025-02-28', '2025-03-31']);
  });

  it('adds maturity payouts as credits, showing an unknown amount without using coverage as a guess', () => {
    const policy: Insurance = {
      ...insurance,
      maturityDate: '2025-02-20',
    };
    const events = cashflowEvents(
      [],
      [],
      new Date(2025, 1, 1),
      new Date(2025, 1, 28),
      new Date(2025, 0, 1),
      [policy],
    );
    const maturity = events.find((event) => event.maturityPayout);

    expect(maturity).toBeDefined();
    expect(maturity?.date).toBe('2025-02-20');
    expect(maturity?.direction).toBe('credit');
    expect(maturity?.amount).toBe(0);
    expect(maturity?.amountKnown).toBe(false);
  });

  it('uses the entered maturity payout amount in the calendar credit', () => {
    const events = cashflowEvents(
      [],
      [],
      new Date(2025, 1, 1),
      new Date(2025, 1, 28),
      new Date(2025, 0, 1),
      [{ ...insurance, maturityDate: '2025-02-20', maturityPayoutAmount: 125_000 }],
    );
    const maturity = events.find((event) => event.maturityPayout);

    expect(maturity?.amount).toBe(125_000);
    expect(maturity?.amountKnown).toBe(true);
  });

  it('uses policy end date as the maturity event date when maturity date is absent', () => {
    const events = cashflowEvents(
      [],
      [],
      new Date(2025, 3, 1),
      new Date(2025, 3, 30),
      new Date(2025, 0, 1),
      [{ ...insurance, endDate: '2025-04-10' }],
    );

    expect(events.find((event) => event.maturityPayout)?.date).toBe('2025-04-10');
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
