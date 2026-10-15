// Phase 2 pieces of the internal report: category scores, the Next Steps list, and the
// Mark reviewed control that unlocks the client share link.
import { useState } from 'react'
import { Check, Copy, ExternalLink, Lock } from 'lucide-react'
import { Button } from './ui/core.jsx'
import { cx, longWhen } from './lib.js'

export const scoreTone = (n) => (n == null ? 'text-faint' : n >= 90 ? 'text-live' : n >= 50 ? 'text-amber' : 'text-danger')
const scoreBar = (n) => (n >= 90 ? 'bg-live' : n >= 50 ? 'bg-amber' : 'bg-danger')

export function CategoryBars({ categories, scores = {} }) {
  const visibilityDropped = scores.visibility?.score == null
  return (
    <section aria-labelledby="seo-cats" className="mt-14 border-t border-line pt-10">
      <h2 id="seo-cats" className="display text-[30px] leading-none sm:text-[34px]">
        Score by category
      </h2>
      <ul className="mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2">
        {Object.entries(categories).map(([key, cat]) => {
          const s = scores[key] || {}
          const n = s.score
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[16px] font-semibold">{cat.label}</span>
                <span className={cx('display text-[30px] leading-none tabular-nums', scoreTone(n))}>{n ?? '–'}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                {n != null && <div className={cx('h-full rounded-full', scoreBar(n))} style={{ width: `${Math.max(n, 2)}%` }} />}
              </div>
              <p className="mt-2 text-[13px] text-faint">
                {n == null
                  ? key === 'visibility'
                    ? 'Rank not checked, so this is left out of the score.'
                    : 'Nothing here was checked, so it is left out of the score.'
                  : `Counts for ${s.weight}% of the overall score.`}
              </p>
            </li>
          )
        })}
      </ul>
      {visibilityDropped && <p className="mt-7 text-[13.5px] text-faint">Rank not checked. The other categories are scaled up to make 100.</p>}
    </section>
  )
}

const IMPACT = { high: 'High impact', medium: 'Medium impact', low: 'Low impact' }
const EFFORT = { small: 'Quick fix', medium: 'Some work', large: 'Bigger job' }

export function NextSteps({ tasks, onToggle }) {
  if (!tasks.length) {
    return (
      <section aria-labelledby="seo-next" className="mt-16">
        <h2 id="seo-next" className="display text-[30px] leading-none sm:text-[34px]">
          Next Steps
        </h2>
        <p className="mt-4 text-[15px] text-mute">Nothing to fix or tighten on the checks that ran.</p>
      </section>
    )
  }
  const left = tasks.filter((t) => !t.done).length
  return (
    <section aria-labelledby="seo-next" className="mt-16 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
      <div>
        <h2 id="seo-next" className="display text-[30px] leading-[1.05] sm:text-[34px]">
          Next Steps
        </h2>
        <p className="mt-3 max-w-[32ch] text-[14.5px] leading-relaxed text-mute">
          Biggest wins first. {left === 0 ? 'All done.' : `${left} of ${tasks.length} left.`}
        </p>
      </div>
      <ol className="border-t border-line">
        {tasks.map((t) => (
          <li key={t.id} className="border-b border-line last:border-b-0">
            <label className="flex cursor-pointer items-start gap-4 py-4 sm:gap-5">
              <input type="checkbox" className="peer sr-only" checked={t.done} onChange={(e) => onToggle(t, e.target.checked)} />
              <span
                aria-hidden="true"
                className={cx(
                  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ember peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink',
                  t.done ? 'border-live/50 bg-live/15 text-live' : 'border-line2 text-transparent',
                )}
              >
                <Check size={15} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[16px] font-semibold leading-snug', t.done && 'text-faint line-through decoration-faint/60')}>
                  <span className="mr-2 tabular-nums text-faint">{t.priorityOrder}.</span>
                  {t.title}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mute">
                  <span>{IMPACT[t.impact]}</span>
                  <span>{EFFORT[t.effort]}</span>
                  {t.service && <span className="text-ember/90">{t.service}</span>}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function ShareControl({ audit, onReviewed, busy }) {
  const [copied, setCopied] = useState(false)
  const reviewed = !!audit.reviewed_at
  const link = audit.share_token ? `${window.location.origin}/seo/${audit.share_token}` : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy the client link', link)
    }
  }
  return (
    <section aria-label="Client report" className={cx('mt-10 flex flex-col gap-4 rounded-[22px] border p-5 sm:flex-row sm:items-center sm:p-6', reviewed ? 'border-live/30 bg-live/[0.05]' : 'border-line bg-panel/60')}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15.5px] font-semibold">
          {reviewed ? <Check size={16} className="text-live" strokeWidth={3} /> : <Lock size={15} className="text-faint" />}
          {reviewed ? 'Reviewed. The client link is on.' : 'Not reviewed yet. The client link is off.'}
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-mute">
          {reviewed ? `Marked reviewed ${longWhen(audit.reviewed_at)}. Anyone with the link can open the report.` : 'Read it through first. Marking it reviewed turns on the link you send the business.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {reviewed && link && (
          <>
            <Button variant="ghost" onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Open the client report" onClick={() => window.open(link, '_blank', 'noopener')}>
              <ExternalLink size={15} />
            </Button>
          </>
        )}
        <Button variant={reviewed ? 'quiet' : 'ember'} disabled={busy || audit.status !== 'complete'} onClick={() => onReviewed(!reviewed)}>
          {busy ? 'Saving' : reviewed ? 'Turn link off' : 'Mark reviewed'}
        </Button>
      </div>
    </section>
  )
}
