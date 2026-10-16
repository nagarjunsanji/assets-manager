import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { PortfolioService } from '../../services/portfolio.service';
import { LendingScheduleDialog, LendingScheduleDialogData } from './lending-schedule-dialog';
import {
  cashflowEvents, CashflowDirection, CashflowEvent, insuranceSchedule, lendingSchedule, liabilitySchedule,
} from '../../utilities/repayment-calendar';
import { formatInr } from '../../utilities/format';

interface CalendarCell {
  date: string;
  day: number;
  currentMonth: boolean;
  events: CashflowEvent[];
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayStart(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

@Component({
  selector: 'app-calendar-page',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="page">
      <section class="page-heading">
        <div>
          <p class="eyebrow">Cashflow planning</p>
          <h1>Cashflow Calendar</h1>
          <p class="muted">Scheduled money in and out from your private loans and repayments.</p>
        </div>
        <div class="legend">
          <span><i class="credit-dot"></i> Credit · money received</span>
          <span><i class="debit-dot"></i> Debit · money paid</span>
        </div>
      </section>

      <section class="summary-grid">
        <article class="glass-card summary-card credit-summary">
          <span>Credits this month</span>
          <strong>{{ fmt(monthTotals().credits) }}</strong>
          <small>{{ monthTotals().creditCount }} scheduled receipts</small>
        </article>
        <article class="glass-card summary-card debit-summary">
          <span>Debits this month</span>
          <strong>{{ fmt(monthTotals().debits) }}</strong>
          <small>{{ monthTotals().debitCount }} scheduled payments</small>
        </article>
        <article class="glass-card summary-card">
          <span>Net scheduled cashflow</span>
          <strong [class.positive]="monthTotals().net >= 0" [class.negative]="monthTotals().net < 0">
            {{ fmt(monthTotals().net) }}
          </strong>
          <small>Based on current loan schedules</small>
        </article>
      </section>

      <section class="glass-card calendar-card">
        <header class="calendar-toolbar">
          <div class="month-controls">
            <button mat-icon-button aria-label="Previous month" (click)="changeMonth(-1)"><mat-icon>chevron_left</mat-icon></button>
            <h2>{{ monthLabel() }}</h2>
            <button mat-icon-button aria-label="Next month" (click)="changeMonth(1)"><mat-icon>chevron_right</mat-icon></button>
          </div>
          <button mat-stroked-button (click)="goToToday()">Today</button>
        </header>
        @if (!portfolio.lending.loaded() || !portfolio.liabilities.loaded() || !portfolio.insurance.loaded()) {
          <p class="muted loading">Loading lending and liability schedules…</p>
        } @else {
          <div class="weekday-row" aria-hidden="true">
            @for (weekday of weekdays; track weekday) {
              <span>{{ weekday }}</span>
            }
          </div>
          <div class="calendar-grid" role="grid" [attr.aria-label]="monthLabel()">
            @for (cell of cells(); track cell.date) {
              <div class="day-wrapper" role="gridcell">
                <button
                  class="day-cell"
                  [class.outside]="!cell.currentMonth"
                  [class.selected]="cell.date === selectedDate()"
                  [class.today]="cell.date === today"
                  [attr.aria-label]="cellAriaLabel(cell)"
                  [attr.aria-pressed]="cell.date === selectedDate()"
                  (click)="selectDate(cell.date)"
                >
                  <span class="day-number">{{ cell.day }}</span>
                  <span class="event-dots">
                    @if (cell.events.some(isCredit)) { <i class="credit-dot" aria-hidden="true"></i> }
                    @if (cell.events.some(isDebit)) { <i class="debit-dot" aria-hidden="true"></i> }
                  </span>
                  @if (cell.events.length > 0) {
                    <span class="event-count">{{ cell.events.length }}</span>
                  }
                </button>
                @if (cell.events.length > 0) {
                  <div class="day-hover-card">
                    <strong class="hover-date">{{ formatDate(cell.date) }}</strong>
                    <table class="hover-table">
                      <thead>
                        <tr><th>Type</th><th>Details</th><th>Amount</th></tr>
                      </thead>
                      <tbody>
                        @for (event of cell.events; track event.id) {
                          <tr [class.credit-row]="event.direction === 'credit'" [class.debit-row]="event.direction === 'debit'">
                            <td>{{ event.direction === 'credit' ? 'Credit' : 'Debit' }}</td>
                            <td>
                              <strong>{{ event.title }}</strong>
                              @if (event.subtitle) { <small>{{ event.subtitle }}</small> }
                            </td>
                            <td>{{ fmt(event.amount) }}</td>
                          </tr>
                        }
                      </tbody>
                      <tfoot>
                        @if (cell.events.some(isCredit)) {
                          <tr class="credit-row"><th colspan="2">Total credits</th><th>{{ fmt(totalFor(cell, 'credit')) }}</th></tr>
                        }
                        @if (cell.events.some(isDebit)) {
                          <tr class="debit-row"><th colspan="2">Total debits</th><th>{{ fmt(totalFor(cell, 'debit')) }}</th></tr>
                        }
                      </tfoot>
                    </table>
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>

      <section class="detail-grid">
        <article class="glass-card day-events">
          <header>
            <div>
              <p class="eyebrow">Selected day</p>
              <h2>{{ selectedDateLabel() }}</h2>
            </div>
            <span class="chip tone-info">{{ selectedEvents().length }} scheduled</span>
          </header>
          @for (event of selectedEvents(); track event.id) {
            <button
              class="event-row"
              [class.credit-event]="event.direction === 'credit'"
              [class.debit-event]="event.direction === 'debit'"
              [class.active]="selectedEvent()?.id === event.id"
              (click)="selectEvent(event)"
            >
              <span class="event-symbol">{{ event.direction === 'credit' ? '↓' : '↑' }}</span>
              <span class="event-copy">
                <strong>{{ event.title }}</strong>
                <small>{{ event.subtitle }}</small>
              </span>
              <strong class="event-amount">{{ event.direction === 'credit' ? '+' : '−' }}{{ fmt(event.amount) }}</strong>
            </button>
          } @empty {
            <p class="muted empty-state">No payments or receipts are scheduled for this day.</p>
          }
        </article>

        <article class="glass-card schedule-card">
          @if (selectedEvent(); as selected) {
            <header>
              <div>
                <p class="eyebrow">{{ selected.direction === 'credit' ? 'Money received' : 'Money paid' }}</p>
                <h2>{{ scheduleTitle(selected) }}</h2>
                <p class="muted">{{ scheduleDescription(selected) }}</p>
              </div>
              <button mat-icon-button aria-label="Close schedule" (click)="selectedEvent.set(null)"><mat-icon>close</mat-icon></button>
            </header>
            <p class="schedule-note">Choose the monthly payout or debit date on the lending or liability record. Insurance premiums use the next premium payment date and selected frequency.</p>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>#</th>
                    <th>Payment</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of selectedSchedule(); track row.installment) {
                    <tr [class.row-paid]="row.status === 'Paid'">
                      <td>{{ formatDate(row.date) }}</td>
                      <td>{{ row.installment }}</td>
                      <td>{{ fmt(row.payment) }}</td>
                      <td>{{ fmt(row.principal) }}</td>
                      <td>{{ fmt(row.interest) }}</td>
                      <td>{{ fmt(row.balance) }}</td>
                      <td>{{ row.status }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="schedule-placeholder">
              <mat-icon>event_note</mat-icon>
              <h2>Payment schedule</h2>
              <p class="muted">Select a credit or debit to view its EMI or interest schedule.</p>
            </div>
          }
        </article>
      </section>
    </div>
  `,
  styleUrl: './calendar.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  protected readonly portfolio = inject(PortfolioService);
  private readonly dialog = inject(MatDialog);
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly today = localIsoDate(new Date());
  protected readonly fmt = formatInr;
  protected readonly viewedMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly selectedDate = signal(this.today);
  protected readonly selectedEvent = signal<CashflowEvent | null>(null);

  protected readonly monthLabel = computed(() =>
    this.viewedMonth().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  );

  private readonly range = computed(() => {
    const month = this.viewedMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = mondayStart(first);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41);
    return { start, end };
  });

  protected readonly events = computed(() => {
    const range = this.range();
    return cashflowEvents(
      this.portfolio.lending.items(),
      this.portfolio.liabilities.items(),
      range.start,
      range.end,
      new Date(),
      this.portfolio.insurance.items(),
    );
  });

  protected readonly cells = computed<CalendarCell[]>(() => {
    const { start } = this.range();
    const month = this.viewedMonth().getMonth();
    const byDate = new Map<string, CashflowEvent[]>();
    for (const event of this.events()) {
      byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
    }
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = localIsoDate(date);
      return { date: key, day: date.getDate(), currentMonth: date.getMonth() === month, events: byDate.get(key) ?? [] };
    });
  });

  protected readonly selectedEvents = computed(() =>
    this.events().filter((event) => event.date === this.selectedDate()),
  );

  protected readonly monthTotals = computed(() => {
    const month = this.viewedMonth();
    const monthly = this.events().filter((event) => {
      const date = new Date(`${event.date}T00:00:00`);
      return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    });
    const credits = monthly.filter((event) => event.direction === 'credit');
    const debits = monthly.filter((event) => event.direction === 'debit');
    const creditTotal = credits.reduce((total, event) => total + event.amount, 0);
    const debitTotal = debits.reduce((total, event) => total + event.amount, 0);
    return {
      credits: creditTotal,
      debits: debitTotal,
      creditCount: credits.length,
      debitCount: debits.length,
      net: creditTotal - debitTotal,
    };
  });

  protected readonly selectedSchedule = computed(() => {
    const event = this.selectedEvent();
    if (!event) return [];
    return event.lending
      ? lendingSchedule(event.lending)
      : event.liability
        ? liabilitySchedule(event.liability)
        : event.insurance
          ? insuranceSchedule(event.insurance, new Date(), new Date(new Date().getFullYear() + 5, new Date().getMonth(), new Date().getDate()))
          : [];
  });

  protected readonly selectedDateLabel = computed(() =>
    new Date(`${this.selectedDate()}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
  );

  protected isCredit(event: CashflowEvent): boolean {
    return event.direction === 'credit';
  }

  protected isDebit(event: CashflowEvent): boolean {
    return event.direction === 'debit';
  }

  protected totalFor(cell: CalendarCell, direction: CashflowDirection): number {
    return cell.events
      .filter((event) => event.direction === direction)
      .reduce((sum, event) => sum + event.amount, 0);
  }

  protected cellAriaLabel(cell: CalendarCell): string {
    if (!cell.events.length) return `${cell.date}, no scheduled cashflow items`;
    const credits = cell.events.filter((event) => event.direction === 'credit');
    const debits = cell.events.filter((event) => event.direction === 'debit');
    const creditTotal = credits.reduce((sum, event) => sum + event.amount, 0);
    const debitTotal = debits.reduce((sum, event) => sum + event.amount, 0);
    return [
      cell.date,
      `${cell.events.length} scheduled cashflow item${cell.events.length === 1 ? '' : 's'}`,
      credits.length ? `credits total ${this.fmt(creditTotal)}` : '',
      debits.length ? `debits total ${this.fmt(debitTotal)}` : '',
    ].filter(Boolean).join(', ');
  }

  protected changeMonth(amount: number): void {
    const current = this.viewedMonth();
    const next = new Date(current.getFullYear(), current.getMonth() + amount, 1);
    this.viewedMonth.set(next);
    this.selectedDate.set(localIsoDate(next));
    this.selectedEvent.set(null);
  }

  protected goToToday(): void {
    const now = new Date();
    this.viewedMonth.set(new Date(now.getFullYear(), now.getMonth(), 1));
    this.selectedDate.set(localIsoDate(now));
    this.selectedEvent.set(null);
  }

  protected selectDate(date: string): void {
    const selected = new Date(`${date}T00:00:00`);
    this.selectedDate.set(date);
    if (selected.getMonth() !== this.viewedMonth().getMonth() || selected.getFullYear() !== this.viewedMonth().getFullYear()) {
      this.viewedMonth.set(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    this.selectedEvent.set(null);
  }

  protected selectEvent(event: CashflowEvent): void {
    if (event.lending) {
      this.dialog.open<LendingScheduleDialog, LendingScheduleDialogData>(LendingScheduleDialog, {
        data: { lending: event.lending },
        width: 'min(1000px, 96vw)',
        maxWidth: '96vw',
        autoFocus: false,
      });
      return;
    }
    this.selectedEvent.set(event);
  }

  protected scheduleTitle(event: CashflowEvent): string {
    return event.lending
      ? `${event.lending.loanName || event.lending.borrowerName} · ${event.lending.interestType} schedule`
      : event.liability
        ? `${event.liability.name} · EMI schedule`
        : `${event.insurance?.policyName ?? 'Insurance'} · Premium schedule`;
  }

  protected scheduleDescription(event: CashflowEvent): string {
    const record = event.lending;
    if (record) return `${record.interestRate}% annual rate · ${record.endDate ? `ends ${this.formatDate(record.endDate)}` : 'open-ended'}`;
    const liability = event.liability;
    if (liability) return `${liability.lender} · ${liability.interestRate}% annual rate · ${liability.tenureMonths} months`;
    const policy = event.insurance;
    return policy ? `${policy.provider} · ${policy.premiumFrequency} premium${policy.paymentAccount ? ` · Paid from ${policy.paymentAccount}` : ''}` : '';
  }

  protected formatDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
