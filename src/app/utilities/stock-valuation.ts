import { Stock } from '../models/wealth.models';

export function stockCurrentPriceInr(stock: Stock): number {
  const rate = stock.currency === 'USD' ? stock.exchangeRateToInr ?? 0 : 1;
  return stock.currentPrice * rate;
}

export function stockPurchasePriceInr(stock: Stock): number {
  const rate = stock.currency === 'USD'
    ? stock.purchaseExchangeRateToInr ?? stock.exchangeRateToInr ?? 0
    : 1;
  return stock.purchasePrice * rate;
}

export function stockMarketValueInr(stock: Stock): number {
  return stock.quantity * stockCurrentPriceInr(stock);
}

export function stockInvestedValueInr(stock: Stock): number {
  return stock.quantity * stockPurchasePriceInr(stock);
}
