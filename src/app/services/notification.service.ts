import { computed, inject, Injectable, signal } from '@angular/core';
import { AppNotification } from '../models/analytics.models';
import { PaymentConfirmation } from '../models/wealth.models';
import {
  LendingRepositoryService, LiabilityRepositoryService,
} from './repositories/repositories';
import { daysUntil, fdMetrics, lendingMetrics } from '../utilities/finance';
import { formatDate, formatInr } from '../utilities/format';
import { CashflowEvent, cashflowEvents } from '../utilities/repayment-calendar';
import { PortfolioService } from './portfolio.service';
import { ToastService } from './toast.service';

const DISMISSED_KEY = 'asset-manager.dismissed-alerts';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly portfolio = inject(PortfolioService);
  private readonly lendingRepo = inject(LendingRepositoryService);
  private readonly liabilityRepo = inject(LiabilityRepositoryService);
  private readonly toast = inject(ToastService);
  private readonly dismissed = signal<string[]>(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'));
  private readonly confirming = signal<string[]>([]);

  readonly all = computed<AppNotification[]>(() => {
    const d = this.portfolio.data();
    const out: AppNotification[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reminderEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
    const startDates = [
      ...d.lending.filter((loan) => loan.status !== 'Closed').map((loan) => loan.startDate),
      ...d.liabilities.filter((liability) => liability.status !== 'Planned' && liability.outstanding > 0)
        .map((liability) => liability.startDate),
    ].sort();
    const historyStart = startDates[0]
      ? new Date(`${startDates[0]}T00:00:00`)
      : today;

    const overdueEvents = new Map<string, { event: CashflowEvent; days: number }[]>();
    const events = cashflowEvents(d.lending, d.liabilities, historyStart, reminderEnd, today, d.insurance);
    for (const event of events) {
      if (!event.lending && !event.liability) continue;
      const [year, month, day] = event.date.split('-').map(Number);
      const eventDay = Date.UTC(year, month - 1, day);
      const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const days = Math.round((eventDay - todayUtc) / 86_400_000);
      if (days > 7 || event.schedule.status === 'Paid') continue;
      if (days < 0) {
        const key = event.lending ? `lending:${event.lending.id}` : `liability:${event.liability!.id}`;
        overdueEvents.set(key, [...(overdueEvents.get(key) ?? []), { event, days }]);
        continue;
      }
      out.push(this.paymentNotification(event, days));
    }

    for (const [key, pending] of overdueEvents) {
      pending.sort((a, b) => a.event.date.localeCompare(b.event.date));
      const oldest = pending[0];
      out.push(this.paymentNotification(oldest.event, oldest.days, pending.length, key));
    }

    for (const fd of d.fixedDeposits) {
      const days = fdMetrics(fd).daysToMaturity;
      if (days === null || days < -30 || days > 30) continue;
      out.push({
        id: `fd-${fd.id}-${fd.maturityDate}`,
        severity: days < 0 ? 'warning' : 'info',
        icon: 'savings',
        title: days < 0 ? `${fd.bank} FD matured` : `${fd.bank} FD matures in ${days} days`,
        message: `Principal ${formatInr(fd.principal)} · plan reinvestment`,
        date: fd.maturityDate,
        route: '/fixed-deposits',
      });
    }

    for (const loan of d.lending) {
      if (loan.status === 'Closed' || !loan.endDate) continue;
      const m = lendingMetrics(loan);
      if (m.daysToEnd === null || m.daysToEnd > 30 || m.outstanding <= 0) continue;
      out.push({
        id: `lend-${loan.id}-${loan.endDate}`,
        severity: m.daysToEnd < 0 ? 'critical' : 'warning',
        icon: 'handshake',
        title: m.daysToEnd < 0 ? `${loan.borrowerName} loan overdue` : `${loan.borrowerName} loan due in ${m.daysToEnd} days`,
        message: `Outstanding ${formatInr(m.outstanding)}`,
        date: loan.endDate,
        route: '/lending',
      });
    }

    for (const l of d.livestock) {
      const days = daysUntil(l.nextVaccination);
      if (days === null || days > 14) continue;
      out.push({
        id: `vac-${l.id}-${l.nextVaccination}`,
        severity: days < 0 ? 'warning' : 'info',
        icon: 'vaccines',
        title: `${l.breed} ${l.animalType} vaccination ${days < 0 ? 'overdue' : `in ${days} days`}`,
        message: `${l.count} animals · ${formatDate(l.nextVaccination)}`,
        date: l.nextVaccination!,
        route: '/livestock',
      });
    }

    for (const v of d.vehicles) {
      const days = daysUntil(v.insuranceRenewal);
      if (days === null || days > 30) continue;
      out.push({
        id: `veh-${v.id}-${v.insuranceRenewal}`,
        severity: days < 0 ? 'critical' : 'warning',
        icon: 'directions_car',
        title: `${v.registrationNumber} insurance ${days < 0 ? 'expired' : `renews in ${days} days`}`,
        message: `${v.make} ${v.model}`,
        date: v.insuranceRenewal!,
        route: '/vehicles',
      });
    }

    return out.sort((a, b) => a.date.localeCompare(b.date));
  });

  private paymentNotification(
    event: CashflowEvent,
    days: number,
    overdueInstallments = 0,
    overdueKey?: string,
  ): AppNotification {
    const isCredit = event.direction === 'credit';
    const kind = event.lending ? 'lending' as const : 'liability' as const;
    const label = event.lending ? 'Private lending receipt' : 'Loan payment';
    const confirmation = days === 0 || days < 0
      ? {
          kind,
          entityId: event.lending?.id ?? event.liability!.id,
          installment: event.schedule.installment,
          amount: event.amount,
          principal: event.schedule.principal,
          dueDate: event.date,
        }
      : undefined;
    const detail = event.lending?.loanName || event.lending?.borrowerName || event.liability?.name || event.title;
    const account = event.lending?.paymentAccount || event.liability?.paymentAccount;
    const periodText = days < 0
      ? `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}`
      : days === 0
        ? 'Due today'
        : `Due in ${days} ${days === 1 ? 'day' : 'days'}`;
    return {
      id: overdueKey ? `overdue-${overdueKey}` : `cashflow-${event.id}`,
      severity: days < 0 ? 'critical' : days <= 2 ? 'warning' : 'info',
      icon: isCredit ? 'south' : 'north',
      cashflow: event.direction,
      title: days < 0
        ? `${label} · overdue`
        : days === 0
          ? `${label} · due today`
          : `${label} · due in ${days} ${days === 1 ? 'day' : 'days'}`,
      message: `${detail} · ${formatInr(event.amount)} · ${periodText} (${formatDate(event.date)})${account ? ` · ${account}` : ''}`,
      date: event.date,
      route: event.lending ? '/lending' : '/liabilities',
      overdueInstallments: overdueInstallments || undefined,
      paymentConfirmation: confirmation,
    };
  }

  readonly active = computed(() => {
    const dismissed = new Set(this.dismissed());
    return this.all().filter((n) => n.paymentConfirmation || !dismissed.has(n.id));
  });

  readonly unreadCount = computed(() => this.active().length);

  dismiss(id: string): void {
    this.persist([...this.dismissed(), id]);
  }

  dismissAll(): void {
    this.persist([...this.dismissed(), ...this.active().filter((n) => !n.paymentConfirmation).map((n) => n.id)]);
  }

  isConfirming(notification: AppNotification): boolean {
    const confirmation = notification.paymentConfirmation;
    return !!confirmation && this.confirming().includes(`${confirmation.kind}:${confirmation.entityId}`);
  }

  async confirmPayment(notification: AppNotification): Promise<void> {
    const confirmation = notification.paymentConfirmation;
    if (!confirmation || this.isConfirming(notification)) return;

    const key = `${confirmation.kind}:${confirmation.entityId}`;
    this.confirming.update((pending) => [...pending, key]);
    try {
      const entry: PaymentConfirmation = {
        installment: confirmation.installment,
        dueDate: confirmation.dueDate,
        amount: confirmation.amount,
        principal: confirmation.principal,
        confirmedAt: new Date().toISOString(),
      };
      if (confirmation.kind === 'lending') {
        const record = this.lendingRepo.getById(confirmation.entityId);
        if (!record) throw new Error(`Could not find lending record ${confirmation.entityId}`);
        const paymentConfirmations = record.paymentConfirmations ?? [];
        if (paymentConfirmations.some((item) => item.installment === confirmation.installment)) return;
        const updatedConfirmations = [...paymentConfirmations, entry];
        const paymentsMade = this.contiguousPaymentsMade(record.paymentsMade, updatedConfirmations);
        await this.lendingRepo.update(record.id, {
          paymentConfirmations: updatedConfirmations,
          paymentsMade,
          amountRecovered: record.amountRecovered + confirmation.amount,
        });
      } else {
        const record = this.liabilityRepo.getById(confirmation.entityId);
        if (!record) throw new Error(`Could not find liability record ${confirmation.entityId}`);
        const paymentConfirmations = record.paymentConfirmations ?? [];
        if (paymentConfirmations.some((item) => item.installment === confirmation.installment)) return;
        const updatedConfirmations = [...paymentConfirmations, entry];
        const paymentsMade = this.contiguousPaymentsMade(record.paymentsMade, updatedConfirmations);
        await this.liabilityRepo.update(record.id, {
          paymentConfirmations: updatedConfirmations,
          paymentsMade,
          outstanding: Math.max(0, record.outstanding - confirmation.principal),
        });
      }
      this.toast.success(confirmation.kind === 'lending' ? 'Receipt confirmed.' : 'Payment confirmed.');
    } catch (error) {
      console.error('Could not confirm scheduled payment', error);
      this.toast.error('Could not save the payment confirmation. Please try again.');
    } finally {
      this.confirming.update((pending) => pending.filter((item) => item !== key));
    }
  }

  private persist(ids: string[]): void {
    const unique = [...new Set(ids)].slice(-300);
    this.dismissed.set(unique);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(unique));
  }

  private contiguousPaymentsMade(currentCount: number | undefined, confirmations: PaymentConfirmation[]): number {
    const paid = new Set(confirmations.map((confirmation) => confirmation.installment));
    let count = currentCount ?? 0;
    while (paid.has(count + 1)) count++;
    return count;
  }
}
