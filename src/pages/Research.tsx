import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../lib/api';
import type { Baseline, ResearchCandidate, ResearchFamily } from '../lib/types';
import { INSTRUMENTS, STATUS_TEXT, compactMoney, humanize, money, num, pct, shortDate } from '../lib/format';
import { Card, ErrorBlock, KV, LoadingBlock, Notice, PageHeader, Pill, Segmented, Stat } from '../components/ui';
import snapshot from '../data/researchSnapshot.json';
import Experiment3B from '../components/Experiment3B';

type Inst = (typeof INSTRUMENTS)[number];

function WindowChart({ instrument }: { instrument: Inst }) {
  const s = snapshot.selector.find((x) => x.instrument === instrument)!;
  const data = s.per_window.map((w, i) => ({
    name: `W${i + 1}`,
    range: `${shortDate(w.oos_start)} – ${shortDate(w.oos_end)}`,
    pnl: w.net_pnl ?? 0,
    traded: w.net_pnl != null,
    status: w.status,
    selected: w.selected,
  }));
  return (
    <div className="h-56 w-full" role="img" aria-label={`Out-of-sample result per test window for ${instrument}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#222a36" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#5d6776', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => `$${Math.round(v / 100) / 10}k`} tick={{ fill: '#5d6776', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={44} />
          <ReferenceLine y={0} stroke="#2c3544" />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="max-w-[240px] rounded-xl border border-line-2 bg-panel-2 px-3 py-2 text-xs shadow-xl">
                  <div className="text-muted">{d.range}</div>
                  {d.traded ? (
                    <>
                      <div className={`num mt-1 text-sm font-semibold ${d.pnl >= 0 ? 'text-up' : 'text-down'}`}>{money(d.pnl, { sign: true })}</div>
                      <div className="num mt-0.5 truncate text-faint">{d.selected}</div>
                    </>
                  ) : (
                    <div className="mt-1 font-medium text-fg">Stood aside: {STATUS_TEXT[d.status] ?? humanize(d.status)}</div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.name} fill={!d.traded ? '#2c3544' : d.pnl >= 0 ? '#3ecf8e' : '#f06a6a'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function pfTone(pf: number) {
  return pf >= 1.1 ? 'text-up' : pf >= 1 ? 'text-warn' : 'text-down';
}

export default function Research() {
  const [inst, setInst] = useState<Inst>('XAU/USD');
  const cands = useApi<ResearchCandidate[]>('/research/candidates');
  const fams = useApi<ResearchFamily[]>('/research/families');
  const base = useApi<Baseline>('/research/baseline');
  const sel = snapshot.selector.find((x) => x.instrument === inst)!;
  const fixed = snapshot.fixed_strategies.filter((f) => f.instrument === inst);

  return (
    <div>
      <PageHeader title="Research">
        Every strategy must prove itself on data it has never seen before it can be paper traded. This is the evidence so far.
      </PageHeader>

      <div className="mb-4">
        <Experiment3B />
      </div>

      <Card
        title="Walk-forward validation"
        subtitle={`${snapshot.data_period}. Each window: ${snapshot.walk_forward.development_days}d build, ${snapshot.walk_forward.validation_days}d check, ${snapshot.walk_forward.out_of_sample_days}d unseen test.`}
      >
        <Segmented options={INSTRUMENTS} value={inst} onChange={setInst} />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Stat label="Windows traded" value={`${sel.windows_traded}/${sel.windows}`} />
          <Stat label="Profitable" value={sel.windows_traded ? `${sel.windows_positive}/${sel.windows_traded}` : '—'} tone={sel.windows_traded && sel.windows_positive === sel.windows_traded ? 'up' : undefined} />
          <Stat label="Unseen-data P&L" value={sel.windows_traded ? compactMoney(sel.total_oos_net_pnl) : '$0'} sub="$10k per window" tone={sel.total_oos_net_pnl > 0 ? 'up' : undefined} />
        </div>
        <div className="mt-4">
          <WindowChart instrument={inst} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-up" /> Profitable window
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-down" /> Losing window
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-line-2" /> Stood aside (no trusted strategy)
          </span>
        </div>
        <div className="mt-4">
          <Notice tone={inst === 'XAU/USD' ? 'warn' : 'muted'}>
            {inst === 'XAU/USD'
              ? 'Gold was the only lead here: the selector traded 9 of 11 windows and all 9 made money. These runs used near-zero gold costs; see the latest result above for real costs and 2024–26 data.'
              : inst === 'EUR/USD'
                ? 'No strategy survived for EUR/USD. The selector correctly refused to trade in every window.'
                : 'GBP/USD had occasional promising windows but not enough evidence to trade.'}
          </Notice>
        </div>
        <p className="mt-3 text-[11px] text-faint">
          Snapshot of Edge Validation Experiments 1 and 2 ({shortDate(snapshot.snapshot_date)}). Past out-of-sample results do not guarantee future profit.
        </p>
      </Card>

      <Card title={`Fixed strategies on ${inst}`} subtitle="Same strategy every window, no selection. Profit factor above 1.0 means it made money after costs." pad={false} className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 font-medium sm:px-5">Strategy</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Trades</th>
                <th className="px-2 py-2 text-right font-medium">Win rate</th>
                <th className="px-4 py-2 text-right font-medium sm:px-2">Profit factor</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell sm:px-5">Windows up</th>
              </tr>
            </thead>
            <tbody className="num whitespace-nowrap">
              {fixed.map((f) => (
                <tr key={f.strategy} className="border-t border-line">
                  <td className="whitespace-normal px-4 py-2.5 font-sans font-medium sm:px-5">{f.strategy}</td>
                  <td className="hidden px-2 py-2.5 text-right sm:table-cell">{f.oos_trades.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right">{pct(f.win_rate, 0)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium sm:px-2 ${pfTone(f.profit_factor)}`}>{num(f.profit_factor)}</td>
                  <td className="hidden px-4 py-2.5 text-right sm:table-cell sm:px-5">{f.windows_profitable_pct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Strategy candidates" subtitle="Live from the backend research registry" pad={false} className="lg:col-span-2">
          {cands.loading && !cands.data ? (
            <div className="p-4">
              <LoadingBlock rows={5} />
            </div>
          ) : cands.error && !cands.data ? (
            <div className="p-4">
              <ErrorBlock error={cands.error} onRetry={cands.reload} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {(cands.data ?? []).map((c) => (
                <li key={c.candidate_id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.name}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{c.description}</p>
                    </div>
                    <Pill status={c.verdict}>{humanize(c.verdict)}</Pill>
                  </div>
                  <div className="mt-1.5 text-[11px] text-faint">
                    {humanize(c.family)} · {c.experiment_ids.length} experiment{c.experiment_ids.length === 1 ? '' : 's'} · gate {humanize(c.gate_status).toLowerCase()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="min-w-0 space-y-4">
          <Card title="Original baseline" subtitle="SMA 10/50 crossover, EUR/USD, 2012–2022">
            {base.loading && !base.data ? (
              <LoadingBlock rows={4} />
            ) : base.error && !base.data ? (
              <ErrorBlock error={base.error} onRetry={base.reload} />
            ) : base.data ? (
              <>
                <KV k="Trades" v={<span className="num">{base.data.historical_reference.trade_count.toLocaleString()}</span>} />
                <KV k="Profit factor (no costs)" v={<span className="num text-down">{num(base.data.historical_reference.zero_cost_profit_factor)}</span>} />
                <KV k="Return with costs" v={<span className="num text-down">{pct(base.data.historical_reference.base_cost_return, 0)}</span>} />
                <KV k="Max drawdown" v={<span className="num text-down">{pct(base.data.historical_reference.max_drawdown_percent, 0)}</span>} />
                <p className="mt-2 text-xs text-muted">The starting strategy lost money even with zero costs. Everything else is measured against it.</p>
              </>
            ) : null}
          </Card>

          <Card title="Strategy families" subtitle="How much each idea has been tested">
            {fams.loading && !fams.data ? (
              <LoadingBlock rows={4} />
            ) : fams.error && !fams.data ? (
              <ErrorBlock error={fams.error} onRetry={fams.reload} />
            ) : (
              <ul className="space-y-3">
                {(fams.data ?? []).map((f) => (
                  <li key={f.family} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{humanize(f.family)}</div>
                      <div className="text-[11px] text-faint">
                        {f.experiment_count} experiments · {f.rejected_count + f.oos_failure_count} failed
                      </div>
                    </div>
                    <Pill status={f.saturation_status === 'SATURATED' ? 'MEDIUM' : 'ACTIVE'}>{humanize(f.saturation_status)}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
