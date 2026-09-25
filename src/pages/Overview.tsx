import { ArrowRight, CircleSlash, ShieldCheck } from 'lucide-react';
import { enc, useApi } from '../lib/api';
import type { AccountOverview, Calendar, Decision, Health } from '../lib/types';
import { INSTRUMENTS, STATUS_TEXT, dateTime, humanize, money, relTime } from '../lib/format';
import { Card, ErrorBlock, LoadingBlock, PageHeader, Pill, Skeleton, Stat } from '../components/ui';
import snapshot from '../data/researchSnapshot.json';

function DecisionTile({ instrument, go }: { instrument: string; go: (r: string) => void }) {
  const { data, error, loading, reload } = useApi<Decision>(`/decisions?instrument=${encodeURIComponent(instrument)}&timeframe=h1`);
  return (
    <button
      onClick={() => go(`decisions/${enc(instrument)}`)}
      className="group flex w-full flex-col rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-line-2 hover:bg-panel-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-base font-semibold">{instrument}</span>
        <span className="text-[11px] text-faint">H1</span>
      </div>
      {loading && !data ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : error && !data ? (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <ErrorBlock error={error} onRetry={reload} />
        </div>
      ) : data ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill status={data.selector_status}>{STATUS_TEXT[data.selector_status] ?? humanize(data.selector_status)}</Pill>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <CircleSlash className={`h-4 w-4 ${data.final_decision === 'NO_TRADE' ? 'text-faint' : 'text-up'}`} />
            <span className="font-medium">{data.final_decision === 'NO_TRADE' ? 'No trade' : humanize(data.final_decision)}</span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
            {data.selected_config
              ? `Best candidate: ${humanize(data.selected_config.strategy_family)}${
                  Object.keys(data.selected_config.parameters ?? {}).length
                    ? ` (${Object.entries(data.selected_config.parameters)
                        .map(([k, v]) => `${k} ${v}`)
                        .join(', ')})`
                    : ''
                }, evidence ${data.selected_config.statistical_level.toLowerCase()}.`
              : data.reason}
          </p>
          <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-gold opacity-80 group-hover:opacity-100">
            See the full decision <ArrowRight className="h-3 w-3" />
          </span>
        </>
      ) : null}
    </button>
  );
}

function SystemCard() {
  const { data, error, loading, reload } = useApi<Health>('/health');
  const rows: [string, string | undefined][] = [
    ['Market data', data?.market_data],
    ['News', data?.news_service],
    ['Database', data?.database],
    ['Paper broker', data?.paper_broker],
    ['AI service', data?.ai_service],
  ];
  return (
    <Card title="System" subtitle="Live status reported by the backend">
      {loading && !data ? (
        <LoadingBlock rows={4} />
      ) : error && !data ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : (
        <div className="space-y-2.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-muted">{k}</span>
              <Pill status={v === 'twelvedata' || v === 'finnhub' ? 'available' : v}>{humanize(v)}</Pill>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm">
            <span className="text-muted">Live execution</span>
            <Pill tone={data?.live_execution_enabled ? 'bad' : 'good'}>{data?.live_execution_enabled ? 'Enabled' : 'Disabled'}</Pill>
          </div>
        </div>
      )}
    </Card>
  );
}

function AccountCard({ go }: { go: (r: string) => void }) {
  const { data, error, loading, reload } = useApi<AccountOverview>('/account/overview');
  return (
    <Card
      title="Paper account"
      subtitle={data?.generated_at ? `Snapshot ${relTime(data.generated_at)}` : 'Simulated money only'}
      action={
        <button onClick={() => go('paper')} className="text-xs font-medium text-gold">
          Open
        </button>
      }
    >
      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : error && !data ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : data ? (
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Equity" value={money(data.equity)} />
          <Stat label="Realized P&L" value={money(data.realized_pnl, { sign: true })} tone={data.realized_pnl < 0 ? 'down' : data.realized_pnl > 0 ? 'up' : undefined} />
          <Stat label="Open positions" value={data.open_positions_count} />
          <Stat label="Real money" value={money(data.real_money)} sub={humanize(data.mode)} />
        </div>
      ) : null}
    </Card>
  );
}

function ResearchCard({ go }: { go: (r: string) => void }) {
  return (
    <Card
      title="Where the research stands"
      subtitle={`Walk-forward test on ${snapshot.data_period}`}
      action={
        <button onClick={() => go('research')} className="text-xs font-medium text-gold">
          Details
        </button>
      }
    >
      <div className="space-y-3">
        {snapshot.selector.map((s) => {
          const tone = s.windows_traded === 0 ? 'bad' : s.instrument === 'XAU/USD' ? 'good' : 'warn';
          return (
            <div key={s.instrument} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="num text-sm font-medium">{s.instrument}</div>
                <div className="text-xs text-muted">
                  {s.windows_traded === 0
                    ? `Stood aside in all ${s.windows} test windows`
                    : `Traded ${s.windows_traded} of ${s.windows} windows, ${s.windows_positive} profitable`}
                </div>
              </div>
              <Pill tone={tone}>{s.windows_traded === 0 ? 'No edge' : s.instrument === 'XAU/USD' ? 'Lead' : 'Weak'}</Pill>
            </div>
          );
        })}
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
          Latest (25 Sep 2026): the gold breakout stayed profitable on unseen 2024–26 data with real costs, mostly from long trades in gold's uptrend. Next step is live paper trading, not real money.
        </p>
      </div>
    </Card>
  );
}

function EventsCard({ go }: { go: (r: string) => void }) {
  const { data, error, loading, reload } = useApi<Calendar>('/calendar');
  const now = Date.now();
  const upcoming = (data?.events ?? []).filter((e) => new Date(e.timestamp).getTime() >= now).slice(0, 4);
  return (
    <Card
      title="Next macro events"
      subtitle="Central bank decisions that can move price"
      action={
        <button onClick={() => go('news')} className="text-xs font-medium text-gold">
          Calendar
        </button>
      }
    >
      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : error && !data ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : data?.status === 'UNAVAILABLE' ? (
        <p className="text-sm text-muted">Calendar is not connected on the backend yet.</p>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-muted">No upcoming events in the calendar.</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((e) => (
            <li key={e.event_id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{e.event_name}</div>
                <div className="text-xs text-muted">{dateTime(e.timestamp)}</div>
              </div>
              <Pill tone={e.importance?.toUpperCase() === 'HIGH' ? 'warn' : 'muted'}>{e.currency}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Overview({ go }: { go: (r: string) => void }) {
  const health = useApi<Health>('/health');
  return (
    <div>
      <PageHeader title="Overview">
        What the decision engine says right now for each instrument, and why. Every decision comes straight from the backend's selector
        and research gates.
      </PageHeader>

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-up/20 bg-up-soft/40 px-4 py-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-up" />
        <p className="text-sm">
          <span className="font-medium">Paper trading only.</span>{' '}
          <span className="text-muted">
            {health.data && health.data.live_execution_enabled
              ? 'Warning: the backend reports live execution as enabled.'
              : 'Live execution is off. Nothing here places real trades.'}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {INSTRUMENTS.map((i) => (
          <DecisionTile key={i} instrument={i} go={go} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ResearchCard go={go} />
        <AccountCard go={go} />
        <div className="min-w-0 space-y-4">
          <SystemCard />
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <EventsCard go={go} />
        <Card title="How a decision is made" subtitle="The chain every trade idea must pass">
          <ol className="space-y-2.5 text-sm">
            {[
              ['Research gate', 'Strategy must survive out-of-sample testing'],
              ['Selector', 'Picks the strongest config by gate rank, never by profit alone'],
              ['Macro safety', 'Blocks trades near high-impact events'],
              ['Risk engine', 'Max 1% risk per trade, 3% open, 15% drawdown'],
              ['Kill switch', 'Fails closed if anything is off'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-2 text-[10px] text-muted">{i + 1}</span>
                <span>
                  <span className="font-medium">{t}</span> <span className="text-muted">· {d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-faint">Risk limits shown are the backend's deployed defaults.</p>
        </Card>
      </div>
    </div>
  );
}
