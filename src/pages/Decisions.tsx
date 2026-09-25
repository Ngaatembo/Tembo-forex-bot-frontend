import { CircleSlash, CheckCircle2 } from 'lucide-react';
import { useApi } from '../lib/api';
import type { Decision } from '../lib/types';
import { INSTRUMENTS, STATUS_TEXT, dateTime, humanize } from '../lib/format';
import { useInstrumentParam } from '../lib/route';
import { Card, Empty, ErrorBlock, KV, LoadingBlock, Notice, PageHeader, Pill, RefreshButton, Segmented } from '../components/ui';

function RegimeBars({ evidence }: { evidence: Record<string, number> }) {
  const entries = Object.entries(evidence).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="space-y-2.5">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted">{humanize(k)}</span>
            <span className="num text-fg">
              {v} <span className="text-faint">({((v / total) * 100).toFixed(0)}%)</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-gold/80" style={{ width: `${(v / total) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="pt-1 text-xs text-faint">Trades in the evidence, grouped by the market regime they happened in.</p>
    </div>
  );
}

export default function Decisions() {
  const [instrument, setInstrument] = useInstrumentParam('decisions');
  const { data, error, loading, reload } = useApi<Decision>(`/decisions?instrument=${encodeURIComponent(instrument)}&timeframe=h1`);

  return (
    <div>
      <PageHeader title="Decisions" action={<RefreshButton onClick={reload} loading={loading} />}>
        The full reasoning behind the engine's call for each instrument on the 1-hour chart.
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0 space-y-4 lg:col-span-2">
              <section className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="num text-lg font-semibold">
                    {data.instrument} <span className="text-sm font-normal text-faint">· {data.timeframe.toUpperCase()}</span>
                  </div>
                  <Pill status={data.selector_status}>{STATUS_TEXT[data.selector_status] ?? humanize(data.selector_status)}</Pill>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  {data.final_decision === 'NO_TRADE' ? <CircleSlash className="h-8 w-8 text-faint" /> : <CheckCircle2 className="h-8 w-8 text-up" />}
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-faint">Final decision</div>
                    <div className="text-2xl font-semibold">{data.final_decision === 'NO_TRADE' ? 'No trade' : humanize(data.final_decision)}</div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">{data.reason}</p>
                {data.research_recommendation && (
                  <div className="mt-4">
                    <Notice tone="info">
                      <span className="font-medium">What would change this: </span>
                      {data.research_recommendation}
                    </Notice>
                  </div>
                )}
                <p className="mt-4 text-[11px] text-faint">Evaluated {dateTime(data.timestamp)}</p>
              </section>

              <Card title="Candidates considered" subtitle="Ranked by research-gate status, not by past profit" pad={false}>
                {data.considered_candidates.length === 0 ? (
                  <div className="p-4">
                    <Empty title="No candidates for this instrument" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.considered_candidates.map((c) => {
                      const chosen = c.config_id === data.selected_config?.config_id;
                      return (
                        <li key={c.config_id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                          <div className="min-w-0">
                            <div className="num truncate text-xs text-fg">{c.config_id}</div>
                            <div className="mt-0.5 truncate text-xs text-muted">{c.reason}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {chosen && <span className="text-[10px] font-semibold uppercase tracking-wider text-gold">Selected</span>}
                            <Pill status={c.gate_status}>{humanize(c.gate_status)}</Pill>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>

            <div className="min-w-0 space-y-4">
              <Card title="Selected strategy">
                {data.selected_config ? (
                  <div>
                    <KV k="Family" v={humanize(data.selected_config.strategy_family)} />
                    {Object.entries(data.selected_config.parameters ?? {}).map(([k, v]) => (
                      <KV key={k} k={humanize(k)} v={<span className="num">{String(v)}</span>} />
                    ))}
                    <KV k="Gate" v={<Pill status={data.selected_config.gate_status}>{humanize(data.selected_config.gate_status)}</Pill>} />
                    <KV k="Verdict" v={humanize(data.selected_config.verdict)} />
                    <KV k="Evidence" v={humanize(data.selected_config.statistical_level)} />
                  </div>
                ) : (
                  <p className="text-sm text-muted">None. The selector found no configuration it trusts for this instrument.</p>
                )}
              </Card>

              {data.regime_evidence && Object.keys(data.regime_evidence).length > 0 && (
                <Card title="Market regimes in the evidence">
                  <RegimeBars evidence={data.regime_evidence} />
                </Card>
              )}

              <Card title="News & macro context" subtitle="Informational, kept separate from the decision logic">
                <KV k="Macro event risk" v={<Pill status={data.macro_event_risk.level}>{humanize(data.macro_event_risk.level)}</Pill>} />
                <p className="py-2 text-xs text-muted">{data.macro_event_risk.reason}</p>
                <KV k="News feed" v={<Pill status={data.news_context.status}>{humanize(data.news_context.status)}</Pill>} />
                <KV k="Relevant headlines" v={<span className="num">{data.news_context.relevant_news_count}</span>} />
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
