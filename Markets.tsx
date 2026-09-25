import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { enc, useApi } from '../lib/api';
import type { Market } from '../lib/types';
import { INSTRUMENTS, dateTime, humanize, price, shortTime } from '../lib/format';
import { useInstrumentParam } from '../lib/route';
import { Card, Empty, ErrorBlock, KV, LoadingBlock, Notice, PageHeader, Pill, RefreshButton, Segmented, Stat } from '../components/ui';

function PriceChart({ m }: { m: Market }) {
  const data = m.recent_candles.map((c) => ({ t: c.timestamp, close: c.close }));
  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const pad = (max - min) * 0.15 || max * 0.001;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const up = last >= first;
  const stroke = up ? '#3ecf8e' : '#f06a6a';
  return (
    <div className="h-64 w-full sm:h-72" role="img" aria-label={`${m.instrument} closing prices, last ${data.length} hours`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="px" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#222a36" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t: string) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            tick={{ fill: '#5d6776', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tickFormatter={(v: number) => price(v, m.instrument)}
            tick={{ fill: '#5d6776', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            width={m.instrument.startsWith('XAU') ? 62 : 58}
            orientation="right"
          />
          <Tooltip
            cursor={{ stroke: '#5d6776', strokeWidth: 1 }}
            contentStyle={{ background: '#161c26', border: '1px solid #2c3544', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: '#8b95a5' }}
            itemStyle={{ color: '#e8ecf2', fontFamily: 'JetBrains Mono' }}
            labelFormatter={(t) => dateTime(String(t))}
            formatter={(v) => [price(Number(v), m.instrument), 'Close']}
          />
          <Area type="monotone" dataKey="close" isAnimationActive={false} stroke={stroke} strokeWidth={2} fill="url(#px)" activeDot={{ r: 4, stroke: '#11161e', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Markets() {
  const [instrument, setInstrument] = useInstrumentParam('markets');
  const { data, error, loading, reload } = useApi<Market>(`/markets/${enc(instrument)}?timeframe=h1`);
  const candles = data?.recent_candles ?? [];
  const first = candles[0]?.close;
  const last = candles[candles.length - 1]?.close;
  const change = first && last ? last - first : null;
  const changePct = first && change != null ? change / first : null;
  const isMock = data?.provider === 'mock';

  return (
    <div>
      <PageHeader title="Markets" action={<RefreshButton onClick={reload} loading={loading} />}>
        Latest price and the last hourly candles from the backend's market data provider.
      </PageHeader>
      <Segmented options={INSTRUMENTS} value={instrument} onChange={setInstrument} />

      <div className="mt-4">
        {loading && !data ? (
          <Card>
            <LoadingBlock rows={6} />
          </Card>
        ) : error && !data ? (
          <ErrorBlock error={error} onRetry={reload} />
        ) : data ? (
          <div className="min-w-0 space-y-4">
            {isMock && (
              <Notice>
                The backend is using its <span className="font-medium">mock</span> market data provider, so these prices are placeholders. Set
                MARKET_DATA_PROVIDER=twelvedata on Render to show real prices.
              </Notice>
            )}
            <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-faint">{data.instrument_metadata.display_name} · H1</div>
                  <div className="num mt-1 text-3xl font-semibold sm:text-4xl">{price(data.current_price, instrument)}</div>
                  {change != null && (
                    <div className={`num mt-1 text-sm ${change >= 0 ? 'text-up' : 'text-down'}`}>
                      {change >= 0 ? '+' : '−'}
                      {price(Math.abs(change), instrument)} ({changePct! >= 0 ? '+' : '−'}
                      {Math.abs(changePct! * 100).toFixed(2)}%) <span className="text-faint">over {candles.length} hours</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill status={isMock ? 'mock' : 'available'}>{humanize(data.provider)}</Pill>
                  <Pill status={data.data_quality.is_clean ? 'available' : 'unavailable'}>{data.data_quality.is_clean ? 'Clean data' : 'Data issues'}</Pill>
                </div>
              </div>
              <div className="mt-4">
                {candles.length > 1 ? (
                  <PriceChart m={data} />
                ) : (
                  <Empty title="No recent candles">The provider returned no candle history for this instrument.</Empty>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card title="Recent candles" subtitle="Newest first" pad={false} className="lg:col-span-2">
                {candles.length === 0 ? (
                  <div className="p-4">
                    <Empty title="Nothing to show" />
                  </div>
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
              <Card title="Data quality" subtitle="Checks run by the backend on these candles">
                <KV k="OHLC violations" v={<span className="num">{data.data_quality.ohlc_violations}</span>} />
                <KV k="Duplicate timestamps" v={<span className="num">{data.data_quality.duplicate_timestamps}</span>} />
                <KV k="Unexpected gaps" v={<span className="num">{data.data_quality.unexpected_gaps}</span>} />
                <KV k="Pip size" v={<span className="num">{data.instrument_metadata.pip_size}</span>} />
                <KV k="Asset class" v={humanize(data.instrument_metadata.asset_class)} />
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
