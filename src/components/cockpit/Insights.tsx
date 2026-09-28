import { BarChart3, Layers, TrendingUp, TrendingDown, Newspaper, Target, FileText, MoveRight, Minus } from 'lucide-react';
import type { LiveAnalysis, LiveDecision, MultiTimeframeAnalysis } from '../../lib/types';
import { fmtPrice, type InstrumentMeta } from '../../lib/instruments';
import { Dot, Empty, IconTile, Panel, TEXT, finite, human, timeLocal, toneOf, type Tone } from './common';
import { distanceLabel, nextReview, riskPct, signalOf } from './Guidance';

type A = NonNullable<LiveAnalysis['analysis']>;

const TREND_TEXT: Record<string, string> = {
  UP: 'trending up',
  DOWN: 'trending down',
  RANGE: 'ranging',
  UNSTABLE: 'unstable, with high volatility',
  QUIET: 'quiet, with low volatility',
  UNKNOWN: 'without a clear trend',
};
const TREND_LABEL: Record<string, string> = { UP: 'Bullish', DOWN: 'Bearish', RANGE: 'Range', UNSTABLE: 'Unstable', QUIET: 'Quiet', UNKNOWN: 'Unclear' };
const TREND_TONE: Record<string, Tone> = { UP: 'good', DOWN: 'bad', RANGE: 'warn', UNSTABLE: 'warn', QUIET: 'muted', UNKNOWN: 'muted' };
const STRUCTURE_TEXT: Record<string, string> = {
  HIGHER_HIGH_HIGHER_LOW: 'higher highs and higher lows',
  LOWER_HIGH_LOWER_LOW: 'lower highs and lower lows',
  MIXED_STRUCTURE: 'a mixed swing structure',
  INSUFFICIENT_SWINGS: 'too few swings to read structure',
};
const MOMENTUM_TEXT: Record<string, string> = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  OVERBOUGHT: 'overbought',
  OVERSOLD: 'oversold',
  UNKNOWN: 'unknown',
};

function analysisSentences(meta: InstrumentMeta, tf: string, a: A, digits: number) {
  const out: string[] = [];
  const trend = a.trend?.state ?? 'UNKNOWN';
  out.push(`${meta.code} is ${TREND_TEXT[trend] ?? human(trend).toLowerCase()} on the ${tf} timeframe.`);
  const close = a.close;
  const s50 = a.trend?.sma_50;
  if (finite(close) && finite(s50)) out.push(`Price (${fmtPrice(close, digits)}) is ${close >= s50 ? 'above' : 'below'} the 50-period average (${fmtPrice(s50, digits)}).`);
  const m = a.momentum?.state;
  if (m) out.push(`Momentum is ${MOMENTUM_TEXT[m] ?? human(m).toLowerCase()}${finite(a.momentum?.rsi_14) ? ` (RSI ${a.momentum!.rsi_14!.toFixed(1)})` : ''}.`);
  const st = a.market_structure?.label;
  if (st) out.push(`Swings show ${STRUCTURE_TEXT[st] ?? human(st).toLowerCase()}.`);
  const v = a.volatility?.state;
  if (v) out.push(`Volatility is ${v === 'HIGH_VOLATILITY' ? 'high' : v === 'LOW_VOLATILITY' ? 'low' : 'normal'}${finite(a.volatility?.atr_14) ? ` (ATR ${fmtPrice(a.volatility!.atr_14!, digits)})` : ''}.`);
  return out;
}

export function InsightCards({
  meta,
  timeframe,
  analysis,
  analysisError,
  multi,
  decision,
  digits,
}: {
  meta: InstrumentMeta;
  timeframe: string;
  analysis: LiveAnalysis | null;
  analysisError: string | null;
  multi: MultiTimeframeAnalysis | null;
  decision: LiveDecision | null;
  digits: number;
}) {
  const a = analysis?.analysis && analysis.analysis.status === 'available' ? analysis.analysis : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MarketAnalysisCard meta={meta} tf={timeframe} a={a} err={analysisError ?? analysis?.message ?? null} digits={digits} />
      <KeyLevelsCard a={a} digits={digits} />
      <TrendCard current={timeframe} a={a} multi={multi} />
      <NewsCard decision={decision} />
    </div>
  );
}

function MarketAnalysisCard({ meta, tf, a, err, digits }: { meta: InstrumentMeta; tf: string; a: A | null; err: string | null; digits: number }) {
  return (
    <Panel title="Market analysis" icon={<IconTile tone="info"><BarChart3 className="h-3.5 w-3.5" /></IconTile>}>
      {a ? (
        <>
          <p className="text-[12px] leading-relaxed text-muted">{analysisSentences(meta, tf, a, digits).join(' ')}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2.5">
            <Mini label="RSI 14" value={finite(a.momentum?.rsi_14) ? a.momentum!.rsi_14!.toFixed(1) : '—'} />
            <Mini label="ATR 14" value={finite(a.volatility?.atr_14) ? fmtPrice(a.volatility!.atr_14!, digits) : '—'} />
            <Mini label="ATR %" value={finite(a.volatility?.atr_percent) ? `${(a.volatility!.atr_percent! * 100).toFixed(2)}%` : '—'} />
          </div>
        </>
      ) : (
        <Empty>{err ?? 'Waiting for verified candles.'}</Empty>
      )}
    </Panel>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-faint">{label}</div>
      <div className="num truncate text-[12px] font-semibold text-fg">{value}</div>
    </div>
  );
}

function KeyLevelsCard({ a, digits }: { a: A | null; digits: number }) {
  const close = a?.close;
  const raw: { label: string; v: number | null | undefined }[] = [
    { label: 'Range high', v: a?.support_resistance?.resistance },
    { label: 'Swing high', v: a?.market_structure?.confirmed_swing_high },
    { label: 'Swing low', v: a?.market_structure?.confirmed_swing_low },
    { label: 'Range low', v: a?.support_resistance?.support },
  ];
  const seen = new Set<string>();
  const levels = raw
    .filter((l): l is { label: string; v: number } => finite(l.v))
    .filter((l) => {
      const k = l.v.toFixed(digits);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => y.v - x.v);
  return (
    <Panel title="Key levels" icon={<IconTile tone="info"><Layers className="h-3.5 w-3.5 text-violet" /></IconTile>}>
      {a && levels.length ? (
        <div className="divide-y divide-line">
          {finite(close) && levels[0].v <= close && (
            <div className="flex items-center justify-between border-b border-dashed border-line-2 py-1.5 text-[11px]">
              <span className="flex items-center gap-1 text-faint"><MoveRight className="h-3 w-3" /> Last close</span>
              <span className="num font-semibold text-fg">{fmtPrice(close, digits)}</span>
            </div>
          )}
          {levels.map((l, i) => {
            const above = finite(close) ? l.v > close : i < levels.length / 2;
            const insertPrice = finite(close) && above && (levels[i + 1] == null || levels[i + 1].v <= close);
            return (
              <div key={l.label}>
                <div className="flex items-center justify-between py-1.5 text-[12px]">
                  <span className="text-muted">
                    {above ? 'Resistance' : 'Support'} <span className="text-[10px] text-faint">· {l.label.toLowerCase()}</span>
                  </span>
                  <span className={`num font-semibold ${above ? 'text-down' : 'text-up'}`}>{fmtPrice(l.v, digits)}</span>
                </div>
                {insertPrice && (
                  <div className="flex items-center justify-between border-t border-dashed border-line-2 py-1.5 text-[11px]">
                    <span className="flex items-center gap-1 text-faint"><MoveRight className="h-3 w-3" /> Last close</span>
                    <span className="num font-semibold text-fg">{fmtPrice(close!, digits)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty>Levels appear once analysis has verified candles.</Empty>
      )}
    </Panel>
  );
}

function trendOf(x: unknown): string | null {
  if (x && typeof x === 'object' && 'trend' in x) {
    const t = (x as A).trend;
    return t?.state ?? null;
  }
  return null;
}

function TrendCard({ current, a, multi }: { current: string; a: A | null; multi: MultiTimeframeAnalysis | null }) {
  const state = a?.trend?.state ?? null;
  const tone = state ? TREND_TONE[state] ?? 'muted' : 'muted';
  const Icon = state === 'DOWN' ? TrendingDown : state === 'UP' ? TrendingUp : Minus;
  const tfs = ['m5', 'm15', 'h1', 'h4', 'd1'];
  return (
    <Panel title="Trend" icon={<IconTile tone={tone === 'muted' ? 'info' : tone}><Icon className="h-3.5 w-3.5" /></IconTile>}>
      <div className={`flex items-center gap-1.5 text-[15px] font-bold ${TEXT[tone]}`}>
        <Icon className="h-4 w-4" /> {state ? TREND_LABEL[state] ?? human(state) : '—'}
        <span className="text-[10px] font-medium text-faint">on {current}</span>
      </div>
      <div className="mt-2 divide-y divide-line">
        {tfs.map((tf) => {
          const entry = multi?.timeframes?.[tf];
          const st = trendOf(entry);
          const reason = entry && typeof entry === 'object' && !('trend' in entry) && 'status' in entry ? String((entry as { status: string }).status) : null;
          const t = st ? TREND_TONE[st] ?? 'muted' : 'muted';
          return (
            <div key={tf} className={`flex items-center justify-between py-1 text-[12px] ${tf.toUpperCase() === current ? 'font-semibold' : ''}`}>
              <span className="text-muted">{tf.toUpperCase()}</span>
              <span className={`flex items-center gap-1.5 ${st ? TEXT[t] : 'text-faint'}`}>
                <Dot tone={t} />
                {st ? TREND_LABEL[st] ?? human(st) : multi ? human(reason, 'Unavailable') : 'Loading…'}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function NewsCard({ decision }: { decision: LiveDecision | null }) {
  const level = decision?.macro_risk?.level ?? null;
  const tone = level ? toneOf(level) : 'muted';
  const headlines = decision?.news?.headlines ?? [];
  const events = decision?.macro_events ?? [];
  const newsStatus = decision?.news?.status;
  return (
    <Panel title="News impact" icon={<IconTile tone="warn"><Newspaper className="h-3.5 w-3.5" /></IconTile>}>
      {decision ? (
        <>
          <div className={`text-[15px] font-bold ${TEXT[tone]}`}>{level ? `${human(level)} risk` : 'Unknown'}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{decision.macro_risk?.reason ?? 'Macro risk not available.'}</p>
          <div className="mt-2 space-y-1.5 border-t border-line pt-2">
            {events.slice(0, 2).map((e, i) => (
              <div key={e.event_id ?? i} className="flex items-start justify-between gap-2 text-[11px]">
                <span className="min-w-0 text-fg">
                  <span className="font-semibold text-muted">{e.currency}</span> {e.event_name}
                </span>
                <span className="shrink-0 text-faint">{timeLocal(e.timestamp)}</span>
              </div>
            ))}
            {headlines.slice(0, 2).map((h, i) => (
              <a key={h.news_id ?? i} href={h.url ?? undefined} target="_blank" rel="noreferrer" className="block text-[11px] leading-snug text-fg hover:text-brand">
                {h.headline}
                <span className="ml-1 text-faint">· {h.source}</span>
              </a>
            ))}
            {!events.length && !headlines.length && (
              <div className="text-[11px] text-faint">
                {newsStatus === 'CONFIRMED_NO_RELEVANT_NEWS' ? 'News feed checked: no relevant headlines right now.' : `News feed: ${human(newsStatus, 'unavailable').toLowerCase()}.`} No events in the next 2 hours.
              </div>
            )}
          </div>
        </>
      ) : (
        <Empty>Waiting for the decision engine.</Empty>
      )}
    </Panel>
  );
}

export function TradePlanCard({
  meta,
  decision,
  analysis,
  digits,
  pipSize,
}: {
  meta: InstrumentMeta;
  decision: LiveDecision | null;
  analysis: LiveAnalysis | null;
  digits: number;
  pipSize: number | null;
}) {
  const signal = signalOf(decision);
  const plan = decision?.trade_plan;
  const tf = (decision?.timeframe ?? '').toUpperCase();
  const a = analysis?.analysis?.status === 'available' ? analysis.analysis : null;
  const steps: string[] = [];

  if (decision && (signal === 'BUY' || signal === 'SELL') && plan) {
    const sl = distanceLabel(plan.entry, plan.stop_loss, meta.id, pipSize, digits);
    const tp = distanceLabel(plan.entry, plan.take_profit, meta.id, pipSize, digits);
    const rp = riskPct(decision.risk?.computed_risk_pct);
    steps.push(`${signal === 'BUY' ? 'Look for a BUY' : 'Look for a SELL'} around ${fmtPrice(plan.entry ?? null, digits)} (current price zone).`);
    steps.push(`Place the stop loss at ${fmtPrice(plan.stop_loss ?? null, digits)}${sl ? ` (${sl})` : ''}.`);
    steps.push(`Set take profit at ${fmtPrice(plan.take_profit ?? null, digits)}${tp ? ` (${tp})` : ''}${finite(plan.risk_reward) ? `, reward : risk ${plan.risk_reward!.toFixed(1)} : 1` : ''}.`);
    steps.push(rp != null ? `Risk ${rp.toFixed(1)}% of the paper account${finite(decision.risk?.position_size) ? ` (size ${decision.risk!.position_size})` : ''}.` : 'Risk size comes from the risk engine.');
    steps.push(`If price ${signal === 'BUY' ? 'breaks below' : 'breaks above'} ${fmtPrice(plan.stop_loss ?? null, digits)} before entry, cancel the idea and wait for a new setup.`);
  } else if (decision) {
    const review = nextReview(decision.data_quality?.last_candle, decision.timeframe);
    steps.push(`No trade on ${meta.code} ${tf}. ${plan?.reason || decision.strategy_gate?.reason || decision.message || 'No validated setup.'}`);
    if (a) {
      const t = a.trend?.state ? TREND_TEXT[a.trend.state] ?? human(a.trend.state).toLowerCase() : 'unclear';
      const m = a.momentum?.state ? MOMENTUM_TEXT[a.momentum.state] ?? a.momentum.state.toLowerCase() : 'unknown';
      steps.push(`Market read: ${t}, momentum ${m}.`);
      const r = a.support_resistance?.resistance;
      const s = a.support_resistance?.support;
      if (finite(r) || finite(s)) steps.push(`Levels to watch: resistance ${fmtPrice(r ?? null, digits)}, support ${fmtPrice(s ?? null, digits)}.`);
    }
    steps.push(`Macro risk is ${human(decision.macro_risk?.level, 'unknown').toLowerCase()}. Tembo blocks new trades when it is medium, high or unknown.`);
    steps.push(review ? `Next review after the ${tf} candle closes at ${timeLocal(review)}. Tembo re-checks automatically.` : 'Tembo re-checks automatically on the next completed candle.');
  }

  return (
    <Panel title="Tembo's trade plan" icon={<IconTile tone={signal === 'BUY' || signal === 'SELL' ? 'good' : 'warn'}><Target className="h-3.5 w-3.5" /></IconTile>}>
      {steps.length ? (
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed text-muted">
              <span className={`num grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${signal === 'BUY' || signal === 'SELL' ? 'bg-up text-ink' : 'bg-warn/90 text-ink'}`}>{i + 1}</span>
              <span className={i === 0 ? 'text-fg' : ''}>{s}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>The plan appears once Tembo has made a decision.</Empty>
      )}
    </Panel>
  );
}

export function NotesCard() {
  const notes = [
    'Tembo decides on the server. This screen only shows what the backend decided; it never creates its own signal.',
    'Paper and Deriv demo only. No real money is traded.',
    'Gold H1 breakout runs as a forward test: its research is promising but not fully proven, so it trades on demo at half the normal risk to collect live evidence.',
    'Tembo blocks trades around medium and high-impact news and when the risk engine rejects a setup.',
    'Let Tembo monitor the market; the plan updates when conditions change.',
    'This is not financial advice. Always manage your risk.',
  ];
  return (
    <Panel title="Additional notes" icon={<IconTile tone="muted"><FileText className="h-3.5 w-3.5" /></IconTile>}>
      <ul className="space-y-1.5">
        {notes.map((n) => (
          <li key={n} className="flex gap-2 text-[12px] leading-relaxed text-muted">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" />
            {n}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
