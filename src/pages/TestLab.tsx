import { useApi } from '../lib/api';
import type { PaperValidation, RuntimeEvent, RuntimeMetrics, RuntimeStatus } from '../lib/types';
import { Card, Empty, ErrorBlock, KV, LoadingBlock, Notice, PageHeader, Pill, RefreshButton, Stat } from '../components/ui';
import { dateTime, money, pct, humanize } from '../lib/format';

function ageLabel(iso: string | null) {
  if (!iso) return 'No cycle recorded';
  const age = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return 'less than 1 minute ago';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export default function TestLab({ go }: { go: (r: string) => void }) {
  const validation = useApi<PaperValidation>('/validation');
  const status = useApi<RuntimeStatus>('/runtime/status');
  const metrics = useApi<RuntimeMetrics>('/runtime/metrics');
  const events = useApi<RuntimeEvent[]>('/runtime/events?limit=12');

  const loading = validation.loading || status.loading || metrics.loading || events.loading;
  const reload = () => [validation, status, metrics, events].forEach((x) => x.reload());

  const suitePass = validation.data?.status === 'PASS';
  const runtimeRunning = status.data?.status === 'RUNNING';
  const runtimeSafe = status.data?.execution_enabled === false && status.data?.broker_contacted === false;

  return (
    <div>
      <PageHeader title="Test lab" action={<RefreshButton onClick={reload} loading={loading} />}>
        Verification workspace for the paper system. Synthetic checks never touch the broker; runtime evidence comes from persistent live-data cycles.
      </PageHeader>

      <Notice tone="info">
        <strong>Testing rule:</strong> a passing software suite does not prove profitability. We will validate the decision chain, data timing, risk controls and paper results separately before considering any execution integration.
      </Notice>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="Safety suite">
          {validation.loading && !validation.data ? <LoadingBlock rows={2} /> : validation.error && !validation.data ? <ErrorBlock error={validation.error} onRetry={validation.reload} /> : validation.data ? (
            <>
              <Stat label="Status" value={validation.data.status} tone={suitePass ? 'up' : 'down'} />
              <div className="mt-2 text-xs text-muted">{validation.data.checks.filter((x) => x.passed).length}/{validation.data.checks.length} checks passed</div>
            </>
          ) : null}
        </Card>

        <Card title="Runtime">
          {status.loading && !status.data ? <LoadingBlock rows={2} /> : status.error && !status.data ? <ErrorBlock error={status.error} onRetry={status.reload} /> : status.data ? (
            <>
              <Stat label="State" value={status.data.status} tone={runtimeRunning ? 'up' : 'down'} />
              <div className="mt-2 text-xs text-muted">{ageLabel(status.data.last_cycle_at)}</div>
            </>
          ) : null}
        </Card>

        <Card title="Execution gate">
          <Stat label="Broker contacted" value={runtimeSafe ? 'NO' : 'CHECK'} tone={runtimeSafe ? 'up' : 'down'} />
          <div className="mt-2 text-xs text-muted">{runtimeSafe ? 'Paper-only boundary confirmed by runtime telemetry.' : 'Unexpected execution state — stop testing and inspect configuration.'}</div>
        </Card>

        <Card title="Paper evidence">
          {metrics.loading && !metrics.data ? <LoadingBlock rows={2} /> : metrics.error && !metrics.data ? <ErrorBlock error={metrics.error} onRetry={metrics.reload} /> : metrics.data ? (
            <>
              <Stat label="Closed trades" value={metrics.data.performance.closed_trades} />
              <div className="mt-2 text-xs text-muted">
                P&L {money(metrics.data.performance.realized_pnl, { sign: true })}
                {metrics.data.performance.win_rate != null ? ` · win rate ${pct(metrics.data.performance.win_rate, 0)}` : ''}
              </div>
            </>
          ) : null}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Synthetic safety checks" subtitle="In-memory only · no persistent state changes">
          {validation.loading && !validation.data ? <LoadingBlock rows={5} /> : validation.error && !validation.data ? <ErrorBlock error={validation.error} onRetry={validation.reload} /> : validation.data ? (
            <div className="space-y-2">
              {validation.data.checks.map((check) => (
                <div key={check.name} className="rounded-xl border border-line bg-panel-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium">{humanize(check.name)}</span>
                    <Pill tone={check.passed ? 'good' : 'bad'}>{check.passed ? 'PASS' : 'FAIL'}</Pill>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{check.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card title="Runtime telemetry" subtitle={metrics.data ? `${metrics.data.cycles_observed} cycles · ${metrics.data.events_observed} events observed` : undefined}>
          {status.data && (
            <div className="mb-4 rounded-xl border border-line bg-panel-2 p-3">
              <KV k="Last cycle" v={status.data.last_cycle_at ? dateTime(status.data.last_cycle_at) : '—'} />
              <KV k="Open positions" v={status.data.open_positions} />
              <KV k="Realized P&L" v={money(status.data.realized_pnl, { sign: true })} />
              <KV k="Peak equity" v={money(status.data.peak_equity)} />
              <KV k="Execution" v={status.data.execution_enabled ? 'ENABLED' : 'DISABLED'} />
              <KV k="Broker contact" v={status.data.broker_contacted ? 'YES' : 'NO'} />
            </div>
          )}
          {events.loading && !events.data ? <LoadingBlock rows={5} /> : events.error && !events.data ? <ErrorBlock error={events.error} onRetry={events.reload} /> : !events.data?.length ? <Empty title="No runtime events yet" /> : (
            <div className="space-y-2">
              {events.data.map((event, i) => (
                <div key={`${event.created_at ?? 'event'}-${i}`} className="rounded-xl border border-line bg-panel-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill status={event.status}>{humanize(event.status ?? 'EVENT')}</Pill>
                    {event.instrument && <span className="num text-xs font-medium">{event.instrument}</span>}
                    {event.timeframe && <span className="text-[11px] text-faint">{event.timeframe.toUpperCase()}</span>}
                    {event.created_at && <span className="ml-auto text-[10px] text-faint">{dateTime(event.created_at)}</span>}
                  </div>
                  {event.reason && <p className="mt-1 text-[11px] leading-relaxed text-muted">{event.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Testing sequence" subtitle="Use this order when we begin the real test campaign.">
          <ol className="space-y-2 text-xs text-muted">
            <li><span className="font-medium text-fg">1. Safety:</span> synthetic suite must remain PASS.</li>
            <li><span className="font-medium text-fg">2. Data:</span> verify completed-candle timing, provider freshness and no 429/credential leakage.</li>
            <li><span className="font-medium text-fg">3. Decision:</span> verify BUY/SELL/WAIT/blocked outcomes against the research and macro gates.</li>
            <li><span className="font-medium text-fg">4. Paper lifecycle:</span> observe entries, SL/TP/max-hold exits and persistence across restarts.</li>
            <li><span className="font-medium text-fg">5. Evidence:</span> collect enough closed paper trades before drawing conclusions about strategy behavior.</li>
            <li><span className="font-medium text-fg">6. Only after that:</span> decide whether another execution phase is warranted. Live execution stays disabled meanwhile.</li>
          </ol>
        </Card>
      </div>

      <div className="mt-4 text-xs text-muted">
        Need the main cockpit? <button className="font-medium text-gold hover:underline" onClick={() => go('live')}>Open Live cockpit</button>
      </div>
    </div>
  );
}
