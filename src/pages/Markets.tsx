import { useEffect, useMemo, useState } from 'react';
import { enc, useApi } from '../lib/api';
import type { LiveMarket } from '../lib/types';
import { INSTRUMENTS, dateTime, humanize, price, shortTime } from '../lib/format';
import { useInstrumentParam } from '../lib/route';
import { Card, Empty, ErrorBlock, KV, LoadingBlock, Notice, PageHeader, Pill, RefreshButton, Segmented, Stat } from '../components/ui';

function CandleChart({ data }: { data: LiveMarket }) {
  const candles = data.candles;
  const points = useMemo(() => {
    if (!candles.length) return null;
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const span = max - min || 1;
    const width = 1000;
    const height = 360;
    const left = 12;
    const right = 18;
    const top = 12;
    const bottom = 28;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const step = plotW / Math.max(candles.length, 1);
    const bodyW = Math.max(2, Math.min(9, step * 0.62));

    const y = (v: number) => top + (1 - (v - min) / span) * plotH;
    const x = (i: number) => left + i * step + step / 2;

    return {
      min,
      max,
      items: candles.map((c, i) => {
        const openY = y(c.open);
        const closeY = y(c.close);
        return {
          ...c,
          x: x(i),
          highY: y(c.high),
          lowY: y(c.low),
          bodyTop: Math.min(openY, closeY),
          bodyHeight: Math.max(1.5, Math.abs(closeY - openY)),
          bodyW,
          up: c.close >= c.open,
        };
      }),
      y,
      height,
      width,
    };
  }, [candles]);

  if (!points) return <Empty title="No candles">Waiting for verified market data.</Empty>;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel-2 p-2 sm:p-3">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] text-muted">
        <span>{candles.length} verified H1 candles</span>
        <span>Newest: {dateTime(data.last_update)}</span>
      </div>
      <svg viewBox={`0 0 ${points.width} ${points.height}`} className="h-64 w-full sm:h-80" role="img" aria-label={`${data.instrument} H1 candlestick chart`}>
        <line x1="12" y1="12" x2="982" y2="12" stroke="currentColor" className="text-line" />
        <line x1="12" y1="180" x2="982" y2="180" stroke="currentColor" className="text-line" />
        <line x1="12" y1="332" x2="982" y2="332" stroke="currentColor" className="text-line" />
        {points.items.map((c) => (
          <g key={c.timestamp}>
            <line
              x1={c.x}
              x2={c.x}
              y1={c.highY}
              y2={c.lowY}
              stroke="currentColor"
              className={c.up ? 'text-up' : 'text-down'}
              strokeWidth="1.5"
            />
            <rect
              x={c.x - c.bodyW / 2}
              y={c.bodyTop}
              width={c.bodyW}
              height={c.bodyHeight}
              rx="1"
              fill="currentColor"
              className={c.up ? 'text-up' : 'text-down'}
            />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-faint">
        <span>{shortTime(candles[0].timestamp)}</span>
        <span>{shortTime(candles[Math.floor(candles.length / 2)].timestamp)}</span>
        <span>{shortTime(candles[candles.length - 1].timestamp)}</span>
      </div>
    </div>
  );
}

export default function Markets() {
  const [instrument, setInstrument] = useInstrumentParam('markets');
  const { data, error, loading, reload } = useApi<LiveMarket>(
    `/live/market?instrument=${enc(instrument)}&timeframe=h1&limit=120`,
  );
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const candles = data?.candles ?? [];
  const first = candles[0]?.close;
  const last = data?.current_price ?? candles[candles.length - 1]?.close;
  const change = first != null && last != null ? last - first : null;
  const changePct = first && change != null ? change / first : null;
  const isMock = data?.provider === 'mock';

  // Twelve Data's price endpoint is polled conservatively. Candle history is
  // process-cached by the backend, so this keeps the quote fresh without
  // repeatedly downloading the same H1 history.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      await reload();
      setLastRefresh(new Date());
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    if (data) setLastRefresh(new Date());
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Markets"
        action={<RefreshButton onClick={async () => { await reload(); setLastRefresh(new Date()); }} loading={loading} />}
      >
        Live prices and verified H1 candles from the backend market-data provider.
      </PageHeader>
      <Segmented options={INSTRUMENTS} value={instrument} onChange={setInstrument} />

      <div className="mt-4">
        {loading && !data ? (
          <Card><LoadingBlock rows={6} /></Card>
        ) : error && !data ? (
          <ErrorBlock error={error} onRetry={reload} />
        ) : data ? (
          <div className="min-w-0 space-y-4">
            {isMock && (
              <Notice>
                The backend is using its <span className="font-medium">mock</span> market data provider, so these prices are placeholders.
              </Notice>
            )}

            <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-faint">
                    <span className="inline-block h-2 w-2 rounded-full bg-up" />
                    {data.instrument} · H1 · LIVE
                  </div>
                  <div className="num mt-1 text-3xl font-semibold sm:text-4xl">
                    {price(data.current_price, instrument)}
                  </div>
                  {change != null && (
                    <div className={`num mt-1 text-sm ${change >= 0 ? 'text-up' : 'text-down'}`}>
                      {change >= 0 ? '+' : '−'}{price(Math.abs(change), instrument)} ({changePct! >= 0 ? '+' : '−'}
                      {Math.abs(changePct! * 100).toFixed(2)}%) <span className="text-faint">across displayed H1 history</span>
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-muted">
                    Quote polling: 10s · {lastRefresh ? `last UI refresh ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'connecting…'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill status={isMock ? 'mock' : 'available'}>{humanize(data.provider)}</Pill>
                  <Pill status={data.data_quality.is_clean ? 'available' : 'unavailable'}>
                    {data.data_quality.is_clean ? 'Verified live data' : 'Data issues'}
                  </Pill>
                </div>
              </div>

              <div className="mt-4">
                {candles.length > 1 ? <CandleChart data={data} /> : <Empty title="No recent candles">The provider returned no completed candle history.</Empty>}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card title="Recent candles" subtitle="Newest verified H1 candles first" pad={false} className="lg:col-span-2">
                {candles.length === 0 ? (
                  <div className="p-4"><Empty title="Nothing to show" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] sm:text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                          <th className="pl-3 pr-1.5 py-2 font-medium sm:px-5">Time</th>
                          <th className="hidden px-1.5 py-2 text-right font-medium sm:table-cell">Open</th>
                          <th className="px-1.5 py-2 text-right font-medium">High</th>
                          <th className="px-1.5 py-2 text-right font-medium">Low</th>
                          <th className="pl-3 pr-1.5 py-2 text-right font-medium sm:px-5">Close</th>
                        </tr>
                      </thead>
                      <tbody className="num whitespace-nowrap">
                        {[...candles].reverse().map((c) => (
                          <tr key={c.timestamp} className="border-t border-line">
                            <td className="pl-3 pr-1.5 py-2 text-muted sm:px-5">{shortTime(c.timestamp)}</td>
                            <td className="hidden px-1.5 py-2 text-right sm:table-cell">{price(c.open, instrument)}</td>
                            <td className="px-1.5 py-2 text-right">{price(c.high, instrument)}</td>
                            <td className="px-1.5 py-2 text-right">{price(c.low, instrument)}</td>
                            <td className={`pl-3 pr-1.5 py-2 text-right sm:px-5 ${c.close >= c.open ? 'text-up' : 'text-down'}`}>{price(c.close, instrument)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title="Data quality" subtitle="Backend validation on every live batch">
                <KV k="OHLC violations" v={<span className="num">{data.data_quality.ohlc_violations}</span>} />
                <KV k="Duplicate timestamps" v={<span className="num">{data.data_quality.duplicate_timestamps}</span>} />
                <KV k="Unexpected gaps" v={<span className="num">{data.data_quality.unexpected_gaps}</span>} />
                <KV k="Last completed candle" v={data.last_update ? dateTime(data.last_update) : '—'} />
                <KV k="Pip size" v={<span className="num">{data.instrument_metadata?.pip_size ?? '—'}</span>} />
                <KV k="Asset class" v={humanize(data.instrument_metadata?.asset_class)} />
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <Stat label="High" value={candles.length ? price(Math.max(...candles.map((c) => c.high)), instrument) : '—'} />
                  <Stat label="Low" value={candles.length ? price(Math.min(...candles.map((c) => c.low)), instrument) : '—'} />
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
