import React, { useMemo, useState } from 'react';
import { useData } from '../../data/DataContext.jsx';
import { incomeYear } from '../../lib/calc.js';
import { sourceLabel } from '../../lib/csv.js';
import { money } from '../../lib/money.js';
import { monthYear, dayNum, longDate, yearOf, monthKey } from '../../lib/dates.js';
import { IconPlus, IconClip } from '../../shared/Icons.jsx';

function Row({ i }) {
  const { ui, clientName } = useData();
  const client = clientName(i.client_id);
  return (
    <li>
      <button type="button" className="d-row" onClick={() => ui.openIncome(i)}>
        <span className="d-window" aria-hidden="true">{String(dayNum(i.received_on)).padStart(2, '0')}</span>
        <span className="d-row-main">
          <span className="d-row-vendor">{i.payer}<span className="sr-only">, {longDate(i.received_on)}</span></span>
          <span className="d-row-meta">{sourceLabel(i.source)}{client && client !== i.payer ? <><span className="d-dot" aria-hidden="true" />{client}</> : null}</span>
        </span>
        <span className="d-row-end">
          <span className="d-row-amt">{money(i.amount_cents)}</span>
          {i.document_path ? <span className="d-row-rcpt"><IconClip width={13} height={13} />Document</span> : null}
        </span>
      </button>
    </li>
  );
}

export default function Income() {
  const { ui, income, incomeMissing, today } = useData();
  const years = useMemo(() => {
    const set = new Set(income.map((i) => yearOf(i.received_on)));
    set.add(yearOf(today));
    return [...set].sort((a, b) => b - a);
  }, [income, today]);
  const [year, setYear] = useState(yearOf(today));
  const I = useMemo(() => incomeYear(income, year), [income, year]);
  const groups = useMemo(() => {
    const out = [];
    for (const i of I.list) {
      const k = monthKey(i.received_on);
      const last = out[out.length - 1];
      if (last && last.key === k) {
        last.list.push(i);
        last.total += i.amount_cents;
      } else out.push({ key: k, total: i.amount_cents, list: [i] });
    }
    return out;
  }, [I.list]);

  return (
    <section id="income" className="tone-light d-sec" aria-labelledby="d-income-title">
      <div className="wrap">
        <div className="d-head">
          <div>
            <h2 id="d-income-title" className="d-h2">Income</h2>
            <p className="d-lede">
              <span className="tnum">{money(I.total)}</span> received in {year}, counted on the day it landed. This is the gross receipts line of your Schedule C.
            </p>
          </div>
          <div className="d-tax-actions">
            {years.length > 1 ? (
              <>
                <label className="sr-only" htmlFor="d-income-year">Income year</label>
                <select id="d-income-year" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
              </>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => ui.openIncome()}><IconPlus />Log income</button>
          </div>
        </div>
        {incomeMissing ? (
          <div className="d-empty"><p>Income is not set up in the database yet. Run supabase/outlay-income.sql in the Supabase SQL editor, then reload.</p></div>
        ) : I.count === 0 ? (
          <div className="d-empty"><p>No income logged for {year}.</p><button type="button" className="btn btn-primary" onClick={() => ui.openIncome()}>Log the first payment</button></div>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="d-month">
              <div className="d-month-head">
                <h3 className="d-month-name">{monthYear(g.key)}</h3>
                <span className="d-month-total">{money(g.total)}</span>
              </div>
              <ul className="d-rows">{g.list.map((i) => <Row key={i.id} i={i} />)}</ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
