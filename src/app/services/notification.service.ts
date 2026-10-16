import { computed, inject, Injectable, signal } from '@angular/core';
import { AppNotification } from '../models/analytics.models';
import { daysUntil, fdMetrics, lendingMetrics } from '../utilities/finance';
import { formatDate, formatInr } from '../utilities/format';
import { cashflowEvents } from '../utilities/repayment-calendar';
import { PortfolioService } from './portfolio.service';

const DISMISSED_KEY = 'asset-manager.dismissed-alerts';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly portfolio = inject(PortfolioService);
  private readonly dismissed = signal<string[]>(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'));

  readonly all = computed<AppNotification[]>(() => {
    const d = this.portfolio.data();
    const out: AppNotification[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reminderEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

    for (const event of cashflowEvents(d.lending, d.liabilities, today, reminderEnd, today, d.insurance)) {
      const [year, month, day] = event.date.split('-').map(Number);
      const eventDay = Date.UTC(year, month - 1, day);
      const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const days = Math.round((eventDay - todayUtc) / 86_400_000);
      if (days < 0 || days > 7 || event.schedule.status === 'Paid') continue;
      const isCredit = event.direction === 'credit';
      out.push({
        id: `cashflow-${event.id}`,
        severity: 'info',
        icon: isCredit ? 'south' : 'north',
        cashflow: event.direction,
        title: days === 0
          ? `${isCredit ? 'Credit expected' : 'Payment due'} today`
          : `${isCredit ? 'Credit expected' : 'Payment due'} in ${days} ${days === 1 ? 'day' : 'days'}`,
        message: `${event.title} · ${event.amountKnown === false ? 'Amount not provided' : formatInr(event.amount)} · ${formatDate(event.date)} · ${event.subtitle}`,
        date: event.date,
        route: '/calendar',
      });
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

  readonly active = computed(() => {
    const dismissed = new Set(this.dismissed());
    return this.all().filter((n) => !dismissed.has(n.id));
  });

  readonly unreadCount = computed(() => this.active().length);

  dismiss(id: string): void {
    this.persist([...this.dismissed(), id]);
  }

  dismissAll(): void {
    this.persist([...this.dismissed(), ...this.active().map((n) => n.id)]);
  }

  private persist(ids: string[]): void {
    const unique = [...new Set(ids)].slice(-300);
    this.dismissed.set(unique);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(unique));
  }
}
