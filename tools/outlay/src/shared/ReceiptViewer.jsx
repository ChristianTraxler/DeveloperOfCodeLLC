import React, { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import { useData } from '../data/DataContext.jsx';
import { money } from '../lib/money.js';
import { longDate } from '../lib/dates.js';

export default function ReceiptViewer() {
  const { ui, getReceipt } = useData();
  const e = ui.receipt;
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    let made = null;
    setFile(null);
    setErr('');
    if (e) {
      getReceipt(e)
        .then((res) => {
          if (!alive) {
            if (res?.revoke) URL.revokeObjectURL(res.url);
            return;
          }
          if (!res) setErr('This receipt could not be found.');
          else {
            made = res;
            setFile(res);
          }
        })
        .catch(() => alive && setErr('This receipt could not be loaded. Try again in a moment.'));
    }
    return () => {
      alive = false;
      if (made?.revoke) URL.revokeObjectURL(made.url);
    };
  }, [e, getReceipt]);

  return (
    <Sheet open={Boolean(e)} onClose={() => ui.closeReceipt()} title="Receipt" labelledBy="receipt-sheet-title">
      {e ? <p className="field-hint">{e.vendor}, {longDate(e.spent_on)}, {money(e.amount_cents)}</p> : null}
      <div className="receipt-frame">
        {err ? <p>{err}</p> : null}
        {!err && !file ? <p className="field-hint">Loading the receipt</p> : null}
        {file && file.type === 'application/pdf' ? (
          <object data={file.url} type="application/pdf" className="receipt-pdf" aria-label="Receipt PDF">
            <a className="btn-text" href={file.url} target="_blank" rel="noreferrer">Open the PDF</a>
          </object>
        ) : null}
        {file && file.type !== 'application/pdf' ? <img src={file.url} alt={`Receipt from ${e?.vendor || 'vendor'}`} /> : null}
      </div>
    </Sheet>
  );
}
