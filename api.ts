import { useCallback, useEffect, useRef, useState } from 'react';

// The backend URL. Set VITE_API_BASE_URL in Vercel (or .env.local) to override.
// This is a public URL, not a secret: no API keys ever live in the frontend.
export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://tembo-forex-bot.onrender.com'
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public kind: 'network' | 'timeout' | 'http',
  ) {
    super(message);
  }
}

// Render's free tier sleeps after inactivity; the first request can take
// ~30-60s while it wakes. We allow a long timeout and retry network failures.
const TIMEOUT_MS = 70_000;
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

// Tracks whether the backend is currently waking up so the UI can say so.
type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();
let pendingSlow = 0;
function setSlow(delta: number) {
  pendingSlow += delta;
  wakeListeners.forEach((l) => l(pendingSlow > 0));
}
export function onWakeChange(l: WakeListener) {
  wakeListeners.add(l);
  return () => {
    wakeListeners.delete(l);
  };
}

async function rawGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // If a request is still pending after 4s, assume the server is waking.
  let markedSlow = false;
  const slowTimer = setTimeout(() => {
    markedSlow = true;
    setSlow(1);
  }, 4000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body && typeof body.detail === 'string') detail = body.detail;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(detail, res.status, 'http');
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError('The server took too long to respond.', null, 'timeout');
    throw new ApiError('Could not reach the Tembo backend.', null, 'network');
  } finally {
    clearTimeout(timer);
    clearTimeout(slowTimer);
    if (markedSlow) setSlow(-1);
  }
}

export async function apiGet<T>(path: string, { fresh = false } = {}): Promise<T> {
  const hit = cache.get(path);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as T;
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await rawGet<T>(path);
        cache.set(path, { at: Date.now(), data });
        return data;
      } catch (e) {
        lastErr = e;
        // Only retry network-level failures (cold start / flaky mobile data).
        if (!(e instanceof ApiError) || e.kind === 'http') break;
        await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      }
    }
    throw lastErr;
  })();
  inflight.set(path, p);
  try {
    return await p;
  } finally {
    inflight.delete(path);
  }
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(() => {
    if (!path) return null;
    const hit = cache.get(path);
    return hit ? (hit.data as T) : null;
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const reqId = useRef(0);

  const load = useCallback(
    async (fresh: boolean) => {
      if (!path) return;
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const d = await apiGet<T>(path, { fresh });
        if (id === reqId.current) setData(d);
      } catch (e) {
        if (id === reqId.current) setError(e as ApiError);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  return { data, error, loading, reload };
}

export const enc = (instrument: string) => instrument.split('/').map(encodeURIComponent).join('/');
