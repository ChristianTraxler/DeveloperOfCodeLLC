import { supabase } from '../supabaseClient.js';

// Live mode, on the admin's shared Supabase client and session. Tables, policies and the private
// bucket come from supabase/outlay.sql (every name is prefixed outlay so nothing collides).
const BUCKET = 'outlay-receipts';
const PAGE = 1000;
const EXPENSE_FIELDS = ['spent_on', 'amount_cents', 'vendor', 'category', 'payment_method', 'notes', 'is_billable', 'client_id', 'billing_status', 'subscription_id', 'receipt_path'];
const SUB_FIELDS = ['name', 'amount_cents', 'cadence', 'next_renewal', 'category', 'payment_method', 'active', 'notes'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

async function selectAll(table, order) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('*');
    for (const [col, ascending] of order) q = q.order(col, { ascending });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

async function one(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function none(query) {
  const { error } = await query;
  if (error) throw error;
}

export function createSupabaseAdapter() {
  return {
    mode: 'supabase',
    async getSession() {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    onAuthChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
      return () => data.subscription.unsubscribe();
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async load() {
      const [expenses, subscriptions, clients] = await Promise.all([
        selectAll('outlay_expenses', [['spent_on', false], ['created_at', false]]),
        selectAll('outlay_subscriptions', [['next_renewal', true]]),
        selectAll('outlay_clients', [['name', true]]),
      ]);
      return { expenses, subscriptions, clients };
    },
    createExpense: (input) => one(supabase.from('outlay_expenses').insert(pick(input, EXPENSE_FIELDS)).select().single()),
    updateExpense: (id, patch) => one(supabase.from('outlay_expenses').update(pick(patch, EXPENSE_FIELDS)).eq('id', id).select().single()),
    deleteExpense: (id) => none(supabase.from('outlay_expenses').delete().eq('id', id)),
    createSubscription: (input) => one(supabase.from('outlay_subscriptions').insert(pick(input, SUB_FIELDS)).select().single()),
    updateSubscription: (id, patch) => one(supabase.from('outlay_subscriptions').update(pick(patch, SUB_FIELDS)).eq('id', id).select().single()),
    deleteSubscription: (id) => none(supabase.from('outlay_subscriptions').delete().eq('id', id)),
    createClient: (name) => one(supabase.from('outlay_clients').insert({ name }).select().single()),
    async uploadReceipt(expenseId, file) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Sign in again to attach receipts.');
      const ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${data.user.id}/${expenseId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      return path;
    },
    async getReceipt(path) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      return { url: data.signedUrl, type: path.endsWith('.pdf') ? 'application/pdf' : 'image/*', name: path.split('/').pop() };
    },
    async removeReceipt(path) {
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    },
    async reset() {
      throw new Error('Reset only works in preview mode.');
    },
  };
}
