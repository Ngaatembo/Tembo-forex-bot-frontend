// Instruments the cockpit can show. IDs are exactly what the backend's
// /live/* endpoints accept: canonical forex/gold symbols, or
// "SYNTH:<Deriv symbol>" for Deriv synthetic indices.

export type InstrumentKind = 'forex' | 'metal' | 'synthetic';

export interface InstrumentMeta {
  id: string;
  code: string; // compact ticker shown in tabs ("XAUUSD")
  name: string; // long description ("Gold Spot / US Dollar")
  short: string; // tab subtitle
  kind: InstrumentKind;
  base?: string;
  quote?: string;
}

export const CORE_INSTRUMENTS: InstrumentMeta[] = [
  { id: 'XAU/USD', code: 'XAUUSD', name: 'Gold Spot / US Dollar', short: 'Gold', kind: 'metal', base: 'XAU', quote: 'USD' },
  { id: 'EUR/USD', code: 'EURUSD', name: 'Euro / US Dollar', short: 'Euro / US Dollar', kind: 'forex', base: 'EUR', quote: 'USD' },
  { id: 'GBP/USD', code: 'GBPUSD', name: 'British Pound / US Dollar', short: 'British Pound', kind: 'forex', base: 'GBP', quote: 'USD' },
  { id: 'USD/JPY', code: 'USDJPY', name: 'US Dollar / Japanese Yen', short: 'US Dollar / Yen', kind: 'forex', base: 'USD', quote: 'JPY' },
  { id: 'SYNTH:R_75', code: 'Volatility 75', name: 'Volatility 75 Index', short: 'Synthetics', kind: 'synthetic' },
  { id: 'SYNTH:BOOM1000', code: 'Boom 1000', name: 'Boom 1000 Index', short: 'Synthetics', kind: 'synthetic' },
  { id: 'SYNTH:CRASH1000', code: 'Crash 1000', name: 'Crash 1000 Index', short: 'Synthetics', kind: 'synthetic' },
];

export const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TF_SECONDS: Record<string, number> = { m5: 300, m15: 900, h1: 3600, h4: 14400, d1: 86400 };

export function isSynthetic(id: string) {
  return id.startsWith('SYNTH:');
}

/** Meta for any instrument id, including synthetics discovered at runtime. */
export function metaFor(id: string, displayName?: string | null): InstrumentMeta {
  const known = CORE_INSTRUMENTS.find((i) => i.id === id);
  if (known) return known;
  if (isSynthetic(id)) {
    const name = displayName || id.slice(6);
    return { id, code: name.replace(/ Index$/, ''), name, short: 'Synthetics', kind: 'synthetic' };
  }
  const code = id.replace('/', '');
  return { id, code, name: id, short: id, kind: 'forex', base: id.slice(0, 3), quote: id.slice(4, 7) };
}

/** Decimal places for prices: from the backend's pip size when known, else by symbol. */
export function digitsFor(id: string, pipSize?: number | null): number {
  if (pipSize && pipSize > 0) {
    const d = Math.round(-Math.log10(pipSize));
    // Forex quotes carry one fractional pip beyond the pip size.
    const extra = isSynthetic(id) || id.startsWith('XAU') ? 0 : 1;
    return Math.max(0, Math.min(6, d + extra));
  }
  if (id.startsWith('XAU')) return 2;
  if (id.includes('JPY')) return 3;
  if (isSynthetic(id)) return 2;
  return 5;
}

export function fmtPrice(n: number | null | undefined, digits: number) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Pip size as reported by the backend, with sensible symbol-based fallbacks. */
export function pipFor(id: string, pipSize?: number | null) {
  if (pipSize && pipSize > 0) return pipSize;
  if (id.startsWith('XAU')) return 0.01;
  if (id.includes('JPY')) return 0.01;
  return 0.0001;
}

/** Instrument selection lives in the URL (#/live/XAU%2FUSD) so it survives refresh. */
export function readHashParam(): string | null {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  return parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
}
