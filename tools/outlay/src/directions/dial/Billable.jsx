import React from 'react';
import { useData } from '../../data/DataContext.jsx';
import { billable } from '../../lib/calc.js';
import { BILLING } from '../../lib/categories.js';
import { money } from '../../lib/money.js';
import { shortDate, yearOf } from '../../lib/dates.js';

export default function Billable() {
  const { expenses, clients, today, setBilling, ui } = useData();
  const year = yearOf(today);
  const B = billable(expenses, clients, year);
  const t = B.totals;
  return (
    <section id="billable" className="tone-light d-sec" aria-labelledby="d-bill-title">
      <div className="wrap">
        <div className="d-head">
          <div>
            <h2 id="d-bill-title" className="d-h2">Billable</h2>
            <p className="d-lede">
              {t.unbilled + t.invoiced > 0
                ? `${money(t.unbilled)} still needs an invoice, and ${money(t.invoiced)} is invoiced and waiting.`
                : 'Nothing is waiting on a client right now.'}
            </p>
          </div>
          <dl className="d-totals">
            <div><dt>To bill</dt><dd>{money(t.unbilled)}</dd></div>
            <div><dt>Invoiced</dt><dd>{money(t.invoiced)}</dd></div>
            <div><dt>Repaid in {year}</dt><dd>{money(t.reimbursed)}</dd></div>
          </dl>
        </div>
        {B.groups.length === 0 ? (
          <div className="d-empty"><p>No billable costs yet.</p><p className="d-lede">When you buy something for a client, switch on Billable as you log it and it shows up here.</p></div>
        ) : (
          <div className="d-panels">
            {B.groups.map((g) => (
              <article key={g.id} className="d-panel">
                <header className="d-panel-head">
                  <h3 className="d-panel-name">{g.name}</h3>
                  <span className="d-panel-open">{g.open ? `${money(g.open)} open` : 'All repaid'}</span>
                </header>
                <ul className="d-panel-list">
                  {g.list.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <button type="button" className="d-panel-item" onClick={() => ui.openEditor(e)}>
                        <span className="d-row-vendor">{e.vendor}</span>
                        <span className="d-row-meta">{shortDate(e.spent_on)}{e.notes ? `, ${e.notes}` : ''}</span>
                      </button>
                      <span className="d-panel-amt">{money(e.amount_cents)}</span>
                      <div className="seg seg-sm" role="group" aria-label={`Billing status for ${e.vendor}`}>
                        {BILLING.map((b) => <button key={b.key} type="button" aria-pressed={e.billing_status === b.key} onClick={() => setBilling(e, b.key).catch(() => {})}>{b.label}</button>)}
                      </div>
                    </li>
                  ))}
                </ul>
                {g.list.length > 5 ? <p className="d-panel-more">{g.list.length - 5} older items are in the ledger under Billable.</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
