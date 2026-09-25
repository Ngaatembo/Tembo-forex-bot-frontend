import { useEffect, useState } from 'react';
import { INSTRUMENTS } from './format';

type Instrument = (typeof INSTRUMENTS)[number];

function readParam(): string | null {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  return parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
}

/** Instrument selection stored in the URL (#/page/XAU%2FUSD) so it survives refresh and can be shared. */
export function useInstrumentParam(page: string, fallback: Instrument = 'XAU/USD'): [Instrument, (i: Instrument) => void] {
  const pick = (): Instrument => {
    const p = readParam();
    return (INSTRUMENTS as readonly string[]).includes(p ?? '') ? (p as Instrument) : fallback;
  };
  const [value, setValue] = useState<Instrument>(pick);
  useEffect(() => {
    const h = () => setValue(pick());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (i: Instrument) => {
    window.history.replaceState(null, '', `#/${page}/${encodeURIComponent(i)}`);
    setValue(i);
  };
  return [value, set];
}
