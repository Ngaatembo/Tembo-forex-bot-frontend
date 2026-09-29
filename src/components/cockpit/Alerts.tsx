import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Send } from 'lucide-react';
import { useApi } from '../../lib/api';
import { alertState, disableAlerts, enableAlerts, resyncAlerts, sendTestAlert, showLocalTestNotification, type AlertState } from '../../lib/push';
import { Chip, IconTile, Panel, timeLocal } from './common';

// Tiny shared store so the top-bar bell and the dashboard card stay in sync.
let shared: AlertState | null = null;
const listeners = new Set<(s: AlertState) => void>();
function publish(s: AlertState) {
  shared = s;
  listeners.forEach((l) => l(s));
}

export function useAlerts() {
  const [state, setState] = useState<AlertState | null>(shared);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  useEffect(() => {
    listeners.add(setState);
    if (shared === null) {
      alertState().then(publish).catch(() => publish('unsupported'));
      resyncAlerts();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const turnOn = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await enableAlerts();
      publish('on');
      setMessage({ tone: 'good', text: 'Alerts are on for this phone.' });
    } catch (e) {
      setMessage({ tone: 'bad', text: (e as Error).message });
      publish(await alertState().catch(() => 'off' as AlertState));
    } finally {
      setBusy(false);
    }
  }, []);

  const turnOff = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await disableAlerts();
      publish('off');
    } catch (e) {
      setMessage({ tone: 'bad', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, []);

  const localTest = useCallback(async () => {
    setMessage(null);
    try {
      await showLocalTestNotification();
      setMessage({ tone: 'good', text: 'Phone test shown. If nothing appeared, Android or Chrome is hiding Tembo notifications (see the checklist below).' });
    } catch (e) {
      setMessage({ tone: 'bad', text: (e as Error).message });
    }
  }, []);

  const test = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await sendTestAlert();
      setMessage({ tone: 'good', text: `Google's push service accepted the test at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. It should pop up within a few seconds.` });
    } catch (e) {
      setMessage({ tone: 'bad', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, message, turnOn, turnOff, test, localTest };
}

/** Compact bell for the top bar. */
export function AlertBell() {
  const { state, busy, turnOn } = useAlerts();
  if (state === null || state === 'unsupported') return null;
  const on = state === 'on';
  return (
    <button
      onClick={() => {
        if (!on) return turnOn();
        if (!window.location.hash.startsWith('#/live')) window.location.hash = '/live';
        setTimeout(() => document.getElementById('alerts-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
      }}
      disabled={busy}
      title={on ? 'Alerts are on' : 'Turn on phone alerts'}
      aria-label={on ? 'Alerts are on' : 'Turn on phone alerts'}
      className={`relative grid h-8 w-8 place-items-center rounded-full border transition ${
        on ? 'border-brand/40 bg-brand-soft/60 text-brand' : 'border-line bg-panel text-muted hover:text-fg'
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {!on && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warn" />}
    </button>
  );
}

interface AlertStatus {
  enabled: boolean;
  subscriptions: number | null;
  next_heads_up_check: string;
  next_confirmation_check: string;
  recent: Array<{ at: string; title: string; body: string; kind: string }>;
}

/** Dashboard card: turn alerts on/off, send a test, see when the next checks run. */
export function AlertsCard() {
  const { state, busy, message, turnOn, turnOff, test, localTest } = useAlerts();
  const status = useApi<AlertStatus>('/alerts/status', { refreshMs: 300_000 });
  const on = state === 'on';

  return (
    <Panel
      title="Phone alerts"
      icon={<IconTile tone={on ? 'good' : 'warn'}>{on ? <BellRing className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}</IconTile>}
      right={<Chip tone={on ? 'good' : state === 'blocked' ? 'bad' : 'muted'}>{on ? 'On' : state === 'blocked' ? 'Blocked' : 'Off'}</Chip>}
      bodyClass="px-3 pb-3 pt-2 sm:px-4"
    >
      <p className="text-[12px] leading-relaxed text-muted">
        About <span className="font-semibold text-fg">5 minutes before</span> an hourly candle closes, Tembo checks if a signal is forming and sends a heads-up. When the candle closes it sends the confirmed signal, or says it didn't confirm. <span className="text-fg">No signal forming means no alert</span>, so most hours are quiet.
      </p>
      {status.data && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-line bg-panel-2 px-2 py-1.5">
            <div className="text-faint">Next heads-up check</div>
            <div className="num font-semibold text-fg">{timeLocal(status.data.next_heads_up_check)}</div>
          </div>
          <div className="rounded-md border border-line bg-panel-2 px-2 py-1.5">
            <div className="text-faint">Next confirmation</div>
            <div className="num font-semibold text-fg">{timeLocal(status.data.next_confirmation_check)}</div>
          </div>
        </div>
      )}

      {state === 'unsupported' && <div className="mt-2 text-[11px] text-faint">This browser can't show notifications. On Android, open the site in Chrome.</div>}
      {state === 'needs-install' && (
        <div className="mt-2 text-[11px] text-faint">On iPhone: tap Share → Add to Home Screen, open Tembo from the home screen, then turn alerts on.</div>
      )}
      {state === 'blocked' && (
        <div className="mt-2 text-[11px] text-down">Notifications are blocked for this site. Tap the lock icon next to the address, allow Notifications, then reload.</div>
      )}

      {(state === 'off' || state === 'on') && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {on ? (
            <>
              <button onClick={test} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12px] font-bold text-ink disabled:opacity-60">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test
              </button>
              <button onClick={turnOff} disabled={busy} className="rounded-lg border border-line-2 px-3 py-2 text-[12px] text-muted hover:text-fg">
                Turn off
              </button>
            </>
          ) : (
            <button onClick={turnOn} disabled={busy} className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12px] font-bold text-ink disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} Turn on alerts for this phone
            </button>
          )}
        </div>
      )}
      {on && (
        <button onClick={localTest} className="mt-2 w-full rounded-lg border border-line-2 px-3 py-2 text-[12px] text-muted hover:text-fg">
          Show a test on this phone only (no internet)
        </button>
      )}
      {message && <div className={`mt-2 text-[11px] ${message.tone === 'good' ? 'text-up' : 'text-down'}`}>{message.text}</div>}
      {on && (
        <details className="mt-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-[11px] text-muted">
          <summary className="cursor-pointer font-semibold text-fg">Not seeing notifications? (Android)</summary>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 leading-relaxed">
            <li>Android <b>Settings → Apps → Chrome → Notifications</b>: turn on, including <b>Sites</b>.</li>
            <li>In Chrome: <b>⋮ → Settings → Notifications</b>: make sure <b>tembobot.ngaatendwew.workers.dev</b> is <b>Allowed</b>.</li>
            <li><b>Settings → Apps → Chrome → Battery</b>: set to <b>Unrestricted</b>. On Tecno, Infinix, itel, Xiaomi or Samsung also allow <b>Auto-start / background activity</b>.</li>
            <li>Turn off <b>Do Not Disturb</b> while testing.</li>
          </ol>
        </details>
      )}

      {status.data?.recent?.length ? (
        <div className="mt-3 border-t border-line pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Recent alerts</div>
          {status.data.recent.slice(0, 3).map((a) => (
            <div key={a.at + a.title} className="py-1 text-[11px]">
              <span className="text-faint">{timeLocal(a.at)}</span> <span className="text-fg">{a.title}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
