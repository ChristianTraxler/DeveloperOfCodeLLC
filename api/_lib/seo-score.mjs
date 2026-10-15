// api/_lib/seo-score.mjs: turns saved check results into scores and a Next Steps list.
//
// Pure functions, no I/O. Every weight, point value and task title comes from seo-config.mjs.
//
// Scoring (Phase 2 rule from the brief):
//   category score = average score of its non-skipped checks, times 100
//   a category with no scored checks drops out, and the remaining weights are rescaled to 100
//   overall = sum of category score times rescaled weight, divided by 100, rounded

import { CATEGORIES, CHECKS, STATUS_POINTS } from './seo-config.mjs';

const pointsFor = (c) => {
  if (c.status === 'skipped') return null;
  if (typeof c.score === 'number' && Number.isFinite(c.score)) return c.score;
  return STATUS_POINTS[c.status] ?? null;
};

// checks: [{ key, category, status, score }]
// Returns { overall, categories: { [cat]: { score, weight, scored } }, dropped: [cat] }.
// overall is null when no category has a scored check.
export function scoreAudit(checks) {
  const sums = {};
  for (const key of Object.keys(CATEGORIES)) sums[key] = { total: 0, n: 0 };
  for (const c of checks || []) {
    const category = c.category || CHECKS[c.key]?.category;
    const p = pointsFor(c);
    if (!sums[category] || p == null) continue;
    sums[category].total += p;
    sums[category].n++;
  }

  const live = Object.keys(CATEGORIES).filter((k) => sums[k].n > 0);
  const weightTotal = live.reduce((t, k) => t + CATEGORIES[k].weight, 0);
  const categories = {};
  let overall = 0;
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const { total, n } = sums[key];
    if (!n) {
      categories[key] = { score: null, weight: 0, scored: 0 };
      continue;
    }
    const raw = (total / n) * 100;
    const weight = (cat.weight / weightTotal) * 100;
    overall += (raw * weight) / 100;
    categories[key] = { score: Math.round(raw), weight: Math.round(weight * 10) / 10, scored: n };
  }

  return {
    overall: live.length ? Math.round(overall) : null,
    categories,
    dropped: Object.keys(CATEGORIES).filter((k) => !live.includes(k)),
  };
}

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 };
const EFFORT_ORDER = { small: 0, medium: 1, large: 2 };
const STATUS_ORDER = { fail: 0, warn: 1 };
const CHECK_ORDER = Object.keys(CHECKS);

// Every fail or warn becomes one task, ordered: high impact first, then small effort first,
// then fail before warn, then the config's check order so the list is stable.
// Returns [{ checkKey, title, impact, effort, serviceTag, status, priorityOrder }].
export function buildTasks(checks) {
  return (checks || [])
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && CHECKS[c.key])
    .map((c) => {
      const meta = CHECKS[c.key];
      return { checkKey: c.key, title: meta.task || `Fix: ${meta.label}`, impact: meta.impact, effort: meta.effort, serviceTag: meta.service, status: c.status };
    })
    .sort(
      (a, b) =>
        IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] ||
        EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        CHECK_ORDER.indexOf(a.checkKey) - CHECK_ORDER.indexOf(b.checkKey),
    )
    .map((t, i) => ({ ...t, priorityOrder: i + 1 }));
}
