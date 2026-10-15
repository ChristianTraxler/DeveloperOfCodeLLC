// One check, as a row that opens to the plain-English explanation and the facts behind it.
import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Minus, X, Wrench } from 'lucide-react'
import { STATUS, cx, plural } from './lib.js'

const EASE = [0.2, 0.7, 0.2, 1]

export function StatusMark({ status, size = 28 }) {
  const s = STATUS[status] || STATUS.later
  const icon = { pass: <Check size={size * 0.5} strokeWidth={3} />, warn: <Minus size={size * 0.5} strokeWidth={3} />, fail: <X size={size * 0.5} strokeWidth={3} /> }[status]
  return (
    <span
      aria-hidden="true"
      className={cx('grid shrink-0 place-items-center rounded-full border', s.ring, status === 'skipped' && 'border-dashed', status === 'later' && 'border-dashed')}
      style={{ width: size, height: size }}
    >
      {icon}
    </span>
  )
}

// ── Facts behind each check ─────────────────────────────────────────────────

function Fact({ label, children }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[13.5px] text-faint">{label}</dt>
      <dd className="min-w-0 break-words text-[14.5px] leading-relaxed text-bone/90">{children}</dd>
    </div>
  )
}
const Quote = ({ children }) => <span className="font-display text-[16px] italic text-bone">&ldquo;{children}&rdquo;</span>
const Yes = ({ ok, children }) => (
  <span className={cx('inline-flex items-center gap-1.5', ok ? 'text-live' : 'text-danger')}>
    {ok ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
    {children}
  </span>
)
const Links = ({ items }) => (
  <ul className="space-y-1">
    {items.map((u, i) => (
      <li key={i} className="truncate text-[13.5px] text-mute">
        {typeof u === 'string' ? u : (
          <>
            <span className="mr-2 font-semibold text-danger">{u.status ?? u.error ?? ''}</span>
            {u.url}
          </>
        )}
      </li>
    ))}
  </ul>
)

const GBP_LABEL = { hours: 'Hours', photos: 'Photos', website: 'Website link', category: 'Main category' }
const CHECK_LABEL = { title: 'title tag', meta_description: 'meta description', h1: 'main heading', keywords: 'city and service on the page', image_alt: 'image descriptions', internal_links: 'links to other pages', https: 'secure connection', mobile: 'phones', page_speed: 'page speed', sitemap: 'sitemap', robots: 'robots.txt', broken_links: 'broken links', schema: 'business details', nap: 'name, address and phone', gbp: 'Google profile', reviews: 'reviews' }
const SCHEMA_LABEL = { name: 'Name', address: 'Address', telephone: 'Phone', url: 'Website', hours: 'Hours', geo: 'Map location', image: 'Logo or photo', areaServed: 'Service area', priceRange: 'Price range', sameAs: 'Social profiles' }

function Facts({ check }) {
  const d = check.details || {}
  const rows = []
  switch (check.key) {
    case 'title':
      if (d.title) rows.push(<Fact key="t" label="What Google shows"><Quote>{d.title}</Quote> <span className="text-faint">({d.length} characters)</span></Fact>)
      if (d.title) rows.push(<Fact key="k" label="Mentions"><span className="flex flex-wrap gap-x-5"><Yes ok={d.hasService}>the service</Yes><Yes ok={d.hasCity}>the city</Yes></span></Fact>)
      break
    case 'meta_description':
      if (d.description) rows.push(<Fact key="d" label="What Google shows"><Quote>{d.description}</Quote> <span className="text-faint">({d.length} characters)</span></Fact>)
      break
    case 'h1':
      if (d.h1s?.length) rows.push(<Fact key="h" label={d.h1s.length > 1 ? 'Main headings' : 'Main heading'}>{d.h1s.map((h, i) => <span key={i} className="block"><Quote>{h}</Quote></span>)}</Fact>)
      break
    case 'keywords':
      for (const [label, w] of [[`"${d.serviceName}"`, d.service], [d.cityName, d.city]]) {
        if (!w) continue
        rows.push(
          <Fact key={label} label={label}>
            <span className="flex flex-wrap gap-x-5 gap-y-1">
              <Yes ok={w.title}>Title</Yes>
              <Yes ok={w.heading}>Headings</Yes>
              <Yes ok={w.body}>Page text</Yes>
            </span>
          </Fact>,
        )
      }
      break
    case 'image_alt':
      rows.push(<Fact key="n" label="Images">{plural(d.total || 0, 'image')}, {d.missing || 0} without a description{d.decorative ? `, ${d.decorative} marked decorative` : ''}</Fact>)
      if (d.examples?.length) rows.push(<Fact key="e" label="Missing on"><Links items={d.examples} /></Fact>)
      break
    case 'internal_links':
      if (d.pages?.length) rows.push(<Fact key="p" label="Pages linked"><Links items={d.pages} /></Fact>)
      break
    case 'https':
      if (d.insecure?.length) rows.push(<Fact key="i" label="Insecure files"><Links items={d.insecure.map((r) => r.url)} /></Fact>)
      if (d.httpRedirects != null) rows.push(<Fact key="r" label="Old http address"><Yes ok={d.httpRedirects}>{d.httpRedirects ? 'Sends visitors to the secure site' : 'Does not redirect'}</Yes></Fact>)
      break
    case 'sitemap':
      if (d.url) rows.push(<Fact key="u" label="Found at"><span className="text-mute">{d.url}</span></Fact>)
      if (d.inRobots != null && d.url) rows.push(<Fact key="r" label="Listed in robots.txt"><Yes ok={d.inRobots}>{d.inRobots ? 'Yes' : 'No'}</Yes></Fact>)
      if (!d.url && d.tried?.length) rows.push(<Fact key="t" label="Looked at"><Links items={d.tried.map((t) => `${t.url} (${t.status ?? t.error})`)} /></Fact>)
      break
    case 'robots':
      if (d.sitemaps?.length) rows.push(<Fact key="s" label="Points to"><Links items={d.sitemaps} /></Fact>)
      break
    case 'broken_links':
      rows.push(<Fact key="c" label="Links tested">{d.checked || 0}{d.capped ? ' (the first 40 on the page)' : ''}{d.unverifiable ? `, ${d.unverifiable} could not be verified (social sites often block tools)` : ''}</Fact>)
      if (d.broken?.length) rows.push(<Fact key="b" label="Broken"><Links items={d.broken} /></Fact>)
      if (d.unreachable?.length) rows.push(<Fact key="u" label="No answer"><Links items={d.unreachable.map((u) => u.url)} /></Fact>)
      break
    case 'schema':
      if (d.type) rows.push(<Fact key="t" label="Described as"><span className="text-bone">{d.type}</span></Fact>)
      if (d.has)
        rows.push(
          <Fact key="h" label="Details included">
            <span className="flex flex-wrap gap-x-5 gap-y-1.5">
              {Object.entries(SCHEMA_LABEL).map(([k, label]) => (
                <Yes key={k} ok={d.has[k]}>{label}</Yes>
              ))}
            </span>
          </Fact>,
        )
      if (!d.type && d.found?.length) rows.push(<Fact key="f" label="Found instead">{d.found.join(', ')}</Fact>)
      break
    case 'mobile':
      rows.push(<Fact key="v" label="Phone setting">{d.viewport ? <span className="text-mute">{d.viewport}</span> : <span className="text-danger">None</span>}</Fact>)
      if (d.pageSpeedSeo != null) rows.push(<Fact key="s" label="Google's SEO basics score">{d.pageSpeedSeo} out of 100</Fact>)
      break
    case 'gbp':
      if (d.has)
        rows.push(
          <Fact key="h" label="On the profile">
            <span className="flex flex-wrap gap-x-5 gap-y-1.5">
              {Object.entries(GBP_LABEL).map(([k, label]) => (
                <Yes key={k} ok={d.has[k]}>{label}</Yes>
              ))}
            </span>
          </Fact>,
        )
      if (d.category) rows.push(<Fact key="c" label="Main category">{d.category}</Fact>)
      if (d.hours?.length) rows.push(<Fact key="o" label="Hours"><span className="text-mute">{d.hours.join(', ')}</span></Fact>)
      if (d.found === false && d.query) rows.push(<Fact key="q" label="Searched for">{d.query}</Fact>)
      break
    case 'reviews':
      rows.push(<Fact key="r" label="Reviews">{d.reviews ?? 0}{d.rating != null ? `, rated ${d.rating.toFixed(1)}` : ''}</Fact>)
      if (d.competitorAverage != null) rows.push(<Fact key="c" label="Competitors average">{d.competitorAverage} reviews{d.competitorRating != null ? `, rated ${d.competitorRating.toFixed(1)}` : ''}</Fact>)
      break
    case 'nap':
      for (const i of d.items || [])
        rows.push(
          <Fact key={i.key} label={i.label}>
            <Yes ok={i.ok}>{i.ok ? 'Matches' : 'Does not match'}</Yes>
            <span className="mt-1 block text-[13.5px] text-mute">Google: {i.google || 'none'}</span>
            <span className="block text-[13.5px] text-mute">Site: {i.site || 'not found on the home page'}</span>
          </Fact>,
        )
      break
    case 'rank':
      rows.push(<Fact key="k" label="Search">{d.keyword}</Fact>)
      rows.push(<Fact key="p" label="Position">{d.position ?? 'Not in the top 10'}</Fact>)
      break
    case 'competitors':
      if (d.competitors?.length) rows.push(<Fact key="n" label="Compared with">{d.competitors.join(', ')}</Fact>)
      if (d.behind?.length) rows.push(<Fact key="b" label="Behind on"><span className="text-danger">{d.behind.map((k) => CHECK_LABEL[k] || k).join(', ')}</span></Fact>)
      if (d.ahead?.length) rows.push(<Fact key="a" label="Ahead on"><span className="text-live">{d.ahead.map((k) => CHECK_LABEL[k] || k).join(', ')}</span></Fact>)
      break
    default:
      break
  }
  if (check.status === 'skipped' && d.reason) rows.push(<Fact key="why" label="Why">{d.reason}</Fact>)
  if (!rows.length) return null
  return <dl className="mt-5 divide-y divide-line border-y border-line">{rows}</dl>
}

const IMPACT = { high: 'High impact', medium: 'Medium impact', low: 'Low impact' }
const EFFORT = { small: 'small job', medium: 'medium job', large: 'big job' }

export function CheckRow({ check, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const s = STATUS[check.status]
  const sellable = check.status === 'fail' || check.status === 'warn'
  return (
    <li className="border-b border-line last:border-b-0">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="group flex w-full items-start gap-4 py-5 text-left sm:items-center sm:gap-5">
        <StatusMark status={check.status} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-[16.5px] font-semibold tracking-[-0.005em]">{check.label}</span>
            <span className={cx('text-[13px] font-semibold', s.tone)}>{s.label}</span>
          </span>
          <span className="mt-1 block text-[14.5px] leading-snug text-mute">{check.summary}</span>
        </span>
        <ChevronDown size={19} aria-hidden="true" className={cx('mt-1 shrink-0 text-faint transition-transform duration-300 group-hover:text-bone sm:mt-0', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: EASE }} className="overflow-hidden">
            <div className="pb-7 pl-0 sm:pl-[48px]">
              <p className="max-w-[66ch] text-[16px] leading-[1.7] text-bone/90">{check.explanation}</p>
              <Facts check={check} />
              {sellable && check.service && (
                <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]">
                  <span className="inline-flex h-8 items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3.5 font-semibold text-[#ff9a6e]">
                    <Wrench size={14} aria-hidden="true" />I can fix this: {check.service}
                  </span>
                  <span className="text-faint">
                    {IMPACT[check.impact]}, {EFFORT[check.effort]}
                  </span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
