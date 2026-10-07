import React, { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import { useData } from '../data/DataContext.jsx';
import { CATEGORIES, PAYMENT_METHODS, CADENCES } from '../lib/categories.js';
import { parseMoney, centsToInput } from '../lib/money.js';

const blank = (today) => ({ name: '', amount: '', cadence: 'monthly', next_renewal: today, category: 'software', payment_method: 'Business card', active: true, notes: '' });

export default function SubscriptionSheet() {
  const { ui, today, saveSubscription, deleteSubscription } = useData();
  const open = Boolean(ui.subEditor);
  const editing = ui.subEditor?.sub || null;
  const [f, setF] = useState(() => blank(today));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!ui.subEditor) return;
    const s = ui.subEditor.sub;
    setF(s ? {
      name: s.name, amount: centsToInput(s.amount_cents), cadence: s.cadence, next_renewal: s.next_renewal, category: s.category,
      payment_method: s.payment_method || '', active: Boolean(s.active), notes: s.notes || '',
    } : blank(today));
    setErrors({});
    setBusy(false);
    setConfirm(false);
  }, [ui.subEditor, today]);

  const set = (key) => (ev) => {
    const t = ev.target;
    setF((s) => ({ ...s, [key]: t.type === 'checkbox' ? t.checked : t.value }));
  };

  async function submit() {
    if (busy) return;
    const cents = parseMoney(f.amount);
    const errs = {};
    if (!f.name.trim()) errs.name = 'Name the subscription.';
    if (!Number.isFinite(cents) || cents <= 0) errs.amount = 'Enter what each charge costs.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.next_renewal)) errs.next_renewal = 'Pick the next renewal date.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await saveSubscription({
        id: editing?.id,
        fields: {
          name: f.name.trim(), amount_cents: cents, cadence: f.cadence, next_renewal: f.next_renewal, category: f.category,
          payment_method: f.payment_method || null, active: f.active, notes: f.notes.trim() || null,
        },
      });
      ui.closeSub();
    } catch {
      // toast shown
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteSubscription(editing);
      ui.closeSub();
    } catch {
      // toast shown
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown = (ev) => {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type !== 'checkbox') {
      ev.preventDefault();
      submit();
    }
  };

  const footer = confirm ? (
    <>
      <p className="sheet-confirm">Delete this subscription? Past charges stay in the ledger.</p>
      <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Delete subscription</button>
      <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep it</button>
    </>
  ) : (
    <>
      {editing ? <button type="button" className="btn-text sheet-delete" onClick={() => setConfirm(true)}>Delete</button> : null}
      <span className="grow" />
      <button type="button" className="btn btn-quiet" onClick={() => ui.closeSub()}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving' : editing ? 'Save changes' : 'Add subscription'}</button>
    </>
  );

  return (
    <Sheet open={open} onClose={() => ui.closeSub()} title={editing ? 'Edit subscription' : 'Add a subscription'} labelledBy="sub-sheet-title" footer={footer}>
      <div className="form-grid" onKeyDown={onKeyDown}>
        <div className="field">
          <label className="field-label" htmlFor="s-name">Name</label>
          <input id="s-name" className="input" placeholder="Vercel Pro" value={f.name} onChange={set('name')} data-autofocus={editing ? undefined : true} />
          {errors.name ? <p className="field-error">{errors.name}</p> : null}
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="s-amount">Each charge</label>
            <input id="s-amount" className="input tnum" inputMode="decimal" placeholder="20.00" value={f.amount} onChange={set('amount')} />
            {errors.amount ? <p className="field-error">{errors.amount}</p> : null}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="s-next">Next renewal</label>
            <input id="s-next" type="date" className="input" value={f.next_renewal} onChange={set('next_renewal')} />
            {errors.next_renewal ? <p className="field-error">{errors.next_renewal}</p> : null}
          </div>
        </div>
        <div className="field">
          <span className="field-label" id="s-cadence">Billed</span>
          <div className="seg" role="group" aria-labelledby="s-cadence">
            {CADENCES.map((c) => <button key={c.key} type="button" aria-pressed={f.cadence === c.key} onClick={() => setF((s) => ({ ...s, cadence: c.key }))}>{c.label}</button>)}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="s-cat">Category</label>
            <select id="s-cat" className="input" value={f.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="s-method">Paid with</label>
            <select id="s-method" className="input" value={f.payment_method} onChange={set('payment_method')}>
              <option value="">Not set</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <label className="switch-row">
          <input type="checkbox" className="switch" checked={f.active} onChange={set('active')} />
          <span>Active, counts toward the monthly total</span>
        </label>
        <div className="field">
          <label className="field-label" htmlFor="s-notes">Note</label>
          <textarea id="s-notes" className="input" rows={2} value={f.notes} onChange={set('notes')} />
        </div>
      </div>
    </Sheet>
  );
}
