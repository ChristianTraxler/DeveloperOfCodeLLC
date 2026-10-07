import { addMonths, toISO, parseISO, todayISO, daysBetween } from './dates.js';

// Deterministic sample ledger for preview mode, always anchored to today's date.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSample(today = todayISO()) {
  const rand = mulberry32(20261006);
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(rand() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  const T = parseISO(today);
  const Y = T.getFullYear();
  const M = T.getMonth();
  const D = T.getDate();
  const iso = (y, m, d) => {
    const first = new Date(y, m, 1, 12);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(d, last), 12));
  };
  const stamp = (d) => `${d}T15:${String(between(10, 59)).padStart(2, '0')}:00.000Z`;

  const clients = ['Ridgeline Roofing Co.', 'Harbor & Finch Dental', 'Old Mill Coffee', 'Sable Creek Farms']
    .map((name) => ({ id: uid(), name, created_at: `${Y - 1}-11-02T15:00:00.000Z` }));

  const expenses = [];
  const add = (e) => expenses.push({
    id: uid(), payment_method: 'Business card', notes: null, is_billable: false, client_id: null,
    billing_status: null, subscription_id: null, receipt_path: null, created_at: stamp(e.spent_on), ...e,
  });
  const receipt = (d) => ((daysBetween(d, today) > 21 ? rand() < 0.88 : rand() < 0.55) ? 'sample' : null);

  const subscriptions = [];
  const created = `${Y - 1}-10-01T12:00:00.000Z`;
  const monthly = [
    ['Google Workspace', 1400, 'software', 1, 'Business card'],
    ['Notion Plus', 1200, 'software', 4, 'Business card'],
    ['Figma Professional', 1600, 'software', 9, 'Business card'],
    ['Vercel Pro', 2000, 'hosting', 12, 'Business card'],
    ['GitHub Copilot', 1000, 'software', 15, 'Business card'],
    ['Claude Pro', 2000, 'software', 18, 'Business card'],
    ['Spectrum Business Internet', 6999, 'utilities', 20, 'Business checking'],
    ['Adobe Creative Cloud', 5999, 'software', 23, 'Business card'],
    ['Supabase Pro', 2500, 'hosting', 26, 'Business card'],
  ];
  for (const [name, cents, category, day, method] of monthly) {
    const id = uid();
    let next = iso(Y, M, day);
    if (next <= today) next = addMonths(next, 1);
    subscriptions.push({ id, name, amount_cents: cents, cadence: 'monthly', next_renewal: next, category, payment_method: method, active: true, notes: null, created_at: created });
    for (let i = 11; i >= 0; i -= 1) {
      const d = iso(Y, M - i, day);
      if (d <= today) add({ spent_on: d, amount_cents: cents, vendor: name, category, payment_method: method, subscription_id: id, receipt_path: receipt(d) });
    }
  }
  const annual = [
    ['developerofcode.com renewal', 1046, 'hosting', 2, 14, 'Business card'],
    ['General liability insurance', 38400, 'insurance', 1, 14, 'Business checking'],
    ['NC LLC annual report', 20000, 'licenses', 3, 15, 'Business checking'],
  ];
  for (const [name, cents, category, month, day, method] of annual) {
    const id = uid();
    const thisYear = iso(Y, month, day);
    const next = thisYear > today ? thisYear : iso(Y + 1, month, day);
    const last = thisYear <= today ? thisYear : iso(Y - 1, month, day);
    subscriptions.push({ id, name, amount_cents: cents, cadence: 'annual', next_renewal: next, category, payment_method: method, active: true, notes: null, created_at: created });
    if (daysBetween(last, today) <= 366) add({ spent_on: last, amount_cents: cents, vendor: name, category, payment_method: method, subscription_id: id, receipt_path: 'sample' });
  }
  const pausedId = uid();
  subscriptions.push({ id: pausedId, name: 'Webflow CMS', amount_cents: 2900, cadence: 'monthly', next_renewal: iso(Y, M + 1, 7), category: 'hosting', payment_method: 'Business card', active: false, notes: 'Paused after the last client site moved to Vercel.', created_at: created });
  for (let i = 9; i >= 7; i -= 1) add({ spent_on: iso(Y, M - i, 7), amount_cents: 2900, vendor: 'Webflow CMS', category: 'hosting', subscription_id: pausedId, receipt_path: 'sample' });

  const pool = [
    ['Amazon', 1299, 5499, 'office', 'Printer ink and paper', 0.45],
    ['Best Buy', 2499, 8999, 'supplies', 'USB-C hub and cables', 0.22],
    ['USPS', 645, 1985, 'office', 'Postage for signed contracts', 0.18],
    ['Main Street Coffee', 860, 1840, 'meals', 'Client coffee, project kickoff', 0.32],
    ['Chick-fil-A', 1512, 3120, 'meals', 'Lunch meeting', 0.22],
    ['Sheetz', 3410, 5980, 'vehicle', 'Fuel, client site visit', 0.35],
    ['Meta Ads', 5000, 15000, 'advertising', 'Studio promo campaign', 0.3],
    ['Google Ads', 4000, 9000, 'advertising', 'Search campaign', 0.2],
    ['Udemy', 1299, 2499, 'education', 'Course', 0.15],
    ['The Loft Coworking', 2500, 2500, 'rent', 'Day pass', 0.3],
    ['Envato Elements', 1650, 1650, 'software', 'Stock assets', 0.12],
  ];
  const billablePool = [
    ['Namecheap', 1298, 1898, 'hosting', 'Client domain registration'],
    ['Adobe Stock', 2999, 7999, 'software', 'Licensed photos for the client site'],
    ['Upwork', 18000, 42000, 'contractors', 'Illustration subcontract'],
    ['Google Workspace', 840, 840, 'software', 'Client mailbox, first month'],
    ['Envato Elements', 1650, 1650, 'software', 'Theme fonts for the client'],
  ];
  for (let i = 11; i >= 0; i -= 1) {
    const maxDay = i === 0 ? Math.max(1, D) : 28;
    for (const [vendor, lo, hi, category, note, p] of pool) {
      if (rand() < p || (i === 0 && rand() < p * 0.6)) {
        const d = iso(Y, M - i, between(1, maxDay));
        if (d <= today) add({ spent_on: d, amount_cents: between(lo, hi), vendor, category, notes: note, receipt_path: receipt(d) });
      }
    }
    for (let k = 0, n = between(2, 4); k < n; k += 1) {
      const d = iso(Y, M - i, between(1, maxDay));
      if (d <= today) add({ spent_on: d, amount_cents: between(180, 2890), vendor: 'Stripe', category: 'fees', payment_method: 'Business checking', notes: 'Processing fee on a client payment', receipt_path: 'sample' });
    }
    if (i <= 6) {
      for (let k = 0, n = between(1, 2); k < n; k += 1) {
        const [vendor, lo, hi, category, note] = billablePool[between(0, billablePool.length - 1)];
        const d = iso(Y, M - i, between(1, maxDay));
        if (d > today) continue;
        const status = i >= 4 ? 'reimbursed' : i >= 1 ? 'invoiced' : 'unbilled';
        add({ spent_on: d, amount_cents: between(lo, hi), vendor, category, notes: note, is_billable: true, client_id: clients[between(0, clients.length - 1)].id, billing_status: status, receipt_path: receipt(d) });
      }
    }
  }
  const one = (monthsAgo, day, vendor, cents, category, note, extra = {}) => {
    const d = iso(Y, M - monthsAgo, day);
    if (d <= today) add({ spent_on: d, amount_cents: cents, vendor, category, notes: note, receipt_path: 'sample', ...extra });
  };
  one(7, 9, 'Apple', 249900, 'equipment', 'MacBook Pro for the studio');
  one(5, 3, 'Southwest Airlines', 23840, 'travel', 'Flight to a web conference');
  one(5, 5, 'Eventbrite', 39900, 'education', 'Two-day web conference');
  one(5, 6, 'Marriott', 41280, 'travel', 'Conference hotel, two nights');
  one(M >= 2 ? M - 2 : M + 10, 12, 'Catawba Tax & Bookkeeping', 45000, 'professional', 'Prior-year return');
  one(2, 14, 'Next Insurance', 1900, 'insurance', 'Equipment rider', { payment_method: 'Business checking' });
  return { expenses, subscriptions, clients };
}

// A plain thermal-receipt picture for sample entries, so the receipt viewer has something to show.
export function sampleReceiptSvg(e) {
  const amt = (e.amount_cents / 100).toFixed(2);
  const lines = [
    e.vendor.toUpperCase().slice(0, 26), '', `DATE  ${e.spent_on}`, `REF   ${String(e.id).slice(0, 8).toUpperCase()}`, '',
    `${'ITEM'.padEnd(16)}${amt.padStart(10)}`, '-'.repeat(26), `${'TOTAL'.padEnd(16)}${amt.padStart(10)}`, '', 'THANK YOU',
  ];
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = lines.map((l, i) => `<text x="26" y="${54 + i * 24}" xml:space="preserve">${escape(l)}</text>`).join('');
  const h = 54 + lines.length * 24 + 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="${h}" viewBox="0 0 340 ${h}"><rect width="340" height="${h}" fill="#fbfaf6"/><g font-family="ui-monospace, Menlo, Consolas, monospace" font-size="16" fill="#2a2a2a">${text}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
