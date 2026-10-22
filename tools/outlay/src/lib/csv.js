import { categoryOf, deductibleCents, billingLabel } from './categories.js';

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dec = (cents) => (cents / 100).toFixed(2);

export function expensesCsv(list, clients) {
  const nameOf = (id) => (clients.find((c) => c.id === id) || {}).name || '';
  const head = ['Date', 'Vendor', 'Category', 'Schedule C line', 'Amount', 'Deductible amount', 'Payment method', 'Billable', 'Client', 'Billing status', 'Receipt on file', 'Notes'];
  const rows = [...list]
    .sort((a, b) => a.spent_on.localeCompare(b.spent_on))
    .map((e) => {
      const c = categoryOf(e.category);
      return [
        e.spent_on, e.vendor, c.label, c.line, dec(e.amount_cents), dec(deductibleCents(e)), e.payment_method || '',
        e.is_billable ? 'Yes' : 'No', e.is_billable ? nameOf(e.client_id) : '', e.is_billable ? billingLabel(e.billing_status) : '',
        e.receipt_path ? 'Yes' : 'No', e.notes || '',
      ];
    });
  return `${[head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}\r\n`;
}

// One row per Schedule C line, for handing to a preparer. `T` is the result of taxYear().
export const SOURCES = [
  ['invoice', 'Invoice'], ['stripe', 'Stripe'], ['paypal', 'PayPal'], ['check', 'Check'], ['cash', 'Cash'], ['other', 'Other'],
];
export const sourceLabel = (key) => (SOURCES.find(([k]) => k === key) || [, 'Other'])[1];

export function incomeCsv(list, clients) {
  const nameOf = (id) => (clients.find((c) => c.id === id) || {}).name || '';
  const head = ['Date received', 'Paid by', 'Client', 'Source', 'Amount', 'Document on file', 'Notes'];
  const rows = [...list]
    .sort((a, b) => a.received_on.localeCompare(b.received_on))
    .map((i) => [i.received_on, i.payer, nameOf(i.client_id), sourceLabel(i.source), dec(i.amount_cents), i.document_path ? 'Yes' : 'No', i.notes || '']);
  return `${[head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}\r\n`;
}

// `I` is the result of incomeYear(). Line 1 is gross receipts, then each expense line, then net profit.
export function taxSummaryCsv(T, year, I = { total: 0, count: 0 }) {
  const head = ['Tax year', 'Schedule C line', 'Description', 'Categories', 'Entries', 'Amount', 'Counted toward Schedule C'];
  const counts = new Map();
  for (const e of T.list) {
    const line = categoryOf(e.category).line;
    counts.set(line, (counts.get(line) || 0) + 1);
  }
  const rows = [[year, '1', 'Gross receipts or sales', 'Income', I.count, dec(I.total), dec(I.total)]];
  rows.push(...T.rows.map((r) => [year, r.line, r.label, r.cats.join('; '), counts.get(r.line) || 0, dec(r.cents), dec(r.deductible)]));
  rows.push([year, '', 'Total expenses', '', T.count, dec(T.total), dec(T.deductible)]);
  rows.push([year, '31', 'Net profit (gross receipts minus deductible expenses)', '', '', '', dec(I.total - T.deductible)]);
  return `${[head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}\r\n`;
}
