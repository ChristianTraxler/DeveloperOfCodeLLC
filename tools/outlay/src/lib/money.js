const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const money = (cents) => usd.format((cents || 0) / 100);

// Accepts "12", "12.5", "$1,284.16" and returns integer cents (NaN when empty).
export function parseMoney(input) {
  const s = String(input ?? '').replace(/[^0-9.]/g, '');
  if (!s || s === '.') return NaN;
  const [whole, frac = ''] = s.split('.');
  return parseInt(whole || '0', 10) * 100 + parseInt(`${frac}00`.slice(0, 2), 10);
}

export const centsToInput = (cents) => (cents ? (cents / 100).toFixed(2) : '');
export const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
