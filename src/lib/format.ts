export const INSTRUMENTS = ['EUR/USD', 'GBP/USD', 'XAU/USD'] as const;

export function money(n: number | null | undefined, opts: { sign?: boolean } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : '';
  return `${sign}$${s}`;
}

export function pct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function price(n: number | null | undefined, instrument?: string) {
  if (n == null || Number.isNaN(n)) return '—';
  const digits = instrument?.startsWith('XAU') ? 2 : instrument?.includes('JPY') ? 3 : 5;
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function num(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const diff = (Date.now() - d) / 1000;
  const abs = Math.abs(diff);
  const fmt = (v: number, u: string) => `${Math.round(v)} ${u}${Math.round(v) === 1 ? '' : 's'}`;
  const s = abs < 60 ? 'just now' : abs < 3600 ? fmt(abs / 60, 'min') : abs < 86400 ? fmt(abs / 3600, 'hour') : fmt(abs / 86400, 'day');
  if (s === 'just now') return s;
  return diff >= 0 ? `${s} ago` : `in ${s}`;
}

/** Turns API enum strings like PROMISING_NOT_TRADEABLE into "Promising, not tradeable". */
export function humanize(s: string | null | undefined) {
  if (!s) return '—';
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const STATUS_TEXT: Record<string, string> = {
  TRADEABLE: 'Validated edge',
  PROMISING_NOT_TRADEABLE: 'Promising, not tradeable yet',
  RESEARCH_REQUIRED: 'More research needed',
  NO_VALIDATED_EDGE: 'No edge found',
  NO_TRADE: 'No trade',
  PAPER_TRADE_APPROVED: 'Paper trade approved',
  RISK_REJECTED: 'Blocked by risk engine',
};

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'muted';

export function toneFor(status: string | null | undefined): Tone {
  switch (status) {
    case 'TRADEABLE':
    case 'PAPER_CANDIDATE':
    case 'PAPER_TRADE_APPROVED':
    case 'available':
    case 'ok':
    case 'configured':
    case 'LIVE':
    case 'STATIC_OFFICIAL':
    case 'POSITIVE':
    case 'LOW':
      return 'good';
    case 'PROMISING_NOT_TRADEABLE':
    case 'PROMISING':
    case 'ROBUSTNESS_REQUIRED':
    case 'MIXED':
    case 'degraded':
    case 'mock':
    case 'DEMO':
    case 'MEDIUM':
    case 'STALE':
      return 'warn';
    case 'RESEARCH_REQUIRED':
    case 'ACTIVE':
      return 'info';
    case 'NO_VALIDATED_EDGE':
    case 'REJECT_EARLY':
    case 'REJECTED':
    case 'CLOSED':
    case 'OUT_OF_SAMPLE_FAILED':
    case 'RISK_REJECTED':
    case 'unavailable':
    case 'UNAVAILABLE':
    case 'HIGH':
    case 'NEGATIVE':
      return 'bad';
    default:
      return 'muted';
  }
}

export function compactMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  const a = Math.abs(n);
  const body = a >= 1000 ? `$${(a / 1000).toFixed(1)}k` : `$${a.toFixed(0)}`;
  return `${n < 0 ? '−' : n > 0 ? '+' : ''}${body}`;
}

export function shortTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}
