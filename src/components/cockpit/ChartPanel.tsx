import { Activity, Layers, Maximize2, RefreshCw } from 'lucide-react';
import type { LiveMarket } from '../../lib/types';
import type { ApiError } from '../../lib/api';
import { TIMEFRAMES, type Timeframe, fmtPrice, type InstrumentMeta } from '../../lib/instruments';
import { InstrumentIcon } from '../brand';
import { PriceChart, type ChartLevel } from '../PriceChart';
import { Chip, timeLocal } from './common';
import { useState } from 'react';

export function QuoteHeader({
  meta,
  market,
  price,
  change,
  changePct,
  digits,
  timeframe,
  setTimeframe,
  loading,
}: {
  meta: InstrumentMeta;
  market: LiveMarket | null;
  price: number | null;
  change: number | null;
  changePct: number | null;
  digits: number;
  timeframe: Timeframe;
  setTimeframe: (t: Timeframe) => void;
  loading: boolean;
}) {
  const verified = market?.status === 'available';
  return (
    <div className="rounded-xl border border-line bg-panel p-3 sm:p-4 lg:rounded-b-none lg:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <InstrumentIcon meta={meta} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-fg">{meta.code}</h1>
              <span className="rounded border border-line-2 px-1.5 py-px text-[10px] font-semibold text-muted">{timeframe}</span>
              {verified ? <Chip tone="good" pulse>Live data</Chip> : <Chip tone="warn" pulse={loading}>{loading ? 'Loading' : 'Waiting for verified data'}</Chip>}
            </div>
            <div className="truncate text-[11px] text-faint">{meta.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel-2 p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${timeframe === tf ? 'bg-brand text-ink' : 'text-muted hover:text-fg'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num text-[28px] font-bold leading-none tracking-tight text-fg sm:text-[32px]">{fmtPrice(price, digits)}</span>
        {change != null && changePct != null ? (
          <span className={`num text-[13px] font-semibold ${change >= 0 ? 'text-up' : 'text-down'}`}>
            {change >= 0 ? '+' : '−'}
            {fmtPrice(Math.abs(change), digits)} ({changePct >= 0 ? '+' : '−'}
            {Math.abs(changePct).toFixed(2)}%)
            <span className="ml-1 text-[10px] font-normal text-faint">today</span>
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-[10px] text-faint">
        {market?.last_update ? `Last completed ${timeframe} candle ${timeLocal(market.last_update, true)}` : 'Tembo only shows prices it has verified.'}
        {market?.provider ? ` · via ${market.provider}` : ''}
      </div>
    </div>
  );
}

export function ChartBody({
  market,
  error,
  loading,
  digits,
  levels,
  resetKey,
  onRetry,
}: {
  market: LiveMarket | null;
  error: ApiError | null;
  loading: boolean;
  digits: number;
  levels: ChartLevel[];
  resetKey: string;
  onRetry: () => void;
}) {
  const [showAverages, setShowAverages] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [fitKey, setFitKey] = useState(0);
  const candles = market?.status === 'available' ? market.candles ?? [] : [];
  const gaps = market?.data_quality?.unexpected_gaps ?? 0;

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-line bg-panel lg:rounded-t-none lg:border-t-0">
      <div className="flex items-center justify-between gap-2 border-t border-line/0 px-3 pb-1 pt-2 lg:border-line sm:px-4">
        <div className="flex items-center gap-1.5 text-[10px] text-faint">
          <Activity className="h-3.5 w-3.5 text-brand" />
          {candles.length ? `${candles.length} verified candles` : 'No candles yet'}
          {gaps > 0 && (
            <span className="text-faint" title="Gaps are usually market closures (e.g. weekends).">
              · {gaps} gap{gaps === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ToolButton active={showAverages} onClick={() => setShowAverages((v) => !v)} label="SMA 10/50">
            <span className="text-[10px] font-semibold">MA</span>
          </ToolButton>
          <ToolButton active={showLevels} onClick={() => setShowLevels((v) => !v)} label="Key levels">
            <Layers className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton onClick={() => setFitKey((k) => k + 1)} label="Fit chart">
            <Maximize2 className="h-3.5 w-3.5" />
          </ToolButton>
        </div>
      </div>
      <div className="relative min-h-[300px] flex-1 px-1 pb-1">
        {candles.length > 0 ? (
          <PriceChart
            candles={candles}
            digits={digits}
            levels={levels}
            showAverages={showAverages}
            showLevels={showLevels}
            resetKey={`${resetKey}:${fitKey}`}
          />
        ) : (
          <div className="grid h-full min-h-[300px] place-items-center px-6 text-center">
            <div>
              <div className="text-[13px] font-semibold text-fg">{loading ? 'Loading verified candles…' : 'Waiting for verified data'}</div>
              <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-faint">
                {error ? error.message : market?.message ?? 'Tembo never draws made-up prices. The chart appears once the backend returns validated candles.'}
              </p>
              {error && !loading && (
                <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-[11px] font-medium text-fg hover:bg-panel-2">
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({ children, onClick, active, label }: { children: React.ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`grid h-7 min-w-7 place-items-center rounded-md border px-1.5 transition ${
        active ? 'border-brand/40 bg-brand-soft/60 text-brand' : 'border-line bg-panel-2 text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

