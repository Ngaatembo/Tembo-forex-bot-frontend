import type { ApiError } from '../../lib/api';

/** A market-watch quote built only from the backend's verified /live/market (D1) data. */
export interface Quote {
  price: number | null;
  prevClose: number | null; // last completed daily close
  change: number | null;
  changePct: number | null;
  pipSize: number | null;
  displayName: string | null;
  status: string | null;
  error: ApiError | null;
}
