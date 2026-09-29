import { useEffect, useState } from 'react';
import { Eye, EyeOff, Wallet, Radio, ShieldCheck, Link2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { apiPost, useApi, type ApiError } from '../../lib/api';
import type { DerivBuy, DerivContract, DerivProposal, DerivStatus, LiveDecision, RiskMetrics, RuntimeStatus } from '../../lib/types';
import { digitsFor, fmtPrice, metaFor } from '../../lib/instruments';
import { InstrumentIcon } from '../brand';
import { Chip, Empty, IconTile, Panel, Row, TEXT, finite, human, timeLocal } from './common';
import { signalOf, riskPct } from './Guidance';
import type { Quote } from './types';
import { money } from '../../lib/format';

export function MarketWatch({ ids, quotes, selected, onSelect }: { ids: string[]; quotes: Record<string, Quote>; selected: string; onSelect: (id: string) => void }) {
  const anyLive = ids.some((id) => quotes[id]?.price != null);
  return (
    <Panel title="Market watch" right={anyLive ? <Chip tone="good" pulse>Live</Chip> : <Chip tone="warn">Waiting</Chip>} bodyClass="px-1.5 pb-2 pt-1 sm:px-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_64px] gap-x-2 px-2 pb-1 text-[10px] font-medium text-faint">
        <span>Symbol</span>
        <span className="text-right">Price</span>
        <span className="text-right">Today</span>
      </div>
      {ids.map((id) => {
        const q = quotes[id];
        const meta = metaFor(id, q?.displayName);
        const d = digitsFor(id, q?.pipSize);
        const active = id === selected;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`grid w-full grid-cols-[minmax(0,1fr)_auto_64px] items-center gap-x-2 rounded-md px-2 py-1.5 text-left text-[12px] transition ${active ? 'bg-brand-soft/50' : 'hover:bg-panel-2'}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <InstrumentIcon meta={meta} size="sm" />
              <span className="truncate font-medium text-fg">{meta.code}</span>
            </span>
            <span className="num text-right text-fg">{q?.price != null ? fmtPrice(q.price, d) : q?.error ? <span className="text-faint" title={q.error.message}>n/a</span> : <span className="text-faint">…</span>}</span>
            <span className={`num text-right ${q?.changePct == null ? 'text-faint' : q.changePct >= 0 ? 'text-up' : 'text-down'}`}>
              {q?.changePct != null ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : '—'}
            </span>
          </button>
        );
      })}
    </Panel>
  );
}

export function PaperAccount({ runtime, error, risk }: { runtime: RuntimeStatus | null; error: ApiError | null; risk: RiskMetrics | null }) {
  const [hidden, setHidden] = useState(false);
  const equity = runtime ? runtime.initial_equity + (runtime.realized_pnl ?? 0) : null;
  const dd = runtime && equity != null && runtime.peak_equity > 0 ? ((runtime.peak_equity - equity) / runtime.peak_equity) * 100 : null;
  const maxRisk = riskPct(risk?.limits?.max_risk_per_trade_pct);
  const mask = (s: string) => (hidden ? '••••••' : s);
  return (
    <Panel
      title="Account (paper trading)"
      icon={<IconTile tone="good"><Wallet className="h-3.5 w-3.5" /></IconTile>}
      right={
        <button onClick={() => setHidden((h) => !h)} className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-fg" aria-label={hidden ? 'Show balances' : 'Hide balances'}>
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
      bodyClass="px-3 pb-3 pt-1 sm:px-4"
    >
      {runtime ? (
        <div className="divide-y divide-line/70">
          <Row k="Balance" v={mask(money(equity))} />
          <Row k="Realized P/L" v={mask(money(runtime.realized_pnl, { sign: true }))} tone={runtime.realized_pnl > 0 ? 'good' : runtime.realized_pnl < 0 ? 'bad' : undefined} />
          <Row k="Starting equity" v={mask(money(runtime.initial_equity))} />
          <Row k="Open positions" v={String(runtime.open_positions)} />
          <Row k="Drawdown from peak" v={dd != null ? `${dd.toFixed(2)}%` : '—'} />
          <Row k="Max risk per trade" v={maxRisk != null ? `${maxRisk.toFixed(1)}%` : '—'} />
          <div className="flex items-center justify-between pt-2 text-[10px] text-faint">
            <span className="flex items-center gap-1.5">
              <Chip tone={runtime.status === 'RUNNING' ? 'good' : 'warn'}>{human(runtime.status)}</Chip>
            </span>
            <span>Last cycle {timeLocal(runtime.last_cycle_at)}</span>
          </div>
        </div>
      ) : error ? (
        <Empty>Paper account unavailable: {error.message}</Empty>
      ) : (
        <div className="space-y-2 py-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-4" />
          ))}
        </div>
      )}
    </Panel>
  );
}

const CONTRACT_KEY = 'tembo.demoContractId';
function readStoredContract(): number | null {
  try {
    const v = window.localStorage.getItem(CONTRACT_KEY);
    return v ? Number(v) || null : null;
  } catch {
    return null;
  }
}
function storeContract(id: number | null) {
  try {
    if (id) window.localStorage.setItem(CONTRACT_KEY, String(id));
    else window.localStorage.removeItem(CONTRACT_KEY);
  } catch {
    /* storage unavailable: monitoring still works for this visit */
  }
}

export function DerivDemo({
  status,
  error,
  loading,
  reload,
  decision,
  instrument,
  timeframe,
}: {
  status: DerivStatus | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  decision: LiveDecision | null;
  instrument: string;
  timeframe: string;
}) {
  const connected = status?.connected === true;
  const tone = connected ? 'good' : error ? 'bad' : status?.configured === false ? 'muted' : 'warn';
  const label = connected ? 'Connected' : error ? 'Connection error' : status?.configured === false ? 'Not configured' : loading ? 'Checking' : 'Not connected';
  const acct = status?.account_id ? `${String(status.account_id).slice(0, 4)}•••${String(status.account_id).slice(-3)}` : '—';

  return (
    <Panel
      title="Deriv demo"
      icon={<IconTile tone="info"><Link2 className="h-3.5 w-3.5" /></IconTile>}
      right={<Chip tone={tone} pulse={loading && !status}>{label}</Chip>}
      bodyClass="px-3 pb-3 pt-1 sm:px-4"
    >
      {connected ? (
        <div className="divide-y divide-line/70">
          <Row k="Account" v={`${acct} · ${human(status?.account_type ?? 'demo')}`} />
          <Row k="Balance" v={finite(status?.balance) ? `${status!.balance!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${status?.currency ?? ''}` : '—'} />
          <Row k="Open contracts" v={String(status?.open_positions ?? 0)} />
        </div>
      ) : (
        <div className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${error ? 'border-down/30 bg-down-soft/30 text-muted' : 'border-line bg-panel-2 text-faint'}`}>
          {error ? (
            <>
              <div className="flex items-center gap-1.5 font-semibold text-down">
                <AlertTriangle className="h-3.5 w-3.5" /> Backend could not reach the Deriv demo account
              </div>
              <div className="mt-1 break-words text-muted">{error.message}</div>
              <div className="mt-1 text-faint">Fix on Render → Environment: DERIV_API_TOKEN, DERIV_ACCOUNT_ID, DERIV_APP_ID, DERIV_TRADING_MODE=demo.</div>
            </>
          ) : (
            status?.message ?? 'Checking the Deriv demo connection…'
          )}
          <button onClick={reload} className="mt-2 inline-flex items-center gap-1 rounded-md border border-line-2 px-2 py-0.5 text-[10px] text-fg hover:bg-panel-2">
            <RefreshCw className="h-3 w-3" /> Check again
          </button>
        </div>
      )}
      <DemoExecution connected={connected} decision={decision} instrument={instrument} timeframe={timeframe} onChange={reload} />
      {connected && <ConnectionTest instrument={instrument} onDone={reload} />}
    </Panel>
  );
}

function DemoExecution({
  connected,
  decision,
  instrument,
  timeframe,
  onChange,
}: {
  connected: boolean;
  decision: LiveDecision | null;
  instrument: string;
  timeframe: string;
  onChange: () => void;
}) {
  const signal = signalOf(decision);
  const eligible = decision?.paper_eligibility?.eligible === true;
  const [stake, setStake] = useState('10');
  const [multiplier, setMultiplier] = useState('100');
  const [busy, setBusy] = useState<null | 'proposal' | 'buy' | 'sell'>(null);
  const [proposal, setProposal] = useState<(DerivProposal & { at: number }) | null>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [contractId, setContractId] = useState<number | null>(readStoredContract);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!proposal) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [proposal]);

  // A proposal belongs to one instrument/decision; drop it when either changes.
  useEffect(() => {
    setProposal(null);
    setMsg(null);
  }, [instrument, timeframe, signal]);

  const checks = [
    { ok: signal === 'BUY' || signal === 'SELL', text: signal === 'BUY' || signal === 'SELL' ? `Tembo says ${signal}` : 'Tembo says NO TRADE' },
    { ok: eligible, text: eligible ? (decision?.forward_test?.active ? 'Approved as a forward test' : 'Paper eligibility approved') : 'Not paper-eligible' },
    { ok: connected, text: connected ? 'Deriv demo connected' : 'Deriv demo not connected' },
  ];
  const ready = checks.every((c) => c.ok);
  const secondsLeft = proposal ? Math.max(0, 110 - Math.floor((now - proposal.at) / 1000)) : 0;

  async function requestProposal() {
    setBusy('proposal');
    setMsg(null);
    try {
      const p = await apiPost<DerivProposal>('/deriv/demo/proposal', {
        instrument,
        timeframe: timeframe.toLowerCase(),
        direction: signal,
        stake: Number(stake),
        multiplier: Number(multiplier),
      });
      setProposal({ ...p, at: Date.now() });
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  async function confirmBuy() {
    if (!proposal) return;
    setBusy('buy');
    setMsg(null);
    try {
      // The backend re-checks Tembo, then quotes and buys on one Deriv connection
      // (a Deriv quote id only works on the connection that created it).
      const r = await apiPost<DerivBuy>('/deriv/demo/buy', { execution_token: proposal.execution_token, timeframe: timeframe.toLowerCase() });
      setContractId(r.contract_id);
      storeContract(r.contract_id);
      setProposal(null);
      setMsg({ tone: 'good', text: `Demo contract ${r.contract_id} opened at ${r.buy_price}.` });
      onChange();
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-fg">Demo execution</div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-warn">Demo money only</span>
      </div>
      <ul className="mt-2 space-y-1">
        {checks.map((c) => (
          <li key={c.text} className={`flex items-center gap-1.5 text-[11px] ${c.ok ? 'text-up' : 'text-faint'}`}>
            {c.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {c.text}
          </li>
        ))}
      </ul>

      {ready && !proposal && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[10px] text-faint">
            Stake (USD)
            <input value={stake} onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="num mt-0.5 w-full rounded-md border border-line bg-panel-2 px-2 py-1 text-[12px] text-fg outline-none focus:border-brand/50" />
          </label>
          <label className="text-[10px] text-faint">
            Multiplier <span className="text-faint">(auto-adjusts)</span>
            <input value={multiplier} onChange={(e) => setMultiplier(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" className="num mt-0.5 w-full rounded-md border border-line bg-panel-2 px-2 py-1 text-[12px] text-fg outline-none focus:border-brand/50" />
          </label>
        </div>
      )}

      {!proposal ? (
        <button
          disabled={!ready || busy !== null || !Number(stake) || !Number(multiplier)}
          onClick={requestProposal}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12px] font-bold text-ink transition disabled:cursor-not-allowed disabled:bg-panel-3 disabled:text-faint"
        >
          {busy === 'proposal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {ready ? `Get demo ${signal} quote` : checks[0].ok && checks[1].ok ? 'Connect the Deriv demo first' : 'Waiting for an approved setup'}
        </button>
      ) : (
        <div className="mt-2 rounded-lg border border-brand/40 bg-brand-soft/30 p-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-fg">
              {proposal.direction} {metaFor(proposal.instrument).code} · x{proposal.multiplier}
            </span>
            <span className={secondsLeft < 20 ? 'text-warn' : 'text-faint'}>{secondsLeft}s</span>
          </div>
          <div className="mt-1 divide-y divide-line/60">
            <Row k="Stake" v={`${proposal.ask_price} ${proposal.currency}`} />
            <Row k="Spot" v={proposal.spot != null ? fmtPrice(proposal.spot, digitsFor(proposal.instrument)) : '—'} />
            <Row k="SL/TP attached" v={proposal.protection?.attached ? 'Yes (from Tembo plan)' : 'No'} tone={proposal.protection?.attached ? 'good' : 'warn'} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => setProposal(null)} className="rounded-lg border border-line-2 px-3 py-1.5 text-[12px] text-muted hover:text-fg">
              Cancel
            </button>
            <button
              disabled={busy !== null || secondsLeft === 0}
              onClick={confirmBuy}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-ink disabled:opacity-50 ${proposal.direction === 'SELL' ? 'bg-down' : 'bg-up'}`}
            >
              {busy === 'buy' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm demo {proposal.direction}
            </button>
          </div>
        </div>
      )}

      {msg && <div className={`mt-2 break-words text-[11px] ${TEXT[msg.tone]}`}>{msg.text}</div>}

      {contractId && (
        <ContractMonitor
          contractId={contractId}
          onClosed={() => {
            onChange();
          }}
          onForget={() => {
            setContractId(null);
            storeContract(null);
          }}
        />
      )}
    </div>
  );
}

function ContractMonitor({ contractId, onClosed, onForget }: { contractId: number; onClosed: () => void; onForget: () => void }) {
  const c = useApi<DerivContract>(`/deriv/demo/contract?contract_id=${contractId}`, { refreshMs: 10_000 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const k = c.data?.contract;
  const sold = k ? String(k.is_sold ?? '0') === '1' || k.is_sold === true || ['sold', 'closed', 'expired'].includes(String(k.status ?? '').toLowerCase()) : false;
  const profit = finite(k?.profit) ? k!.profit! : null;

  async function close() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiPost<{ sold_for: number | null }>('/deriv/demo/sell', { contract_id: contractId });
      setMsg(`Closed. Sold for ${r.sold_for ?? '—'}.`);
      c.reload();
      onClosed();
    } catch (e) {
      setMsg((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-panel-2 p-2.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-semibold text-fg">
          <Radio className="h-3.5 w-3.5 text-info" /> Contract {contractId}
        </span>
        <Chip tone={sold ? 'muted' : 'good'}>{sold ? 'Closed' : human(String(k?.status ?? 'open'))}</Chip>
      </div>
      {k ? (
        <div className="mt-1 divide-y divide-line/60">
          <Row k="Market" v={String(k.display_name ?? k.underlying ?? '—')} />
          <Row k="Type" v={String(k.contract_type ?? '—')} />
          <Row k="Profit / loss" v={profit != null ? `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} ${k.currency ?? ''}` : '—'} tone={profit == null ? undefined : profit >= 0 ? 'good' : 'bad'} />
          <Row k="Entry → now" v={`${k.entry_spot ?? '—'} → ${k.current_spot ?? '—'}`} />
        </div>
      ) : c.error ? (
        <div className="mt-1 text-[11px] text-down">{c.error.message}</div>
      ) : (
        <div className="mt-1 text-[11px] text-faint">Loading contract from Deriv…</div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={onForget} className="rounded-lg border border-line-2 px-2 py-1 text-[11px] text-muted hover:text-fg">
          Stop watching
        </button>
        <button disabled={sold || busy} onClick={close} className="flex items-center justify-center gap-1 rounded-lg bg-down px-2 py-1 text-[11px] font-bold text-ink disabled:opacity-40">
          {busy && <Loader2 className="h-3 w-3 animate-spin" />} Close demo
        </button>
      </div>
      {msg && <div className="mt-1.5 break-words text-[11px] text-muted">{msg}</div>}
    </div>
  );
}


interface SelfTestResult {
  status: 'PASSED' | 'PARTIAL' | 'FAILED';
  instrument: string;
  contract_id?: number;
  steps: Array<{ step: string; ok: boolean; detail: string }>;
}

const TESTABLE = ['USD/JPY', 'EUR/USD', 'GBP/USD', 'XAU/USD'];

/** One-tap check that the whole demo path works: $1 demo trade, opened and closed in seconds. */
function ConnectionTest({ instrument, onDone }: { instrument: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SelfTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target = TESTABLE.includes(instrument) ? instrument : 'USD/JPY';

  async function run() {
    setBusy(true);
    setConfirming(false);
    setError(null);
    setResult(null);
    try {
      setResult(await apiPost<SelfTestResult>('/deriv/demo/selftest', { instrument: target }));
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-fg">Connection test</div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-faint">$1 demo · auto-closes</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-faint">
        Opens a $1 {metaFor(target).code} demo trade with stop loss and take profit, then closes it straight away. It checks the whole path works. It is not a Tembo signal.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-info/40 bg-info-soft/60 px-3 py-2 text-[12px] font-semibold text-info disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />} {busy ? 'Testing… (about 15 seconds)' : 'Run connection test'}
        </button>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => setConfirming(false)} className="rounded-lg border border-line-2 px-3 py-2 text-[12px] text-muted">
            Cancel
          </button>
          <button onClick={run} className="rounded-lg bg-info px-3 py-2 text-[12px] font-bold text-ink">
            Yes, run $1 test
          </button>
        </div>
      )}
      {error && <div className="mt-2 break-words text-[11px] text-down">{error}</div>}
      {result && (
        <div className="mt-2 rounded-lg border border-line bg-panel-2 p-2.5">
          <div className={`text-[12px] font-bold ${result.status === 'PASSED' ? 'text-up' : result.status === 'PARTIAL' ? 'text-warn' : 'text-down'}`}>
            {result.status === 'PASSED' ? 'Everything works' : result.status === 'PARTIAL' ? 'Mostly works' : 'Test failed'}
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {result.steps.map((s) => (
              <li key={s.step} className="flex gap-1.5 text-[11px]">
                {s.ok ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-up" /> : <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-down" />}
                <span className="min-w-0">
                  <span className="font-medium text-fg">{s.step}</span>
                  <span className="block break-words text-faint">{s.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
