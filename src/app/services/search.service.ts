import { computed, inject, Injectable } from '@angular/core';
import { formatInr } from '../utilities/format';
import { PortfolioService } from './portfolio.service';

export interface SearchResult {
  label: string;
  sublabel: string;
  icon: string;
  route: string;
  haystack: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly portfolio = inject(PortfolioService);

  private readonly index = computed<SearchResult[]>(() => {
    const d = this.portfolio.data();
    const r = (label: string, sublabel: string, icon: string, route: string, ...extra: (string | undefined)[]): SearchResult => ({
      label, sublabel, icon, route, haystack: [label, sublabel, ...extra].join(' ').toLowerCase(),
    });
    return [
      ...d.properties.map((p) => r(p.name, `Property · ${formatInr(p.currentValue)}`, 'apartment', '/properties', p.address, p.type)),
      ...d.agricultureLands.map((l) => r(l.name, `Land · ${l.village}, ${l.district}`, 'grass', '/agriculture', l.cropType, l.surveyNumber)),
      ...d.livestock.map((l) => r(
        `${l.tagNumber ? `#${l.tagNumber} ` : ''}${l.breed} ${l.animalType}`,
        `Livestock · ${l.count} head · ${l.farmName ?? 'Location not set'}`,
        'pets',
        '/livestock',
        l.farmName,
      )),
      ...d.lending.map((l) => r(l.borrowerName, `Lending · ${formatInr(l.principal)}`, 'handshake', '/lending', l.mobile, l.loanType)),
      ...d.stocks.map((s) => r(s.symbol, `Stock · ${s.name}`, 'candlestick_chart', '/stocks', s.sector)),
      ...d.mutualFunds.map((f) => r(f.fundName, `Mutual Fund · ${f.amc}`, 'pie_chart', '/mutual-funds', f.folio, f.category)),
      ...d.fixedDeposits.map((f) => r(`${f.bank} FD`, `FD · ${formatInr(f.principal)}`, 'savings', '/fixed-deposits', f.accountNumber)),
      ...d.assets.map((a) => r(a.name, `${a.category} · ${formatInr(a.currentValue)}`, 'account_balance_wallet', '/other-assets', a.institution)),
      ...d.insurance.map((i) => r(i.policyName, `Insurance · ${i.provider}`, 'health_and_safety', '/insurance', i.policyNumber, i.category)),
      ...d.vehicles.map((v) => r(v.registrationNumber, `Vehicle · ${v.make} ${v.model}`, 'directions_car', '/vehicles')),
      ...d.liabilities.map((l) => r(l.name, `${l.type} · ${l.lender}`, 'credit_card', '/liabilities')),
      ...d.goals.map((g) => r(g.name, `Goal · ${formatInr(g.targetAmount)}`, 'flag', '/goals', g.category)),
    ];
  });

  search(query: string, limit = 8): SearchResult[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return this.index().filter((i) => i.haystack.includes(q)).slice(0, limit);
  }
}
