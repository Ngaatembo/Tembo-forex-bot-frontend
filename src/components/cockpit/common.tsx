import type { ReactNode } from 'react';

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'muted';

export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const TEXT: Record<Tone, string> = {
  good: 'text-up',
  warn: 'text-warn',
  bad: 'text-down',
  info: 'text-info',
  muted: 'text-muted',
};

const DOT: Record<Tone, string> = {
  good: 'bg-up',
  warn: 'bg-warn',
  bad: 'bg-down',
  info: 'bg-info',
  muted: 'bg-faint',
};

const CHIP: Record<Tone, string> = {
  good: 'border-up/30 bg-up-soft text-up',
  warn: 'border-warn/30 bg-warn-soft text-warn',
  bad: 'border-down/30 bg-down-soft text-down',
  info: 'border-info/30 bg-info-soft text-info',
  muted: 'border-line-2 bg-panel-2 text-muted',
};

/** Maps backend status strings to a colour. Unknown values stay neutral. */
export function toneOf(value: unknown): Tone {
  const s = String(value ?? '').toUpperCase();
  if (['AVAILABLE', 'OK', 'PASS', 'APPROVED', 'PAPER_ELIGIBLE', 'TRADEABLE', 'LOW', 'CONNECTED', 'VERIFIED', 'BUY', 'UP', 'POSITIVE', 'RUNNING', 'AUTHENTICATED', 'HIGHER_HIGH_HIGHER_LOW', 'CONFIRMED_NO_RELEVANT_NEWS', 'FRESH', 'CONFIGURED'].includes(s)) return 'good';
  if (['MEDIUM', 'WAITING', 'DEGRADED', 'STALE', 'PREPARING', 'UNKNOWN', 'PROMISING_NOT_TRADEABLE', 'PROMISING', 'RANGE', 'NEUTRAL', 'MIXED_STRUCTURE', 'UNSTABLE', 'QUIET', 'OVERBOUGHT', 'OVERSOLD', 'HIGH_VOLATILITY', 'NO_TRADE', 'RESEARCH_REQUIRED'].includes(s)) return 'warn';
  if (['BLOCKED', 'REJECTED', 'RISK_REJECTED', 'HIGH', 'UNAVAILABLE', 'OFFLINE', 'SELL', 'DOWN', 'NEGATIVE', 'NO_VALIDATED_EDGE', 'LOWER_HIGH_LOWER_LOW', 'NOT_ELIGIBLE', 'ERROR'].includes(s)) return 'bad';
  return 'muted';
}

export function human(s: string | null | undefined, fallback = '—') {
  if (!s) return fallback;
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function Dot({ tone = 'muted', pulse = false }: { tone?: Tone; pulse?: boolean }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]} ${pulse ? 'pulse-dot' : ''}`} />;
}

export function Chip({ tone = 'muted', children, dot = true, pulse = false }: { tone?: Tone; children: ReactNode; dot?: boolean; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CHIP[tone]}`}>
      {dot && <Dot tone={tone} pulse={pulse} />}
      {children}
    </span>
  );
}

export function Panel({
  title,
  icon,
  right,
  children,
  className = '',
  bodyClass = 'p-3 sm:p-4',
}: {
  title?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-panel ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            {title && <h2 className="truncate text-[13px] font-semibold text-fg">{title}</h2>}
          </div>
          {right}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** Small icon tile used in card headers (matches the design's coloured square icons). */
export function IconTile({ children, tone = 'info' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${CHIP[tone]}`}>{children}</span>;
}

export function Row({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
      <span className="text-muted">{k}</span>
      <span className={`num min-w-0 truncate text-right font-medium ${tone ? TEXT[tone] : 'text-fg'}`}>{v}</span>
    </div>
  );
}

/** Circular gauge (0–100). Shows "—" when the backend gave no value. */
export function Ring({ value, label, tone }: { value: number | null; label: string; tone: Tone }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const stroke = tone === 'good' ? '#22c77a' : tone === 'warn' ? '#f2b447' : tone === 'bad' ? '#f0585d' : '#56667f';
  return (
    <div className="relative grid h-[68px] w-[68px] place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#182438" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <div className="text-center leading-none">
        <div className="num text-[15px] font-bold text-fg">{value == null ? '—' : `${Math.round(pct)}%`}</div>
        <div className={`mt-1 text-[8px] font-bold uppercase tracking-wider ${TEXT[tone]}`}>{label}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line-2 bg-panel-2/50 px-3 py-4 text-center text-[11px] leading-relaxed text-faint">{children}</div>;
}

export function timeLocal(iso: string | null | undefined, withDate = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return withDate ? `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${t}` : t;
}

/** Local timezone abbreviation, e.g. "CAT". Falls back to the UTC offset. */
export function tzLabel() {
  try {
    const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch {
    return '';
  }
}
