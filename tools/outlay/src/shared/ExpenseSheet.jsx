import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import { useData } from '../data/DataContext.jsx';
import { CATEGORIES, categoryOf, PAYMENT_METHODS, BILLING } from '../lib/categories.js';
import { parseMoney, centsToInput } from '../lib/money.js';
import { prepareReceipt } from '../lib/files.js';
import { IconClip, IconCamera } from './Icons.jsx';

const blank = (today) => ({
  amount: '', vendor: '', spent_on: today, category: 'software', payment_method: 'Business card', notes: '',
  is_billable: false, client_id: '', new_client: '', billing_status: 'unbilled',
});

export default function ExpenseSheet() {
  const { ui, today, clients, expenses, saveExpense, deleteExpense, addClient } = useData();
  const open = Boolean(ui.editor);
  const editing = ui.editor?.expense || null;
  const [f, setF] = useState(() => blank(today));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [drop, setDrop] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!ui.editor) return;
    const e = ui.editor.expense;
    setF(e ? {
      amount: centsToInput(e.amount_cents), vendor: e.vendor, spent_on: e.spent_on, category: e.category,
      payment_method: e.payment_method || '', notes: e.notes || '', is_billable: Boolean(e.is_billable),
      client_id: e.client_id || '', new_client: '', billing_status: e.billing_status || 'unbilled',
    } : { ...blank(today), ...(ui.editor.preset || {}) });
    setFile(null);
    setDrop(false);
    setErrors({});
    setBusy(false);
    setConfirm(false);
  }, [ui.editor, today]);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const vendors = useMemo(() => [...new Set(expenses.map((e) => e.vendor))].slice(0, 80), [expenses]);
  const cat = categoryOf(f.category);
  const set = (key) => (ev) => {
    const t = ev.target;
    setF((s) => ({ ...s, [key]: t.type === 'checkbox' ? t.checked : t.value }));
  };

  async function submit() {
    if (busy) return;
    const cents = parseMoney(f.amount);
    const errs = {};
    if (!Number.isFinite(cents) || cents <= 0) errs.amount = 'Enter an amount above zero.';
    if (!f.vendor.trim()) errs.vendor = 'Add who you paid.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.spent_on)) errs.spent_on = 'Pick the date you paid.';
    if (f.is_billable && f.client_id === '__new' && !f.new_client.trim()) errs.client = 'Name the new client.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      let clientId = f.client_id || null;
      if (f.is_billable && clientId === '__new') clientId = (await addClient(f.new_client.trim())).id;
      const fields = {
        spent_on: f.spent_on, amount_cents: cents, vendor: f.vendor.trim(), category: f.category,
        payment_method: f.payment_method || null, notes: f.notes.trim() || null, is_billable: f.is_billable,
        client_id: f.is_billable ? clientId : null, billing_status: f.is_billable ? f.billing_status : null,
      };
      const prepared = file ? await prepareReceipt(file) : null;
      await saveExpense({ id: editing?.id, fields, file: prepared, dropReceipt: drop && !file, previous: editing?.receipt_path || null });
      ui.closeEditor();
    } catch {
      // the toast already explains what went wrong
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteExpense(editing);
      ui.closeEditor();
    } catch {
      // toast shown
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown = (ev) => {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && !['checkbox', 'file'].includes(ev.target.type)) {
      ev.preventDefault();
      submit();
    }
  };

  const hasStored = Boolean(editing?.receipt_path) && !drop && !file;
  const footer = confirm ? (
    <>
      <p className="sheet-confirm">Delete this expense? This can&rsquo;t be undone.</p>
      <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Delete expense</button>
      <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep it</button>
    </>
  ) : (
    <>
      {editing ? <button type="button" className="btn-text sheet-delete" onClick={() => setConfirm(true)}>Delete</button> : null}
      <span className="grow" />
      <button type="button" className="btn btn-quiet" onClick={() => ui.closeEditor()}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving' : editing ? 'Save changes' : 'Log expense'}</button>
    </>
  );

  return (
    <Sheet open={open} onClose={() => ui.closeEditor()} title={editing ? 'Edit expense' : 'Log an expense'} labelledBy="expense-sheet-title" footer={footer}>
      <div className="form-grid" onKeyDown={onKeyDown}>
        <div className="field">
          <label className="field-label" htmlFor="x-amount">Amount</label>
          <div className="amount-wrap">
            <span className="amount-sign" aria-hidden="true">$</span>
            <input id="x-amount" className="input input-amount tnum" inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.amount} onChange={set('amount')}
              data-autofocus={editing ? undefined : true} aria-invalid={errors.amount ? true : undefined} aria-describedby={errors.amount ? 'x-amount-err' : undefined} />
          </div>
          {errors.amount ? <p id="x-amount-err" className="field-error">{errors.amount}</p> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="x-vendor">Paid to</label>
          <input id="x-vendor" className="input" list="x-vendors" autoComplete="off" placeholder="Vercel, Best Buy, a contractor" value={f.vendor} onChange={set('vendor')}
            aria-invalid={errors.vendor ? true : undefined} aria-describedby={errors.vendor ? 'x-vendor-err' : undefined} />
          <datalist id="x-vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
          {errors.vendor ? <p id="x-vendor-err" className="field-error">{errors.vendor}</p> : null}
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="x-date">Date</label>
            <input id="x-date" type="date" className="input" value={f.spent_on} onChange={set('spent_on')} aria-invalid={errors.spent_on ? true : undefined} />
            {errors.spent_on ? <p className="field-error">{errors.spent_on}</p> : null}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="x-method">Paid with</label>
            <select id="x-method" className="input" value={f.payment_method} onChange={set('payment_method')}>
              <option value="">Not set</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="x-cat">Category</label>
          <select id="x-cat" className="input" value={f.category} onChange={set('category')} aria-describedby="x-cat-hint">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <p id="x-cat-hint" className="field-hint">Schedule C line {cat.line}, {cat.lineLabel.toLowerCase()}{cat.rate ? `, counted at ${cat.rate * 100}%` : ''}.</p>
        </div>

        <div className="field">
          <label className="switch-row">
            <input type="checkbox" className="switch" checked={f.is_billable} onChange={set('is_billable')} />
            <span>Billable to a client</span>
          </label>
          {f.is_billable ? (
            <div className="billable-box">
              <div className="field">
                <label className="field-label" htmlFor="x-client">Client</label>
                <select id="x-client" className="input" value={f.client_id} onChange={set('client_id')}>
                  <option value="">Choose later</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new">Add a new client</option>
                </select>
              </div>
              {f.client_id === '__new' ? (
                <div className="field">
                  <label className="field-label" htmlFor="x-newclient">New client name</label>
                  <input id="x-newclient" className="input" value={f.new_client} onChange={set('new_client')} />
                  {errors.client ? <p className="field-error">{errors.client}</p> : null}
                </div>
              ) : null}
              <div className="field">
                <span className="field-label" id="x-billing">Billing status</span>
                <div className="seg" role="group" aria-labelledby="x-billing">
                  {BILLING.map((b) => (
                    <button key={b.key} type="button" aria-pressed={f.billing_status === b.key} onClick={() => setF((s) => ({ ...s, billing_status: b.key }))}>{b.label}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="field">
          <span className="field-label">Receipt</span>
          <input ref={fileInput} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(ev) => {
              const picked = ev.target.files && ev.target.files[0];
              if (picked) {
                setFile(picked);
                setDrop(false);
              }
              ev.target.value = '';
            }} />
          {file ? (
            <div className="receipt-pick">
              {preview ? <img src={preview} alt="" className="receipt-thumb" /> : <span className="receipt-file"><IconClip width={16} height={16} />{file.name}</span>}
              <div className="receipt-actions">
                <span className="field-hint">Attached. It saves with this expense.</span>
                <button type="button" className="btn-text" onClick={() => setFile(null)}>Remove</button>
              </div>
            </div>
          ) : hasStored ? (
            <div className="receipt-pick">
              <span className="receipt-file"><IconClip width={16} height={16} />Receipt on file</span>
              <div className="receipt-actions">
                <button type="button" className="btn-text" onClick={() => ui.openReceipt(editing)}>View</button>
                <button type="button" className="btn-text" onClick={() => fileInput.current?.click()}>Replace</button>
                <button type="button" className="btn-text" onClick={() => setDrop(true)}>Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-quiet receipt-add" onClick={() => fileInput.current?.click()}>
              <IconCamera />{drop ? 'Attach a different receipt' : 'Add a photo or PDF'}
            </button>
          )}
          {drop && !file ? <p className="field-hint">The old receipt is removed when you save.</p> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="x-notes">Note</label>
          <textarea id="x-notes" className="input" rows={2} placeholder="What it was for" value={f.notes} onChange={set('notes')} />
        </div>
      </div>
    </Sheet>
  );
}
