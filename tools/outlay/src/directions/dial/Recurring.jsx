import React from 'react';
import { useData } from '../../data/DataContext.jsx';
import { recurring } from '../../lib/calc.js';
import { categoryOf, cadenceOf } from '../../lib/categories.js';
import { money } from '../../lib/money.js';
import { relativeDays, daysBetween, dayNum, monthShort } from '../../lib/dates.js';
import { IconPlus } from '../../shared/Icons.jsx';

function CalRow({ s }) {
  const { ui, today, logCharge } = useData();
  const cad = cadenceOf(s.cadence);
  const days = daysBetween(today, s.next_renewal);
  const cls = ['d-cal-row', !s.active ? 'is-paused' : days <= 7 ? 'is-soon' : ''].join(' ');
  return (
    <li className={cls}>
      <span className="d-cal-window" aria-hidden="true"><b>{String(dayNum(s.next_renewal)).padStart(2, '0')}</b><small>{monthShort(s.next_renewal)}</small></span>
      <button type="button" className="d-cal-main" onClick={() => ui.openSub(s)}>
        <span className="d-cal-name">{s.name}</span>
        <span className="d-cal-meta">{s.active ? `${cad.label}, ${categoryOf(s.category).short}, renews ${relativeDays(today, s.next_renewal)}` : 'Paused'}</span>
      </button>
      <span className="d-cal-amt">{money(s.amount_cents)}<small>{cad.per}</small></span>
      {s.active ? <button type="button" className="btn btn-quiet btn-sm d-cal-log" onClick={() => logCharge(s).catch(() => {})}>Log this charge</button> : null}
    </li>
  );
}

export default function Recurring() {
  const { subscriptions, today, ui } = useData();
  const R = recurring(subscriptions, today);
  return (
    <section id="recurring" className="tone-dark d-sec" aria-labelledby="d-rec-title">
      <div className="wrap">
        <div className="d-head">
          <div>
            <h2 id="d-rec-title" className="d-rec-title">
              {R.monthly > 0 ? <>Every month, <span className="tnum">{money(R.monthly)}</span> renews on its own.</> : 'Nothing renews on its own yet.'}
            </h2>
            <p className="d-lede">
              {R.active.length} active {R.active.length === 1 ? 'subscription' : 'subscriptions'}, {money(R.yearly)} a year.
              {R.next ? ` Next up: ${R.next.name}, ${relativeDays(today, R.next.next_renewal)}.` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-quiet" onClick={() => ui.openSub()}><IconPlus width={18} height={18} />Add a subscription</button>
        </div>
        {R.active.length === 0
          ? <p className="d-lede">Add the tools you pay for every month and Outlay keeps the renewal dates for you.</p>
          : <ul className="d-cal">{R.active.map((s) => <CalRow key={s.id} s={s} />)}</ul>}
        {R.paused.length ? (
          <>
            <h3 className="d-label">Paused</h3>
            <ul className="d-cal">{R.paused.map((s) => <CalRow key={s.id} s={s} />)}</ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
