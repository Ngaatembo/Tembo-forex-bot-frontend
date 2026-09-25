import { useApi } from '../lib/api';
import type { AccountOverview, ClosedTrade, EngineEvent, OpenPosition, Performance, RiskMetrics } from '../lib/types';
import { STATUS_TEXT, dateTime, humanize, money, pct, price } from '../lib/format';
import { Card, Empty, ErrorBlock, KV, LoadingBlock, Notice, PageHeader, Pill, RefreshButton, Stat } from '../components/ui';

const LIMIT_LABELS: Record<string, string> = {
  max_risk_per_trade_pct: 'Risk per trade',
  max_total_open_risk_pct: 'Total open risk',
  max_daily_loss_pct: 'Daily loss limit',
  max_drawdown_pct: 'Max drawdown',
  max_simultaneous_positions: 'Max open positions',
  max_exposure_pct: 'Max exposure',
};

export default function Paper() {
  const account = useApi<AccountOverview>('/account/overview');
  const open = useApi<OpenPosition[]>('/positions/open');
  const closed = useApi<ClosedTrade[]>('/positions/closed');
  const risk = useApi<RiskMetrics>('/risk/metrics');
  const perf = useApi<Performance>('/performance');
  const events = useApi<EngineEvent[]>('/events');
  const loading = account.loading || open.loading || closed.loading;
  const reloadAll = () => [account, open, closed, risk, perf, events].forEach((x) => x.reload());
  const a = account.data;

  return (
    <div>
      <PageHeader title="Paper account" action={<RefreshButton onClick={reloadAll} loading={loading} />}>
        Simulated trading only. Every trade here passed the full chain: selector, research gate, macro check, risk engine and kill switch.
      </PageHeader>

      {a?.note && (
        <div className="mb-4">
          <Notice tone="info">{a.note}</Notice>
        </div>
      )}

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        {account.loading && !a ? (
          <LoadingBlock rows={2} />
        ) : account.error && !a ? (
          <ErrorBlock error={account.error} onRetry={account.reload} />
        ) : a ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Equity" value={money(a.equity)} sub={`Started at ${money(a.initial_equity)}`} tone="gold" />
            <Stat label="Realized P&L" value={money(a.realized_pnl, { sign: true })} tone={a.realized_pnl < 0 ? 'down' : a.realized_pnl > 0 ? 'up' : undefined} sub={a.initial_equity ? pct(a.realized_pnl / a.initial_equity, 2) : undefined} />
            <Stat label="Trades closed" value={perf.data?.trade_count ?? '—'} sub={perf.data?.win_rate != null ? `Win rate ${pct(perf.data.win_rate, 0)}` : undefined} />
            <Stat label="Real money at risk" value={money(a.real_money)} sub={humanize(a.mode)} />
          </div>
        ) : null}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card title="Open positions" pad={false}>
            {open.loading && !open.data ? (
              <div className="p-4">
                <LoadingBlock />
              </div>
            ) : open.error && !open.data ? (
              <div className="p-4">
                <ErrorBlock error={open.error} onRetry={open.reload} />
              </div>
            ) : !open.data?.length ? (
              <div className="p-4">
                <Empty title="No open positions" />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {open.data.map((p) => (
                  <li key={p.position_id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="num text-sm font-semibold">{p.instrument}</span>
                        <Pill tone={p.direction === 'LONG' ? 'good' : 'bad'}>{p.direction}</Pill>
                      </div>
                      <span className="text-xs text-muted">{dateTime(p.entry_time)}</span>
                    </div>
                    <div className="num mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-faint">Entry</div>
                        {price(p.entry_price, p.instrument)}
                      </div>
                      <div>
                        <div className="text-faint">Stop</div>
                        <span className="text-down">{price(p.stop_price, p.instrument)}</span>
                      </div>
                      <div>
                        <div className="text-faint">Size</div>
                        {p.position_size}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Closed trades" pad={false}>
            {closed.loading && !closed.data ? (
              <div className="p-4">
                <LoadingBlock />
              </div>
            ) : closed.error && !closed.data ? (
              <div className="p-4">
                <ErrorBlock error={closed.error} onRetry={closed.reload} />
              </div>
            ) : !closed.data?.length ? (
              <div className="p-4">
                <Empty title="No closed trades yet" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                      <th className="px-4 py-2 font-medium sm:px-5">Instrument</th>
                      <th className="px-2 py-2 font-medium">Side</th>
                      <th className="px-2 py-2 text-right font-medium">Entry → Exit</th>
                      <th className="px-2 py-2 font-medium">Exit reason</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-5">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closed.data.map((t) => (
                      <tr key={t.trade_id} className="border-t border-line">
                        <td className="px-4 py-2.5 sm:px-5">
                          <div className="num font-medium">{t.instrument}</div>
                          <div className="text-faint">{dateTime(t.exit_time)}</div>
                        </td>
                        <td className="px-2 py-2.5">{t.direction}</td>
                        <td className="num whitespace-nowrap px-2 py-2.5 text-right">
                          {price(t.entry_price, t.instrument)} → {price(t.exit_price, t.instrument)}
                        </td>
                        <td className="px-2 py-2.5 text-muted">{humanize(t.exit_reason)}</td>
                        <td className={`num whitespace-nowrap px-4 py-2.5 text-right font-medium sm:px-5 ${t.realized_pnl < 0 ? 'text-down' : 'text-up'}`}>{money(t.realized_pnl, { sign: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card title="Risk limits" subtitle={risk.data?.note}>
            {risk.loading && !risk.data ? (
              <LoadingBlock rows={4} />
            ) : risk.error && !risk.data ? (
              <ErrorBlock error={risk.error} onRetry={risk.reload} />
            ) : risk.data ? (
              Object.entries(risk.data.limits).map(([k, v]) => (
                <KV key={k} k={LIMIT_LABELS[k] ?? humanize(k)} v={<span className="num">{k.endsWith('_pct') ? pct(v, 0) : v}</span>} />
              ))
            ) : null}
          </Card>

          <Card title="Engine activity" subtitle="Latest decisions and trade events">
            {events.loading && !events.data ? (
              <LoadingBlock rows={4} />
            ) : events.error && !events.data ? (
              <ErrorBlock error={events.error} onRetry={events.reload} />
            ) : !events.data?.length ? (
              <Empty title="No activity yet" />
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-4">
                {events.data.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-panel bg-line-2" />
                    <div className="flex flex-wrap items-center gap-2">
                      {e.type === 'DECISION' ? (
                        <Pill status={e.status}>{STATUS_TEXT[e.status ?? ''] ?? humanize(e.status)}</Pill>
                      ) : (
                        <Pill tone={(e.realized_pnl ?? 0) < 0 ? 'bad' : 'good'}>{humanize(e.type)}</Pill>
                      )}
                      {e.timestamp && <span className="text-[11px] text-faint">{dateTime(e.timestamp)}</span>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {e.reason ??
                        `${e.instrument ?? ''} ${humanize(e.exit_reason)}${e.realized_pnl != null ? `, ${money(e.realized_pnl, { sign: true })}` : ''}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
