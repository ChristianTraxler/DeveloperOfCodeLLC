import { get as idbGet, set as idbSet, del as idbDel, clear as idbClear, createStore } from 'idb-keyval';
import { buildSample, sampleReceiptSvg } from '../../lib/sample.js';

// Preview mode: data in localStorage, receipt files in IndexedDB, both in this browser only.
const KEY = 'outlay:v1';
const files = new Map();
let store = null;
try {
  store = createStore('outlay-receipts', 'files');
} catch {
  store = null;
}

const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage can be full or blocked; the session keeps working in memory
  }
}

export function createDemoAdapter() {
  let state = read();
  if (!state || !Array.isArray(state.expenses)) {
    state = buildSample();
    write(state);
  }
  const save = () => write(state);
  const patchIn = (list, id, patch) => {
    let out = null;
    const next = list.map((row) => {
      if (row.id !== id) return row;
      out = { ...row, ...patch, updated_at: now() };
      return out;
    });
    if (!out) throw new Error('That entry no longer exists.');
    return [next, out];
  };

  return {
    mode: 'demo',
    async load() {
      return clone(state);
    },
    async createExpense(input) {
      const row = { subscription_id: null, receipt_path: null, ...input, id: uid(), created_at: now() };
      state.expenses = [row, ...state.expenses];
      save();
      return row;
    },
    async updateExpense(id, patch) {
      const [next, row] = patchIn(state.expenses, id, patch);
      state.expenses = next;
      save();
      return row;
    },
    async deleteExpense(id) {
      state.expenses = state.expenses.filter((e) => e.id !== id);
      save();
    },
    async createSubscription(input) {
      const row = { ...input, id: uid(), created_at: now() };
      state.subscriptions = [...state.subscriptions, row];
      save();
      return row;
    },
    async updateSubscription(id, patch) {
      const [next, row] = patchIn(state.subscriptions, id, patch);
      state.subscriptions = next;
      save();
      return row;
    },
    async deleteSubscription(id) {
      state.subscriptions = state.subscriptions.filter((s) => s.id !== id);
      state.expenses = state.expenses.map((e) => (e.subscription_id === id ? { ...e, subscription_id: null } : e));
      save();
    },
    async createClient(name) {
      const row = { id: uid(), name, created_at: now() };
      state.clients = [...state.clients, row];
      save();
      return row;
    },
    async uploadReceipt(expenseId, file) {
      const path = `demo/${expenseId}/${Date.now()}-${(file.name || 'receipt').replace(/[^\w.-]+/g, '_')}`;
      const record = { blob: file, type: file.type, name: file.name || 'receipt' };
      files.set(path, record);
      try {
        if (store) await idbSet(path, record, store);
      } catch {
        // kept in memory for this session
      }
      return path;
    },
    async getReceipt(path, expense) {
      if (!path) return null;
      if (path === 'sample') return { url: sampleReceiptSvg(expense), type: 'image/svg+xml', name: 'Sample receipt' };
      let rec = files.get(path);
      if (!rec && store) {
        try {
          rec = await idbGet(path, store);
        } catch {
          rec = null;
        }
      }
      if (!rec) return null;
      return { url: URL.createObjectURL(rec.blob), type: rec.type, name: rec.name, revoke: true };
    },
    async removeReceipt(path) {
      if (!path || path === 'sample') return;
      files.delete(path);
      try {
        if (store) await idbDel(path, store);
      } catch {
        // nothing else to clean up
      }
    },
    async reset(kind) {
      state = kind === 'empty' ? { expenses: [], subscriptions: [], clients: [] } : buildSample();
      save();
      files.clear();
      try {
        if (store) await idbClear(store);
      } catch {
        // ignore
      }
      return clone(state);
    },
  };
}
