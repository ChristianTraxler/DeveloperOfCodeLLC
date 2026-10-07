import React, { useState } from 'react';
import { useSpending, PERIODS } from '../../shared/hooks.js';
import { money, pct } from '../../lib/money.js';
import { monthYear, monthShort } from '../../lib/dates.js';

// Steel, ice and silver tones for the category bezel.
const TONES = ['188 211 242', '122 160 224', '74 111 194', '220 224 229', '150 160 173', '98 130 190', '236 240 245', '112 120 132'];
const C = 100;
const R = 78;
const xy = (deg) => [C + R * Math.cos((deg * Math.PI) / 180), C + R * Math.sin((deg * Math.PI) / 180)];

function Bezel({ rows, total, count }) {
  let a = -90;
  const segs = rows.map((row, i) => {
    const sweep = (row.cents / total) * 360;
    const pad = sweep > 4 ? 1 : 0;
    const s = a + pad;
    const e = a + Math.min(sweep, 359.4) - pad;
    a += sweep;
    const [x1, y1] = xy(s);
    const [x2, y2] = xy(e);
    return <path key={row.key} d={`M ${x1} ${y1} A ${R} ${R} 0 ${e - s > 180 ? 1 : 0} 1 ${x2} ${y2}`} stroke={`rgb(${TONES[i % TONES.length]})`} />;
  });
  return (
    <div className="d-ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx={C} cy={C} r={R} className="d-ring-track" />
        <g className="d-ring-segs">{segs}</g>
      </svg>
      <div className="d-ring-center"><span className="d-ring-n">{count}</span><span className="d-ring-l">{count === 1 ? 'category' : 'categories'}</span></div>
    </div>
  );
}

export default function Spending() {
  const [period, setPeriod] = useState('month');
  const S = useSpending(period);
  const tmax = Math.max(1, ...S.trend.map((t) => t.cents));
  const count = new Set(S.list.map((e) => e.category)).size;
  return (
    <section id="spending" className="tone-dark d-sec" aria-labelledby="d-spend-title">
      <div className="wrap d-spend">
        <div>
          <h2 id="d-spend-title" className="d-h2">Where it went</h2>
          <div className="seg d-period" role="group" aria-label="Period">
            {PERIODS.map(([k, label]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{label}</button>)}
          </div>
          <p className="d-big tnum">{money(S.total)}</p>
          <p className="d-lede">across {S.list.length} {S.list.length === 1 ? 'expense' : 'expenses'} {S.phrase}</p>
        </div>
        <div>
          {S.rows.length === 0 ? <p className="d-lede">Nothing logged for this stretch yet.</p> : (
            <div className="d-ring-wrap">
              <Bezel rows={S.rows} total={S.total} count={count} />
              <ul className="d-keys">
                {S.rows.map((r, i) => (
                  <li key={r.key}>
                    <span className="d-sw" style={{ background: `rgb(${TONES[i % TONES.length]})` }} />
                    <span>{r.cat.label}</span>
                    <span className="d-keys-amt">{money(r.cents)}</span>
                    <span className="d-keys-pct tnum">{pct(r.cents, S.total)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="d-trend">
            <h3 className="d-label">The last twelve months</h3>
            <ol className="d-bars">
              {S.trend.map((t, i) => (
                <li key={t.key} className={i === S.trend.length - 1 ? 'is-now' : undefined}>
                  <span className="d-bar-box"><span className="d-bar" style={{ height: `${Math.max(4, (t.cents / tmax) * 100)}%` }} /></span>
                  <span className="d-bar-m" aria-hidden="true">{monthShort(t.key).slice(0, 1)}</span>
                  <span className="sr-only">{monthYear(t.key)}: {money(t.cents)}</span>
                </li>
              ))}
            </ol>
            <p className="d-trend-note">Busiest month: {monthYear(S.peak.key)}, {money(S.peak.cents)}. Average {money(S.avg)} a month.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
