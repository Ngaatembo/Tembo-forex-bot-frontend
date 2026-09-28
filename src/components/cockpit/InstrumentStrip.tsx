import { useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { SyntheticSymbols } from '../../lib/types';
import { digitsFor, fmtPrice, metaFor } from '../../lib/instruments';
import { InstrumentIcon } from '../brand';
import type { Quote } from './types';

export function InstrumentStrip({
  ids,
  selected,
  onSelect,
  quotes,
}: {
  ids: string[];
  selected: string;
  onSelect: (id: string) => void;
  quotes: Record<string, Quote>;
}) {
  const [picker, setPicker] = useState(false);
  return (
    <div className="relative">
      <div className="scrollbar-none flex items-stretch gap-2 overflow-x-auto">
        {ids.map((id) => {
          const meta = metaFor(id, quotes[id]?.displayName);
          const q = quotes[id];
          const active = id === selected;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`flex min-w-[148px] shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                active ? 'border-brand/70 bg-brand-soft/40 shadow-[0_0_0_1px_rgb(34_211_122_/_0.25)]' : 'border-line bg-panel hover:border-line-2'
              }`}
            >
              <InstrumentIcon meta={meta} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-fg">{meta.code}</span>
                <span className="block truncate text-[10px] text-faint">
                  {q?.price != null ? (
                    <span className="num">
                      {fmtPrice(q.price, digitsFor(id, q.pipSize))}
                      {q.changePct != null && (
                        <span className={q.changePct >= 0 ? 'text-up' : 'text-down'}>
                          {' '}
                          {q.changePct >= 0 ? '+' : ''}
                          {q.changePct.toFixed(2)}%
                        </span>
                      )}
                    </span>
                  ) : (
                    meta.short
                  )}
                </span>
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setPicker(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[11px] font-medium text-muted hover:border-line-2 hover:text-fg"
          aria-label="More markets"
        >
          More <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {picker && <MarketPicker onClose={() => setPicker(false)} onSelect={(id) => { onSelect(id); setPicker(false); }} />}
    </div>
  );
}

function MarketPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (id: string) => void }) {
  const synth = useApi<SyntheticSymbols>('/live/synthetic-symbols');
  const [q, setQ] = useState('');
  const list = (synth.data?.symbols ?? []).filter((s) => s.display_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-line bg-panel sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Deriv synthetic markets</div>
            <div className="text-[11px] text-faint">Discovered live from Deriv through the Tembo backend</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-line px-4 py-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search e.g. Volatility, Boom, Step" className="w-full bg-transparent text-[12px] text-fg outline-none placeholder:text-faint" />
          </label>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {synth.loading && !synth.data && <div className="p-4 text-center text-[12px] text-faint">Loading markets from Deriv…</div>}
          {synth.error && !synth.data && <div className="p-4 text-center text-[12px] text-down">{synth.error.message}</div>}
          {list.map((s) => (
            <button key={s.symbol} onClick={() => onSelect(s.symbol)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-panel-2">
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium text-fg">{s.display_name}</span>
                <span className="block text-[10px] text-faint">{s.submarket.replace(/_/g, ' ')}</span>
              </span>
              <span className={`text-[10px] ${s.exchange_is_open ? 'text-up' : 'text-faint'}`}>{s.exchange_is_open ? 'Open' : 'Closed'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
