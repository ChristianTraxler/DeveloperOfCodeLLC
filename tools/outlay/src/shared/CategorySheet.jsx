import React, { useState } from 'react';
import Sheet from './Sheet.jsx';
import { useData } from '../data/DataContext.jsx';
import { SCHEDULE_C_LINES } from '../lib/categories.js';
import { IconPlus, IconClose } from './Icons.jsx';

export default function CategorySheet() {
  const { ui, categories, expenses, subscriptions, addCategory, deleteCategory } = useData();
  const [name, setName] = useState('');
  const [line, setLine] = useState('27a');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const uses = (key) => expenses.filter((e) => e.category === key).length + subscriptions.filter((s) => s.category === key).length;

  async function add() {
    if (busy) return;
    if (!name.trim()) {
      setError('Name the category.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await addCategory(name, line);
      setName('');
    } catch {
      // the toast explains
    } finally {
      setBusy(false);
    }
  }

  async function remove(cat) {
    if (busy) return;
    setBusy(true);
    try {
      await deleteCategory(cat);
    } catch {
      // the toast explains
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={ui.categoriesOpen} onClose={() => ui.closeCategories()} title="Categories" labelledBy="category-sheet-title"
      footer={<><span className="grow" /><button type="button" className="btn btn-primary" onClick={() => ui.closeCategories()}>Done</button></>}>
      <div className="form-grid" onKeyDown={(ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); add(); } }}>
        <div className="field">
          <label className="field-label" htmlFor="c-name">Add a category</label>
          <input id="c-name" className="input" autoComplete="off" placeholder="Coffee, Books, Parking" value={name}
            onChange={(ev) => setName(ev.target.value)} aria-invalid={error ? true : undefined} />
          {error ? <p className="field-error">{error}</p> : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="c-line">Tax line</label>
          <select id="c-line" className="input" value={line} onChange={(ev) => setLine(ev.target.value)}>
            {SCHEDULE_C_LINES.map((l) => <option key={l.line} value={l.line}>Line {l.line}, {l.lineLabel}</option>)}
          </select>
          <p className="field-hint">Where it lands on Schedule C. Confirm with your tax preparer if you are unsure.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={add} disabled={busy}><IconPlus />Add category</button>

        <div className="field">
          <span className="field-label">Your categories, A to Z</span>
          <ul className="cat-list">
            {categories.map((c) => {
              const n = uses(c.key);
              return (
                <li key={c.key}>
                  <span className="cat-name">{c.label}<span className="cat-meta">Line {c.line}{n ? `, ${n} ${n === 1 ? 'entry' : 'entries'}` : ''}</span></span>
                  <button type="button" className="icon-btn" onClick={() => remove(c)} disabled={busy} aria-label={`Delete ${c.label}`} title={n ? 'In use. Move its entries first.' : 'Delete'}><IconClose width={18} height={18} /></button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}
