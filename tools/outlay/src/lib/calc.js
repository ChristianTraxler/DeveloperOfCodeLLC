import { categoryOf, deductibleCents, compareLines, cadenceOf } from './categories.js';
import { monthKey, yearOf, parseISO, toISO, lastMonthKeys, daysBetween, quarterOf } from './dates.js';

export const sum = (list) => list.reduce((t, e) => t + e.amount_cents, 0);

export function monthToDate(expenses, today) {
  const key = monthKey(today);
  return expenses.filter((e) => monthKey(e.spent_on) === key && e.spent_on <= today);
}

// Last month up to the same day of the month, for a fair comparison.
export function lastMonthToDate(expenses, today) {
  const d = parseISO(today);
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12);
  const key = toISO(prev).slice(0, 7);
  const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  const cutoff = `${key}-${String(Math.min(d.getDate(), lastDay)).padStart(2, '0')}`;
  return { key, list: expenses.filter((e) => monthKey(e.spent_on) === key && e.spent_on <= cutoff) };
}

export function periodRange(period, today) {
  const y = yearOf(today);
  const m = Number(today.slice(5, 7));
  if (period === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (period === 'quarter') return [`${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`, today];
  return [`${y}-01-01`, today];
}

export const inRange = (expenses, [from, to]) => expenses.filter((e) => e.spent_on >= from && e.spent_on <= to);

export function byCategory(list) {
  const map = new Map();
  for (const e of list) map.set(e.category, (map.get(e.category) || 0) + e.amount_cents);
  return [...map.entries()].map(([key, cents]) => ({ key, cents, cat: categoryOf(key) })).sort((a, b) => b.cents - a.cents);
}

export function monthlyTrend(expenses, today, count = 12) {
  const keys = lastMonthKeys(today, count);
  const totals = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const e of expenses) {
    const k = monthKey(e.spent_on);
    if (k in totals && e.spent_on <= today) totals[k] += e.amount_cents;
  }
  return keys.map((key) => ({ key, cents: totals[key] }));
}

export function taxYear(expenses, year) {
  const list = expenses.filter((e) => yearOf(e.spent_on) === year);
  const lines = new Map();
  for (const e of list) {
    const c = categoryOf(e.category);
    const row = lines.get(c.line) || { line: c.line, label: c.lineLabel, cents: 0, deductible: 0, cats: new Set() };
    row.cents += e.amount_cents;
    row.deductible += deductibleCents(e);
    row.cats.add(c.short);
    lines.set(c.line, row);
  }
  const rows = [...lines.values()].sort((a, b) => compareLines(a.line, b.line)).map((r) => ({ ...r, cats: [...r.cats] }));
  const quarters = [1, 2, 3, 4].map((q) => ({ q, cents: sum(list.filter((e) => quarterOf(e.spent_on) === q)) }));
  return {
    list,
    rows,
    total: sum(list),
    deductible: rows.reduce((t, r) => t + r.deductible, 0),
    quarters,
    withReceipt: list.filter((e) => e.receipt_path).length,
    count: list.length,
  };
}

export function billable(expenses, clients, year) {
  const items = expenses.filter((e) => e.is_billable);
  const groupsMap = new Map();
  for (const e of items) {
    const id = e.client_id || 'none';
    if (!groupsMap.has(id)) groupsMap.set(id, []);
    groupsMap.get(id).push(e);
  }
  const nameOf = (id) => (id === 'none' ? 'No client yet' : (clients.find((c) => c.id === id) || {}).name || 'Client removed');
  const groups = [...groupsMap.entries()]
    .map(([id, list]) => ({
      id,
      name: nameOf(id),
      list: [...list].sort((a, b) => b.spent_on.localeCompare(a.spent_on)),
      open: sum(list.filter((e) => e.billing_status !== 'reimbursed')),
    }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  return {
    groups,
    totals: {
      unbilled: sum(items.filter((e) => e.billing_status === 'unbilled')),
      invoiced: sum(items.filter((e) => e.billing_status === 'invoiced')),
      reimbursed: sum(items.filter((e) => e.billing_status === 'reimbursed' && yearOf(e.spent_on) === year)),
    },
  };
}

export const monthlyEquivalent = (s) => Math.round(s.amount_cents / cadenceOf(s.cadence).months);

export function recurring(subs, today) {
  const active = subs.filter((s) => s.active).sort((a, b) => a.next_renewal.localeCompare(b.next_renewal));
  const paused = subs.filter((s) => !s.active);
  return {
    active,
    paused,
    monthly: active.reduce((t, s) => t + monthlyEquivalent(s), 0),
    yearly: Math.round(active.reduce((t, s) => t + (s.amount_cents * 12) / cadenceOf(s.cadence).months, 0)),
    next: active[0] || null,
    soon: active.filter((s) => daysBetween(today, s.next_renewal) <= 7),
  };
}
