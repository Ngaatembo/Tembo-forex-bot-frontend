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

/**
 * POST to the backend. Only used for the Deriv *demo* endpoints, which the
 * backend itself re-validates against Tembo's current decision. Never retried
 * automatically: a demo order must not be sent twice by accident.
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const b = await res.json();
        if (b && typeof b.detail === 'string') detail = b.detail;
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
  }
}

/**
 * Fetch a backend path. `refreshMs` re-fetches in the background while the
 * tab is visible, keeping the previous data on screen until new data lands.
 * When `path` changes (e.g. another instrument), stale data from the old path
 * is cleared immediately so one market's numbers never sit under another's name.
 */
export function useApi<T>(path: string | null, opts: { refreshMs?: number } = {}) {
  const { refreshMs } = opts;
  const [data, setData] = useState<T | null>(() => {
    if (!path) return null;
    const hit = cache.get(path);
    return hit ? (hit.data as T) : null;
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const reqId = useRef(0);
  const lastPath = useRef(path);

  const load = useCallback(
    async (fresh: boolean, silent = false) => {
      if (!path) return;
      const id = ++reqId.current;
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      try {
        const d = await apiGet<T>(path, { fresh });
        if (id === reqId.current) {
          setData(d);
          setError(null);
          setUpdatedAt(Date.now());
        }
      } catch (e) {
        if (id === reqId.current) setError(e as ApiError);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    if (lastPath.current !== path) {
      lastPath.current = path;
      const hit = path ? cache.get(path) : undefined;
      setData(hit ? (hit.data as T) : null);
      setError(null);
    }
    if (!path) {
      setLoading(false);
      return;
    }
    load(false);
  }, [load, path]);

  useEffect(() => {
    if (!path || !refreshMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load(true, true);
    }, refreshMs);
    return () => clearInterval(t);
  }, [load, path, refreshMs]);

  const reload = useCallback(() => load(true), [load]);
  return { data, error, loading, reload, updatedAt };
}

/** Same as useApi, for a list of paths whose length can change (e.g. a watchlist). */
export function useApiMany<T>(paths: string[], opts: { refreshMs?: number } = {}) {
  const { refreshMs } = opts;
  const key = paths.join('|');
  const [results, setResults] = useState<Record<string, { data: T | null; error: ApiError | null }>>({});
  const [loading, setLoading] = useState(paths.length > 0);

  const load = useCallback(
    async (fresh: boolean) => {
      const list = key ? key.split('|') : [];
      setLoading(true);
      await Promise.all(
        list.map(async (p) => {
          try {
            const d = await apiGet<T>(p, { fresh });
            setResults((r) => ({ ...r, [p]: { data: d, error: null } }));
          } catch (e) {
            setResults((r) => ({ ...r, [p]: { data: r[p]?.data ?? null, error: e as ApiError } }));
          }
        }),
      );
      setLoading(false);
    },
    [key],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  return { results, loading, reload: () => load(true) };
}

export const enc = (instrument: string) => instrument.split('/').map(encodeURIComponent).join('/');
