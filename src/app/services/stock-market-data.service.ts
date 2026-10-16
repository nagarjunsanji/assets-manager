import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IsoDate, Stock } from '../models/wealth.models';
import { StockRepositoryService } from './repositories/repositories';

export interface UsStockQuote {
  symbol: string;
  priceUsd: number;
  quoteTimestamp?: string;
  exchangeRateToInr: number;
  fxRateDate?: IsoDate;
  quoteIsFallback: boolean;
  fxIsFallback: boolean;
}

export interface UsStockQuoteFallback {
  priceUsd?: number;
  quoteTimestamp?: string;
  exchangeRateToInr?: number;
  fxRateDate?: IsoDate;
}

export interface StockQuoteRefreshResult {
  quoteIsFallback: boolean;
  fxIsFallback: boolean;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        preMarketPrice?: number;
        preMarketTime?: number;
        postMarketPrice?: number;
        postMarketTime?: number;
      };
    }> | null;
    error?: { description?: string } | null;
  };
}

interface FrankfurterRate {
  base?: string;
  quote?: string;
  date?: string;
  rate?: number;
}

@Injectable({ providedIn: 'root' })
export class StockMarketDataService {
  private readonly http = inject(HttpClient);
  private readonly stocks = inject(StockRepositoryService);

  async fetchUsdQuote(symbol: string, fallback: UsStockQuoteFallback = {}): Promise<UsStockQuote> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(normalizedSymbol)) throw new Error('A valid US stock symbol is required.');

    const [chartResult, rateResult] = await Promise.allSettled([
      firstValueFrom(this.http.get<YahooChartResponse>(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}?interval=1d&range=1d`,
        { timeout: 10_000 },
      )),
      firstValueFrom(this.http.get<FrankfurterRate[]>(
        'https://api.frankfurter.dev/v2/rates?base=USD&quotes=INR',
        { timeout: 10_000 },
      )),
    ]);

    const chartResponse = chartResult.status === 'fulfilled' ? chartResult.value : undefined;
    const meta = chartResponse?.chart?.result?.[0]?.meta;
    const latestQuote = [
      { price: meta?.regularMarketPrice, time: meta?.regularMarketTime },
      { price: meta?.preMarketPrice, time: meta?.preMarketTime },
      { price: meta?.postMarketPrice, time: meta?.postMarketTime },
    ].filter((quote): quote is { price: number; time: number } =>
      typeof quote.price === 'number' && Number.isFinite(quote.price) && quote.price > 0
      && typeof quote.time === 'number' && Number.isFinite(quote.time),
    ).sort((a, b) => a.time - b.time).at(-1);
    const liveQuoteValid = meta?.symbol?.toUpperCase() === normalizedSymbol
      && meta.currency === 'USD' && !!latestQuote;
    const rates = rateResult.status === 'fulfilled' ? rateResult.value : [];
    const rate = rates.find((item) => item.base === 'USD' && item.quote === 'INR');
    const liveRateValid = !!rate && typeof rate.rate === 'number' && Number.isFinite(rate.rate)
      && rate.rate > 0 && !!rate.date;
    const fallbackQuoteValid = typeof fallback.priceUsd === 'number'
      && Number.isFinite(fallback.priceUsd) && fallback.priceUsd > 0;
    const fallbackRateValid = typeof fallback.exchangeRateToInr === 'number'
      && Number.isFinite(fallback.exchangeRateToInr) && fallback.exchangeRateToInr > 0;

    if (!liveQuoteValid && !fallbackQuoteValid) {
      const message = chartResult.status === 'rejected'
        ? this.providerError('Yahoo Finance', chartResult.reason)
        : chartResponse?.chart?.error?.description ?? `No usable USD quote was returned for ${normalizedSymbol}.`;
      throw new Error(message);
    }
    if (!liveRateValid && !fallbackRateValid) {
      const message = rateResult.status === 'rejected'
        ? this.providerError('Frankfurter USD/INR', rateResult.reason)
        : 'No usable USD/INR reference rate was returned.';
      throw new Error(message);
    }

    return {
      symbol: normalizedSymbol,
      priceUsd: liveQuoteValid ? latestQuote.price : fallback.priceUsd!,
      quoteTimestamp: liveQuoteValid ? new Date(latestQuote.time * 1000).toISOString() : fallback.quoteTimestamp,
      exchangeRateToInr: liveRateValid ? rate!.rate! : fallback.exchangeRateToInr!,
      fxRateDate: liveRateValid ? rate.date : fallback.fxRateDate,
      quoteIsFallback: !liveQuoteValid,
      fxIsFallback: !liveRateValid,
    };
  }

  async updateStock(stock: Stock): Promise<StockQuoteRefreshResult> {
    if (stock.currency !== 'USD') throw new Error('Automatic quotes are only configured for USD stocks.');
    const quote = await this.fetchUsdQuote(stock.symbol, {
      priceUsd: stock.currentPrice,
      quoteTimestamp: stock.quoteTimestamp,
      exchangeRateToInr: stock.exchangeRateToInr,
      fxRateDate: stock.fxRateDate,
    });
    const updates: Partial<Stock> = {};
    if (!quote.quoteIsFallback) {
      updates.currentPrice = quote.priceUsd;
      updates.priceFetchedAt = Date.now();
      updates.quoteTimestamp = quote.quoteTimestamp;
    }
    if (!quote.fxIsFallback) {
      updates.exchangeRateToInr = quote.exchangeRateToInr;
      updates.fxRateDate = quote.fxRateDate;
    }
    if (Object.keys(updates).length) await this.stocks.update(stock.id, updates);
    return { quoteIsFallback: quote.quoteIsFallback, fxIsFallback: quote.fxIsFallback };
  }

  private providerError(provider: string, err: unknown): string {
    if (err instanceof HttpErrorResponse && err.status === 429) {
      return `${provider} is rate-limiting requests. The last saved value will be kept.`;
    }
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return `${provider} is not reachable from this browser (network or CORS restriction). The last saved value will be kept.`;
    }
    return err instanceof Error ? `${provider} request failed: ${err.message}` : `${provider} request failed.`;
  }
}
