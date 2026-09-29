import React, { useEffect, useState, type ComponentType } from 'react';
import {
  LayoutDashboard,
  CandlestickChart,
  Signal,
  Wallet,
  Newspaper,
  FlaskConical,
  Gauge,
  ShieldCheck,
  MoreHorizontal,
  Trophy,
  X,
} from 'lucide-react';
import { API_BASE_URL, onWakeChange, useApi } from './lib/api';
import type { DerivStatus, Health } from './lib/types';
import { ElephantMark, Logo } from './components/brand';
import { Dot, type Tone } from './components/cockpit/common';
import { AlertBell } from './components/cockpit/Alerts';
import Overview from './pages/Overview';
import Decisions from './pages/Decisions';
import Markets from './pages/Markets';
import Paper from './pages/Paper';
import Research from './pages/Research';
import News from './pages/News';
import Dashboard from './pages/Dashboard';
import TestLab from './pages/TestLab';
import Results from './pages/Results';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const error = this.state.error;
    return (
      <div className="min-h-screen bg-ink px-5 py-10 text-fg">
        <div className="mx-auto max-w-xl rounded-2xl border border-down/30 bg-panel p-6">
          <div className="text-lg font-semibold">Tembo failed to start</div>
          <p className="mt-2 text-sm text-muted">The frontend loaded, but a browser-side error stopped React from rendering.</p>
          <div className="mt-4 break-words rounded-lg border border-line bg-ink p-3 font-mono text-xs text-down">{error?.message || 'Unknown runtime error'}</div>
          <div className="mt-4 text-xs text-faint">API: {API_BASE_URL}</div>
          <button className="mt-5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink" onClick={() => window.location.reload()}>
            Reload Tembo
          </button>
        </div>
      </div>
    );
  }
}

type RouteKey = 'live' | 'results' | 'markets' | 'decisions' | 'paper' | 'news' | 'research' | 'overview' | 'test-lab';

interface RouteDef {
  key: RouteKey;
  label: string; // sidebar
  tab: string; // top tabs / bottom nav
  icon: ComponentType<{ className?: string }>;
  page: ComponentType<{ go: (r: string) => void }>;
  wide?: boolean;
}

const ROUTES: RouteDef[] = [
  { key: 'live', label: 'Dashboard', tab: 'Dashboard', icon: LayoutDashboard, page: Dashboard, wide: true },
  { key: 'results', label: 'Results', tab: 'Results', icon: Trophy, page: Results },
  { key: 'markets', label: 'Live Markets', tab: 'Markets', icon: CandlestickChart, page: Markets },
  { key: 'decisions', label: 'Trade Signals', tab: 'Signals', icon: Signal, page: Decisions },
  { key: 'paper', label: 'Paper Trading', tab: 'Paper', icon: Wallet, page: Paper },
  { key: 'news', label: 'News & Calendar', tab: 'News', icon: Newspaper, page: News },
  { key: 'research', label: 'Research', tab: 'Research', icon: FlaskConical, page: Research },
  { key: 'overview', label: 'System Overview', tab: 'System', icon: Gauge, page: Overview },
  { key: 'test-lab', label: 'Test Lab', tab: 'Test lab', icon: ShieldCheck, page: TestLab },
];
const TOP_TABS: RouteKey[] = ['live', 'results', 'markets', 'decisions', 'paper', 'news', 'research'];
const BOTTOM_TABS: RouteKey[] = ['live', 'results', 'markets', 'decisions'];

function parseHash(): RouteKey {
  const r = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return ROUTES.find((x) => x.key === r)?.key ?? 'live';
}

function StatusPill({ tone, label, pulse }: { tone: Tone; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] font-medium text-muted">
      <Dot tone={tone} pulse={pulse} />
      {label}
    </span>
  );
}

function AppShell() {
  const [route, setRoute] = useState<RouteKey>(parseHash());
  const [waking, setWaking] = useState(false);
  const [more, setMore] = useState(false);
  const health = useApi<Health>('/health', { refreshMs: 120_000 });
  const deriv = useApi<DerivStatus>('/deriv/status', { refreshMs: 180_000 });

  useEffect(() => {
    const h = () => {
      const next = parseHash();
      setRoute((prev) => {
        if (prev !== next) window.scrollTo({ top: 0 });
        return next;
      });
      setMore(false);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  useEffect(() => onWakeChange(setWaking), []);

  const go = (r: string) => {
    window.location.hash = `/${r}`;
  };
  const current = ROUTES.find((r) => r.key === route)!;
  const Page = current.page;

  const backendTone: Tone = waking ? 'warn' : health.data ? (health.data.status === 'ok' ? 'good' : 'warn') : health.loading ? 'muted' : 'bad';
  const backendLabel = waking ? 'Waking server' : health.data ? (health.data.status === 'ok' ? 'Backend online' : 'Backend online · DB check failed') : health.loading ? 'Connecting' : 'Backend offline';
  const dataTone: Tone = health.data?.market_data === 'available' ? 'good' : health.data?.market_data === 'configured' ? 'warn' : health.data ? 'bad' : 'muted';
  const derivTone: Tone = deriv.data?.connected ? 'good' : deriv.error ? 'bad' : 'muted';

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-3 sm:px-4 lg:h-16">
          <a href="#/live" className="shrink-0 lg:w-[200px]">
            <Logo compact />
          </a>
          <nav className="hidden h-full items-stretch gap-1 md:flex">
            {TOP_TABS.map((k) => {
              const r = ROUTES.find((x) => x.key === k)!;
              const active = k === route;
              return (
                <a key={k} href={`#/${k}`} className={`relative flex items-center px-3 text-[13px] font-medium transition ${active ? 'text-brand' : 'text-muted hover:text-fg'}`}>
                  {r.tab}
                  {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
                </a>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden 2xl:inline-flex">
              <StatusPill tone={dataTone} label={`Data ${health.data?.market_data === 'available' ? 'verified' : health.data?.market_data ?? '…'}`} />
            </span>
            <span className="hidden 2xl:inline-flex">
              <StatusPill tone={derivTone} label={deriv.data?.connected ? 'Deriv demo connected' : 'Deriv demo offline'} />
            </span>
            <span className="hidden lg:inline-flex">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-warn/30 bg-warn-soft/50 px-2.5 py-1 text-[11px] font-semibold text-warn">
                <ShieldCheck className="h-3.5 w-3.5" /> {health.data?.live_execution_enabled ? 'Live execution ON' : 'Paper / demo only'}
              </span>
            </span>
            <AlertBell />
            <span className="hidden sm:inline-flex">
              <StatusPill tone={backendTone} label={backendLabel} pulse={waking || (health.loading && !health.data)} />
            </span>
            <span className="sm:hidden">
              <StatusPill tone={backendTone} label={waking ? 'Waking' : health.data ? 'Live' : health.loading ? '…' : 'Offline'} pulse={waking || (health.loading && !health.data)} />
            </span>
          </div>
        </div>
        {waking && (
          <div className="border-t border-warn/20 bg-warn-soft/70 px-4 py-1.5 text-center text-[11px] text-warn">
            The free Render server was asleep. It usually wakes in 30–60 seconds, and the data will load by itself.
          </div>
        )}
      </header>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[216px] shrink-0 flex-col border-r border-line bg-ink px-3 py-4 lg:flex">
          <nav className="space-y-0.5">
            {ROUTES.map((r) => {
              const active = r.key === route;
              return (
                <a
                  key={r.key}
                  href={`#/${r.key}`}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                    active ? 'bg-brand-soft/60 text-brand' : 'text-muted hover:bg-panel hover:text-fg'
                  }`}
                >
                  {active && <span className="absolute inset-y-1.5 right-0 w-0.5 rounded-full bg-brand" />}
                  <r.icon className="h-4 w-4" />
                  {r.label}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto overflow-hidden rounded-xl border border-line bg-gradient-to-b from-panel to-panel-2 p-3">
            <ElephantMark className="h-14 w-14 text-brand/80" strokeWidth={1.4} />
            <div className="mt-2 text-[13px] font-semibold text-fg">Tembo Forex Bot</div>
            <div className="text-[11px] text-faint">Discipline. Data. Better trades.</div>
            <div className="mt-2 truncate text-[9px] text-faint" title={API_BASE_URL}>
              API: {API_BASE_URL.replace(/^https?:\/\//, '')}
            </div>
          </div>
        </aside>

        <main className={`min-w-0 flex-1 px-3 pb-28 pt-3 sm:px-4 lg:pb-10 lg:pt-4 ${current.wide ? '' : 'mx-auto max-w-6xl'}`}>
          <Page go={go} />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {BOTTOM_TABS.map((k) => {
            const r = ROUTES.find((x) => x.key === k)!;
            const active = k === route;
            return (
              <a key={k} href={`#/${k}`} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${active ? 'text-brand' : 'text-faint'}`}>
                <r.icon className="h-5 w-5" />
                {r.tab}
              </a>
            );
          })}
          <button onClick={() => setMore(true)} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${BOTTOM_TABS.includes(route) ? 'text-faint' : 'text-brand'}`}>
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-panel p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">All pages</span>
              <button onClick={() => setMore(false)} className="rounded-lg p-1.5 text-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ROUTES.map((r) => (
                <a key={r.key} href={`#/${r.key}`} className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-[13px] ${r.key === route ? 'border-brand/50 bg-brand-soft/50 text-brand' : 'border-line bg-panel-2 text-fg'}`}>
                  <r.icon className="h-4 w-4" />
                  {r.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
