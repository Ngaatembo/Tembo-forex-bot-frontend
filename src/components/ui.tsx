import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react';
import type { ApiError } from '../lib/api';
import { toneFor, type Tone } from '../lib/format';

const TONE: Record<Tone, string> = {
  good: 'bg-up-soft text-up border-up/25',
  warn: 'bg-warn-soft text-warn border-warn/25',
  bad: 'bg-down-soft text-down border-down/25',
  info: 'bg-info-soft text-info border-info/25',
  muted: 'bg-panel-2 text-muted border-line-2',
};

const DOT: Record<Tone, string> = {
  good: 'bg-up',
  warn: 'bg-warn',
  bad: 'bg-down',
  info: 'bg-info',
  muted: 'bg-faint',
};

export function Pill({ children, tone, status }: { children: ReactNode; tone?: Tone; status?: string | null }) {
  const t = tone ?? toneFor(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[t]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[t]}`} />
      {children}
    </span>
  );
}

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${DOT[tone]} ${pulse ? 'pulse-dot' : ''}`} />;
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  pad = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'up' | 'down' | 'gold';
}) {
  const color = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : tone === 'gold' ? 'text-gold' : 'text-fg';
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</div>
      <div className={`num mt-1 truncate text-xl font-semibold sm:text-2xl ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const hint =
    error.kind === 'network'
      ? 'The server may be asleep or your connection dropped. Try again in a moment.'
      : error.kind === 'timeout'
        ? 'The free Render server can take up to a minute to wake up.'
        : null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-down/25 bg-down-soft/60 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-down" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{error.message}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-2 px-2.5 py-1 text-xs font-medium text-fg hover:bg-panel-2"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-2 px-4 py-8 text-center">
      <Inbox className="h-5 w-5 text-faint" />
      <p className="mt-2 text-sm font-medium text-fg">{title}</p>
      {children && <div className="mt-1 max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${TONE[tone]}`}>{children}</div>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`num shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            o === value ? 'border-gold/50 bg-gold-soft text-gold' : 'border-line bg-panel text-muted hover:text-fg'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {children && <p className="mt-1 max-w-2xl text-sm text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-panel px-3 py-1.5 text-xs font-medium text-muted hover:text-fg disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
    </button>
  );
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 text-sm last:border-0">
      <span className="text-muted">{k}</span>
      <span className="min-w-0 truncate text-right">{v}</span>
    </div>
  );
}
