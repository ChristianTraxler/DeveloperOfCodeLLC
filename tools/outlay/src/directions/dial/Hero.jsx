import React from 'react';
import { useData } from '../../data/DataContext.jsx';
import { useOverview, useMonthPace } from '../../shared/hooks.js';
import { recurring } from '../../lib/calc.js';
import { money } from '../../lib/money.js';
import { daysBetween } from '../../lib/dates.js';
import { IconPlus } from '../../shared/Icons.jsx';

const C = 200;
const toXY = (deg, r) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];

// The month as a dial: one tick per day (past days in blued steel, today in orange)
// and an arc for this month's spending against all of last month.
function DialFace({ days, day, fraction }) {
  const ang = (d) => ((d - 0.5) / days) * 360 - 90;
  const ticks = [];
  for (let d = 1; d <= days; d += 1) {
    const major = d % 5 === 0 || d === 1;
    const [x1, y1] = toXY(ang(d), major ? 166 : 172);
    const [x2, y2] = toXY(ang(d), 183);
    const cls = ['d-tick', major ? 'is-major' : '', d < day ? 'is-past' : '', d === day ? 'is-today' : ''].join(' ');
    ticks.push(<line key={d} x1={x1} y1={y1} x2={x2} y2={y2} className={cls} />);
  }
  const numerals = [];
  for (let d = 5; d <= days; d += 5) {
    const [x, y] = toXY(ang(d), 149);
    numerals.push(<text key={d} x={x} y={y} className="d-num" textAnchor="middle" dominantBaseline="central">{d}</text>);
  }
  const r = 122;
  const f = Math.max(0, Math.min(fraction, 0.9995));
  let arc = null;
  if (f > 0) {
    const [sx, sy] = toXY(-90, r);
    const [ex, ey] = toXY(-90 + f * 360, r);
    arc = <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${ex} ${ey}`} className="d-arc" />;
  }
  const [tx, ty] = toXY(ang(day), 191);
  return (
    <svg viewBox="0 0 400 400" className="d-dial-svg" aria-hidden="true">
      <circle cx={C} cy={C} r={197} className="d-bezel" />
      {ticks}
      {numerals}
      <circle cx={C} cy={C} r={r} className="d-track" />
      {arc}
      <circle cx={tx} cy={ty} r={4.5} className="d-today" />
    </svg>
  );
}

function SubDial({ fraction, value, title, detail }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(fraction, 1));
  return (
    <div className="d-sub">
      <div className="d-sub-dial">
        <svg viewBox="0 0 76 76" aria-hidden="true">
          <circle cx="38" cy="38" r={r} className="d-sub-track" />
          {f > 0 ? <circle cx="38" cy="38" r={r} className="d-sub-arc" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 38 38)" /> : null}
        </svg>
        <span className="d-sub-value">{value}</span>
      </div>
      <p className="d-sub-text"><strong>{title}</strong><span>{detail}</span></p>
    </div>
  );
}

export default function Hero() {
  const { ui, expenses, subscriptions, today } = useData();
  const o = useOverview();
  const P = useMonthPace();
  const R = recurring(subscriptions, today);
  const fraction = P.prevTotal > 0 ? P.mtd / P.prevTotal : P.mtd > 0 ? 1 : 0;
  const month = expenses.filter((e) => e.spent_on.slice(0, 7) === today.slice(0, 7) && e.spent_on <= today);
  const withReceipt = month.filter((e) => e.receipt_path).length;
  const nextIn = R.next ? Math.max(0, daysBetween(today, R.next.next_renewal)) : null;
  return (
    <section id="overview" className="tone-light d-hero" aria-labelledby="d-hero-title">
      <div className="wrap d-hero-grid">
        <div className="d-dial">
          <div className="d-sunray" aria-hidden="true" />
          <DialFace days={P.days} day={P.day} fraction={fraction} />
          <h1 id="d-hero-title" className="d-dial-center">
            <span className="d-dial-label">Spent in {P.month}</span>
            <span className="d-dial-amount tnum">{money(P.mtd)}</span>
            <span className="d-dial-day">Day {P.day} of {P.days}</span>
          </h1>
        </div>
        <div>
          <p className="d-hero-lead">{o.compare}</p>
          {o.receipts ? <p className="d-hero-note">{o.receipts}</p> : null}
          <ul className="d-legend">
            <li><span className="d-key d-key-arc" />Arc: {P.prevTotal > 0 ? `${Math.round(fraction * 100)}% of everything spent in ${P.prevName}` : `nothing to compare in ${P.prevName}`}</li>
            <li><span className="d-key d-key-ticks" />Ticks: the days already behind you</li>
            <li><span className="d-key d-key-today" />Today</li>
          </ul>
          <div className="d-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => ui.openEditor()}><IconPlus />Log an expense</button>
            <a className="btn-text" href="#ledger">Open the ledger</a>
          </div>
          <div className="d-subdials">
            <SubDial fraction={month.length ? withReceipt / month.length : 1} value={`${withReceipt}/${month.length}`} title="Receipts on file" detail="This month" />
            <SubDial
              fraction={nextIn == null ? 0 : 1 - Math.min(nextIn, 30) / 30}
              value={nextIn == null ? 'None' : `${nextIn}d`}
              title="Next renewal"
              detail={R.next ? R.next.name : 'Nothing scheduled'}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
