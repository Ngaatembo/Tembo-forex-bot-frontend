import { ChevronRight, Trophy } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { ShadowResults } from '../../pages/Results';
import { VERDICT, rText } from '../../pages/Results';
import { Chip, IconTile, Panel } from './common';

/** Compact running score for the dashboard rail; the full list lives on the Results page. */
export function ScoreboardCard() {
  const res = useApi<ShadowResults>('/shadow/results', { refreshMs: 300_000 });
  const d = res.data;
  return (
    <Panel
      title="Results so far"
      icon={
        <IconTile tone="info">
          <Trophy className="h-3.5 w-3.5" />
        </IconTile>
      }
      right={<Chip tone="muted">Paper only</Chip>}
      bodyClass="px-3 pb-3 pt-2 sm:px-4"
    >
      {!d ? (
        <div className="text-[12px] text-faint">{res.error ? 'Scoreboard unavailable right now.' : 'Loading…'}</div>
      ) : (
        <>
          <div className="divide-y divide-line">
            {d.setups.map((s) => {
              const v = VERDICT[s.verdict.state];
              return (
                <div key={s.setup_id} className="flex items-center justify-between gap-2 py-1.5 text-[12px]">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-fg">
                      {s.instrument} {s.timeframe.toUpperCase()}
                      {s.open_trade && <span className="ml-1.5 text-[10px] font-semibold text-info">OPEN {s.open_trade.direction}</span>}
                    </div>
                    <div className="text-[11px] text-faint">
                      {s.score.trades >= s.verdict.target ? s.score.trades : `${s.score.trades}/${s.verdict.target}`} trades · {v.label}
                    </div>
                  </div>
                  <span className={`num font-semibold ${s.score.net_r > 0 ? 'text-up' : s.score.net_r < 0 ? 'text-down' : 'text-muted'}`}>
                    {rText(s.score.net_r)}
                  </span>
                </div>
              );
            })}
          </div>
          <a
            href="#/results"
            className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-line-2 px-3 py-1.5 text-[12px] text-muted hover:text-fg"
          >
            See every trade <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </>
      )}
    </Panel>
  );
}
