const inrFull = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Indian-style compact currency: ₹1.25 Cr, ₹12.40 L, ₹45.2K */
export function formatInr(value: number | null | undefined, compact = true): string {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v)) return '₹0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (compact) {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  }
  return `${sign}₹${inrFull.format(abs)}`;
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  const v = Number(value ?? 0);
  return `${Number.isFinite(v) ? v.toFixed(decimals) : '0'}%`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: decimals }).format(Number(value ?? 0));
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function periodKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
