import { useApi } from '../lib/api';
import type { PaperValidation, RiskMetrics, RuntimeEvent, RuntimeMetrics, RuntimePosition, RuntimeStatus, RuntimeTrade } from '../lib/types';
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

// Live paper runtime: the persistent account the backend trades on paper every cycle.
export default function Paper() {
  const status = useApi<RuntimeStatus>('/runtime/status', { refreshMs: 120_000 });
  const open = useApi<RuntimePosition[]>('/runtime/positions', { refreshMs: 120_000 });
  const closed = useApi<RuntimeTrade[]>('/runtime/trades');
  const metrics = useApi<RuntimeMetrics>('/runtime/metrics');
  const events = useApi<RuntimeEvent[]>('/runtime/events?limit=25');
  const risk = useApi<RiskMetrics>('/risk/metrics');
  const validation = useApi<PaperValidation>('/validation');
  const loading = status.loading || open.loading || closed.loading;
  const reloadAll = () => [status, open, closed, metrics, events, risk, validation].forEach((x) => x.reload());
  const s = status.data;
  const equity = s ? s.initial_equity + (s.realized_pnl ?? 0) : null;
  const perf = metrics.data?.performance;

  return (
    <div>
      <PageHeader title="Paper trading" action={<RefreshButton onClick={reloadAll} loading={loading} />}>
        Tembo's persistent paper account. Every cycle runs the full chain on live data: strategy, research gate, macro check, risk engine and kill switch. No real money.
      </PageHeader>

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        {status.loading && !s ? (
          <LoadingBlock rows={2} />
        ) : status.error && !s ? (
          <ErrorBlock error={status.error} onRetry={status.reload} />
        ) : s ? (
          <>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="Equity" value={money(equity)} sub={`Started at ${money(s.initial_equity)}`} tone="up" />
              <Stat
                label="Realized P&L"
                value={money(s.realized_pnl, { sign: true })}
                tone={s.realized_pnl < 0 ? 'down' : s.realized_pnl > 0 ? 'up' : undefined}
                sub={s.initial_equity ? pct(s.realized_pnl / s.initial_equity, 2) : undefined}
              />
              <Stat label="Closed trades" value={perf?.closed_trades ?? '—'} sub={perf?.win_rate != null ? `Win rate ${pct(perf.win_rate, 0)}` : 'No closed trades yet'} />
              <Stat label="Open positions" value={s.open_positions} sub={`Peak equity ${money(s.peak_equity)}`} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-muted">
              <Pill tone={s.status === 'RUNNING' ? 'good' : 'warn'}>{humanize(s.status)}</Pill>
              <span>Last cycle {dateTime(s.last_cycle_at)}</span>
              <span className="text-faint">·</span>
              <span>Broker contacted: {s.broker_contacted ? 'yes' : 'no'}</span>
              <span className="text-faint">·</span>
              <span>Execution: {s.execution_enabled ? 'enabled' : 'disabled'}</span>
            </div>
          </>
        ) : null}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card title="Open positions" pad={false}>
            {open.loading && !open.data ? (
              <div className="p-4"><LoadingBlock /></div>
            ) : open.error && !open.data ? (
              <div className="p-4"><ErrorBlock error={open.error} onRetry={open.reload} /></div>
            ) : !open.data?.length ? (
              <div className="p-4"><Empty title="No open positions">Tembo opens a paper position only when a researched strategy triggers and every gate passes.</Empty></div>
            ) : (
              <ul className="divide-y divide-line">
                {open.data.map((p) => (
                  <li key={p.position_id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="num text-sm font-semibold">{p.instrument}</span>
                        <Pill tone={p.direction === 'LONG' ? 'good' : 'bad'}>{p.direction}</Pill>
                        <span className="text-[11px] text-faint">{p.timeframe.toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-muted">{dateTime(p.entry_time)}</span>
                    </div>
                    <div className="num mt-2 grid grid-cols-4 gap-2 text-xs">
                      <div><div className="text-faint">Entry</div>{price(p.entry_price, p.instrument)}</div>
                      <div><div className="text-faint">Stop</div><span className="text-down">{price(p.stop_price, p.instrument)}</span></div>
                      <div><div className="text-faint">Target</div><span className="text-up">{price(p.take_profit_price, p.instrument)}</span></div>
                      <div><div className="text-faint">Size</div>{p.position_size}</div>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-faint">Strategy {p.candidate_config_id} · held {p.periods_held} candles</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Trade history" pad={false}>
            {closed.loading && !closed.data ? (
              <div className="p-4"><LoadingBlock /></div>
            ) : closed.error && !closed.data ? (
              <div className="p-4"><ErrorBlock error={closed.error} onRetry={closed.reload} /></div>
            ) : !closed.data?.length ? (
              <div className="p-4"><Empty title="No closed trades yet" /></div>
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

          <Card title="Runtime activity" subtitle="Latest decisions from the paper runtime (newest first)">
            {events.loading && !events.data ? (
              <LoadingBlock rows={4} />
            ) : events.error && !events.data ? (
              <ErrorBlock error={events.error} onRetry={events.reload} />
            ) : !events.data?.length ? (
              <Empty title="No activity yet" />
            ) : (
              <ol className="relative space-y-3 border-l border-line pl-4">
                {events.data.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-panel bg-line-2" />
                    <div className="flex flex-wrap items-center gap-2">
                      {e.instrument && <span className="num text-xs font-semibold">{e.instrument}</span>}
                      {e.status && <Pill status={e.status}>{STATUS_TEXT[e.status] ?? humanize(e.status)}</Pill>}
                      {e.created_at && <span className="text-[11px] text-faint">{dateTime(e.created_at)}</span>}
                    </div>
                    {e.reason && <p className="mt-1 text-xs leading-relaxed text-muted">{e.reason}</p>}
                  </li>
                ))}
              </ol>
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

          <Card title="Why Tembo said no" subtitle="Most common reasons across runtime cycles">
            {metrics.data ? (
              Object.entries(metrics.data.rejection_reason_counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([k, v]) => <KV key={k} k={<span className="line-clamp-2 text-xs">{k}</span>} v={<span className="num">{v}</span>} />)
            ) : metrics.error ? (
              <ErrorBlock error={metrics.error} onRetry={metrics.reload} />
            ) : (
              <LoadingBlock rows={3} />
            )}
          </Card>

          <Card title="Safety validation" subtitle="Synthetic software-path check · no broker contact">
            {validation.loading && !validation.data ? (
              <LoadingBlock rows={3} />
            ) : validation.error && !validation.data ? (
              <ErrorBlock error={validation.error} onRetry={validation.reload} />
            ) : validation.data ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">{validation.data.checks.filter((c) => c.passed).length} / {validation.data.checks.length} checks passed</span>
                  <Pill tone={validation.data.status === 'PASS' ? 'good' : 'bad'}>{validation.data.status}</Pill>
                </div>
                <div className="mt-3 space-y-1.5">
                  {validation.data.checks.map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-muted">{humanize(c.name)}</span>
                      <span className={c.passed ? 'text-up' : 'text-down'}>{c.passed ? 'PASS' : 'FAIL'}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </Card>

          <Notice tone="info">This page shows the live paper runtime. The older demonstration snapshot is no longer shown here, so every number above comes from the running account.</Notice>
        </div>
      </div>
    </div>
  );
}
