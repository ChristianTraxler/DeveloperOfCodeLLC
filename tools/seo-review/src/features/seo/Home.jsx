// The tool's front page: the new review form, then every past review.
import { useRef, useState } from 'react'
import { ArrowUpRight, Globe, RotateCw, UserRound, X } from 'lucide-react'
import { Button, Field, Input } from './ui/core.jsx'
import { Dial, marksFromCounts } from './Dial.jsx'
import { cx, domainOf, plural, tallyFromCategories, when } from './lib.js'
import { isDemo } from './api.js'

const FIELDS = [
  { key: 'business', label: 'Business name', placeholder: 'Blue Ridge Roofing', autoComplete: 'organization' },
  { key: 'city', label: 'City', placeholder: 'Hickory, NC', autoComplete: 'address-level2' },
  { key: 'service', label: 'Main service', placeholder: 'Roofing', autoComplete: 'off' },
]

function NewReview({ draft, setDraft, onRun, pageSpeedKey, placesKey, leads = [] }) {
  const [errors, setErrors] = useState({})
  const first = useRef(null)
  const set = (k) => (e) => {
    setDraft((d) => ({ ...d, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: null }))
  }
  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!draft.url.trim()) next.url = 'Enter the website address.'
    else if (!/\.[a-z]{2,}/i.test(draft.url)) next.url = 'That address needs a domain, like example.com.'
    if (!draft.business.trim()) next.business = 'Enter the business name.'
    if (!draft.city.trim()) next.city = 'Enter the city the business serves.'
    if (!draft.service.trim()) next.service = 'Enter the main service.'
    setErrors(next)
    if (Object.keys(next).length) return
    onRun({ ...draft, gbpLink: (draft.gbpLink || '').trim() || undefined, leadId: draft.leadId || null, url: draft.url.trim(), business: draft.business.trim(), city: draft.city.trim(), service: draft.service.trim() })
  }

  return (
    <form onSubmit={submit} noValidate className="seo-bench relative overflow-hidden rounded-[30px] border border-line bg-panel/80 p-5 sm:p-8">
      {draft.leadId && (
        <p className="mb-5 flex items-center gap-2 text-[14px] text-mute">
          <UserRound size={15} className="text-ember" />
          <span className="min-w-0 flex-1 truncate">
            Files under the lead <span className="font-semibold text-bone">{leads.find((l) => l.id === draft.leadId)?.business || draft.business}</span>
          </span>
          <button type="button" aria-label="Do not file this review under the lead" onClick={() => setDraft((d) => ({ ...d, leadId: null }))} className="grid h-11 w-11 place-items-center rounded-full text-faint hover:bg-white/[0.06] hover:text-bone">
            <X size={15} />
          </button>
        </p>
      )}
      <Field label="Website" htmlFor="seo-url" error={errors.url}>
        <div className="relative">
          <Globe size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <Input
            ref={first}
            id="seo-url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="yourclient.com"
            value={draft.url}
            onChange={set('url')}
            invalid={!!errors.url}
            className="pl-11 text-[17px]"
          />
        </div>
      </Field>
      <div className="mt-5 grid gap-5 md:grid-cols-[1.5fr_1fr_1fr]">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`seo-${f.key}`} error={errors[f.key]}>
            <Input id={`seo-${f.key}`} placeholder={f.placeholder} autoComplete={f.autoComplete} value={draft[f.key]} onChange={set(f.key)} invalid={!!errors[f.key]} />
          </Field>
        ))}
      </div>
      <Field
        label="Google profile link (optional)"
        htmlFor="seo-gbp"
        className="mt-5"
        hint={placesKey ? 'Only needed if Google matches the wrong listing.' : 'Paste the Google Maps or Share link. After the review you copy a few details from the profile, no Google billing needed.'}
      >
        <Input id="seo-gbp" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="maps.app.goo.gl/..." value={draft.gbpLink || ''} onChange={set('gbpLink')} />
      </Field>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button id="seo-run" type="submit" variant="ember" size="lg" className="w-full sm:w-auto">
          Run review
        </Button>
        <p className="text-[13.5px] leading-snug text-mute sm:max-w-[52ch]">
          Takes 10 to 50 seconds. Reads the home page the way Google does, then checks speed, links, sitemap and business details.
        </p>
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-[14px] text-mute">
        <input type="checkbox" checked={draft.fresh} onChange={(e) => setDraft((d) => ({ ...d, fresh: e.target.checked }))} className="h-[18px] w-[18px] accent-[rgb(var(--ember-rgb))]" />
        Run PageSpeed again even if it ran for this site in the last 24 hours
      </label>
      {pageSpeedKey === false && !isDemo && (
        <p className="mt-5 rounded-2xl border border-amber/30 bg-amber/[0.07] px-4 py-3 text-[13.5px] leading-snug text-[#f6d28e]">
          Page speed will be skipped until <span className="font-semibold">PAGESPEED_API_KEY</span> is added in Vercel. Everything else runs.
        </p>
      )}
    </form>
  )
}

function Counts({ t, className = '' }) {
  const parts = [
    t.fail && <span key="f" className="text-danger">{t.fail} to fix</span>,
    t.warn && <span key="w" className="text-amber">{t.warn} to tighten</span>,
    !t.fail && !t.warn && <span key="p" className="text-live">All {t.pass} working</span>,
  ].filter(Boolean)
  return <span className={cx('flex flex-wrap gap-x-3 gap-y-1 text-[14px] font-medium tabular-nums', className)}>{parts}</span>
}

function ReviewRow({ audit, meta, onOpen }) {
  const t = tallyFromCategories(audit.category_scores)
  const failed = audit.status === 'failed'
  const running = audit.status === 'running'
  return (
    <li>
      <button type="button" onClick={() => onOpen(audit)} disabled={failed || running} className="group flex w-full items-center gap-4 px-1 py-5 text-left transition-colors sm:gap-6 sm:px-3 disabled:cursor-default">
        <Dial marks={marksFromCounts(meta, audit.category_scores)} size={56} title={audit.overall_score != null ? `${audit.business_name}: score ${audit.overall_score} out of 100` : `${audit.business_name} review dial`}>
          {audit.overall_score != null && <span className="text-[15px] font-semibold tabular-nums text-bone">{audit.overall_score}</span>}
        </Dial>
        <span className="min-w-0 flex-1">
          <span className="display line-clamp-2 block text-[22px] leading-tight transition-colors group-hover:text-white sm:text-[24px]">{audit.business_name}</span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px] text-mute">
            <span className="truncate">{domainOf(audit.final_url || audit.site_url)}</span>
            <span className="text-faint">
              {audit.service} in {audit.city}
            </span>
            {audit.reviewed_at && <span className="text-live">Reviewed</span>}
          </span>
          <span className="mt-2 block sm:hidden">
            {failed ? <span className="text-[14px] text-danger">Stopped early</span> : running ? <span className="text-[14px] text-mute">Still running</span> : <Counts t={t} />}
          </span>
        </span>
        <span className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          {failed ? <span className="text-[14px] text-danger">Stopped early</span> : running ? <span className="text-[14px] text-mute">Still running</span> : <Counts t={t} className="justify-end" />}
          <span className="text-[13px] text-faint">{when(audit.created_at)}</span>
        </span>
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line2 text-mute transition-colors group-hover:border-ember group-hover:bg-ember group-hover:text-[#1c0a02] group-disabled:opacity-0">
          <ArrowUpRight size={17} />
        </span>
      </button>
    </li>
  )
}

export function Home({ list, draft, setDraft, onRun, onOpen, onRetry, onLeads }) {
  const { audits, meta, status, error } = list
  const done = audits.filter((a) => a.status === 'complete')
  const totals = done.reduce((acc, a) => {
    const t = tallyFromCategories(a.category_scores)
    acc.fail += t.fail
    acc.warn += t.warn
    return acc
  }, { fail: 0, warn: 0 })

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-10 sm:px-6 sm:pt-16 lg:px-10">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end lg:gap-14">
        <div>
          <h1 className="display text-[clamp(52px,12vw,104px)] leading-[0.88]">SEO Review</h1>
          <p className="mt-6 max-w-[34ch] text-[17px] leading-relaxed text-mute sm:text-[18px]">
            Check how a local business shows up in Google. Every problem it finds is work you can offer to fix.
          </p>
          <Button variant="ghost" size="md" className="mt-7" onClick={onLeads}>
            <UserRound size={16} /> Leads{list.leads?.length ? <span className="tabular-nums text-faint">{list.leads.length}</span> : null}
          </Button>
          {done.length > 0 && (
            <p className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[14px] text-mute">
              <span>
                <span className="display mr-2 text-[30px] text-bone">{done.length}</span>
                {done.length === 1 ? 'site reviewed' : 'sites reviewed'}
              </span>
              <span>
                <span className="display mr-2 text-[30px] text-danger">{totals.fail}</span>
                fixes found
              </span>
            </p>
          )}
        </div>
        <NewReview draft={draft} setDraft={setDraft} onRun={onRun} pageSpeedKey={meta?.pageSpeedKey} placesKey={meta?.placesKey} leads={list.leads} />
      </section>

      <section className="mt-20 sm:mt-24" aria-labelledby="seo-reviews">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
          <h2 id="seo-reviews" className="display text-[30px] leading-none sm:text-[36px]">
            Reviews
          </h2>
          {status === 'ready' && audits.length > 0 && <span className="text-[14px] tabular-nums text-faint">{plural(audits.length, 'review')}</span>}
        </div>
        {status === 'loading' && (
          <ul aria-label="Loading reviews" className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-5 px-1 py-5 sm:px-3">
                <span className="seo-shimmer h-14 w-14 rounded-full" />
                <span className="flex-1 space-y-2.5">
                  <span className="seo-shimmer block h-5 w-1/3 rounded-full" />
                  <span className="seo-shimmer block h-3.5 w-1/4 rounded-full" />
                </span>
              </li>
            ))}
          </ul>
        )}
        {status === 'error' && (
          <div className="mt-8 rounded-[24px] border border-danger/30 bg-danger/[0.06] px-6 py-6">
            <p className="text-[15px] text-bone">The reviews did not load. {error}</p>
            <Button variant="ghost" className="mt-4" onClick={onRetry}>
              <RotateCw size={15} /> Try again
            </Button>
          </div>
        )}
        {status === 'ready' && audits.length === 0 && (
          <div className="mt-8 rounded-[24px] border border-dashed border-line2 px-6 py-12 text-center">
            <p className="mx-auto max-w-[42ch] text-[15.5px] leading-relaxed text-mute">No reviews yet. Run the first one on your own site to see what a review looks like.</p>
            <Button
              variant="ghost"
              className="mt-5"
              onClick={() => {
                setDraft((d) => ({ ...d, url: 'developerofcode.com', business: 'Developer of Code, LLC', city: 'Newton, NC', service: 'Web design' }))
                document.getElementById('seo-url')?.focus()
              }}
            >
              Fill in developerofcode.com
            </Button>
          </div>
        )}
        {status === 'ready' && audits.length > 0 && meta && (
          <ul className="divide-y divide-line">
            {audits.map((a) => (
              <ReviewRow key={a.id} audit={a} meta={meta} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
