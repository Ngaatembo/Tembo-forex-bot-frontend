import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, BarChart3, CalendarClock, Crosshair, ShieldCheck, Zap } from 'lucide-react';
import { enc, useApi } from '../lib/api';
import type { LiveOverview } from '../lib/types';
import { INSTRUMENTS, dateTime, humanize, price, toneFor } from '../lib/format';
import { Card, ErrorBlock, LoadingBlock, PageHeader, Pill, Stat } from '../components/ui';

function ConnectionBanner({ data }: { data: LiveOverview | null }) {
  const live = data?.market_data.provider === 'mt5_bridge' && data.market_data.status === 'available';
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 ${live ? 'border-up/25 bg-up-soft/40' : 'border-warn/25 bg-warn-soft/40'}`}>
      {live ? <Activity className="mt-0.5 h-5 w-5 shrink-0 text-up" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />}
      <div className="min-w-0">
        <div className="text-sm font-medium">{live ? 'MT5 market connection verified' : 'Live market connection is not connected yet'}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {live ? 'Tembo is receiving data through the MT5 bridge. Execution remains separately controlled.' : 'This cockpit is ready for live data, but it will never label mock or missing data as live. Connect the MT5 bridge after the laptop is ready.'}
        </p>
      </div>
      <Pill tone={live ? 'good' : 'warn'}>{data?.mode ?? 'PREPARING'}</Pill>
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

export default function Live({ go }: { go: (r: string) => void }) {
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
