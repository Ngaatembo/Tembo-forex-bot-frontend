import { apiGet, apiPost } from './api';

export type AlertState = 'unsupported' | 'blocked' | 'off' | 'on' | 'needs-install';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function alertState(): Promise<AlertState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await currentSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Ask permission, subscribe this browser and register it with the backend. */
export async function enableAlerts(): Promise<void> {
  if (!pushSupported()) throw new Error('This browser cannot receive notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. Allow them for this site in your browser settings.');
  const reg = await registration();
  const { public_key } = await apiGet<{ public_key: string }>('/alerts/public-key', { fresh: true });
  const key = urlBase64ToUint8Array(public_key);
  let sub = await reg.pushManager.getSubscription();
  // If the server key changed, the old subscription cannot be used.
  const current = sub?.options?.applicationServerKey;
  if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))) !== btoa(String.fromCharCode(...key))) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await apiPost('/alerts/subscribe', sub.toJSON());
}

export async function disableAlerts(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await apiPost('/alerts/unsubscribe', { endpoint }).catch(() => undefined);
}

export async function sendTestAlert(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Alerts are not on for this phone yet.');
  await apiPost('/alerts/test', { endpoint: sub.endpoint });
}

/** Keep the backend in sync (e.g. after the browser rotated the subscription). */
export async function resyncAlerts(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await apiPost('/alerts/subscribe', sub.toJSON()).catch(() => undefined);
}

/** Show a notification directly on this device (no server, no push service). */
export async function showLocalTestNotification(): Promise<void> {
  if (!pushSupported()) throw new Error('This browser cannot show notifications.');
  if (Notification.permission !== 'granted') throw new Error('Notifications are not allowed for this site yet.');
  const reg = await registration();
  await reg.showNotification('Tembo phone test', {
    body: 'If you can see this, your phone shows Tembo notifications.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'tembo-local-test',
  });
}
