import { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { monthKey, monthName, yearOf, dayNum, shortDate, parseISO, toISO } from '../lib/dates.js';
import { sum, monthToDate, lastMonthToDate, periodRange, inRange, byCategory, monthlyTrend } from '../lib/calc.js';
import { money } from '../lib/money.js';

export function useScrolledPast(px) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > px);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [px]);
  return past;
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export function useOverview() {
  const { expenses, today } = useData();
  return useMemo(() => {
    const mtd = monthToDate(expenses, today);
    const mtdTotal = sum(mtd);
    const prev = lastMonthToDate(expenses, today);
    const lastTotal = sum(prev.list);
    const lastName = monthName(`${prev.key}-01`);
    const diff = mtdTotal - lastTotal;
    let compare;
    if (mtdTotal === 0 && lastTotal === 0) compare = `Nothing had gone out by this point in ${lastName} either.`;
    else if (lastTotal === 0) compare = `Nothing had gone out by this point in ${lastName}.`;
    else if (diff === 0) compare = `Right in line with ${lastName} at this point.`;
    else compare = `That's ${money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than ${lastName} at this point.`;
    const missing = mtd.filter((e) => !e.receipt_path).length;
    const n = mtd.length;
    let receipts = '';
    if (n) receipts = `${n} ${n === 1 ? 'entry' : 'entries'} so far, ${missing ? `${missing} still ${missing === 1 ? 'needs' : 'need'} a receipt.` : 'every receipt on file.'}`;
    const year = yearOf(today);
    const ytdList = expenses.filter((e) => yearOf(e.spent_on) === year && e.spent_on <= today);
    return { today, month: monthName(today), day: dayNum(today), mtdTotal, compare, receipts, ytd: sum(ytdList), yearCount: ytdList.length, year };
  }, [expenses, today]);
}

export const PERIODS = [['month', 'This month'], ['quarter', 'This quarter'], ['year', 'This year']];

export function useSpending(period) {
  const { expenses, today } = useData();
  return useMemo(() => {
    const range = periodRange(period, today);
    const list = inRange(expenses, range);
    const total = sum(list);
    const cats = byCategory(list);
    const top = cats.slice(0, 7);
    const rest = cats.slice(7);
    const rows = rest.length
      ? [...top, { key: 'rest', cents: rest.reduce((t, r) => t + r.cents, 0), cat: { label: `${rest.length} smaller ${rest.length === 1 ? 'category' : 'categories'}`, short: 'Other' } }]
      : top;
    const trend = monthlyTrend(expenses, today, 12);
    const peak = trend.reduce((m, t) => (t.cents > m.cents ? t : m), trend[0]);
    const avg = Math.round(trend.reduce((t, x) => t + x.cents, 0) / trend.length);
    let phrase = `so far in ${today.slice(0, 4)}`;
    if (period === 'month') phrase = `in ${monthName(today)}`;
    if (period === 'quarter') phrase = `since ${shortDate(range[0])}`;
    return { list, total, rows, trend, peak, avg, phrase };
  }, [expenses, today, period]);
}

export function useLedger(pageSize = 40) {
  const { expenses, ui } = useData();
  const { filter, setFilter } = ui;
  const [limit, setLimit] = useState(pageSize);
  useEffect(() => {
    setLimit(pageSize);
  }, [filter, pageSize]);
  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return expenses.filter((e) => {
      if (filter.kind === 'billable' && !e.is_billable) return false;
      if (filter.kind === 'missing' && e.receipt_path) return false;
      if (filter.category && e.category !== filter.category) return false;
      if (q && !`${e.vendor} ${e.notes || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [expenses, filter]);
  const groups = useMemo(() => {
    const totals = new Map();
    for (const e of filtered) totals.set(monthKey(e.spent_on), (totals.get(monthKey(e.spent_on)) || 0) + e.amount_cents);
    const out = [];
    let cur = null;
    for (const e of filtered.slice(0, limit)) {
      const k = monthKey(e.spent_on);
      if (!cur || cur.key !== k) {
        cur = { key: k, total: totals.get(k), list: [] };
        out.push(cur);
      }
      cur.list.push(e);
    }
    return out;
  }, [filtered, limit]);
  return {
    filter,
    filtered,
    groups,
    active: filter.kind !== 'all' || Boolean(filter.category) || Boolean(filter.q.trim()),
    more: Math.max(0, filtered.length - limit),
    showMore: () => setLimit((l) => l + pageSize),
    clear: () => setFilter({ q: '', kind: 'all', category: '' }),
    patch: (p) => setFilter((f) => ({ ...f, ...p })),
  };
}

// Cumulative spend for this month (to today) and all of last month, for pace charts and the dial.
export function useMonthPace() {
  const { expenses, today } = useData();
  return useMemo(() => {
    const t = parseISO(today);
    const days = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    const day = t.getDate();
    const key = today.slice(0, 7);
    const prev = new Date(t.getFullYear(), t.getMonth() - 1, 1, 12);
    const prevKey = toISO(prev).slice(0, 7);
    const prevDays = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
    const cur = new Array(days).fill(0);
    const old = new Array(prevDays).fill(0);
    for (const e of expenses) {
      const k = e.spent_on.slice(0, 7);
      const d = Number(e.spent_on.slice(8, 10));
      if (k === key && e.spent_on <= today) cur[d - 1] += e.amount_cents;
      else if (k === prevKey) old[d - 1] += e.amount_cents;
    }
    const cumulative = (arr, upto) => {
      let s = 0;
      return arr.slice(0, upto).map((v) => (s += v));
    };
    const curCum = cumulative(cur, day);
    const prevCum = cumulative(old, prevDays);
    const mtd = curCum[curCum.length - 1] || 0;
    const prevTotal = prevCum[prevCum.length - 1] || 0;
    return { days, day, curCum, prevCum, mtd, prevTotal, month: monthName(today), prevName: monthName(`${prevKey}-01`) };
  }, [expenses, today]);
}
