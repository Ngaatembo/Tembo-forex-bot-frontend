import { useState } from 'react';
import { ChevronDown, Microscope } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { LiveDecision, LiveMarket, RiskMetrics, RuntimeMetrics } from '../../lib/types';
import { Chip, Dot, IconTile, Row, TEXT, finite, human, timeLocal, toneOf } from './common';
import { money } from '../../lib/format';
import { riskPct } from './Guidance';

const LIMIT_LABELS: Record<string, string> = {
  max_risk_per_trade_pct: 'Risk per trade',
  max_total_open_risk_pct: 'Total open risk',
  max_daily_loss_pct: 'Daily loss limit',
  max_drawdown_pct: 'Max drawdown',
  max_simultaneous_positions: 'Max open positions',
  max_exposure_pct: 'Max exposure',
};

export function AdvancedEvidence({ decision, market, risk }: { decision: LiveDecision | null; market: LiveMarket | null; risk: RiskMetrics | null }) {
  const [open, setOpen] = useState(false);
  const telemetry = useApi<RuntimeMetrics>(open ? '/runtime/metrics' : null);
  const tech = decision?.technical_decision;
  const gate = decision?.strategy_gate;
  const live = gate?.live_evaluation;

  return (
    <section className="rounded-xl border border-line bg-panel">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left sm:px-4" aria-expanded={open}>
        <span className="flex items-center gap-2">
          <IconTile tone="muted"><Microscope className="h-3.5 w-3.5" /></IconTile>
          <span>
            <span className="block text-[13px] font-semibold text-fg">Advanced evidence</span>
            <span className="block text-[11px] text-faint">Factor scores, research gate, risk engine, data quality and paper-runtime telemetry</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-line p-3 sm:p-4 lg:grid-cols-2">
          <Block title="Multi-factor evidence" right={tech ? <Chip tone={toneOf(tech.decision)}>{human(tech.decision)} · {finite(tech.confidence) ? Math.round(tech.confidence) : '—'}/100</Chip> : null}>
            {tech?.factors?.length ? (
              <div className="space-y-2">
                {tech.factors.map((f) => (
                  <div key={f.name}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-fg">{human(f.name)}</span>
                      <span className="num text-muted">
                        {f.score} pts · <span className={TEXT[toneOf(f.direction)]}>{f.direction}</span>
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-faint">{f.reason}</div>
                  </div>
                ))}
                {tech.rejection_reasons?.length > 0 && (
                  <div className="rounded-md border border-warn/20 bg-warn-soft/30 px-2 py-1.5 text-[11px] text-warn">{tech.rejection_reasons.join(' ')}</div>
                )}
                <div className="text-[10px] text-faint">Supporting evidence only ({tech.methodology}). The researched strategy decides.</div>
              </div>
            ) : (
              <Muted>No factor breakdown returned.</Muted>
            )}
          </Block>

          <Block title="Strategy & research gate" right={gate ? <Chip tone={toneOf(gate.status)}>{human(gate.status)}</Chip> : null}>
            {gate ? (
              <div className="divide-y divide-line/70">
                <Row k="Selected configuration" v={gate.selected_config_id ?? 'None'} />
                {live && <Row k="Live strategy" v={`${human(live.strategy_family)} · ${live.triggered ? 'triggered' : 'not triggered'}`} />}
                {live && <Row k="Strategy direction" v={live.direction} tone={toneOf(live.direction)} />}
                <p className="pt-2 text-[11px] leading-relaxed text-muted">{live?.reason ?? gate.reason}</p>
                <div className="pt-2 text-[10px] text-faint">Methodology: {decision?.methodology ?? '—'}</div>
              </div>
            ) : (
              <Muted>Waiting for the decision engine.</Muted>
            )}
          </Block>

          <Block title="Risk engine" right={decision?.risk ? <Chip tone={decision.risk.status === 'EVALUATED' ? toneOf(decision.risk.state) : 'muted'}>{decision.risk.status === 'EVALUATED' ? human(decision.risk.state) : human(decision.risk.status)}</Chip> : null}>
            <div className="divide-y divide-line/70">
              {decision?.risk?.hierarchy_stage && <Row k="Stage" v={human(decision.risk.hierarchy_stage)} />}
              {finite(decision?.risk?.computed_risk_pct) && <Row k="Computed risk" v={`${riskPct(decision!.risk!.computed_risk_pct)!.toFixed(2)}%`} />}
              {finite(decision?.risk?.position_size) && <Row k="Position size" v={String(decision!.risk!.position_size)} />}
              {decision?.risk?.reason && <p className="py-2 text-[11px] leading-relaxed text-muted">{decision.risk.reason}</p>}
              {risk &&
                Object.entries(risk.limits).map(([k, v]) => (
                  <Row key={k} k={LIMIT_LABELS[k] ?? human(k)} v={k === 'max_simultaneous_positions' ? String(v) : `${(v * 100).toFixed(1)}%`} />
                ))}
            </div>
          </Block>

          <Block title="Data quality" right={market?.data_quality ? <Chip tone={market.data_quality.is_clean ? 'good' : 'bad'}>{market.data_quality.is_clean ? 'Clean' : 'Rejected'}</Chip> : null}>
            <div className="divide-y divide-line/70">
              <Row k="Provider" v={market?.provider ?? decision?.provider ?? '—'} />
              <Row k="Decision candles" v={String(decision?.data_quality?.candle_count ?? '—')} />
              <Row k="Last completed candle" v={timeLocal(decision?.data_quality?.last_candle ?? market?.last_update ?? null, true)} />
              <Row k="OHLC violations" v={String(market?.data_quality?.ohlc_violations ?? '—')} />
              <Row k="Duplicate timestamps" v={String(market?.data_quality?.duplicate_timestamps ?? '—')} />
              <Row k="Gaps (incl. market closures)" v={String(market?.data_quality?.unexpected_gaps ?? '—')} />
            </div>
          </Block>

          <Block title="Paper runtime telemetry" right={telemetry.data ? <Chip tone="warn">{human(telemetry.data.mode)}</Chip> : null} className="lg:col-span-2">
            {telemetry.data ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="divide-y divide-line/70">
                  <Row k="Cycles observed" v={String(telemetry.data.cycles_observed)} />
                  <Row k="Events" v={String(telemetry.data.events_observed)} />
                  <Row k="Closed trades" v={String(telemetry.data.performance.closed_trades)} />
                  <Row k="Win rate" v={telemetry.data.performance.win_rate != null ? `${(telemetry.data.performance.win_rate * 100).toFixed(0)}%` : '—'} />
                  <Row k="Realized P&L" v={money(telemetry.data.performance.realized_pnl, { sign: true })} />
                </div>
                <Counts title="Decision outcomes" counts={telemetry.data.decision_status_counts} />
                <Counts title="Top reasons Tembo said no" counts={telemetry.data.rejection_reason_counts} />
              </div>
            ) : telemetry.error ? (
              <Muted>{telemetry.error.message}</Muted>
            ) : (
              <Muted>Loading telemetry…</Muted>
            )}
          </Block>
        </div>
      )}
    </section>
  );
}

function Counts({ title, counts }: { title: string; counts: Record<string, number> }) {
  const rows = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = rows.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{title}</div>
      <div className="space-y-1.5">
        {rows.map(([k, n]) => (
          <div key={k}>
            <div className="flex items-start justify-between gap-2 text-[11px]">
              <span className="min-w-0 text-muted">{/^[A-Z_]+$/.test(k) ? human(k) : k.length > 80 ? k.slice(0, 80) + '…' : k}</span>
              <span className="num shrink-0 text-fg">{n}</span>
            </div>
            <div className="mt-0.5 h-1 rounded-full bg-panel-3">
              <div className="h-1 rounded-full bg-info/70" style={{ width: `${(n / total) * 100}%` }} />
            </div>
          </div>
        ))}
        {!rows.length && <Muted>None recorded.</Muted>}
      </div>
    </div>
  );
}

function Block({ title, right, children, className = '' }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-panel-2/60 p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
          <Dot tone="info" /> {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-faint">{children}</div>;
}
