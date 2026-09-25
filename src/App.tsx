import { useEffect, useState, type ComponentType } from 'react';
import { Activity, LayoutDashboard, Scale, CandlestickChart, Wallet, FlaskConical, Newspaper, ShieldCheck } from 'lucide-react';
import { API_BASE_URL, onWakeChange, useApi } from './lib/api';
import type { Health } from './lib/types';
import { Dot } from './components/ui';
import Overview from './pages/Overview';
import Decisions from './pages/Decisions';
import Markets from './pages/Markets';
import Paper from './pages/Paper';
import Research from './pages/Research';
import News from './pages/News';
import Live from './pages/Live';

type RouteKey = 'overview' | 'decisions' | 'markets' | 'paper' | 'research' | 'news' | 'live';

const ROUTES: { key: RouteKey; label: string; short: string; icon: ComponentType<{ className?: string }>; page: ComponentType<{ go: (r: string) => void }> }[] = [
  { key: 'overview', label: 'Overview', short: 'Home', icon: LayoutDashboard, page: Overview },
  { key: 'live', label: 'Live cockpit', short: 'Live', icon: Activity, page: Live },
  { key: 'decisions', label: 'Decisions', short: 'Decide', icon: Scale, page: Decisions },
  { key: 'markets', label: 'Markets', short: 'Markets', icon: CandlestickChart, page: Markets },
  { key: 'paper', label: 'Paper account', short: 'Paper', icon: Wallet, page: Paper },
  { key: 'research', label: 'Research', short: 'Research', icon: FlaskConical, page: Research },
  { key: 'news', label: 'News & calendar', short: 'News', icon: Newspaper, page: News },
];

function parseHash(): { route: RouteKey } {
  const r = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return { route: (ROUTES.find((x) => x.key === r)?.key ?? 'overview') as RouteKey };
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-lg border border-gold/30 bg-gold-soft">
        <svg viewBox="0 0 32 32" className="h-5 w-5">
          <path d="M5 22l7-8 5 4 10-11" fill="none" stroke="#e5b64a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">Tembo</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Forex bot</div>
      </div>
    </div>
  );
}

function StatusChip({ health, loading, waking }: { health: Health | null; loading: boolean; waking: boolean }) {
  let tone: 'good' | 'warn' | 'bad' | 'muted' = 'muted';
  let text = 'Connecting…';
  if (waking) {
    tone = 'warn';
    text = 'Waking server…';
  } else if (health) {
    tone = health.status === 'ok' ? 'good' : 'warn';
    text = health.status === 'ok' ? 'Backend online' : 'Backend online · degraded';
  } else if (!loading) {
    tone = 'bad';
    text = 'Backend offline';
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] font-medium text-muted">
      <Dot tone={tone} pulse={waking || (loading && !health)} />
      {text}
    </span>
  );
}

export default function App() {
  const [{ route }, setLoc] = useState(parseHash());
  const [waking, setWaking] = useState(false);
  const health = useApi<Health>('/health');

  useEffect(() => {
    const h = () => {
      setLoc(parseHash());
      window.scrollTo({ top: 0 });
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

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-ink px-4 py-5 lg:flex">
        <Logo />
        <nav className="mt-8 space-y-1">
          {ROUTES.map((r) => {
            const active = r.key === route;
            return (
              <a
                key={r.key}
                href={`#/${r.key}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-panel-2 text-fg' : 'text-muted hover:bg-panel hover:text-fg'
                }`}
              >
                <r.icon className={`h-4 w-4 ${active ? 'text-gold' : ''}`} />
                {r.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-line bg-panel p-3 text-xs text-muted">
            <div className="flex items-center gap-2 font-medium text-fg">
              <ShieldCheck className="h-4 w-4 text-up" /> Paper trading only
            </div>
            <p className="mt-1 leading-relaxed">
              {health.data?.live_execution_enabled ? 'Warning: the backend reports live execution enabled.' : 'Live execution is disabled on the backend. No real money is used.'}
            </p>
          </div>
          <div className="truncate text-[10px] text-faint" title={API_BASE_URL}>
            API: {API_BASE_URL.replace(/^https?:\/\//, '')}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="hidden text-sm font-medium text-muted lg:block">{current.label}</div>
            <StatusChip health={health.data} loading={health.loading} waking={waking} />
          </div>
          {waking && (
            <div className="border-t border-warn/20 bg-warn-soft/70 px-4 py-1.5 text-center text-[11px] text-warn">
              The free Render server was asleep. It usually wakes in 30–60 seconds, and the data will load by itself.
            </div>
          )}
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12">
          <Page go={go} />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {ROUTES.map((r) => {
            const active = r.key === route;
            return (
              <a key={r.key} href={`#/${r.key}`} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${active ? 'text-gold' : 'text-faint'}`}>
                <r.icon className="h-5 w-5" />
                {r.short}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
