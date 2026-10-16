import { Stock } from '../models/wealth.models';
import {
  stockCurrentPriceInr, stockInvestedValueInr, stockMarketValueInr, stockPurchasePriceInr,
} from './stock-valuation';

describe('stock INR valuation', () => {
  it('keeps legacy INR stock calculations unchanged', () => {
    const stock: Stock = {
      id: 'local-stock',
      symbol: 'ABC',
      name: 'ABC Ltd',
      exchange: 'NSE',
      currency: 'INR',
      quantity: 10,
      purchasePrice: 100,
      currentPrice: 125,
      sector: 'IT',
    };

    expect(stockInvestedValueInr(stock)).toBe(1_000);
    expect(stockMarketValueInr(stock)).toBe(1_250);
    expect(stockPurchasePriceInr(stock)).toBe(100);
    expect(stockCurrentPriceInr(stock)).toBe(125);
  });

  it('converts USD cost basis and market value to INR using their respective FX rates', () => {
    const stock: Stock = {
      id: 'mrvl',
      symbol: 'MRVL',
      name: 'Marvell Technology, Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      quantity: 1_397,
      purchasePrice: 242.37,
      purchaseExchangeRateToInr: 95.06,
      currentPrice: 250,
      exchangeRateToInr: 95.03,
      sector: 'IT',
    };

    expect(stockInvestedValueInr(stock)).toBeCloseTo(1_397 * 242.37 * 95.06, 6);
    expect(stockMarketValueInr(stock)).toBeCloseTo(1_397 * 250 * 95.03, 6);
    expect(stockPurchasePriceInr(stock)).toBeCloseTo(242.37 * 95.06, 6);
    expect(stockCurrentPriceInr(stock)).toBeCloseTo(250 * 95.03, 6);
  });

  it('uses the current exchange rate as the cost-basis FX fallback', () => {
    const stock: Stock = {
      id: 'mrvl',
      symbol: 'MRVL',
      name: 'Marvell Technology, Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      quantity: 1,
      purchasePrice: 100,
      currentPrice: 120,
      exchangeRateToInr: 90,
      sector: 'IT',
    };

    expect(stockInvestedValueInr(stock)).toBe(9_000);
    expect(stockMarketValueInr(stock)).toBe(10_800);
  });
});
