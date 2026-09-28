import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '../lib/types';
import { fmtPrice } from '../lib/instruments';

export interface ChartLevel {
  price: number;
  label: string;
  kind: 'entry' | 'stop' | 'target' | 'support' | 'resistance';
}

interface Bar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

const COLORS = {
  up: '#22c77a',
  down: '#f0585d',
  grid: 'rgba(34, 50, 75, 0.45)',
  text: '#8b9bb4',
  border: '#182438',
  sma10: '#4b8df0',
  sma50: '#f2b447',
};

const LEVEL_STYLE: Record<ChartLevel['kind'], { color: string; style: LineStyle }> = {
  entry: { color: '#e7eef8', style: LineStyle.Dashed },
  stop: { color: '#f0585d', style: LineStyle.Dashed },
  target: { color: '#22c77a', style: LineStyle.Dashed },
  support: { color: 'rgba(34,199,122,0.55)', style: LineStyle.Dotted },
  resistance: { color: 'rgba(240,88,93,0.55)', style: LineStyle.Dotted },
};

function toBars(candles: Candle[]): Bar[] {
  const seen = new Set<number>();
  const out: Bar[] = [];
  for (const c of candles) {
    const t = Math.floor(new Date(c.timestamp).getTime() / 1000);
    if (!Number.isFinite(t) || seen.has(t)) continue;
    if (![c.open, c.high, c.low, c.close].every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
    seen.add(t);
    out.push({
      time: t as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: typeof c.volume === 'number' && Number.isFinite(c.volume) ? c.volume : null,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Simple moving average of closes, drawn as a chart overlay only (never used for decisions). */
function sma(bars: Bar[], period: number) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) out.push({ time: bars[i].time, value: sum / period });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function PriceChart({
  candles,
  digits,
  levels,
  showAverages,
  showLevels,
  resetKey,
}: {
  candles: Candle[];
  digits: number;
  levels: ChartLevel[];
  showAverages: boolean;
  showLevels: boolean;
  resetKey: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const sma10Series = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Series = useRef<ISeriesApi<'Line'> | null>(null);
  const volSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLines = useRef<IPriceLine[]>([]);
  const lastReset = useRef<string | null>(null);

  const bars = useMemo(() => toBars(candles), [candles]);
  const avg10 = useMemo(() => sma(bars, 10), [bars]);
  const avg50 = useMemo(() => sma(bars, 50), [bars]);
  const hasVolume = useMemo(() => bars.some((b) => (b.volume ?? 0) > 0), [bars]);
  const [hover, setHover] = useState<Bar | null>(null);

  // Create the chart once.
  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: COLORS.text,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10,
        attributionLogo: true,
      },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      rightPriceScale: { borderColor: COLORS.border, scaleMargins: { top: 0.08, bottom: 0.18 } },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const d = new Date((time as number) * 1000);
          if (type === TickMarkType.Year) return String(d.getFullYear());
          if (type === TickMarkType.Month) return d.toLocaleDateString(undefined, { month: 'short' });
          if (type === TickMarkType.DayOfMonth) return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
          return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
      },
      localization: {
        timeFormatter: (time: Time) => {
          const d = new Date((time as number) * 1000);
          return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: { axisPressedMouseMove: { time: true, price: true } },
    });
    candleSeries.current = c.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderVisible: false,
    });
    sma10Series.current = c.addSeries(LineSeries, {
      color: COLORS.sma10,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    sma50Series.current = c.addSeries(LineSeries, {
      color: COLORS.sma50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    c.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(candleSeries.current!) as Bar | undefined;
      setHover(d && p.time ? { ...d, time: p.time as UTCTimestamp, volume: null } : null);
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      candleSeries.current = null;
      sma10Series.current = null;
      sma50Series.current = null;
      volSeries.current = null;
      priceLines.current = [];
    };
  }, []);

  // Data.
  useEffect(() => {
    const c = chart.current;
    if (!c || !candleSeries.current) return;
    const minMove = Math.pow(10, -digits);
    candleSeries.current.applyOptions({ priceFormat: { type: 'price', precision: digits, minMove } });
    candleSeries.current.setData(bars.map(({ volume: _v, ...b }) => b));
    sma10Series.current?.setData(showAverages ? avg10 : []);
    sma50Series.current?.setData(showAverages ? avg50 : []);

    if (hasVolume) {
      if (!volSeries.current) {
        volSeries.current = c.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'vol',
          lastValueVisible: false,
          priceLineVisible: false,
        });
        c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
      }
      volSeries.current.setData(
        bars.map((b) => ({
          time: b.time,
          value: b.volume ?? 0,
          color: b.close >= b.open ? 'rgba(34,199,122,0.35)' : 'rgba(240,88,93,0.35)',
        })),
      );
    } else if (volSeries.current) {
      c.removeSeries(volSeries.current);
      volSeries.current = null;
    }

    if (lastReset.current !== resetKey && bars.length) {
      lastReset.current = resetKey;
      c.timeScale().fitContent();
    }
  }, [bars, avg10, avg50, hasVolume, digits, showAverages, resetKey]);

  // Trade-plan and key-level lines.
  useEffect(() => {
    const s = candleSeries.current;
    if (!s) return;
    priceLines.current.forEach((l) => s.removePriceLine(l));
    priceLines.current = levels
      .filter((l) => Number.isFinite(l.price) && (showLevels || l.kind === 'entry' || l.kind === 'stop' || l.kind === 'target'))
      .map((l) =>
        s.createPriceLine({
          price: l.price,
          color: LEVEL_STYLE[l.kind].color,
          lineStyle: LEVEL_STYLE[l.kind].style,
          lineWidth: 1,
          axisLabelVisible: l.kind === 'entry' || l.kind === 'stop' || l.kind === 'target',
          title: l.label,
        }),
      );
  }, [levels, showLevels, bars]);

  const last = bars[bars.length - 1];
  const shown = hover ?? last;
  const prev = shown ? bars[bars.findIndex((b) => b.time === shown.time) - 1] : undefined;
  const chg = shown && prev ? shown.close - prev.close : null;
  const a10 = avg10[avg10.length - 1]?.value;
  const a50 = avg50[avg50.length - 1]?.value;

  return (
    <div className="absolute inset-0">
      <div ref={el} className="absolute inset-0" />
      {shown && (
        <div className="pointer-events-none absolute left-2 top-1.5 z-10 space-y-0.5 text-[10px] leading-tight">
          <div className="num flex flex-wrap gap-x-2 text-muted">
            <span>O <span className="text-fg">{fmtPrice(shown.open, digits)}</span></span>
            <span>H <span className="text-fg">{fmtPrice(shown.high, digits)}</span></span>
            <span>L <span className="text-fg">{fmtPrice(shown.low, digits)}</span></span>
            <span>C <span className="text-fg">{fmtPrice(shown.close, digits)}</span></span>
            {chg != null && (
              <span className={chg >= 0 ? 'text-up' : 'text-down'}>
                {chg >= 0 ? '+' : ''}
                {fmtPrice(chg, digits)}
              </span>
            )}
          </div>
          {showAverages && (
            <div className="num flex gap-x-3">
              <span style={{ color: COLORS.sma10 }}>SMA 10 {a10 != null ? fmtPrice(a10, digits) : '—'}</span>
              <span style={{ color: COLORS.sma50 }}>SMA 50 {a50 != null ? fmtPrice(a50, digits) : '—'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
