import snapshot from '../data/researchSnapshot.json';
import { money, num, shortDate } from '../lib/format';
import { Card, Notice } from './ui';

const exp = snapshot.experiment_3b;

function pfClass(pf: number) {
  return pf >= 1.1 ? 'text-up' : pf >= 1 ? 'text-warn' : 'text-down';
}

/** Latest gold result: realistic costs on 2012–2022, then a frozen test on unseen 2024–2026 data. */
export default function Experiment3B() {
  const halves = Object.entries(exp.half_years_b40);
  const maxAbs = Math.max(...halves.map(([, v]) => Math.abs(v.net_pnl)));
  return (
    <Card title="Latest: gold on unseen 2024–2026 data" subtitle={`${exp.title} · run ${shortDate(exp.run_date)}`}>
      <Notice tone="warn">{exp.verdict}</Notice>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
              <th className="py-2 pr-2 font-medium">Strategy</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">2012–22 old cost</th>
              <th className="px-2 py-2 text-right font-medium">2012–22 real cost</th>
              <th className="px-2 py-2 text-right font-medium">2024–26 unseen</th>
              <th className="hidden py-2 pl-2 text-right font-medium sm:table-cell">Trades</th>
            </tr>
          </thead>
          <tbody className="num whitespace-nowrap">
            {exp.rows.map((r) => (
              <tr key={r.strategy} className="border-t border-line">
                <td className="py-2.5 pr-2 font-sans font-medium">{r.strategy}</td>
                <td className="hidden px-2 py-2.5 text-right text-muted sm:table-cell">{num(r.hist_old_cost_pf)}</td>
                <td className={`px-2 py-2.5 text-right ${pfClass(r.hist_real_cost_pf)}`}>{num(r.hist_real_cost_pf)}</td>
                <td className={`px-2 py-2.5 text-right font-medium ${pfClass(r.fwd_real_cost_pf)}`}>{num(r.fwd_real_cost_pf)}</td>
                <td className="hidden py-2.5 pl-2 text-right sm:table-cell">{r.fwd_trades}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-[11px] text-faint">Profit factor: above 1.0 made money after costs.</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-faint">Breakout 40 by half-year (2024–26)</div>
          <ul className="mt-2 space-y-1.5">
            {halves.map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-xs">
                <span className="num w-16 shrink-0 text-muted">{k}</span>
                <div className="relative h-2 flex-1 rounded-full bg-panel-2">
                  <div
                    className={`absolute top-0 h-2 rounded-full ${v.net_pnl >= 0 ? 'bg-up' : 'bg-down'}`}
                    style={{ width: `${(Math.abs(v.net_pnl) / maxAbs) * 100}%` }}
                  />
                </div>
                <span className={`num w-20 shrink-0 text-right ${v.net_pnl >= 0 ? 'text-up' : 'text-down'}`}>{money(v.net_pnl, { sign: true })}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-faint">If each trade risked 1% of the account</div>
          <ul className="mt-2 space-y-2 text-xs">
            {exp.rows.map((r) => (
              <li key={r.strategy} className="flex justify-between gap-2">
                <span className="text-muted">{r.strategy}</span>
                <span className="num text-right">
                  <span className="text-up">{r.fwd_1pct_annual}%/yr</span> · <span className="text-down">−{r.fwd_1pct_maxdd}% worst dip</span>
                </span>
              </li>
            ))}
            <li className="pt-1 text-[11px] leading-relaxed text-faint">
              2012–22 at the same risk: about {exp.rows[1].hist_1pct_annual}% a year with a worst dip of {exp.rows[1].hist_1pct_maxdd}% (Breakout 40).
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        {exp.cost_note} Long trades carried the result (profit factor {exp.rows[1].fwd_long_pf}); short trades lost ({exp.rows[1].fwd_short_pf}). The five best trades made almost all
        the profit. Past results do not guarantee future profit.
      </p>
    </Card>
  );
}
