import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, BarChart3, CalendarClock, Crosshair, LineChart, ShieldCheck, Zap, Gauge } from 'lucide-react';
import { useApi } from '../lib/api';
import type { LiveAnalysis, LiveDecision, LiveMarket, LiveOverview, MultiTimeframeAnalysis, RuntimeMetrics } from '../lib/types';
import { INSTRUMENTS, dateTime, humanize, price, toneFor } from '../lib/format';
import { Card, ErrorBlock, LoadingBlock, PageHeader, Pill, Stat } from '../components/ui';

function ConnectionBanner({ data }: { data: LiveOverview | null }) {
  const marketVerified = data?.market_data.status === 'available';
  const mt5Configured = data?.mt5.status === 'configured';
  const ready = marketVerified || mt5Configured;
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 ${ready ? 'border-up/25 bg-up-soft/40' : 'border-warn/25 bg-warn-soft/40'}`}>
      {ready ? <Activity className="mt-0.5 h-5 w-5 shrink-0 text-up" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />}
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {marketVerified ? 'Market data connection verified' : mt5Configured ? 'MT5 bridge configured' : 'Live market data is not verified yet'}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {marketVerified
            ? `Tembo is receiving validated market data through ${data?.market_data.provider ?? 'the configured provider'}. MT5 execution remains a separate integration and is still controlled by the execution guard.`
            : mt5Configured
              ? 'The MT5 bridge configuration exists, but terminal connectivity still needs verification. Execution remains disabled until the safety requirements are satisfied.'
              : 'This cockpit fails closed: mock or missing market data is never presented as live. Connect and verify the market-data provider before relying on the cockpit.'}
        </p>
      </div>
      <Pill tone={ready ? 'good' : 'warn'}>{data?.mode ?? 'PREPARING'}</Pill>
    </div>
  );
}

function TradePlan({ plan }: { plan: LiveOverview['trade_plan'] }) {
  return (
    <Card title="Trade plan" subtitle="Generated only when the decision engine has enough evidence">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Decision" value={humanize(plan.decision)} />
        <Stat label="Entry" value={price(plan.entry_price, plan.instrument)} />
        <Stat label="Stop loss" value={price(plan.stop_loss, plan.instrument)} />
        <Stat label="Take profit" value={price(plan.take_profit, plan.instrument)} />
      </div>
      <div className="mt-4 rounded-xl border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted">
        <div className="mb-1 flex items-center gap-2 font-medium text-fg"><ShieldCheck className="h-4 w-4 text-up" /> Risk gate</div>
        {plan.reason}
      </div>
    </Card>
  );
}

function MarketChart({ data }: { data: LiveMarket | null }) {
  const points = useMemo(() => {
    if (!data?.candles.length) return '';
    const closes = data.candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    return closes
      .map((value, index) => {
        const x = 8 + (index / Math.max(closes.length - 1, 1)) * 984;
        const y = 12 + (1 - (value - min) / span) * 216;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data]);

  if (!data || data.status === 'mock' || !data.candles.length) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line-2 bg-panel-2 px-5 text-center">
        <div>
          <LineChart className="mx-auto h-7 w-7 text-faint" />
          <div className="mt-2 text-sm font-medium">Chart waiting for verified market data</div>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
            Tembo does not draw a synthetic chart from mock prices. Once a real provider is connected, validated candles will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel-2 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
        <span>{data.candles.length} validated candles · {humanize(data.timeframe)}</span>
        <span>{data.last_update ? dateTime(data.last_update) : '—'}</span>
      </div>
      <svg viewBox="0 0 1000 240" className="h-64 w-full" role="img" aria-label={`${data.instrument} price chart`}>
        <line x1="8" y1="228" x2="992" y2="228" stroke="currentColor" className="text-line" strokeWidth="1" />
        <line x1="8" y1="12" x2="992" y2="12" stroke="currentColor" className="text-line" strokeWidth="1" />
        <polyline points={points} fill="none" stroke="currentColor" className="text-gold" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>Provider: {humanize(data.provider)}</span>
        <Pill tone="good">Data quality verified</Pill>
      </div>
    </div>
  );
}


function AnalysisWorkspace({ instrument, timeframe }: { instrument: string; timeframe: string }) {
  const analysis = useApi<LiveAnalysis>(`/live/analysis?instrument=${encodeURIComponent(instrument)}&timeframe=${timeframe.toLowerCase()}`);
  const [showMulti, setShowMulti] = useState(false);
  const multi = useApi<MultiTimeframeAnalysis>(showMulti ? `/live/analysis/multi-timeframe?instrument=${encodeURIComponent(instrument)}` : null);

  const item = analysis.data?.analysis;
  const cards = [
    ['Trend', item?.trend?.state ?? 'Waiting'],
    ['Momentum', item?.momentum?.state ?? 'Waiting'],
    ['Volatility', item?.volatility?.state ?? 'Waiting'],
    ['Structure', item?.market_structure?.label ?? 'Waiting'],
  ];

  return (
    <Card title="Technical analysis" subtitle="Deterministic analysis of verified completed candles · no trade signal">
      {analysis.loading && !analysis.data ? <LoadingBlock rows={4} /> : analysis.error && !analysis.data ? (
        <ErrorBlock error={analysis.error} onRetry={analysis.reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map(([label, value]) => <Stat key={label} label={label} value={humanize(value)} />)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="text-xs font-medium text-fg">Momentum</div>
              <div className="mt-2 text-sm">{item?.momentum?.rsi_14 != null ? `RSI 14 · ${item.momentum.rsi_14.toFixed(1)}` : 'RSI waiting for warm-up'}</div>
              <div className="mt-1 text-xs text-muted">{humanize(item?.momentum?.state)}</div>
            </div>
            <div className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="text-xs font-medium text-fg">Support / resistance</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <span>Support: {price(item?.support_resistance?.support, instrument)}</span>
                <span>Resistance: {price(item?.support_resistance?.resistance, instrument)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted">
            {analysis.data?.message ?? 'Waiting for verified candles.'}
          </div>
        </>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-fg">Multi-timeframe context</div>
            <div className="text-[11px] text-muted">Loads on demand so the live cockpit does not exhaust the provider quota.</div>
          </div>
          <button
            onClick={() => setShowMulti((v) => !v)}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[11px] font-medium text-muted hover:text-fg"
          >
            {showMulti ? 'Hide' : 'Load M5 → D1'}
          </button>
        </div>
        {showMulti && <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] text-muted">Same deterministic engine across M5 → D1</div>
          <Pill tone={multi.data?.status === 'available' ? 'good' : 'warn'}>{humanize(multi.data?.status)}</Pill>
        </div>}
        {showMulti && <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {['m5','m15','h1','h4','d1'].map((tf) => {
            const value = multi.data?.timeframes?.[tf];
            const state = value && 'trend' in value ? value.trend?.state ?? 'Waiting' : value?.status ?? 'Waiting';
            return <div key={tf} className="rounded-lg border border-line bg-panel p-2 text-center"><div className="text-[10px] text-muted">{tf.toUpperCase()}</div><div className="mt-1 text-xs font-medium">{humanize(state)}</div></div>;
          })}
        </div>}
      </div>
    </Card>
  );
}

function DecisionWorkspace({ instrument, timeframe }: { instrument: string; timeframe: string }) {
  const decision = useApi<LiveDecision>(
    `/live/decision?instrument=${encodeURIComponent(instrument)}&timeframe=${timeframe.toLowerCase()}`,
  );
  const plan = decision.data?.trade_plan;

  return (
    <Card title="Multi-factor decision" subtitle="Technical evidence + candlestick evidence + macro risk · read-only">
      {decision.loading && !decision.data ? <LoadingBlock rows={5} /> : decision.error && !decision.data ? (
        <ErrorBlock error={decision.error} onRetry={decision.reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Decision" value={humanize(decision.data?.decision)} />
            <Stat label="Confidence" value={plan ? `${plan.confidence.toFixed(0)} / 100` : '—'} />
            <Stat label="Risk / reward" value={plan?.risk_reward != null ? `1:${plan.risk_reward.toFixed(1)}` : '—'} />
            <Stat label="Macro risk" value={humanize(decision.data?.macro_risk?.level)} />
          </div>

          {plan ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Entry" value={price(plan.entry, instrument)} />
                <Stat label="Stop loss" value={price(plan.stop_loss, instrument)} />
                <Stat label="Take profit" value={price(plan.take_profit, instrument)} />
                <Stat label="Direction" value={humanize(plan.direction)} />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {plan.factors.map((factor) => (
                  <div key={factor.name} className="rounded-xl border border-line bg-panel-2 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{humanize(factor.name)}</span>
                      <span className="num">{factor.score.toFixed(0)} /  {factor.direction}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{factor.reason}</p>
                  </div>
                ))}
              </div>

              {plan.rejection_reasons.length > 0 && (
                <div className="mt-4 rounded-xl border border-warn/25 bg-warn-soft/40 p-3 text-xs leading-relaxed">
                  <div className="font-medium">Decision restrictions</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
                    {plan.rejection_reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-line-2 bg-panel-2 p-4 text-xs leading-relaxed text-muted">
              {decision.data?.message ?? 'Waiting for verified market data.'}
            </div>
          )}

          {decision.data?.macro_risk && (
            <div className="mt-4 rounded-xl border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted">
              <div className="font-medium text-fg">Economic calendar guard · {humanize(decision.data.macro_risk.level)}</div>
              <div className="mt-1">{decision.data.macro_risk.reason}</div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function MarketWorkspace({ instrument, timeframe }: { instrument: string; timeframe: string }) {
  const market = useApi<LiveMarket>(`/live/market?instrument=${encodeURIComponent(instrument)}&timeframe=${timeframe.toLowerCase()}&limit=120`);

  return (
    <Card title="Live market workspace" subtitle="Quote + validated candles · read-only">
      {market.loading && !market.data ? <LoadingBlock rows={4} /> : market.error && !market.data ? (
        <ErrorBlock error={market.error} onRetry={market.reload} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Quote" value={market.data?.current_price != null ? price(market.data.current_price, instrument) : '—'} />
            <Stat label="Feed" value={humanize(market.data?.status)} />
            <Stat label="Candles" value={market.data?.candles.length.toString() ?? '0'} />
            <Stat label="Quality" value={market.data?.data_quality.is_clean ? 'Verified' : 'Waiting'} />
          </div>
          <MarketChart data={market.data} />
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted">
            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            {market.data?.message ?? 'Waiting for market data.'}
          </div>
        </>
      )}
    </Card>
  );
}

function RuntimeTelemetry({ instrument }: { instrument: string }) {
  const metrics = useApi<RuntimeMetrics>('/paper/runtime/metrics');
  if (metrics.loading && !metrics.data) return <Card title="Paper runtime telemetry" subtitle="Persistent evidence from the live-data paper engine"><LoadingBlock rows={2} /></Card>;
  if (metrics.error && !metrics.data) return <Card title="Paper runtime telemetry" subtitle="Persistent evidence from the live-data paper engine"><ErrorBlock error={metrics.error} onRetry={metrics.reload} /></Card>;
  const p = metrics.data?.performance;
  const instrumentEvents = metrics.data?.instrument_event_counts?.[instrument] ?? 0;
  return <Card title="Paper runtime telemetry" subtitle="Persistent evidence from the live-data paper engine">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Stat label="Cycles" value={String(metrics.data?.cycles_observed ?? 0)} />
      <Stat label="Events" value={String(metrics.data?.events_observed ?? 0)} />
      <Stat label="Closed trades" value={String(p?.closed_trades ?? 0)} />
      <Stat label="Realized P&L" value={`${(p?.realized_pnl ?? 0).toFixed(2)}`} />
      <Stat label={`${instrument} events`} value={String(instrumentEvents)} />
    </div>
    <div className="mt-3 flex items-center gap-2 text-xs text-muted"><Gauge className="h-4 w-4 text-gold" /> {metrics.data?.execution_enabled ? 'Execution flag is ON — verify configuration.' : 'Paper-only: broker execution disabled and broker not contacted.'}</div>
  </Card>;
}

export default function Live({ go: _go }: { go?: (r: string) => void }) {
  const [instrument, setInstrument] = useState<string>(INSTRUMENTS[0]);
  const [timeframe, setTimeframe] = useState('H1');
  const data = useApi<LiveOverview>(`/live/overview?instrument=${encodeURIComponent(instrument)}&timeframe=${timeframe.toLowerCase()}`);

  const selected = useMemo(() => data.data?.instruments.find((x) => x.instrument === instrument) ?? null, [data.data, instrument]);

  return (
    <div>
      <PageHeader title="Live trading cockpit">
        One workspace for market status, analysis, risk and the eventual MT5 connection. Execution is deliberately not enabled here.
      </PageHeader>

      <ConnectionBanner data={data.data} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {INSTRUMENTS.map((i) => (
          <button key={i} onClick={() => setInstrument(i)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${instrument === i ? 'border-gold/40 bg-gold-soft text-fg' : 'border-line bg-panel text-muted'}`}>{i}</button>
        ))}
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-xs text-fg">
          {['M5','M15','H1','H4','D1'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button onClick={data.reload} className="ml-auto rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-muted hover:text-fg">Refresh</button>
      </div>

      {data.loading && !data.data ? <LoadingBlock rows={6} /> : data.error && !data.data ? <ErrorBlock error={data.error} onRetry={data.reload} /> : data.data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card title="Selected market" subtitle={instrument}>
              <div className="flex items-end justify-between gap-3">
                <div className="num text-2xl font-semibold">{selected?.current_price != null ? price(selected.current_price, instrument) : '—'}</div>
                <Pill tone={toneFor(selected?.data_status)}>{humanize(selected?.data_status)}</Pill>
              </div>
              <div className="mt-3 text-xs text-muted">{selected?.last_update ? dateTime(selected.last_update) : 'No market timestamp yet'}</div>
            </Card>
            <Card title="Engine decision" subtitle="Selector + risk gates">
              <div className="flex items-center gap-2"><Crosshair className="h-5 w-5 text-gold" /><span className="text-lg font-semibold">{humanize(selected?.decision)}</span></div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{selected?.reason ?? 'Waiting for market evidence.'}</p>
            </Card>
            <Card title="MT5 bridge" subtitle="Execution connection">
              <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-warn" /><Pill tone={toneFor(data.data.mt5.status)}>{humanize(data.data.mt5.status)}</Pill></div>
              <p className="mt-2 text-xs text-muted">{data.data.mt5.message}</p>
            </Card>
            <Card title="Safety state" subtitle="Hard execution guard">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-up" /><span className="font-medium">{data.data.execution.enabled ? 'Execution enabled' : 'Execution disabled'}</span></div>
              <p className="mt-2 text-xs text-muted">{data.data.execution.note}</p>
            </Card>
          </div>

          <div className="mt-4">
            <MarketWorkspace instrument={instrument} timeframe={timeframe} />
          </div>

          <div className="mt-4">
            <AnalysisWorkspace instrument={instrument} timeframe={timeframe} />
          </div>

          <div className="mt-4">
            <DecisionWorkspace instrument={instrument} timeframe={timeframe} />
          </div>

          <div className="mt-4"><RuntimeTelemetry instrument={instrument} /></div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TradePlan plan={data.data.trade_plan} />
            <Card title="Market context" subtitle="Signals the cockpit will combine once live feeds are connected">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Provider" value={humanize(selected?.provider)} />
                <Stat label="Timeframe" value={timeframe} />
                <Stat label="News" value={humanize(data.data.context.news)} />
                <Stat label="Calendar" value={humanize(data.data.context.calendar)} />
              </div>
              <div className="mt-4 space-y-2 text-xs text-muted">
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Technical structure and volatility</div>
                <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Economic-event risk</div>
                <div className="flex items-center gap-2"><Activity className="h-4 w-4" /> News and market state</div>
              </div>
            </Card>
          </div>

          <Card title="Cockpit workflow" subtitle="What happens before an order can ever be considered" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-5">
              {['Market feed','Technical analysis','News + calendar','Decision + risk','Human approval'].map((step, i) => (
                <div key={step} className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 p-3 text-xs">
                  <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-2">{i + 1}</span>
                  <span>{step}</span>{i < 4 && <ArrowRight className="ml-auto hidden h-3 w-3 text-faint sm:block" />}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-faint">No automatic order endpoint is exposed at this stage. The next integration will be MT5 demo connectivity, not real-money execution.</p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
