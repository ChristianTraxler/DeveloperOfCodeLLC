import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import { useData } from '../data/DataContext.jsx';
import { SOURCES } from '../lib/csv.js';
import { parseMoney, centsToInput } from '../lib/money.js';
import { prepareReceipt } from '../lib/files.js';
import { IconClip, IconCamera } from './Icons.jsx';

const blank = (today) => ({ amount: '', payer: '', received_on: today, source: 'invoice', client_id: '', new_client: '', notes: '' });

export default function IncomeSheet() {
  const { ui, today, clients, income, saveIncome, deleteIncome, addClient, openIncomeDoc } = useData();
  const open = Boolean(ui.incomeEditor);
  const editing = ui.incomeEditor?.income || null;
  const [f, setF] = useState(() => blank(today));
  const [file, setFile] = useState(null);
  const [drop, setDrop] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!ui.incomeEditor) return;
    const i = ui.incomeEditor.income;
    setF(i ? {
      amount: centsToInput(i.amount_cents), payer: i.payer, received_on: i.received_on, source: i.source,
      client_id: i.client_id || '', new_client: '', notes: i.notes || '',
    } : blank(today));
    setFile(null);
    setDrop(false);
    setErrors({});
    setBusy(false);
    setConfirm(false);
  }, [ui.incomeEditor, today]);

  const payers = useMemo(() => [...new Set(income.map((i) => i.payer))].slice(0, 80), [income]);
  const set = (key) => (ev) => setF((s) => ({ ...s, [key]: ev.target.value }));

  async function submit() {
    if (busy) return;
    const cents = parseMoney(f.amount);
    const errs = {};
    if (!Number.isFinite(cents) || cents <= 0) errs.amount = 'Enter an amount above zero.';
    if (!f.payer.trim()) errs.payer = 'Add who paid you.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.received_on)) errs.received_on = 'Pick the date it landed.';
    if (f.client_id === '__new' && !f.new_client.trim()) errs.client = 'Name the new client.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      let clientId = f.client_id || null;
      if (clientId === '__new') clientId = (await addClient(f.new_client.trim())).id;
      const fields = {
        received_on: f.received_on, amount_cents: cents, payer: f.payer.trim(), source: f.source,
        client_id: clientId, notes: f.notes.trim() || null,
      };
      const prepared = file ? await prepareReceipt(file) : null;
      await saveIncome({ id: editing?.id, fields, file: prepared, dropDoc: drop && !file, previous: editing?.document_path || null });
      ui.closeIncome();
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
      await deleteIncome(editing);
      ui.closeIncome();
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

  const hasStored = Boolean(editing?.document_path) && !drop && !file;
  const footer = confirm ? (
    <>
      <p className="sheet-confirm">Delete this income entry? This can&rsquo;t be undone.</p>
      <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Delete income</button>
      <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep it</button>
    </>
  ) : (
    <>
      {editing ? <button type="button" className="btn-text sheet-delete" onClick={() => setConfirm(true)}>Delete</button> : null}
      <span className="grow" />
      <button type="button" className="btn btn-quiet" onClick={() => ui.closeIncome()}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving' : editing ? 'Save changes' : 'Log income'}</button>
    </>
  );

  return (
    <Sheet open={open} onClose={() => ui.closeIncome()} title={editing ? 'Edit income' : 'Log income'} labelledBy="income-sheet-title" footer={footer}>
      <div className="form-grid" onKeyDown={onKeyDown}>
        <div className="field">
          <label className="field-label" htmlFor="i-amount">Amount received</label>
          <div className="amount-wrap">
            <span className="amount-sign" aria-hidden="true">$</span>
            <input id="i-amount" className="input input-amount tnum" inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.amount} onChange={set('amount')}
              data-autofocus={editing ? undefined : true} aria-invalid={errors.amount ? true : undefined} aria-describedby={errors.amount ? 'i-amount-err' : undefined} />
          </div>
          {errors.amount ? <p id="i-amount-err" className="field-error">{errors.amount}</p> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="i-payer">Paid by</label>
          <input id="i-payer" className="input" autoComplete="off" list="i-payers" placeholder="A client, Stripe, a customer" value={f.payer} onChange={set('payer')}
            aria-invalid={errors.payer ? true : undefined} aria-describedby={errors.payer ? 'i-payer-err' : undefined} />
          <datalist id="i-payers">{payers.map((p) => <option key={p} value={p} />)}</datalist>
          {errors.payer ? <p id="i-payer-err" className="field-error">{errors.payer}</p> : null}
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="i-date">Date received</label>
            <input id="i-date" type="date" className="input" value={f.received_on} onChange={set('received_on')} aria-invalid={errors.received_on ? true : undefined} />
            {errors.received_on ? <p className="field-error">{errors.received_on}</p> : null}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="i-source">How it arrived</label>
            <select id="i-source" className="input" value={f.source} onChange={set('source')}>
              {SOURCES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="i-client">Client</label>
          <select id="i-client" className="input" value={f.client_id} onChange={set('client_id')}>
            <option value="">None</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">Add a new client</option>
          </select>
          {f.client_id === '__new' ? (
            <>
              <label className="field-label" htmlFor="i-newclient">New client name</label>
              <input id="i-newclient" className="input" value={f.new_client} onChange={set('new_client')} />
              {errors.client ? <p className="field-error">{errors.client}</p> : null}
            </>
          ) : null}
        </div>

        <div className="field">
          <span className="field-label">Invoice or 1099</span>
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
              <span className="receipt-file"><IconClip width={16} height={16} />{file.name}</span>
              <div className="receipt-actions">
                <span className="field-hint">Attached. It saves with this entry.</span>
                <button type="button" className="btn-text" onClick={() => setFile(null)}>Remove</button>
              </div>
            </div>
          ) : hasStored ? (
            <div className="receipt-pick">
              <span className="receipt-file"><IconClip width={16} height={16} />Document on file</span>
              <div className="receipt-actions">
                <button type="button" className="btn-text" onClick={() => openIncomeDoc(editing)}>View</button>
                <button type="button" className="btn-text" onClick={() => fileInput.current?.click()}>Replace</button>
                <button type="button" className="btn-text" onClick={() => setDrop(true)}>Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-quiet receipt-add" onClick={() => fileInput.current?.click()}>
              <IconCamera />{drop ? 'Attach a different document' : 'Add a photo or PDF'}
            </button>
          )}
          {drop && !file ? <p className="field-hint">The old document is removed when you save.</p> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="i-notes">Note</label>
          <textarea id="i-notes" className="input" rows={2} placeholder="What it was for" value={f.notes} onChange={set('notes')} />
        </div>
      </div>
    </Sheet>
  );
}
