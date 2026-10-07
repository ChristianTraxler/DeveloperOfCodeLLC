import React from 'react';
import { useData } from '../../data/DataContext.jsx';
import { useLedger } from '../../shared/hooks.js';
import { CATEGORIES, categoryOf } from '../../lib/categories.js';
import { money } from '../../lib/money.js';
import { monthYear, dayNum, longDate } from '../../lib/dates.js';
import { IconSearch, IconClip } from '../../shared/Icons.jsx';

const KINDS = [['all', 'All'], ['billable', 'Billable'], ['missing', 'No receipt']];

function Row({ e }) {
  const { ui, clientName } = useData();
  const c = categoryOf(e.category);
  const client = e.is_billable ? clientName(e.client_id) : '';
  return (
    <li>
      <button type="button" className="d-row" onClick={() => ui.openEditor(e)}>
        <span className="d-window" aria-hidden="true">{String(dayNum(e.spent_on)).padStart(2, '0')}</span>
        <span className="d-row-main">
          <span className="d-row-vendor">{e.vendor}<span className="sr-only">, {longDate(e.spent_on)}</span></span>
          <span className="d-row-meta">{c.label}{e.is_billable ? <><span className="d-dot" aria-hidden="true" />{client ? `Bill to ${client}` : 'Billable'}</> : null}</span>
        </span>
        <span className="d-row-end">
          <span className="d-row-amt">{money(e.amount_cents)}</span>
          {e.receipt_path ? <span className="d-row-rcpt"><IconClip width={13} height={13} />Receipt</span> : <span className="d-row-rcpt is-missing">No receipt</span>}
        </span>
      </button>
    </li>
  );
}

export default function Ledger() {
  const { ui, expenses } = useData();
  const L = useLedger(40);
  return (
    <section id="ledger" className="tone-white d-sec" aria-labelledby="d-ledger-title">
      <div className="wrap">
        <div className="d-head">
          <div>
            <h2 id="d-ledger-title" className="d-h2">Ledger</h2>
            <p className="d-lede">Every expense, newest first. Tap one to edit it or attach the receipt.</p>
          </div>
          <div className="d-controls">
            <label className="d-search">
              <span className="sr-only">Search the ledger</span>
              <IconSearch width={18} height={18} />
              <input className="input" type="search" placeholder="Search vendor or note" value={L.filter.q} onChange={(ev) => L.patch({ q: ev.target.value })} />
            </label>
            {KINDS.map(([k, label]) => <button key={k} type="button" className="chip" aria-pressed={L.filter.kind === k} onClick={() => L.patch({ kind: k })}>{label}</button>)}
            <label className="sr-only" htmlFor="d-cat">Category</label>
            <select id="d-cat" className="input" value={L.filter.category} onChange={(ev) => L.patch({ category: ev.target.value })}>
              <option value="">Every category</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <p className="d-count" aria-live="polite">
          {L.filtered.length === expenses.length ? `${expenses.length} entries` : `${L.filtered.length} of ${expenses.length} entries`}
          {L.active ? <button type="button" className="btn-text" onClick={L.clear}>Clear filters</button> : null}
        </p>
        {expenses.length === 0 ? (
          <div className="d-empty"><p>Nothing logged yet.</p><button type="button" className="btn btn-primary" onClick={() => ui.openEditor()}>Log the first expense</button></div>
        ) : L.groups.length === 0 ? (
          <div className="d-empty"><p>Nothing matches those filters.</p><button type="button" className="btn btn-quiet" onClick={L.clear}>Clear filters</button></div>
        ) : (
          L.groups.map((g) => (
            <div key={g.key} className="d-month">
              <div className="d-month-head">
                <h3 className="d-month-name">{monthYear(g.key)}</h3>
                <span className="d-month-total">{money(g.total)}</span>
              </div>
              <ul className="d-rows">{g.list.map((e) => <Row key={e.id} e={e} />)}</ul>
            </div>
          ))
        )}
        {L.more > 0 ? <button type="button" className="btn btn-quiet d-more" onClick={L.showMore}>Show {Math.min(40, L.more)} more</button> : null}
      </div>
    </section>
  );
}
