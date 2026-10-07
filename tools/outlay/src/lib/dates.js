const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
// Noon avoids daylight saving edge cases when doing date math.
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1, 12);
};
export const monthKey = (s) => s.slice(0, 7);
export const yearOf = (s) => Number(s.slice(0, 4));
export const dayNum = (s) => Number(s.slice(8, 10));

export function addMonths(iso, n) {
  const d = parseISO(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISO(t);
}

export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

const f = (opts) => new Intl.DateTimeFormat('en-US', opts);
const fShort = f({ month: 'short', day: 'numeric' });
const fLong = f({ month: 'short', day: 'numeric', year: 'numeric' });
const fMonth = f({ month: 'long' });
const fMonthYear = f({ month: 'long', year: 'numeric' });
const fMon = f({ month: 'short' });
const fWeekday = f({ weekday: 'short' });

export const shortDate = (iso) => fShort.format(parseISO(iso));
export const longDate = (iso) => fLong.format(parseISO(iso));
export const monthName = (iso) => fMonth.format(parseISO(iso));
export const monthYear = (key) => fMonthYear.format(parseISO(`${key.slice(0, 7)}-01`));
export const monthShort = (key) => fMon.format(parseISO(`${key.slice(0, 7)}-01`));
export const weekday = (iso) => fWeekday.format(parseISO(iso));

export function relativeDays(from, to) {
  const n = daysBetween(from, to);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 1 ? `in ${n} days` : `${-n} days ago`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function lastMonthKeys(today, count) {
  const d = parseISO(today);
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(toISO(new Date(d.getFullYear(), d.getMonth() - i, 1, 12)).slice(0, 7));
  return out;
}

export const quarterOf = (iso) => Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
export const QUARTER_LABEL = { 1: 'Jan to Mar', 2: 'Apr to Jun', 3: 'Jul to Sep', 4: 'Oct to Dec' };
