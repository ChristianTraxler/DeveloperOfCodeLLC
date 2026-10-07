import React, { useMemo, useState } from 'react';
import { useData } from '../../data/DataContext.jsx';
import { taxYear } from '../../lib/calc.js';
import { money } from '../../lib/money.js';
import { yearOf, QUARTER_LABEL } from '../../lib/dates.js';
import { expensesCsv, taxSummaryCsv } from '../../lib/csv.js';
import { saveTextFile } from '../../lib/files.js';
import { scrollToId } from '../../shared/hooks.js';
import { IconDownload } from '../../shared/Icons.jsx';

export default function Taxes() {
  const { expenses, clients, today, ui, notify } = useData();
  const years = useMemo(() => {
    const set = new Set(expenses.map((e) => yearOf(e.spent_on)));
    set.add(yearOf(today));
    return [...set].sort((a, b) => b - a);
  }, [expenses, today]);
  const [year, setYear] = useState(yearOf(today));
  const [busy, setBusy] = useState(false);
  const T = useMemo(() => taxYear(expenses, year), [expenses, year]);
  const missing = T.count - T.withReceipt;

  async function exportCsv() {
    if (!T.count) {
      notify(`No expenses logged for ${year} yet.`, 'error');
      return;
    }
    setBusy(true);
    const result = await saveTextFile(`outlay-expenses-${year}.csv`, expensesCsv(T.list, clients));
    setBusy(false);
    if (result === 'saved') notify(`Exported ${T.count} expenses for ${year}.`);
    else if (result === 'failed') notify('The file could not be saved here. Export again from your own domain.', 'error');
  }

  async function exportSummary() {
    if (!T.count) {
      notify(`No expenses logged for ${year} yet.`, 'error');
      return;
    }
    setBusy(true);
    const result = await saveTextFile(`outlay-schedule-c-${year}.csv`, taxSummaryCsv(T, year));
    setBusy(false);
    if (result === 'saved') notify(`Exported the ${year} Schedule C summary.`);
    else if (result === 'failed') notify('The file could not be saved here. Export again from your own domain.', 'error');
  }

  return (
    <section id="taxes" className="tone-white d-sec" aria-labelledby="d-tax-title">
      <div className="wrap">
        <div className="d-head">
          <div>
            <h2 id="d-tax-title" className="d-h2">Tax year {year}</h2>
            <p className="d-lede"><span className="tnum">{money(T.deductible)}</span> deductible so far, out of <span className="tnum">{money(T.total)}</span> spent.</p>
          </div>
          <div className="d-tax-actions">
            {years.length > 1 ? (
              <>
                <label className="sr-only" htmlFor="d-year">Tax year</label>
                <select id="d-year" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
              </>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={busy}><IconDownload />{busy ? 'Preparing the file' : `Export ${year} as CSV`}</button>
            <button type="button" className="btn btn-quiet" onClick={exportSummary} disabled={busy}><IconDownload />Schedule C summary</button>
          </div>
        </div>
        {T.count === 0 ? (
          <div className="d-empty"><p>Nothing logged for {year}.</p></div>
        ) : (
          <>
            <div className="d-table-box">
              <table className="d-table">
                <caption className="sr-only">Schedule C expense lines for {year}</caption>
                <thead><tr><th scope="col">Line</th><th scope="col">Expense</th><th scope="col" className="num">Spent</th><th scope="col" className="num">Deductible</th></tr></thead>
                <tbody>
                  {T.rows.map((r) => (
                    <tr key={r.line}>
                      <td><span className="d-index">{r.line}</span></td>
                      <td><span className="d-tline">{r.label}</span><span className="d-tcats">{r.cats.join(', ')}</span></td>
                      <td className="num">{money(r.cents)}</td>
                      <td className="num">{money(r.deductible)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td /><th scope="row">Total</th><td className="num">{money(T.total)}</td><td className="num">{money(T.deductible)}</td></tr></tfoot>
              </table>
            </div>
            <div className="d-quarters">
              {T.quarters.map((q) => <div key={q.q}><p className="d-label">{QUARTER_LABEL[q.q]}</p><p className="d-q">{money(q.cents)}</p></div>)}
            </div>
            <p className="d-receipts">
              Receipts on file for {T.withReceipt} of {T.count} expenses.
              {missing > 0 ? <> <button type="button" className="btn-text" onClick={() => { ui.setFilter({ q: '', kind: 'missing', category: '' }); scrollToId('ledger'); }}>Show the {missing} without one</button></> : null}
            </p>
            <p className="d-fine">Lines follow the usual Schedule C mapping for a single-member LLC, with business meals counted at 50%. Confirm the final numbers with your tax preparer.</p>
          </>
        )}
      </div>
    </section>
  );
}
