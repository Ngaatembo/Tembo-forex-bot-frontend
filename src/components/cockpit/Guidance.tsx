import { ChevronUp, ChevronDown, Pause, ShieldCheck, Clock3, Radio, RefreshCw } from 'lucide-react';
import type { LiveDecision, RiskMetrics } from '../../lib/types';
import type { ApiError } from '../../lib/api';
import { fmtPrice, pipFor, type InstrumentMeta, TF_SECONDS } from '../../lib/instruments';
import { ElephantMark, InstrumentIcon } from '../brand';
import { Chip, Dot, Ring, TEXT, finite, human, timeLocal, toneOf, tzLabel, type Tone } from './common';

export function signalOf(d: LiveDecision | null): 'BUY' | 'SELL' | 'NO_TRADE' | null {
  if (!d) return null;
  const v = String(d.decision ?? '').toUpperCase();
  return v === 'BUY' || v === 'SELL' ? v : 'NO_TRADE';
}

export function riskPct(v: number | null | undefined) {
  if (!finite(v)) return null;
  return Math.abs(v) <= 1 ? v * 100 : v;
}

export function pipsBetween(a: number | null | undefined, b: number | null | undefined, id: string, pipSize: number | null) {
  if (!finite(a) || !finite(b)) return null;
  return Math.abs(a - b) / pipFor(id, pipSize);
}

/**
 * Human distance between two prices: pips for forex, dollars for gold and
 * points for synthetic indices (where "pips" mean different things per broker).
 */
export function distanceLabel(a: number | null | undefined, b: number | null | undefined, id: string, pipSize: number | null, digits: number) {
  if (!finite(a) || !finite(b)) return null;
  const d = Math.abs(a - b);
  if (id.startsWith('XAU')) return `$${d.toFixed(2)}`;
  if (id.startsWith('SYNTH:')) return `${d.toLocaleString('en-US', { maximumFractionDigits: digits })} pts`;
  const p = pipsBetween(a, b, id, pipSize);
  return p != null ? `${p.toFixed(0)} pips` : null;
}

/** When the next completed candle (and so the next decision) is due. */
export function nextReview(lastCandleIso: string | null | undefined, tf: string) {
  const step = TF_SECONDS[tf.toLowerCase()];
  if (!lastCandleIso || !step) return null;
  const t = new Date(lastCandleIso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + 2 * step * 1000).toISOString();
}

function confidenceBand(v: number | null): { label: string; tone: Tone } {
  if (v == null) return { label: 'N/A', tone: 'muted' };
  if (v >= 65) return { label: 'High', tone: 'good' };
  if (v >= 40) return { label: 'Medium', tone: 'warn' };
  return { label: 'Low', tone: 'bad' };
}

export function GuidancePanel({
  meta,
  decision,
  error,
  loading,
  onRetry,
  digits,
  pipSize,
  risk,
  derivConnected,
}: {
  meta: InstrumentMeta;
  decision: LiveDecision | null;
  error: ApiError | null;
  loading: boolean;
  onRetry: () => void;
  digits: number;
  pipSize: number | null;
  risk: RiskMetrics | null;
  derivConnected: boolean | null;
}) {
  const signal = signalOf(decision);
  const plan = decision?.trade_plan ?? null;
  const tech = decision?.technical_decision;
  const conf = finite(tech?.confidence) ? tech!.confidence! : null;
  const band = confidenceBand(conf);
  const rp = riskPct(decision?.risk?.computed_risk_pct);
  const maxRisk = decision?.forward_test?.active ? riskPct(decision.forward_test.max_risk_per_trade_pct) : riskPct(risk?.limits?.max_risk_per_trade_pct);
  const asOf = decision?.data_quality?.last_candle ?? null;
  const reason = plan?.reason || decision?.strategy_gate?.reason || decision?.message || null;
  const isTrade = signal === 'BUY' || signal === 'SELL';
  const tf = (decision?.timeframe ?? '').toUpperCase();
  const forward = decision?.forward_test?.active === true;

  const slDist = isTrade ? distanceLabel(plan?.entry, plan?.stop_loss, meta.id, pipSize, digits) : null;
  const tpDist = isTrade ? distanceLabel(plan?.entry, plan?.take_profit, meta.id, pipSize, digits) : null;

  const signalCls =
    signal === 'BUY'
      ? 'border-up/70 bg-up-soft text-up glow-up'
      : signal === 'SELL'
        ? 'border-down/70 bg-down-soft text-down glow-down'
        : 'border-warn/60 bg-warn-soft text-warn glow-wait';

  const gates: { label: string; value: string; tone: Tone }[] = decision
    ? [
        {
          label: 'Market data',
          value: decision.data_quality?.is_clean ? 'Verified' : 'Not verified',
          tone: decision.data_quality?.is_clean ? 'good' : 'bad',
        },
        {
          label: 'Strategy / research',
          value: forward ? 'Promising · forward test' : human(decision.strategy_gate?.status, 'Waiting'),
          tone: forward ? 'info' : toneOf(decision.strategy_gate?.status ?? 'WAITING'),
        },
        {
          label: 'Macro risk',
          value: human(decision.macro_risk?.level, 'Unknown'),
          tone: toneOf(decision.macro_risk?.level ?? 'UNKNOWN'),
        },
        {
          label: 'Risk engine',
          value: decision.risk?.status === 'EVALUATED' ? human(decision.risk?.state) : human(decision.risk?.status, 'Not run'),
          tone: decision.risk?.status === 'EVALUATED' ? toneOf(decision.risk?.state) : 'muted',
        },
        {
          label: 'Paper eligibility',
          value: decision.paper_eligibility?.eligible ? (decision.paper_eligibility.status === 'FORWARD_TEST_ELIGIBLE' ? 'Approved (forward test)' : 'Approved') : 'Not eligible',
          tone: decision.paper_eligibility?.eligible ? 'good' : 'muted',
        },
        {
          label: 'Execution',
          value: derivConnected ? 'Deriv demo' : 'Paper only',
          tone: derivConnected ? 'info' : 'muted',
        },
      ]
    : [];

  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <ElephantMark className="h-9 w-9 shrink-0 text-brand" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-fg">Tembo Forex Bot Guidance</h2>
            <p className="text-[11px] leading-snug text-faint">Server-side decision from verified market data, research, macro risk and the risk engine.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {forward && (
            <Chip tone="info" dot={false}>
              Forward test · demo only
            </Chip>
          )}
          {asOf && (
            <span className="inline-flex items-center gap-1 text-[10px] text-faint">
              <Clock3 className="h-3 w-3" /> {timeLocal(asOf, true)} {tzLabel()}
            </span>
          )}
          <Chip tone={decision?.status === 'available' ? 'good' : 'warn'} pulse={loading}>
            <Radio className="h-3 w-3" /> {decision?.status === 'available' ? 'Live analysis' : loading ? 'Analysing' : 'Waiting'}
          </Chip>
        </div>
      </header>

      {!decision && error ? (
        <div className="m-3 flex items-start gap-3 rounded-lg border border-down/30 bg-down-soft/40 p-3 text-[12px] sm:m-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-fg">Tembo's decision engine didn't respond</div>
            <div className="mt-0.5 text-muted">{error.message}</div>
          </div>
          <button onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-2 px-2.5 py-1 text-[11px] text-fg hover:bg-panel-2">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      ) : !decision ? (
        <div className="grid gap-3 p-3 sm:grid-cols-4 sm:p-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 p-3 sm:p-4 md:grid-cols-[1.15fr_0.75fr_1.9fr_0.95fr]">
            {/* Signal */}
            <div className="col-span-2 rounded-lg border border-line bg-panel-2 p-3 md:col-span-1">
              <div className="text-[11px] font-medium text-muted">Current signal</div>
              <div className={`mt-2 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-[22px] font-extrabold tracking-wide ${signalCls}`}>
                {signal === 'BUY' ? <ChevronUp className="h-6 w-6" strokeWidth={3} /> : signal === 'SELL' ? <ChevronDown className="h-6 w-6" strokeWidth={3} /> : <Pause className="h-5 w-5" strokeWidth={3} />}
                {signal === 'NO_TRADE' ? 'NO TRADE' : signal}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                <InstrumentIcon meta={meta} size="sm" />
                <span className="font-medium text-fg">{meta.code}</span>
                <span className="text-faint">· {tf}</span>
              </div>
              {forward && (
                <div className="mt-1.5 text-[10px] leading-snug text-info">
                  Gold breakout forward test: paper and Deriv demo only, at {riskPct(decision?.forward_test?.max_risk_per_trade_pct)?.toFixed(1) ?? '0.5'}% risk.
                </div>
              )}
            </div>

            {/* Confidence */}
            <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-panel-2 p-3 text-center">
              <div className="text-[11px] font-medium text-muted">Confidence</div>
              <div className="mt-1.5">
                <Ring value={conf} label={band.label} tone={isTrade ? band.tone : conf == null ? 'muted' : band.tone} />
              </div>
              <div className="mt-1 text-[9px] leading-tight text-faint">Multi-factor evidence score</div>
            </div>

            {/* Levels */}
            <div className="order-last col-span-2 grid grid-cols-3 gap-2 rounded-lg border border-line bg-panel-2 p-3 md:order-none md:col-span-1">
              <Level label="Entry price" value={fmtPrice(plan?.entry ?? null, digits)} tone="muted" />
              <Level label="Stop loss (SL)" value={fmtPrice(plan?.stop_loss ?? null, digits)} tone={plan?.stop_loss != null ? 'bad' : 'muted'} sub={slDist ?? undefined} />
              <Level label="Take profit (TP)" value={fmtPrice(plan?.take_profit ?? null, digits)} tone={plan?.take_profit != null ? 'good' : 'muted'} sub={tpDist ?? undefined} />
              <div className="col-span-3 border-t border-line pt-2 text-[10px] leading-snug text-faint">
                {isTrade
                  ? `Reward : risk ${finite(plan?.risk_reward) ? `${plan!.risk_reward!.toFixed(1)} : 1` : '—'} · levels set by the backend strategy, not the browser.`
                  : 'No levels: Tembo has not approved a setup, so it shows none instead of guessing.'}
              </div>
            </div>

            {/* Risk */}
            <div className="rounded-lg border border-line bg-panel-2 p-3">
              <div className="text-[11px] font-medium text-muted">Suggested risk</div>
              <div className="num mt-2 text-[20px] font-bold text-fg sm:text-[22px]">{rp != null ? `${rp.toFixed(1)}%` : '—'}</div>
              <div className="text-[10px] text-faint">{rp != null ? 'of paper account balance' : 'Risk engine runs only on a BUY/SELL'}</div>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-up">
                <ShieldCheck className="h-3.5 w-3.5" /> Limit {maxRisk != null ? `${maxRisk.toFixed(1)}%` : '—'} per trade
              </div>
            </div>
          </div>

          {reason && (
            <div className="mx-3 -mt-1 mb-3 rounded-lg border border-line bg-panel-2/60 px-3 py-2 text-[11px] leading-relaxed text-muted sm:mx-4">
              <span className={`font-semibold ${TEXT[isTrade ? 'good' : 'warn']}`}>{isTrade ? 'Why: ' : 'Why no trade: '}</span>
              {reason}
            </div>
          )}

          {/* Gate chain */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
            {gates.map((g) => (
              <div key={g.label} className="bg-panel px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">{g.label}</div>
                <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold leading-tight ${TEXT[g.tone]}`}>
                  <Dot tone={g.tone} />
                  <span>{g.value}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Level({ label, value, tone, sub }: { label: string; value: string; tone: Tone; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-medium text-muted">{label}</div>
      <div className={`num mt-1.5 truncate text-[15px] font-bold sm:text-[16px] ${tone === 'muted' ? 'text-fg' : TEXT[tone]}`}>{value}</div>
      {sub && <div className="num mt-0.5 text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

