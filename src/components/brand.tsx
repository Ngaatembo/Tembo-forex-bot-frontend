import { Activity } from 'lucide-react';
import type { InstrumentMeta } from '../lib/instruments';

/** Tembo's elephant mark ("tembo" is Swahili for elephant). Original line drawing. */
export function ElephantMark({ className = 'h-8 w-8', strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* ears */}
      <path d="M12.5 12C8 7.5 2.5 9.5 2.5 16c0 5.5 3.8 8.6 8.8 8" />
      <path d="M27.5 12c4.5-4.5 10-2.5 10 4 0 5.5-3.8 8.6-8.8 8" />
      {/* head */}
      <path d="M11.3 24C10.2 19.5 10.6 14.2 13 11.2 15.8 7.8 24.2 7.8 27 11.2c2.4 3 2.8 8.3 1.7 12.8" />
      <path d="M11.3 24c1 1.9 3 3 5.2 3.2M28.7 24c-1 1.9-3 3-5.2 3.2" />
      {/* trunk */}
      <path d="M20 21.5v10c0 3.4 3.2 4.6 5.3 2.6" />
      {/* tusks */}
      <path d="M16.5 27.2c-.4 2.2-1.8 3.4-3.6 3.5M23.5 27.2c.4 2.2 1.8 3.4 3.6 3.5" />
      {/* eyes */}
      <circle cx="15.8" cy="17.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="24.2" cy="17.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <ElephantMark className={compact ? 'h-8 w-8 text-brand' : 'h-9 w-9 text-brand'} />
      <div className="leading-none">
        <div className={`font-bold tracking-tight text-fg ${compact ? 'text-lg' : 'text-xl'}`}>Tembo</div>
        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.32em] text-brand">Forex bot</div>
      </div>
    </div>
  );
}

const CURRENCY: Record<string, { sym: string; bg: string; fg: string }> = {
  USD: { sym: '$', bg: '#1d4ed8', fg: '#ffffff' },
  EUR: { sym: '€', bg: '#1e3a8a', fg: '#facc15' },
  GBP: { sym: '£', bg: '#7f1d1d', fg: '#ffffff' },
  JPY: { sym: '¥', bg: '#f8fafc', fg: '#dc2626' },
  XAU: { sym: 'Au', bg: '#d4a017', fg: '#3b2a02' },
};

/** Small circular badge for an instrument: currency symbol for forex/gold, a pulse for synthetics. */
export function InstrumentIcon({ meta, size = 'md' }: { meta: InstrumentMeta; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-9 w-9 text-sm' : size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[11px]';
  if (meta.kind === 'synthetic') {
    return (
      <span className={`grid shrink-0 place-items-center rounded-full bg-info-soft text-info ring-1 ring-info/30 ${dim}`}>
        <Activity className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
    );
  }
  const c = CURRENCY[meta.base ?? ''] ?? { sym: (meta.base ?? '?').slice(0, 1), bg: '#334155', fg: '#fff' };
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold ring-1 ring-white/10 ${dim}`}
      style={{ background: c.bg, color: c.fg }}
    >
      {c.sym}
    </span>
  );
}
