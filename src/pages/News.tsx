import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useApi } from '../lib/api';
import type { Calendar, DataStatus, NewsFeed } from '../lib/types';
import { dateTime, humanize, relTime } from '../lib/format';
import { Card, Empty, ErrorBlock, LoadingBlock, Notice, PageHeader, Pill, RefreshButton, Segmented } from '../components/ui';

const CURRENCIES = ['All', 'USD', 'EUR', 'GBP'] as const;

export default function News() {
  const [cur, setCur] = useState<(typeof CURRENCIES)[number]>('All');
  const [showPast, setShowPast] = useState(false);
  const cal = useApi<Calendar>(cur === 'All' ? '/calendar' : `/calendar/${cur}`);
  const news = useApi<NewsFeed>('/news');
  const status = useApi<DataStatus>('/system/data-status');

  const now = Date.now();
  const events = (cal.data?.events ?? [])
    .filter((e) => (showPast ? true : new Date(e.timestamp).getTime() >= now - 3600_000))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div>
      <PageHeader
        title="News & calendar"
        action={
          <RefreshButton
            onClick={() => {
              cal.reload();
              news.reload();
              status.reload();
            }}
            loading={cal.loading || news.loading}
          />
        }
      >
        High-impact events the macro safety gate watches, plus market headlines when a news provider is connected.
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Economic calendar"
          subtitle={cal.data?.status ? `Source: ${humanize(cal.data.status)}` : undefined}
          className="lg:col-span-2"
          action={
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="accent-[#e5b64a]" />
              Show past
            </label>
          }
        >
          <Segmented options={CURRENCIES} value={cur} onChange={setCur} />
          <div className="mt-4">
            {cal.loading && !cal.data ? (
              <LoadingBlock rows={5} />
            ) : cal.error && !cal.data ? (
              <ErrorBlock error={cal.error} onRetry={cal.reload} />
            ) : cal.data?.status === 'UNAVAILABLE' ? (
              <Notice>Calendar unavailable. {cal.data.error}</Notice>
            ) : events.length === 0 ? (
              <Empty title={showPast ? 'No events' : 'No upcoming events'}>{!showPast && 'Tick “Show past” to see earlier ones.'}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {events.map((e) => {
                  const past = new Date(e.timestamp).getTime() < now;
                  return (
                    <li key={e.event_id} className={`flex items-start gap-3 py-3 ${past ? 'opacity-55' : ''}`}>
                      <div className="w-14 shrink-0 text-center">
                        <div className="num text-lg font-semibold leading-none">{new Date(e.timestamp).getDate()}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-faint">
                          {new Date(e.timestamp).toLocaleDateString(undefined, { month: 'short' })}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{e.event_name}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {dateTime(e.timestamp)}
                          {!e.time_confirmed && ' · time not confirmed'} · {relTime(e.timestamp)}
                        </div>
                        {(e.forecast != null || e.previous != null || e.actual != null) && (
                          <div className="num mt-1 text-[11px] text-faint">
                            {e.actual != null && `Actual ${e.actual} · `}
                            {e.forecast != null && `Forecast ${e.forecast} · `}
                            {e.previous != null && `Previous ${e.previous}`}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Pill tone={e.importance?.toUpperCase() === 'HIGH' ? 'warn' : 'muted'}>{e.currency}</Pill>
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-gold">
                            Source <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card title="Headlines" subtitle={news.data ? `${humanize(news.data.provider)} · ${humanize(news.data.freshness)}` : undefined}>
            {news.loading && !news.data ? (
              <LoadingBlock rows={4} />
            ) : news.error && !news.data ? (
              <ErrorBlock error={news.error} onRetry={news.reload} />
            ) : news.data?.error ? (
              <Notice tone="bad">{news.data.error}</Notice>
            ) : !news.data?.items.length ? (
              <Empty title="No headlines">
                {news.data?.status === 'DEMO' ? 'The backend news provider is in demo mode. Connect Finnhub on Render to see real headlines.' : 'Nothing relevant right now.'}
              </Empty>
            ) : (
              <ul className="space-y-4">
                {news.data.items.slice(0, 12).map((n) => (
                  <li key={n.news_id}>
                    <a href={n.url ?? undefined} target="_blank" rel="noreferrer" className="group block">
                      <div className="text-sm font-medium leading-snug group-hover:text-gold">{n.headline}</div>
                      <div className="mt-1 text-[11px] text-faint">
                        {n.source} · {relTime(n.timestamp)}
                        {n.relevant_instruments.length > 0 && ` · ${n.relevant_instruments.join(', ')}`}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Data sources">
            {status.loading && !status.data ? (
              <LoadingBlock rows={3} />
            ) : status.error && !status.data ? (
              <ErrorBlock error={status.error} onRetry={status.reload} />
            ) : status.data ? (
              <ul className="space-y-2.5 text-sm">
                {(
                  [
                    ['Market data', status.data.market_data],
                    ['News', status.data.news],
                    ['Calendar', status.data.economic_calendar],
                  ] as const
                ).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <div>
                      <div>{k}</div>
                      <div className="text-[11px] text-faint">{humanize(v.provider)}</div>
                    </div>
                    {v.provider === 'static_central_banks' ? (
                      <Pill tone="good">Static official</Pill>
                    ) : (
                      <Pill status={v.status}>{humanize(v.status)}</Pill>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
