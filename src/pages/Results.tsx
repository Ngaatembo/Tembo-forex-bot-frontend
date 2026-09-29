import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock, Trophy } from 'lucide-react';
import { useApi } from '../lib/api';
import { money, pct, price } from '../lib/format';
import { Card, Empty, ErrorBlock, LoadingBlock, Notice, PageHeader, Pill, RefreshButton, Segmented, Stat } from '../components/ui';
import type { Tone } from '../lib/format';

export interface ShadowScore {
  trades: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  profit_factor: number | null;
  net_r: number;
  net_usd_at_50_per_r: number;
  avg_win_r: number | null;
  avg_loss_r: number | null;
  longest_losing_streak: number;
}

interface ShadowOpenTrade {
  direction: 'BUY' | 'SELL';
  signal_at: string;
  entry_at: string;
  entry_price: number;
  stop_price: number | null;
  target_price: number | null;
  mark_price: number;
  open_r: number;
  open_usd_at_50_per_r?: number;
}

export interface ShadowSetup {
  setup_id: string;
  label: string;
  instrument: string;
  timeframe: string;
  role: 'forward_test' | 'shadow';
  why: string;
  baseline: {
    period: string;
    trades: number;
    win_rate: number;
    profit_factor: number;
    per_month: number;
  };
  tracking_since: string | null;
  last_candle_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
  score: ShadowScore;
  verdict: {
    state: 'COLLECTING' | 'PASSED' | 'FAILED' | 'EXTENDED';
    target: number;
    message: string;
  };
  open_trade: ShadowOpenTrade | null;
}

interface ShadowTradeRow {
  setup_id: string;
  instrument: string;
  timeframe: string;
  direction: 'BUY' | 'SELL';
  signal_at: string;
  entry_at: string;
  entry_price: number;
  stop_price: number | null;
  target_price: number | null;
  exit_at: string;
  exit_price: number;
  exit_reason: string;
  r_multiple: number;
  usd_at_50_per_r: number;
}

export interface ShadowResults {
  generated_at: string;
  paper_only: boolean;
  dollars_per_r: number;
  pass_rule: string;
  combined: ShadowScore;
  setups: ShadowSetup[];
  trades: ShadowTradeRow[];
}

export const VERDICT: Record<ShadowSetup['verdict']['state'], { label: string; tone: Tone }> = {
  COLLECTING: { label: 'Collecting', tone: 'info' },
  EXTENDED: { label: 'Borderline, running on', tone: 'warn' },
  PASSED: { label: 'Passed', tone: 'good' },
  FAILED: { label: 'Failed', tone: 'bad' },
};

export const rText = (r: number | null | undefined) => (r == null ? '—' : `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(2)}R`);
const rTone = (r: number | null | undefined) => (r == null || r === 0 ? undefined : r > 0 ? 'up' : 'down');
const pfText = (s: ShadowScore) => (s.profit_factor != null ? s.profit_factor.toFixed(2) : s.wins > 0 ? 'No losses yet' : '—');
const tf = (t: string) => t.toUpperCase();
function when(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Direction({ d }: { d: 'BUY' | 'SELL' }) {
  const up = d === 'BUY';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-up' : 'text-down'}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {d}
    </span>
  );
}

function SetupCard({ s }: { s: ShadowSetup }) {
  const v = VERDICT[s.verdict.state];
  const progress = Math.min(1, s.score.trades / s.verdict.target);
  const o = s.open_trade;
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-fg">{s.label}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Pill tone={s.role === 'forward_test' ? 'good' : 'muted'}>{s.role === 'forward_test' ? 'Allowed on demo' : 'Paper only'}</Pill>
            <Pill tone={v.tone}>{v.label}</Pill>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`num text-lg font-semibold ${s.score.net_r > 0 ? 'text-up' : s.score.net_r < 0 ? 'text-down' : 'text-fg'}`}>
            {rText(s.score.net_r)}
          </div>
          <div className="num text-[11px] text-muted">{money(s.score.net_usd_at_50_per_r, { sign: true })}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-muted">
          <span>
            {s.score.trades >= s.verdict.target
              ? `Verdict at ${s.verdict.target} trades`
              : `${s.score.trades} of ${s.verdict.target} trades before the verdict`}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-muted">{s.verdict.message}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <Stat label="Win rate" value={pct(s.score.win_rate, 0)} sub={`${s.score.wins}W · ${s.score.losses}L`} />
        <Stat label="Profit factor" value={pfText(s.score)} sub={`Research ${s.baseline.profit_factor.toFixed(2)}`} />
        <Stat label="Research" value={`${pct(s.baseline.win_rate, 0)}`} sub={`win rate · ~${s.baseline.per_month}/month`} />
      </div>

      {o ? (
        <div className="mt-3 rounded-xl border border-line bg-panel-2 px-3 py-2 text-[12px]">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-fg">Open now</span> <Direction d={o.direction} />
            </span>
            <span className={`num font-semibold ${o.open_r > 0 ? 'text-up' : o.open_r < 0 ? 'text-down' : 'text-fg'}`}>{rText(o.open_r)}</span>
          </div>
          <div className="num mt-1 grid grid-cols-3 gap-2 text-[11px] text-muted">
            <span>Entry {price(o.entry_price, s.instrument)}</span>
            <span>SL {price(o.stop_price, s.instrument)}</span>
            <span>TP {price(o.target_price, s.instrument)}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-faint">Since {when(o.entry_at)}</div>
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-faint">No open trade. Waiting for the next signal.</div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">{s.why}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> Tracking since {s.tracking_since ? when(s.tracking_since) : 'starting…'}
        </span>
        <span>Last checked candle {s.last_candle_at ? when(s.last_candle_at) : '—'}</span>
      </div>
      {s.last_error && <div className="mt-2 text-[11px] text-warn">Last update failed, retrying: {s.last_error}</div>}
    </section>
  );
}

function TradeList({ trades, setups }: { trades: ShadowTradeRow[]; setups: ShadowSetup[] }) {
  const [all, setAll] = useState(false);
  const labels: Record<string, string> = Object.fromEntries(setups.map((s) => [s.setup_id, `${s.instrument} ${tf(s.timeframe)}`]));
  if (!trades.length) {
    return (
      <Empty title="No closed trades yet">
        Trades appear here as soon as the first one closes. The M15 setups usually give a few trades a week; USD/JPY H1 about one or two.
      </Empty>
    );
  }
  return (
    <>
      <div className="-mx-4 divide-y divide-line sm:-mx-5">
        {(all ? trades : trades.slice(0, 15)).map((t) => (
          <div key={t.setup_id + t.entry_at} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-2.5 sm:grid-cols-[150px_1fr_auto] sm:px-5">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="font-semibold text-fg">{labels[t.setup_id] ?? t.instrument}</span>
              <Direction d={t.direction} />
            </div>
            <div
              className={`num row-span-2 self-center text-right sm:order-3 ${rTone(t.r_multiple) === 'up' ? 'text-up' : rTone(t.r_multiple) === 'down' ? 'text-down' : 'text-fg'}`}
            >
              <div className="text-sm font-semibold">{rText(t.r_multiple)}</div>
              <div className="text-[11px]">{money(t.usd_at_50_per_r, { sign: true })}</div>
            </div>
            <div className="num text-[11px] text-muted sm:order-2">
              {price(t.entry_price, t.instrument)} → {price(t.exit_price, t.instrument)} · {t.exit_reason}
              <div className="text-faint">
                {when(t.entry_at)} → {when(t.exit_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
      {trades.length > 15 && !all && (
        <button onClick={() => setAll(true)} className="mt-3 w-full rounded-lg border border-line-2 px-3 py-2 text-[12px] text-muted hover:text-fg">
          Show all {trades.length} trades
        </button>
      )}
    </>
  );
}

export default function Results() {
  const res = useApi<ShadowResults>('/shadow/results', { refreshMs: 120_000 });
  const [filter, setFilter] = useState<string>('All');
  const d = res.data;
  const setupNames = d ? ['All', ...d.setups.map((s) => `${s.instrument} ${tf(s.timeframe)}`)] : ['All'];
  const shown = d ? d.trades.filter((t) => filter === 'All' || `${t.instrument} ${tf(t.timeframe)}` === filter) : [];
  const c = d?.combined;
  const since = d?.setups
    .map((s) => s.tracking_since)
    .filter(Boolean)
    .sort()[0];

  return (
    <div>
      <PageHeader title="Results" action={<RefreshButton onClick={res.reload} loading={res.loading} />}>
        Paper-only scoreboard. Every signal from three setups, scored in R (the amount risked), from the moment tracking started. Nothing here touches the demo
        account.
      </PageHeader>

      {res.loading && !d ? (
        <Card>
          <LoadingBlock rows={4} />
        </Card>
      ) : res.error && !d ? (
        <ErrorBlock error={res.error} onRetry={res.reload} />
      ) : d && c ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted">
              <Trophy className="h-4 w-4 text-gold" /> All setups together {since ? `· since ${when(since)}` : ''}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Closed trades" value={c.trades} sub={c.trades ? `${c.wins} won · ${c.losses} lost` : 'None closed yet'} />
              <Stat label="Win rate" value={pct(c.win_rate, 0)} sub="Winners are ~2× losers" />
              <Stat label="Profit factor" value={pfText(c)} sub="Above 1.00 = making money" />
              <Stat
                label="Net"
                value={rText(c.net_r)}
                tone={rTone(c.net_r)}
                sub={`${money(c.net_usd_at_50_per_r, { sign: true })} at $${d.dollars_per_r} a trade`}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            {d.setups.map((s) => (
              <SetupCard key={s.setup_id} s={s} />
            ))}
          </div>

          <Notice tone="info">
            <b>Pass mark, fixed before tracking started:</b> {d.pass_rule} Win rates around 40% are normal here: the target is twice the stop, so a few wins pay
            for more losses.
          </Notice>

          <Card
            title="Every closed trade"
            subtitle="Newest first. Entry is the next candle's open after the signal; exits are the stop, the target, 100 candles, or an opposite signal."
            action={null}
          >
            <div className="mb-3">
              <Segmented options={setupNames} value={filter} onChange={setFilter} />
            </div>
            <TradeList trades={shown} setups={d.setups} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
