import { useEffect, useMemo, useState } from 'react';
import { useApi, useApiMany } from '../lib/api';
import type { DerivStatus, LiveAnalysis, LiveDecision, LiveMarket, MultiTimeframeAnalysis, RiskMetrics, RuntimeStatus } from '../lib/types';
import { CORE_INSTRUMENTS, digitsFor, metaFor, readHashParam, type Timeframe } from '../lib/instruments';
import { InstrumentStrip } from '../components/cockpit/InstrumentStrip';
import { ChartBody, QuoteHeader } from '../components/cockpit/ChartPanel';
import { GuidancePanel, signalOf } from '../components/cockpit/Guidance';
import { InsightCards, NotesCard, TradePlanCard } from '../components/cockpit/Insights';
import { DerivDemo, MarketWatch, PaperAccount } from '../components/cockpit/Rail';
import { AdvancedEvidence } from '../components/cockpit/Evidence';
import type { Quote } from '../components/cockpit/types';
import type { ChartLevel } from '../components/PriceChart';

const q = (id: string) => encodeURIComponent(id);

export default function Dashboard() {
  const [instrument, setInstrumentState] = useState<string>(() => readHashParam() || 'XAU/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('H1');
  const tf = timeframe.toLowerCase();

  const setInstrument = (id: string) => {
    window.history.replaceState(null, '', `#/live/${encodeURIComponent(id)}`);
    setInstrumentState(id);
  };
  useEffect(() => {
    const h = () => {
      const p = readHashParam();
      if (p) setInstrumentState(p);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const base = `instrument=${q(instrument)}&timeframe=${tf}`;
  const market = useApi<LiveMarket>(`/live/market?${base}&limit=150`, { refreshMs: 60_000 });
  const decision = useApi<LiveDecision>(`/live/decision?${base}`, { refreshMs: 120_000 });
  const analysis = useApi<LiveAnalysis>(`/live/analysis?${base}`, { refreshMs: 120_000 });
  // Five provider calls: only once the primary decision is on screen.
  const multi = useApi<MultiTimeframeAnalysis>(decision.data || decision.error ? `/live/analysis/multi-timeframe?instrument=${q(instrument)}` : null, { refreshMs: 300_000 });
  const runtime = useApi<RuntimeStatus>('/runtime/status', { refreshMs: 120_000 });
  const risk = useApi<RiskMetrics>('/risk/metrics');
  const deriv = useApi<DerivStatus>('/deriv/status', { refreshMs: 180_000 });

  // Watchlist: core markets plus whatever synthetic the user picked.
  const ids = useMemo(() => {
    const core = CORE_INSTRUMENTS.map((i) => i.id);
    return core.includes(instrument) ? core : [...core, instrument];
  }, [instrument]);
  const watchPath = (id: string) => `/live/market?instrument=${q(id)}&timeframe=d1&limit=20`;
  const watch = useApiMany<LiveMarket>(ids.map(watchPath), { refreshMs: 60_000 });

  const quotes = useMemo(() => {
    const out: Record<string, Quote> = {};
    for (const id of ids) {
      const r = watch.results[watchPath(id)];
      const m = r?.data;
      const candles = m?.status === 'available' ? m.candles ?? [] : [];
      const prevClose = candles.length ? candles[candles.length - 1].close : null;
      // The chart's own (fresher) price wins for the selected market.
      const price = id === instrument && market.data?.status === 'available' && market.data.current_price != null ? market.data.current_price : m?.current_price ?? null;
      const change = price != null && prevClose != null ? price - prevClose : null;
      out[id] = {
        price,
        prevClose,
        change,
        changePct: change != null && prevClose ? (change / prevClose) * 100 : null,
        pipSize: m?.instrument_metadata?.pip_size ?? (id === instrument ? market.data?.instrument_metadata?.pip_size ?? null : null),
        displayName: m?.instrument_metadata?.display_name ?? null,
        status: m?.status ?? null,
        error: r?.error ?? null,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch.results, ids, instrument, market.data]);

  const quote = quotes[instrument];
  const pipSize = market.data?.instrument_metadata?.pip_size ?? quote?.pipSize ?? null;
  const digits = digitsFor(instrument, pipSize);
  const meta = metaFor(instrument, market.data?.instrument_metadata?.display_name ?? quote?.displayName);

  // Only use decision/analysis that belong to the market on screen.
  const dec = decision.data && decision.data.instrument === instrument && decision.data.timeframe === tf ? decision.data : null;
  const ana = analysis.data && analysis.data.instrument === instrument && analysis.data.timeframe === tf ? analysis.data : null;
  const mkt = market.data && market.data.instrument === instrument && market.data.timeframe === tf ? market.data : null;
  const mtf = multi.data && multi.data.instrument === instrument ? multi.data : null;

  const levels = useMemo<ChartLevel[]>(() => {
    const out: ChartLevel[] = [];
    const plan = dec?.trade_plan;
    const s = signalOf(dec);
    if ((s === 'BUY' || s === 'SELL') && plan) {
      if (plan.entry != null) out.push({ price: plan.entry, label: 'Entry', kind: 'entry' });
      if (plan.stop_loss != null) out.push({ price: plan.stop_loss, label: 'SL', kind: 'stop' });
      if (plan.take_profit != null) out.push({ price: plan.take_profit, label: 'TP', kind: 'target' });
    }
    const sr = ana?.analysis?.support_resistance;
    if (sr?.resistance != null) out.push({ price: sr.resistance, label: 'Resistance', kind: 'resistance' });
    if (sr?.support != null) out.push({ price: sr.support, label: 'Support', kind: 'support' });
    return out;
  }, [dec, ana]);

  return (
    <div className="space-y-3">
      <InstrumentStrip ids={ids} selected={instrument} onSelect={setInstrument} quotes={quotes} />

      <div className="cockpit-grid">
        <div style={{ gridArea: 'quote' }}>
          <QuoteHeader
            meta={meta}
            market={mkt}
            price={quote?.price ?? mkt?.current_price ?? null}
            change={quote?.change ?? null}
            changePct={quote?.changePct ?? null}
            digits={digits}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            loading={market.loading}
          />
        </div>

        <div style={{ gridArea: 'chart' }} className="lg:-mt-3">
          <ChartBody market={mkt} error={market.error} loading={market.loading} digits={digits} levels={levels} resetKey={`${instrument}:${tf}`} onRetry={market.reload} />
        </div>

        <aside style={{ gridArea: 'rail' }} className="min-w-0 space-y-3">
          <MarketWatch ids={ids} quotes={quotes} selected={instrument} onSelect={setInstrument} />
          <PaperAccount runtime={runtime.data} error={runtime.error} risk={risk.data} />
        </aside>

        <div style={{ gridArea: 'guide' }}>
          <GuidancePanel
            meta={meta}
            decision={dec}
            error={decision.error}
            loading={decision.loading}
            onRetry={decision.reload}
            digits={digits}
            pipSize={pipSize}
            risk={risk.data}
            derivConnected={deriv.data?.connected ?? null}
          />
        </div>

        <div style={{ gridArea: 'insights' }}>
          <InsightCards meta={meta} timeframe={timeframe} analysis={ana} analysisError={analysis.error?.message ?? null} multi={mtf} decision={dec} digits={digits} />
        </div>

        <div style={{ gridArea: 'plan' }} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr]">
          <TradePlanCard meta={meta} decision={dec} analysis={ana} digits={digits} pipSize={pipSize} />
          <DerivDemo status={deriv.data} error={deriv.error} loading={deriv.loading} reload={deriv.reload} decision={dec} instrument={instrument} timeframe={timeframe} />
          <div className="md:col-span-2 xl:col-span-1">
            <NotesCard />
          </div>
        </div>

        <div style={{ gridArea: 'evidence' }}>
          <AdvancedEvidence decision={dec} market={mkt} risk={risk.data} />
        </div>
      </div>
    </div>
  );
}
