import { effect, inject, Injectable } from '@angular/core';
import { StockRepositoryService } from './repositories/repositories';
import { StockMarketDataService } from './stock-market-data.service';
import { ToastService } from './toast.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class StockQuoteAutoRefreshService {
  private readonly stocks = inject(StockRepositoryService);
  private readonly marketData = inject(StockMarketDataService);
  private readonly toast = inject(ToastService);
  private readonly attempted = new Set<string>();

  constructor() {
    effect(() => {
      if (!this.stocks.loaded()) return;
      const now = Date.now();
      for (const stock of this.stocks.items()) {
        if (stock.currency !== 'USD' || (stock.priceFetchedAt ?? 0) > now - DAY_MS || this.attempted.has(stock.id)) continue;
        this.attempted.add(stock.id);
        void this.marketData.updateStock(stock).then((result) => {
          if (result.quoteIsFallback || result.fxIsFallback) {
            const kept = [
              result.quoteIsFallback ? 'saved share price' : '',
              result.fxIsFallback ? 'saved USD/INR rate' : '',
            ].filter(Boolean).join(' and ');
            this.toast.info(`Live data unavailable for ${stock.symbol}; kept the ${kept}.`);
          }
        }).catch((err: unknown) => {
          console.error(`Unable to refresh ${stock.symbol} quote`, err);
          this.toast.error(err instanceof Error ? `Unable to refresh ${stock.symbol}: ${err.message}` : `Unable to refresh ${stock.symbol} quote`);
        });
      }
    });
  }
}
