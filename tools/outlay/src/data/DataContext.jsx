import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { todayISO, addMonths, shortDate } from '../lib/dates.js';
import { cadenceOf } from '../lib/categories.js';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const LOGIN_URL = '/admin/login.html';

// The data swap point. Outlay reads and writes Supabase through the admin's shared client and
// session. The sample-data adapter stays as a dev fallback: run `VITE_OUTLAY_DATA=sample npm run dev`.
async function makeAdapter() {
  if (import.meta.env.VITE_OUTLAY_DATA === 'sample') {
    const mod = await import('./adapters/demo.js');
    return mod.createDemoAdapter();
  }
  const mod = await import('./adapters/supabase.js');
  return mod.createSupabaseAdapter();
}

// No session means the admin login, the same as every other tool behind it.
const toLogin = () => window.location.replace(LOGIN_URL);

const byDateDesc = (a, b) => (a.spent_on === b.spent_on
  ? String(b.created_at || '').localeCompare(String(a.created_at || ''))
  : b.spent_on.localeCompare(a.spent_on));

function sortAll(d) {
  return {
    expenses: [...(d.expenses || [])].sort(byDateDesc),
    subscriptions: [...(d.subscriptions || [])].sort((a, b) => a.next_renewal.localeCompare(b.next_renewal)),
    clients: [...(d.clients || [])].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function DataProvider({ children }) {
  const adapter = useRef(null);
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState({ expenses: [], subscriptions: [], clients: [] });
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState(null);
  const [editor, setEditor] = useState(null);
  const [subEditor, setSubEditor] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [filter, setFilter] = useState({ q: '', kind: 'all', category: '' });
  const today = todayISO();

  const notify = useCallback((message, tone = 'ok') => setToast({ message, tone, id: `${Date.now()}${Math.random()}` }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    try {
      setData(sortAll(await adapter.current.load()));
      setStatus('ready');
    } catch (err) {
      setError(err?.message || String(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let live = true;
    let off = () => {};
    (async () => {
      try {
        const a = await makeAdapter();
        if (!live) return;
        adapter.current = a;
        setMode(a.mode);
        if (a.mode === 'supabase') {
          const s = await a.getSession();
          if (!live) return;
          setSession(s);
          off = a.onAuthChange((next) => {
            setSession(next);
            if (next) load();
            else {
              setStatus('signed-out');
              toLogin();
            }
          });
          if (s) await load();
          else {
            setStatus('signed-out');
            toLogin();
          }
        } else {
          await load();
        }
      } catch (err) {
        if (live) {
          setError(err?.message || String(err));
          setStatus('error');
        }
      }
    })();
    return () => {
      live = false;
      off();
    };
  }, [load]);

  const run = useCallback(async (fn, okMsg) => {
    try {
      const result = await fn(adapter.current);
      const msg = typeof okMsg === 'function' ? okMsg(result) : okMsg;
      if (msg) notify(msg);
      return result;
    } catch (err) {
      notify(err?.message || 'That did not save. Try again.', 'error');
      throw err;
    }
  }, [notify]);

  const saveExpense = useCallback(({ id, fields, file, dropReceipt, previous }) => run(async (a) => {
    let row;
    if (id) {
      const patch = { ...fields };
      if (file) patch.receipt_path = await a.uploadReceipt(id, file);
      else if (dropReceipt) patch.receipt_path = null;
      row = await a.updateExpense(id, patch);
      if ((file || dropReceipt) && previous && previous !== 'sample') a.removeReceipt(previous).catch(() => {});
    } else {
      row = await a.createExpense({ ...fields, subscription_id: null, receipt_path: null });
      if (file) row = await a.updateExpense(row.id, { receipt_path: await a.uploadReceipt(row.id, file) });
    }
    setData((d) => sortAll({ ...d, expenses: id ? d.expenses.map((x) => (x.id === id ? row : x)) : [row, ...d.expenses] }));
    return row;
  }, id ? 'Changes saved.' : 'Expense logged.'), [run]);

  const deleteExpense = useCallback((e) => run(async (a) => {
    if (e.receipt_path && e.receipt_path !== 'sample') await a.removeReceipt(e.receipt_path).catch(() => {});
    await a.deleteExpense(e.id);
    setData((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) }));
  }, 'Expense deleted.'), [run]);

  const setBilling = useCallback((e, billing_status) => run(async (a) => {
    const row = await a.updateExpense(e.id, { billing_status });
    setData((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === e.id ? row : x)) }));
    return row;
  }), [run]);

  const addClient = useCallback((name) => run(async (a) => {
    const row = await a.createClient(name);
    setData((d) => sortAll({ ...d, clients: [...d.clients, row] }));
    return row;
  }), [run]);

  const saveSubscription = useCallback(({ id, fields }) => run(async (a) => {
    const row = id ? await a.updateSubscription(id, fields) : await a.createSubscription(fields);
    setData((d) => sortAll({ ...d, subscriptions: id ? d.subscriptions.map((x) => (x.id === id ? row : x)) : [...d.subscriptions, row] }));
    return row;
  }, id ? 'Changes saved.' : 'Subscription added.'), [run]);

  const deleteSubscription = useCallback((s) => run(async (a) => {
    await a.deleteSubscription(s.id);
    setData((d) => ({
      ...d,
      subscriptions: d.subscriptions.filter((x) => x.id !== s.id),
      expenses: d.expenses.map((x) => (x.subscription_id === s.id ? { ...x, subscription_id: null } : x)),
    }));
  }, 'Subscription deleted.'), [run]);

  const logCharge = useCallback((s) => run(async (a) => {
    const spent_on = s.next_renewal <= today ? s.next_renewal : today;
    const exp = await a.createExpense({
      spent_on, amount_cents: s.amount_cents, vendor: s.name, category: s.category, payment_method: s.payment_method || null,
      notes: null, is_billable: false, client_id: null, billing_status: null, subscription_id: s.id, receipt_path: null,
    });
    const next = addMonths(s.next_renewal, cadenceOf(s.cadence).months);
    const sub = await a.updateSubscription(s.id, { next_renewal: next });
    setData((d) => sortAll({ ...d, expenses: [exp, ...d.expenses], subscriptions: d.subscriptions.map((x) => (x.id === s.id ? sub : x)) }));
    return next;
  }, (next) => `Charge logged. Next renewal ${shortDate(next)}.`), [run, today]);

  // Charges that came due while the app was closed become ledger entries on load. Each missed
  // period is logged at its own renewal date, and a date that already has an entry is skipped so
  // a half-finished run never double counts.
  const autoLogged = useRef(false);
  const autoLogDue = useCallback(async (snapshot) => {
    const logged = [];
    for (const s of snapshot.subscriptions.filter((x) => x.active && x.next_renewal <= today)) {
      try {
        const have = new Set(snapshot.expenses.filter((e) => e.subscription_id === s.id).map((e) => e.spent_on));
        let next = s.next_renewal;
        let guard = 0;
        while (next <= today && guard < 36) {
          if (!have.has(next)) {
            const exp = await adapter.current.createExpense({
              spent_on: next, amount_cents: s.amount_cents, vendor: s.name, category: s.category, payment_method: s.payment_method || null,
              notes: null, is_billable: false, client_id: null, billing_status: null, subscription_id: s.id, receipt_path: null,
            });
            logged.push(exp);
          }
          next = addMonths(next, cadenceOf(s.cadence).months);
          guard += 1;
        }
        const sub = await adapter.current.updateSubscription(s.id, { next_renewal: next });
        setData((d) => sortAll({ ...d, subscriptions: d.subscriptions.map((x) => (x.id === s.id ? sub : x)) }));
      } catch {
        break;
      }
    }
    if (logged.length) {
      setData((d) => sortAll({ ...d, expenses: [...logged, ...d.expenses] }));
      notify(`${logged.length} renewed ${logged.length === 1 ? 'charge was' : 'charges were'} added to the ledger.`);
    }
  }, [today, notify]);

  useEffect(() => {
    if (status !== 'ready' || autoLogged.current || !adapter.current) return;
    autoLogged.current = true;
    autoLogDue(data);
  }, [status, data, autoLogDue]);

  const resetDemo = useCallback((kind) => run(async (a) => {
    setData(sortAll(await a.reset(kind)));
  }, kind === 'empty' ? 'Ledger cleared. Log your first real expense.' : 'Sample data restored.'), [run]);

  const signOut = useCallback(() => adapter.current.signOut(), []);
  const getReceipt = useCallback((e) => adapter.current.getReceipt(e.receipt_path, e), []);

  const serials = useMemo(() => {
    const asc = [...data.expenses].sort((a, b) => -byDateDesc(a, b));
    return new Map(asc.map((e, i) => [e.id, i + 1]));
  }, [data.expenses]);

  const ui = useMemo(() => ({
    editor,
    openEditor: (expense = null, preset = null) => setEditor({ expense, preset }),
    closeEditor: () => setEditor(null),
    subEditor,
    openSub: (sub = null) => setSubEditor({ sub }),
    closeSub: () => setSubEditor(null),
    receipt,
    openReceipt: (e) => setReceipt(e),
    closeReceipt: () => setReceipt(null),
    filter,
    setFilter,
  }), [editor, subEditor, receipt, filter]);

  const value = useMemo(() => ({
    mode, status, error, today, session, ...data, toast, notify, dismissToast, ui,
    serialOf: (id) => serials.get(id) || 0,
    clientName: (id) => (data.clients.find((c) => c.id === id) || {}).name || '',
    saveExpense, deleteExpense, setBilling, addClient, saveSubscription, deleteSubscription, logCharge, resetDemo, signOut, getReceipt,
  }), [mode, status, error, today, session, data, toast, notify, dismissToast, ui, serials, saveExpense, deleteExpense, setBilling, addClient, saveSubscription, deleteSubscription, logCharge, resetDemo, signOut, getReceipt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
