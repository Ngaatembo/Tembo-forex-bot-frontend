import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  CandlestickChart,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useApi } from '../lib/api';
import type {
  AccountOverview,
  LiveAnalysis,
  LiveDecision,
  LiveMarket,
  LiveOverview,
  MultiTimeframeAnalysis,
  RiskMetrics,
  RuntimeMetrics,
} from '../lib/types';
import { INSTRUMENTS, dateTime, humanize, money, price } from '../lib/format';

type Tone = 'good' | 'warn' | 'bad' | 'muted';

type LiveDecisionView = LiveDecision & {
  news?: {
    status?: string;
    freshness?: string;
    provider?: string;
    last_successful_fetch?: string | null;
    error?: string | null;
    headlines?: Array<{ news_id?: string; timestamp?: string; headline?: string; source?: string; url?: string | null }>;
  };
  macro_events?: Array<{ event_id?: string; timestamp?: string; currency?: string; country?: string | null; event_name?: string; importance?: string; previous?: string | number | null; forecast?: string | number | null; actual?: string | number | null; source?: string | null; time_confirmed?: boolean }>;
};

type DerivStatus = {
  connected?: boolean;
  configured?: boolean;
  mode?: string;
  account_id?: string | null;
  account_type?: string | null;
  status?: string | null;
  currency?: string | null;
  balance?: number | null;
  open_positions?: number;
  message?: string;
};

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeText(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function riskPercent(value: unknown) {
  if (!finite(value)) return '—';
  return (Math.abs(value) <= 1 ? value * 100 : value).toFixed(1) + '%';
}

function toneFor(value: unknown): Tone {
  const s = String(value ?? '').toUpperCase();
  if (['AVAILABLE', 'OK', 'PASS', 'APPROVED', 'PAPER_ELIGIBLE', 'TRADEABLE', 'LOW', 'CONNECTED'].includes(s)) return 'good';
  if (['MEDIUM', 'WAITING', 'DEGRADED', 'STALE', 'NOT_RUN', 'PREPARING', 'UNKNOWN'].includes(s)) return 'warn';
  if (['BLOCKED', 'REJECTED', 'RISK_REJECTED', 'HIGH', 'UNAVAILABLE', 'OFFLINE'].includes(s)) return 'bad';
  return 'muted';
}

function ToneDot({ tone = 'muted', pulse = false }: { tone?: Tone; pulse?: boolean }) {
  const cls = tone === 'good' ? 'bg-up' : tone === 'warn' ? 'bg-warn' : tone === 'bad' ? 'bg-down' : 'bg-faint';
  return <span className={'inline-block h-1.5 w-1.5 rounded-full ' + cls + (pulse ? ' pulse-dot' : '')} />;
}

function StatusBadge({ value, label }: { value?: unknown; label?: string }) {
  const tone = toneFor(value);
  return (
    <span className="inline-flex items-center gap-1.5 border border-line bg-panel-2 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
      <ToneDot tone={tone} />
      {label ?? humanize(String(value ?? 'waiting'))}
    </span>
  );
}

function TerminalPanel({
  title,
  eyebrow,
  right,
  children,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'border border-line bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.16)] ' + className}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-faint">{eyebrow}</div>}
          <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-fg">{title}</h2>
        </div>
        {right}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, sub, tone = 'muted' }: { label: string; value: string; sub?: string; tone?: Tone }) {
  const cls = tone === 'good' ? 'text-up' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-down' : 'text-fg';
  return (
    <div className="min-w-0 border-l border-line pl-3 first:border-l-0 first:pl-0">
      <div className="text-[8px] font-medium uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className={'num mt-1 truncate text-sm font-semibold ' + cls}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[9px] text-faint">{sub}</div>}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid min-h-40 place-items-center border border-dashed border-line-2 bg-panel-2 px-5 text-center">
      <div>
        <Activity className="mx-auto h-5 w-5 text-faint" />
        <div className="mt-2 text-xs font-medium text-muted">{title}</div>
        <div className="mt-1 max-w-sm text-[10px] leading-relaxed text-faint">{message}</div>
      </div>
    </div>
  );
}

function CandleChart({ data }: { data: LiveMarket | null }) {
  const candles = useMemo(() => {
    const raw = safeArray<any>(data?.candles);
    return raw
      .filter((c) => finite(Number(c?.open)) && finite(Number(c?.high)) && finite(Number(c?.low)) && finite(Number(c?.close)))
      .slice(-90)
      .map((c) => ({
        timestamp: safeText(c.timestamp, ''),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: finite(Number(c.volume)) ? Number(c.volume) : null,
      }));
  }, [data]);

  if (!data || data.status !== 'available' || candles.length === 0) {
    return <EmptyState title="Waiting for verified market data" message="No synthetic prices are drawn here. The chart renders only validated candles returned by Tembo's live market endpoint." />;
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;
  const maxVolume = Math.max(...candles.map((c) => c.volume ?? 0), 1);
  const left = 48;
  const right = 920;
  const top = 24;
  const bottom = 326;
  const chartWidth = right - left;
  const step = chartWidth / Math.max(candles.length, 1);
  const candleWidth = Math.max(2, Math.min(8, step * 0.62));
  const y = (v: number) => top + (max - v) / span * (bottom - top);

  return (
    <div className="overflow-hidden border border-line bg-[#0b1016]">
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[9px] text-faint">
        <span>{candles.length} validated candles · {humanize(data.timeframe)}</span>
        <span>{data.last_update ? dateTime(data.last_update) : '—'}</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 980 370" className="block h-[290px] min-w-[640px] w-full sm:h-[360px]" role="img" aria-label={data.instrument + ' validated candlestick chart'}>
          {[0, 1, 2, 3, 4].map((i) => {
            const gy = top + i * ((bottom - top) / 4);
            const value = max - i * (span / 4);
            return (
              <g key={i}>
                <line x1={left} y1={gy} x2={right} y2={gy} stroke="currentColor" className="text-line" strokeWidth="1" opacity="0.7" />
                <text x="935" y={gy + 3} fill="currentColor" className="text-[9px] fill-muted">{price(value, data.instrument)}</text>
              </g>
            );
          })}
          {candles.map((c, i) => {
            const x = left + i * step + step / 2;
            const up = c.close >= c.open;
            const bodyTop = y(Math.max(c.open, c.close));
            const bodyBottom = y(Math.min(c.open, c.close));
            const bodyHeight = Math.max(1.5, bodyBottom - bodyTop);
            const volumeHeight = ((c.volume ?? 0) / maxVolume) * 28;
            return (
              <g key={c.timestamp + '-' + i}>
                <line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke="currentColor" className={up ? 'text-up' : 'text-down'} strokeWidth="1" />
                <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} className={up ? 'fill-up' : 'fill-down'} opacity="0.9" />
                {volumeHeight > 0 && <rect x={x - candleWidth / 2} y={350 - volumeHeight} width={candleWidth} height={volumeHeight} className={up ? 'fill-up' : 'fill-down'} opacity="0.25" />}
              </g>
            );
          })}
          <line x1={left} y1={340} x2={right} y2={340} stroke="currentColor" className="text-line-2" />
          <text x={left} y="362" fill="currentColor" className="text-[9px] fill-faint">{candles[0]?.timestamp ? dateTime(candles[0].timestamp) : '—'}</text>
          <text x={right - 130} y="362" fill="currentColor" className="text-[9px] fill-faint">{candles[candles.length - 1]?.timestamp ? dateTime(candles[candles.length - 1].timestamp) : '—'}</text>
        </svg>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[9px] text-faint">
        <span>Provider: {humanize(data.provider)}</span>
        <span className="inline-flex items-center gap-1.5 text-up"><ToneDot tone="good" /> Data quality verified</span>
      </div>
    </div>
  );
}

function MarketWatch({
  data,
  instrument,
  setInstrument,
  market,
}: {
  data: LiveOverview | null;
  instrument: string;
  setInstrument: (v: string) => void;
  market: LiveMarket | null;
}) {
  const items = safeArray<any>(data?.instruments);
  return (
    <TerminalPanel title="Market watch" eyebrow="Instruments" right={<span className="text-[9px] text-up">LIVE DATA</span>}>
      <div className="space-y-1">
        {items.map((item) => {
          const selected = item?.instrument === instrument;
          const current = selected && finite(Number(market?.current_price))
            ? Number(market?.current_price)
            : finite(Number(item?.current_price))
              ? Number(item.current_price)
              : null;
          return (
            <button
              key={String(item?.instrument)}
              onClick={() => setInstrument(String(item?.instrument))}
              className={'flex w-full items-center justify-between border px-2.5 py-2 text-left transition ' + (selected ? 'border-gold/50 bg-gold-soft/50' : 'border-transparent hover:border-line hover:bg-panel-2')}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ToneDot tone={toneFor(item?.data_status)} pulse={selected} />
                <span className="text-[10px] font-semibold text-fg">{safeText(item?.instrument)}</span>
              </span>
              <span className="num text-[10px] text-muted">{current != null ? price(current, String(item?.instrument)) : '—'}</span>
            </button>
          );
        })}
        {items.length === 0 && <div className="py-4 text-center text-[10px] text-faint">No verified instruments returned.</div>}
      </div>
    </TerminalPanel>
  );
}

function AccountRail({ account, risk }: { account: AccountOverview | null; risk: RiskMetrics | null }) {
  return (
    <TerminalPanel title="Paper account" eyebrow="Execution boundary" right={<span className="text-[9px] text-warn">PAPER ONLY</span>}>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Balance" value={money(account?.initial_equity)} />
        <Metric label="Equity" value={money(account?.equity)} />
        <Metric label="Realized P&L" value={money(account?.realized_pnl, { sign: true })} tone={finite(account?.realized_pnl) ? (account!.realized_pnl >= 0 ? 'good' : 'bad') : 'muted'} />
        <Metric label="Open positions" value={String(account?.open_positions_count ?? '—')} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[9px] text-muted">
        <div><span className="text-faint">Mode</span><div className="mt-1 font-semibold text-fg">{safeText(account?.mode, 'PAPER')}</div></div>
        <div><span className="text-faint">Risk note</span><div className="mt-1 truncate font-semibold text-fg">{safeText(risk?.note, 'Server-side risk engine')}</div></div>
      </div>
    </TerminalPanel>
  );
}

function Guidance({
  decision,
  instrument,
}: {
  decision: LiveDecisionView | null;
  instrument: string;
}) {
  const plan = decision?.trade_plan;
  const decisionValue = safeText(decision?.decision, 'NO_TRADE').toUpperCase();
  const decisionTone: Tone = decisionValue === 'BUY' ? 'good' : decisionValue === 'SELL' ? 'bad' : 'warn';
  const confidence = finite(plan?.confidence) ? Number(plan?.confidence).toFixed(0) + '%' : '—';
  const risk = riskPercent(decision?.risk?.computed_risk_pct);
  return (
    <TerminalPanel
      title="Tembo Forex Bot Guidance"
      eyebrow="Deterministic decision engine"
      right={<span className="text-[9px] text-faint">{safeText(decision?.methodology, 'READ-ONLY')}</span>}
    >
      <div className="grid gap-3 lg:grid-cols-[1.15fr_2.85fr]">
        <div className="border border-line bg-[#0c1218] p-4">
          <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-faint">Current signal</div>
          <div className={'mt-3 inline-flex items-center gap-2 border px-4 py-2 text-lg font-bold tracking-[0.08em] ' + (decisionTone === 'good' ? 'border-up/40 bg-up-soft text-up' : decisionTone === 'bad' ? 'border-down/40 bg-down-soft text-down' : 'border-warn/40 bg-warn-soft text-warn')}>
            {decisionTone === 'good' ? <TrendingUp className="h-5 w-5" /> : decisionTone === 'bad' ? <TrendingDown className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
            {decisionValue}
          </div>
          <div className="mt-3 text-[10px] leading-relaxed text-muted">{safeText(decision?.strategy_gate?.reason, decision?.message ?? 'Waiting for verified evidence.')}</div>
          <div className="mt-4 flex items-center gap-2 text-[9px] text-up"><ShieldCheck className="h-3.5 w-3.5" /> Server-side decision. Browser does not calculate signals.</div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Metric label="Entry price" value={price(plan?.entry, instrument)} />
          <Metric label="Stop loss" value={price(plan?.stop_loss, instrument)} tone={plan?.stop_loss != null ? 'bad' : 'muted'} />
          <Metric label="Take profit" value={price(plan?.take_profit, instrument)} tone={plan?.take_profit != null ? 'good' : 'muted'} />
          <Metric label="Confidence" value={confidence} />
          <Metric label="Suggested risk" value={risk} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="border border-line bg-panel-2 p-3">
          <div className="text-[8px] uppercase tracking-[0.14em] text-faint">Decision status</div>
          <div className="mt-2"><StatusBadge value={decision?.status} /></div>
        </div>
        <div className="border border-line bg-panel-2 p-3">
          <div className="text-[8px] uppercase tracking-[0.14em] text-faint">Data quality</div>
          <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-fg">
            <ToneDot tone={decision?.data_quality?.is_clean ? 'good' : 'warn'} />
            {decision?.data_quality?.is_clean ? String(decision.data_quality.candle_count ?? '—') + ' validated candles' : 'Waiting for verified candles'}
          </div>
        </div>
        <div className="border border-line bg-panel-2 p-3">
          <div className="text-[8px] uppercase tracking-[0.14em] text-faint">Paper eligibility</div>
          <div className="mt-2"><StatusBadge value={decision?.paper_eligibility?.status} label={decision?.paper_eligibility?.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'} /></div>
        </div>
      </div>
    </TerminalPanel>
  );
}

function AnalysisGrid({ analysis }: { analysis: LiveAnalysis | null }) {
  const item = analysis?.analysis;
  const momentum = item?.momentum;
  const volatility = item?.volatility;
  const cards = [
    ['Trend', safeText(item?.trend?.state, 'Not available')],
    ['Momentum', safeText(item?.momentum?.state, 'Not available')],
    ['Volatility', safeText(item?.volatility?.state, 'Not available')],
    ['Market structure', safeText(item?.market_structure?.label, 'Not available')],
  ];
  return (
    <TerminalPanel title="Market analysis" eyebrow="Technical evidence">
      {analysis?.analysis ? (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {cards.map(([label, value]) => (
              <div key={label} className="border border-line bg-panel-2 p-3">
                <div className="text-[8px] uppercase tracking-[0.13em] text-faint">{label}</div>
                <div className="mt-2 text-[11px] font-semibold text-fg">{humanize(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <div className="border border-line bg-panel-2 p-3 text-[10px]">
              <div className="text-faint">RSI 14</div>
              <div className="num mt-1 text-fg">{finite(momentum?.rsi_14) ? Number(momentum.rsi_14).toFixed(1) : '—'}</div>
            </div>
            <div className="border border-line bg-panel-2 p-3 text-[10px]">
              <div className="text-faint">ATR 14</div>
              <div className="num mt-1 text-fg">{finite(volatility?.atr_14) ? Number(volatility.atr_14).toFixed(4) : '—'}</div>
            </div>
            <div className="border border-line bg-panel-2 p-3 text-[10px]">
              <div className="text-faint">ATR %</div>
              <div className="num mt-1 text-fg">{finite(volatility?.atr_percent) ? Number(volatility.atr_percent).toFixed(2) + '%' : '—'}</div>
            </div>
          </div>
        </>
      ) : <EmptyState title="Analysis unavailable" message={safeText(analysis?.message, 'Waiting for verified candles.')} />}
    </TerminalPanel>
  );
}

function KeyLevels({ analysis, instrument }: { analysis: LiveAnalysis | null; instrument: string }) {
  const levels = analysis?.analysis?.support_resistance;
  return (
    <TerminalPanel title="Key levels" eyebrow="Structure">
      <div className="space-y-2">
        {[
          ['Resistance', levels?.resistance, 'bad'],
          ['Recent high', levels?.recent_high, 'muted'],
          ['Support', levels?.support, 'good'],
          ['Recent low', levels?.recent_low, 'muted'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="flex items-center justify-between border-b border-line py-2 last:border-b-0">
            <span className="text-[9px] uppercase tracking-[0.12em] text-faint">{String(label)}</span>
            <span className={'num text-[10px] font-semibold ' + (tone === 'good' ? 'text-up' : tone === 'bad' ? 'text-down' : 'text-fg')}>{price(finite(Number(value)) ? Number(value) : null, instrument)}</span>
          </div>
        ))}
      </div>
    </TerminalPanel>
  );
}

function MultiTimeframe({ data }: { data: MultiTimeframeAnalysis | null }) {
  const entries = ['m5', 'm15', 'h1', 'h4', 'd1'];
  return (
    <TerminalPanel title="Trend matrix" eyebrow="Multi-timeframe context">
      <div className="grid grid-cols-5 gap-1.5">
        {entries.map((tf) => {
          const value: any = data?.timeframes?.[tf];
          const state = value && typeof value === 'object' && 'trend' in value ? value.trend?.state : value?.status;
          return (
            <div key={tf} className="border border-line bg-panel-2 p-2 text-center">
              <div className="text-[8px] font-semibold text-faint">{tf.toUpperCase()}</div>
              <div className="mt-1 text-[9px] font-semibold text-fg">{humanize(safeText(state, 'Waiting'))}</div>
            </div>
          );
        })}
      </div>
    </TerminalPanel>
  );
}

function NewsImpact({ decision }: { decision: LiveDecisionView | null }) {
  const news = decision?.news;
  const events = safeArray<any>(decision?.macro_events);
  const headlines = safeArray<any>(news?.headlines);
  return (
    <TerminalPanel title="News & calendar" eyebrow="Macro context">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">News impact</span>
            <StatusBadge value={news?.status} />
          </div>
          {headlines.length ? (
            <div className="space-y-1.5">
              {headlines.slice(0, 3).map((item, i) => (
                <div key={String(item?.news_id ?? i)} className="border border-line bg-panel-2 p-2.5">
                  <div className="text-[10px] font-medium text-fg">{safeText(item?.headline, 'Untitled')}</div>
                  <div className="mt-1 text-[8px] text-faint">{safeText(item?.source)} · {item?.timestamp ? dateTime(item.timestamp) : '—'}</div>
                </div>
              ))}
            </div>
          ) : <div className="border border-dashed border-line-2 p-3 text-[9px] text-faint">No verified news data.</div>}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">Upcoming events</span>
            <StatusBadge value={decision?.macro_risk?.level} />
          </div>
          {events.length ? (
            <div className="space-y-1.5">
              {events.slice(0, 3).map((event, i) => (
                <div key={String(event?.event_id ?? i)} className="border border-line bg-panel-2 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-fg">
                    <span>{safeText(event?.event_name, 'Economic event')}</span>
                    <span className="text-warn">{humanize(safeText(event?.importance))}</span>
                  </div>
                  <div className="mt-1 text-[8px] text-faint">{safeText(event?.currency)} · {event?.timestamp ? dateTime(event.timestamp) : '—'}</div>
                </div>
              ))}
            </div>
          ) : <div className="border border-dashed border-line-2 p-3 text-[9px] text-faint">No verified calendar events.</div>}
        </div>
      </div>
      <div className="mt-3 border border-warn/20 bg-warn-soft/30 p-2.5 text-[9px] leading-relaxed text-muted">
        Macro risk: <span className="font-semibold text-fg">{humanize(safeText(decision?.macro_risk?.level))}</span> · {safeText(decision?.macro_risk?.reason, 'Macro risk is not available.')}
      </div>
    </TerminalPanel>
  );
}

function RiskMonitor({ decision }: { decision: LiveDecisionView | null }) {
  const gates = [
    ['Research / strategy gate', decision?.strategy_gate?.status, decision?.strategy_gate?.reason],
    ['Macro-risk gate', decision?.macro_risk?.level, decision?.macro_risk?.reason],
    ['Risk engine', decision?.risk?.state ?? decision?.risk?.status, decision?.risk?.reason],
    ['Paper eligibility', decision?.paper_eligibility?.status, decision?.paper_eligibility?.reason],
    ['Execution', decision?.execution?.enabled ? 'ENABLED' : 'DISABLED', decision?.execution?.note],
  ];
  return (
    <TerminalPanel title="Risk monitor" eyebrow="Server-side safety state" right={<ShieldCheck className="h-4 w-4 text-up" />}>
      <div className="space-y-1">
        {gates.map(([name, state, reason]) => {
          const tone = name === 'Execution' ? 'good' : toneFor(state);
          const finalTone = name === 'Execution' && String(state) === 'ENABLED' ? 'warn' : tone;
          return (
            <div key={String(name)} className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
              <ToneDot tone={finalTone} />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-medium text-fg">{String(name)}</div>
                <div className="truncate text-[8px] text-faint">{safeText(reason)}</div>
              </div>
              <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">{humanize(safeText(state))}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 border-t border-line pt-3 text-[8px] leading-relaxed text-faint">
        The browser only displays the risk hierarchy. Individual kill-switch, stop-validation, position-limit, drawdown and exposure checks remain authoritative on the backend and are never duplicated or bypassed here.
      </div>
    </TerminalPanel>
  );
}

function TradePlan({ decision, instrument }: { decision: LiveDecisionView | null; instrument: string }) {
  const plan = decision?.trade_plan;
  if (!plan || safeText(plan.decision, 'NO_TRADE') === 'NO_TRADE') {
    return (
      <TerminalPanel title="Tembo's trade plan" eyebrow="Decision output">
        <div className="border border-dashed border-line-2 bg-panel-2 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-warn"><Timer className="h-4 w-4" /> NO TRADE PLAN</div>
          <p className="mt-2 text-[9px] leading-relaxed text-faint">{safeText(decision?.strategy_gate?.reason, decision?.message ?? 'Waiting for sufficient verified evidence.')}</p>
        </div>
      </TerminalPanel>
    );
  }
  return (
    <TerminalPanel title="Tembo's trade plan" eyebrow="Decision output">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Direction" value={safeText(plan.direction)} />
        <Metric label="Entry" value={price(plan.entry, instrument)} />
        <Metric label="Stop loss" value={price(plan.stop_loss, instrument)} tone="bad" />
        <Metric label="Take profit" value={price(plan.take_profit, instrument)} tone="good" />
        <Metric label="R:R" value={finite(plan.risk_reward) ? '1:' + Number(plan.risk_reward).toFixed(1) : '—'} />
      </div>
      <div className="mt-3 border border-line bg-panel-2 p-3 text-[9px] leading-relaxed text-muted">{safeText(plan.methodology, decision?.methodology ?? 'Server-generated trade plan.')}</div>
    </TerminalPanel>
  );
}

function RuntimeTelemetry({ data, instrument }: { data: RuntimeMetrics | null; instrument: string }) {
  const performance = data?.performance;
  const instrumentEvents = finite(Number(data?.instrument_event_counts?.[instrument])) ? Number(data!.instrument_event_counts[instrument]) : 0;
  return (
    <TerminalPanel title="Paper runtime telemetry" eyebrow="Persistent runtime evidence" right={<span className="text-[8px] font-bold uppercase tracking-[0.12em] text-warn">PAPER ONLY</span>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Cycles" value={String(data?.cycles_observed ?? '—')} />
        <Metric label="Events" value={String(data?.events_observed ?? '—')} />
        <Metric label="Closed trades" value={String(performance?.closed_trades ?? '—')} />
        <Metric label="Realized P&L" value={money(performance?.realized_pnl, { sign: true })} tone={finite(performance?.realized_pnl) ? (performance!.realized_pnl >= 0 ? 'good' : 'bad') : 'muted'} />
        <Metric label={instrument + ' events'} value={String(instrumentEvents)} />
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[9px] text-faint">
        <Gauge className="h-3.5 w-3.5 text-gold" />
        {data?.execution_enabled ? 'Backend reports execution enabled — verify configuration immediately.' : 'Broker execution disabled. This telemetry path remains paper-only.'}
      </div>
    </TerminalPanel>
  );
}

function DerivPanel({ status }: { status: DerivStatus | null }) {
  const connected = status?.connected === true;
  return (
    <TerminalPanel title="Deriv status" eyebrow="Broker / demo boundary" right={<span className="text-[9px] text-faint">READ-ONLY</span>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Connection" value={connected ? 'CONNECTED' : status?.configured ? 'CONFIGURED' : 'NOT CONFIGURED'} tone={connected ? 'good' : status?.configured ? 'warn' : 'muted'} />
        <Metric label="Mode" value={humanize(status?.mode ?? 'demo')} />
        <Metric label="Account" value={status?.account_id ? 'DEMO ACCOUNT' : '—'} />
        <Metric label="Open contracts" value={String(status?.open_positions ?? '—')} />
      </div>
      <div className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[9px] leading-relaxed text-faint">
        <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
        {safeText(status?.message, 'Deriv status unavailable.')}
      </div>
    </TerminalPanel>
  );
}

export default function Live({ go: _go }: { go?: (r: string) => void }) {
  const [instrument, setInstrument] = useState<string>(INSTRUMENTS[0]);
  const [timeframe, setTimeframe] = useState<string>('H1');

  const overview = useApi<LiveOverview>('/live/overview?instrument=' + encodeURIComponent(instrument) + '&timeframe=' + timeframe.toLowerCase());
  const market = useApi<LiveMarket>('/live/market?instrument=' + encodeURIComponent(instrument) + '&timeframe=' + timeframe.toLowerCase() + '&limit=120');
  const decision = useApi<LiveDecisionView>('/live/decision?instrument=' + encodeURIComponent(instrument) + '&timeframe=' + timeframe.toLowerCase());
  const analysis = useApi<LiveAnalysis>('/live/analysis?instrument=' + encodeURIComponent(instrument) + '&timeframe=' + timeframe.toLowerCase());
  const account = useApi<AccountOverview>('/account/overview');
  const risk = useApi<RiskMetrics>('/risk/metrics');
  const telemetry = useApi<RuntimeMetrics>('/runtime/metrics');
  const deriv = useApi<DerivStatus>('/deriv/status');
  const [showMulti, setShowMulti] = useState(false);
  const multi = useApi<MultiTimeframeAnalysis>(showMulti ? '/live/analysis/multi-timeframe?instrument=' + encodeURIComponent(instrument) : null);

  const selected = useMemo(
    () => safeArray<any>(overview.data?.instruments).find((x) => x?.instrument === instrument) ?? null,
    [overview.data, instrument],
  );

  const refreshAll = () => {
    overview.reload();
    market.reload();
    decision.reload();
    analysis.reload();
    account.reload();
    risk.reload();
    telemetry.reload();
    deriv.reload();
    if (showMulti) multi.reload();
  };

  const backendReady = overview.data?.market_data?.status === 'available' || market.data?.status === 'available';
  const executionEnabled = overview.data?.execution?.enabled === true || decision.data?.execution?.enabled === true;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 border-b border-line pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-gold">
            <CandlestickChart className="h-3.5 w-3.5" /> Tembo Forex Bot
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">Live Trading Cockpit</h1>
          <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-muted">Verified market data, deterministic analysis, server-side risk state and paper execution telemetry in one workstation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 border border-line bg-panel px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]">
            <ToneDot tone={backendReady ? 'good' : 'warn'} pulse={overview.loading || market.loading} />
            {backendReady ? 'Backend online' : 'Waiting for verified data'}
          </span>
          <span className="inline-flex items-center gap-1.5 border border-warn/30 bg-warn-soft/30 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-warn">
            <ShieldCheck className="h-3.5 w-3.5" /> {executionEnabled ? 'Execution enabled' : 'Paper execution locked'}
          </span>
          <button onClick={refreshAll} className="inline-flex items-center gap-1.5 border border-line bg-panel px-2.5 py-1.5 text-[9px] font-semibold text-muted hover:text-fg" title="Refresh verified data">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border border-line bg-panel px-2 py-2 scrollbar-none">
        {safeArray<any>(overview.data?.instruments).map((item) => {
          const active = item?.instrument === instrument;
          const current = active && finite(Number(market.data?.current_price))
            ? Number(market.data!.current_price)
            : finite(Number(item?.current_price))
              ? Number(item.current_price)
              : null;
          return (
            <button
              key={String(item?.instrument)}
              onClick={() => setInstrument(String(item?.instrument))}
              className={'min-w-[116px] border px-3 py-2 text-left transition ' + (active ? 'border-gold/60 bg-gold-soft/40' : 'border-line bg-panel-2 hover:border-line-2')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold text-fg">{safeText(item?.instrument)}</span>
                <ToneDot tone={toneFor(item?.data_status)} pulse={active} />
              </div>
              <div className="num mt-1 text-[11px] font-semibold text-muted">{current != null ? price(current, String(item?.instrument)) : '—'}</div>
            </button>
          );
        })}
        {safeArray<any>(overview.data?.instruments).length === 0 && (
          <div className="px-2 py-1 text-[9px] text-faint">Instrument selector will populate from verified backend data.</div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-line pl-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={'px-2.5 py-1.5 text-[9px] font-semibold ' + (timeframe === tf ? 'bg-gold text-ink' : 'text-muted hover:bg-panel-2 hover:text-fg')}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {overview.loading && !overview.data && market.loading && !market.data ? (
        <div className="grid min-h-64 place-items-center border border-line bg-panel"><div className="text-[10px] text-faint">Connecting to verified Tembo market data…</div></div>
      ) : (
        <>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px]">
            <TerminalPanel title={instrument} eyebrow="Live market" right={<StatusBadge value={market.data?.status ?? selected?.data_status} label={backendReady ? 'VERIFIED' : 'WAITING'} />}>
              <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
                <div>
                  <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-faint">Current price</div>
                  <div className="num mt-1 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                    {finite(Number(market.data?.current_price)) ? price(Number(market.data!.current_price), instrument) : '—'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-faint">
                    <span>{market.data?.last_update ? 'Updated ' + dateTime(market.data.last_update) : 'Waiting for timestamp'}</span>
                    <span>·</span>
                    <span>{humanize(market.data?.provider ?? selected?.provider)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Metric label="Feed" value={humanize(market.data?.status ?? selected?.data_status)} />
                    <Metric label="Frame" value={timeframe} />
                    <Metric label="Candles" value={String(safeArray<any>(market.data?.candles).length || '—')} />
                  </div>
                </div>
                <div className="border-l border-line pl-4">
                  <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-faint">Data boundary</div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-fg"><ToneDot tone={backendReady ? 'good' : 'warn'} /> Live data</div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-fg"><ToneDot tone="warn" /> Paper execution</div>
                  <p className="mt-2 text-[9px] leading-relaxed text-faint">Live data does not mean live-money execution. The frontend does not expose a real-money order path.</p>
                </div>
              </div>
              <div className="mt-4">
                <CandleChart data={market.data} />
              </div>
            </TerminalPanel>

            <div className="space-y-3">
              <MarketWatch data={overview.data} instrument={instrument} setInstrument={setInstrument} market={market.data} />
              <AccountRail account={account.data} risk={risk.data} />
            </div>
          </div>

          <Guidance decision={decision.data} instrument={instrument} />

          <div className="grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
            <AnalysisGrid analysis={analysis.data} />
            <KeyLevels analysis={analysis.data} instrument={instrument} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[.8fr_1.2fr]">
            <MultiTimeframe data={showMulti ? multi.data : null} />
            <TerminalPanel title="Multi-timeframe analysis" eyebrow="On-demand provider use">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[9px] leading-relaxed text-faint">Loads M5 → D1 context only when requested, avoiding unnecessary provider requests.</div>
                <button onClick={() => setShowMulti((v) => !v)} className="shrink-0 border border-line bg-panel-2 px-3 py-1.5 text-[9px] font-semibold text-muted hover:text-fg">
                  {showMulti ? 'Hide' : 'Load context'}
                </button>
              </div>
              {showMulti && multi.loading && !multi.data && <div className="mt-3 text-[9px] text-faint">Loading verified multi-timeframe analysis…</div>}
            </TerminalPanel>
          </div>

          <NewsImpact decision={decision.data} />

          <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
            <TradePlan decision={decision.data} instrument={instrument} />
            <RiskMonitor decision={decision.data} />
          </div>

          <RuntimeTelemetry data={telemetry.data} instrument={instrument} />
          <DerivPanel status={deriv.data} />

          {!decision.data && decision.error && (
            <div className="flex items-start gap-2 border border-down/30 bg-down-soft/30 p-3 text-[9px] text-down">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>Decision endpoint unavailable: {safeText(decision.error.message, 'The decision engine did not respond.')}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[8px] text-faint">
            <span>Tembo frontend is a presentation layer. Backend contracts, decision logic and risk gates remain authoritative.</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-up" /> No real-money execution control is exposed here.</span>
          </div>
        </>
      )}
    </div>
  );
}
